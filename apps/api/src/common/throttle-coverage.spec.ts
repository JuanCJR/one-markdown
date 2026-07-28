import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Cobertura de throttler en **todos** los controladores (spec 002, AC-24 y decisión 15 del plan).
 *
 * Con throttlers nombrados y `skipIf`, el modelo es **opt-in**: una ruta que no declara nada no
 * hereda ningún límite. Eso es lo correcto —el alternativo, un throttler `default` global, dejaría
 * el modelo a medio camino y con dos reglas conviviendo— pero tiene un punto ciego evidente: el día
 * que alguien añada un controlador y se olvide del decorador, la superficie nueva nace sin freno y
 * nada protesta.
 *
 * Este test es ese «alguien protesta». No mira metadatos de Nest a propósito: leerlos exigiría
 * instanciar la aplicación entera y solo vería lo que ya está registrado en un módulo, mientras que
 * lo que hay que vigilar es el **archivo**, exista o no su módulo todavía. Se recorre `src/**` de
 * verdad, no una lista escrita a mano que envejecería con el primer controlador nuevo.
 */

/** Raíz del escaneo: `src/`, es decir el directorio padre de `common/`. */
const SRC_ROOT = join(__dirname, '..');

const CONTROLLER_SUFFIX = '.controller.ts';

/**
 * Las dos formas admitidas, en su forma de **decorador**. Se exige la arroba y el paréntesis: sin
 * ellos, un `import { SkipThrottling }` sin usar —o el nombre citado en un comentario— contaría como
 * declaración y el test se volvería decorativo.
 */
const DECLARATIONS = ['@Throttled(', '@SkipThrottling('] as const;

/**
 * Controladores que ya existen cuando se escribe el test.
 *
 * Es la red anti-vacío: si el recorrido dejara de encontrar archivos —un `join` mal hecho, un
 * `__dirname` que en otro runner apunta a `dist/`— la comprobación de arriba pasaría sobre una lista
 * vacía y el test seguiría verde sin mirar nada. No es una lista cerrada: un controlador nuevo no
 * tiene que añadirse aquí, solo declarar su throttler.
 */
const KNOWN_CONTROLLERS = [
  'auth/auth.controller.ts',
  'auth/mfa/mfa.controller.ts',
  'health/health.controller.ts',
  'workspace/directories.controller.ts',
  'workspace/documents.controller.ts',
  'workspace/workspace.controller.ts',
];

/** Rutas relativas a `src/`, con `/` siempre, para que las afirmaciones no dependan del sistema. */
function findControllerFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...findControllerFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(CONTROLLER_SUFFIX)) {
      found.push(relative(SRC_ROOT, absolute).split(sep).join('/'));
    }
  }

  return found.sort();
}

function declaresThrottler(source: string): boolean {
  return DECLARATIONS.some((declaration) => source.includes(declaration));
}

describe('cobertura de throttler en los controladores — AC-24', () => {
  const controllers = findControllerFiles(SRC_ROOT);

  it('el recorrido encuentra los controladores del proyecto (el test no pasa por vacío)', () => {
    expect(controllers).toEqual(expect.arrayContaining(KNOWN_CONTROLLERS));
    expect(controllers.length).toBeGreaterThanOrEqual(KNOWN_CONTROLLERS.length);
  });

  it.each(findControllerFiles(SRC_ROOT))(
    '%s declara @Throttled(...) o @SkipThrottling()',
    (controller) => {
      const source = readFileSync(join(SRC_ROOT, controller), 'utf8');

      // El mensaje es la mitad del valor del test: quien lo vea fallar tiene que saber qué hacer.
      expect({
        controller,
        declara: declaresThrottler(source),
        formasAdmitidas: DECLARATIONS,
      }).toEqual({ controller, declara: true, formasAdmitidas: DECLARATIONS });
    },
  );

  /**
   * El detector, probado en sus dos sentidos. Sin esto, `declaresThrottler` podría devolver `true`
   * siempre —un `return true` de más, o un `some` sobre una lista vacía— y los casos de arriba
   * pasarían todos sin comprobar nada.
   */
  describe('el detector distingue de verdad', () => {
    it('acepta las dos formas de declaración', () => {
      expect(declaresThrottler("@Throttled('workspace')\nexport class C {}")).toBe(true);
      expect(declaresThrottler('@SkipThrottling()\nexport class C {}')).toBe(true);
    });

    it('rechaza un controlador sin declaración, y también la mención sin decorador', () => {
      expect(declaresThrottler('@Controller("x")\nexport class C {}')).toBe(false);
      expect(declaresThrottler("import { SkipThrottling } from '../common/throttle';")).toBe(false);
      expect(declaresThrottler('// pendiente: poner Throttled aquí')).toBe(false);
    });
  });
});
