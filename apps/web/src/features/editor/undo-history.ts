/**
 * La pila de deshacer/rehacer de **un** documento (`006/plan.md` §4.3).
 *
 * Es política de historial y nada más: qué cuenta como un paso, cuándo dos pulsaciones son el mismo
 * paso, y cuánto historial se puede acumular antes de tirar lo más viejo. No sabe nada de la interfaz,
 * del estado de la aplicación ni del navegador — y eso lo vigila una guarda que lee este archivo
 * (`markdown-palette.test.ts`, AC-9).
 *
 * **Una pila por documento, nunca global.** Este módulo no tiene ni idea de que existan varias: recibe
 * un historial y devuelve otro. Quien las tiene una por entrada es el store, y de ahí sale por
 * construcción que deshacer no pueda tocar el trabajo de otra pestaña (AC-15).
 *
 * **El reloj entra como argumento.** `recordWrite` recibe el instante en vez de leerlo, así que estos
 * casos no necesitan temporizadores falsos y la agrupación se comprueba pasando dos números. Quien
 * lee el reloj es el store, en un solo sitio.
 */

import { UNDO_GROUP_MS, UNDO_HISTORY_BUDGET_CHARS } from './editor.constants';
import { applyEdit, diffEdit, editCost, invertEdit, type TextEdit } from './text-edit';

/** Dónde está el cursor, o qué hay seleccionado. */
export interface Caret {
  readonly start: number;
  readonly end: number;
}

/**
 * Un paso de deshacer: el reemplazo, y dónde estaba el cursor a cada lado.
 *
 * Guardar la selección en **los dos extremos** es lo que hace que deshacer devuelva el cursor a donde
 * estaba. Un deshacer que restaura el texto pero deja el cursor al final repite, en pequeño, el mismo
 * defecto que esta spec arregla.
 *
 * **No hay campo `kind`**, al contrario de lo que proponía `004/spec.md` §9.3: solo hace falta saber
 * si la escritura **nueva** puede fundirse, y eso lo dice quien llama, en el momento. Una vez cerrada,
 * a la transacción le da igual de dónde vino, y guardarlo sería guardar un dato que nadie lee.
 */
export interface UndoTransaction {
  readonly edit: TextEdit;
  readonly before: Caret;
  readonly after: Caret;
}

export interface UndoState {
  /** Lo que se puede deshacer. El último es el siguiente en caer. */
  readonly past: readonly UndoTransaction[];
  /** Lo que se puede rehacer. El último es el siguiente en volver. */
  readonly future: readonly UndoTransaction[];
  /** Coste acumulado de `past` **y** `future`, en caracteres. Es lo que la cota mira. */
  readonly cost: number;
  /**
   * Instante de la última pulsación del grupo de tecleo abierto, o `null` si no hay ninguno.
   *
   * Vive **aquí dentro** y no en un diccionario al lado del store, a propósito: los que hay allí no
   * los limpia ningún arranque de caso, así que un caso que deja algo colgado hace fallar al
   * siguiente. Un dato que decide si dos pulsaciones son el mismo paso no tiene por qué estar fuera
   * del estado.
   */
  readonly openedAt: number | null;
}

/** Lo que hace falta saber de una escritura para registrarla. */
export interface RecordedWrite {
  readonly before: string;
  readonly after: string;
  /** `true` para el tecleo; `false` para un gesto único, como insertar de la paleta. */
  readonly mergeable: boolean;
  readonly now: number;
  /**
   * Dónde estaba el cursor antes. Se deriva del reemplazo si falta.
   *
   * Admite `undefined` explícito y no solo la ausencia de la propiedad: con
   * `exactOptionalPropertyTypes`, quien reenvía un valor que puede faltar tendría que hacerlo con un
   * *spread* condicional, y eso convierte cada llamada en tres líneas de ceremonia.
   */
  readonly caretBefore?: Caret | undefined;
  /** Dónde queda después. Se deriva del reemplazo si falta. */
  readonly caretAfter?: Caret | undefined;
}

/** El resultado de deshacer o de rehacer: el historial nuevo, el texto, y dónde va el cursor. */
export interface HistoryStep {
  readonly history: UndoState;
  readonly text: string;
  readonly caret: Caret;
}

export const EMPTY_HISTORY: UndoState = { past: [], future: [], cost: 0, openedAt: null };

/** Deja la pila vacía. La usa la resolución de un conflicto, que sustituye el contenido entero. */
export function clearHistory(): UndoState {
  return EMPTY_HISTORY;
}

/**
 * Registra una escritura, funda si toca y recorta si se pasa del presupuesto.
 *
 * El orden de las reglas importa y es este: una escritura que no cambia nada no es un paso · rehacer
 * se descarta siempre · se funde con el grupo abierto solo si la escritura lo permite y cae dentro de
 * la ventana · y al final se recorta por el extremo antiguo.
 */
