import type { WorkspaceTree } from '@one-markdown/shared';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceTreeView } from './WorkspaceTreeView';
import { useWorkspaceStore, type WorkspaceState } from './workspace.store';
import { configureAuthBridge } from '../../shared/api/http';
import {
  apiErrorResponse,
  deferredResponse,
  jsonResponse,
  noContentResponse,
  stubApi,
} from '../../test/api-stub';
import {
  directoryNode,
  documentSummary,
  markdownDocument,
  workspaceTree,
} from '../../test/workspace-fixtures';

/**
 * Árbol de prueba (AC-28). Tres niveles, un directorio vacío y documentos en cada nivel, que es lo
 * mínimo para distinguir `aria-level`, nodos visibles de nodos ocultos y "bajar al primer hijo" de
 * "expandir".
 *
 *   Notas            (dir, raíz)
 *     Diario         (dir, nivel 2)
 *       Lunes        (doc, nivel 3)
 *     Ideas          (doc, nivel 2)
 *   Proyectos        (dir vacío, raíz)
 *   En la raíz       (doc, raíz)
 *
 * El orden de cada lista es el del servidor, que es lo que el store conserva: primero los
 * directorios de un padre y después sus documentos.
 */
function sampleTree(): WorkspaceTree {
  return workspaceTree({
    directories: [
      directoryNode({ id: 'dir-notas', name: 'Notas' }),
      directoryNode({ id: 'dir-proyectos', name: 'Proyectos' }),
      directoryNode({ id: 'dir-diario', name: 'Diario', parentId: 'dir-notas', depth: 1 }),
    ],
    documents: [
      documentSummary({ id: 'doc-raiz', title: 'En la raíz', directoryId: null }),
      documentSummary({ id: 'doc-ideas', title: 'Ideas', directoryId: 'dir-notas' }),
      documentSummary({ id: 'doc-lunes', title: 'Lunes', directoryId: 'dir-diario' }),
    ],
  });
}

/**
 * Deja el árbol cargado en el store por el camino real (petición + normalización) y aplica el
 * estado de interfaz que el caso necesite. Después la red se retira: con `status: 'ready'` la vista
 * no vuelve a pedir nada, así que cualquier llamada inesperada revienta.
 */
async function seedTree(uiState: Partial<WorkspaceState> = {}): Promise<void> {
  stubApi({ 'GET /api/workspace/tree': () => jsonResponse(sampleTree()) });
  await useWorkspaceStore.getState().loadTree();
  vi.unstubAllGlobals();

  useWorkspaceStore.setState(uiState);
}

/**
 * Desde T-022 activar un documento navega a `/documents/:id`, así que el árbol necesita un router
 * alrededor. Basta el de memoria: aquí no se comprueba a dónde se va, eso es de `DocumentViewPage`.
 */
function renderTree(): void {
  render(<WorkspaceTreeView />, { wrapper: MemoryRouter });
}

/**
 * Igual que `renderTree`, pero con una ruta de partida y una sonda que deja leer a dónde acabó la
 * navegación. Lo necesita el único caso que la comprueba: borrar el documento que está abierto.
 */
function renderTreeAt(path: string): { readonly pathname: () => string } {
  let current = path;

  function LocationProbe(): null {
    current = useLocation().pathname;

    return null;
  }

  render(
    <MemoryRouter initialEntries={[path]}>
      <WorkspaceTreeView />
      <LocationProbe />
    </MemoryRouter>,
  );

  return { pathname: () => current };
}

/** El nodo que el navegador enfocaría al tabular hacia el árbol. */
function tabbableNodes(): HTMLElement[] {
  return screen.getAllByRole('treeitem').filter((node) => node.tabIndex === 0);
}

beforeEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);

  configureAuthBridge({
    getAccessToken: () => 'access-token-1',
    onSessionRenewed: () => undefined,
    onSessionLost: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WorkspaceTreeView — carga (AC-28)', () => {
  it('pide el árbol al montarse cuando todavía no se ha cargado', async () => {
    const api = stubApi({ 'GET /api/workspace/tree': () => jsonResponse(sampleTree()) });

    renderTree();

    expect(await screen.findByRole('treeitem', { name: 'Notas' })).toBeInTheDocument();
    expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(1);
  });

  it('dice que el árbol está vacío cuando no hay ningún nodo', async () => {
    stubApi({ 'GET /api/workspace/tree': () => jsonResponse(workspaceTree()) });

    renderTree();

    expect(await screen.findByText(/tu archivo está vacío/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
  });

  it('anuncia en un role="alert" que el árbol no se pudo cargar', async () => {
    stubApi({
      'GET /api/workspace/tree': () => apiErrorResponse(500, 'El servidor no pudo responder'),
    });

    renderTree();

    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no pudo responder');
  });
});

describe('WorkspaceTreeView — estructura ARIA (AC-28)', () => {
  it('expone un árbol con nombre accesible', async () => {
    await seedTree();

    renderTree();

    expect(screen.getByRole('tree', { name: 'Estructura' })).toBeInTheDocument();
  });

  it('da a cada nodo el aria-level de su profundidad', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas', 'dir-diario']) });

    renderTree();

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveAttribute('aria-level', '1');
    expect(screen.getByRole('treeitem', { name: 'Diario' })).toHaveAttribute('aria-level', '2');
    expect(screen.getByRole('treeitem', { name: 'Lunes' })).toHaveAttribute('aria-level', '3');
  });

  it('marca aria-expanded en los directorios y no en los documentos', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('treeitem', { name: 'Diario' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('treeitem', { name: 'Ideas' })).not.toHaveAttribute('aria-expanded');
    expect(screen.getByRole('treeitem', { name: 'En la raíz' })).not.toHaveAttribute(
      'aria-expanded',
    );
  });

  it('deja tabulable un único nodo y el resto fuera del orden de tabulación', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();

    const nodes = screen.getAllByRole('treeitem');

    expect(tabbableNodes()).toHaveLength(1);
    expect(nodes.filter((node) => node.tabIndex === -1)).toHaveLength(nodes.length - 1);
  });

  it('marca con aria-selected el nodo seleccionado y solo ese', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']), selectedId: 'doc-ideas' });

    renderTree();

    expect(screen.getByRole('treeitem', { name: 'Ideas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('treeitem', { selected: true })).toHaveLength(1);
  });

  it('selecciona el documento sobre el que se hace clic', async () => {
    await seedTree();

    renderTree();
    await userEvent.click(screen.getByRole('treeitem', { name: 'En la raíz' }));

    expect(useWorkspaceStore.getState().selectedId).toBe('doc-raiz');
    expect(screen.getByRole('treeitem', { name: 'En la raíz' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('WorkspaceTreeView — navegación por teclado (AC-28)', () => {
  it('baja y sube el foco entre nodos con las flechas vertical', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();
    await userEvent.tab();

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('treeitem', { name: 'Diario' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('treeitem', { name: 'Ideas' })).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('treeitem', { name: 'Diario' })).toHaveFocus();
  });

  it('mueve el foco al nodo tabulable, que pasa a ser el único con tabindex 0', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');

    expect(tabbableNodes()).toEqual([screen.getByRole('treeitem', { name: 'Diario' })]);
  });

  it('salta los hijos de un directorio contraído, que ni se renderizan ni reciben foco', async () => {
    await seedTree();

    renderTree();

    expect(screen.getAllByRole('treeitem')).toHaveLength(3);
    expect(screen.queryByRole('treeitem', { name: 'Ideas' })).not.toBeInTheDocument();

    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByRole('treeitem', { name: 'Proyectos' })).toHaveFocus();
    expect(screen.queryByRole('treeitem', { name: 'Diario' })).not.toBeInTheDocument();
  });

  it('expande con la flecha derecha un directorio contraído sin mover el foco', async () => {
    await seedTree();

    renderTree();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveFocus();
    expect(screen.getByRole('treeitem', { name: 'Diario' })).toBeInTheDocument();
  });

  it('baja al primer hijo con la flecha derecha si el directorio ya está expandido', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('treeitem', { name: 'Diario' })).toHaveFocus();
    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('contrae con la flecha izquierda un directorio expandido sin mover el foco', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveFocus();
    expect(screen.queryByRole('treeitem', { name: 'Diario' })).not.toBeInTheDocument();
  });

  it('sube al padre con la flecha izquierda si el nodo ya está contraído', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByRole('treeitem', { name: 'Diario' })).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}');

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveFocus();
    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('sube al padre desde un documento anidado con la flecha izquierda', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas', 'dir-diario']) });

    renderTree();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');

    expect(screen.getByRole('treeitem', { name: 'Lunes' })).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}');

    expect(screen.getByRole('treeitem', { name: 'Diario' })).toHaveFocus();
  });

  it('selecciona con Enter el nodo que tiene el foco', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(useWorkspaceStore.getState().selectedId).toBe('doc-ideas');
    expect(screen.getByRole('treeitem', { name: 'Ideas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('lleva el foco al primer y al último nodo visible con Home y End', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas', 'dir-diario']) });

    renderTree();
    await userEvent.tab();
    await userEvent.keyboard('{End}');

    expect(screen.getByRole('treeitem', { name: 'En la raíz' })).toHaveFocus();

    await userEvent.keyboard('{Home}');

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveFocus();
  });
});

