import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MAX_DOCUMENT_CONTENT_CHARS } from '@one-markdown/shared';
import { describe, expect, it } from 'vitest';

import { AUTOSAVE_DEBOUNCE_MS, UNDO_GROUP_MS, UNDO_HISTORY_BUDGET_CHARS } from './editor.constants';
import { editCost } from './text-edit';
import {
  clearHistory,
  EMPTY_HISTORY,
  recordWrite,
  redoStep,
  undoStep,
  type UndoState,
} from './undo-history';

/** AC-3…AC-8 y AC-10 de la spec `006`. */

/** Tecleo: se puede fundir con el grupo abierto. */
function type(history: UndoState, before: string, after: string, now: number): UndoState {
  return recordWrite(history, { before, after, mergeable: true, now });
}

/** Gesto único (paleta, atajo): no se funde con nada. */
function insert(history: UndoState, before: string, after: string, now: number): UndoState {
  return recordWrite(history, { before, after, mergeable: false, now });
}

/** El coste recorriendo la pila, para no creerse el contador que la pila declara. */
function traversedCost(history: UndoState): number {
  return [...history.past, ...history.future].reduce(
    (total, transaction) => total + editCost(transaction.edit),
    0,
  );
}

describe('agrupación del tecleo por ventana de inactividad (AC-3, AC-4)', () => {
  it('dos pulsaciones dentro de la ventana son UN paso, con el before de la primera', () => {
    const first = type(EMPTY_HISTORY, 'hol', 'hola', 0);
    const history = type(first, 'hola', 'holas', UNDO_GROUP_MS - 1);

    expect(history.past).toHaveLength(1);

    const step = undoStep(history, 'holas');

    // Deshacer una vez tiene que llevar al texto de antes de las DOS pulsaciones.
    expect(step?.text).toBe('hol');
  });

  it('una frase escrita de corrido es un solo paso, no una letra por paso', () => {
    const letters = [...'mundo'];
    let text = 'hola ';
    let history = EMPTY_HISTORY;

    letters.forEach((letter, index) => {
      const next = text + letter;

      history = type(history, text, next, index * 50);
      text = next;
    });

    expect(history.past).toHaveLength(1);
    expect(undoStep(history, text)?.text).toBe('hola ');
  });

  it('separadas por la ventana exacta son DOS pasos', () => {
    const first = type(EMPTY_HISTORY, 'hol', 'hola', 0);
    const history = type(first, 'hola', 'holas', UNDO_GROUP_MS);

    expect(history.past).toHaveLength(2);

    const undone = undoStep(history, 'holas');

    expect(undone?.text).toBe('hola');
    expect(undoStep(undone?.history ?? EMPTY_HISTORY, 'hola')?.text).toBe('hol');
  });

  it('teclear hasta volver al texto en que empezó el grupo retira el paso entero', () => {
    const first = type(EMPTY_HISTORY, 'hola', 'holax', 0);
    const history = type(first, 'holax', 'hola', 100);

    // Un paso que no cambia nada no es un paso de deshacer.
    expect(history.past).toHaveLength(0);
    expect(history.cost).toBe(0);
    expect(undoStep(history, 'hola')).toBeNull();
  });
});

describe('un gesto único nunca se funde, y cierra el grupo (AC-5)', () => {
  it('no se funde con el tecleo anterior aunque caiga dentro de la ventana', () => {
    const typed = type(EMPTY_HISTORY, '', 'hola', 0);
    const history = insert(typed, 'hola', 'hola**negrita**', UNDO_GROUP_MS - 1);

    expect(history.past).toHaveLength(2);
    expect(undoStep(history, 'hola**negrita**')?.text).toBe('hola');
  });

  it('no se funde con otro gesto único inmediatamente anterior', () => {
    const first = insert(EMPTY_HISTORY, '', '****', 0);
    const history = insert(first, '****', '****__', 1);

    expect(history.past).toHaveLength(2);
  });

  it('cierra el grupo: el tecleo posterior empieza paso nuevo dentro de la ventana', () => {
    const inserted = insert(EMPTY_HISTORY, 'hola', 'hola---', 0);
    const history = type(inserted, 'hola---', 'hola---x', 1);

    expect(history.openedAt).toBe(1);
    expect(history.past).toHaveLength(2);
    expect(undoStep(history, 'hola---x')?.text).toBe('hola---');
  });

  it('deshacer también cierra el grupo: teclear después no se funde con lo que quedó', () => {
    const typed = type(EMPTY_HISTORY, '', 'uno', 0);
    const second = type(typed, 'uno', 'uno dos', UNDO_GROUP_MS + 1);
    const undone = undoStep(second, 'uno dos');

    expect(undone?.history.openedAt).toBeNull();

    const history = type(undone?.history ?? EMPTY_HISTORY, 'uno', 'unoX', UNDO_GROUP_MS + 2);

    expect(history.past).toHaveLength(2);
  });
});

