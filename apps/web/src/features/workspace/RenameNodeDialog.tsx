import { useId, useState } from 'react';

import { nameLabelOf } from './CreateNodeForm';
import {
  DialogActions,
  DIALOG_PRIMARY_CLASS,
  DIALOG_SECONDARY_CLASS,
  ModalDialog,
} from './ModalDialog';
import type { TreeNode } from './tree-nodes';

/**
 * Renombra un directorio o un documento (AC-29). El campo llega **precargado** con el nombre
 * actual: renombrar casi siempre es retocar, no escribir de cero.
 */

interface RenameNodeDialogProps {
  readonly node: TreeNode;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onRename: (name: string) => void;
}

export function RenameNodeDialog({
  node,
  pending,
  onCancel,
  onRename,
}: RenameNodeDialogProps): React.JSX.Element {
  const [name, setName] = useState(node.name);
  const fieldId = useId();

  return (
    <ModalDialog title={`Renombrar «${node.name}»`} onDismiss={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onRename(name);
        }}
      >
        <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-tinta">
          {nameLabelOf(node.kind)}
        </label>

        <input
          id={fieldId}
          data-autofocus
          type="text"
          value={name}
          required
          disabled={pending}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value);
          }}
          className="block min-h-10 w-full border border-hair-control bg-sup-base px-3 py-2 text-sm outline-none focus:border-tinta"
        />

        <DialogActions>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={DIALOG_SECONDARY_CLASS}
          >
            Cancelar
          </button>

          <button type="submit" disabled={pending} className={DIALOG_PRIMARY_CLASS}>
            Guardar
          </button>
        </DialogActions>
      </form>
    </ModalDialog>
  );
}
