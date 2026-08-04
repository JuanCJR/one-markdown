import { MAX_DOCUMENT_CONTENT_CHARS, type DocumentContentSaved } from '@one-markdown/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTOSAVE_DEBOUNCE_MS,
  DOCUMENT_CONTENT_CONFLICT_CODE,
  UNDO_GROUP_MS,
} from './editor.constants';
import { useEditorStore, type EditorEntry } from './editor.store';
import {
  apiErrorResponse,
  deferredResponse,
  jsonResponse,
  stubApi,
  type ApiStub,
  type StubHandler,
  type StubbedRequest,
} from '../../test/api-stub';
import { configureAuthBridge } from '../../shared/api/http';
import { markdownDocument } from '../../test/workspace-fixtures';

/**
 * Store del editor (spec `003`, AC-16…AC-21, AC-28 y AC-30 en su parte de estado).
 *
 * Los tests no doblan el cliente HTTP: sustituyen la **red** con `stubApi`, así que cada caso
 * ejercita `saveDocumentContent` y `getDocument` de verdad —cabeceras, validación de la respuesta y
 * traducción de errores incluidas— y lo que se cuenta son peticiones reales, no llamadas a un mock.
 * Es la única forma de que «diez ediciones son una petición» signifique algo.
 */

const DOC_ID = 'doc-diario';
const GET_ROUTE = `GET /api/workspace/documents/${DOC_ID}`;
const PUT_ROUTE = `PUT /api/workspace/documents/${DOC_ID}/content`;

const SERVER_TEXT = '# Diario\n';
const SERVER_VERSION = 3;

interface ServerState {
  readonly content: string;
  readonly contentVersion: number;
}

/**
 * Ruta del detalle del documento. Acepta varios estados sucesivos porque el conflicto necesita que
 * la **segunda** lectura devuelva algo distinto de la primera: si las dos devolvieran lo mismo, un
 * store que no releyera nada pasaría el test igual.
 */
function documentRoute(first: ServerState, ...rest: readonly ServerState[]): StubHandler {
  const states = [first, ...rest];
  let read = 0;

  return () => {
    const state = states[read] ?? states[states.length - 1] ?? first;
    read += 1;

    return jsonResponse(
      markdownDocument({
        id: DOC_ID,
        content: state.content,
        contentVersion: state.contentVersion,
      }),
    );
  };
}

function contentSaved(contentVersion: number): DocumentContentSaved {
  return {
    id: DOC_ID,
    contentBytes: 0,
    contentVersion,
    updatedAt: '2026-07-28T10:00:00.000Z',
  };
}

/** Deja el documento abierto y devuelve el doble de red, ya contando peticiones. */
async function openDocument(routes: Record<string, StubHandler> = {}): Promise<ApiStub> {
  const api = stubApi({
    [GET_ROUTE]: documentRoute({ content: SERVER_TEXT, contentVersion: SERVER_VERSION }),
    ...routes,
  });

  await useEditorStore.getState().open(DOC_ID);

  return api;
}

function entry(): EditorEntry {
  const found = useEditorStore.getState().entries[DOC_ID];

  if (found === undefined) {
    throw new Error(`El store no tiene entrada para ${DOC_ID}`);
  }

  return found;
}

function sentContent(call: StubbedRequest | undefined): unknown {
  return (call?.body as { readonly content?: unknown } | undefined)?.content;
}

function sentVersion(call: StubbedRequest | undefined): unknown {
  return (call?.body as { readonly expectedVersion?: unknown } | undefined)?.expectedVersion;
}

beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState(), true);

  // Temporizadores falsos en **todos** los casos, no solo en los del debounce: cualquier `setDraft`
  // deja uno programado, y con temporizadores reales ese pendiente sobreviviría al caso y dispararía
  // una petición en mitad del siguiente.
  vi.useFakeTimers();

  configureAuthBridge({
    getAccessToken: () => 'access-token-1',
    onSessionRenewed: () => undefined,
    onSessionLost: () => undefined,
  });
});

afterEach(() => {
  // El borrador vive en memoria y nada más (spec §4: nada de autoguardado local). Si algún día
  // alguien le añade `persist` al store, estas dos líneas son lo que lo impide.
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);

  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useEditorStore — apertura y estado sucio (AC-16)', () => {
  it('open pide el documento y lo deja limpio, con el borrador igual a lo guardado', async () => {
    const api = await openDocument();

    expect(api.callsTo(GET_ROUTE)).toHaveLength(1);
    expect(entry()).toMatchObject({
      savedContent: SERVER_TEXT,
      draft: SERVER_TEXT,
      contentVersion: SERVER_VERSION,
      status: 'clean',
      error: null,
    });
  });

  it('setDraft con texto distinto ensucia, y volver al original vuelve a dejarlo limpio', async () => {
    await openDocument();

    useEditorStore.getState().setDraft(DOC_ID, `${SERVER_TEXT}algo más`);
    expect(entry().status).toBe('dirty');

    useEditorStore.getState().setDraft(DOC_ID, SERVER_TEXT);
    expect(entry().status).toBe('clean');
  });

  it('deshacer hasta el original cancela el guardado pendiente y no emite ninguna petición', async () => {
    const api = await openDocument();

    useEditorStore.getState().setDraft(DOC_ID, `${SERVER_TEXT}algo más`);
    useEditorStore.getState().setDraft(DOC_ID, SERVER_TEXT);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 4);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it('open propaga el fallo del servidor y no deja ninguna entrada a medias', async () => {
    stubApi({ [GET_ROUTE]: () => apiErrorResponse(404, 'Documento no encontrado') });

    await expect(useEditorStore.getState().open(DOC_ID)).rejects.toThrow();
    expect(useEditorStore.getState().entries[DOC_ID]).toBeUndefined();
  });

  it('open no pisa un borrador sin guardar que quedó de una visita anterior (AC-28)', async () => {
    await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(500, 'Se cayó todo') });

    useEditorStore.getState().setDraft(DOC_ID, 'lo que escribí y no se guardó');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    await useEditorStore.getState().flush(DOC_ID);

    const api = await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(500, 'Se cayó todo') });

    expect(entry().draft).toBe('lo que escribí y no se guardó');
    expect(api.callsTo(GET_ROUTE)).toHaveLength(0);
  });
});

