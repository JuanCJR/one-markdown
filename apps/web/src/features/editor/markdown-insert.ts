/**
 * Núcleo de inserción de la paleta de markdown (`004/plan.md` §4.2).
 *
 * Una función pura y nada más: recibe lo que se sabe de un área de texto en un instante y un
 * elemento del catálogo, y devuelve **la misma forma**. No sabe nada de la interfaz, del estado de
 * la aplicación ni del navegador —y eso no es una convención de estilo revisable a ojo, sino una
 * guarda automatizada que lee este archivo y lo pone en rojo si aprende algo de todo eso
 * (`markdown-palette.test.ts`, AC-17).
 *
 * Que la entrada y la salida tengan la misma forma es deliberado: encadenar dos inserciones es
 * componer la función consigo misma, y de ahí sale gratis que aplicar cursiva sobre lo que acaba de
 * quedar en negrita envuelva **el texto** y no los asteriscos (AC-1).
 */

import type {
  BlockBehaviour,
  InlineBehaviour,
  LinePrefixBehaviour,
  LinePrefixSource,
  PaletteElement,
} from './markdown-palette';

/** Lo que se sabe de un área de texto en un instante. Es también lo que se devuelve. */
export interface TextSelection {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

/** Aplica un elemento del catálogo a una selección y devuelve la selección resultante. */
export function applyPaletteElement(
  element: PaletteElement,
  selection: TextSelection,
): TextSelection {
  switch (element.behaviour.kind) {
    case 'inline':
      return applyInline(element.behaviour, selection);
    case 'linePrefix':
      return applyLinePrefix(element.behaviour, selection);
    case 'block':
      return applyBlock(element.behaviour, selection);
  }
}

/**
 * Un bloque ocupa líneas propias, así que la operación es: elegir dónde cortar —siempre en un borde
 * de línea, nunca a mitad de un párrafo—, pintar el bloque y **normalizar la separación**.
 *
 * La normalización cuenta los `\n` que ya hay y añade solo los que falten (AC-13). Concatenar
 * `\n\n` a ciegas es lo que produce el documento lleno de huecos que crece cada vez que se pulsa el
 * botón, y en el documento vacío dejaría `\n\n---\n` donde AC-12 pide exactamente `---\n`.
 */
function applyBlock(behaviour: BlockBehaviour, selection: TextSelection): TextSelection {
  const { text, selectionStart, selectionEnd } = selection;
  const selected = text.slice(selectionStart, selectionEnd);
  const consumed = behaviour.consumesSelection && selected !== '';
  const [cutStart, cutEnd] = consumed
    ? [selectionStart, selectionEnd]
    : blockAnchor(text, selectionStart, selectionEnd);

  const before = text.slice(0, cutStart);
  const after = text.slice(cutEnd);
  const block = behaviour.render(consumed ? selected : '');

  const gapBefore = before === '' ? '' : '\n'.repeat(missingBreaks(trailingBreaks(before)));
  // Detrás del bloque siempre queda al menos un `\n`, el que cierra su última línea: es lo que hace
  // que el separador en un documento vacío sea `---\n` y no `---`.
  const gapAfter = after === '' ? '\n' : '\n'.repeat(missingBreaks(leadingBreaks(after)));
  const blockStart = cutStart + gapBefore.length;

  const result = before + gapBefore + block.text + gapAfter + after;

  if (block.selection === null) {
    const nextLine = blockStart + block.text.length + 1;

    return { text: result, selectionStart: nextLine, selectionEnd: nextLine };
  }

  return {
    text: result,
    selectionStart: blockStart + block.selection.start,
    selectionEnd: blockStart + block.selection.end,
  };
}

/**
 * Dónde se abre hueco para un bloque que **no** se lleva la selección dentro.
 *
 * Sin selección, el borde de línea más cercano al cursor (`plan.md` §4.2): un bloque metido a mitad
 * de frase parte el párrafo en dos. Con selección, el final de la última línea que toca, para que el
 * bloque quede detrás de lo seleccionado y no encima.
 */
function blockAnchor(text: string, selectionStart: number, selectionEnd: number): [number, number] {
  if (selectionStart !== selectionEnd) {
    const end = lineEndAfter(text, selectionStart, selectionEnd);

    return [end, end];
  }

  const lineStart = text.slice(0, selectionStart).lastIndexOf('\n') + 1;
  const lineEnd = lineEndAfter(text, selectionStart, selectionEnd);
  const edge = selectionStart - lineStart <= lineEnd - selectionStart ? lineStart : lineEnd;

  return [edge, edge];
}

/** Cuántos `\n` faltan para tener una línea en blanco entera (dos saltos) a ese lado. */
function missingBreaks(existing: number): number {
  return Math.max(0, 2 - existing);
}

function trailingBreaks(text: string): number {
  return /\n*$/.exec(text)?.[0].length ?? 0;
}

function leadingBreaks(text: string): number {
  return /^\n*/.exec(text)?.[0].length ?? 0;
}

/**
 * Prefijar es una operación sobre **líneas enteras**, no sobre el cursor: se calcula el rango de
 * líneas que toca la selección, se le quita a cada una el prefijo que declare `replaces` y se le
 * pone el suyo.
 *
 * Las líneas en blanco se saltan (AC-9) y **tampoco cuentan para la numeración** (AC-8): una lista
 * numerada que salta números porque en medio había un hueco es exactamente lo que nadie pidió.
 */
function applyLinePrefix(behaviour: LinePrefixBehaviour, selection: TextSelection): TextSelection {
  const { text, selectionStart, selectionEnd } = selection;
  const blockStart = text.slice(0, selectionStart).lastIndexOf('\n') + 1;
  const blockEnd = lineEndAfter(text, selectionStart, selectionEnd);
  const lines = text.slice(blockStart, blockEnd).split('\n');

  // Ninguna línea del rango tiene contenido: es el cursor en una línea vacía, y entonces sí hace
  // falta darle algo que sustituir (AC-11). Sobre una línea con texto no se inserta nada de esto,
  // porque el contenido ya lo puso la persona (AC-7).
  if (!lines.some(hasContent)) {
    const prefix = prefixFor(behaviour.prefix, 1);
    const placeholderStart = blockStart + prefix.length;

    return {
      text: text.slice(0, blockStart) + prefix + behaviour.placeholder + text.slice(blockStart),
      selectionStart: placeholderStart,
      selectionEnd: placeholderStart + behaviour.placeholder.length,
    };
  }

  let numbered = 0;
  const prefixed = lines
    .map((line) => {
      if (!hasContent(line)) {
        return line;
      }

      numbered += 1;

      return prefixFor(behaviour.prefix, numbered) + line.replace(behaviour.replaces, '');
    })
    .join('\n');

  const result = text.slice(0, blockStart) + prefixed + text.slice(blockEnd);

  // Sin selección, el cursor conserva su posición relativa dentro de la prosa desplazándose lo que
  // haya cambiado su línea (AC-7): el prefijo puede medir 2, 6 o —si sustituyó a otro— menos que 0.
  if (selectionStart === selectionEnd) {
    const cursor = selectionStart + (prefixed.length - (blockEnd - blockStart));

    return { text: result, selectionStart: cursor, selectionEnd: cursor };
  }

  return {
    text: result,
    selectionStart: blockStart,
    selectionEnd: blockStart + prefixed.length,
  };
}

/**
 * Final de la última línea que toca la selección.
 *
 * Una selección que **acaba justo en un salto de línea** cubre la línea que termina ahí y no la
 * siguiente: sin esta corrección, seleccionar «uno\n» prefijaría también «dos», que es la clase de
 * sorpresa que hace desconfiar de un botón.
 */
function lineEndAfter(text: string, selectionStart: number, selectionEnd: number): number {
  const anchor =
    selectionEnd > selectionStart && text[selectionEnd - 1] === '\n'
      ? selectionEnd - 1
      : selectionEnd;
  const nextBreak = text.indexOf('\n', anchor);

  return nextBreak === -1 ? text.length : nextBreak;
}

/** Una línea en blanco no es contenido, aunque traiga espacios. */
function hasContent(line: string): boolean {
  return line.trim() !== '';
}

/** El prefijo de la línea que hace el número `position` entre las que reciben prefijo. */
function prefixFor(source: LinePrefixSource, position: number): string {
  return source.kind === 'numbered' ? `${position}. ` : source.text;
}

/**
 * Envolver es un único caso con dos entradas posibles: lo que se envuelve es la selección si la
 * hay, y el marcador de posición si no la hay. La selección resultante cubre **el contenido**, sin
 * los marcadores, para que el siguiente elemento vuelva a envolverlo (AC-1, AC-2).
 *
 * Una selección multilínea se envuelve entera y tal cual (AC-3): partirla por líneas produciría
 * marcadores sueltos a mitad de párrafo, que no es lo que nadie pidió.
 */
function applyInline(behaviour: InlineBehaviour, selection: TextSelection): TextSelection {
  const { text, selectionStart, selectionEnd } = selection;
  const selected = text.slice(selectionStart, selectionEnd);
  const content = selected === '' ? behaviour.placeholder : selected;
  const contentStart = selectionStart + behaviour.before.length;
  const target = selected === '' ? undefined : behaviour.selectTargetWhenWrapping;
  const resultStart =
    target === undefined
      ? contentStart
      : contentStart + content.length + behaviour.after.indexOf(target);

  return {
    text:
      text.slice(0, selectionStart) +
      behaviour.before +
      content +
      behaviour.after +
      text.slice(selectionEnd),
    selectionStart: resultStart,
    selectionEnd: resultStart + (target ?? content).length,
  };
}