describe('WorkspaceTreeView — crear (AC-29)', () => {
  it('crea un directorio en la raíz y lo muestra tras la recarga', async () => {
    await seedTree();
    const api = stubApi({
      'POST /api/workspace/directories': () =>
        jsonResponse(directoryNode({ id: 'dir-recetas', name: 'Recetas' }), 201),
      'GET /api/workspace/tree': () =>
        jsonResponse(
          workspaceTree({ directories: [directoryNode({ id: 'dir-recetas', name: 'Recetas' })] }),
        ),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo en la raíz' }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Recetas');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la carpeta' }));

    expect(api.callsTo('POST /api/workspace/directories')[0]?.body).toEqual({
      name: 'Recetas',
      parentId: null,
    });
    expect(await screen.findByRole('treeitem', { name: 'Recetas' })).toBeInTheDocument();
  });

  it('crea un directorio dentro del padre elegido y lo despliega para que se vea', async () => {
    await seedTree();
    const api = stubApi({
      'POST /api/workspace/directories': () =>
        jsonResponse(
          directoryNode({ id: 'dir-cocina', name: 'Cocina', parentId: 'dir-notas', depth: 1 }),
          201,
        ),
      'GET /api/workspace/tree': () =>
        jsonResponse(
          workspaceTree({
            directories: [
              directoryNode({ id: 'dir-notas', name: 'Notas' }),
              directoryNode({ id: 'dir-cocina', name: 'Cocina', parentId: 'dir-notas', depth: 1 }),
            ],
          }),
        ),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo en «Notas»' }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Cocina');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la carpeta' }));

    expect(api.callsTo('POST /api/workspace/directories')[0]?.body).toEqual({
      name: 'Cocina',
      parentId: 'dir-notas',
    });
    expect(await screen.findByRole('treeitem', { name: 'Cocina' })).toBeInTheDocument();
  });

  it('crea un documento en el padre elegido', async () => {
    await seedTree();
    const api = stubApi({
      'POST /api/workspace/documents': () =>
        jsonResponse(
          markdownDocument({ id: 'doc-sopa', title: 'Sopa', directoryId: 'dir-notas' }),
          201,
        ),
      'GET /api/workspace/tree': () =>
        jsonResponse(
          workspaceTree({
            directories: [directoryNode({ id: 'dir-notas', name: 'Notas' })],
            documents: [
              documentSummary({ id: 'doc-sopa', title: 'Sopa', directoryId: 'dir-notas' }),
            ],
          }),
        ),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo en «Notas»' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Documento' }));
    await userEvent.type(screen.getByLabelText('Título'), 'Sopa');
    // El botón sigue al tipo elegido (fase 6, §4.8): con «Documento» marcado dice qué va a crear, y
    // por eso no puede quedar escrito «Crear» a secas en ninguna de las dos ramas.
    await userEvent.click(screen.getByRole('button', { name: 'Crear el documento' }));

    expect(api.callsTo('POST /api/workspace/documents')[0]?.body).toEqual({
      title: 'Sopa',
      directoryId: 'dir-notas',
    });
    expect(await screen.findByRole('treeitem', { name: 'Sopa' })).toBeInTheDocument();
  });
});

describe('WorkspaceTreeView — renombrar (AC-29)', () => {
  it('abre un diálogo modal con el nombre actual precargado en un campo etiquetado', async () => {
    await seedTree();

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Renombrar «Notas»' }));

    expect(screen.getByRole('dialog', { name: 'Renombrar «Notas»' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(screen.getByLabelText('Nombre')).toHaveValue('Notas');
    // El botón vive dentro del `treeitem`: si su clic llegara al árbol, el nodo se seleccionaría.
    expect(useWorkspaceStore.getState().selectedId).toBeNull();
  });

  it('renombra el documento y el árbol muestra el título nuevo', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });
    const api = stubApi({
      'PATCH /api/workspace/documents/doc-ideas': () =>
        jsonResponse(
          documentSummary({ id: 'doc-ideas', title: 'Ocurrencias', directoryId: 'dir-notas' }),
        ),
      'GET /api/workspace/tree': () =>
        jsonResponse(
          workspaceTree({
            directories: [directoryNode({ id: 'dir-notas', name: 'Notas' })],
            documents: [
              documentSummary({ id: 'doc-ideas', title: 'Ocurrencias', directoryId: 'dir-notas' }),
            ],
          }),
        ),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Renombrar «Ideas»' }));
    await userEvent.clear(screen.getByLabelText('Título'));
    await userEvent.type(screen.getByLabelText('Título'), 'Ocurrencias');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar el nombre' }));

    expect(api.callsTo('PATCH /api/workspace/documents/doc-ideas')[0]?.body).toEqual({
      title: 'Ocurrencias',
    });
    expect(await screen.findByRole('treeitem', { name: 'Ocurrencias' })).toBeInTheDocument();
  });

  it('muestra un 409 en un role="alert" que recibe el foco y deja el árbol intacto', async () => {
    await seedTree();
    const api = stubApi({
      'PATCH /api/workspace/directories/dir-notas': () =>
        apiErrorResponse(409, 'Ya existe un directorio con ese nombre', {
          code: 'DIRECTORY_NAME_TAKEN',
        }),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Renombrar «Notas»' }));
    await userEvent.clear(screen.getByLabelText('Nombre'));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Proyectos');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar el nombre' }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Ya existe un directorio con ese nombre');
    expect(alert).toHaveFocus();
    expect(screen.getByRole('treeitem', { name: 'Notas' })).toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'Proyectos' })).toBeInTheDocument();
    expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(0);
  });
});

describe('WorkspaceTreeView — borrar (AC-29)', () => {
  it('pide confirmación y borra un nodo vacío sin recursive', async () => {
    await seedTree();
    const api = stubApi({
      'DELETE /api/workspace/directories/dir-proyectos?recursive=false': () => noContentResponse(),
      'GET /api/workspace/tree': () =>
        jsonResponse(
          workspaceTree({ directories: [directoryNode({ id: 'dir-notas', name: 'Notas' })] }),
        ),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Borrar «Proyectos»' }));

    expect(screen.getByRole('dialog', { name: 'Borrar «Proyectos»' })).toHaveTextContent(
      'Esta carpeta está vacía y se borra ahora. No vuelve.',
    );
    // Sin campo de confirmación: no hay nada dentro que perder, así que no se cobra la fricción.
    expect(screen.queryByLabelText(/escribe borrar/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Borrar la carpeta' }));

    await waitFor(() => {
      expect(screen.queryByRole('treeitem', { name: 'Proyectos' })).not.toBeInTheDocument();
    });
    expect(
      api.callsTo('DELETE /api/workspace/directories/dir-proyectos?recursive=false'),
    ).toHaveLength(1);
  });

  it('avisa de que se borrará el contenido y solo entonces manda recursive=true', async () => {
    await seedTree();
    const api = stubApi({
      'DELETE /api/workspace/directories/dir-notas?recursive=true': () => noContentResponse(),
      'GET /api/workspace/tree': () =>
        jsonResponse(
          workspaceTree({
            directories: [directoryNode({ id: 'dir-proyectos', name: 'Proyectos' })],
          }),
        ),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Borrar «Notas»' }));

    // «Notas» tiene dentro «Diario» (carpeta), «Ideas» y «Lunes» (documentos): 3 dentro, 4 borrados
    // contando la propia carpeta. Los dos números son distintos y los dos se dicen — la cadena de la
    // fase 0 solo escribía el 3 y dejaba el 4 sin aparecer en ninguna parte.
    const dialogo = screen.getByRole('dialog', { name: 'Borrar «Notas» y lo que hay dentro' });

    expect(dialogo).toHaveTextContent(
      'Dentro hay 3 elementos: 1 carpeta y 2 documentos. Se borran los 4 y no vuelven.',
    );

    // Y la acción está cerrada hasta que se teclea la palabra: el borrado es definitivo y grande.
    const confirmar = screen.getByRole('button', { name: 'Borrar 4 elementos' });

    expect(confirmar).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Escribe borrar para confirmarlo.'), 'borrar');
    await userEvent.click(confirmar);

    await waitFor(() => {
      expect(screen.queryByRole('treeitem', { name: 'Notas' })).not.toBeInTheDocument();
    });
    expect(api.callsTo('DELETE /api/workspace/directories/dir-notas?recursive=true')).toHaveLength(
      1,
    );
    expect(api.calls.filter((call) => call.method === 'DELETE')).toHaveLength(1);
  });

  it('cancelar cierra el diálogo sin llamar a la red y devuelve el foco al botón', async () => {
    await seedTree();
    const api = stubApi({});

    renderTree();
    const trigger = screen.getByRole('button', { name: 'Borrar «Notas»' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(api.calls).toHaveLength(0);
  });

  it('deshabilita los botones del diálogo mientras la petición está en vuelo', async () => {
    await seedTree();
    const pending = deferredResponse();
    stubApi({
      'DELETE /api/workspace/directories/dir-proyectos?recursive=false': () => pending.response,
      'GET /api/workspace/tree': () => jsonResponse(workspaceTree()),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Borrar «Proyectos»' }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar la carpeta' }));

    expect(screen.getByRole('button', { name: 'Borrar la carpeta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    pending.resolveWith(noContentResponse());
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
  });

  it('saca de la ruta del documento abierto cuando ese documento se borra', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });
    stubApi({
      'DELETE /api/workspace/documents/doc-ideas': () => noContentResponse(),
      'GET /api/workspace/tree': () =>
        jsonResponse(
          workspaceTree({ directories: [directoryNode({ id: 'dir-notas', name: 'Notas' })] }),
        ),
    });

    const route = renderTreeAt('/documents/doc-ideas');
    await userEvent.click(screen.getByRole('button', { name: 'Borrar «Ideas»' }));
    // «Ideas» es un documento: su confirmación no pide teclear nada, y el botón lo nombra.
    await userEvent.click(screen.getByRole('button', { name: 'Borrar el documento' }));

    await waitFor(() => {
      expect(route.pathname()).toBe('/');
    });
  });
});

describe('WorkspaceTreeView — diálogos (AC-29)', () => {
  it('atrapa el foco dentro del diálogo y lo devuelve al disparador al cerrarlo', async () => {
    await seedTree();

    renderTree();
    const trigger = screen.getByRole('button', { name: 'Renombrar «Notas»' });
    await userEvent.click(trigger);

    expect(screen.getByLabelText('Nombre')).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Guardar el nombre' })).toHaveFocus();

    // El foco no se escapa por el final: vuelve al primer control del diálogo.
    await userEvent.tab();
    expect(screen.getByLabelText('Nombre')).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Guardar el nombre' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