describe('useEditorStore — debounce y coalescencia (AC-17)', () => {
  it('diez setDraft dentro de la ventana emiten exactamente una petición', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    for (let i = 1; i <= 10; i += 1) {
      useEditorStore.getState().setDraft(DOC_ID, `${SERVER_TEXT}línea ${String(i)}`);
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS / 15);
    }

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    const puts = api.callsTo(PUT_ROUTE);

    expect(puts).toHaveLength(1);
    expect(sentContent(puts[0])).toBe(`${SERVER_TEXT}línea 10`);
  });

  it('editar con un guardado en vuelo encola uno solo, nunca dos', async () => {
    const inFlight = deferredResponse();
    let puts = 0;

    const api = await openDocument({
      [PUT_ROUTE]: () => {
        puts += 1;

        return puts === 1 ? inFlight.response : jsonResponse(contentSaved(SERVER_VERSION + puts));
      },
    });

    useEditorStore.getState().setDraft(DOC_ID, 'primera');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(entry().status).toBe('saving');

    for (let i = 1; i <= 5; i += 1) {
      useEditorStore.getState().setDraft(DOC_ID, `mientras guardaba ${String(i)}`);
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    }

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);

    inFlight.resolveWith(jsonResponse(contentSaved(SERVER_VERSION + 1)));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 4);

    const calls = api.callsTo(PUT_ROUTE);

    expect(calls).toHaveLength(2);
    expect(sentContent(calls[1])).toBe('mientras guardaba 5');
    expect(entry().status).toBe('clean');
  });
});

describe('useEditorStore — adopción de la versión (AC-18)', () => {
  it('el éxito adopta el contentVersion devuelto y el guardado siguiente envía el nuevo', async () => {
    let puts = 0;

    const api = await openDocument({
      [PUT_ROUTE]: () => {
        puts += 1;

        return jsonResponse(contentSaved(SERVER_VERSION + puts));
      },
    });

    useEditorStore.getState().setDraft(DOC_ID, 'primer texto');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(entry()).toMatchObject({
      savedContent: 'primer texto',
      contentVersion: SERVER_VERSION + 1,
      status: 'clean',
    });

    useEditorStore.getState().setDraft(DOC_ID, 'segundo texto');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    const calls = api.callsTo(PUT_ROUTE);

    expect(calls).toHaveLength(2);
    expect(sentVersion(calls[0])).toBe(SERVER_VERSION);
    expect(sentVersion(calls[1])).toBe(SERVER_VERSION + 1);
    expect(entry().contentVersion).toBe(SERVER_VERSION + 2);
  });
});

describe('useEditorStore — las tres ramas de fallo (AC-19)', () => {
  it('un 409 con DOCUMENT_CONTENT_CONFLICT deja "conflict" con el texto del servidor a mano', async () => {
    const api = await openDocument({
      [GET_ROUTE]: documentRoute(
        { content: SERVER_TEXT, contentVersion: SERVER_VERSION },
        { content: 'lo que escribió la otra pestaña', contentVersion: SERVER_VERSION + 5 },
      ),
      [PUT_ROUTE]: () =>
        apiErrorResponse(409, 'Este documento cambió mientras escribías', {
          code: DOCUMENT_CONTENT_CONFLICT_CODE,
        }),
    });

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(entry()).toMatchObject({
      status: 'conflict',
      draft: 'lo mío',
      serverContent: 'lo que escribió la otra pestaña',
    });
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
  });

  it.each([
    [400, 'El contenido supera el tamaño máximo'],
    [404, 'Documento no encontrado'],
    [413, 'La petición es demasiado grande'],
    [429, 'Has hecho demasiadas peticiones'],
  ])('un %i deja "rejected" con el mensaje del servidor', async (statusCode, message) => {
    await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(statusCode, message) });

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(entry()).toMatchObject({ status: 'rejected', draft: 'lo mío', error: message });
  });

  it.each([
    ['la red no responde', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['el servidor devuelve 500', () => apiErrorResponse(500, 'Error interno del servidor')],
    ['el cuerpo incumple el contrato', () => jsonResponse({ id: DOC_ID, contentBytes: 7 })],
  ])('cuando %s el estado es "unreachable" y el borrador sobrevive', async (_case, handler) => {
    await openDocument({ [PUT_ROUTE]: handler });

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(entry().status).toBe('unreachable');
    expect(entry().draft).toBe('lo mío');
  });

  it('el mensaje de "unreachable" es propio y distinto del que manda el servidor al rechazar', async () => {
    const serverMessage = 'El contenido supera el tamaño máximo';

    await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(400, serverMessage) });
    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    const rejected = entry();

    useEditorStore.setState(useEditorStore.getInitialState(), true);
    vi.unstubAllGlobals();

    await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(503, serverMessage) });
    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    const unreachable = entry();

    expect(rejected.status).not.toBe(unreachable.status);
    expect(unreachable.error).not.toBe(rejected.error);
    expect(unreachable.error).not.toBe(serverMessage);
    expect(unreachable.error).not.toBeNull();
  });

  it('un draft por encima del límite se rechaza con el mensaje del servidor y no se pierde (AC-30)', async () => {
    const message = 'content debe tener como máximo 200000 caracteres';
    const huge = 'x'.repeat(10);

    await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(400, message) });

    useEditorStore.getState().setDraft(DOC_ID, huge);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(entry()).toMatchObject({ status: 'rejected', error: message, draft: huge });
  });
});

