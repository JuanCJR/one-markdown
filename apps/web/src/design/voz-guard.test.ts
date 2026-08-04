import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Guard de la voz (`docs/design/06-marca.md` §5).
 *
 * Hace exigibles cuatro prohibiciones del **Anexo A — lista negra anti-slop** sobre el texto que la
 * persona llega a leer u oír:
 *
 *   X7  «Ups», «Algo salió mal», «Error inesperado».
 *   I3  Emoji usado como icono — aquí, en cualquier sitio: la interfaz no tiene ni uno.
 *   X6  Emoji en encabezados; queda cubierto por lo anterior, que es más ancho.
 *   X2  El léxico de landing: potencia · impulsa · desbloquea · sin fricción · todo en uno ·
 *       al siguiente nivel · revoluciona · de última generación · robusto.
 *
 * **Cómo mira, y por qué así.** No es un `grep`: un `grep` no distingue una cadena de la interfaz de
 * un comentario que habla de ella, y este repositorio comenta mucho. Se recorre el AST de
 * TypeScript y se recogen **solo** literales de cadena, plantillas y texto JSX. Los comentarios
 * quedan fuera por construcción, no por una expresión regular que los intente borrar y se coma media
 * línea al tropezar con `https://`.
 *
 * Lo que **no** cubre, dicho en vez de fingido: el texto que llega del servidor sin pasar por
 * `textos.ts`. La regla 15 de la fase 6 cierra esa puerta mapeando por código en el cliente
 * (`auth.errors.ts`), pero un mensaje de dominio nuevo del backend puede seguir apareciendo en
 * pantalla sin cruzar este guard. Es una revisión manual declarada, no un hueco tapado con un test
 * que finja lo contrario.
 */

// `fileURLToPath` y no `.pathname`: en Vitest la URL del módulo llega con el prefijo `/@fs` del
// servidor de Vite y `readdirSync` buscaría un directorio que no existe. Mismo motivo que en
// `color-guard.test.ts`, y por eso se escribe igual.
const RAIZ = fileURLToPath(new URL('../..', import.meta.url.replace('/@fs', ''))); // apps/web
const EXTENSIONES = new Set(['.ts', '.tsx']);
const IGNORADOS = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', '.vite']);

/** Un test no es interfaz: cita el texto viejo para afirmar que ya no está, y eso no es la voz. */
function esCodigoDePrueba(ruta: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(ruta) || ruta.includes(`src${'/'}test${'/'}`);
}

interface Archivo {
  readonly ruta: string;
  readonly contenido: string;
}

function recoge(directorio: string, acumulado: Archivo[] = []): Archivo[] {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    if (IGNORADOS.has(entrada.name)) continue;

    const ruta = join(directorio, entrada.name);

    if (entrada.isDirectory()) {
      recoge(ruta, acumulado);
    } else if (EXTENSIONES.has(extname(entrada.name))) {
      const relativa = relative(RAIZ, ruta).split('\\').join('/');

      if (!esCodigoDePrueba(relativa)) {
        acumulado.push({ ruta: relativa, contenido: readFileSync(ruta, 'utf8') });
      }
    }
  }

  return acumulado;
}

/** Una cadena del código, con el sitio exacto para poder señalarla al fallar. */
interface Cadena {
  readonly ruta: string;
  readonly linea: number;
  readonly texto: string;
}

/**
 * Los literales que acaban siendo texto: cadenas, plantillas y nodos de texto JSX.
 *
 * Se dejan fuera los especificadores de `import`/`export`: son rutas de módulo, no palabras. Todo lo
 * demás entra, incluidas las cadenas de `className`. Que una utilidad de Tailwind no vaya a contener
 * «robusto» no es razón para filtrarla: cada filtro es un sitio por donde el guard deja de mirar.
 */
function cadenasDe(archivo: Archivo): Cadena[] {
  const fuente = ts.createSourceFile(
    archivo.ruta,
    archivo.contenido,
    ts.ScriptTarget.Latest,
    true,
    archivo.ruta.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const encontradas: Cadena[] = [];

  const visita = (nodo: ts.Node): void => {
    const esEspecificadorDeModulo =
      (ts.isImportDeclaration(nodo.parent) || ts.isExportDeclaration(nodo.parent)) &&
      nodo.parent.moduleSpecifier === nodo;

    const recogible =
      ts.isStringLiteral(nodo) ||
      ts.isNoSubstitutionTemplateLiteral(nodo) ||
      ts.isTemplateHead(nodo) ||
      ts.isTemplateMiddle(nodo) ||
      ts.isTemplateTail(nodo) ||
      ts.isJsxText(nodo);

    if (recogible && !esEspecificadorDeModulo) {
      const texto = ts.isJsxText(nodo) ? nodo.text : (nodo as ts.LiteralLikeNode).text;

      if (texto.trim() !== '') {
        encontradas.push({
          ruta: archivo.ruta,
          linea: fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente)).line + 1,
          texto,
        });
      }
    }

    ts.forEachChild(nodo, visita);
  };

  ts.forEachChild(fuente, visita);

  return encontradas;
}

const archivos = recoge(join(RAIZ, 'src'));
const cadenas = archivos.flatMap(cadenasDe);

