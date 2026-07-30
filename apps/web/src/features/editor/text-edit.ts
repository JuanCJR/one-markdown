/**
 * Álgebra del cambio de texto (`006/plan.md` §4.2).
 *
 * Un cambio de texto se representa como el **reemplazo mínimo** que lo produce: dónde empieza lo que
 * cambió, qué había ahí y qué hay ahora. Nada más. No sabe nada de la interfaz, del estado de la
 * aplicación ni del navegador — y eso no es una convención de estilo revisable a ojo, sino una guarda
 * automatizada que lee este archivo y lo pone en rojo si aprende algo de todo eso
 * (`markdown-palette.test.ts`, AC-9 de la `006` y AC-17 de la `004`).
 *
 * **Por qué un reemplazo y no dos copias del texto entero** (`006/spec.md` §2): una entrada del editor
 * ya guarda dos copias del contenido, y el límite del proyecto son 200.000 caracteres. Guardar dos
 * copias más **por cada paso de deshacer** hace que el historial cueste el tamaño del contenido
 * multiplicado por cuántas veces se tocó; guardar el reemplazo hace que cueste el **volumen de lo
 * editado**, que es lo que la persona escribió.
 *
 * **Y la vuelta es gratis**: el reemplazo que deshace a otro es el mismo con `removed` e `inserted`
 * intercambiados y el mismo punto de partida. Deshacer y rehacer son la misma operación con el
 * reemplazo al derecho o al revés, y de ahí sale que no haya dos caminos que puedan discrepar.
 */

/** Un cambio de texto, como el reemplazo mínimo que lo produce. */
export interface TextEdit {
  /** Dónde empieza lo que cambió. */
  readonly at: number;
  /** Lo que había ahí. */
  readonly removed: string;
  /** Lo que hay ahora. */
  readonly inserted: string;
}

/**
 * El reemplazo mínimo que lleva de `before` a `after`.
 *
 * Se recorta el prefijo común y luego el sufijo común, **y el sufijo no puede comerse lo que ya se
 * llevó el prefijo**: ese tope es lo único delicado de la función. Sin él, `'aa' → 'aaa'` —donde el
 * prefijo común agota el texto de partida— produciría longitudes negativas y un reemplazo que no
 * significa nada.
 *
 * Es exacto para **cualquier** par de textos: una sustitución total devuelve un reemplazo del tamaño
 * del contenido, que es lo correcto y lo que hace que no haga falta ninguna heurística.
 */
export function diffEdit(before: string, after: string): TextEdit {
  const shorter = Math.min(before.length, after.length);

  let prefix = 0;

  while (prefix < shorter && before[prefix] === after[prefix]) {
    prefix += 1;
  }

  let suffix = 0;

  while (
    suffix < shorter - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    at: prefix,
    removed: before.slice(prefix, before.length - suffix),
    inserted: after.slice(prefix, after.length - suffix),
  };
}

/** `text` con el reemplazo aplicado. */
export function applyEdit(text: string, edit: TextEdit): string {
  return text.slice(0, edit.at) + edit.inserted + text.slice(edit.at + edit.removed.length);
}

/**
 * El reemplazo que deshace este: el mismo punto de partida, con lo quitado y lo puesto
 * intercambiados. Que el `at` no cambie no es una casualidad afortunada — el reemplazo empieza donde
 * empieza, y aplicarlo en un sentido o en el otro no mueve ese punto.
 */
export function invertEdit(edit: TextEdit): TextEdit {
  return { at: edit.at, removed: edit.inserted, inserted: edit.removed };
}

/** Lo que cuesta guardarlo, en caracteres. Es la unidad en la que se acota el historial. */
export function editCost(edit: TextEdit): number {
  return edit.removed.length + edit.inserted.length;
}
