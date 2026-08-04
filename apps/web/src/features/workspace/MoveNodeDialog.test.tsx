import type { WorkspaceTree } from '@one-markdown/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceTreeView } from './WorkspaceTreeView';
import { useWorkspaceStore, type WorkspaceState } from './workspace.store';
import { configureAuthBridge } from '../../shared/api/http';
import { apiErrorResponse, jsonResponse, stubApi } from '../../test/api-stub';
import { directoryNode, documentSummary, workspaceTree } from '../../test/workspace-fixtures';

/**
 * Mover un nodo desde la interfaz (AC-30).
 *
 * El diálogo se abre desde la fila del árbol, así que los casos se escriben como los vive la
 * persona: pulsar «Mover «Notas»», elegir destino y aceptar. El filtrado del subárbol se comprueba
 * por lo que el selector **ofrece**, no llamando a la función que lo calcula.
 *
 *   Notas            (dir, raíz)
 *     Diario         (dir, nivel 2)
 *       Lunes        (doc, nivel 3)
 *     Ideas          (doc, nivel 2)
 *   Proyectos        (dir vacío, raíz)
 *   En la raíz       (doc, raíz)
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

async function seedTree(uiState: Partial<WorkspaceState> = {}): Promise<void> {
  stubApi({ 'GET /api/workspace/tree': () => jsonResponse(sampleTree()) });
  await useWorkspaceStore.getState().loadTree();
  vi.unstubAllGlobals();

  useWorkspaceStore.setState(uiState);
}

function renderTree(): void {
  render(<WorkspaceTreeView />, { wrapper: MemoryRouter });
}

/** Los textos de las opciones del selector de destino, en el orden en que se ofrecen. */
function destinationOptions(): string[] {
  return screen
    .getAllByRole('option')
    .map((option) => option.textContent ?? '')
    .filter((text) => text !== '');
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

describe('MoveNodeDialog — destinos ofrecidos (AC-30)', () => {
  it('excluye el propio directorio y todos sus descendientes, aunque estén plegados', async () => {
    await seedTree();

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Mover «Notas»' }));

    expect(screen.getByRole('dialog', { name: 'Mover «Notas»' })).toBeInTheDocument();
    expect(destinationOptions()).toEqual(['Raíz', 'Proyectos']);
    expect(screen.queryByRole('option', { name: 'Notas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Notas / Diario' })).not.toBeInTheDocument();
  });

  it('ofrece la raíz y todos los directorios al mover un documento', async () => {
    await seedTree();

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Mover «En la raíz»' }));

    expect(destinationOptions()).toEqual(['Raíz', 'Notas', 'Notas / Diario', 'Proyectos']);
  });

  it('llega con el destino actual ya elegido', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Mover «Diario»' }));

    expect(screen.getByLabelText('Destino')).toHaveValue('dir-notas');
  });
});

describe('MoveNodeDialog — mover (AC-30)', () => {
  it('mueve el directorio al destino elegido', async () => {
    await seedTree();
    const api = stubApi({
      'POST /api/workspace/directories/dir-notas/move': () =>
        jsonResponse(
          directoryNode({ id: 'dir-notas', name: 'Notas', parentId: 'dir-proyectos', depth: 1 }),
        ),
      'GET /api/workspace/tree': () => jsonResponse(sampleTree()),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Mover «Notas»' }));
    await userEvent.selectOptions(screen.getByLabelText('Destino'), 'dir-proyectos');
    await userEvent.click(screen.getByRole('button', { name: 'Mover ahí' }));

    expect(api.callsTo('POST /api/workspace/directories/dir-notas/move')[0]?.body).toEqual({
      parentId: 'dir-proyectos',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('mueve el documento a la raíz con directoryId nulo', async () => {
    await seedTree({ expandedIds: new Set(['dir-notas']) });
    const api = stubApi({
      'POST /api/workspace/documents/doc-ideas/move': () =>
        jsonResponse(documentSummary({ id: 'doc-ideas', title: 'Ideas', directoryId: null })),
      'GET /api/workspace/tree': () => jsonResponse(sampleTree()),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Mover «Ideas»' }));
    await userEvent.selectOptions(screen.getByLabelText('Destino'), 'Raíz');
    await userEvent.click(screen.getByRole('button', { name: 'Mover ahí' }));

    expect(api.callsTo('POST /api/workspace/documents/doc-ideas/move')[0]?.body).toEqual({
      directoryId: null,
    });
  });
});

describe('MoveNodeDialog — el servidor es la autoridad (AC-30)', () => {
  it('muestra un 409 MOVE_INTO_DESCENDANT en el aviso y recarga el árbol', async () => {
    await seedTree();
    const api = stubApi({
      'POST /api/workspace/directories/dir-notas/move': () =>
        apiErrorResponse(409, 'Un directorio no puede moverse dentro de sí mismo', {
          code: 'MOVE_INTO_DESCENDANT',
        }),
      'GET /api/workspace/tree': () => jsonResponse(sampleTree()),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Mover «Notas»' }));
    await userEvent.selectOptions(screen.getByLabelText('Destino'), 'dir-proyectos');
    await userEvent.click(screen.getByRole('button', { name: 'Mover ahí' }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Un directorio no puede moverse dentro de sí mismo');
    expect(alert).toHaveFocus();
    expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(1);
  });

  it('muestra un 404 en el aviso y recarga el árbol, que ya no era cierto', async () => {
    await seedTree();
    const api = stubApi({
      'POST /api/workspace/directories/dir-notas/move': () =>
        apiErrorResponse(404, 'El directorio no existe', { code: 'DIRECTORY_NOT_FOUND' }),
      'GET /api/workspace/tree': () =>
        jsonResponse(
          workspaceTree({
            directories: [directoryNode({ id: 'dir-proyectos', name: 'Proyectos' })],
          }),
        ),
    });

    renderTree();
    await userEvent.click(screen.getByRole('button', { name: 'Mover «Notas»' }));
    await userEvent.selectOptions(screen.getByLabelText('Destino'), 'dir-proyectos');
    await userEvent.click(screen.getByRole('button', { name: 'Mover ahí' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El directorio no existe');
    expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(1);
    expect(screen.queryByRole('treeitem', { name: 'Notas' })).not.toBeInTheDocument();
  });
});
