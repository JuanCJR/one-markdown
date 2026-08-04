import {
  DialogActions,
  ModalDialog,
  DIALOG_PRIMARY_PROPS,
  DIALOG_SECONDARY_CLASS,
} from '../workspace/ModalDialog';
import { CONFLICTO } from '../../shared/textos/textos';

/**
 * Las dos resoluciones de un conflicto de versión (AC-20).
 *
 * Reutiliza el `ModalDialog` de la spec `002` en vez de escribir otro: `role="dialog"`,
 * `aria-modal`, foco atrapado dentro y devuelto al cerrar ya están resueltos y probados ahí. Este
 * archivo solo aporta el texto y las dos acciones.
 *
 * Los botones se llaman por lo que hacen —«Conservar mi versión» / «Descartar lo que escribí»— y
 * nunca «Sí»/«No»: quien los oye fuera de contexto tiene que poder decidir, porque una de las dos
 * opciones tira trabajo a la basura.
 *
 * **Y en el cuerpo ya no hay «alguien».** En este producto no hay nadie más —cada documento es de
 * una sola persona, y el backend filtra por el `userId` del token—, así que «alguien guardó una
 * versión distinta» describía una intrusión que no ha ocurrido. Lo que ha ocurrido es que fue ella
 * misma, desde otra pestaña o desde otro dispositivo, y eso es lo que dice ahora.
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
    <ModalDialog title={CONFLICTO.titulo} onDismiss={onDismiss}>
      <p className="text-sm text-tinta-secundaria">{CONFLICTO.cuerpo}</p>

      <DialogActions>
        <button
          type="button"
          onClick={onTakeServer}
          disabled={busy}
          className={DIALOG_SECONDARY_CLASS}
        >
          {CONFLICTO.descartar}
        </button>

        <button
          type="button"
          data-autofocus
          onClick={onKeepMine}
          disabled={busy}
          {...DIALOG_PRIMARY_PROPS}
        >
          {CONFLICTO.conservar}
        </button>
      </DialogActions>
    </ModalDialog>
  );
}
