import type { MarkdownDocument, WorkspaceTree } from '@one-markdown/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentEditorPage } from './DocumentEditorPage';
import {
  AUTOSAVE_DEBOUNCE_MS,
  CONTENT_COUNTER_THRESHOLD,
  DOCUMENT_CONTENT_CONFLICT_CODE,
} from './editor.constants';
import { useEditorStore, type EditorEntry } from './editor.store';
import { routes } from '../../app/routes';
import {
  apiErrorResponse,
  deferredResponse,
  jsonResponse,
  stubApi,
  type ApiStub,
  type StubHandler,
  type StubbedRequest,
} from '../../test/api-stub';
import { authUser } from '../../test/auth-fixtures';
import {
  directoryNode,
  documentSummary,
  markdownDocument,
  workspaceTree,
} from '../../test/workspace-fixtures';
import { useUiStore } from '../../shared/store/ui.store';
import { useAuthStore } from '../auth/auth.store';
import { useWorkspaceStore } from '../workspace/workspace.store';

/**
 * Página del editor (spec `003`: AC-22, AC-23, AC-27, AC-29, AC-30, AC-31, y AC-20/AC-28 en su
 * parte de interfaz). Sustituye a `features/workspace/DocumentViewPage.tsx`, el andamio de la
 * spec `002`, y **hereda** sus casos que siguen valiendo: el breadcrumb, el anuncio de carga y el
 * «este documento ya no existe» con recarga del árbol ante un `404`.
 *
 * Igual que en el store, aquí no se dobla el cliente HTTP: se sustituye la **red**, así que cada
 * caso ejercita el camino real (`getDocument`, `saveDocumentContent`, el store del editor y el del
 * árbol) y lo que se cuenta son peticiones, no llamadas a un mock.
 *
 * Temporizadores falsos en todo el archivo: el guardado automático es un debounce de 1,5 s y
 * varios casos afirman que **no** hubo una segunda petición durante la ventana siguiente. Con
 * temporizadores reales eso costaría segundos por caso y sería no determinista, así que nada de
 * `findBy*`/`waitFor` aquí: todo se avanza a mano con `settle`.
 */

const DOC_ID = 'doc-lunes';
const ROOT_DOC_ID = 'doc-raiz';
const GET_ROUTE = `GET /api/workspace/documents/${DOC_ID}`;
const PUT_ROUTE = `PUT /api/workspace/documents/${DOC_ID}/content`;
const TREE_ROUTE = 'GET /api/workspace/tree';

const SERVER_TEXT = '# Título del servidor\n';
const SERVER_VERSION = 3;
/** Lo que «la otra pestaña» dejó guardado: es el texto contra el que se resuelve el conflicto. */
const OTHER_TAB_TEXT = '# Lo que escribió la otra pestaña\n';

/** Nombre accesible del área de edición: lleva el título dentro (plan `003` §7). */
const TEXTAREA_NAME = 'Contenido de «Lunes» en markdown';

interface ServerState {
  readonly content: string;
  readonly contentVersion: number;
}

/**
 * Árbol de prueba, heredado del test del andamio: una ruta de dos niveles («Notas» › «Diario» ›
 * «Lunes») y un documento colgando de la raíz, que son los dos breadcrumb distintos que la página
 * tiene que saber pintar.
 */
function sampleTree(): WorkspaceTree {
  return workspaceTree({
    directories: [
      directoryNode({ id: 'dir-notas', name: 'Notas' }),
      directoryNode({ id: 'dir-diario', name: 'Diario', parentId: 'dir-notas', depth: 1 }),
    ],
    documents: [
      documentSummary({ id: ROOT_DOC_ID, title: 'En la raíz', directoryId: null }),
      documentSummary({ id: DOC_ID, title: 'Lunes', directoryId: 'dir-diario' }),
    ],
  });
}

function lunes(state: ServerState): MarkdownDocument {
  return markdownDocument({
    id: DOC_ID,
    title: 'Lunes',
    directoryId: 'dir-diario',
    content: state.content,
    contentVersion: state.contentVersion,
  });
}

/**
 * Ruta del detalle, con estados sucesivos: el conflicto necesita que la **segunda** lectura
 * devuelva algo distinto de la primera para que resolverlo signifique algo.
 */
