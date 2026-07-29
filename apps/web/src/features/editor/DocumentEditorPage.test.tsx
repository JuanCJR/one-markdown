import { MAX_DOCUMENT_CONTENT_CHARS, type MarkdownDocument, type WorkspaceTree } from '@one-markdown/shared';
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

/**
 * El área de edición **como área de edición**, no como un elemento cualquiera: AC-21 se afirma
 * sobre `selectionStart`/`selectionEnd`, que solo existen en un `HTMLTextAreaElement`. Nada de
 * `as`: se estrecha y, si un día deja de ser un `<textarea>`, el caso lo dice con todas las letras.
 */
function textareaNode(): HTMLTextAreaElement {
  const node = textarea();

  if (!(node instanceof HTMLTextAreaElement)) {
    throw new Error('El área de edición ya no es un <textarea>');
  }

  return node;
}

/** Dónde tiene la persona el cursor **de verdad**, según el DOM y no según lo que devolvió nadie. */
function caret(): readonly [number, number] {
  const node = textareaNode();

  return [node.selectionStart, node.selectionEnd];
}

function paletteButton(label: string): HTMLElement {
  return within(screen.getByRole('toolbar', { name: 'Elementos de markdown' })).getByRole('button', {
    name: label,
  });
}

/** Los nombres accesibles de las dos regiones vivas del editor (AC-27). Salen de sus `aria-label`. */
const SAVE_REGION_NAME = 'Estado del guardado';
const PALETTE_REGION_NAME = 'Elemento insertado';

/** La región viva del guardado de la `003`, ya no la única `role="status"` de la página (AC-27). */
function saveRegion(): HTMLElement {
  return screen.getByRole('status', { name: SAVE_REGION_NAME });
}

/**
 * Las **dos** regiones vivas de la página (AC-27): la de la paleta y la del guardado.
 *
 * Se distinguen **por nombre accesible** y no por lo que dicen. Por contenido no se puede: la de la
 * paleta se monta desde el primer render y está **vacía** hasta que se inserta algo, así que
 * `startsWith('Insertado:')` —como discriminaba esta función hasta la v0.2.0— ya no distingue nada.
 * Y por nombre es además como las distingue quien las recorre con un lector de pantalla.
 */
