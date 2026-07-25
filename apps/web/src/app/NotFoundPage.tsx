import { Link } from 'react-router';

/** Se renderiza dentro del shell a propósito: perder la navegación en un 404 desorienta. */
export function NotFoundPage(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-prose text-slate-600">
      <h2 className="mb-2 text-base font-medium text-slate-900">404 — página no encontrada</h2>
      <p className="mb-4">La ruta que intentaste abrir no existe.</p>
      <Link to="/" className="text-blue-700 underline hover:text-blue-900">
        Volver al inicio
      </Link>
    </section>
  );
}