export function recordWrite(history: UndoState, write: RecordedWrite): UndoState {
  const { before, after, mergeable, now } = write;

  // Escribir lo mismo no es un paso de deshacer. El store ya sale antes en este caso, pero este módulo
  // no depende de que lo haga.
  if (before === after) {
    return history;
  }

  const edit = diffEdit(before, after);
  const caretBefore = write.caretBefore ?? collapsedAt(edit.at + edit.removed.length);
  const caretAfter = write.caretAfter ?? collapsedAt(edit.at + edit.inserted.length);

  const past = withinOpenGroup(history, mergeable, now)
    ? mergeIntoOpenGroup(history.past, before, after, caretAfter)
    : [...history.past, { edit, before: caretBefore, after: caretAfter }];

  // `future` se descarta **siempre** (AC-6): rehacer algo que ya no sigue de lo que hay en pantalla
  // sería devolver un texto que la persona no puede reconocer.
  return evictOldest({
    past,
    future: [],
    cost: totalCost(past, []),
    openedAt: mergeable ? now : null,
  });
}

/** El paso anterior aplicado, o `null` si no hay ninguno. */
export function undoStep(history: UndoState, text: string): HistoryStep | null {
  const top = history.past[history.past.length - 1];

  if (top === undefined) {
    return null;
  }

  const past = history.past.slice(0, -1);
  const future = [...history.future, top];

  return {
    // `openedAt` en `null`: lo que se teclee después empieza paso nuevo aunque caiga dentro de la
    // ventana. Sin esto, la pulsación siguiente se fundiría con una transacción que ya estaba cerrada.
    history: { past, future, cost: totalCost(past, future), openedAt: null },
    text: applyEdit(text, invertEdit(top.edit)),
    caret: top.before,
  };
}

/** El último paso deshecho, devuelto, o `null` si no hay ninguno. */
export function redoStep(history: UndoState, text: string): HistoryStep | null {
  const top = history.future[history.future.length - 1];

  if (top === undefined) {
    return null;
  }

  const past = [...history.past, top];
  const future = history.future.slice(0, -1);

  return {
    history: { past, future, cost: totalCost(past, future), openedAt: null },
    text: applyEdit(text, top.edit),
    caret: top.after,
  };
}

function collapsedAt(position: number): Caret {
  return { start: position, end: position };
}

function withinOpenGroup(history: UndoState, mergeable: boolean, now: number): boolean {
  return (
    mergeable &&
    history.openedAt !== null &&
    now - history.openedAt < UNDO_GROUP_MS &&
    history.past.length > 0
  );
}

/**
 * Funde la escritura en el paso de arriba **recomponiendo el reemplazo desde el texto en que empezó el
 * grupo**, que no se guarda en ninguna parte: se reconstruye deshaciendo el reemplazo de arriba sobre
 * el texto de antes de esta escritura.
 *
 * Guardar ese texto habría sido más directo y es justo lo que no se hace: sería una copia más del
 * contenido retenida mientras se teclea, que es el coste que la representación por reemplazos existe
 * para no pagar. Y el camino de reconstrucción **es el mismo que usa deshacer**, así que no hay una
 * segunda forma de calcular lo mismo que pueda discrepar de la primera.
 */
function mergeIntoOpenGroup(
  past: readonly UndoTransaction[],
  before: string,
  after: string,
  caretAfter: Caret,
): readonly UndoTransaction[] {
  const top = past[past.length - 1];

  if (top === undefined) {
    return past;
  }

  const groupStart = applyEdit(before, invertEdit(top.edit));
  const merged = diffEdit(groupStart, after);

  // Teclear hasta volver al texto en que empezó el grupo deja un paso que no cambia nada, y un paso que
  // no cambia nada no es un paso: se retira en vez de quedarse como un `Ctrl`+`Z` que no hace nada.
  if (editCost(merged) === 0) {
    return past.slice(0, -1);
  }

  return [...past.slice(0, -1), { edit: merged, before: top.before, after: caretAfter }];
}

/**
 * El coste **se recorre, no se lleva en un contador incremental**. Es la decisión menos vistosa del
 * módulo y la que evita una familia entera de defectos: un contador que se desincroniza de lo que
 * cuenta desaloja de más o de menos y no lo nota nadie. El recorrido es una suma sobre unos pocos
 * miles de enteros en el peor caso, y ocurre una vez por escritura.
 */
function totalCost(past: readonly UndoTransaction[], future: readonly UndoTransaction[]): number {
  return [...past, ...future].reduce((total, transaction) => total + editCost(transaction.edit), 0);
}

/**
 * Recorta por el extremo antiguo hasta volver por debajo del presupuesto.
 *
 * La condición `past.length > 1` **es** la excepción de AC-8, escrita como invariante y no como caso
 * especial: el paso más reciente no se desaloja nunca, aunque él solo pase del presupuesto. Sin ella,
 * seleccionar todo y pegar vaciaría la pila incluida la propia transacción de pegar, y `Ctrl`+`Z` no
 * desharía justo lo único que la persona acaba de hacer.
 */
function evictOldest(state: UndoState): UndoState {
  let past = state.past;
  let cost = totalCost(past, state.future);

  while (cost > UNDO_HISTORY_BUDGET_CHARS && past.length > 1) {
    past = past.slice(1);
    cost = totalCost(past, state.future);
  }

  return { ...state, past, cost };
}
