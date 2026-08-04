import { randomUUID } from 'node:crypto';

import { test as base, type Locator, type Page } from '@playwright/test';

import { resetLoginThrottleCounter, resetWorkspaceThrottleCounter } from './services';
import { signIn, type E2eSession } from './session';

/**
 * Lo que comparten los archivos de navegador que abren un documento del editor (`editor.spec.ts`,
 * `palette.spec.ts` y, desde la `005`, `tabs.spec.ts`).
 *
 * **Por qué existe este archivo** (spec `005`: AC-30 y AC-31): había dos copias de todo esto, y la
 * regla de la casa es extraer a la tercera. La `004` lo dejó anotado con el motivo por el que no lo
 * hizo entonces —su lista de artefactos era un único archivo— y con la advertencia de que la copia
 * ya había empezado a divergir. Había empezado, sí: la vigilancia de la consola tenía **dos firmas**
 * distintas, y una de las dos no sabía tolerar nada. Dos copias de un ayudante son dos
 * comprobaciones que se creen la misma; esa es la avería que la extracción cierra.
 *
 * `apps/web/src/test/e2e-support.test.ts` es la guarda que impide que vuelva a pasar: lee el fuente
 * de los archivos de casos y falla si alguno se hace su propia copia de lo de aquí.
 */

/**
 * El nombre accesible de la región viva del guardado (`004`: AC-27), que es **por lo que** se la
 * distingue de la de la paleta: por cómo se llama, no por lo que dice en ese momento. Filtrar por
 * contenido resolvería igual de bien hoy, pero sería inmune a que alguien le quitara el nombre —
 * justo la regresión que AC-27 existe para impedir.
 *
 * Además, la paleta monta la **suya** desde el primer render, así que un `getByRole('status')` a
 * secas resuelve a dos elementos y entra en violación de modo estricto.
 */
export const SAVE_REGION_NAME = 'Estado del guardado';

/**
 * La sesión de cada caso, en un *fixture* automático.
 *
 * La cuenta es la **compartida** que `global-setup.ts` crea una sola vez (AC-35 de la `002`): un alta
 * cuesta del cupo de cinco por IP cada quince minutos, el más escaso de todos, y ninguna de estas
 * suites mide el registro. Lo que sí gasta es una entrada por caso, y el cupo de entradas (10/min) se
 * agotaría con los reintentos; lo que se pierde con ese reset —y quién cubre ese límite— está escrito
 * en `services.ts`.
 *
 * El cupo de la **superficie del workspace** (120/min por IP) se pone a cero por la misma razón y en
 * el mismo sitio —el **límite** del caso, nunca a mitad de una secuencia—: es el que aprieta aquí. El
 * de `documentContent` **no se toca**, y esa política es de `003/tasks.md` T-015.
 *
 * `auto: true` porque hay casos que no piden el `Bearer` en su firma pero necesitan la sesión igual:
 * sin él, un *fixture* perezoso no llegaría a ejecutarse y esos casos empezarían sin haber entrado.
 */
export const test = base.extend<{ session: E2eSession }>({
  session: [
    async ({ page }, use) => {
      await Promise.all([resetLoginThrottleCounter(), resetWorkspaceThrottleCounter()]);
      await use(await signIn(page));
    },
    { auto: true },
  ],
});

/** El textarea del modo texto, por su nombre accesible, que lleva el título del documento. */
export function textarea(page: Page, title: string): Locator {
  return page.getByRole('textbox', { name: `Texto de «${title}»` });
}

/**
 * Título único por caso, con el prefijo de la suite que lo pide.
 *
 * La cuenta es **compartida** y los casos corren en paralelo, así que dos documentos con el mismo
 * título en la raíz chocarían con un `409 DOCUMENT_TITLE_TAKEN` que no tiene nada que ver con lo que
 * se está midiendo. **El prefijo es un parámetro y no un valor fijo** justo por eso: cada suite
 * conserva el suyo y sigue produciendo títulos que no se pisan con los de las demás.
 */
export function uniqueTitle(prefix: string, purpose: string): string {
  return `${prefix} ${purpose} ${randomUUID().slice(0, 8)}`;
}

/**
 * Recoge los errores de consola y de página, y devuelve los que no estaban permitidos.
 *
 * `pageerror` va al mismo saco a propósito: una excepción sin capturar es tan defecto como un error
 * de consola, y separarlas invita a comprobar solo una.
 *
 * **Esta es la firma que sobrevivió a la unificación** (AC-31), y es la tolerante porque es la
 * superset: sin argumentos se comporta exactamente como la que no sabía tolerar nada, así que quien
 * no tenga nada que perdonar no nota la diferencia. Y quien sí —el caso de la `003` que provoca un
 * `409` a propósito— sigue pasando su patrón. Al revés no había arreglo posible.
 */
export function watchConsole(page: Page, ...tolerated: readonly RegExp[]): () => readonly string[] {
  const messages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      messages.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    messages.push(error.message);
  });

  return () => messages.filter((message) => !tolerated.some((pattern) => pattern.test(message)));
}

/**
 * Un documento vacío en la raíz, por API. Devuelve su `id`.
 *
 * Por API y no por la interfaz salvo cuando el recorrido por la interfaz **es** lo que se mide: el
 * árbol cuesta peticiones del cupo que aprieta (`workspace`, 120/min) sin añadir nada a la
 * afirmación de la mayoría de los casos.
 *
 * El `Bearer` viene del *fixture* `session`, que lo saca del `login` que ya se hacía. Antes se
 * arrancaba la aplicación en `/` solo para tomarlo prestado de la petición del árbol, y ese arranque
 * costaba un `GET /workspace/tree` por caso contra ese mismo cupo. Los detalles, en `session.ts`.
 */
export async function createDocument(
  page: Page,
  authorization: string,
  title: string,
): Promise<string> {
  const created = await page.request.post('/api/workspace/documents', {
    headers: { authorization },
    data: { title, directoryId: null },
  });

  if (!created.ok()) {
    throw new Error(
      `No se pudo crear el documento: POST /api/workspace/documents devolvió ${String(created.status())} ${await created.text()}`,
    );
  }

  return ((await created.json()) as { id: string }).id;
}

/**
 * Cuenta los guardados de contenido **contando peticiones**, no espiando el store: lo que el
 * presupuesto de cupo gasta son peticiones que llegan al API, y un espía sobre el cliente no vería
 * un reintento ni una petición duplicada por `StrictMode`.
 *
 * Vive aquí desde la `006` (AC-36). Iba por su **segunda** copia —`palette.spec.ts` y `tabs.spec.ts`,
 * **idénticas carácter por carácter**, comentario incluido— y `undo.spec.ts` habría sido la tercera.
 * A diferencia de los seis que extrajo la `005`, estas dos **no habían divergido todavía**: se
 * comprobó antes de mover, porque extraer dos copias que ya no son iguales es elegir una, y eso hay
 * que hacerlo a la vista.
 */
export function watchContentSaves(page: Page): () => number {
  let saves = 0;

  page.on('request', (request) => {
    if (request.method() === 'PUT' && /\/documents\/[0-9a-f-]{36}\/content$/.test(request.url())) {
      saves += 1;
    }
  });

  return () => saves;
}
