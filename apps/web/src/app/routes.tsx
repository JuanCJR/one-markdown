import type { RouteObject } from 'react-router';

import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { SecurityPage } from '../features/auth/SecurityPage';

/**
 * Se exporta el array de rutas (y no un router ya construido) para que los tests puedan montarlo
 * con `createMemoryRouter` sin depender del historial del navegador.
 *
 * `/login` y `/register` viven fuera del `AppShell` (layout propio, centrado y sin navegación);
 * todo lo demás cuelga de una ruta sin `path` cuyo componente es `RequireAuth`.
 */
export const routes: RouteObject[] = [
  { path: '/login', Component: LoginPage },
  { path: '/register', Component: RegisterPage },
  {
    Component: RequireAuth,
    children: [
      // Fuera del `AppShell` a propósito: tiene su propio `h1` y el shell ya aporta uno.
      { path: '/settings/security', Component: SecurityPage },
      {
        path: '/',
        Component: AppShell,
        children: [
          { index: true, Component: WorkspaceEmptyState },
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
];
