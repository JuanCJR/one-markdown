import { Link } from 'react-router';

import { NO_ENCONTRADO } from '../shared/textos/textos';
import { useTituloDePestana } from '../shared/textos/useTituloDePestana';

/**
 * Se renderiza dentro del shell a propósito: perder la navegación en un 404 desorienta.
 *
 * Desde la fase 6 el encabezado es un `h1` y no un `h2`: el shell dejó de aportar el suyo, así que
 * esta pantalla tiene que traer el nivel 1 o el documento se queda sin encabezado de primer nivel.
 * Y el número desaparece del texto: `404` es el código con el que hablan dos máquinas, y quien llega
 * aquí no ha escrito ninguna de las dos.
 */
export function NotFoundPage(): React.JSX.Element {
  useTituloDePestana(NO_ENCONTRADO.titulo);

  return (
    <section className="mx-auto max-w-prose text-tinta-secundaria">
      <h1 className="mb-4 text-base font-medium text-tinta">{NO_ENCONTRADO.titulo}</h1>

      <Link to="/" className="text-tinta underline hover:bg-tinta hover:text-sup-base">
        {NO_ENCONTRADO.volver}
      </Link>
    </section>
  );
}
