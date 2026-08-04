import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { DocumentTabs } from './DocumentTabs';
import { useEditorStore, type EditorEntry } from './editor.store';
import { EMPTY_HISTORY } from './undo-history';
import { documentSummary } from '../../test/workspace-fixtures';
import { useWorkspaceStore } from '../workspace/workspace.store';

/**
 * Tira de pestañas de documentos (spec `005`: AC-3, AC-20, AC-21, AC-22, AC-23, AC-24, AC-28).
 *
 * El componente **no recibe nada**: lee las pestañas abiertas del store del editor, los títulos del
 * store del árbol y la pestaña activa de la **ruta**. Por eso aquí se siembran los dos stores a mano
 * y se monta con un router de memoria — el montaje real en `AppShell` es de `T-007` y este archivo
 * no lo toca.
 *
 * Nada de red: las entradas se siembran **limpias**, así que el `closeTab` del store (que guarda
 * antes de desalojar) no llega a emitir ningún `PUT`. Un caso que cerrara una pestaña sucia estaría
 * midiendo el guardado, que es de `editor.store.test.ts`.
 */

/** Tres documentos, que es el mínimo con el que «envolver» e «ir al otro» se distinguen (AC-21). */
const DOCS = [
  { id: 'doc-notas', title: 'Notas' },
  { id: 'doc-diario', title: 'Diario' },
  { id: 'doc-recetas', title: 'Recetas' },
] as const;

/** Índice con guarda: `noUncheckedIndexedAccess` está activo y aquí un hueco es un fallo del test. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];

  if (item === undefined) {
    throw new Error(`No hay elemento en la posición ${index}`);
  }

  return item;
}

function entry(overrides: Partial<EditorEntry> = {}): EditorEntry {
  return {
    savedContent: '# Hola\n',
    draft: '# Hola\n',
    contentVersion: 0,
    status: 'clean',
    // Añadido por la fase 6: `EditorEntry` gana la hora del último guardado confirmado, y este
    // *fixture* construye un valor del tipo, así que entra en el radio del cambio.
    savedAt: null,
    viewMode: 'text',
    error: null,
    serverContent: null,
    serverVersion: null,
    // Añadido por la `006`: `EditorEntry` gana su pila de deshacer, y este *fixture* construye un
    // valor del tipo, así que entra en el radio del cambio aunque no tenga nada que ver con pestañas.
    undo: EMPTY_HISTORY,
    ...overrides,
  };
}

interface SeededTab {
  readonly id: string;
  readonly title: string;
  /** Deja la entrada en `dirty`, que es lo que el nombre accesible tiene que delatar (AC-24). */
  readonly unsaved?: boolean;
}

/** Siembra los dos stores: los títulos viven en el árbol y las pestañas en el editor. */
function seed(tabs: readonly SeededTab[]): void {
  useWorkspaceStore.setState({
    documentsById: Object.fromEntries(
      tabs.map((tab) => [tab.id, documentSummary({ id: tab.id, title: tab.title })]),
    ),
  });

  useEditorStore.setState({
    openIds: tabs.map((tab) => tab.id),
    entries: Object.fromEntries(
      tabs.map((tab) => [
        tab.id,
        entry(tab.unsaved === true ? { draft: '# Hola, y algo más\n', status: 'dirty' } : {}),
      ]),
    ),
  });
}

/**
 * Monta la tira en la ruta indicada, con una sonda que deja leer a dónde acabó la navegación. La
 * pestaña activa **es** el `:id` de esa ruta y no un campo del store, que es lo que AC-3 defiende.
 */
function renderTabsAt(path: string): { readonly pathname: () => string } {
  let current = path;

  function LocationProbe(): null {
    current = useLocation().pathname;

    return null;
  }

  render(
    <MemoryRouter initialEntries={[path]}>
      <DocumentTabs />
      <LocationProbe />
    </MemoryRouter>,
  );

  return { pathname: () => current };
}

function routeOf(id: string): string {
  return `/documents/${id}`;
}

function tabs(): readonly HTMLElement[] {
  return screen.getAllByRole('tab');
}

