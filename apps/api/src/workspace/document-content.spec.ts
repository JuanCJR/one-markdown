import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MAX_DOCUMENT_CONTENT_CHARS as MAX_DOCUMENT_CONTENT_CHARS_ESPEJO } from '@one-markdown/shared';

import { contentBytesOf } from './document-content';
import { MAX_DOCUMENT_CONTENT_CHARS } from './workspace.constants';

/**
 * Los saltos de línea se construyen a partir de sus puntos de código y **no** se escriben como
 * literales dentro de la cadena de prueba: un `\r` real dentro del `.ts` es invisible en pantalla y en
 * un `git diff`, y este archivo existe justamente para afirmar que ese byte se cuenta.
 */
const CR = String.fromCharCode(0x0d);
const LF = String.fromCharCode(0x0a);
const CRLF = `${CR}${LF}`;

/**
 * `ñ` ocupa **un** carácter de JavaScript y **dos** bytes en UTF-8.
 * `🙂` (U+1F642) está fuera del plano básico: ocupa **dos** unidades de código (par suplente), o sea
 * `.length === 2`, **un** punto de código y **cuatro** bytes. Es el caso donde `.length` miente por
 * partida doble: ni es el número de caracteres que ve la persona ni es el número de bytes.
 */
const ENIE = 'ñ';
const CARA = '\u{1f642}';

describe('contentBytesOf (AC-3, parte de tamaño)', () => {
  it('cuenta 0 bytes en la cadena vacía', () => {
    // Vaciar un documento es legítimo (AC-2): el tamaño de lo vacío es 0, no un fallo.
    expect(contentBytesOf('')).toBe(0);
  });

  it('cuenta un byte por carácter en ASCII', () => {
    expect(contentBytesOf('abc')).toBe(3);
  });

  describe('cuenta BYTES, no caracteres', () => {
    it('«ñ» son 2 bytes aunque sea 1 carácter', () => {
      expect(ENIE).toHaveLength(1);
      expect(contentBytesOf(ENIE)).toBe(2);
      expect(contentBytesOf(ENIE)).not.toBe(ENIE.length);
    });

    it('«🙂» son 4 bytes, y no sus 2 unidades de código ni su 1 punto de código', () => {
      // Fuera del plano básico: `.length` cuenta el par suplente como 2, y ninguna de las dos
      // magnitudes que JavaScript sabe contar coincide con el tamaño real.
      expect(CARA).toHaveLength(2);
      expect([...CARA]).toHaveLength(1);
      expect(contentBytesOf(CARA)).toBe(4);
      expect(contentBytesOf(CARA)).not.toBe(CARA.length);
      expect(contentBytesOf(CARA)).not.toBe([...CARA].length);
    });

    it.each([
      ['acento agudo', 'á', 1, 2],
      ['diéresis', 'ü', 1, 2],
      ['euro (3 bytes)', '€', 1, 3],
      ['ideograma CJK (3 bytes)', '漢', 1, 3],
      ['emoji con par suplente (4 bytes)', '\u{1f600}', 2, 4],
      ['clave de sol, plano suplementario (4 bytes)', '\u{1d11e}', 2, 4],
    ])('%s', (_caso, valor: string, longitud: number, bytes: number) => {
      expect(valor).toHaveLength(longitud);
      expect(contentBytesOf(valor)).toBe(bytes);
    });

    it('suma los bytes de una mezcla de ASCII y multibyte', () => {
      // '# ' (2) + 'Hola' (4) + ' ' (1) + 'ñ' (2) + ' ' (1) + '🙂' (4) = 14 bytes.
      // En unidades UTF-16 son 11 (el emoji cuenta 2) y en glifos, 10: tres cifras distintas para la
      // misma cadena, y la única que describe la columna es la de bytes.
      const texto = `# Hola ${ENIE} ${CARA}`;

      expect(texto).toHaveLength(11);
      expect([...texto]).toHaveLength(10);
      expect(contentBytesOf(texto)).toBe(14);
    });

    it('un documento en el límite de caracteres puede pasar del doble en bytes', () => {
      // El `@MaxLength` del DTO mide caracteres; esta función mide lo que ocupa la columna. Que sean
      // magnitudes distintas es exactamente el motivo de que exista con nombre propio.
      const enElLimite = ENIE.repeat(MAX_DOCUMENT_CONTENT_CHARS);

      expect(enElLimite).toHaveLength(MAX_DOCUMENT_CONTENT_CHARS);
      expect(contentBytesOf(enElLimite)).toBe(MAX_DOCUMENT_CONTENT_CHARS * 2);
    });
  });

  describe('no normaliza el texto', () => {
    it('cuenta los DOS bytes de un CRLF', () => {
      expect(contentBytesOf(CRLF)).toBe(2);
    });

    it('no convierte CRLF en LF antes de contar', () => {
      const conCrlf = `a${CRLF}b`;
      const conLf = `a${LF}b`;

      expect(contentBytesOf(conCrlf)).toBe(4);
      expect(contentBytesOf(conLf)).toBe(3);
      expect(contentBytesOf(conCrlf)).not.toBe(contentBytesOf(conLf));
    });

    it('no recorta los espacios de los extremos', () => {
      // Dos espacios al final de una línea son un salto de línea en markdown: recortarlos aquí
      // haría que el tamaño no correspondiera con lo guardado (`plan.md` §4).
      expect(contentBytesOf('  hola  ')).toBe(8);
    });

    it('no normaliza Unicode: NFC y NFD del mismo glifo ocupan distinto', () => {
      // Se escriben con escapes porque en pantalla son el mismo glifo y un diff no los distinguiria.
      const nfc = '\u00e1';
      const nfd = 'a\u0301';

      expect(nfc).not.toBe(nfd);
      expect(contentBytesOf(nfc)).toBe(2);
      expect(contentBytesOf(nfd)).toBe(3);
    });
  });

  it('es aditivo sobre la concatenación de trozos ASCII y multibyte', () => {
    const trozos = ['# ', ENIE, CRLF, CARA, 'fin'];
    const total = trozos.reduce((suma, trozo) => suma + contentBytesOf(trozo), 0);

    expect(contentBytesOf(trozos.join(''))).toBe(total);
  });
});