describe('useEditorStore — el 429 no se reintenta (AC-21)', () => {
  it('no emite una segunda petición en la ventana siguiente', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => apiErrorResponse(429, 'Has hecho demasiadas peticiones'),
    });

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 10);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(entry().draft).toBe('lo mío');
  });

  it('la edición siguiente sí vuelve a intentarlo', async () => {
    let puts = 0;

    const api = await openDocument({
      [PUT_ROUTE]: () => {
        puts += 1;

        return puts === 1
          ? apiErrorResponse(429, 'Has hecho demasiadas peticiones')
          : jsonResponse(contentSaved(SERVER_VERSION + 1));
      },
    });

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío, corregido');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(2);
    expect(entry().status).toBe('clean');
  });
});

describe('useEditorStore — resolución del conflicto (AC-20)', () => {
  const conflictRoutes = (onSecondPut: StubHandler): Record<string, StubHandler> => {
    let puts = 0;

    return {
      [GET_ROUTE]: documentRoute(
        { content: SERVER_TEXT, contentVersion: SERVER_VERSION },
        { content: 'lo de la otra pestaña', contentVersion: SERVER_VERSION + 5 },
      ),
      [PUT_ROUTE]: (request) => {
        puts += 1;

        return puts === 1
          ? apiErrorResponse(409, 'Este documento cambió mientras escribías', {
              code: DOCUMENT_CONTENT_CONFLICT_CODE,
            })
          : onSecondPut(request);
      },
    };
  };

  async function reachConflict(onSecondPut: StubHandler): Promise<ApiStub> {
    const api = await openDocument(conflictRoutes(onSecondPut));

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(entry().status).toBe('conflict');

    return api;
  }

  it('resolveKeepMine relee, reenvía el borrador con la versión nueva y termina limpio con mi texto', async () => {
    const api = await reachConflict(() => jsonResponse(contentSaved(SERVER_VERSION + 6)));

    await useEditorStore.getState().resolveKeepMine(DOC_ID);

    const puts = api.callsTo(PUT_ROUTE);

    expect(puts).toHaveLength(2);
    expect(sentContent(puts[1])).toBe('lo mío');
    expect(sentVersion(puts[1])).toBe(SERVER_VERSION + 5);
    expect(entry()).toMatchObject({
      status: 'clean',
      draft: 'lo mío',
      savedContent: 'lo mío',
      contentVersion: SERVER_VERSION + 6,
    });
  });

  it('resolveTakeServer VACÍA la pila de deshacer (spec 006, AC-21)', async () => {
    await reachConflict(() => jsonResponse(contentSaved(SERVER_VERSION + 6)));

    // Antes de resolver hay historial: lo dejó el `setDraft` que provocó el conflicto.
    expect(entry().undo.past.length).toBeGreaterThan(0);

    await useEditorStore.getState().resolveTakeServer(DOC_ID);

    // Adoptar el texto del servidor cambia el documento entero. Dejar los pasos anteriores permitiría
    // deshacer «hacia atrás» hasta reintroducir el conflicto que se acaba de resolver.
    expect(entry().undo).toEqual({ past: [], future: [], cost: 0, openedAt: null });
    expect(useEditorStore.getState().undo(DOC_ID)).toBeNull();
    expect(entry().draft).toBe('lo de la otra pestaña');
  });

  it('resolveKeepMine NO toca la pila: deshacer sigue funcionando después (spec 006, AC-22)', async () => {
    await reachConflict(() => jsonResponse(contentSaved(SERVER_VERSION + 6)));

    const before = entry().undo.past.length;

    await useEditorStore.getState().resolveKeepMine(DOC_ID);

    // Es correcto porque `resolveKeepMine` **no cambia el borrador**: escribe el mismo valor que ya
    // tenía. Lo que cambia es lo guardado y la versión, que no son historial (`006/spec.md` §1.3).
    expect(entry().undo.past).toHaveLength(before);
    expect(useEditorStore.getState().undo(DOC_ID)).not.toBeNull();
    expect(entry().draft).toBe(SERVER_TEXT);
  });

  it('resolveTakeServer adopta el texto del servidor sin emitir ningún PUT', async () => {
    const api = await reachConflict(() => jsonResponse(contentSaved(SERVER_VERSION + 6)));

    await useEditorStore.getState().resolveTakeServer(DOC_ID);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(entry()).toMatchObject({
      status: 'clean',
      draft: 'lo de la otra pestaña',
      savedContent: 'lo de la otra pestaña',
      contentVersion: SERVER_VERSION + 5,
    });
  });

  it('tras descartar mis cambios, el guardado siguiente ya no vuelve a chocar', async () => {
    const api = await reachConflict(() => jsonResponse(contentSaved(SERVER_VERSION + 6)));

    await useEditorStore.getState().resolveTakeServer(DOC_ID);
    useEditorStore.getState().setDraft(DOC_ID, 'lo de la otra pestaña, retocado');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    const puts = api.callsTo(PUT_ROUTE);

    expect(puts).toHaveLength(2);
    expect(sentVersion(puts[1])).toBe(SERVER_VERSION + 5);
    expect(entry().status).toBe('clean');
  });
});

