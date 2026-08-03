import { useId, useState } from 'react';

import {
  DialogActions,
  DIALOG_PRIMARY_CLASS,
  DIALOG_SECONDARY_CLASS,
  ModalDialog,
} from './ModalDialog';
import type { TreeNodeKind } from './tree-nodes';

/**
 * Alta de un directorio o de un documento dentro de un padre ya elegido (AC-29).
 *
 * El padre no se elige aquí: viene del botón que abrió el formulario («Nuevo en la raíz» o
 * «Nuevo en «Notas»»), así que el diálogo solo pregunta lo que falta. Lo que se envía es el nombre
 * tal cual lo escribió la persona: normalizar (espacios, NFC) es cosa del servidor, y hacerlo
 * también aquí sería una segunda regla que mantener sincronizada.
 */

interface CreateNodeFormProps {
  /** Nombre del directorio padre, o `null` para la raíz. */
  readonly parentName: string | null;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onCreate: (kind: TreeNodeKind, name: string) => void;
}

/** Directorios y documentos no llaman igual a lo mismo: un directorio tiene nombre; un documento, título. */
export function nameLabelOf(kind: TreeNodeKind): string {
  return kind === 'directory' ? 'Nombre' : 'Título';
}

export function CreateNodeForm({
  parentName,
  pending,
  onCancel,
  onCreate,
}: CreateNodeFormProps): React.JSX.Element {
  const [kind, setKind] = useState<TreeNodeKind>('directory');
  const [name, setName] = useState('');

  const fieldId = useId();
  const groupName = useId();
  const title = parentName === null ? 'Nuevo en la raíz' : `Nuevo en «${parentName}»`;

  return (
    <ModalDialog title={title} onDismiss={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(kind, name);
        }}
      >
        <fieldset className="mb-3" disabled={pending}>
          <legend className="mb-1 text-sm font-medium text-tinta">Tipo</legend>

          <div className="flex gap-4">
            {(['directory', 'document'] as const).map((option) => (
              <label
                key={option}
                className="flex items-center gap-1.5 text-sm text-tinta-secundaria"
              >
                <input
                  type="radio"
                  name={groupName}
                  value={option}
                  checked={kind === option}
                  onChange={() => {
                    setKind(option);
                  }}
                  className="size-4"
                />
                {option === 'directory' ? 'Directorio' : 'Documento'}
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-tinta">
          {nameLabelOf(kind)}
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
            Crear
          </button>
        </DialogActions>
      </form>
    </ModalDialog>
  );
}