describe('pureza del módulo de dominio (plan §7)', () => {
  const fuente = readFileSync(join(__dirname, 'document-content.ts'), 'utf8');

  it('no importa nada de Nest ni de Prisma', () => {
    const imports = fuente
      .split('\n')
      .filter((linea) => /^\s*(import|export)\b[^;]*\bfrom\b/.test(linea));

    for (const linea of imports) {
      expect(linea).not.toMatch(/@nestjs|@prisma|prisma|generated/i);
    }
  });

  it('no usa `any`', () => {
    expect(fuente).not.toMatch(/\bany\b/);
  });
});

/**
 * `MAX_DOCUMENT_CONTENT_CHARS` está escrito **dos veces** y no puede ser de otra manera:
 * `packages/shared` no puede importar de `apps/api` (la dependencia va al revés) y una reexportación
 * en sentido contrario metería un límite de dominio del servidor detrás de `packages/shared/dist`
 * (`plan.md` §3 de la spec 003, donde está razonado por qué se cierra con este test y no con una
 * reexportación).
 *
 * Este es, entonces, el único punto del repositorio donde la divergencia se detecta. Sin él, subir el
 * valor de `apps/api` a `300_000` no rompería nada: el contador del cliente ofrecería sitio que el
 * `@MaxLength` del servidor rechaza con un `400` (AC-14 y AC-30).
 *
 * **La dirección de la verdad no es simétrica**, y por eso el mensaje del fallo la nombra: la FUENTE
 * es `apps/api/src/workspace/workspace.constants.ts` —donde vive el razonamiento de por qué son
 * 200.000 y el `JSON_BODY_LIMIT` que hay que revisar si se toca—; `packages/shared` es el ESPEJO para
 * el navegador. Quien vea este rojo dentro de un año tiene que saber cuál de los dos valores mover.
 *
 * **Alcance, para que nadie lo dé por cubierto**: el `moduleNameMapper` de Jest resuelve
 * `@one-markdown/shared` al **código fuente** (`packages/shared/src/index.ts`), no a su `dist`. Esto
 * compara los dos literales, que es la divergencia que puede escribir una persona; un `dist` rancio
 * es otro defecto distinto, y de ese se ocupa `pnpm shared:build` (AC-34 de la spec 002).
 */
describe('acoplamiento de MAX_DOCUMENT_CONTENT_CHARS entre `apps/api` y `packages/shared`', () => {
  it('el espejo de `packages/shared` vale exactamente lo mismo que la fuente', () => {
    // Se anotan como `number` a propósito: sin la anotación, TypeScript infiere el tipo literal
    // `200000` en los dos lados y la comparación se vuelve trivialmente cierta en tiempo de
    // compilación, aunque en ejecución sea justo lo que hay que comprobar.
    const valorEnLaFuente: number = MAX_DOCUMENT_CONTENT_CHARS;
    const valorEnElEspejo: number = MAX_DOCUMENT_CONTENT_CHARS_ESPEJO;

    const divergencia =
      valorEnElEspejo === valorEnLaFuente
        ? null
        : [
            'MAX_DOCUMENT_CONTENT_CHARS ha divergido entre los dos paquetes:',
            `  FUENTE  apps/api/src/workspace/workspace.constants.ts  = ${String(valorEnLaFuente)}`,
            `  ESPEJO  packages/shared/src/index.ts                   = ${String(valorEnElEspejo)}`,
            'La FUENTE manda (plan 003 §3): mueve el ESPEJO al valor de la FUENTE, nunca al revés.',
          ].join('\n');

    expect(divergencia).toBeNull();
  });
});