describe('useEditorStore — modo de vista por documento (AC-22)', () => {
  it('open deja el documento en modo texto', async () => {
    await openDocument();

    expect(entry().viewMode).toBe('text');
  });

  it('setViewMode cambia el modo sin tocar el borrador ni el estado de guardado', async () => {
    await openDocument();

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    useEditorStore.getState().setViewMode(DOC_ID, 'preview');

    expect(entry()).toMatchObject({ viewMode: 'preview', draft: 'lo mío', status: 'dirty' });
  });

  it('el modo sobrevive al guardado: es estado del documento, no de quien lo pinta', async () => {
    // Por esto vive aquí y no en un `useState` de la página: con la definición de split view que
    // fija `CLAUDE.md` («texto y preview del **mismo** documento»), el modo es una propiedad del
    // documento, y la spec `005` lo conserva al volver a su pestaña sin trabajo extra. En estado
    // local del componente se perdería en cada montaje.
    await openDocument({ [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)) });

    useEditorStore.getState().setViewMode(DOC_ID, 'preview');
    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(entry()).toMatchObject({ status: 'clean', viewMode: 'preview' });
  });

  it('acepta el modo dividido, que es el tercer valor de ViewMode (005: AC-14)', async () => {
    // El modo dividido es un valor **más** de la enumeración y no un booleano aparte (`plan.md`
    // decisión 6): con `viewMode` + `split: boolean`, «vista previa **y** dividida» sería un
    // estado representable que no significa nada, y alguien acabaría escribiéndolo.
    await openDocument();

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    useEditorStore.getState().setViewMode(DOC_ID, 'split');

    expect(entry()).toMatchObject({ viewMode: 'split', draft: 'lo mío', status: 'dirty' });
  });

  it('setViewMode sobre un documento que no está abierto no crea ninguna entrada', () => {
    useEditorStore.getState().setViewMode('doc-que-nadie-abrió', 'preview');

    expect(useEditorStore.getState().entries['doc-que-nadie-abrió']).toBeUndefined();
  });
});

describe('useEditorStore — guardado explícito y desmontaje (AC-27, AC-28)', () => {
  it('saveNow guarda de inmediato y cancela el debounce pendiente', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    await useEditorStore.getState().saveNow(DOC_ID);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(entry().status).toBe('clean');

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 4);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
  });

  it('saveNow con el documento limpio no emite ninguna petición', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    await useEditorStore.getState().saveNow(DOC_ID);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it('flush con éxito guarda lo pendiente y CONSERVA la entrada (005: AC-8, AC-9)', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    useEditorStore.getState().setDraft(DOC_ID, 'lo último que escribí');
    await useEditorStore.getState().flush(DOC_ID);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(sentContent(api.callsTo(PUT_ROUTE)[0])).toBe('lo último que escribí');

    // Hasta la enmienda de la `005` (v0.2.0 de la `003`) este caso afirmaba que la entrada
    // **desaparecía**. Con pestañas, navegar y cerrar dejan de ser el mismo gesto: `flush` sigue
    // forzando el guardado —esa mitad de AC-28 no se toca— y el desalojo pasa a `closeTab`. Si esto
    // volviera a descartar, cambiar de pestaña perdería el modo de vista y, desde la `006`, el
    // historial de deshacer.
    expect(useEditorStore.getState().entries[DOC_ID]).toBeDefined();
    expect(entry()).toMatchObject({ status: 'clean', draft: 'lo último que escribí' });
    expect(useEditorStore.getState().openIds).toEqual([DOC_ID]);
  });

  it('flush con fallo conserva la entrada con su borrador intacto', async () => {
    await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(500, 'Error interno del servidor') });

    useEditorStore.getState().setDraft(DOC_ID, 'lo último que escribí');
    await useEditorStore.getState().flush(DOC_ID);

    expect(entry()).toMatchObject({ status: 'unreachable', draft: 'lo último que escribí' });
  });
});

/**
 * Pestañas abiertas (spec `005`: AC-1, AC-2, AC-4, AC-5).
 *
 * El orden de `openIds` y el conjunto de claves de `entries` son **lo mismo visto de dos maneras**, y
 * esa es la invariante que estos casos existen para defender: una entrada sin pestaña es memoria que
 * nadie puede cerrar, y una pestaña sin entrada es una pestaña pintada sobre la nada.
 *
 * `closeTab` todavía **no guarda** aquí: eso llega con `T-005` (AC-6 y AC-7). Lo que se fija ahora es
 * la lista, el desalojo y la regla de la vecina.
 */
