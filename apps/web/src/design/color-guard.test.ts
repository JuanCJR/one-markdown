import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Guard del sistema de color «Cromo» (docs/design/04-color.md).
 *
 * Tres prohibiciones, y las tres se comprueban por **valor computado** o por literal en el código
 * fuente, no a ojo en una revisión:
 *
 *   1. Ningún fondo con L ≥ 0.99 ni L ≤ 0.02 — ni blanco puro ni negro puro por la puerta de atrás.
 *   2. Ningún `bg-white` / `bg-black` en el código.
 *   3. Ningún acento en el rango de matiz 265-320 (índigo-violeta-morado), que es de lo que huye
 *      la dirección.
 *
 * Estas reglas valen para el color decidido. Si algún día hay que tocarlas, se toca antes
 * `docs/design/04-color.md`: el documento manda y el test lo hace exigible.
 */

// `fileURLToPath` y no `.pathname`: en Vitest la URL del módulo llega con el prefijo `/@fs` del
// servidor de Vite y `readdirSync` buscaría un directorio que no existe.
const RAIZ = fileURLToPath(new URL('../..', import.meta.url.replace('/@fs', ''))); // apps/web
const EXTENSIONES = new Set(['.css', '.ts', '.tsx', '.html']);
const IGNORADOS = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', '.vite']);

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
      acumulado.push({ ruta: relative(RAIZ, ruta), contenido: readFileSync(ruta, 'utf8') });
    }
  }

  return acumulado;
}

const archivos = [...recoge(join(RAIZ, 'src')), ...recoge(join(RAIZ, 'e2e'))].concat({
  ruta: 'index.html',
  contenido: readFileSync(join(RAIZ, 'index.html'), 'utf8'),
});

/** Este archivo se describe a sí mismo con las cadenas prohibidas: se excluye o se muerde la cola. */
const inspeccionados = archivos.filter((a) => !a.ruta.endsWith('color-guard.test.ts'));

interface Declaracion {
  readonly ruta: string;
  readonly linea: number;
  readonly texto: string;
  readonly L: number;
  readonly C: number;
  readonly H: number;
}

/** Toda declaración `oklch(L C H)` del código, con su sitio, para poder señalarla al fallar. */
function declaracionesOklch(): Declaracion[] {
  const patron = /oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*(?:\/[^)]*)?\)/gi;

  return inspeccionados.flatMap((archivo) =>
    archivo.contenido.split('\n').flatMap((texto, indice) => {
      const encontradas: Declaracion[] = [];
      let coincidencia: RegExpExecArray | null;

      patron.lastIndex = 0;

      while ((coincidencia = patron.exec(texto)) !== null) {
        encontradas.push({
          ruta: archivo.ruta,
          linea: indice + 1,
          texto: coincidencia[0],
          L: Number(coincidencia[1]),
          C: Number(coincidencia[2]),
          H: Number(coincidencia[3]),
        });
      }

      return encontradas;
    }),
  );
}

function sitio(d: Declaracion): string {
  return `${d.ruta}:${d.linea} → ${d.texto}`;
}

describe('guard del sistema de color', () => {
  /**
   * Un guard que no mira nada pasa siempre. Antes de creerse un verde, se comprueba que el
   * instrumento tiene delante lo que dice tener («no creerse un cero falso»).
   */
  it('inspecciona el código de verdad: hay archivos y hay tokens OKLCH', () => {
    expect(inspeccionados.length).toBeGreaterThan(20);
    expect(inspeccionados.some((a) => a.ruta.endsWith('styles/tokens-cromo.css'))).toBe(true);
    expect(declaracionesOklch().length).toBeGreaterThanOrEqual(24);
  });

  it('no declara ningún color con L ≥ 0.99 ni L ≤ 0.02 (ni blanco ni negro puros)', () => {
    const fuera = declaracionesOklch().filter((d) => d.L >= 0.99 || d.L <= 0.02);

    expect(fuera.map(sitio)).toEqual([]);
  });

  it('no usa bg-white ni bg-black', () => {
    // Utilidades de **fondo y de límite**, que es lo que prohíbe la regla: ninguna zona, ningún
    // borde y ningún anillo puede ser blanco o negro puros.
    //
    // `text-white` queda deliberadamente fuera: sobrevive en los botones azules y rojos heredados
    // (`bg-blue-700 text-white`), que no son de este sistema y mueren enteros en el restyle —el
    // primario pasa a masa cromo con `--sobre-cromo`, y el rojo no existe—. Prohibirlo hoy
    // obligaría a inventar el color de esos botones, que es justamente lo que no toca decidir aquí.
    // Inventario y salida, en `docs/design/04-color.md` §6.
    const prohibidas = /\b(bg|border|ring|outline|divide|from|via|to)-(white|black)\b/g;

    const usos = inspeccionados.flatMap((archivo) =>
      archivo.contenido
        .split('\n')
        .flatMap((linea, indice) =>
          [...linea.matchAll(prohibidas)].map((m) => `${archivo.ruta}:${indice + 1} → ${m[0]}`),
        ),
    );

    expect(usos).toEqual([]);
  });

  it('no declara blanco ni negro puros en CSS por la puerta de atrás', () => {
    // La prohibición es por valor, no por cadena: da igual que se escriba `#fff`, `white`,
    // `rgb(255,255,255)` o un `oklch(1 0 0)`. Se mira el **valor de una declaración CSS**, que es
    // donde de verdad se pinta un fondo.
    const declaracionCss =
      /:\s*(#fff|#ffffff|#000|#000000|white|black|rgba?\(\s*255\s*,\s*255\s*,\s*255|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)])/gi;

    const usos = inspeccionados
      .filter((archivo) => archivo.ruta.endsWith('.css'))
      .flatMap((archivo) =>
        archivo.contenido
          .split('\n')
          .flatMap((linea, indice) =>
            [...linea.matchAll(declaracionCss)].map(
              (m) => `${archivo.ruta}:${indice + 1} → ${m[0].trim()}`,
            ),
          ),
      );

    expect(usos).toEqual([]);
  });

  it('no tiene ningún acento en el rango de matiz prohibido 265-320', () => {
    // Acento = tiene croma de verdad. Los neutros del sistema van a C ≤ 0.006 y no pintan nada
    // como acento aunque su matiz cayera ahí.
    const acentos = declaracionesOklch().filter((d) => d.C >= 0.03);
    const prohibidos = acentos.filter((d) => d.H >= 265 && d.H <= 320);

    expect(acentos.length).toBeGreaterThan(0); // si no hay acentos, la regla no ha comprobado nada
    expect(prohibidos.map(sitio)).toEqual([]);
  });
});
