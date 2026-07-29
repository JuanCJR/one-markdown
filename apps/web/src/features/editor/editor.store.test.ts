import type { DocumentContentSaved } from '@one-markdown/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTOSAVE_DEBOUNCE_MS, DOCUMENT_CONTENT_CONFLICT_CODE } from './editor.constants';
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
        apiErrorResponse(409, 'El documento cambió mientras lo editabas', {
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
          ? apiErrorResponse(409, 'El documento cambió mientras lo editabas', {
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

  it('flush con éxito guarda lo pendiente y descarta la entrada', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    useEditorStore.getState().setDraft(DOC_ID, 'lo último que escribí');
    await useEditorStore.getState().flush(DOC_ID);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(sentContent(api.callsTo(PUT_ROUTE)[0])).toBe('lo último que escribí');
    expect(useEditorStore.getState().entries[DOC_ID]).toBeUndefined();
  });

  it('flush con fallo conserva la entrada con su borrador intacto', async () => {
    await openDocument({ [PUT_ROUTE]: () => apiErrorResponse(500, 'Error interno del servidor') });

    useEditorStore.getState().setDraft(DOC_ID, 'lo último que escribí');
    await useEditorStore.getState().flush(DOC_ID);

    expect(entry()).toMatchObject({ status: 'unreachable', draft: 'lo último que escribí' });
  });

  it('close descarta la entrada y el debounce pendiente no emite nada después', async () => {
    const api = await openDocument({
      [PUT_ROUTE]: () => jsonResponse(contentSaved(SERVER_VERSION + 1)),
    });

    useEditorStore.getState().setDraft(DOC_ID, 'lo mío');
    useEditorStore.getState().close(DOC_ID);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 4);

    expect(useEditorStore.getState().entries[DOC_ID]).toBeUndefined();
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });
});