describe('useEditorStore — pestañas abiertas (spec 005: AC-1, AC-2, AC-4, AC-5)', () => {
  const IDS = ['doc-uno', 'doc-dos', 'doc-tres'] as const;

  /** Abre varios documentos en orden y devuelve el doble de red. */
  async function openAll(...ids: readonly string[]): Promise<ApiStub> {
    const api = stubApi(
      Object.fromEntries(
        ids.map((id) => [
          `GET /api/workspace/documents/${id}`,
          () => jsonResponse(markdownDocument({ id, content: `# ${id}\n`, contentVersion: 1 })),
        ]),
      ),
    );

    for (const id of ids) {
      await useEditorStore.getState().open(id);
    }

    return api;
  }

  /** La invariante de AC-1, como aserción propia y no como efecto colateral de otra. */
  function expectKeysMatchTabs(): void {
    const { openIds, entries } = useEditorStore.getState();

    expect([...openIds].sort()).toEqual(Object.keys(entries).sort());
  }

  it('open añade el id al FINAL de openIds y crea su entrada (AC-1)', async () => {
    await openAll(...IDS);

    expect(useEditorStore.getState().openIds).toEqual(IDS);
    expectKeysMatchTabs();
  });

  it('el conjunto de claves de entries es el de openIds tras abrir y cerrar (AC-1)', async () => {
    await openAll(...IDS);

    await useEditorStore.getState().closeTab('doc-dos');
    expectKeysMatchTabs();

    await useEditorStore.getState().closeTab('doc-uno');
    expectKeysMatchTabs();

    expect(useEditorStore.getState().openIds).toEqual(['doc-tres']);
  });

  it('reabrir un documento ya abierto no lo duplica ni lo mueve de sitio (AC-2)', async () => {
    const api = await openAll(...IDS);

    // El borrador de una pestaña a la que se vuelve tiene que sobrevivir: es la mitad de AC-2 que
    // un `push` incondicional no rompería, pero un `openIds` recalculado sí.
    useEditorStore.getState().setDraft('doc-uno', 'lo que estaba escribiendo');
    await useEditorStore.getState().open('doc-uno');

    expect(useEditorStore.getState().openIds).toEqual(IDS);
    expect(api.callsTo('GET /api/workspace/documents/doc-uno')).toHaveLength(1);
    expect(useEditorStore.getState().entries['doc-uno']?.draft).toBe('lo que estaba escribiendo');
  });

  it('closeTab de una pestaña saca su id y desaloja su entrada (AC-4)', async () => {
    await openAll(...IDS);

    const result = await useEditorStore.getState().closeTab('doc-dos');

    expect(result).toMatchObject({ closed: true });
    expect(useEditorStore.getState().openIds).toEqual(['doc-uno', 'doc-tres']);
    expect(useEditorStore.getState().entries['doc-dos']).toBeUndefined();
  });

  it('closeTab devuelve la vecina de la DERECHA (AC-5)', async () => {
    await openAll(...IDS);

    await expect(useEditorStore.getState().closeTab('doc-dos')).resolves.toMatchObject({
      next: 'doc-tres',
    });
  });

  it('closeTab de la última por la derecha devuelve la de la IZQUIERDA (AC-5)', async () => {
    await openAll(...IDS);

    await expect(useEditorStore.getState().closeTab('doc-tres')).resolves.toMatchObject({
      next: 'doc-dos',
    });
  });

  it('closeTab de la única pestaña devuelve next: null (AC-5)', async () => {
    await openAll('doc-uno');

    await expect(useEditorStore.getState().closeTab('doc-uno')).resolves.toMatchObject({
      next: null,
    });
    expect(useEditorStore.getState().openIds).toEqual([]);
  });
});

/**
 * Deduplicación de `GET /api/workspace/documents/:id` (spec `005`: AC-10…AC-13).
 *
 * Es la deuda que la `003` dejó con destinatario en su §8.1. Allí el síntoma era **de desarrollo**
 * —`StrictMode` invoca los efectos dos veces y cada apertura emitía dos peticiones idénticas: 8 de
 * las 21 de `workspace` de una corrida de la suite de navegador—, pero con pestañas pasa a ser de
 * **producción**: abrir y cerrar deprisa produce aperturas solapadas del mismo documento sin ninguna
 * ayuda de `StrictMode`. Por eso estos casos **no** montan `StrictMode`: disparan la concurrencia a
 * mano, que es la que hay que arreglar.
 */