/** El nombre accesible completo de una pestaña, tal y como lo locuta un lector (AC-23, AC-24). */
function tabName(title: string, unsaved = false): string {
  return `«${title}»${unsaved ? ' · sin guardar' : ''} · Supr para cerrar`;
}

function tabOf(title: string, unsaved = false): HTMLElement {
  return screen.getByRole('tab', { name: tabName(title, unsaved) });
}

/** La única parada de tabulación de la tira, tal y como la ve el navegador (AC-20). */
function tabStops(): readonly HTMLElement[] {
  return tabs().filter((tab) => tab.tabIndex === 0);
}

/**
 * Nombre accesible de la región viva de la tira (AC-28). Sale de su `aria-label` y **no** de su
 * contenido: el contenido empieza vacío y cambia con cada cierre, y en la página del editor conviven
 * con ella la región del guardado (`003`) y la de la paleta (`004`).
 */
const LIVE_REGION_NAME = 'Pestañas abiertas';

function liveRegion(): HTMLElement {
  return screen.getByRole('status', { name: LIVE_REGION_NAME });
}

/**
 * Cuenta los cambios del contenido de un nodo. Se cierra con `takeRecords()`, que devuelve de forma
 * síncrona lo que quede pendiente; el callback acumula porque cada `await` de `user-event` cruza
 * puntos de comprobación de microtareas y vacía la cola del observador. Mismo ayudante que en
 * `MarkdownPalette.test.tsx`, y por el mismo motivo: lo que se afirma es que la región **cambió**.
 */
function watchChanges(node: HTMLElement): { readonly count: () => number } {
  const seen: MutationRecord[] = [];
  const observer = new MutationObserver((records) => {
    seen.push(...records);
  });

  observer.observe(node, { childList: true, characterData: true, subtree: true });

  return {
    count: (): number => {
      seen.push(...observer.takeRecords());
      observer.disconnect();

      return seen.length;
    },
  };
}

let user: UserEvent;

beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
  user = userEvent.setup();
});

