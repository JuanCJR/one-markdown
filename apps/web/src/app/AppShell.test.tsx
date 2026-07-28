import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from './routes';
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