/** Sin tildes y en minúsculas: «Última» y «ultima» son la misma palabra para una lista negra. */
function normaliza(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sitio(c: Cadena, encontrado: string): string {
  return `${c.ruta}:${String(c.linea)} → «${encontrado}» en ${JSON.stringify(c.texto.trim())}`;
}

/**
 * Los tres rótulos de X7. Se buscan como **subcadena** y no por igualdad: el fallo típico no es la
 * cadena exacta del anexo, es «Ocurrió un error inesperado. Inténtalo de nuevo.», que la contiene.
 */
const X7 = ['ups', 'algo salio mal', 'error inesperado'] as const;

/**
 * El léxico de landing de X2, tal y como lo lista el anexo.
 *
 * Los términos de una sola palabra se buscan por **raíz**, porque el anexo lista un lema y el slop
 * no se conjuga solo en esa forma: «potencia» tiene que atrapar «potenciar» y «robusto» a «robusta».
 * Los de varias palabras van como frase exacta, donde no hay flexión que cubrir.
 */
const X2: readonly { readonly termino: string; readonly patron: RegExp }[] = [
  { termino: 'potencia', patron: /\bpotenci\w*/ },
  { termino: 'impulsa', patron: /\bimpuls\w*/ },
  { termino: 'desbloquea', patron: /\bdesbloque\w*/ },
  { termino: 'sin fricción', patron: /\bsin friccion\w*/ },
  { termino: 'todo en uno', patron: /\btodo en uno\b/ },
  { termino: 'al siguiente nivel', patron: /\bal siguiente nivel\b/ },
  { termino: 'revoluciona', patron: /\brevolucion\w*/ },
  { termino: 'de última generación', patron: /\bde ultima generacion\b/ },
  { termino: 'robusto', patron: /\brobust\w*/ },
];

/**
 * Emoji. `Extended_Pictographic` es la propiedad que Unicode define exactamente para esto y cubre
 * también los pictogramas viejos de un solo punto de código (`✨`, `⚠`, `✔`), que es donde falla el
 * rango `1F300-1FAFF` que propone el anexo: `✨` es `U+2728` y se le escapa entero, justo el
 * carácter que el propio anexo señala en I4 como el significante de «esto lo ha escrito una IA».
 */
const EMOJI = /\p{Extended_Pictographic}/u;

describe('guard de la voz — Anexo A sobre el texto de la interfaz', () => {
  /**
   * Un guard que no mira nada pasa siempre. Antes de creerse los cuatro verdes de abajo se comprueba
   * que el instrumento tiene delante lo que dice tener: los archivos, las cadenas, y una cadena
   * concreta que sabemos que existe.
   */
  it('inspecciona el código de verdad: hay archivos, hay cadenas y se leen las de la interfaz', () => {
    expect(archivos.length).toBeGreaterThan(20);
    expect(cadenas.length).toBeGreaterThan(300);

    // Ninguna de las tres es casual: una cadena suelta, un rótulo de un objeto de datos y un texto
    // JSX. Si el recolector dejara de ver cualquiera de las tres formas, el guard seguiría en verde
    // mirando las otras dos, y eso es el cero falso que se está evitando.
    expect(archivos.some((a) => a.ruta === 'src/shared/textos/textos.ts')).toBe(true);
    expect(cadenas.some((c) => c.texto === 'Estructura')).toBe(true);
    expect(cadenas.some((c) => c.texto.includes('Nadie ha entrado'))).toBe(true);
  });

  it('no dice «Ups», «Algo salió mal» ni «Error inesperado» (X7)', () => {
    const usos = cadenas.flatMap((c) => {
      const texto = normaliza(c.texto);

      return X7.filter((prohibido) => texto.includes(prohibido)).map((prohibido) =>
        sitio(c, prohibido),
      );
    });

    expect(usos).toEqual([]);
  });

  it('no usa ningún emoji (I3, I4, X6)', () => {
    const usos = cadenas.filter((c) => EMOJI.test(c.texto)).map((c) => sitio(c, 'emoji'));

    expect(usos).toEqual([]);
  });

  it('no usa el léxico de landing del Anexo A (X2)', () => {
    const usos = cadenas.flatMap((c) => {
      const texto = normaliza(c.texto);

      return X2.filter(({ patron }) => patron.test(texto)).map(({ termino }) => sitio(c, termino));
    });

    expect(usos).toEqual([]);
  });

  /**
   * La mutación que mata este guard, escrita como test para no tener que confiar en que alguien la
   * corra a mano: si las listas se vaciaran o los patrones dejaran de encajar, los tres casos de
   * arriba seguirían en verde sin comprobar nada. Aquí se les da de comer el texto prohibido.
   */
  it('los patrones encajan de verdad con lo que dicen prohibir', () => {
    const muestra = [
      'Ups, algo salió mal',
      // La cadena que este guard nació para matar, tal cual estaba en tres archivos antes de la
      // fase 6. Va literal y **no** se toca al cambiar el copy: es la muestra contra la que se
      // comprueba que el patrón sigue mordiendo.
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
      'Potencia tu escritura',
      'Impulsa tus notas',
      'Desbloquea todo el potencial',
      'Escribir sin fricción',
      'La solución todo en uno',
      'Lleva tus notas al siguiente nivel',
      'Revoluciona tu archivo',
      'Un editor de última generación',
      'Un backend robusto',
    ].map(normaliza);

    for (const texto of muestra) {
      const atrapada =
        X7.some((prohibido) => texto.includes(prohibido)) ||
        X2.some(({ patron }) => patron.test(texto));

      expect(atrapada, `no la atrapa ninguna regla: ${texto}`).toBe(true);
    }

    expect(EMOJI.test('✨')).toBe(true);
    expect(EMOJI.test('🎉')).toBe(true);
    // Y no muerde lo que sí se escribe: comillas latinas, medias rayas y el espacio de ancho cero
    // que usan las regiones vivas.
    expect(EMOJI.test('«Fermentos» · sin guardar\u200B')).toBe(false);
  });
});
