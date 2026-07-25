import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from './routes';
import { useUiStore } from '../shared/store/ui.store';

function renderAt(path: string): void {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('AppShell (AC-9)', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
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
