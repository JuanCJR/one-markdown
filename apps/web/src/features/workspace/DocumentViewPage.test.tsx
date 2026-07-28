import type { MarkdownDocument, WorkspaceTree } from '@one-markdown/shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentViewPage } from './DocumentViewPage';
import { useWorkspaceStore } from './workspace.store';
import { routes } from '../../app/routes';
import { useUiStore } from '../../shared/store/ui.store';
import {
  apiErrorResponse,
  deferredResponse,
  jsonResponse,
  stubApi,
  type ApiStub,
  type StubHandler,
} from '../../test/api-stub';
import { authUser } from '../../test/auth-fixtures';
import {
  directoryNode,
  documentSummary,
  markdownDocument,
  workspaceTree,
} from '../../test/workspace-fixtures';
import { useAuthStore } from '../auth/auth.store';

/**
 * Árbol de prueba de la vista de documento (AC-31). Lo mínimo para tener una ruta de dos niveles
 * («Notas» › «Diario» › «Lunes») y un documento colgando de la raíz, que son los dos `breadcrumb`
 * distintos que la vista tiene que saber pintar.
 */
function sampleTree(): WorkspaceTree {
  return workspaceTree({
    directories: [
      directoryNode({ id: 'dir-notas', name: 'Notas' }),
      directoryNode({ id: 'dir-diario', name: 'Diario', parentId: 'dir-notas', depth: 1 }),
    ],
    documents: [
      documentSummary({ id: 'doc-raiz', title: 'En la raíz', directoryId: null }),
      documentSummary({ id: 'doc-lunes', title: 'Lunes', directoryId: 'dir-diario' }),
    ],
  });
}

/** El documento «Lunes» tal como lo devuelve `GET /api/workspace/documents/doc-lunes`. */
function lunes(content = '# Título en markdown\n\nTexto **en negrita**\n'): MarkdownDocument {
  return markdownDocument({
    id: 'doc-lunes',
    title: 'Lunes',
    directoryId: 'dir-diario',
    content,
  });
}

function treeRoute(): Record<string, StubHandler> {
  return { 'GET /api/workspace/tree': () => jsonResponse(sampleTree()) };
}

/** Deja el árbol en el store por el camino real (petición + normalización) y retira la red. */
async function seedTree(): Promise<void> {
  stubApi(treeRoute());
  await useWorkspaceStore.getState().loadTree();
  vi.unstubAllGlobals();
}

type TestRouter = ReturnType<typeof createMemoryRouter>;

/** La vista sola, montada en su ruta, como cuando ya se navegó a ella. */
function renderView(id: string): TestRouter {
  const router = createMemoryRouter([{ path: '/documents/:id', Component: DocumentViewPage }], {
    initialEntries: [`/documents/${id}`],
  });

  render(<RouterProvider router={router} />);

  return router;
}

/** La aplicación entera desde la raíz, para activar un documento en el árbol de verdad. */
function renderApp(): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(<RouterProvider router={router} />);

  return router;
}

beforeEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
  useUiStore.setState({ sidebarCollapsed: false });
  useAuthStore.setState({
    status: 'authenticated',
    user: authUser(),
    accessToken: 'access-token-1',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DocumentViewPage — activar un documento del árbol (AC-31)', () => {
  it('navega a /documents/:id al hacer clic en un documento', async () => {
    stubApi({
      ...treeRoute(),
      'GET /api/workspace/documents/doc-raiz': () =>
        jsonResponse(markdownDocument({ id: 'doc-raiz', title: 'En la raíz' })),
    });

    const router = renderApp();
    await userEvent.click(await screen.findByRole('treeitem', { name: 'En la raíz' }));

    expect(router.state.location.pathname).toBe('/documents/doc-raiz');
    expect(
      await screen.findByRole('heading', { name: 'En la raíz', level: 2 }),
    ).toBeInTheDocument();
  });

  it('navega a /documents/:id al activar un documento con Enter', async () => {
    stubApi({
      ...treeRoute(),
      'GET /api/workspace/documents/doc-raiz': () =>
        jsonResponse(markdownDocument({ id: 'doc-raiz', title: 'En la raíz' })),
    });

    const router = renderApp();
    await screen.findByRole('treeitem', { name: 'En la raíz' });

    // Primera parada: el botón de plegar la barra lateral. Segunda: el nodo tabulable del árbol.
    await userEvent.tab();
    await userEvent.tab();

    expect(screen.getByRole('treeitem', { name: 'Notas' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(router.state.location.pathname).toBe('/documents/doc-raiz');
  });

  it('no navega al activar un directorio', async () => {
    stubApi(treeRoute());

    const router = renderApp();
    await userEvent.click(await screen.findByRole('treeitem', { name: 'Notas' }));

    expect(router.state.location.pathname).toBe('/');
  });
});

describe('DocumentViewPage — contenido del documento (AC-31)', () => {
  it('pide el detalle y muestra el título en un encabezado', async () => {
    await seedTree();
    const api = stubApi({ 'GET /api/workspace/documents/doc-lunes': () => jsonResponse(lunes()) });

    renderView('doc-lunes');

    expect(await screen.findByRole('heading', { name: 'Lunes' })).toBeInTheDocument();
    expect(api.callsTo('GET /api/workspace/documents/doc-lunes')).toHaveLength(1);
  });

  it('muestra la ruta del documento dentro del árbol', async () => {
    await seedTree();
    stubApi({ 'GET /api/workspace/documents/doc-lunes': () => jsonResponse(lunes()) });

    renderView('doc-lunes');
    await screen.findByRole('heading', { name: 'Lunes' });

    const path = screen.getByRole('navigation', { name: /ruta del documento/i });
    const steps = screen.getAllByRole('listitem');

    expect(path).toBeInTheDocument();
    expect(steps.map((step) => step.textContent)).toEqual(['Notas', 'Diario', 'Lunes']);
  });

  it('muestra solo el título en la ruta cuando el documento cuelga de la raíz', async () => {
    await seedTree();
    stubApi({
      'GET /api/workspace/documents/doc-raiz': () =>
        jsonResponse(markdownDocument({ id: 'doc-raiz', title: 'En la raíz' })),
    });

    renderView('doc-raiz');
    await screen.findByRole('heading', { name: 'En la raíz' });

    expect(screen.getAllByRole('listitem').map((step) => step.textContent)).toEqual(['En la raíz']);
  });

  it('muestra el markdown en crudo, literal y sin renderizarlo como HTML', async () => {
    await seedTree();
    stubApi({ 'GET /api/workspace/documents/doc-lunes': () => jsonResponse(lunes()) });

    renderView('doc-lunes');
    await screen.findByRole('heading', { name: 'Lunes' });

    const raw = screen.getByRole('region', { name: /markdown en crudo/i });

    // El AC pide un `<pre>`: el markdown se ve tal cual, con sus saltos de línea y sus marcas.
    expect(raw.tagName).toBe('PRE');
    expect(raw.textContent).toBe('# Título en markdown\n\nTexto **en negrita**\n');
    expect(screen.queryByRole('heading', { name: /título en markdown/i })).not.toBeInTheDocument();
    expect(raw.querySelector('strong')).toBeNull();
  });

  it('vuelve a cargar al pasar a otro documento sin desmontar la vista', async () => {
    await seedTree();
    const pending = deferredResponse();
    stubApi({
      'GET /api/workspace/documents/doc-lunes': () => jsonResponse(lunes()),
      'GET /api/workspace/documents/doc-raiz': () => pending.response,
    });

    const router = renderView('doc-lunes');
    await screen.findByRole('heading', { name: 'Lunes' });

    await act(async () => {
      await router.navigate('/documents/doc-raiz');
    });

    expect(screen.getByText(/cargando el documento/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lunes' })).not.toBeInTheDocument();

    pending.resolveWith(jsonResponse(markdownDocument({ id: 'doc-raiz', title: 'En la raíz' })));

    expect(await screen.findByRole('heading', { name: 'En la raíz' })).toBeInTheDocument();
  });

  it('anuncia que está cargando mientras la petición está en vuelo', async () => {
    await seedTree();
    const pending = deferredResponse();
    stubApi({ 'GET /api/workspace/documents/doc-lunes': () => pending.response });

    renderView('doc-lunes');

    expect(screen.getByText(/cargando el documento/i)).toBeInTheDocument();

    pending.resolveWith(jsonResponse(lunes()));

    expect(await screen.findByRole('heading', { name: 'Lunes' })).toBeInTheDocument();
    expect(screen.queryByText(/cargando el documento/i)).not.toBeInTheDocument();
  });
});

describe('DocumentViewPage — el documento ya no está (AC-31)', () => {
  function stubMissingDocument(): ApiStub {
    return stubApi({
      ...treeRoute(),
      'GET /api/workspace/documents/doc-lunes': () =>
        apiErrorResponse(404, 'El documento no existe'),
    });
  }

  it('dice que el documento ya no existe cuando el servidor responde 404', async () => {
    await seedTree();
    stubMissingDocument();

    renderView('doc-lunes');

    expect(await screen.findByRole('alert')).toHaveTextContent(/este documento ya no existe/i);
    expect(screen.queryByRole('region', { name: /markdown en crudo/i })).not.toBeInTheDocument();
  });

  it('recarga el árbol tras un 404, porque el que tiene el cliente ya era mentira', async () => {
    await seedTree();
    const api = stubMissingDocument();

    renderView('doc-lunes');
    await screen.findByRole('alert');

    expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(1);
  });

  it('anuncia el resto de errores del servidor sin recargar el árbol', async () => {
    await seedTree();
    const api = stubApi({
      ...treeRoute(),
      'GET /api/workspace/documents/doc-lunes': () =>
        apiErrorResponse(500, 'El servidor no pudo responder'),
    });

    renderView('doc-lunes');

    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no pudo responder');
    expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(0);
  });
});
