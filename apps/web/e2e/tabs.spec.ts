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
 * Pestañas y vista dividida en un navegador de verdad (spec `005`: AC-19, y el recorrido de AC-21 y
 * AC-22 sobre la tira montada en el `AppShell`).
 *
 * **Por qué este archivo existe teniendo `DocumentTabs.test.tsx` y `DocumentEditorPage.test.tsx` en
 * verde**: las dos cosas que trae son, literalmente, las dos que jsdom **no puede** hacer.
 *
 * 1. **La disposición** (AC-19) es geometría: jsdom no calcula *layout* y devuelve ceros para
 *    cualquier caja, así que un «lado a lado» afirmado allí no afirmaría nada. Es el mismo motivo
 *    que puso el tamaño de objetivo de la `004` (su AC-29) en el navegador, y por eso el **tamaño de
 *    objetivo** de las pestañas viaja en este mismo caso: mide con el mismo mecanismo.
 * 2. **El recorrido de la tira** con la aplicación entera montada. La unit prueba el componente
 *    aislado; aquí la tira convive con la barra lateral, la cabecera y el enrutador, y lo que se
 *    demuestra es que sigue estando a **una** parada de tabulación de la cabecera, que las flechas
 *    mueven el foco de verdad y que cerrar con `Delete` mueve **el foco y la URL** a la vez.
 *
 * **Dos casos y un solo archivo, y es política de presupuesto y no de estilo** (AC-33): cada caso
 * paga una entrada del cupo de `login` (10/min por IP), así que repartir lo mismo en más archivos
 * gasta cupo sin comprar cobertura.
 *
 * **El presupuesto se respeta gastando menos, no neutralizando más.** El cupo de `documentContent`
 * (120/min por IP) **no se resetea nunca** —política heredada de `003/tasks.md` T-015— y ninguno de
 * estos dos casos necesita escribir contenido para afirmar lo suyo: la geometría no depende del
 * texto y el recorrido tampoco. Así que los dos gastan **cero** peticiones de ese cupo, y ese cero
 * está **afirmado** y no supuesto: sin la aserción, un cambio que ensuciara el borrador por el
 * camino —y con él, el guardado automático de la `003`— entraría en silencio y el coste se
 * descubriría meses después, en un `429` de otra suite.
 */

/** WCAG 2.2, SC 2.5.8 (*Target Size (Minimum)*): 24 × 24 px CSS. */
const MIN_TARGET_PX = 24;

/**
 * Rótulo del tercer modo del conmutador (`VIEW_MODE_LABELS.split`).
 *
 * Se escribe aquí en vez de importarse de `DocumentEditorPage.tsx` a propósito: es un `.tsx`, y
 * traerlo obligaría a este proceso a cargar React entero para leer una cadena. Quien impide que el
 * rótulo y la enumeración se separen es AC-14, que los afirma el uno contra la otra en la unit; aquí
 * la consecuencia de un rótulo cambiado es un rojo inmediato y legible, no un falso verde.
 */
const VIEW_MODE_SPLIT = 'Dividida';

