import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from './routes';
import { EDITOR_PANEL_ID } from '../features/editor/DocumentTabs';
import { useEditorStore } from '../features/editor/editor.store';
import { useAuthStore } from '../features/auth/auth.store';
import { useWorkspaceStore } from '../features/workspace/workspace.store';
import { useUiStore } from '../shared/store/ui.store';
import { jsonResponse, noContentResponse, stubApi, type StubHandler } from '../test/api-stub';
import { authUser } from '../test/auth-fixtures';
import { workspaceTree } from '../test/workspace-fixtures';

type TestRouter = ReturnType<typeof createMemoryRouter>;

/**
 * Desde la spec 002 la barra lateral monta el árbol, que pide su contenido al montarse: sin esta
 * ruta cualquier test del shell provocaría una llamada de red no simulada.
 */
function workspaceRoutes(): Record<string, StubHandler> {
  return { 'GET /api/workspace/tree': () => jsonResponse(workspaceTree()) };
}

function renderAt(path: string): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

describe('AppShell (AC-9)', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
    stubApi(workspaceRoutes());
    // El shell vive detrás de `RequireAuth` desde la spec 001.
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser(),
      accessToken: 'access-token-1',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('monta el árbol de documentos en la barra lateral', async () => {
    renderAt('/');

    expect(await screen.findByRole('tree', { name: /documentos/i })).toBeInTheDocument();
  });

  it('renderiza los landmarks de navegación y contenido principal', () => {
    renderAt('/');

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('tiene un único h1', () => {
    renderAt('/');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('expone el toggle del sidebar como botón con aria-expanded', async () => {
    renderAt('/');

    const toggle = screen.getByRole('button', { name: /barra lateral/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });
});

describe('AppShell — sesión (AC-22)', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser(),
      accessToken: 'access-token-1',
      pendingMfa: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lleva a la configuración de seguridad de la cuenta', () => {
    stubApi(workspaceRoutes());
    renderAt('/');

    expect(screen.getByRole('link', { name: /seguridad/i })).toHaveAttribute(
      'href',
      '/settings/security',
    );
  });

  it('identifica la cuenta con la que se entró', () => {
    stubApi(workspaceRoutes());
    renderAt('/');

    expect(screen.getByText('ada@example.test')).toBeInTheDocument();
  });

  it('permite cerrar sesión y vuelve a /login', async () => {
    const api = stubApi({
      ...workspaceRoutes(),
      'POST /api/auth/logout': () => noContentResponse(),
    });
    const router = renderAt('/');

    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(api.callsTo('POST /api/auth/logout')).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

/**
 * La tira de pestañas en el shell (spec `005`, `T-007`).
 *
 * Vive aquí y no en `DocumentEditorPage` porque tiene que **sobrevivir** al documento que muestra:
 * se ve mientras uno carga, se ve con la ruta en `/` si quedan pestañas, y no debe desmontarse y
 * remontarse en cada salto —lo que perdería el foco y dispararía su región viva—.
 */
describe('AppShell — tira de pestañas (spec 005)', () => {
  // El mismo andamiaje que el `describe` de arriba: el shell vive detrás de `RequireAuth` desde la
  // spec `001`, y sin sesión `renderAt` pinta la página de entrada en vez del shell.
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
    useEditorStore.setState(useEditorStore.getInitialState(), true);
    stubApi(workspaceRoutes());
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser(),
      accessToken: 'access-token-1',
    });
  });

  afterEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true);
    vi.unstubAllGlobals();
  });

  it('no pinta ninguna tira cuando no hay pestañas abiertas', () => {
    renderAt('/');

    expect(screen.queryByRole('tablist', { name: 'Documentos abiertos' })).not.toBeInTheDocument();
  });

  it('pinta la tira con las pestañas abiertas, aunque la ruta no sea un documento', () => {
    useEditorStore.setState({ openIds: ['doc-uno', 'doc-dos'] });

    renderAt('/');

    // Con la ruta en `/` no hay ningún documento activo, y la tira **sigue ahí**: es lo que la
    // distingue de pintarla dentro de la página del editor.
    expect(screen.getByRole('tablist', { name: 'Documentos abiertos' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('el <main> lleva el id al que apuntan las pestañas con aria-controls', () => {
    useEditorStore.setState({ openIds: ['doc-uno'] });

    renderAt('/');

    // El `id` sale de la constante que exporta `DocumentTabs`, no de un literal repetido: dos
    // literales iguales en dos archivos es exactamente cómo se rompe un `aria-controls` en silencio.
    expect(screen.getByRole('main')).toHaveAttribute('id', EDITOR_PANEL_ID);
    expect(screen.getByRole('tab')).toHaveAttribute('aria-controls', EDITOR_PANEL_ID);
  });

  it('la tira no añade un segundo landmark de navegación', () => {
    useEditorStore.setState({ openIds: ['doc-uno'] });

    renderAt('/');

    // Decisión A: la tira es un `tablist`, no un `<nav>`. Si algún día se convirtiera en navegación,
    // este caso —y las consultas sin nombre de `routes.test.tsx`— caerían, que es lo que se quiere.
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
