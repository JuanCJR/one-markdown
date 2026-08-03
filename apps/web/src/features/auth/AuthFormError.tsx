import { useEffect, useRef } from 'react';

interface AuthFormErrorProps {
  readonly message: string | null;
}

/**
 * Error de formulario en un `role="alert"` que además **recibe el foco**.
 *
 * El `role` hace que el lector de pantalla lo anuncie; mover el foco es lo que garantiza que quien
 * navega con teclado o con lupa lo encuentre sin recorrer la página buscándolo. `focus:` en vez de
 * `focus-visible:` a propósito: el foco aquí es programático y tiene que verse igual.
 */
export function AuthFormError({ message }: AuthFormErrorProps): React.JSX.Element | null {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message !== null) {
      container.current?.focus();
    }
  }, [message]);

  if (message === null) {
    return null;
  }

  return (
    <div
      ref={container}
      role="alert"
      tabIndex={-1}
      className="mb-4 bg-tinta px-3 py-2 text-sm text-sup-base outline-none focus-visible:foco-cromo"
    >
      {message}
    </div>
  );
}
