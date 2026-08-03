import {
  DialogActions,
  DIALOG_DANGER_CLASS,
  DIALOG_SECONDARY_CLASS,
  ModalDialog,
} from './ModalDialog';
import type { TreeNode } from './tree-nodes';

/**
 * Confirmación de borrado (AC-29). El borrado es real y no hay papelera (`spec.md` §7, riesgo 5),
 * así que el diálogo dice **qué** se pierde: cuando el directorio tiene contenido, lo nombra y lo
 * cuenta, y solo entonces la petición sale con `recursive=true`.
 */

interface ConfirmDeleteDialogProps {
  readonly node: TreeNode;
  /** Nodos que caerían con él, él no incluido. `0` en un documento o un directorio vacío. */
  readonly contentCount: number;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  node,
  contentCount,
  pending,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps): React.JSX.Element {
  return (
    <ModalDialog title={`Borrar «${node.name}»`} onDismiss={onCancel}>
      <p className="text-sm text-tinta-secundaria">¿Seguro que quieres borrar «{node.name}»?</p>

      {contentCount === 0 ? null : (
        <p className="mt-2 text-sm font-medium text-sup-base">
          También se borrará su contenido: {contentCount}{' '}
          {contentCount === 1 ? 'elemento' : 'elementos'}.
        </p>
      )}

      <p className="mt-2 text-sm text-tinta-tenue">Esta acción no se puede deshacer.</p>

      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={DIALOG_SECONDARY_CLASS}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={DIALOG_DANGER_CLASS}
        >
          Borrar
        </button>
      </DialogActions>
    </ModalDialog>
  );
}
