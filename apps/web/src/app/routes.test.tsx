import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from './routes';
import { useAuthStore } from '../features/auth/auth.store';
import { useWorkspaceStore } from '../features/workspace/workspace.store';
import { jsonResponse, stubApi } from '../test/api-stub';
import { authUser } from '../test/auth-fixtures';
import { markdownDocument, workspaceTree } from '../test/workspace-fixtures';

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
    // Desde la spec 002 el shell monta el árbol, que pide su contenido al montarse.
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
    stubApi({ 'GET /api/workspace/tree': () => jsonResponse(workspaceTree()) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('invita a elegir un documento en el estado vacío del workspace', () => {
    renderAt('/');

    expect(screen.getByText(/selecciona un documento/i)).toBeInTheDocument();
  });

  it('monta la vista de documento dentro del shell en /documents/:id (AC-31)', async () => {
    stubApi({
      'GET /api/workspace/tree': () => jsonResponse(workspaceTree()),
      'GET /api/workspace/documents/doc-diario': () => jsonResponse(markdownDocument()),
    });

    renderAt('/documents/doc-diario');

    expect(await screen.findByRole('heading', { name: 'Diario', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.queryByText(/404/)).not.toBeInTheDocument();
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
