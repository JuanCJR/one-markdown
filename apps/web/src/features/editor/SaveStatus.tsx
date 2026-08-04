import type { SaveStatus as SaveStatusValue } from './editor.store';
import { EDITOR, estadoDeGuardado, horaDeGuardado } from '../../shared/textos/textos';

/**
 * Estado del guardado, en **dos** regiones vivas distintas y no en una (AC-19, AC-22).
 *
 * `role="status"` es educado (`aria-live="polite"`): «Guardando» y «Guardado 14:32» pasan cada pocos
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
 *
 * **Seis estados, seis frases** (fase 6, §4.9). Hasta aquí había cuatro rótulos para seis estados:
 * los tres fallos compartían «Sin guardar», así que la región educada decía exactamente lo mismo
 * tanto si el servidor no contestaba como si el documento había cambiado por debajo. Quien la oye
 * por un lector de pantalla **no tiene el aviso de al lado delante**: la región es todo lo que
 * recibe, y tres cosas distintas anunciadas igual son una sola cosa. El mapa de estado a frase vive
 * en `shared/textos/textos.ts` y no aquí, para que la voz esté en un sitio.
 */

export interface SaveStatusProps {
  readonly status: SaveStatusValue;
  /** En `rejected` es el mensaje del servidor; en `unreachable`, el nuestro. */
  readonly error: string | null;
  /** Cuándo se confirmó el último guardado, o `null` si no ha habido ninguno en esta sesión. */
  readonly savedAt: number | null;
  /** Solo se ofrece cuando hay un conflicto y su diálogo no está a la vista. */
  readonly onResolveConflict?: (() => void) | undefined;
}

export function SaveStatus({
  status,
  error,
  savedAt,
  onResolveConflict,
}: SaveStatusProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <p role="status" aria-label={EDITOR.regionGuardado} className="text-tinta-tenue">
        {estadoDeGuardado(status, savedAt === null ? null : horaDeGuardado(savedAt))}
      </p>

      {error === null ? null : (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 bg-tinta px-3 py-1 text-sup-base"
        >
          <span>{error}</span>

          {onResolveConflict === undefined ? null : (
            <button
              type="button"
              onClick={onResolveConflict}
              className=" px-1 font-medium text-sup-base underline outline-none focus-visible:foco-cromo"
            >
              {EDITOR.resolverConflicto}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
