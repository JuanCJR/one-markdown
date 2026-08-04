import { useId, useState } from 'react';

import {
  DialogActions,
  DIALOG_DANGER_CLASS,
  DIALOG_SECONDARY_CLASS,
  ModalDialog,
} from './ModalDialog';
import type { TreeNode } from './tree-nodes';
import { contenidoDeCarpeta, DIALOGOS } from '../../shared/textos/textos';

/**
 * Confirmación de borrado (AC-29). El borrado es real y no hay papelera (`spec.md` §7, riesgo 5).
 *
 * **Tres diálogos, no uno con un párrafo condicional**, porque las tres cosas que se pueden borrar
 * pesan distinto y desde la fase 6 el diálogo lo dice desde el título:
 *
 * | Qué                   | Título                           | Fricción             |
 * | --------------------- | -------------------------------- | -------------------- |
 * | Un documento          | `Borrar «X»`                     | ninguna              |
 * | Una carpeta vacía     | `Borrar «X»`                     | ninguna              |
 * | Una carpeta con algo  | `Borrar «X» y lo que hay dentro` | teclear «borrar»     |
 *
 * La fase 0 ponía los tres casos en el mismo diálogo y escondía lo que de verdad importaba —que se
 * lleva por delante el contenido— en la **tercera** línea, detrás de un «¿Seguro que quieres…?» que
 * no aporta ningún dato. Ahora el dato va primero y la pregunta desaparece: el diálogo ya es la
 * pregunta.
 *
 * **La fricción es proporcional y temporal.** Teclear una palabra es caro y solo se cobra donde el
 * error es irreversible y grande. El día que exista la papelera el borrado deja de ser definitivo y
 * el campo se retira — está escrito en la fase 6 y en `docs/design/06-marca.md` §4.
 */

interface ConfirmDeleteDialogProps {
  readonly node: TreeNode;
  /** Nodos que caerían con él, él no incluido. `0` en un documento o un directorio vacío. */
  readonly contentCount: number;
  /** El reparto por tipo de esos nodos, que es lo que el aviso nombra. */
  readonly directoryCount: number;
  readonly documentCount: number;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Lo tecleado vale si es la palabra pedida, sin distinguir caja ni espacios de más. */
function confirmacionValida(escrito: string): boolean {
  return escrito.trim().toLowerCase() === DIALOGOS.borrar.palabraConfirmacion;
}

export function ConfirmDeleteDialog({
  node,
  contentCount,
  directoryCount,
  documentCount,
  pending,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps): React.JSX.Element {
  const [escrito, setEscrito] = useState('');
  const campoId = useId();

  const esCarpeta = node.kind === 'directory';
  const conContenido = esCarpeta && contentCount > 0;

  const titulo = !esCarpeta
    ? DIALOGOS.borrar.tituloDocumento(node.name)
    : conContenido
      ? DIALOGOS.borrar.tituloCarpeta(node.name)
      : DIALOGOS.borrar.tituloCarpetaVacia(node.name);

  const cuerpo = !esCarpeta
    ? DIALOGOS.borrar.cuerpoDocumento
    : conContenido
      ? contenidoDeCarpeta(directoryCount, documentCount)
      : DIALOGOS.borrar.cuerpoCarpetaVacia;

  const rotuloConfirmar = !esCarpeta
    ? DIALOGOS.borrar.enviarDocumento
    : conContenido
      ? DIALOGOS.borrar.enviarCarpeta(contentCount + 1)
      : DIALOGOS.borrar.enviarCarpetaVacia;

  const bloqueado = pending || (conContenido && !confirmacionValida(escrito));

  return (
    <ModalDialog title={titulo} onDismiss={onCancel}>
      <p className="text-sm text-tinta-secundaria">{cuerpo}</p>

      {!conContenido ? null : (
        <div className="mt-4">
          <label htmlFor={campoId} className="mb-1 block text-sm font-medium text-tinta">
            {DIALOGOS.borrar.confirmacion}
          </label>

          {/*
            Sin borde y sobre el escalón hundido, con el eje a la izquierda: es un campo que se ve
            porque cambia el papel, no porque lo rodee una línea (`03-direccion.md` R1).

            `data-autofocus` lo trae el foco al abrirse, y no al botón de cancelar, porque escribir
            es lo único que se puede hacer aquí. `Escape` sigue cerrando sin borrar nada.
          */}
          <input
            id={campoId}
            data-autofocus
            type="text"
            value={escrito}
            disabled={pending}
            autoComplete="off"
            onChange={(event) => {
              setEscrito(event.target.value);
            }}
            className="block min-h-10 w-full border-0 border-l-4 border-l-tinta bg-sup-hundida px-3 py-2 text-sm text-tinta outline-solid outline-0 focus-visible:foco-cromo"
          />
        </div>
      )}

      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={DIALOG_SECONDARY_CLASS}
        >
          {DIALOGOS.cancelar}
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={bloqueado}
          className={DIALOG_DANGER_CLASS}
        >
          {rotuloConfirmar}
        </button>
      </DialogActions>
    </ModalDialog>
  );
}
