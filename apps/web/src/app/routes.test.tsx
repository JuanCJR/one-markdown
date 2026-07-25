import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from './routes';
import { useAuthStore } from '../features/auth/auth.store';
import { authUser } from '../test/auth-fixtures';

function renderAt(path: string): void {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('Enrutado (AC-10)', () => {
  // Desde la spec 001 estas rutas están detrás de `RequireAuth`: sin sesión redirigen a `/login`.
  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser(),
      accessToken: 'access-token-1',
    });
  });

  it('muestra el estado vacío del workspace en /', () => {
    renderAt('/');

    expect(screen.getByText(/ningún documento/i)).toBeInTheDocument();
  });

  it('muestra la vista 404 en una ruta desconocida', () => {
    renderAt('/ruta-que-no-existe');

    expect(screen.getByText(/404/)).toBeInTheDocument();
  });

  it('mantiene el shell montado en la vista 404', () => {
    renderAt('/ruta-que-no-existe');

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('ofrece una vuelta al inicio desde el 404', () => {
    renderAt('/ruta-que-no-existe');

    expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/');
  });
});
