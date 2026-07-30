import { MAX_DOCUMENT_CONTENT_CHARS } from '@one-markdown/shared';

/**
 * Constantes del editor (plan `003` §3).
 *
 * El límite de caracteres **no** se escribe aquí: se deriva del de `@one-markdown/shared`, que
 * espeja el de `apps/api/src/workspace/workspace.constants.ts`. Dos literales iguales en dos
 * paquetes es exactamente cómo divergen los límites, y aquí la divergencia se notaría como un `400`
 * inexplicable después de que la interfaz hubiera ofrecido sitio de sobra.
 */

/**
 * Espera desde la última pulsación hasta el guardado automático.
 *
 * Lo bastante larga para que una frase escrita de corrido sea **un** guardado; lo bastante corta
 * para que lo que se pierde en un cierre forzado sea despreciable (riesgo #7 de la spec). Con el
 * debounce y la coalescencia de AC-17 el techo de un editor son ~30 peticiones/min, contra un cupo
 * de 120 del throttler `documentContent`.
 */
export const AUTOSAVE_DEBOUNCE_MS = 1_500;

/**
 * A partir de cuántos caracteres se enseña el contador de los que quedan (AC-30). Permanente sería
 * ruido en el 99,9 % de los documentos, así que aparece solo al acercarse al límite.
 */
export const CONTENT_COUNTER_THRESHOLD = Math.floor(MAX_DOCUMENT_CONTENT_CHARS * 0.9);

/**
 * Ventana de inactividad que agrupa el tecleo en **un** paso de deshacer (spec `006`, AC-3, AC-4).
 *
 * **No se deriva de `AUTOSAVE_DEBOUNCE_MS` y no debe igualársele**, aunque los dos midan pausas al
 * escribir: este es **granularidad de historial** y aquel es **tráfico de red**. Atarlos haría que
 * ajustar la política de peticiones cambiara en silencio qué significa `Ctrl`+`Z`, y al revés.
 *
 * Lo que sí está atado es la **relación**, y AC-10 la afirma: que el de historial sea el más corto es
 * lo que hace que un paso de deshacer sea siempre ≤ lo que se pierde en un cierre forzado. El número
 * en sí es una convención, no una medida.
 */
export const UNDO_GROUP_MS = 500;

/**
 * Cuánto historial puede acumular un documento, **en caracteres** (spec `006`, AC-7).
 *
 * Se lee: «el historial de un documento nunca cuesta más que **una copia más** del documento más
 * grande que se admite». Con las dos copias que la entrada ya guarda —lo guardado y el borrador—, el
 * peor caso por pestaña son tres.
 *
 * **En caracteres y no en número de pasos**, que era lo que la `004` §9.3 proponía: como una
 * transacción guarda el reemplazo mínimo y no dos copias del texto, un paso puede medir 1 carácter o
 * 400.000. Contar pasos sería contar una unidad que no tiene tamaño, y el mismo número describiría
 * dos mundos separados por cuatro órdenes de magnitud (`006/spec.md` §2.1).
 *
 * Derivado y no escrito, por el mismo motivo que el límite de arriba: dos literales iguales en dos
 * sitios es cómo divergen los límites.
 */
export const UNDO_HISTORY_BUDGET_CHARS = MAX_DOCUMENT_CONTENT_CHARS;

/**
 * Único código de dominio al que el editor reacciona con una rama de interfaz propia en vez de con
 * el aviso genérico: lo devuelve el `409` de `PUT /api/workspace/documents/:id/content`.
 */
export const DOCUMENT_CONTENT_CONFLICT_CODE = 'DOCUMENT_CONTENT_CONFLICT';

/**
 * Mensaje de la rama `unreachable`, y tiene que ser **distinto** de cualquiera que mande el
 * servidor (AC-19). Es la respuesta al riesgo #15 de la spec `002`: allí un aviso genérico
 * presentaba igual un fallo del cliente y uno del servidor, y eso escondió un defecto real hasta
 * que alguien instrumentó. Si esta cadena acaba coincidiendo con la de un rechazo, el editor
 * repite aquel error.
 */
export const UNREACHABLE_SAVE_MESSAGE =
  'No se pudo contactar con el servidor. Tus cambios siguen aquí; se reintentarán cuando sigas escribiendo.';