function documentRoute(first: ServerState, ...rest: readonly ServerState[]): StubHandler {
  const states = [first, ...rest];
  let read = 0;

  return () => {
    const state = states[read] ?? states[states.length - 1] ?? first;
    read += 1;

    return jsonResponse(lunes(state));
  };
}

function contentSaved(contentVersion: number): StubHandler {
  return () =>
    jsonResponse({
      id: DOC_ID,
      contentBytes: 0,
      contentVersion,
      updatedAt: '2026-07-28T10:00:00.000Z',
    });
}

/** Deja el árbol en el store por el camino real (petición + normalización) y retira la red. */
async function seedTree(): Promise<void> {
  stubApi({ [TREE_ROUTE]: () => jsonResponse(sampleTree()) });
  await useWorkspaceStore.getState().loadTree();
  vi.unstubAllGlobals();
}

interface MountedEditor {
  readonly api: ApiStub;
  readonly router: ReturnType<typeof createMemoryRouter>;
  readonly unmount: () => void;
}

function renderEditor(id: string): Omit<MountedEditor, 'api'> {
  const router = createMemoryRouter([{ path: '/documents/:id', Component: DocumentEditorPage }], {
    initialEntries: [`/documents/${id}`],
  });

  const { unmount } = render(<RouterProvider router={router} />);

  return { router, unmount };
}

/** Monta el editor sobre un documento ya cargado y devuelve el doble de red, ya contando. */
async function openEditor(routes: Record<string, StubHandler> = {}): Promise<MountedEditor> {
  const api = stubApi({
    [GET_ROUTE]: documentRoute({ content: SERVER_TEXT, contentVersion: SERVER_VERSION }),
    ...routes,
  });

  const mounted = renderEditor(DOC_ID);
  await settle();

  return { api, ...mounted };
}

/**
 * Deja correr las promesas en vuelo y, si se pide, un tramo de temporizador. Sustituye a
 * `findBy*`: con temporizadores falsos, el `waitFor` de Testing Library no los reconoce (busca un
 * `jest` global que en Vitest no existe) y esperaría de verdad.
 */
async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);

    // El camino de una petición encadena varios `await` (cabeceras, `json()`, traducción del
    // error): un solo turno de microtareas deja el estado a medias y la aserción llegaría antes
    // que el render.
    for (let turn = 0; turn < 5; turn += 1) {
      await Promise.resolve();
    }
  });
}

function entry(): EditorEntry {
  const found = useEditorStore.getState().entries[DOC_ID];

  if (found === undefined) {
    throw new Error(`El store no tiene entrada para ${DOC_ID}`);
  }

  return found;
}

function textarea(): HTMLElement {
  return screen.getByRole('textbox', { name: TEXTAREA_NAME });
}

function sentContent(call: StubbedRequest | undefined): unknown {
  return (call?.body as { readonly content?: unknown } | undefined)?.content;
}

/** El evento que el navegador dispara al cerrar la pestaña, tal cual: cancelable y sin datos. */
function beforeUnloadPrevented(): boolean {
  const event = new Event('beforeunload', { cancelable: true });

  window.dispatchEvent(event);

  return event.defaultPrevented;
}

/** Devuelve si alguien llamó a `preventDefault`, que es la mitad de AC-27. */
async function pressCtrlS(): Promise<boolean> {
  const event = new KeyboardEvent('keydown', {
    key: 's',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });

  await act(async () => {
    window.dispatchEvent(event);
    await Promise.resolve();
  });

  return event.defaultPrevented;
}

let user: UserEvent;

