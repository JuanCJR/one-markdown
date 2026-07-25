import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from './routes';
import { useAuthStore } from '../features/auth/auth.store';
import { useUiStore } from '../shared/store/ui.store';
import { noContentResponse, stubApi } from '../test/api-stub';
import { authUser } from '../test/auth-fixtures';

type TestRouter = ReturnType<typeof createMemoryRouter>;

function renderAt(path: string): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

describe('AppShell (AC-9)', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
    // El shell vive detrás de `RequireAuth` desde la spec 001.
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser(),
      accessToken: 'access-token-1',
    });
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
    stubApi({});
    renderAt('/');

    expect(screen.getByRole('link', { name: /seguridad/i })).toHaveAttribute(
      'href',
      '/settings/security',
    );
  });

  it('identifica la cuenta con la que se entró', () => {
    stubApi({});
    renderAt('/');

    expect(screen.getByText('ada@example.test')).toBeInTheDocument();
  });

  it('permite cerrar sesión y vuelve a /login', async () => {
    const api = stubApi({ 'POST /api/auth/logout': () => noContentResponse() });
    const router = renderAt('/');

    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(api.callsTo('POST /api/auth/logout')).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
