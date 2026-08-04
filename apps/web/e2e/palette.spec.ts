import { expect, type Locator, type Page } from '@playwright/test';

import {
  createDocument,
  SAVE_REGION_NAME,
  test,
  textarea,
  uniqueTitle,
  watchConsole,
  watchContentSaves,
} from './support/editor-e2e';

/**
 * La paleta de elementos markdown en un navegador de verdad (spec `004`: AC-29 y AC-32).
 *
 * **Por qué este archivo existe teniendo la suite de jsdom en verde** (`004/spec.md` §3.G y §3.H):
 * las dos afirmaciones que trae son, literalmente, las dos que jsdom **no puede** hacer.
 *
 * 1. El **tamaño del objetivo** (SC 2.5.8) es geometría: jsdom no calcula disposición y devuelve
 *    ceros para cualquier caja. Un `24 × 24` afirmado allí no afirmaría nada.
 * 2. El **recorrido completo** —tabulador, flechas, `Enter`, escribir, `Ctrl`+`S`, **recargar**— es
 *    la única forma de demostrar que los tres eslabones (paleta → `setDraft` → guardado de la `003`)
 *    están de verdad enganchados. Que el borrador cambie en memoria no prueba que llegue al
 *    servidor; lo prueba **la recarga**, que es lo único que no deja nada del estado del cliente.
 *
 * **Todo el recorrido es con teclado y sin un solo clic**, que es lo que AC-32 pide: si algún paso
 * necesitara el ratón, la paleta sería exactamente la barrera que esta spec existe para no crear.
 *
 * **El presupuesto (AC-33) se respeta gastando menos, no neutralizando más.** El cupo de
 * `documentContent` (120/min por IP) **no se resetea nunca** —política heredada de `003/tasks.md`
 * T-015— así que este caso hace **una sola** escritura de contenido: la inserción y el texto caen
 * dentro de una misma ventana de debounce (1.500 ms, que el `setDraft` de cada tecla reinicia) y
 * `Ctrl`+`S` la cierra con un único `PUT`. Ese «uno» está **afirmado**, no supuesto: sin la
 * aserción, un cambio que partiera el guardado en cinco peticiones se colaría en silencio y el
 * presupuesto se descubriría meses después, en un `429` de otra suite.
 *
 * Desde la `005` (AC-30), lo que este archivo comparte con `editor.spec.ts` se **importa** de
 * `support/editor-e2e.ts` en vez de copiarse, y lo vigila `src/test/e2e-support.test.ts`. La copia
 * que había aquí llegó a divergir de la otra —una de las dos no sabía tolerar nada— y esa es
 * exactamente la avería que la extracción cierra (AC-31).
 */

/** WCAG 2.2, SC 2.5.8 (*Target Size (Minimum)*): 24 × 24 px CSS. */
const MIN_TARGET_PX = 24;

/**
 * El texto que se escribe **sustituyendo** el marcador de posición que deja «Negrita»: el documento
 * acaba siendo exactamente `**…**`, y eso es lo que la vista previa tiene que pintar en un `<strong>`.
 */
const TYPED = 'recorrido solo con teclado';

/**
 * Cota del tabulador hasta la paleta. Es generosa a propósito (la barra lateral, el árbol y la
 * cabecera van delante) y es una **cota**, no un número exacto: fijar el número exacto ataría este
 * caso al recuento de paradas del resto de la página, que no es lo que mide.
 */
const MAX_TABS_TO_PALETTE = 50;