describe('useEditorStore — una sola lectura por documento (spec 005: AC-10 a AC-13)', () => {
  it('dos open concurrentes del MISMO documento emiten UNA sola petición (AC-10)', async () => {
    const pending = deferredResponse();
    const api = stubApi({ [GET_ROUTE]: () => pending.response });

    const first = useEditorStore.getState().open(DOC_ID);
    const second = useEditorStore.getState().open(DOC_ID);

    pending.resolveWith(
      jsonResponse(markdownDocument({ id: DOC_ID, content: SERVER_TEXT, contentVersion: 1 })),
    );
    await Promise.all([first, second]);

    expect(api.callsTo(GET_ROUTE)).toHaveLength(1);
    expect(entry().draft).toBe(SERVER_TEXT);
  });

  it('open de documentos DISTINTOS a la vez emite DOS peticiones (AC-11)', async () => {
    const api = stubApi({
      'GET /api/workspace/documents/doc-a': () =>
        jsonResponse(markdownDocument({ id: 'doc-a', content: '# a\n' })),
      'GET /api/workspace/documents/doc-b': () =>
        jsonResponse(markdownDocument({ id: 'doc-b', content: '# b\n' })),
    });

    await Promise.all([
      useEditorStore.getState().open('doc-a'),
      useEditorStore.getState().open('doc-b'),
    ]);

    // El single-flight es **por id**, no global: con una promesa compartida —el error natural al
    // copiar el idiom de `refreshSession()`, donde el recurso es uno solo— el segundo documento no
    // llegaría a leerse nunca y la segunda pestaña saldría con el contenido del primero.
    expect(api.calls).toHaveLength(2);
    expect(useEditorStore.getState().entries['doc-b']?.draft).toBe('# b\n');
  });

  it('si la lectura falla, la promesa en vuelo se libera y un open posterior reintenta (AC-12)', async () => {
    let attempts = 0;
    const api = stubApi({
      [GET_ROUTE]: () => {
        attempts += 1;

        return attempts === 1
          ? apiErrorResponse(500, 'Se cayó todo')
          : jsonResponse(markdownDocument({ id: DOC_ID, content: SERVER_TEXT, contentVersion: 1 }));
      },
    });

    // El error se sigue propagando a quien llamó: es el contrato de la `003` que permite a la página
    // distinguir `missing` de `error` en vez de caer en un aviso genérico.
    await expect(useEditorStore.getState().open(DOC_ID)).rejects.toThrow();
    await useEditorStore.getState().open(DOC_ID);

    expect(api.callsTo(GET_ROUTE)).toHaveLength(2);
    expect(entry().draft).toBe(SERVER_TEXT);
  });

  it('con una entrada LIMPIA ya en el store, open no emite ninguna petición (AC-13)', async () => {
    await openDocument();

    const api = stubApi({ [GET_ROUTE]: () => jsonResponse(markdownDocument({ id: DOC_ID })) });

    await useEditorStore.getState().open(DOC_ID);

    expect(api.callsTo(GET_ROUTE)).toHaveLength(0);
    expect(entry().draft).toBe(SERVER_TEXT);
  });
});

/**
 * Cerrar una pestaña guarda antes de desalojar (spec `005`: AC-6, AC-7).
 *
 * Es el defecto más caro que esta spec puede introducir, así que el orden es parte del criterio: se
 * **guarda**, se **comprueba**, y solo entonces se desaloja. Y si el guardado falla, no se cierra —
 * cerrar igual sería perder el trabajo de alguien mientras se le dice que se guardó.
 */
describe('useEditorStore — cerrar guarda antes de desalojar (spec 005: AC-6, AC-7)', () => {
  it('closeTab con borrador sucio emite el PUT y solo después desaloja (AC-6)', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    useEditorStore.getState().setDraft(DOC_ID, 'lo que no había guardado');

    const result = await useEditorStore.getState().closeTab(DOC_ID);

    expect(result).toMatchObject({ closed: true, next: null });
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(sentContent(api.callsTo(PUT_ROUTE)[0])).toBe('lo que no había guardado');
    expect(useEditorStore.getState().entries[DOC_ID]).toBeUndefined();
    expect(useEditorStore.getState().openIds).toEqual([]);

    // Heredado del caso de `close` de la `003`, que se retira con esta tarea: el debounce pendiente
    // no puede emitir nada **después** del cierre. Sin esto, cerrar una pestaña dejaría una petición
    // programada contra un documento que ya no está en el store.
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 4);
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
  });

  it('si el guardado del cierre FALLA, la pestaña sigue abierta con su borrador (AC-7)', async () => {
    await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(500, 'Se cayó todo') });

    useEditorStore.getState().setDraft(DOC_ID, 'lo que no se pudo guardar');

    const result = await useEditorStore.getState().closeTab(DOC_ID);

    expect(result.closed).toBe(false);
    expect(useEditorStore.getState().openIds).toEqual([DOC_ID]);
    expect(entry()).toMatchObject({ status: 'unreachable', draft: 'lo que no se pudo guardar' });
  });

  it('un 409 al cerrar tampoco cierra: el conflicto se resuelve, no se descarta (AC-7)', async () => {
    await openDocument({
      [PUT_ROUTE]: () =>
        apiErrorResponse(409, 'El documento cambió', { code: DOCUMENT_CONTENT_CONFLICT_CODE }),
    });

    useEditorStore.getState().setDraft(DOC_ID, 'mi versión');

    expect((await useEditorStore.getState().closeTab(DOC_ID)).closed).toBe(false);
    expect(entry()).toMatchObject({ status: 'conflict', draft: 'mi versión' });
  });

  it('closeTab de una pestaña LIMPIA no emite ninguna petición y cierra (AC-6)', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    expect((await useEditorStore.getState().closeTab(DOC_ID)).closed).toBe(true);
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
    expect(useEditorStore.getState().entries[DOC_ID]).toBeUndefined();
  });
});

