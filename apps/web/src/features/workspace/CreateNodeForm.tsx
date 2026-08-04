import { useId, useState } from 'react';

import {
  DialogActions,
  DIALOG_PRIMARY_PROPS,
  DIALOG_SECONDARY_CLASS,
  ModalDialog,
} from './ModalDialog';
import type { TreeNodeKind } from './tree-nodes';
import { DIALOGOS } from '../../shared/textos/textos';

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
  return DIALOGOS.etiquetaNombre(kind === 'directory');
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
  const title =
    parentName === null ? DIALOGOS.crear.tituloRaiz : DIALOGOS.crear.tituloEn(parentName);

  return (
    <ModalDialog title={title} onDismiss={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(kind, name);
        }}
      >
        <fieldset className="mb-3" disabled={pending}>
          <legend className="mb-1 text-sm font-medium text-tinta">{DIALOGOS.crear.tipo}</legend>

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
                {/*
                  «Carpeta», no «Directorio». Un directorio es una palabra del sistema de ficheros,
                  y aquí no hay sistema de ficheros: hay una base de datos y una persona que guarda
                  cosas. El **valor** sigue siendo `directory` porque eso sí es el contrato del API.
                */}
                {option === 'directory' ? DIALOGOS.crear.carpeta : DIALOGOS.crear.documento}
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
            {DIALOGOS.cancelar}
          </button>

          {/* El botón dice qué se va a crear: sin eso hay que mirar arriba antes de pulsarlo. */}
          <button type="submit" disabled={pending} {...DIALOG_PRIMARY_PROPS}>
            {kind === 'directory' ? DIALOGOS.crear.enviarCarpeta : DIALOGOS.crear.enviarDocumento}
          </button>
        </DialogActions>
      </form>
    </ModalDialog>
  );
}