/** Caja de un elemento en el navegador, o un fallo que dice **de qué** elemento se hablaba. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

test.describe('Pestañas y vista dividida en el navegador (AC-19)', () => {
  test('recorrer la tira y cerrar la del medio, solo con teclado (AC-21, AC-22)', async ({
    page,
    session,
  }) => {
    const consoleErrors = watchConsole(page);
    const contentSaves = watchContentSaves(page);
    const { authorization } = session;

    // Los tres se crean **por API** y no por el árbol: lo que este caso mide es el recorrido, no la
    // creación —que ya la mide `editor.spec.ts`—, y cada diálogo de creación cuesta peticiones del
    // cupo que aprieta (`workspace`, 120/min) sin añadir nada a la afirmación.
    //
    // **Tres y no dos**: con dos pestañas, «envolver por el extremo» y «ir a la otra» son
    // indistinguibles, y cerrar la del medio no existe.
    const titles = {
      left: uniqueTitle('Pestañas', 'izquierda'),
      middle: uniqueTitle('Pestañas', 'centro'),
      right: uniqueTitle('Pestañas', 'derecha'),
    } as const;

    const ids = {
      left: await createDocument(page, authorization, titles.left),
      middle: await createDocument(page, authorization, titles.middle),
      right: await createDocument(page, authorization, titles.right),
    } as const;

    await page.goto(`/documents/${ids.left}`);
    await expect(page.getByRole('heading', { level: 2, name: titles.left })).toBeVisible();

    // Las otras dos se abren desde el árbol con `Enter`, **sin recargar**: `page.goto` reiniciaría
    // la aplicación y con ella `openIds`, que no se persiste (decisión D de la spec), y la tira se
    // quedaría con una sola pestaña. El orden de apertura es el orden de la tira.
    for (const title of [titles.middle, titles.right]) {
      await page.getByRole('treeitem', { name: title, exact: true }).press('Enter');
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
    }

    const strip = page.getByRole('tablist', { name: 'Documentos abiertos' });
    // Por título **no exacto**: el nombre accesible lleva «…» alrededor, el «· Supr para cerrar» y,
    // si el documento se ensucia, un «· sin guardar» (AC-23, AC-24). Una consulta por nombre exacto
    // se rompería sola en cuanto alguien escribiera una tecla.
    const tabFor = (title: string): Locator => strip.getByRole('tab', { name: title });

    await expect(strip.getByRole('tab')).toHaveCount(3);

    // ---- (a) La tira está a **una** tabulación de la cabecera ---------------------------------
    //
    // Una sola pulsación y no un bucle que tantea: eso es justo lo que afirma el roving tabindex de
    // AC-20 en un navegador de verdad. Con una parada por pestaña harían falta tres, y este `Tab`
    // aterrizaría en la primera en vez de en la activa.
    await page.getByRole('button', { name: 'Cerrar sesión' }).focus();
    await page.keyboard.press('Tab');
    await expect(
      tabFor(titles.right),
      'la parada del tabulador es la pestaña activa',
    ).toBeFocused();

    // ---- (b) Ida y vuelta con las flechas (AC-21) ----------------------------------------------
    //
    // **Ida y vuelta** y no solo ida: la parada del tabulador ya cae en una pestaña, así que un
    // recorrido en un solo sentido acabaría midiendo dónde empieza el foco y no la navegación
    // (lección de AC-32 de la `004`). Las flechas mueven el **foco**; la selección no las sigue, y
    // por eso la URL no cambia hasta el `Enter` de más abajo.
    const arrowJourney = [
      // Ida, envolviendo por la derecha en el primer paso.
      { key: 'ArrowRight', lands: titles.left },
      { key: 'ArrowRight', lands: titles.middle },
      { key: 'ArrowRight', lands: titles.right },
      // Vuelta, envolviendo por la izquierda en el último.
      { key: 'ArrowLeft', lands: titles.middle },
      { key: 'ArrowLeft', lands: titles.left },
      { key: 'ArrowLeft', lands: titles.right },
      // Y los dos extremos por su nombre.
      { key: 'Home', lands: titles.left },
      { key: 'End', lands: titles.right },
    ] as const;

    for (const step of arrowJourney) {
      await page.keyboard.press(step.key);
      await expect(tabFor(step.lands), `${step.key} deja el foco en «${step.lands}»`).toBeFocused();
    }

    await expect(page, 'recorrer con flechas no navega').toHaveURL(`/documents/${ids.right}`);

    // ---- (c) Activar la del medio y cerrarla con `Delete` (AC-22, AC-5) ------------------------

    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(tabFor(titles.middle)).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/documents/${ids.middle}`);
    await expect(page.getByRole('heading', { level: 2, name: titles.middle })).toBeVisible();
    await expect(tabFor(titles.middle)).toHaveAttribute('aria-selected', 'true');
    // Navegar no puede tirar el foco al `<body>`: quien acaba de activar con el teclado sigue en la
    // tira y su siguiente flecha tiene que funcionar.
    await expect(tabFor(titles.middle)).toBeFocused();

    await page.keyboard.press('Delete');

    // El foco cae en **la vecina de la derecha** (AC-5) y, por haber cerrado la activa, la URL la
    // sigue (AC-4 al revés). Las dos mitades juntas: sin la del foco, cerrar mandaría al `<body>`;
    // sin la de la URL, la tira quedaría marcando un documento que la página no muestra.
    await expect(strip.getByRole('tab')).toHaveCount(2);
    await expect(tabFor(titles.right), 'el foco cae en la vecina de la derecha').toBeFocused();
    await expect(page).toHaveURL(`/documents/${ids.right}`);
    await expect(tabFor(titles.right)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 2, name: titles.right })).toBeVisible();
    // Y la de la izquierda sigue donde estaba: cerrar una pestaña cierra **una**.
    await expect(tabFor(titles.left)).toBeVisible();

    // La región viva de la tira lo cuenta, y se la consulta por **nombre** y nunca por contenido
    // (AC-26, AC-28): `filter({ hasText })` no lee `aria-label`, así que una consulta por texto
    // sobreviviría verde a que alguien le quitara el nombre.
    await expect(page.getByRole('status', { name: 'Pestañas abiertas' })).toContainText(
      titles.middle,
    );

    // Ni una escritura de contenido: ningún borrador se ensució, así que el cierre no tuvo nada que
    // forzar. El cupo de `documentContent` no se resetea nunca (AC-33).
    expect(contentSaves(), 'peticiones de guardado de contenido').toBe(0);
    expect(consoleErrors()).toEqual([]);
  });

  test('la vista dividida pone los dos paneles lado a lado y las pestañas son pulsables (AC-19)', async ({
    page,
    session,
  }) => {
    const consoleErrors = watchConsole(page);
    const contentSaves = watchContentSaves(page);
    const title = uniqueTitle('Pestañas', 'geometria');
    const documentId = await createDocument(page, session.authorization, title);

    await page.goto(`/documents/${documentId}`);
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();

    // ---- (a) El ancho útil **antes**, que es la mitad del AC que nadie mira ---------------------
    //
    // Se mide el `role="tabpanel"`, que es la superficie de edición: el `<textarea>` de una columna
    // es por fuerza más estrecho que el de una sola columna, así que medirlo a él convertiría AC-19
    // en un criterio imposible. Lo que el AC vigila es que **la página** ensanche al dividirse
    // (`max-w-3xl` → `max-w-6xl`): sin ese ensanche, dos columnas dentro de 768 px serían dos
    // columnas inservibles y el defecto pasaría verde.
    const panel = page.getByRole('tabpanel');
    const textModeWidth = (await boxOf(panel, 'panel en modo Texto')).width;

    expect(textModeWidth).toBeGreaterThan(0);

    // `exact: true`, y no es manía: el nombre accesible de una **pestaña de documento** lleva su
    // título dentro, la coincidencia por defecto es por subcadena, y en esta página conviven los dos
    // `tablist`. Un documento titulado «… dividida …» resolvía esta consulta a dos elementos y el
    // caso moría en violación de modo estricto antes de llegar a medir nada. Medido, no supuesto.
    await page.getByRole('tab', { name: VIEW_MODE_SPLIT, exact: true }).click();

    // ---- (b) Los dos paneles, del **mismo** documento y a la vez -------------------------------

    const editorPane = page.getByRole('region', { name: 'Texto' });
    const previewPane = page.getByRole('region', { name: 'Vista previa' });

    await expect(textarea(page, title)).toBeVisible();
    await expect(editorPane).toBeVisible();
    await expect(previewPane).toBeVisible();

    // ---- (c) Lado a lado, que es lo que jsdom no puede decir -----------------------------------

    const editorBox = await boxOf(editorPane, 'panel de texto');
    const previewBox = await boxOf(previewPane, 'panel de vista previa');

    // Mismo borde superior: son dos columnas de la misma fila, no dos bloques apilados. Con
    // tolerancia de medio píxel, que es lo que separa «la misma fila» de «un redondeo subpíxel».
    expect(editorBox.y, 'borde superior de los dos paneles').toBeCloseTo(previewBox.y, 0);

    // Sin solape horizontal, y con el editor a la izquierda: en `grid-cols-2` y lectura de
    // izquierda a derecha, el orden del documento es el orden de la pantalla.
    expect(editorBox.x, 'el panel de texto va a la izquierda').toBeLessThan(previewBox.x);
    expect(
      editorBox.x + editorBox.width,
      'el panel de texto termina antes de que empiece la vista previa',
    ).toBeLessThanOrEqual(previewBox.x);

    // Ancho > 0 los dos: una columna colapsada comparte borde superior y no solapa con nadie, así
    // que sin esto las dos aserciones de arriba pasarían sobre una vista dividida que no lo es.
    expect(editorBox.width, 'ancho del panel de texto').toBeGreaterThan(0);
    expect(previewBox.width, 'ancho del panel de vista previa').toBeGreaterThan(0);

    // ---- (d) Y el ancho útil **crece** ---------------------------------------------------------

    const splitModeWidth = (await boxOf(panel, 'panel en modo Dividida')).width;

    expect(
      splitModeWidth,
      `ancho útil: ${String(splitModeWidth)} px en Dividida contra ${String(textModeWidth)} px en Texto`,
    ).toBeGreaterThan(textModeWidth);

    // ---- (e) Tamaño de objetivo de la tira (SC 2.5.8) ------------------------------------------
    //
    // Viaja en este caso y no en uno propio por presupuesto: ya hay un navegador abierto con una
    // pestaña dentro, y un caso más costaría otra entrada del cupo de `login`.

    const strip = page.getByRole('tablist', { name: 'Documentos abiertos' });
    const undersized: string[] = [];

    for (const tab of await strip.getByRole('tab').all()) {
      const name = (await tab.getAttribute('aria-label')) ?? '(sin nombre)';

      undersized.push(...(await measureTarget(tab, `pestaña ${name}`)));
      // La «×» es un `<span aria-hidden>` (decisión B de la spec) y por tanto **no tiene nombre
      // accesible propio** que consultar: el suyo vive en el `aria-label` de la pestaña. Por eso se
      // localiza por su texto y no por rol, que es lo más cercano a una consulta de usuario que
      // admite un elemento deliberadamente invisible para el árbol de accesibilidad.
      undersized.push(
        ...(await measureTarget(tab.getByText('×', { exact: true }), `cierre de ${name}`)),
      );
    }

    expect(undersized, `objetivos por debajo de ${String(MIN_TARGET_PX)} px`).toEqual([]);

    // Cero escrituras de contenido: este caso no ensucia el borrador, y el cupo de
    // `documentContent` no se resetea nunca (AC-33).
    expect(contentSaves(), 'peticiones de guardado de contenido').toBe(0);
    expect(consoleErrors()).toEqual([]);
  });
});

/**
 * Caja de un elemento, con el fallo escrito en términos de **qué** elemento faltaba.
 *
 * El `throw` después del `expect` no es redundante: `toBeNull()` no estrecha el tipo, y sin él lo
 * que sigue tendría que convivir con un `null` que ya se sabe imposible.
 */
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

