import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';

import { routes } from './routes';

function renderAt(path: string): void {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('Enrutado (AC-10)', () => {
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
