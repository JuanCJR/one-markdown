/**
 * Dominio puro del contenido de un documento (`plan.md` §7 de la spec 003, decisión 4).
 *
 * Este módulo **no importa nada** de Nest, de Prisma ni de HTTP: es una función de texto a número, y
 * su test no monta infraestructura. Sigue el precedente de `workspace-name.ts` y `tree-graph.ts`.
 */

/**
 * Tamaño en **bytes UTF-8** de lo que se va a guardar en la columna `content`.
 *
 * Es deliberadamente distinto de `content.length`, y esa diferencia es el motivo de que la función
 * exista con nombre propio en vez de repetir la expresión en cada camino de escritura:
 *
 * - `content.length` cuenta **unidades de código UTF-16**, no caracteres ni bytes. `'ñ'` es una unidad
 *   y dos bytes; `'🙂'` (U+1F642, fuera del plano básico) son **dos** unidades por su par suplente,
 *   **un** punto de código y **cuatro** bytes: ahí `.length` no acierta ninguna de las dos magnitudes.
 * - El `@MaxLength` del DTO de entrada mide **caracteres** (`MAX_DOCUMENT_CONTENT_CHARS`), así que un
 *   documento en el límite puede ocupar varias veces esa cifra en bytes. Las dos medidas conviven a
 *   propósito: una acota lo que la persona escribe, esta describe lo que ocupa.
 *
 * No normaliza nada: ni recorta extremos, ni convierte `CRLF` en `LF`, ni aplica normalización
 * Unicode. El markdown se guarda byte a byte como se escribió (dos espacios al final de una línea son
 * un salto de línea), así que el tamaño tiene que corresponder con lo guardado y no con una versión
 * saneada de ello.
 *
 * `contentBytes` es una columna **derivada**: la escriben tanto el alta del documento como el guardado
 * de contenido. Que las dos pasen por aquí es lo que impide que un camino se olvide de recalcularla y
 * rompa el invariante en silencio (riesgo #2 de la spec 002).
 *
 * @param content Contenido del documento, tal cual llega. La cadena vacía es válida y vale `0`.
 * @returns Número de bytes que ocupa `content` codificado en UTF-8.
 */
export function contentBytesOf(content: string): number {
  return Buffer.byteLength(content, 'utf8');
}
