import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuthStore } from './auth.store';
import { ERRORES } from '../../shared/textos/textos';

/**
 * Puerta de las rutas protegidas (AC-22).
 *
 * Mientras el estado es `unknown` (o hay una autenticación en vuelo) **espera y no redirige**: el
 * refresh silencioso del arranque tarda una petición en resolverse, y redirigir antes mandaría a
 * `/login` a alguien con sesión válida en cada recarga de página.
 */
export function RequireAuth(): React.JSX.Element {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'unknown' || status === 'authenticating') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sup-elevada">
        <p role="status" className="text-sm text-tinta-secundaria">
          {ERRORES.comprobandoSesion}
        </p>
      </main>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return <Outlet />;
}