test.describe('Paleta de markdown en el navegador (AC-29, AC-32)', () => {
  test('recorrido solo con teclado, tamaño de objetivo y foco visible (AC-29, AC-32)', async ({
    page,
    session,
  }) => {
    const consoleErrors = watchConsole(page);
    const contentSaves = watchContentSaves(page);
    const title = uniqueTitle('Paleta', 'paleta');
    const documentId = await createDocument(page, session.authorization, title);

    await page.goto(`/documents/${documentId}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    const toolbar = page.getByRole('toolbar', { name: 'Elementos de markdown' });
    const bold = toolbar.getByRole('button', { name: 'Negrita' });
    const saveStatus = page.getByRole('status', { name: SAVE_REGION_NAME });

    await expect(toolbar).toBeVisible();
    await expect(textarea(page, title)).toHaveValue('');
    // Recién creado: está limpio porque nadie lo ha tocado, **no** porque se haya guardado, así que
    // el rótulo va sin hora. Inventarle una diría que ocurrió algo que no ocurrió (fase 6, §4.9).
    await expect(saveStatus).toHaveText('Guardado');

    // ---- (a) El recorrido, **sin un solo clic** -----------------------------------------------

    // El tabulador entra en la paleta por su **única** parada (AC-25): una barra de dieciséis
    // paradas obligaría a dieciséis pulsaciones para llegar al área de escritura.
    await tabUntilFocused(page, bold);
    await expect(bold).toBeFocused();

    // ---- (b) Tamaño de objetivo y foco visible, con el foco **puesto** -------------------------
    //
    // Va aquí, entre la llegada y la activación, por dos motivos: es el instante en que hay un botón
    // enfocado de verdad, y medir antes de insertar deja el debounce sin empezar (AC-33).

    const undersized: string[] = [];

    for (const button of await toolbar.getByRole('button').all()) {
      const name = (await button.getAttribute('aria-label')) ?? '(sin nombre)';
      const box = await button.boundingBox();

      // Un botón sin caja no es un botón que cumpla: es uno que no se puede pulsar.
      expect(box, `«${name}» no tiene caja`).not.toBeNull();

      if (box !== null && (box.width < MIN_TARGET_PX || box.height < MIN_TARGET_PX)) {
        undersized.push(`«${name}» ${String(box.width)} × ${String(box.height)} px`);
      }
    }

    expect(undersized, `objetivos por debajo de ${String(MIN_TARGET_PX)} px`).toEqual([]);

    const focused = await indicadorDeFocoDe(bold);
    // El contraste con un botón **sin** foco es la mitad que importa: sin ella, un adorno permanente
    // pasaría por indicador de foco sin serlo.
    const idle = await indicadorDeFocoDe(toolbar.getByRole('button', { name: 'Cursiva' }));

    // AC-29 pide **foco visible**, no un `outline`. Desde el sistema de color «Cromo» el indicador
    // dejó de ser un anillo y pasó a ser masa cromo **más** un eje de tinta de 4 px desplazado
    // (`docs/design/04-color.md` §5, utilidad `foco-cromo`). El criterio no se ha aflojado: se
    // comprueban **los dos** canales, y el eje es justamente el que cumple WCAG 1.4.11 —13.32:1—
    // porque la masa cromo sola mide 1.75:1 sobre papel claro y no bastaría.
    expect(focused.fondo, 'masa del foco').toBe(CROMO_CLARO);
    expect(focused.sombra, 'eje de tinta del foco').toContain('-4px');
    expect(focused.color, 'tinta sobre la masa de foco').toBe(SOBRE_CROMO);

    expect(idle.fondo, 'masa en un botón sin foco').not.toBe(CROMO_CLARO);
    expect(idle.sombra, 'eje en un botón sin foco').toBe('none');

    // Las flechas recorren el catálogo **atravesando los grupos** y vuelven a «Negrita». Ir y volver
    // y no quedarse quieto: la parada del tabulador ya cae en «Negrita», así que sin movimiento real
    // este paso no mediría la navegación con flechas, solo dónde empieza el foco.
    await page.keyboard.press('ArrowRight');
    await expect(toolbar.getByRole('button', { name: 'Cursiva' })).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(toolbar.getByRole('button', { name: 'Tachado' })).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(bold).toBeFocused();

    // `Enter` activa el botón enfocado, inserta el marcador de posición y **se lleva el foco al área
    // de escritura con el marcador seleccionado** (AC-21, AC-22). Por eso lo siguiente que se
    // escribe lo sustituye sin haber tocado el ratón ni haber vuelto a tabular.
    await page.keyboard.press('Enter');
    await expect(textarea(page, title)).toBeFocused();
    await expect(textarea(page, title)).toHaveValue('**texto en negrita**');
    await expect(saveStatus).toHaveText('Sin guardar');

    await page.keyboard.type(TYPED);
    await expect(textarea(page, title)).toHaveValue(`**${TYPED}**`);

    // `Ctrl`+`S` cancela el debounce pendiente y guarda **una** vez: es lo que mantiene el caso
    // dentro del presupuesto de AC-33.
    await page.keyboard.press('Control+s');
    // Con la hora: el guardado ha ocurrido de verdad y la región lo fecha (fase 6, §4.9).
    await expect(saveStatus).toHaveText(/^Guardado \d{2}:\d{2}$/);

    // **La recarga es el criterio.** Después de ella no queda nada del estado del cliente, así que
    // lo que se lea viene de la base de datos y no de un borrador que nunca salió del navegador.
    await page.reload();

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(textarea(page, title)).toHaveValue(`**${TYPED}**`);

    // La pestaña se cambia con el teclado también: el recorrido entero de AC-32 es sin ratón.
    await tabUntilFocused(page, page.getByRole('tab', { name: 'Texto' }));
    await page.keyboard.press('ArrowRight');

    const preview = page.getByRole('tabpanel');

    await expect(preview.locator('strong')).toHaveText(TYPED);

    // Un guardado, no cinco (AC-33). El cupo de `documentContent` no se resetea nunca, así que este
    // número es el que la suite entera acaba pagando multiplicado por los repeticiones y reintentos.
    expect(contentSaves(), 'peticiones de guardado de contenido').toBe(1);
    expect(consoleErrors()).toEqual([]);
  });
});

/**
 * Tabula hasta que el foco cae en `target`. Falla —con un mensaje que dice cuántas pulsaciones
 * gastó— si no llega: un bucle que se rinde en silencio convertiría «la paleta no es alcanzable con
 * el tabulador» en «el caso siguió adelante sin foco».
 */
async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
  for (let pressed = 0; pressed < MAX_TABS_TO_PALETTE; pressed += 1) {
    await page.keyboard.press('Tab');

    if (await target.evaluate((node) => node === document.activeElement)) {
      return;
    }
  }

  throw new Error(
    `El foco no llegó al destino en ${String(MAX_TABS_TO_PALETTE)} pulsaciones de Tab`,
  );
}

/** El anillo de foco tal y como lo calcula Blink, que es el que se ve. */
/**
 * Los dos canales del indicador de foco, tal y como los computa el navegador. Se comparan contra
 * los tokens del tema claro, que es el que corre la suite: si alguien mueve `--cromo` o
 * `--sobre-cromo` sin volver a medir, esto se cae, que es exactamente lo que se quiere.
 */
const CROMO_CLARO = 'oklch(0.7927 0.1574 85.3)';
const SOBRE_CROMO = 'oklch(0.2088 0.006 100)';

async function indicadorDeFocoDe(
  target: Locator,
): Promise<{ readonly fondo: string; readonly color: string; readonly sombra: string }> {
  return await target.evaluate((node) => {
    const computed = getComputedStyle(node);

    return {
      fondo: computed.backgroundColor,
      color: computed.color,
      sombra: computed.boxShadow,
    };
  });
}