function liveRegions(): { readonly palette: HTMLElement; readonly save: HTMLElement } {
  return {
    palette: screen.getByRole('status', { name: PALETTE_REGION_NAME }),
    save: saveRegion(),
  };
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

/**
 * Dispara un atajo **sobre un elemento concreto** y devuelve si alguien llamó a `preventDefault`.
 *
 * Se dispara en el elemento y no en la ventana a propósito: la mitad de AC-28 es que los tres
 * atajos son del área de escritura y **no** de la página, y eso solo se puede afirmar eligiendo
 * dónde nace el evento. El evento burbujea, así que el manejador de `window` de la `003` lo sigue
 * viendo igual que en el navegador.
 */
async function pressShortcut(
  target: HTMLElement,
  key: string,
  modifier: 'ctrl' | 'meta' = 'ctrl',
): Promise<boolean> {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifier === 'ctrl',
    metaKey: modifier === 'meta',
    bubbles: true,
    cancelable: true,
  });

  await act(async () => {
    target.dispatchEvent(event);
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

    expect(saveRegion()).toHaveTextContent(/guardado/i);
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

    const status = saveRegion();
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
    expect(saveRegion()).toHaveTextContent(/guardado/i);
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
    expect(saveRegion()).toHaveTextContent(/guardado/i);
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

describe('DocumentEditorPage — paleta de markdown (spec 004: AC-19 a AC-23, AC-26, AC-27)', () => {
  /** El título del documento de prueba empieza en la posición 2 y mide 6: `# Título del servidor\n`. */
  const TITLE_AT = [2, 8] as const;

  it('la paleta está en modo texto y NO en vista previa (AC-19)', async () => {
    await seedTree();
    await openEditor();

    expect(screen.getByRole('toolbar', { name: 'Elementos de markdown' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Vista previa' }));

    // Insertar en un área de texto que no se ve no es una funcionalidad, es desconcierto.
    expect(
      screen.queryByRole('toolbar', { name: 'Elementos de markdown' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Texto' }));

    expect(screen.getByRole('toolbar', { name: 'Elementos de markdown' })).toBeInTheDocument();
  });

  it('una inserción ensucia el borrador y NO emite ninguna petición (AC-20)', async () => {
    await seedTree();
    const { api } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.click(paletteButton('Negrita'));

    expect(entry()).toMatchObject({
      draft: '**texto en negrita**# Título del servidor\n',
      savedContent: SERVER_TEXT,
      status: 'dirty',
    });
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it('TRES inserciones dentro de la misma ventana de debounce producen UNA petición (AC-20)', async () => {
    // Se cuentan **peticiones**, no llamadas a un espía: lo que hay que demostrar es que la paleta
    // no abre un segundo camino de guardado, y eso solo se ve en la red.
    await seedTree();
    const { api } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.click(paletteButton('Negrita'));
    await user.click(paletteButton('Cursiva'));
    await user.click(paletteButton('Tachado'));

    // Cada elemento envuelve **el contenido** que dejó seleccionado el anterior, no sus marcadores.
    const expected = '***~~texto en negrita~~***# Título del servidor\n';

    expect(entry().draft).toBe(expected);
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);

    await settle(AUTOSAVE_DEBOUNCE_MS);

    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(sentContent(api.callsTo(PUT_ROUTE)[0])).toBe(expected);
  });

  it('devuelve el foco al textarea con el cursor DONDE TOCA, no al final (AC-21)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    const node = textareaNode();

    node.focus();
    node.setSelectionRange(...TITLE_AT);

    await user.click(paletteButton('Negrita'));

    expect(entry().draft).toBe('# **Título** del servidor\n');
    expect(textareaNode()).toHaveFocus();
    // La aserción es sobre el DOM **real**: React manda el caret al final de un `<textarea>`
    // controlado al que se le asigna un valor distinto de `e.target.value`, y ese final serían 26.
    expect(caret()).toEqual([4, 10]);
  });

  it('con el documento VACÍO y sin foco previo, inserta la plantilla y coloca el cursor (AC-22)', async () => {
    await seedTree();
    await openEditor({
      [GET_ROUTE]: documentRoute({ content: '', contentVersion: SERVER_VERSION }),
      [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1),
    });

    expect(textareaNode()).toHaveValue('');
    expect(textareaNode()).not.toHaveFocus();

    await user.click(paletteButton('Lista de tareas'));

    expect(entry().draft).toBe('- [ ] Tarea pendiente');
    expect(textareaNode()).toHaveFocus();
    expect(caret()).toEqual([6, 21]);
  });

  it('por encima del límite de caracteres la inserción se aplica igual (AC-23)', async () => {
    await seedTree();
    const { api } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });
    const tooLong = 'x'.repeat(MAX_DOCUMENT_CONTENT_CHARS + 10);

    await act(async () => {
      useEditorStore.getState().setDraft(DOC_ID, tooLong);
      await Promise.resolve();
    });

    await user.click(paletteButton('Negrita'));

    // Quien reacciona es el camino que ya existía (el contador de la `003` y el rechazo del
    // servidor). Dos formas distintas de impedir lo mismo es cómo se produce el aviso que no
    // coincide con la realidad.
    expect(entry().draft).toBe(`${tooLong}**texto en negrita**`);
    expect(paletteButton('Negrita')).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/te sobran/i)).toBeInTheDocument();
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it('el orden de tabulación es conmutador → paleta → textarea (AC-26)', async () => {
    await seedTree();
    await openEditor();

    await user.tab();

    expect(screen.getByRole('tab', { name: 'Texto' })).toHaveFocus();

    // El botón de guardar de la `003` vive entre los dos: lo que AC-26 pide es que la paleta esté
    // **antes** del área de escritura, para encontrarla al recorrer la página y no después.
    await user.tab();

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();

    await user.tab();

    expect(paletteButton('Negrita')).toHaveFocus();

    await user.tab();

    expect(textareaNode()).toHaveFocus();
  });

  it('las dos regiones vivas conviven sin contenerse la una a la otra (AC-27)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    // **Antes** de insertar las dos ya están montadas y la de la paleta está vacía. Es la mitad del
    // AC que la v0.2.0 corrigió: una región viva que entra en el DOM con su primer anuncio dentro no
    // es un cambio que el lector pueda observar, es una aparición, y en NVDA o JAWS puede no oírse.
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(liveRegions().palette).toBeEmptyDOMElement();

    await user.click(paletteButton('Negrita'));

    const regions = screen.getAllByRole('status');

    expect(regions).toHaveLength(2);

    const { palette, save } = liveRegions();

    // Dos regiones vivas anidadas producen anuncios duplicados: la misma aserción con la que la
    // `003` separa `status` de `alert`.
    expect(palette).not.toBe(save);
    expect(palette).not.toContainElement(save);
    expect(save).not.toContainElement(palette);
    expect(palette).toHaveTextContent('Insertado: Negrita');
    expect(save).toHaveTextContent('Cambios sin guardar');
  });
});

describe('DocumentEditorPage — atajos del área de escritura (spec 004: AC-28)', () => {
  /** `# Título del servidor\n`: «Título» ocupa de la posición 2 a la 8. */
  const TITLE_AT = [2, 8] as const;

  /** Deja el editor abierto con «Título» seleccionado y el foco **dentro** del área de escritura. */
  async function withTitleSelected(): Promise<ApiStub> {
    await seedTree();
    const { api } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });
    const node = textareaNode();

    node.focus();
    node.setSelectionRange(...TITLE_AT);

    return api;
  }

  it('Ctrl+B aplica negrita y previene el atajo del navegador', async () => {
    await withTitleSelected();

    // `Ctrl`+`B` abre los marcadores en Firefox: sin `preventDefault` la persona pierde el foco y
    // el texto se queda sin envolver.
    expect(await pressShortcut(textareaNode(), 'b')).toBe(true);
    expect(entry().draft).toBe('# **Título** del servidor\n');
    expect(caret()).toEqual([4, 10]);
  });

  it('Ctrl+I aplica cursiva y previene el atajo del navegador', async () => {
    await withTitleSelected();

    expect(await pressShortcut(textareaNode(), 'i')).toBe(true);
    expect(entry().draft).toBe('# *Título* del servidor\n');
    expect(caret()).toEqual([3, 9]);
  });

  it('Cmd+K inserta el enlace y deja seleccionado el destino', async () => {
    await withTitleSelected();

    // Con `Cmd`, que es el mismo atajo en macOS: el catálogo no declara modificador por elemento.
    expect(await pressShortcut(textareaNode(), 'k', 'meta')).toBe(true);
    expect(entry().draft).toBe('# [Título](https://ejemplo.com) del servidor\n');
    expect(caret()).toEqual([11, 30]);
  });

  it('con el foco FUERA del área de escritura los tres atajos no hacen nada', async () => {
    const api = await withTitleSelected();
    const guardar = screen.getByRole('button', { name: 'Guardar' });

    guardar.focus();

    for (const key of ['b', 'i', 'k']) {
      // Son atajos del área de escritura, no de la ventana: fuera de ella los del navegador siguen
      // intactos, y por eso aquí nadie previene nada.
      expect(await pressShortcut(guardar, key), key).toBe(false);
    }

    expect(entry()).toMatchObject({ draft: SERVER_TEXT, status: 'clean' });
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
  });

  it('Ctrl+S sigue guardando desde el área de escritura y NO inserta nada (regresión de la 003)', async () => {
    const api = await withTitleSelected();

    await user.type(textarea(), 'algo');

    const written = entry().draft;

    expect(await pressShortcut(textareaNode(), 's')).toBe(true);
    await settle();

    expect(entry().draft).toBe(written);
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(sentContent(api.callsTo(PUT_ROUTE)[0])).toBe(written);
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
