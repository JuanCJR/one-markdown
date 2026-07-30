import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * AC-30 de la spec `005`: los ayudantes que comparten los archivos de navegador viven en
 * `apps/web/e2e/support/`, y ninguno de esos archivos se hace su propia copia.
 *
 * Es una regla que ninguna suite de comportamiento puede comprobar: una copia local funciona
 * perfectamente y deja las dos suites en verde — hasta que las dos copias divergen y cada archivo
 * mide algo distinto creyendo que mide lo mismo. Eso ya pasó una vez (la firma de la vigilancia de
 * consola), así que se comprueba sobre el código fuente, que es donde vive.
 *
 * **Vive en `src/` y no junto a lo que vigila** porque el `include` de Vitest es
 * `src/**\/*.{test,spec}.{ts,tsx}`: un archivo de guarda en `e2e/` no lo correría nadie, y encima
 * Playwright intentaría ejecutarlo como caso suyo. Mismo patrón que `no-dangerous-html.test.ts`.
 *
 * **Cuidado al tocar los archivos vigilados**: esta guarda lee el fuente con `readFileSync` y **no
 * distingue código de comentario**. Un comentario que deletree una declaración de las de abajo pone
 * el archivo en rojo, y el rojo sería correcto: la guarda hace exactamente lo que dice hacer
 * (`004/spec.md` §9.6). Los archivos de `e2e/support/` **no** se vigilan, que es justo donde esas
 * declaraciones tienen que estar.
 */

/**
 * Los que se comparten, con el nombre exacto con el que se exportan. `test` es el *fixture* de
 * sesión: `const test = base.extend<…>`, que es una declaración como las demás.
 *
 * **El recuento vive en esta lista y en ningún literal**, que es la lección que la `005` pagó en su
 * propia redacción: su AC-30 decía «cinco» al lado de una enumeración de seis.
 *
 * `watchContentSaves` entra con la `006`: iba por su **segunda** copia —`palette.spec.ts` y
 * `tabs.spec.ts`, idénticas carácter por carácter— y `undo.spec.ts` habría sido la tercera, que es
 * cuando la regla de la casa manda extraer.
 */
const SHARED_HELPERS = [
  'watchConsole',
  'createDocument',
  'textarea',
  'uniqueTitle',
  'test',
  'SAVE_REGION_NAME',
  'watchContentSaves',
] as const;

/**
 * Raíz de los archivos de navegador: `apps/web/e2e`, dos niveles por encima de este archivo.
 *
 * Se resuelve con `import.meta.dirname` y **no** con `new URL('../../e2e', import.meta.url)`: el
 * `URL` global de este entorno es el de jsdom, que resuelve contra `http://localhost:3000/` y
 * devuelve `http://localhost:3000/@fs/…` en vez de una ruta de archivo. Medido en la `003`, no
 * supuesto.
 */
const E2E_ROOT = join(import.meta.dirname, '../../e2e');

/**
 * El detector: una **declaración** del nombre, no una mención suya.
 *
 * Importarlo, llamarlo o leerlo tiene que seguir siendo legal —es justo lo que se quiere—, así que
 * lo que se busca es la palabra clave que crea el enlace seguida del nombre. El `\b` final impide
 * que `textarea` marque a `textareaOf` y que `test` marque a `testTitle`.
 */
function declarationPattern(name: string): RegExp {
  return new RegExp(String.raw`\b(?:function|const|let|var)\s+${name}\b`);
}

/** Los nombres que un archivo declara por su cuenta, en el orden del inventario. */
function localDeclarationsIn(source: string): readonly string[] {
  return SHARED_HELPERS.filter((name) => declarationPattern(name).test(source));
}

/** Los archivos de casos de `e2e/`. `support/` queda fuera: es donde viven las declaraciones. */
function browserSpecFiles(): readonly string[] {
  return readdirSync(E2E_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => entry.name)
    .sort();
}

describe('el detector de copias locales se comprueba a sí mismo', () => {
  it('encuentra una declaración cuando está presente', () => {
    expect(localDeclarationsIn('function watchConsole(page) {}')).toEqual(['watchConsole']);
    expect(localDeclarationsIn("const SAVE_REGION_NAME = 'Estado del guardado';")).toEqual([
      'SAVE_REGION_NAME',
    ]);
    expect(localDeclarationsIn('const test = base.extend({});')).toEqual(['test']);
  });

  it('no confunde importar y usar con declarar', () => {
    // La mitad que hace útil a la guarda: si marcara cualquier mención, el arreglo que pide sería
    // imposible de escribir.
    expect(
      localDeclarationsIn(
        [
          "import { test, textarea, uniqueTitle } from './support/editor-e2e';",
          "test.describe('algo', () => {});",
          "await textarea(page, uniqueTitle('Editor', 'x')).click();",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('no confunde un nombre que empieza igual con el nombre entero', () => {
    expect(localDeclarationsIn('const testTitle = 1; function textareaOf() {}')).toEqual([]);
  });
});

describe('ningún archivo de navegador declara los ayudantes compartidos (AC-30)', () => {
  const specFiles = browserSpecFiles();

  it('encuentra los archivos de navegador (si no, la guarda no comprobaría nada)', () => {
    expect(specFiles).toContain('editor.spec.ts');
    expect(specFiles).toContain('palette.spec.ts');
  });

  it('ninguno los declara por su cuenta', () => {
    const offenders = specFiles.flatMap((file) =>
      localDeclarationsIn(readFileSync(join(E2E_ROOT, file), 'utf8')).map(
        (name) => `${file}: ${name}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});