describe('escribir descarta lo que había que rehacer (AC-6)', () => {
  it('tras deshacer y volver a escribir no queda nada que rehacer', () => {
    const typed = type(EMPTY_HISTORY, '', 'uno', 0);
    const undone = undoStep(typed, 'uno');

    expect(undone?.history.future).toHaveLength(1);

    const history = type(undone?.history ?? EMPTY_HISTORY, '', 'otro', 5_000);

    expect(history.future).toHaveLength(0);
    expect(redoStep(history, 'otro')).toBeNull();
    expect(history.cost).toBe(traversedCost(history));
  });
});

describe('la cota, en caracteres (AC-7, AC-8)', () => {
  const CHUNK = Math.floor(UNDO_HISTORY_BUDGET_CHARS * 0.6);

  it('está derivada del límite del documento y no escrita a mano', () => {
    expect(UNDO_HISTORY_BUDGET_CHARS).toBe(MAX_DOCUMENT_CONTENT_CHARS);
  });

  it('superar el presupuesto desaloja por el extremo antiguo, y el coste declarado es el real', () => {
    const first = 'a'.repeat(CHUNK);
    const second = 'b'.repeat(CHUNK);

    const one = insert(EMPTY_HISTORY, '', first, 0);

    expect(one.past).toHaveLength(1);
    expect(one.cost).toBe(CHUNK);

    const two = insert(one, first, first + second, 10_000);

    // Dos pasos de 0,6 presupuestos no caben: cae el más viejo.
    expect(two.past).toHaveLength(1);
    expect(two.cost).toBeLessThanOrEqual(UNDO_HISTORY_BUDGET_CHARS);
    expect(two.cost).toBe(traversedCost(two));

    // Y lo que sobrevive es el más reciente: deshacer quita `second`, no `first`.
    expect(undoStep(two, first + second)?.text).toBe(first);
  });

  it('la transacción más reciente NUNCA se desaloja, aunque ella sola pase del presupuesto', () => {
    const before = 'a'.repeat(MAX_DOCUMENT_CONTENT_CHARS);
    const after = 'b'.repeat(MAX_DOCUMENT_CONTENT_CHARS);

    // Seleccionar todo y pegar: cuesta dos veces el documento, el doble del presupuesto.
    const history = insert(EMPTY_HISTORY, before, after, 0);

    expect(history.cost).toBe(2 * MAX_DOCUMENT_CONTENT_CHARS);
    expect(history.past).toHaveLength(1);
    expect(undoStep(history, after)?.text).toBe(before);
  });
});

