import {
  MAX_DOCUMENT_CONTENT_CHARS,
  type MarkdownDocument,
  type WorkspaceTree,
} from '@one-markdown/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DocumentEditorPage,
  HISTORY_SHORTCUT_KEYS,
  VIEW_MODES,
  VIEW_MODE_LABELS,
} from './DocumentEditorPage';
import { MARKDOWN_PALETTE } from './markdown-palette';
import {
  AUTOSAVE_DEBOUNCE_MS,
  CONTENT_COUNTER_THRESHOLD,
  DOCUMENT_CONTENT_CONFLICT_CODE,
} from './editor.constants';
import { useEditorStore, type EditorEntry, type ViewMode } from './editor.store';
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
 * Monta la aplicación **entera** sobre el documento de prueba y devuelve el doble de red.
 *
 * AC-25, AC-26 y AC-27 de la `005` hablan de la página del editor **tal y como se ve**, y la tira de
 * pestañas la pinta el `AppShell` (`T-007`): sin el shell no hay dos `tablist`, falta la región viva
 * de las pestañas y el orden de tabulación empieza donde no es. `openEditor` se queda montando solo
 * la página, que es lo que quieren los casos que no hablan del shell.
 */
async function openEditorInApp(extra: Record<string, StubHandler> = {}): Promise<ApiStub> {
  const api = stubApi({
    [TREE_ROUTE]: () => jsonResponse(sampleTree()),
    [GET_ROUTE]: documentRoute({ content: SERVER_TEXT, contentVersion: SERVER_VERSION }),
    [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1),
    ...extra,
  });

  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/documents/${DOC_ID}`] })}
    />,
  );
  await settle();

  return api;
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
  return within(screen.getByRole('toolbar', { name: PALETTE_NAME })).getByRole('button', {
    name: label,
  });
}

/** Nombre accesible de la paleta de la `004`. Es también el de su `role="toolbar"`. */
const PALETTE_NAME = 'Elementos de markdown';

/**
 * Las paletas que hay en la página, **en plural** (005: AC-18).
 *
 * Se pregunta por todas y se afirma la **longitud**, no la presencia: «hay una paleta» pasa igual
 * con dos, y dos paletas es exactamente la regresión que AC-18 vigila —tres documentos cerrados dan
 * por hecho que con vista dividida habrá dos, y `005/spec.md` §1.2 explica por qué no.
 */
function palettes(): readonly HTMLElement[] {
  return screen.queryAllByRole('toolbar', { name: PALETTE_NAME });
}

/**
 * El conmutador de modo de vista, **por su nombre accesible** (005: AC-25).
 *
 * Sin nombre no vale: la tira de pestañas de documentos vive en la misma página, así que un
 * `getByRole('tablist')` pelado deja de ser inequívoco. Y por nombre es además como lo distingue
 * quien recorre la página con un lector de pantalla.
 */
function viewModeTablist(): HTMLElement {
  return screen.getByRole('tablist', { name: 'Modo de vista' });
}

/**
 * Los rótulos que el conmutador tiene que pintar, **derivados de la enumeración** (005: AC-14).
 *
 * Ni aquí ni en ningún caso se escribe a mano cuántos son: la `004` escribió «14 elementos» en diez
 * sitios mientras su propia tabla enumeraba 16, y dos de esos números iban a usarse como aserción.
 */
const VIEW_MODE_TAB_LABELS = VIEW_MODES.map((mode) => VIEW_MODE_LABELS[mode]);

/** Cambia de modo como lo haría la persona: pulsando su pestaña. */
async function selectMode(mode: ViewMode): Promise<void> {
  await user.click(within(viewModeTablist()).getByRole('tab', { name: VIEW_MODE_LABELS[mode] }));
}

/**
 * Las regiones vivas de la página del editor, **por su nombre accesible** (005: AC-26).
 *
 * La enumeración vive aquí y en `005/spec.md` AC-26, y **en ningún caso se escribe a mano cuántas
 * son**: la cuenta se deriva de la lista que el propio caso afirma, para que añadir o quitar una
 * región no deje un número rancio en una aserción. Las cuatro salen de sus `aria-label`: el guardado
 * (`003`), la paleta (`004`), las pestañas (`005`) y la carga (`003`, que gana nombre con AC-26).
 */
const LIVE_REGION_NAMES = {
  save: 'Estado del guardado',
  palette: 'Elemento insertado',
  tabs: 'Pestañas abiertas',
  loading: 'Carga del documento',
} as const;

/** La región viva del guardado de la `003`, ya no la única `role="status"` de la página (AC-26). */
function saveRegion(): HTMLElement {
  return screen.getByRole('status', { name: LIVE_REGION_NAMES.save });
}

/** Las regiones vivas que el caso enumera, **una por nombre** y en el orden en que las enumera. */
function liveRegionsNamed(names: readonly string[]): readonly HTMLElement[] {
  return names.map((name) => screen.getByRole('status', { name }));
}

/**
 * Los `role="status"` que hay en el documento, leídos del **DOM** y no con `getAllByRole`.
 *
 * AC-25 prohíbe pedir un `status` sin nombre, y con motivo: esa consulta es justo la que se lleva
 * por delante la desambiguación. Pero hace falta afirmar lo contrario que una consulta —que no hay
 * ninguna región **de más** ni ninguna **anónima**—, y eso se lee del DOM, igual que la `003`
 * comprueba que no queda ningún `contenteditable`.
 */
function liveRegionNodes(): readonly Element[] {
  return [...document.querySelectorAll('[role="status"]')];
}

/** Dos regiones vivas anidadas producen anuncios duplicados: ninguna contiene a ninguna otra. */
function expectNoneNested(regions: readonly HTMLElement[]): void {
  for (const outer of regions) {
    for (const inner of regions) {
      if (outer !== inner) {
        expect(outer).not.toContainElement(inner);
      }
    }
  }
}

/**
 * Cuántas veces se tabula al comprobar AC-27. **No es el número de paradas de la página**: es un
 * tramo con holgura, porque el criterio es el orden **relativo** de cinco elementos y no una
 * secuencia cerrada. El recorrido se corta solo al salir del documento.
 */
const TAB_SWEEP_STEPS = 15;

/**
 * Tabula desde el principio del documento y devuelve los elementos que van recibiendo el foco.
 *
 * Se corta al volver el foco al `<body>`, que es donde acaba el recorrido tras la última parada.
 */
async function tabThrough(steps: number): Promise<readonly HTMLElement[]> {
  const visited: HTMLElement[] = [];

  for (let step = 0; step < steps; step += 1) {
    await user.tab();

    const active = document.activeElement;

    if (!(active instanceof HTMLElement) || active === document.body) {
      break;
    }

    visited.push(active);
  }

  return visited;
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
    palette: screen.getByRole('status', { name: LIVE_REGION_NAMES.palette }),
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
  // Cuarto parámetro y no un objeto de opciones: lo añade la `006` para `Ctrl`+`Shift`+`Z` y cambiar
  // la firma obligaría a tocar las llamadas de la `004`, que no ganan nada con ello.
  shift = false,
): Promise<boolean> {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifier === 'ctrl',
    metaKey: modifier === 'meta',
    shiftKey: shift,
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
  // Aquí había dos `close(id)` para cancelar un debounce pendiente del caso anterior. El `close` de
  // la `003` **se retiró** con `T-005` de la `005` —descartaba una entrada **sin guardar**, y con
  // pestañas eso es un camino por el que alguien pierde su trabajo—, y su sustituto `closeTab`
  // guarda, así que en un `beforeEach` emitiría peticiones. No hace falta ninguno de los dos: el
  // `afterEach` hace `useRealTimers()`, que **desmonta el reloj falso entero**, así que un
  // temporizador programado en el caso anterior no puede dispararse en el siguiente. Lo único que
  // sobrevive es un identificador muerto en el mapa del módulo, y `cancelDebounce` sobre él es un
  // `clearTimeout` que no hace nada.
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

  it('ofrece un conmutador con una pestaña por modo y exactamente una seleccionada', async () => {
    await seedTree();
    await openEditor();

    // El conmutador se pide **por su nombre** (AC-25): con la tira de pestañas de documentos en la
    // misma página, un `getByRole('tablist')` pelado deja de ser inequívoco. Y la lista esperada se
    // deriva de la enumeración (AC-14), no de un literal que hay que acordarse de actualizar.
    const tabs = within(viewModeTablist()).getAllByRole('tab');

    expect(tabs.map((tab) => tab.textContent)).toEqual(VIEW_MODE_TAB_LABELS);
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

describe('DocumentEditorPage — vista dividida (spec 005: AC-14 a AC-18, AC-25)', () => {
  /** El único panel de la página, que en modo dividido es el que contiene las dos regiones. */
  function panel(): HTMLElement {
    return screen.getByRole('tabpanel');
  }

  it('la enumeración de modos incluye el dividido y el conmutador pinta uno por modo (AC-14)', async () => {
    await seedTree();
    await openEditor();

    // La aserción es contra la enumeración importada, no contra un literal: el conmutador y el
    // caso tienen que quedarse de acuerdo solos cuando la enumeración cambie.
    expect(VIEW_MODES).toContain<ViewMode>('split');
    expect(
      within(viewModeTablist())
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(VIEW_MODE_TAB_LABELS);
  });

  it('en modo dividido el texto y la vista previa están los dos, en UN solo panel (AC-15)', async () => {
    await seedTree();
    await openEditor();

    await selectMode('split');

    const heading = screen.getByRole('heading', { name: 'Título del servidor', level: 1 });

    // Un solo `tabpanel` (decisión 10 del plan): el patrón *tabs* tiene uno por definición, y dos a
    // la vez sería inventarse una variante. Las dos mitades son **regiones con nombre** dentro.
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(within(panel()).getByRole('region', { name: 'Texto' })).toContainElement(textarea());
    expect(within(panel()).getByRole('region', { name: 'Vista previa' })).toContainElement(heading);
  });

  it('en modo dividido la vista previa pinta el BORRADOR, sin esperar al guardado (AC-16)', async () => {
    await seedTree();
    const { api } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await selectMode('split');
    await user.clear(textarea());
    await user.type(textarea(), '# Lo que estoy escribiendo');

    // **Antes** de avanzar el temporizador de 1,5 s a propósito: si se avanzara, el caso dejaría de
    // distinguir «la vista previa pinta el borrador» de «pinta lo último guardado».
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(0);
    expect(entry()).toMatchObject({
      draft: '# Lo que estoy escribiendo',
      savedContent: SERVER_TEXT,
    });
    expect(
      within(panel()).getByRole('heading', { name: 'Lo que estoy escribiendo', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /título del servidor/i })).not.toBeInTheDocument();
  });

  it('el modo es POR DOCUMENTO: cada pestaña conserva el suyo al alternar (AC-17)', async () => {
    await seedTree();
    const { router } = await openEditor({
      [`GET /api/workspace/documents/${ROOT_DOC_ID}`]: () =>
        jsonResponse(markdownDocument({ id: ROOT_DOC_ID, title: 'En la raíz', directoryId: null })),
    });

    await selectMode('split');

    await act(async () => {
      await router.navigate(`/documents/${ROOT_DOC_ID}`);
    });
    await settle();

    // El documento recién abierto arranca en texto: el modo del otro no se le pega.
    expect(screen.getByRole('heading', { name: 'En la raíz', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: VIEW_MODE_LABELS.text, selected: true }),
    ).toBeInTheDocument();

    await act(async () => {
      await router.navigate(`/documents/${DOC_ID}`);
    });
    await settle();

    expect(
      screen.getByRole('tab', { name: VIEW_MODE_LABELS.split, selected: true }),
    ).toBeInTheDocument();
  });

  it('hay UNA paleta en texto y UNA en dividida, y ninguna en vista previa (AC-18)', async () => {
    await seedTree();
    await openEditor();

    expect(palettes()).toHaveLength(1);

    // Con vista dividida hay **un** panel de texto, así que hay **una** paleta: la longitud es la
    // aserción, porque la presencia pasaría igual con dos (`005/spec.md` §1.2).
    await selectMode('split');
    expect(palettes()).toHaveLength(1);

    // Insertar en un área de texto que no se ve no es una funcionalidad, es desconcierto.
    await selectMode('preview');
    expect(palettes()).toHaveLength(0);

    await selectMode('text');
    expect(palettes()).toHaveLength(1);
  });

  it('el conmutador lleva nombre accesible propio, distinto del de cualquier otro (AC-25)', async () => {
    await seedTree();
    await openEditor();

    expect(viewModeTablist()).toHaveAccessibleName('Modo de vista');
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
  it('fuerza el guardado pendiente al desmontar y CONSERVA la entrada (005: AC-8, AC-9)', async () => {
    await seedTree();
    const { api, unmount } = await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.type(textarea(), 'lo último que escribí');

    unmount();
    await settle();

    // La mitad que **no** cambia: el guardado pendiente se fuerza igual (AC-28 de la `003`, AC-9 de
    // la `005`). Desmontar sigue sin bloquear la navegación y sigue sin perder nada.
    expect(api.callsTo(PUT_ROUTE)).toHaveLength(1);
    expect(sentContent(api.callsTo(PUT_ROUTE)[0])).toBe(`${SERVER_TEXT}lo último que escribí`);

    // La mitad que sí: hasta la enmienda (v0.2.0 de la `003`) este caso afirmaba
    // `toBeUndefined()`. Desmontar es **cambiar de pestaña**, no cerrarla, y desalojar aquí tiraría
    // el modo de vista —que la `003` quería conservar expresamente— y, desde la `006`, el historial
    // de deshacer. Quien desaloja es `closeTab`, y solo tras comprobar que el guardado salió bien.
    expect(useEditorStore.getState().entries[DOC_ID]).toBeDefined();
    expect(useEditorStore.getState().entries[DOC_ID]?.draft).toBe(
      `${SERVER_TEXT}lo último que escribí`,
    );
    expect(useEditorStore.getState().openIds).toEqual([DOC_ID]);
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

    // Las dos se piden **por nombre** y la cuenta sale de esa misma lista (005: AC-25 y AC-26): un
    // `getAllByRole('status')` pelado —como estaba escrito hasta aquí— es una consulta sin
    // desambiguar, y el `2` era un número a mano que la tira de pestañas convertiría en mentira.
    const named = [LIVE_REGION_NAMES.save, LIVE_REGION_NAMES.palette];

    // **Antes** de insertar las dos ya están montadas y la de la paleta está vacía. Es la mitad del
    // AC que la v0.2.0 corrigió: una región viva que entra en el DOM con su primer anuncio dentro no
    // es un cambio que el lector pueda observar, es una aparición, y en NVDA o JAWS puede no oírse.
    expect(liveRegionNodes()).toHaveLength(liveRegionsNamed(named).length);
    expect(liveRegions().palette).toBeEmptyDOMElement();

    await user.click(paletteButton('Negrita'));

    const regions = liveRegionsNamed(named);

    expect(liveRegionNodes()).toHaveLength(regions.length);

    const { palette, save } = liveRegions();

    // Dos regiones vivas anidadas producen anuncios duplicados: la misma aserción con la que la
    // `003` separa `status` de `alert`.
    expect(palette).not.toBe(save);
    expectNoneNested(regions);
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

/**
 * Barrido de accesibilidad de la página **entera** (spec `005`: AC-25, AC-26, AC-27).
 *
 * Todo este bloque monta la aplicación con `openEditorInApp` y no solo la página: lo que se afirma
 * aquí —dos `tablist`, las regiones vivas y el orden de tabulación— solo existe con el `AppShell`
 * pintando la tira de pestañas por encima del `<main>`.
 */
describe('DocumentEditorPage — accesibilidad de la página entera (spec 005: AC-25 a AC-27)', () => {
  it('los dos tablist de la página llevan nombre accesible y son distintos (AC-25)', async () => {
    await openEditorInApp();

    const documentTabs = screen.getByRole('tablist', { name: 'Documentos abiertos' });
    const viewSwitcher = viewModeTablist();

    expect(documentTabs).not.toBe(viewSwitcher);
    expect(documentTabs).toHaveAccessibleName('Documentos abiertos');
    expect(viewSwitcher).toHaveAccessibleName('Modo de vista');

    // Y ninguno **de más**: un tercer `tablist` sería uno que ninguna consulta desambigua. Se lee del
    // DOM por el mismo motivo que las regiones vivas —pedir un `tablist` sin nombre es lo que AC-25
    // prohíbe—, y el orden es el del documento: la tira está por encima del `<main>`.
    expect([...document.querySelectorAll('[role="tablist"]')]).toEqual([
      documentTabs,
      viewSwitcher,
    ]);
  });

  it('en modo texto conviven las tres regiones vivas con nombre, ninguna dentro de otra (AC-26)', async () => {
    await openEditorInApp();

    const regions = liveRegionsNamed([
      LIVE_REGION_NAMES.save,
      LIVE_REGION_NAMES.palette,
      LIVE_REGION_NAMES.tabs,
    ]);

    expect(liveRegionNodes()).toHaveLength(regions.length);
    expectNoneNested(regions);
  });

  it('en modo dividido son esas mismas tres: ni una cuarta ni una anónima (AC-26)', async () => {
    await openEditorInApp();

    await selectMode('split');

    const regions = liveRegionsNamed([
      LIVE_REGION_NAMES.save,
      LIVE_REGION_NAMES.palette,
      LIVE_REGION_NAMES.tabs,
    ]);

    expect(liveRegionNodes()).toHaveLength(regions.length);
    expectNoneNested(regions);
  });

  it('mientras el documento carga hay dos regiones vivas y la de la carga TIENE nombre (AC-26)', async () => {
    // El motivo del `aria-label` de la carga, y por eso este caso monta el shell: la tira de pestañas
    // se pinta **mientras** el documento carga, así que en ese instante hay dos regiones vivas y una
    // de ellas era anónima.
    const pending = deferredResponse();

    await openEditorInApp({ [GET_ROUTE]: () => pending.response });

    try {
      const regions = liveRegionsNamed([LIVE_REGION_NAMES.tabs, LIVE_REGION_NAMES.loading]);

      expect(screen.getByRole('status', { name: LIVE_REGION_NAMES.loading })).toHaveTextContent(
        /cargando el documento/i,
      );
      expect(liveRegionNodes()).toHaveLength(regions.length);
      expectNoneNested(regions);
    } finally {
      // La lectura se resuelve **pase lo que pase**, y el `finally` no es celo: `open` cachea la
      // lectura en vuelo en un mapa de **módulo** (`readsInFlight`, AC-10) que ningún `beforeEach`
      // limpia. Dejarla colgada haría que el caso siguiente abriera el documento contra una promesa
      // que no llega nunca —pestañas vacías y `openIds` a cero—, así que el rojo saldría en el caso
      // de al lado y no aquí. Medido: el rojo de este caso arrastró al de AC-27.
      pending.resolveWith(
        jsonResponse(lunes({ content: SERVER_TEXT, contentVersion: SERVER_VERSION })),
      );
    }

    await settle();

    // Y al llegar el documento la de la carga se va: las que quedan son las tres del modo texto.
    expect(
      screen.queryByRole('status', { name: LIVE_REGION_NAMES.loading }),
    ).not.toBeInTheDocument();
  });

  it('el orden de tabulación relativo es tira → conmutador → Guardar → paleta → área de texto (AC-27)', async () => {
    await openEditorInApp();

    // El criterio es el orden **relativo** de estos cinco y no una secuencia cerrada: por medio hay
    // paradas del shell (plegar la barra lateral, el árbol, la cabecera) que no son de este AC. Y
    // «Guardar» está enumerado a propósito: vive entre el conmutador y la paleta, y escribir un orden
    // que lo ignore es el error exacto que la `004` tuvo que corregir en su AC-26.
    const stops: readonly (readonly [string, HTMLElement])[] = [
      // Por título **no exacto** (AC-24): el nombre accesible de la pestaña lleva dentro su estado y
      // cómo se cierra, así que un nombre exacto se rompería en cuanto el documento se ensuciara.
      ['tira de pestañas', screen.getByRole('tab', { name: /«Lunes»/ })],
      [
        'conmutador de vista',
        within(viewModeTablist()).getByRole('tab', { name: VIEW_MODE_LABELS.text }),
      ],
      ['Guardar', screen.getByRole('button', { name: 'Guardar' })],
      ['paleta', paletteButton('Negrita')],
      ['área de texto', textareaNode()],
    ];

    const visited = await tabThrough(TAB_SWEEP_STEPS);
    const reached = stops.map(([label, node]) => [label, visited.indexOf(node)] as const);

    // Primero, que el recorrido llegue a los cinco: un `-1` es una parada que el tabulador no alcanza,
    // y ese fallo se lee mucho peor disfrazado de orden equivocado.
    expect(reached.filter(([, position]) => position === -1)).toEqual([]);
    expect([...reached].sort((a, b) => a[1] - b[1]).map(([label]) => label)).toEqual(
      stops.map(([label]) => label),
    );
  });
});

/**
 * Atajos de historial (spec `006`: AC-23, AC-24, AC-25, AC-26, y la mitad de cableado de AC-11).
 *
 * Van **en el área de escritura** y no en la ventana, igual que los `Ctrl`/`Cmd`+`B`/`I`/`K` de la
 * `004` y al revés que el `Ctrl`+`S` de la `003`: guardar es una acción de la página entera, y
 * deshacer solo significa algo donde se está escribiendo.
 */
describe('DocumentEditorPage — atajos de deshacer (spec 006: AC-23…AC-26)', () => {
  const TITLE_AT = [2, 8] as const;

  it('Ctrl+Z deshace la última inserción y llama a preventDefault (AC-23)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.click(paletteButton('Negrita'));

    expect(entry().draft).toBe('**texto en negrita**# Título del servidor\n');

    const prevented = await pressShortcut(textarea(), 'z');

    expect(entry().draft).toBe(SERVER_TEXT);
    // La otra mitad del AC: sin `preventDefault` el deshacer **nativo** también correría, y a partir
    // de la primera escritura programática ese es el que miente.
    expect(prevented).toBe(true);
  });

  it('Cmd+Z hace lo mismo que Ctrl+Z (AC-23)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.click(paletteButton('Negrita'));
    await pressShortcut(textarea(), 'z', 'meta');

    expect(entry().draft).toBe(SERVER_TEXT);
  });

  it('Ctrl+Shift+Z rehace, y NO deshace (AC-24)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.click(paletteButton('Negrita'));

    const inserted = entry().draft;

    await pressShortcut(textarea(), 'z');

    expect(entry().draft).toBe(SERVER_TEXT);

    const prevented = await pressShortcut(textarea(), 'z', 'ctrl', true);

    expect(entry().draft).toBe(inserted);
    expect(prevented).toBe(true);
  });

  it('Ctrl+Y también rehace (AC-24)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.click(paletteButton('Negrita'));

    const inserted = entry().draft;

    await pressShortcut(textarea(), 'z');

    // **Sin esta línea el caso pasaba con la página sin tocar**: «el texto vuelve a la inserción» es
    // cierto también si ni deshacer ni rehacer hacen nada. Afirmar el paso intermedio es lo que lo
    // convierte en una comprobación en vez de en una coincidencia.
    expect(entry().draft).toBe(SERVER_TEXT);

    await pressShortcut(textarea(), 'y');

    expect(entry().draft).toBe(inserted);
  });

  it('ninguna fila del catálogo de la paleta reclama una tecla de historial (AC-25)', () => {
    const claimed = MARKDOWN_PALETTE.filter(
      (element) =>
        element.shortcut !== undefined && HISTORY_SHORTCUT_KEYS.includes(element.shortcut),
    );

    // El cruce de **dos enumeraciones**, sin ningún número escrito a mano: añadir mañana un elemento
    // con `shortcut: 'z'` rompería `Ctrl`+`Z` en silencio, y este caso es lo único que lo impide.
    expect(claimed).toEqual([]);
  });

  it('fuera del área de escritura los atajos no hacen nada (AC-26)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.click(paletteButton('Negrita'));

    const inserted = entry().draft;

    await pressShortcut(screen.getByRole('button', { name: 'Guardar' }), 'z');

    // Deshacer desde otro control de la página editaría un documento a espaldas de quien lo pulsó.
    expect(entry().draft).toBe(inserted);
  });

  it('deshacer una inserción devuelve la SELECCIÓN que había, no un cursor suelto (AC-11)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    const node = textareaNode();

    node.focus();
    node.setSelectionRange(...TITLE_AT);

    await user.click(paletteButton('Negrita'));

    expect(entry().draft).toBe('# **Título** del servidor\n');
    expect(caret()).toEqual([4, 10]);

    await pressShortcut(textarea(), 'z');

    expect(entry().draft).toBe(SERVER_TEXT);
    // La mitad de AC-11 que solo se ve desde la página: si `insertElement` dejara de pasar las dos
    // selecciones, el store derivaría un cursor colapsado y esto sería `[2, 2]`.
    expect(caret()).toEqual([...TITLE_AT]);
  });
});

/**
 * Los dos controles visibles del historial (spec `006`: AC-27…AC-31).
 *
 * **No son accesibilidad opcional, son la mitad de la funcionalidad.** Sin ellos, deshacer solo existe
 * para quien usa teclado físico; y cuando la cota de memoria desaloja los pasos viejos, el botón
 * deshabilitado es **la única señal** que distingue «se acabó el historial» de «esto está roto».
 */
describe('DocumentEditorPage — controles de historial (spec 006: AC-27…AC-31)', () => {
  const UNDO_NAME = 'Deshacer · Ctrl+Z';
  const REDO_NAME = 'Rehacer · Ctrl+Shift+Z';
  const TITLE_AT = [2, 8] as const;

  function undoButton(): HTMLElement {
    return screen.getByRole('button', { name: UNDO_NAME });
  }

  function redoButton(): HTMLElement {
    return screen.getByRole('button', { name: REDO_NAME });
  }

  it('los dos controles dicen su atajo en el nombre accesible (AC-27)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    // El mecanismo va **en el nombre**, como la «×» de la `005` dice `· Supr para cerrar`: un atajo
    // que no se anuncia en ninguna parte solo lo usa quien ya lo sabía.
    expect(undoButton()).toBeInTheDocument();
    expect(redoButton()).toBeInTheDocument();
  });

  it('cada control está deshabilitado exactamente cuando su lado de la pila está vacío (AC-28)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    // 1) Nada hecho todavía: no hay nada que deshacer ni que rehacer.
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeDisabled();

    await user.click(paletteButton('Negrita'));

    // 2) Un paso hecho.
    expect(undoButton()).toBeEnabled();
    expect(redoButton()).toBeDisabled();

    await pressShortcut(textarea(), 'z');

    // 3) Deshecho: ya no queda pasado, pero sí futuro.
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeEnabled();

    await pressShortcut(textarea(), 'z', 'ctrl', true);

    // 4) Rehecho: se vuelve al estado 2. Es lo que hace que el deshabilitado no sea un billete de ida.
    expect(undoButton()).toBeEnabled();
    expect(redoButton()).toBeDisabled();
  });

  it('están donde se escribe —texto y dividida— y no en vista previa (AC-29)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    expect(undoButton()).toBeInTheDocument();

    await selectMode('preview');

    // Misma regla que la paleta: deshacer es una acción de edición, y en vista previa no se edita.
    expect(screen.queryByRole('button', { name: UNDO_NAME })).toBeNull();
    expect(screen.queryByRole('button', { name: REDO_NAME })).toBeNull();

    await selectMode('split');

    expect(undoButton()).toBeInTheDocument();
    expect(redoButton()).toBeInTheDocument();
  });

  it('el botón restaura la selección SIN robar el foco al pulsarlo con Enter (AC-30)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    const node = textareaNode();

    node.focus();
    node.setSelectionRange(...TITLE_AT);

    await user.click(paletteButton('Negrita'));

    expect(entry().draft).toBe('# **Título** del servidor\n');

    const button = undoButton();

    button.focus();
    await user.keyboard('{Enter}');

    expect(entry().draft).toBe(SERVER_TEXT);
    expect(caret()).toEqual([...TITLE_AT]);
    // **Sin esto, la segunda pulsación de `Enter` escribiría un salto de línea en el documento**: el
    // foco se habría ido al área de texto. Es un defecto que solo aparece navegando con teclado, o
    // sea con el público exacto para el que existe el botón.
    expect(button).toHaveFocus();
  });

  it('el atajo sí deja el foco donde estaba, en el área de escritura (AC-30)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    await user.click(paletteButton('Negrita'));
    textareaNode().focus();

    await pressShortcut(textarea(), 'z');

    expect(textareaNode()).toHaveFocus();
  });

  it('los controles NO añaden ninguna región viva (AC-31)', async () => {
    await seedTree();
    await openEditor({ [PUT_ROUTE]: contentSaved(SERVER_VERSION + 1) });

    // La cuenta sale de **la enumeración de nombres**, no de un literal: si mañana alguien añade una
    // quinta región, este caso lo dice; y si le quita el nombre a una, también.
    const named = [LIVE_REGION_NAMES.save, LIVE_REGION_NAMES.palette];

    expect(liveRegionNodes()).toHaveLength(liveRegionsNamed(named).length);

    await user.click(paletteButton('Negrita'));
    await pressShortcut(textarea(), 'z');

    // Deshacer no anuncia nada, y es una decisión escrita (§9.1, decisión B): la página ya tiene
    // cuatro regiones vivas y una quinta que se dispara en cada `Ctrl`+`Z` de una ráfaga es la clase
    // de aviso que enseña a ignorar los avisos. La señal que queda es el botón deshabilitado.
    expect(liveRegionNodes()).toHaveLength(liveRegionsNamed(named).length);
  });
});