describe('DocumentTabs — estructura y nombres accesibles (AC-20, AC-23, AC-24)', () => {
  it('es un tablist con nombre propio y una pestaña por documento abierto', () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 1).id));

    const tablist = screen.getByRole('tablist', { name: 'Documentos abiertos' });
    const painted = within(tablist).getAllByRole('tab');

    expect(painted).toHaveLength(DOCS.length);
    expect(painted.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);

    // Decisión A: son **botones**, no enlaces. Un `<button>` sin `type` dentro de un formulario
    // envía el formulario, y esta tira acabará dentro del shell.
    painted.forEach((tab) => {
      expect(tab).toHaveAttribute('type', 'button');
    });
  });

  it('el nombre accesible lleva el título y cómo se cierra, y el estado sin guardar entra en él', () => {
    seed([
      { id: at(DOCS, 0).id, title: at(DOCS, 0).title },
      { id: at(DOCS, 1).id, title: at(DOCS, 1).title, unsaved: true },
    ]);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    // AC-23: el título va dentro, porque N controles llamados «Cerrar» son indistinguibles en la
    // lista de un lector. AC-24: «sin guardar» es **palabra**, no solo un punto de color.
    expect(at(tabs(), 0)).toHaveAccessibleName(tabName('Notas'));
    expect(at(tabs(), 1)).toHaveAccessibleName(tabName('Diario', true));
  });

  it('el punto de «sin guardar» y la «×» son aria-hidden: se ven, pero no se locutan dos veces', () => {
    seed([{ id: at(DOCS, 1).id, title: at(DOCS, 1).title, unsaved: true }]);
    renderTabsAt(routeOf(at(DOCS, 1).id));

    const tab = at(tabs(), 0);

    // Están pintados…
    expect(tab).toHaveTextContent('●');
    expect(tab).toHaveTextContent('×');
    // …y no aparecen en el nombre, que es lo que demuestra que están `aria-hidden`. Sin esto, un
    // lector diría «Diario punto por» y el estado seguiría dependiendo del color para quien ve.
    expect(tab.getAttribute('aria-label')).not.toContain('●');
    expect(tab.getAttribute('aria-label')).not.toContain('×');
  });

  it('la «×» NO es un botón anidado: un <button> dentro de un <button> es HTML inválido', () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    tabs().forEach((tab) => {
      expect(within(tab).queryAllByRole('button')).toHaveLength(0);
    });
  });

  it('no introduce ni un listitem: el breadcrumb de la página cuenta los suyos en global', () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    // `DocumentEditorPage.test.tsx` afirma el breadcrumb con un `getAllByRole('listitem')` global de
    // tres elementos. Una tira hecha con `<ul>`/`<li>` lo rompería sin tener nada que ver.
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('no pinta ninguna tira cuando no hay pestañas abiertas', () => {
    renderTabsAt('/');

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});

describe('DocumentTabs — roving tabindex y teclado (AC-20, AC-21)', () => {
  it('tiene UNA sola parada de tabulación para las tres pestañas, y es la activa', async () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 1).id));

    expect(tabStops()).toEqual([tabOf('Diario')]);

    await user.tab();

    expect(document.activeElement).toBe(tabOf('Diario'));

    // La segunda tabulación **sale** de la tira: tres pestañas no pueden ser tres paradas.
    await user.tab();

    expect(document.activeElement).not.toBe(tabOf('Notas'));
    expect(document.activeElement).not.toBe(tabOf('Recetas'));
  });

  it('las flechas mueven el foco de verdad, envuelven por los dos extremos, y vuelven al punto de partida', async () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    await user.tab();

    expect(document.activeElement).toBe(tabOf('Notas'));

    // Ida hacia la izquierda: envuelve por el extremo izquierdo y recorre las tres.
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(tabOf('Recetas'));

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(tabOf('Diario'));

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(tabOf('Notas'));

    // Vuelta hacia la derecha: envuelve por el extremo derecho y acaba donde empezó. El viaje de
    // ida y vuelta es lo que impide que el caso acabe midiendo dónde arranca el foco.
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tabOf('Diario'));

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tabOf('Recetas'));

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tabOf('Notas'));
  });

  it('la parada de tabulación sigue al foco: mover con flechas no deja dos paradas', async () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(tabStops()).toEqual([tabOf('Diario')]);
  });

  it('Home va a la primera y End a la última', async () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 1).id));

    await user.tab();
    await user.keyboard('{End}');

    expect(document.activeElement).toBe(tabOf('Recetas'));

    await user.keyboard('{Home}');

    expect(document.activeElement).toBe(tabOf('Notas'));
  });

  it('mover el foco con flechas NO cambia de pestaña activa ni navega', async () => {
    seed(DOCS);
    const location = renderTabsAt(routeOf(at(DOCS, 0).id));

    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(location.pathname()).toBe(routeOf(at(DOCS, 0).id));
    expect(tabOf('Notas')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('DocumentTabs — cierre con Delete (AC-22)', () => {
  it('cierra la pestaña enfocada y lleva el foco a la vecina de la DERECHA', async () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(tabOf('Diario'));

    await user.keyboard('{Delete}');

    await waitFor(() => {
      expect(tabs()).toHaveLength(2);
    });

    expect(document.activeElement).toBe(tabOf('Recetas'));
    expect(document.activeElement).not.toBe(document.body);
    expect(useEditorStore.getState().openIds).toEqual([at(DOCS, 0).id, at(DOCS, 2).id]);
  });

  it('cerrando la última de la tira, el foco cae en la vecina de la IZQUIERDA', async () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    await user.tab();
    await user.keyboard('{End}{Delete}');

    await waitFor(() => {
      expect(tabs()).toHaveLength(2);
    });

    expect(document.activeElement).toBe(tabOf('Diario'));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('al cerrar la ÚLTIMA pestaña que quedaba, el foco va a un destino existente y nunca al body', async () => {
    seed([{ id: at(DOCS, 0).id, title: at(DOCS, 0).title }]);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    await user.tab();
    await user.keyboard('{Delete}');

    await waitFor(() => {
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
    });

    // Sin tira que enfocar, el destino declarado es la región que acaba de contar lo que pasó: está
    // montada, existe, y es donde está la explicación. Quedarse en el `<body>` deja a quien navega
    // con teclado en el principio del documento sin decírselo.
    expect(document.activeElement).toBe(liveRegion());
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('DocumentTabs — ratón: activar y cerrar (AC-3, decisión B)', () => {
  it('el clic en el cuerpo de la pestaña navega a su documento', async () => {
    seed(DOCS);
    const location = renderTabsAt(routeOf(at(DOCS, 0).id));

    await user.click(within(tabOf('Recetas')).getByText('Recetas'));

    expect(location.pathname()).toBe(routeOf(at(DOCS, 2).id));
  });

  it('el clic en la «×» cierra esa pestaña y no navega a ella', async () => {
    seed(DOCS);
    const location = renderTabsAt(routeOf(at(DOCS, 0).id));

    await user.click(within(tabOf('Diario')).getByText('×'));

    await waitFor(() => {
      expect(tabs()).toHaveLength(2);
    });

    expect(useEditorStore.getState().openIds).toEqual([at(DOCS, 0).id, at(DOCS, 2).id]);
    // Cerrar una pestaña **no activa** no toca la ruta (AC-4).
    expect(location.pathname()).toBe(routeOf(at(DOCS, 0).id));
  });

  it('cambiar de pestaña activa NO muta el store: la pestaña activa es la ruta y nada más (AC-3)', async () => {
    seed(DOCS);
    const location = renderTabsAt(routeOf(at(DOCS, 0).id));

    const before = useEditorStore.getState();

    await user.click(within(tabOf('Diario')).getByText('Diario'));

    const after = useEditorStore.getState();

    // Las **referencias**, no su contenido: cualquier `activeId` escrito en el store —el segundo
    // origen de verdad que este AC existe para impedir— las cambiaría.
    expect(after.entries).toBe(before.entries);
    expect(after.openIds).toBe(before.openIds);
    // Y lo único que cambia es la ruta, que es de donde sale la selección.
    expect(location.pathname()).toBe(routeOf(at(DOCS, 1).id));
    expect(tabOf('Diario')).toHaveAttribute('aria-selected', 'true');
    expect(tabOf('Notas')).toHaveAttribute('aria-selected', 'false');
  });
});

describe('DocumentTabs — región viva (AC-28)', () => {
  it('monta su región viva DESDE EL PRIMER RENDER, con nombre y vacía, y anuncia el cierre con el título', async () => {
    seed(DOCS);
    renderTabsAt(routeOf(at(DOCS, 0).id));

    // La región existe **antes** de tener nada que decir: un lector registra las regiones vivas que
    // encuentra y anuncia sus **cambios**, así que una que entra en el DOM con su texto ya dentro no
    // le presenta un cambio sino una aparición, y NVDA o JAWS pueden no leerla nunca.
    const region = liveRegion();

    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveAccessibleName(LIVE_REGION_NAME);

    await user.click(within(tabOf('Diario')).getByText('×'));

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent('Diario');
    });
  });

  it('vuelve a anunciar al cerrar DOS VECES el mismo título', async () => {
    // Dos documentos distintos con el **mismo** título: es el caso en que escribir en la región lo
    // que ya ponía no muta el DOM y, por tanto, no anuncia nada.
    seed([
      { id: 'doc-notas-1', title: 'Notas' },
      { id: 'doc-notas-2', title: 'Notas' },
    ]);
    renderTabsAt('/');

    const region = liveRegion();
    const changes = watchChanges(region);

    await user.click(within(at(tabs(), 0)).getByText('×'));

    await waitFor(() => {
      expect(tabs()).toHaveLength(1);
    });

    await user.click(within(at(tabs(), 0)).getByText('×'));

    await waitFor(() => {
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
    });

    // El estado final de los dos cierres es idéntico al del primero, así que este AC no se puede
    // afirmar mirando la pantalla: lo que se mide es que la región **cambió** las dos veces. La
    // implementación es libre de vaciar y reescribir o de variar el texto de forma imperceptible.
    expect(changes.count()).toBeGreaterThanOrEqual(2);
    expect(region).toHaveTextContent('Notas');
  });
});
