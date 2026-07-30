import { MAX_DOCUMENT_CONTENT_CHARS } from '@one-markdown/shared';
import { describe, expect, it } from 'vitest';

import { applyEdit, diffEdit, editCost, invertEdit } from './text-edit';

/**
 * AC-1 y AC-2 de la spec `006`.
 *
 * La forma de estos casos es deliberada: **no se afirma cómo se ve un reemplazo**, se afirma que
 * llevar el texto de A a B y volver de B a A dan exactamente A y B. Un test que afirmara el `at` y el
 * `removed` de cada par estaría afirmando la implementación del recorte, y cambiar el recorte por otro
 * igual de correcto lo pondría en rojo sin que nada se hubiera roto.
 *
 * La minimalidad **sí** se afirma sobre el reemplazo (AC-2), porque es la propiedad que la decisión de
 * `spec.md` §2 compra: si el reemplazo dejara de ser mínimo, el historial volvería a costar el tamaño
 * del contenido y la aritmética de esa sección se caería sin que ninguna otra aserción lo notara.
 */

/**
 * Los pares que tiene que aguantar el álgebra. Cada uno está por un motivo distinto, y el más
 * importante es el penúltimo: con `'aa' → 'aaa'` el prefijo común se come el texto entero, así que un
 * recorte de sufijo que no respete lo que ya se llevó el prefijo produce un reemplazo con longitudes
 * negativas. Es el caso que un recorte escrito a la primera falla.
 */
const PAIRS: readonly { readonly name: string; readonly a: string; readonly b: string }[] = [
  { name: 'inserción en medio', a: 'hola mundo', b: 'hola gran mundo' },
  { name: 'inserción al final', a: 'hola', b: 'hola mundo' },
  { name: 'inserción al principio', a: 'mundo', b: 'hola mundo' },
  { name: 'borrado en medio', a: 'hola gran mundo', b: 'hola mundo' },
  { name: 'borrado al final', a: 'hola mundo', b: 'hola' },
  { name: 'sustitución en medio', a: 'abc', b: 'axc' },
  { name: 'sustitución total', a: 'abc', b: 'xyz' },
  { name: 'cambio solo en el primer carácter', a: 'xabc', b: 'yabc' },
  { name: 'origen vacío', a: '', b: 'contenido nuevo' },
  { name: 'destino vacío', a: 'contenido viejo', b: '' },
  { name: 'multilínea con salto añadido', a: '# Título\ntexto', b: '# Título\n\ntexto' },
  { name: 'prefijo común que agota el origen', a: 'aa', b: 'aaa' },
  { name: 'textos iguales', a: 'sin cambios', b: 'sin cambios' },
];

describe('diffEdit / applyEdit / invertEdit — ida y vuelta (AC-1)', () => {
  it.each(PAIRS)('$name: aplicar el reemplazo lleva de A a B', ({ a, b }) => {
    expect(applyEdit(a, diffEdit(a, b))).toBe(b);
  });

  it.each(PAIRS)('$name: aplicar el inverso vuelve de B a A', ({ a, b }) => {
    expect(applyEdit(b, invertEdit(diffEdit(a, b)))).toBe(a);
  });

  it('invertir dos veces devuelve el mismo reemplazo', () => {
    const edit = diffEdit('hola mundo', 'hola gran mundo');

    expect(invertEdit(invertEdit(edit))).toEqual(edit);
  });

  /**
   * **El `at` de un reemplazo vacío no se afirma, y es una corrección medida** (`plan.md` §4.2 decía
   * `{at: 0, …}`): con dos textos iguales el prefijo común agota la cadena, así que el `at` es su
   * longitud. Da igual, y por eso no se afirma: un reemplazo sin nada quitado y nada puesto es un
   * no-op **desde cualquier posición**, y lo que el resto del sistema necesita saber de él es
   * exactamente eso. Normalizarlo a 0 habría añadido una rama que **solo este test ejercitaría**,
   * porque en producción nadie llama aquí con dos textos iguales —`setDraft` y `recordWrite` salen
   * antes—, y una rama que solo cubre su propio test es el anti-patrón que la `004` rechazó al
   * descartar `execCommand` «con respaldo».
   */
  it('dos textos iguales no producen ningún cambio, y su coste es cero', () => {
    const text = 'sin cambios';
    const edit = diffEdit(text, text);

    expect(edit.removed).toBe('');
    expect(edit.inserted).toBe('');
    expect(editCost(edit)).toBe(0);
    expect(applyEdit(text, edit)).toBe(text);
  });
});

describe('el reemplazo es mínimo (AC-2)', () => {
  it('un carácter distinto en medio de un documento al límite cuesta 2, no el documento', () => {
    const before = 'a'.repeat(MAX_DOCUMENT_CONTENT_CHARS);
    const middle = Math.floor(MAX_DOCUMENT_CONTENT_CHARS / 2);
    const after = `${before.slice(0, middle)}b${before.slice(middle + 1)}`;

    expect(after).toHaveLength(MAX_DOCUMENT_CONTENT_CHARS);

    const edit = diffEdit(before, after);

    // La cota del AC. Con instantáneas completas esto valdría 400.000.
    expect(editCost(edit)).toBeLessThanOrEqual(2);
    expect(edit).toEqual({ at: middle, removed: 'a', inserted: 'b' });
  });

  it('un carácter añadido al final de un documento al límite cuesta 1', () => {
    const before = 'a'.repeat(MAX_DOCUMENT_CONTENT_CHARS - 1);
    const after = `${before}b`;

    expect(editCost(diffEdit(before, after))).toBe(1);
  });

  it('el coste es exactamente lo que se guarda', () => {
    const edit = diffEdit('abc', 'xyz');

    expect(editCost(edit)).toBe(edit.removed.length + edit.inserted.length);
    expect(editCost(edit)).toBe(6);
  });

  it('sustituir el documento entero sí cuesta el documento entero, y eso es correcto', () => {
    const before = 'a'.repeat(1_000);
    const after = 'b'.repeat(1_000);

    expect(editCost(diffEdit(before, after))).toBe(2_000);
  });
});