describe('deshacer y rehacer (AC-1 aplicado a la pila)', () => {
  it('devuelven null cuando no hay nada, y no inventan un historial', () => {
    expect(undoStep(EMPTY_HISTORY, 'texto')).toBeNull();
    expect(redoStep(EMPTY_HISTORY, 'texto')).toBeNull();
  });

  it('rehacer devuelve exactamente lo deshecho, y en orden inverso', () => {
    const one = type(EMPTY_HISTORY, '', 'uno', 0);
    const two = type(one, 'uno', 'uno dos', UNDO_GROUP_MS * 2);
    const three = type(two, 'uno dos', 'uno dos tres', UNDO_GROUP_MS * 4);

    const back1 = undoStep(three, 'uno dos tres');
    const back2 = undoStep(back1?.history ?? EMPTY_HISTORY, back1?.text ?? '');

    expect(back2?.text).toBe('uno');

    const forward1 = redoStep(back2?.history ?? EMPTY_HISTORY, back2?.text ?? '');

    expect(forward1?.text).toBe('uno dos');

    const forward2 = redoStep(forward1?.history ?? EMPTY_HISTORY, forward1?.text ?? '');

    expect(forward2?.text).toBe('uno dos tres');
    expect(forward2?.history.future).toHaveLength(0);
  });

  it('mueve coste entre las dos pilas sin cambiar el total', () => {
    const one = type(EMPTY_HISTORY, '', 'uno', 0);
    const two = type(one, 'uno', 'uno dos', UNDO_GROUP_MS * 2);
    const undone = undoStep(two, 'uno dos');

    expect(undone?.history.cost).toBe(two.cost);
    expect(undone?.history.cost).toBe(traversedCost(undone?.history ?? EMPTY_HISTORY));
  });

  it('restaura la selección de cada extremo, y no un cursor al final', () => {
    const history = recordWrite(EMPTY_HISTORY, {
      before: 'hola foo mundo',
      after: 'hola **foo** mundo',
      mergeable: false,
      now: 0,
      caretBefore: { start: 5, end: 8 },
      caretAfter: { start: 7, end: 10 },
    });

    const undone = undoStep(history, 'hola **foo** mundo');

    expect(undone?.caret).toEqual({ start: 5, end: 8 });
    expect(redoStep(undone?.history ?? EMPTY_HISTORY, undone?.text ?? '')?.caret).toEqual({
      start: 7,
      end: 10,
    });
  });

  it('sin selección declarada, la deriva del reemplazo y es exacta para el tecleo', () => {
    // Teclear «abc» en la posición 5: el cursor estaba en 5 y queda en 8.
    const history = type(EMPTY_HISTORY, 'hola mundo', 'hola abcmundo', 0);
    const undone = undoStep(history, 'hola abcmundo');

    expect(undone?.caret).toEqual({ start: 5, end: 5 });
    expect(redoStep(undone?.history ?? EMPTY_HISTORY, undone?.text ?? '')?.caret).toEqual({
      start: 8,
      end: 8,
    });
  });
});

describe('escribir lo mismo no es un paso, y vaciar es vaciar', () => {
  it('una escritura que no cambia el texto deja el historial igual', () => {
    const history = type(EMPTY_HISTORY, 'hola', 'hola', 0);

    expect(history).toEqual(EMPTY_HISTORY);
  });

  it('clearHistory deja las dos pilas vacías y el coste en cero', () => {
    const typed = type(EMPTY_HISTORY, '', 'algo', 0);
    const undone = undoStep(typed, 'algo');

    expect(clearHistory()).toEqual({ past: [], future: [], cost: 0, openedAt: null });
    expect(undone?.history.future).toHaveLength(1);
  });
});

describe('los dos umbrales no son el mismo número ni el mismo dato (AC-10)', () => {
  it('la ventana de historial es estrictamente más corta que el debounce de guardado', () => {
    expect(UNDO_GROUP_MS).toBeLessThan(AUTOSAVE_DEBOUNCE_MS);
  });

  /**
   * **La segunda mitad de AC-10 no se puede comprobar con los valores**, y por eso se comprueba sobre
   * el fuente: dos constantes con valores distintos pueden estar **atadas** —`UNDO_GROUP_MS =
   * AUTOSAVE_DEBOUNCE_MS / 3` cumpliría la aserción de arriba— y entonces ajustar la política de red
   * movería en silencio qué significa `Ctrl`+`Z`, que es exactamente lo que el AC prohíbe. Mismo patrón
   * que la guarda de pureza: lo que hay que vigilar es una propiedad del código, no de un valor.
   */
  it('y no se deriva de él: la ventana es un literal, no una expresión sobre el debounce', () => {
    const source = readFileSync(join(import.meta.dirname, 'editor.constants.ts'), 'utf8');
    const declaration = /export const UNDO_GROUP_MS = (.+);/.exec(source)?.[1];

    expect(declaration).toBeDefined();
    expect(declaration).toMatch(/^\d[\d_]*$/);
  });
});
