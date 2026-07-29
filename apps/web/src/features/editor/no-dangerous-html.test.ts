import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Capa 5 del modelo de amenaza (`plan.md` §2.2): **en ningún punto del cliente existe una cadena de
 * HTML que un parser pueda interpretar**.
 *
 * Es una regla que ningún test de comportamiento puede comprobar: un componente que inyecte HTML
 * funciona perfectamente y pasa todo lo demás. Lo que la rompe es el paso del tiempo —una spec
 * futura que «solo por esta vez» pinte HTML—, así que se comprueba sobre el árbol de archivos, que
 * es donde vive. Mismo patrón que `workspace-data-access.spec.ts` de la spec `002`.
 *
 * **El token se compone en tiempo de ejecución** a propósito: si estuviera escrito entero, este
 * archivo aparecería en la lista y el test se acusaría a sí mismo.
 */

const FORBIDDEN_TOKEN = ['dangerously', 'Set', 'Inner', 'HTML'].join('');

/**
 * Raíz del código del cliente: `apps/web/src`, dos niveles por encima de este archivo.
 *
 * Se resuelve con `import.meta.dirname` y **no** con `new URL('../../', import.meta.url)`: el `URL`
 * global de este entorno es el de jsdom, que resuelve contra `http://localhost:3000/` y devuelve
 * `http://localhost:3000/@fs/…` en vez de una ruta de archivo. Medido, no supuesto.
 */
const SOURCE_ROOT = join(import.meta.dirname, '../..');

/** El detector: coincidencia literal del token completo, no de un prefijo suyo. */
function injectsRawHtml(source: string): boolean {
  return source.includes(FORBIDDEN_TOKEN);
}

/** Rutas relativas a `apps/web/src` de todos los `.ts`/`.tsx` del cliente. */
function sourceFilesUnder(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;

    if (entry.isDirectory()) {
      return sourceFilesUnder(join(directory, entry.name), relative);
    }

    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [relative] : [];
  });
}

describe('el detector de inyección de HTML se comprueba a sí mismo', () => {
  it('encuentra el token cuando está presente', () => {
    expect(injectsRawHtml(`<div ${FORBIDDEN_TOKEN}={{ __html: contenido }} />`)).toBe(true);
  });

  it('no confunde el prefijo «dangerously» con el token entero', () => {
    // Una variable o un comentario que empiece igual no es una inyección de HTML. Si el detector
    // buscara el prefijo, este caso lo delataría.
    expect(injectsRawHtml('const dangerously = false; // vivir dangerously no es inyectar')).toBe(
      false,
    );
    expect(injectsRawHtml('dangerouslySetInner')).toBe(false);
  });
});

describe('ningún archivo del cliente inyecta HTML en crudo', () => {
  const sourceFiles = sourceFilesUnder(SOURCE_ROOT).sort();

  it('encuentra los archivos del cliente (si no, el test no estaría comprobando nada)', () => {
    expect(sourceFiles).toContain('main.tsx');
    expect(sourceFiles).toContain('features/editor/MarkdownPreview.tsx');
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it('ninguno contiene el token', () => {
    const offenders = sourceFiles.filter((file) =>
      injectsRawHtml(readFileSync(join(SOURCE_ROOT, file), 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
