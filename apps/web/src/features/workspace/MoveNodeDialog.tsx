import { useId, useMemo, useState } from 'react';

import {
  DialogActions,
  DIALOG_PRIMARY_CLASS,
  DIALOG_SECONDARY_CLASS,
  ModalDialog,
} from './ModalDialog';
import { collectDescendantDirectoryIds, listDirectoryPaths, type TreeNode } from './tree-nodes';
import { useWorkspaceStore } from './workspace.store';

/**
 * Mueve un directorio o un documento a otro punto del árbol (AC-30).
 *
 * El selector no ofrece ni el propio directorio ni ninguno de sus descendientes, con la **misma**
 * regla que aplica el servidor. Es una cortesía, no una garantía: quien decide sigue siendo el
 * backend (`409 MOVE_INTO_DESCENDANT`), porque entre que se pintó este árbol y llega la petición la
 * jerarquía puede haber cambiado desde otra pestaña. Por eso un movimiento rechazado recarga.
 *
 * Los destinos salen del store y **no** de `buildVisibleTree`: aquella solo devuelve lo desplegado,
 * y un directorio plegado sigue siendo un destino perfectamente válido.
 */

/** Valor de la opción «Raíz». Cadena vacía porque `<option value={null}>` no existe. */
const ROOT_VALUE = '';

interface MoveNodeDialogProps {
  readonly node: TreeNode;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onMove: (destinationId: string | null) => void;
}

export function MoveNodeDialog({
  node,
  pending,
  onCancel,
  onMove,
}: MoveNodeDialogProps): React.JSX.Element {
  const directoriesById = useWorkspaceStore((state) => state.directoriesById);
  const childDirectoryIds = useWorkspaceStore((state) => state.childDirectoryIds);

  const destinations = useMemo(() => {
    const all = listDirectoryPaths({ directoriesById, childDirectoryIds });

    if (node.kind !== 'directory') {
      return all;
    }

    const forbidden = new Set([
      node.id,
      ...collectDescendantDirectoryIds({ childDirectoryIds }, node.id),
    ]);

    return all.filter((option) => !forbidden.has(option.id));
  }, [directoriesById, childDirectoryIds, node]);

  const [destinationId, setDestinationId] = useState(() =>
    destinations.some((option) => option.id === node.parentId)
      ? (node.parentId ?? ROOT_VALUE)
      : ROOT_VALUE,
  );

  const fieldId = useId();

  return (
    <ModalDialog title={`Mover «${node.name}»`} onDismiss={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onMove(destinationId === ROOT_VALUE ? null : destinationId);
        }}
      >
        <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-tinta">
          Destino
        </label>

        <select
          id={fieldId}
          data-autofocus
          value={destinationId}
          disabled={pending}
          onChange={(event) => {
            setDestinationId(event.target.value);
          }}
          className="block min-h-10 w-full border border-hair-control bg-sup-base px-2 py-2 text-sm outline-none focus:border-tinta"
        >
          <option value={ROOT_VALUE}>Raíz</option>

          {destinations.map((option) => (
            <option key={option.id} value={option.id}>
              {option.path}
            </option>
          ))}
        </select>

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
            Mover
          </button>
        </DialogActions>
      </form>
    </ModalDialog>
  );
}