beforeEach(() => {
  // Un debounce pendiente del caso anterior vive en un mapa a nivel de módulo del store: `close`
  // lo cancela, y sin eso podría dispararse a mitad del caso siguiente.
  useEditorStore.getState().close(DOC_ID);
  useEditorStore.getState().close(ROOT_DOC_ID);
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
  useUiStore.setState({ sidebarCollapsed: false });
  useAuthStore.setState({
    status: 'authenticated',
    user: authUser(),
    accessToken: 'access-token-1',
  });

  // `shouldAdvanceTime` no es un adorno: con el reloj **congelado**, cualquier API de `user-event`
  // se queda esperando para siempre un `setTimeout` interno suyo y el caso muere por tiempo
  // (medido: `user.click` sobre un `<textarea>` pelado agota los 5 s). Con el reloj avanzando 1 ms
  // por milisegundo real, esas esperas internas se resuelven solas y el debounce de 1,5 s sigue
  // sin llegar por su cuenta —un caso entero tarda decenas de milisegundos—, así que quien decide
  // cuándo vence sigue siendo `settle`.
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1 });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DocumentEditorPage — estructura y accesibilidad (AC-22)', () => {
  it('muestra el título en un h2 y la ruta del documento en un nav', async () => {
    await seedTree();
    await openEditor();

    expect(screen.getByRole('heading', { name: 'Lunes', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /ruta del documento/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((step) => step.textContent)).toEqual([
      'Notas',
      'Diario',
      'Lunes',
    ]);
  });

  it('ofrece un conmutador de dos pestañas con exactamente una seleccionada', async () => {
    await seedTree();
    await openEditor();

    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');

    expect(tabs.map((tab) => tab.textContent)).toEqual(['Texto', 'Vista previa']);
    expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Texto', selected: true })).toBeInTheDocument();
  });

  it('asocia el panel visible con su pestaña por aria-labelledby y aria-controls', async () => {
    await seedTree();
    await openEditor();

    const panel = screen.getByRole('tabpanel');
    const selected = screen.getByRole('tab', { selected: true });

    expect(selected.id).not.toBe('');
    expect(panel.id).not.toBe('');
    expect(panel).toHaveAttribute('aria-labelledby', selected.id);
    expect(selected).toHaveAttribute('aria-controls', panel.id);
  });

  it('anuncia el guardado en un role="status" educado y sin ninguna alerta', async () => {
    await seedTree();
    await openEditor();

    expect(screen.getByRole('status')).toHaveTextContent(/guardado/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pone los errores de guardado en un role="alert" APARTE del role="status"', async () => {
    // Un lector de pantalla anuncia las dos regiones con urgencias distintas, y esa distinción es
    // la mitad de AC-19: «Guardando…» no puede interrumpir, «no se guardó» sí.
    const message = 'content debe tener como máximo 200000 caracteres';

    await seedTree();
    await openEditor({ [PUT_ROUTE]: () => apiErrorResponse(400, message) });

    await user.type(textarea(), 'algo');
    await settle(AUTOSAVE_DEBOUNCE_MS);

    const status = screen.getByRole('status');
    const alert = screen.getByRole('alert');

    expect(alert).not.toBe(status);
    expect(alert).not.toContainElement(status);
    expect(status).not.toContainElement(alert);
    expect(alert).toHaveTextContent(message);
    expect(status).not.toHaveTextContent(message);
  });
});

describe('DocumentEditorPage — modo texto (AC-23)', () => {
  it('contiene un solo control editable, un textarea con nombre accesible y el borrador dentro', async () => {
    await seedTree();
    await openEditor();

    const editables = screen.getAllByRole('textbox');

    expect(editables).toHaveLength(1);
    expect(editables[0]?.tagName).toBe('TEXTAREA');
    expect(editables[0]).toHaveAccessibleName(TEXTAREA_NAME);
    expect(editables[0]).toHaveValue(SERVER_TEXT);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
  });

  it('escribir en el textarea actualiza el borrador del store', async () => {
    await seedTree();
    await openEditor();

    await user.type(textarea(), 'una línea más');

    expect(entry()).toMatchObject({
      draft: `${SERVER_TEXT}una línea más`,
      savedContent: SERVER_TEXT,
      status: 'dirty',
    });
    expect(textarea()).toHaveValue(`${SERVER_TEXT}una línea más`);
  });

  it('el conmutador es una sola parada de tabulación y se cambia con las flechas', async () => {
    await seedTree();
    await openEditor();

    await user.tab();

    const textTab = screen.getByRole('tab', { name: 'Texto' });
    const previewTab = screen.getByRole('tab', { name: 'Vista previa' });

    expect(textTab).toHaveFocus();

    // Patrón WAI-ARIA de tabs: el conmutador entero ocupa **una** parada, no dos.
    await user.tab();
    expect(previewTab).not.toHaveFocus();

    textTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(previewTab).toHaveFocus();
    expect(previewTab).toHaveAttribute('aria-selected', 'true');
    expect(textTab).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{ArrowLeft}');

    expect(textTab).toHaveFocus();
    expect(textTab).toHaveAttribute('aria-selected', 'true');
  });
});

describe('DocumentEditorPage — vista previa (AC-24)', () => {
  it('renderiza el BORRADOR y no lo último guardado', async () => {
    // El caso está escrito para que los dos textos sean distintos **en el momento de la
    // aserción**: si la vista previa pintara `savedContent`, todo parecería funcionar hasta que
    // alguien escribe y mira el preview antes de que venza el debounce.
    await seedTree();
    await openEditor();

    await user.clear(textarea());
    await user.type(textarea(), '# Lo que estoy escribiendo');

    expect(entry()).toMatchObject({
      draft: '# Lo que estoy escribiendo',
      savedContent: SERVER_TEXT,
    });

    await user.click(screen.getByRole('tab', { name: 'Vista previa' }));

    expect(
      screen.getByRole('heading', { name: 'Lo que estoy escribiendo', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /título del servidor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('DocumentEditorPage — guardado explícito (AC-27)', () => {
  it('Ctrl+S previene el diálogo del navegador, guarda de inmediato y cancela el debounce', async () => {
    await seedTree();
    const { api } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.type(textarea(), 'algo');

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
    expect(await pressCtrlS()).toBe(true);

    await settle();

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(sentContent(api.callsTo(PUT_ROUTE)[0])).toBe(`${SERVER_TEXT}algo`);

    // El debounce que dejó la escritura tiene que estar cancelado: si no, esto serían dos.
    await settle(AUTOSAVE_DEBOUNCE_MS * 4);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
  });

  it('Ctrl+S con el documento limpio no emite ninguna petición', async () => {
    await seedTree();
    const { api } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    expect(await pressCtrlS()).toBe(true);
    await settle(AUTOSAVE_DEBOUNCE_MS * 4);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it('ofrece además un botón de guardar visible: el atajo no puede ser la única vía', async () => {
    await seedTree();
    const { api } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.type(textarea(), 'algo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await settle();

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(/guardado/i);
  });
});

describe('DocumentEditorPage — aviso al cerrar la pestaña (AC-29)', () => {
  it('registra el manejador mientras hay cambios sin guardar y lo RETIRA al volver a limpio', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    expect(beforeUnloadPrevented()).toBe(false);

    await user.type(textarea(), 'algo');

    expect(beforeUnloadPrevented()).toBe(true);

    await settle(AUTOSAVE_DEBOUNCE_MS);

    // La mitad que se olvida: dejarlo puesto avisa de que «vas a perder cambios» sobre un
    // documento que ya está guardado.
    expect(entry().status).toBe('clean');
    expect(beforeUnloadPrevented()).toBe(false);
  });
});

describe('DocumentEditorPage — contador de caracteres (AC-30)', () => {
  it('enseña los caracteres que quedan solo al pasar el umbral', async () => {
    await seedTree();
    await openEditor();

    expect(screen.queryByText(/caracteres/i)).not.toBeInTheDocument();

    await user.clear(textarea());
    await user.paste('x'.repeat(CONTENT_COUNTER_THRESHOLD));

    expect(screen.getByText(/caracteres/i)).toHaveTextContent(/20[.,]?000/);
  });
});

describe('DocumentEditorPage — resolución del conflicto (AC-20)', () => {
  const MY_TEXT = `${SERVER_TEXT}lo mío`;

  function conflictRoutes(onSecondPut: StubHandler): Record<string, StubHandler> {
    let puts = 0;

    return {
      [GET_ROUTE]: documentRoute(
        { content: SERVER_TEXT, contentVersion: SERVER_VERSION },
        { content: OTHER_TAB_TEXT, contentVersion: SERVER_VERSION + 5 },
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
  }

  async function reachConflict(): Promise<ApiStub> {
    await seedTree();
    const { api } = await openEditor(conflictRoutes(contentSaved(SERVER_VERSION + 6)));

    await user.type(textarea(), 'lo mío');
    await settle(AUTOSAVE_DEBOUNCE_MS);

    expect(entry().status).toBe('conflict');

    return api;
  }

  it('ofrece las dos resoluciones con nombres explícitos en un diálogo modal', async () => {
    await reachConflict();

    const dialog = screen.getByRole('dialog');

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName();
    expect(
      within(dialog).getByRole('button', { name: 'Conservar mi versión' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Descartar mis cambios' }),
    ).toBeInTheDocument();
  });

  it('«Conservar mi versión» reenvía mi borrador y deja el documento guardado', async () => {
    const api = await reachConflict();

    await user.click(screen.getByRole('button', { name: 'Conservar mi versión' }));
    await settle();

    const puts = api.callsTo(PUT_ROUTE);

    expect(puts).toHaveLength(2);
    expect(sentContent(puts[1])).toBe(MY_TEXT);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(textarea()).toHaveValue(MY_TEXT);
    expect(screen.getByRole('status')).toHaveTextContent(/guardado/i);
  });

  it('«Descartar mis cambios» adopta el texto del servidor sin emitir ningún PUT más', async () => {
    const api = await reachConflict();

    await user.click(screen.getByRole('button', { name: 'Descartar mis cambios' }));
    await settle();

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(textarea()).toHaveValue(OTHER_TAB_TEXT);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cerrar el diálogo con Escape no resuelve nada y se puede volver a abrir', async () => {
    // Cerrar no puede ser un tercer camino que pise o pierda algo: el conflicto sigue en pie y el
    // aviso ofrece volver al diálogo.
    const api = await reachConflict();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(entry()).toMatchObject({ status: 'conflict', draft: MY_TEXT });
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Resolver el conflicto' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('DocumentEditorPage — desmontaje (AC-28)', () => {
  it('fuerza el guardado pendiente al desmontar y descarta la entrada si sale bien', async () => {
    await seedTree();
    const { api, unmount } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.type(textarea(), 'lo último que escribí');

    unmount();
    await settle();

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(sentContent(api.callsTo(PUT_ROUTE)[0])).toBe(`${SERVER_TEXT}lo último que escribí`);
    expect(useEditorStore.getState().entries[DOC_ID]).toBeUndefined();
  });

  it('conserva el borrador si el guardado forzado falla, para restaurarlo al volver', async () => {
    await seedTree();
    const { unmount } = await openEditor({
      [PUT_ROUTE]: () => apiErrorResponse(500, 'Error interno del servidor'),
    });

    await user.type(textarea(), 'lo último que escribí');

    unmount();
    await settle();

    expect(entry()).toMatchObject({
      status: 'unreachable',
      draft: `${SERVER_TEXT}lo último que escribí`,
    });
  });
});

describe('DocumentEditorPage — activar un documento del árbol (AC-31)', () => {
  /** La aplicación entera desde la raíz, para abrir un documento por el camino de verdad. */
  function renderApp(): ReturnType<typeof createMemoryRouter> {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);

    return router;
  }

  it('navega a /documents/:id al hacer clic en un documento', async () => {
    stubApi({
      [TREE_ROUTE]: () => jsonResponse(sampleTree()),
      [`GET /api/workspace/documents/${ROOT_DOC_ID}`]: () =>
        jsonResponse(markdownDocument({ id: ROOT_DOC_ID, title: 'En la raíz', directoryId: null })),
    });

    const router = renderApp();
    await settle();
    await user.click(screen.getByRole('treeitem', { name: 'En la raíz' }));
    await settle();

    expect(router.state.location.pathname).toBe(`/documents/${ROOT_DOC_ID}`);
    expect(screen.getByRole('heading', { name: 'En la raíz', level: 2 })).toBeInTheDocument();
  });

  it('navega a /documents/:id al activar un documento con Enter', async () => {
    stubApi({
      [TREE_ROUTE]: () => jsonResponse(sampleTree()),
      [`GET /api/workspace/documents/${ROOT_DOC_ID}`]: () =>
        jsonResponse(markdownDocument({ id: ROOT_DOC_ID, title: 'En la raíz', directoryId: null })),
    });

    const router = renderApp();
    await settle();

    // Primera parada: el botón de plegar la barra lateral. Segunda: el nodo tabulable del árbol.
    await user.tab();
    await user.tab();

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveFocus();

    await user.keyboard('{ArrowDown}{Enter}');
    await settle();

    expect(router.state.location.pathname).toBe(`/documents/${ROOT_DOC_ID}`);
  });

  it('no navega al activar un directorio', async () => {
    stubApi({ [TREE_ROUTE]: () => jsonResponse(sampleTree()) });

    const router = renderApp();
    await settle();
    await user.click(screen.getByRole('treeitem', { name: 'Notas' }));

    expect(router.state.location.pathname).toBe('/');
  });
});

describe('DocumentEditorPage — casos heredados del andamio de la 002 (AC-31)', () => {
  it('ya no queda ninguna región «Markdown en crudo»', async () => {
    await seedTree();
    await openEditor();

    expect(screen.queryByRole('region', { name: /markdown en crudo/i })).not.toBeInTheDocument();
    expect(document.querySelector('pre[aria-label="Markdown en crudo"]')).toBeNull();
    expect(textarea()).toHaveValue(SERVER_TEXT);
  });

  it('pide el detalle una sola vez al abrir', async () => {
    await seedTree();
    const { api } = await openEditor();

    expect(api.callsTo(GET_ROUTE)).toHaveLength(1);
  });

  it('muestra solo el título en la ruta cuando el documento cuelga de la raíz', async () => {
    await seedTree();
    stubApi({
      [`GET /api/workspace/documents/${ROOT_DOC_ID}`]: () =>
        jsonResponse(markdownDocument({ id: ROOT_DOC_ID, title: 'En la raíz', directoryId: null })),
    });

    renderEditor(ROOT_DOC_ID);
    await settle();

    expect(screen.getAllByRole('listitem').map((step) => step.textContent)).toEqual(['En la raíz']);
  });

  it('anuncia que está cargando mientras la petición está en vuelo', async () => {
    await seedTree();
    const pending = deferredResponse();
    stubApi({ [GET_ROUTE]: () => pending.response });

    renderEditor(DOC_ID);

    expect(screen.getByText(/cargando el documento/i)).toBeInTheDocument();

    pending.resolveWith(jsonResponse(lunes({ content: SERVER_TEXT, contentVersion: 3 })));
    await settle();

    expect(screen.getByRole('heading', { name: 'Lunes', level: 2 })).toBeInTheDocument();
    expect(screen.queryByText(/cargando el documento/i)).not.toBeInTheDocument();
  });

  it('vuelve a cargar al pasar a otro documento sin desmontar la vista', async () => {
    await seedTree();
    const pending = deferredResponse();
    const { router } = await openEditor({
      [`GET /api/workspace/documents/${ROOT_DOC_ID}`]: () => pending.response,
    });

    await act(async () => {
      await router.navigate(`/documents/${ROOT_DOC_ID}`);
    });

    expect(screen.getByText(/cargando el documento/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lunes' })).not.toBeInTheDocument();

    pending.resolveWith(
      jsonResponse(markdownDocument({ id: ROOT_DOC_ID, title: 'En la raíz', directoryId: null })),
    );
    await settle();

    expect(screen.getByRole('heading', { name: 'En la raíz', level: 2 })).toBeInTheDocument();
  });

  it('dice que el documento ya no existe cuando el servidor responde 404', async () => {
    await seedTree();
    stubApi({
      [TREE_ROUTE]: () => jsonResponse(sampleTree()),
      [GET_ROUTE]: () => apiErrorResponse(404, 'El documento no existe'),
    });

    renderEditor(DOC_ID);
    await settle();

    expect(screen.getByRole('alert')).toHaveTextContent(/este documento ya no existe/i);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('recarga el árbol tras un 404, porque el que tiene el cliente ya era mentira', async () => {
    await seedTree();
    const api = stubApi({
      [TREE_ROUTE]: () => jsonResponse(sampleTree()),
      [GET_ROUTE]: () => apiErrorResponse(404, 'El documento no existe'),
    });

    renderEditor(DOC_ID);
    await settle();

    expect(api.callsTo(TREE_ROUTE)).toHaveLength(1);
  });

  it('anuncia el resto de errores del servidor sin recargar el árbol', async () => {
    await seedTree();
    const api = stubApi({
      [TREE_ROUTE]: () => jsonResponse(sampleTree()),
      [GET_ROUTE]: () => apiErrorResponse(500, 'El servidor no pudo responder'),
    });

    renderEditor(DOC_ID);
    await settle();

    expect(screen.getByRole('alert')).toHaveTextContent('El servidor no pudo responder');
    expect(api.callsTo(TREE_ROUTE)).toHaveLength(0);
  });
});
