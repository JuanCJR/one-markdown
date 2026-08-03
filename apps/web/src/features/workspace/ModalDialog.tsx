import { useEffect, useId, useRef } from 'react';

/**
 * Caparazón común de los diálogos del árbol (AC-29): capa modal, `role="dialog"` con
 * `aria-modal`, nombre accesible tomado del título, foco atrapado dentro y devuelto al elemento que
 * lo abrió al cerrarse.
 *
 * Está escrito a mano y no con `<dialog showModal()>` a propósito: `jsdom` no implementa el modo
 * modal del elemento nativo, así que la mitad del comportamiento que hay que garantizar no se
 * podría probar. Tampoco entra ninguna librería de foco atrapado (`plan.md` §1: la spec no instala
 * dependencias).
 */

interface ModalDialogProps {
  /** Se pinta como encabezado y es el nombre accesible del diálogo. */
  readonly title: string;
  /** Cerrar sin confirmar: `Escape` y el botón de cancelar de cada diálogo. */
  readonly onDismiss: () => void;
  readonly children: React.ReactNode;
}

/**
 * Orden de tabulación dentro del diálogo. Los deshabilitados quedan fuera porque el navegador
 * tampoco los visita, y así el ciclo no se queda atascado en un botón que no responde.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableItems(container: HTMLElement | null): readonly HTMLElement[] {
  return container === null ? [] : [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}

export function ModalDialog({ title, onDismiss, children }: ModalDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // El disparador se captura aquí y no en quien abre el diálogo: al montarse, el foco sigue en el
  // botón que se acaba de pulsar. Devolverlo al desmontar es lo que evita que el foco caiga al
  // `<body>` y haya que volver a tabular desde el principio.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = focusableItems(dialogRef.current);
    const preferred = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]');

    (preferred ?? items[0])?.focus();

    return () => {
      opener?.focus();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      onDismiss();

      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const items = focusableItems(dialogRef.current);

    if (items.length === 0) {
      return;
    }

    const index = items.findIndex((item) => item === document.activeElement);
    const step = event.shiftKey ? -1 : 1;
    const next =
      index === -1
        ? items[event.shiftKey ? items.length - 1 : 0]
        : items[(index + step + items.length) % items.length];

    event.preventDefault();
    next?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-sm border border-hair-zona bg-sup-superpuesta p-4 text-tinta"
      >
        <h2 id={titleId} className="mb-3 text-base font-semibold">
          {title}
        </h2>

        {children}
      </div>
    </div>
  );
}

/** Clases compartidas por los botones de los diálogos, para que los tres se vean igual. */
export const DIALOG_BUTTON_CLASS =
  'min-h-9 px-3 py-1 text-sm font-medium outline-solid outline-0 focus-visible:foco-cromo disabled:cursor-not-allowed disabled:opacity-50';

export const DIALOG_SECONDARY_CLASS = `${DIALOG_BUTTON_CLASS} border border-hair-control text-tinta-secundaria hover:bg-tinta hover:text-sup-base`;

/**
 * La acción primaria es la única masa cromo de un diálogo, y va como **props** y no como cadena de
 * clases a propósito: el presupuesto de acento (`docs/design/04-color.md` §8) exige que todo lo que
 * use cromo de fondo lleve `data-cromo`, y una constante que solo trajera el `className` haría
 * trivial olvidarlo en el sexto sitio. Aquí no se pueden separar.
 */
export const DIALOG_PRIMARY_PROPS = {
  className: `${DIALOG_BUTTON_CLASS} bg-cromo font-black text-sobre-cromo hover:bg-tinta hover:text-sup-base`,
  'data-cromo': 'primaria',
} as const;

export const DIALOG_DANGER_CLASS = `${DIALOG_BUTTON_CLASS} bg-tinta text-sup-base hover:bg-sup-base hover:text-tinta`;

/** Fila de acciones: cancelar primero, para que la acción destructiva no sea la parada fácil. */
export function DialogActions({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}
