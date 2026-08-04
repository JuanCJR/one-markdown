import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from './auth.store';
import { routes } from '../../app/routes';
import { authUser } from '../../test/auth-fixtures';

type TestRouter = ReturnType<typeof createMemoryRouter>;

function renderAt(path: string): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

function authenticate(): void {
  useAuthStore.setState({
    status: 'authenticated',
    user: authUser(),
    accessToken: 'access-token-1',
  });
}

beforeEach(() => {
  useAuthStore.setState({
    status: 'unknown',
    user: null,
    accessToken: null,
    pendingMfa: null,
    error: null,
  });
});

describe('RequireAuth (AC-22)', () => {
  it('con el estado aún desconocido espera y NO redirige, para que el refresh silencioso llegue', () => {
    const router = renderAt('/documentos/uno');

    expect(screen.getByRole('status')).toHaveTextContent(/comprobando tu sesión/i);
    expect(router.state.location.pathname).toBe('/documentos/uno');
    expect(
      screen.queryByRole('heading', { name: /entrar en tu archivo/i }),
    ).not.toBeInTheDocument();
  });

  it('sin sesión, una ruta protegida redirige a /login', async () => {
    useAuthStore.setState({ status: 'anonymous' });

    const router = renderAt('/documentos/uno');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(
      screen.getByRole('heading', { level: 1, name: /entrar en tu archivo/i }),
    ).toBeInTheDocument();
  });

  it('al autenticarse aterriza en el destino que se pidió originalmente', async () => {
    useAuthStore.setState({ status: 'anonymous' });

    const router = renderAt('/documentos/uno');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });

    act(() => {
      authenticate();
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/documentos/uno');
    });
  });

  it('con sesión válida la ruta protegida renderiza el shell', () => {
    authenticate();

    renderAt('/');

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText(/ningún documento/i)).toBeInTheDocument();
  });

  it('al perder la sesión vuelve a /login sin quedarse en la vista protegida', async () => {
    authenticate();

    const router = renderAt('/');

    act(() => {
      useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });

  it('/login y /register son públicas: no esperan ni redirigen con el estado desconocido', () => {
    expect(renderAt('/login').state.location.pathname).toBe('/login');
    expect(
      screen.getByRole('heading', { level: 1, name: /entrar en tu archivo/i }),
    ).toBeInTheDocument();

    expect(renderAt('/register').state.location.pathname).toBe('/register');
    expect(
      screen.getByRole('heading', { level: 1, name: /crear (el archivo|tu archivo)/i }),
    ).toBeInTheDocument();
  });
});
