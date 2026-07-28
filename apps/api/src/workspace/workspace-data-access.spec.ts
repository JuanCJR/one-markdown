import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Límite de capa del módulo (decisión 14 del plan de la spec 002): el repositorio es el **único**
 * punto del workspace que conoce Prisma. Controladores y servicios hablan con el repositorio.
 *
 * Es una regla que no se puede comprobar con un test de comportamiento: un servicio que inyecte el
 * cliente de Prisma funciona perfectamente y pasa todos los demás tests. Lo que la rompe es el paso
 * del tiempo, así que se comprueba sobre el árbol de archivos, que es donde vive.
 *
 * El token se compone en tiempo de ejecución (`['Prisma', 'Service'].join('')`) a propósito: si
 * estuviera escrito entero, **este** archivo aparecería en la lista y el test se acusaría a sí mismo.
 */

const DATA_ACCESS_TOKEN = ['Prisma', 'Service'].join('');

/** El único archivo del módulo autorizado a nombrar el cliente de base de datos. */
const REPOSITORY_FILE = 'workspace.repository.ts';

/** Rutas relativas a `src/workspace/` de todos los `.ts` del módulo, incluidos los de `dto/`. */
function typescriptFilesUnder(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;

    if (entry.isDirectory()) {
      return typescriptFilesUnder(join(directory, entry.name), relative);
    }

    return entry.name.endsWith('.ts') ? [relative] : [];
  });
}

describe('acceso a datos del módulo workspace', () => {
  const moduleFiles = typescriptFilesUnder(__dirname).sort();

  it('encuentra los archivos del módulo (si no, el test no estaría comprobando nada)', () => {
    expect(moduleFiles).toContain(REPOSITORY_FILE);
    expect(moduleFiles.length).toBeGreaterThan(1);
  });

  it('solo el repositorio nombra el cliente de base de datos', () => {
    const mentioning = moduleFiles.filter((file) =>
      readFileSync(join(__dirname, file), 'utf8').includes(DATA_ACCESS_TOKEN),
    );

    expect(mentioning).toEqual([REPOSITORY_FILE]);
  });
});