/**
 * Historial de deshacer/rehacer dentro del store (spec `006`: AC-11…AC-17).
 *
 * Lo que se afirma aquí es la **integración**, no la política: cuándo dos pulsaciones son el mismo paso
 * ya lo comprueba `undo-history.test.ts` pasándole dos números. Lo que solo se puede ver desde el store
 * es que el reloj lo lea él, que la pila sea **de un documento**, que muera con la entrada, y que
 * deshacer escriba por la **misma** ruta que teclear —y por tanto herede el sucio y el debounce—.
 */
describe('useEditorStore — historial de deshacer (spec 006: AC-11…AC-17)', () => {
  /** Una inserción de la paleta: gesto único, con las dos selecciones exactas. */
  function insertBold(id: string, before: string, after: string): void {
    useEditorStore.getState().setDraft(id, after, {
      mergeable: false,
      caretBefore: { start: before.indexOf('foo'), end: before.indexOf('foo') + 3 },
      caretAfter: { start: after.indexOf('foo'), end: after.indexOf('foo') + 3 },
    });
  }

  it('deshacer devuelve el texto Y la selección de antes de la inserción (AC-11)', async () => {
    await openDocument();

    const before = 'hola foo mundo';
    const after = 'hola **foo** mundo';

    useEditorStore.getState().setDraft(DOC_ID, before, { mergeable: false });
    insertBold(DOC_ID, before, after);

    expect(entry().draft).toBe(after);

    const caret = useEditorStore.getState().undo(DOC_ID);

    expect(entry().draft).toBe(before);
    // La selección, no un cursor colapsado al final: es la mitad del AC que un deshacer descuidado
    // pierde sin que se note en el texto.
    expect(caret).toEqual({ start: 5, end: 8 });
  });

  it('rehacer devuelve el texto y la selección posteriores (AC-12)', async () => {
    await openDocument();

    const before = 'hola foo mundo';
    const after = 'hola **foo** mundo';

    useEditorStore.getState().setDraft(DOC_ID, before, { mergeable: false });
    insertBold(DOC_ID, before, after);
    useEditorStore.getState().undo(DOC_ID);

    const caret = useEditorStore.getState().redo(DOC_ID);

    expect(entry().draft).toBe(after);
    expect(caret).toEqual({ start: 7, end: 10 });
  });

  it('deshacer no se registra a sí mismo: tres pasos son tres deshacer (AC-13)', async () => {
    await openDocument();

    const store = useEditorStore.getState();

    store.setDraft(DOC_ID, 'uno', { mergeable: false });
    store.setDraft(DOC_ID, 'uno dos', { mergeable: false });
    store.setDraft(DOC_ID, 'uno dos tres', { mergeable: false });

    expect(store.undo(DOC_ID)).not.toBeNull();
    expect(entry().draft).toBe('uno dos');
    expect(store.undo(DOC_ID)).not.toBeNull();
    expect(entry().draft).toBe('uno');
    expect(store.undo(DOC_ID)).not.toBeNull();
    // Y el tercero devuelve al contenido del servidor, no a un ciclo entre dos estados.
    expect(entry().draft).toBe(SERVER_TEXT);
    expect(useEditorStore.getState().undo(DOC_ID)).toBeNull();
  });

  it('el reloj lo lee el store: teclear con una pausa produce dos pasos (AC-13)', async () => {
    await openDocument();

    useEditorStore.getState().setDraft(DOC_ID, `${SERVER_TEXT}uno`);
    await vi.advanceTimersByTimeAsync(UNDO_GROUP_MS);
    useEditorStore.getState().setDraft(DOC_ID, `${SERVER_TEXT}uno dos`);

    expect(entry().undo.past).toHaveLength(2);
    expect(useEditorStore.getState().undo(DOC_ID)).not.toBeNull();
    expect(entry().draft).toBe(`${SERVER_TEXT}uno`);
  });

  it('sin nada que deshacer no cambia nada, no ensucia y no pide nada (AC-14)', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    expect(useEditorStore.getState().undo(DOC_ID)).toBeNull();
    expect(useEditorStore.getState().redo(DOC_ID)).toBeNull();

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 4);

    expect(entry()).toMatchObject({ draft: SERVER_TEXT, status: 'clean' });
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it('la pila es de UN documento: deshacer en uno no toca al otro (AC-15)', async () => {
    stubApi(
      Object.fromEntries(
        ['doc-uno', 'doc-dos'].map((id) => [
          `GET /api/workspace/documents/${id}`,
          () => jsonResponse(markdownDocument({ id, content: `# ${id}\n`, contentVersion: 1 })),
        ]),
      ),
    );

    await useEditorStore.getState().open('doc-uno');
    await useEditorStore.getState().open('doc-dos');

    useEditorStore.getState().setDraft('doc-uno', 'texto de uno', { mergeable: false });
    useEditorStore.getState().setDraft('doc-dos', 'texto de dos', { mergeable: false });

    useEditorStore.getState().undo('doc-uno');

    const { entries } = useEditorStore.getState();

    expect(entries['doc-uno']?.draft).toBe('# doc-uno\n');
    // Lo que hace imposible la pila global: el otro documento no se ha movido ni un carácter.
    expect(entries['doc-dos']?.draft).toBe('texto de dos');
    expect(entries['doc-dos']?.undo.past).toHaveLength(1);
  });

  it('la pila sobrevive a flush (cambiar de pestaña) y muere con closeTab (AC-16)', async () => {
    await openDocument({ [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)) });

    useEditorStore.getState().setDraft(DOC_ID, 'algo escrito', { mergeable: false });

    await useEditorStore.getState().flush(DOC_ID);

    // Cambiar de pestaña conserva la entrada, y con ella su historial (política de la `005` §6.3).
    expect(entry().status).toBe('clean');
    expect(entry().undo.past).toHaveLength(1);
    expect(useEditorStore.getState().undo(DOC_ID)).not.toBeNull();
    expect(entry().draft).toBe(SERVER_TEXT);

    expect((await useEditorStore.getState().closeTab(DOC_ID)).closed).toBe(true);
    // Cerrar sí desaloja, así que cerrar pierde el historial. Aceptado por escrito, no descubierto.
    expect(useEditorStore.getState().entries[DOC_ID]).toBeUndefined();
  });

  it('el historial cuesta el cambio, no el documento (AC-17)', async () => {
    const huge = 'a'.repeat(MAX_DOCUMENT_CONTENT_CHARS);

    stubApi({
      [GET_ROUTE]: () =>
        jsonResponse(markdownDocument({ id: DOC_ID, content: huge, contentVersion: 1 })),
    });

    await useEditorStore.getState().open(DOC_ID);

    useEditorStore.getState().setDraft(DOC_ID, `${huge}x`);

    // Con instantáneas completas esto valdría ~400.000. Es la aserción que hace **medible** la
    // decisión de `spec.md` §2, y la que se cae si alguien vuelve a guardar el texto entero.
    expect(entry().undo.cost).toBeLessThan(100);
    expect(entry().undo.past).toHaveLength(1);
  });
});

