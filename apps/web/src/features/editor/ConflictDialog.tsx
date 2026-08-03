import {
  DialogActions,
  ModalDialog,
  DIALOG_PRIMARY_CLASS,
  DIALOG_SECONDARY_CLASS,
} from '../workspace/ModalDialog';

/**
 * Las dos resoluciones de un conflicto de versión (AC-20).
 *
 * Reutiliza el `ModalDialog` de la spec `002` en vez de escribir otro: `role="dialog"`,
 * `aria-modal`, foco atrapado dentro y devuelto al cerrar ya están resueltos y probados ahí. Este
 * archivo solo aporta el texto y las dos acciones.
 *
 * Los botones se llaman por lo que hacen —«Conservar mi versión» / «Descartar mis cambios»— y
 * nunca «Sí»/«No»: quien los oye fuera de contexto tiene que poder decidir, porque una de las dos
 * opciones tira trabajo a la basura.
 *
 * Cerrar sin elegir **no** es una tercera resolución: no toca el borrador ni el servidor, deja el
 * conflicto en pie y el aviso de guardado ofrece volver aquí.
 */

export interface ConflictDialogProps {
  /** Relee la versión vigente y reenvía el borrador local. */
  readonly onKeepMine: () => void;
  /** Adopta el texto del servidor. No emite ningún `PUT`. */
  readonly onTakeServer: () => void;
  readonly onDismiss: () => void;
  readonly busy: boolean;
}

export function ConflictDialog({
  onKeepMine,
  onTakeServer,
  onDismiss,
  busy,
}: ConflictDialogProps): React.JSX.Element {
  return (
    <ModalDialog title="El documento cambió mientras lo editabas" onDismiss={onDismiss}>
      <p className="text-sm text-tinta-secundaria">
        Alguien guardó una versión distinta de este documento —otra pestaña, otro dispositivo—
        después de que tú empezaras a escribir. Tus cambios siguen aquí; elige con cuál te quedas.
      </p>

      <DialogActions>
        <button
          type="button"
          onClick={onTakeServer}
          disabled={busy}
          className={DIALOG_SECONDARY_CLASS}
        >
          Descartar mis cambios
        </button>

        <button
          type="button"
          data-autofocus
          onClick={onKeepMine}
          disabled={busy}
          className={DIALOG_PRIMARY_CLASS}
        >
          Conservar mi versión
        </button>
      </DialogActions>
    </ModalDialog>
  );
}
