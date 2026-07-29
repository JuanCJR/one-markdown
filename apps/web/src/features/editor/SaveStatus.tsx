import type { SaveStatus as SaveStatusValue } from './editor.store';

/**
 * Estado del guardado, en **dos** regiones vivas distintas y no en una (AC-19, AC-22).
 *
 * `role="status"` es educado (`aria-live="polite"`): «Guardando…» y «Guardado» pasan cada pocos
 * segundos mientras la persona escribe y no pueden interrumpir a un lector de pantalla.
 * `role="alert"` es urgente: significa que lo que hay en pantalla **no está en el servidor**, y ahí
 * sí hay que interrumpir. Unificarlas en un nodo las anunciaría con la misma urgencia, y esa
 * distinción es la mitad del AC — es también, en pequeño, el riesgo #15 de la spec `002`: un aviso
 * único presenta igual cosas que piden acciones distintas.
 *
 * El `role="status"` lleva **nombre accesible** (`004`: AC-27). No es cosmética: la página del editor
 * tiene desde la `004` una segunda región viva —la de la paleta— y la `005` traerá otra con la vista
 * dividida. Una región viva sin nombre no es identificable en la lista de regiones de un lector de
 * pantalla, y tampoco lo es para quien la consulta desde un test. El `role="alert"` no lo lleva: es
 * único en la página y su contenido **es** el mensaje.
 */

const LABELS: Readonly<Record<SaveStatusValue, string>> = {
  clean: 'Guardado',
  dirty: 'Cambios sin guardar',
  saving: 'Guardando…',
  // Los tres fallos dicen lo mismo en la región educada —que no está guardado— porque el **qué**
  // pasó y el **qué hacer** viven en la alerta, con el mensaje que corresponda a cada rama.
  conflict: 'Sin guardar',
  rejected: 'Sin guardar',
  unreachable: 'Sin guardar',
};

export interface SaveStatusProps {
  readonly status: SaveStatusValue;
  /** En `rejected` es el mensaje del servidor; en `unreachable`, el nuestro. */
  readonly error: string | null;
  /** Solo se ofrece cuando hay un conflicto y su diálogo no está a la vista. */
  readonly onResolveConflict?: (() => void) | undefined;
}

export function SaveStatus({
  status,
  error,
  onResolveConflict,
}: SaveStatusProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <p role="status" aria-label="Estado del guardado" className="text-slate-500">
        {LABELS[status]}
      </p>

      {error === null ? null : (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-1 text-red-800"
        >
          <span>{error}</span>

          {onResolveConflict === undefined ? null : (
            <button
              type="button"
              onClick={onResolveConflict}
              className="rounded px-1 font-medium text-red-900 underline outline-none focus-visible:ring-2 focus-visible:ring-red-700/50"
            >
              Resolver el conflicto
            </button>
          )}
        </div>
      )}
    </div>
  );
}
