import { expect, type Locator } from '@playwright/test';

import {
  createDocument,
  test,
  textarea,
  uniqueTitle,
  watchConsole,
  watchContentSaves,
} from './support/editor-e2e';

/**
 * La pila de deshacer en un navegador de verdad (spec `006`: AC-32, AC-33).
 *
 * **Este archivo existe por una razón que ningún test de jsdom puede cubrir, y no es la de siempre.**
 * Lo que se demuestra aquí es que la pila **nativa del navegador** ya no interfiere: `Ctrl`+`Z` sobre
 * un `<textarea>` **controlado** al que React acaba de reescribir el `value` hacía algo impredecible
 * —restaurar un estado anterior a la inserción, deshacer dos pasos, o nada—, y esa pila **no existe en
 * jsdom**. Un caso de componente puede afirmar que nuestro historial devuelve el texto correcto; solo
 * este puede afirmar que **no corre además el deshacer del navegador**.
 *
 * La otra mitad es geometría (AC-32): jsdom no calcula *layout* y devuelve ceros para cualquier caja,
 * así que un tamaño de objetivo afirmado allí no afirmaría nada. Es el mismo motivo por el que la
 * `004` y la `005` pusieron los suyos en el navegador — y a la `005` ese caso le destapó un control
 * real de 19,73 px que la unit no podía ver.
 *
 * **Un solo caso, y es política de presupuesto y no de estilo**: cada caso paga una entrada del cupo
 * de `login` (10/min por IP), así que repartir lo mismo en más archivos gasta cupo sin comprar
 * cobertura. Es la misma decisión que tomaron `palette.spec.ts` y `tabs.spec.ts`.
 *
 * **Y este sí gasta cupo de `documentContent`**, al revés que los de la `005`: escribir es la
 * precondición de que haya algo que deshacer. Ese gasto va **afirmado** con `watchContentSaves` y no
 * supuesto, con la salvedad escrita de por qué se afirma una **cota** y no un número exacto.
 */

/** WCAG 2.2, SC 2.5.8 (*Target Size (Minimum)*): 24 × 24 px CSS. */
const MIN_TARGET_PX = 24;

/**
 * Los nombres accesibles de los dos controles, con su atajo dentro (`HISTORY_CONTROLS`).
 *
 * Se escriben aquí en vez de importarse de `DocumentEditorPage.tsx` por el mismo motivo que el rótulo
 * «Dividida» en `tabs.spec.ts`: es un `.tsx`, y traerlo obligaría a este proceso a cargar React entero
 * para leer dos cadenas. Quien impide que se separen del producto es AC-27, que los afirma en la unit;
 * aquí la consecuencia de un rótulo cambiado es un rojo inmediato y legible, no un falso verde.
 */
const UNDO_NAME = 'Deshacer · Ctrl+Z';
const REDO_NAME = 'Rehacer · Ctrl+Shift+Z';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

async function boxOf(target: Locator, what: string): Promise<Box> {
  const box = await target.boundingBox();

  expect(box, `«${what}» no tiene caja`).not.toBeNull();

  if (box === null) {
    throw new Error(`«${what}» no tiene caja`);
  }

  return box;
}

/** Los incumplimientos de SC 2.5.8 de un objetivo, con su medida dentro para poder leerla. */
async function measureTarget(target: Locator, what: string): Promise<readonly string[]> {
  const box = await boxOf(target, what);

  if (box.width >= MIN_TARGET_PX && box.height >= MIN_TARGET_PX) {
    return [];
  }

  return [`${what}: ${String(box.width)} × ${String(box.height)} px`];
}

test.describe('Deshacer en el navegador (AC-32, AC-33)', () => {
  test('Ctrl+Z deshace una inserción de la paleta, que es lo que hoy está roto (AC-33, AC-32)', async ({
    page,
    session,
  }) => {
    const consoleErrors = watchConsole(page);
    const contentSaves = watchContentSaves(page);
    const { authorization } = session;

    const title = uniqueTitle('Deshacer', 'inserción');
    const id = await createDocument(page, authorization, title);

    await page.goto(`/documents/${id}`);
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();

    const editor = textarea(page, title);
    const typed = 'hola mundo';

    await editor.click();
    await editor.fill(typed);
    await expect(editor).toHaveValue(typed);

    // ---- (a) El defecto que esta spec arregla -------------------------------------------------
    //
    // Insertar desde la paleta es una **escritura programática**: React reescribe el `value` del
    // control, y esa reescritura no entra en la pila nativa — la invalida.
    await page.getByRole('button', { name: 'Negrita' }).click();

    const inserted = `${typed}**texto en negrita**`;

    await expect(editor).toHaveValue(inserted);

    await editor.press('ControlOrMeta+z');

    // **Exactamente** el texto anterior a la inserción: ni el anterior a haber escrito, ni sin
    // cambios, ni dos pasos atrás. Con la pila nativa al mando esto no se cumplía, y por eso el
    // criterio es una igualdad y no una contención.
    await expect(editor).toHaveValue(typed);

    // ---- (b) Rehacer, y que el `preventDefault` no se haya llevado por delante nada -----------
    await editor.press('ControlOrMeta+Shift+z');
    await expect(editor).toHaveValue(inserted);

    // ---- (c) Los mismos dos pasos, ahora con los controles visibles ---------------------------
    //
    // No es repetir el caso: el atajo y el botón son **dos caminos distintos** hasta el store, y el
    // del botón es el único que existe para quien no usa teclado físico.
    const undoButton = page.getByRole('button', { name: UNDO_NAME });
    const redoButton = page.getByRole('button', { name: REDO_NAME });

    await undoButton.click();
    await expect(editor).toHaveValue(typed);
    await redoButton.click();
    await expect(editor).toHaveValue(inserted);

    // ---- (d) Tamaño de objetivo, SC 2.5.8 (AC-32) ---------------------------------------------
    //
    // Los dos en una sola aserción con **todas** las medidas dentro: fallar en el primero y ocultar
    // el segundo obligaría a dos vueltas para arreglar un defecto que se ve entero de una.
    const undersized = [
      ...(await measureTarget(undoButton, 'control «Deshacer»')),
      ...(await measureTarget(redoButton, 'control «Rehacer»')),
    ];

    expect(undersized, 'objetivos por debajo de 24 × 24 px').toEqual([]);

    // ---- (e) El presupuesto, afirmado y no supuesto -------------------------------------------
    //
    // **Una cota y no un número exacto, a propósito**: entre las acciones del navegador pasan tiempos
    // que no controla el caso, así que el debounce de 1.500 ms puede vencer una vez o dos según cómo
    // caigan. Afirmar un número exacto sería afirmar el reloj de la máquina; lo que importa —y lo que
    // esta cota protege— es que las seis escrituras de este caso **no** produzcan una petición cada
    // una, que es lo que pasaría si alguien se saltara el debounce.
    expect(contentSaves()).toBeLessThanOrEqual(4);
    expect(consoleErrors()).toEqual([]);
  });
});
