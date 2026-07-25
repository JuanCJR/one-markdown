import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { routes } from './app/routes';
import { useAuthStore } from './features/auth/auth.store';
import './index.css';

// Refresh silencioso antes de pintar: la cookie `HttpOnly` puede seguir viva de una visita
// anterior. Mientras no responda, `RequireAuth` muestra el estado de carga en vez de redirigir.
void useAuthStore.getState().bootstrap();

const container = document.getElementById('root');

if (container === null) {
  throw new Error('No se encontró el elemento #root en index.html');
}

const router = createBrowserRouter(routes);

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
