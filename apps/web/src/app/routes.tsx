import type { RouteObject } from 'react-router';

import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

/**
 * Se exporta el array de rutas (y no un router ya construido) para que los tests puedan montarlo
 * con `createMemoryRouter` sin depender del historial del navegador.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: WorkspaceEmptyState },
      { path: '*', Component: NotFoundPage },
    ],
  },
];