/**
 * La frontera entre el historial y el guardado (spec `006`: AC-18, AC-19, AC-20).
 *
 * Los tres AC de este bloque **no piden código propio**: son consecuencia de que deshacer escriba por
 * la misma ruta que teclear. Se afirman igual, y precisamente por eso: lo que vigilan es que nadie
 * abra mañana una ruta paralela «para deshacer» y se lleve por delante el debounce y la coalescencia
 * sin que ningún test se entere.
 */
describe('useEditorStore — deshacer y el guardado (spec 006: AC-18, AC-19, AC-20)', () => {
  /** Guardado que siempre funciona, con la versión subiendo como lo haría el servidor. */
  function savingRoutes(): Record<string, StubHandler> {
    let saves = 0;

    return {
      [PUT_ROUTE]: () => {
        saves += 1;

        return jsonResponse(contentSaved(SERVER_VERSION + saves));
      },
    };
  }

  it('deshacer después de guardar vuelve a ensuciar y emite otro PUT (AC-18)', async () => {
    const api = await openDocument(savingRoutes());

    useEditorStore.getState().setDraft(DOC_ID, 'primera versión', { mergeable: false });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    useEditorStore.getState().setDraft(DOC_ID, 'segunda versión', { mergeable: false });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(2);
    expect(entry()).toMatchObject({ status: 'clean', savedContent: 'segunda versión' });

    // Deshacer **cruza la frontera del guardado**: el documento realmente cambió, así que vuelve a
    // estar sucio y el cambio se manda. La alternativa —parar el deshacer en el último guardado— haría
    // que `Ctrl`+`Z` no hiciera casi nunca nada, porque el guardado automático ocurre cada 1.500 ms.
    expect(useEditorStore.getState().undo(DOC_ID)).not.toBeNull();
    expect(entry()).toMatchObject({ status: 'dirty', draft: 'primera versión' });

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    const puts = api.callsTo(PUT_ROUTE);

    expect(puts).toHaveLength(3);
    expect(sentContent(puts[2])).toBe('primera versión');
  });

  it('deshacer hasta el texto ya guardado deja limpio y no emite nada (AC-19)', async () => {
    const api = await openDocument(savingRoutes());

    useEditorStore.getState().setDraft(DOC_ID, 'guardado', { mergeable: false });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);

    useEditorStore.getState().setDraft(DOC_ID, 'sin guardar', { mergeable: false });

    expect(entry().status).toBe('dirty');
    expect(useEditorStore.getState().undo(DOC_ID)).not.toBeNull();

    // La rama que `setDraft` ya tenía, heredada sin una línea nueva: volver a lo guardado no es un
    // cambio pendiente, así que además de quedar limpio **cancela** el guardado programado.
    expect(entry()).toMatchObject({ status: 'clean', draft: 'guardado' });

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 4);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
  });

  it('una ráfaga de deshacer produce UNA petición, no una por paso (AC-20)', async () => {
    const api = await openDocument(savingRoutes());
    const store = useEditorStore.getState();

    store.setDraft(DOC_ID, 'uno', { mergeable: false });
    store.setDraft(DOC_ID, 'uno dos', { mergeable: false });
    store.setDraft(DOC_ID, 'uno dos tres', { mergeable: false });
    store.setDraft(DOC_ID, 'uno dos tres cuatro', { mergeable: false });

    store.undo(DOC_ID);
    store.undo(DOC_ID);

    expect(entry().draft).toBe('uno dos');
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    const puts = api.callsTo(PUT_ROUTE);

    // Seis escrituras —cuatro de tecleo y dos de deshacer— y **una** petición: el debounce y la
    // coalescencia de la `003`, heredados por pasar por la misma ruta.
    expect(puts).toHaveLength(1);
    expect(sentContent(puts[0])).toBe('uno dos');
  });
});
