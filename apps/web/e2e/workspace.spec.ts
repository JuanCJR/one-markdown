import { expect, test, type Locator, type Page } from '@playwright/test';

import { resetRegisterThrottleCounter } from './support/services';
import { E2E_PASSWORD, uniqueE2eEmail } from './support/session';

/**
 * Mismo permiso que en `auth.spec.ts`: el arranque de la aplicación sondea el refresh a ciegas
 * porque la cookie es `HttpOnly`, y ese `401` es la respuesta normal de quien llega sin sesión. Se
 * tolera **solo** mientras nadie ha entrado todavía; a partir del registro, la consola tiene que
 * quedar completamente limpia.
 */
const ANONYMOUS_REFRESH_PROBE = /status of 401 \(Unauthorized\)/;

/** Nombres del recorrido. Cada ejecución estrena cuenta, así que no necesitan ser únicos. */
const DIRECTORY = 'Notas';
const SUBDIRECTORY = 'Diario';
const DOCUMENT_DRAFT = 'Borrador';
const DOCUMENT = 'Diario de julio';

/**
 * AC-32: el árbol completo en un navegador real, contra el API real.
 *
 * Es un único caso encadenado, igual que el flujo de auth: lo que se verifica es que un directorio
 * creado desde la interfaz es el que luego acoge un subdirectorio, y que el documento que nace ahí
 * dentro es el mismo que se renombra, se mueve, se abre y sobrevive al borrado recursivo de su
 * antiguo abuelo. Partirlo en casos sueltos exigiría sembrar el estado por el API y dejaría de
 * medir justo eso.
 */
test.describe('Recorrido del árbol en el navegador (AC-32)', () => {
  /**
   * Mismo motivo que en `auth.spec.ts`: el recorrido estrena cuenta en cada intento y con
   * `retries: 2` las tres altas se sumarían al cupo de cinco por IP. El contador de altas arranca a
   * cero para que el número de reintentos deje de decidir si la suite pasa (AC-35).
   */
  test.beforeEach(async () => {
    await resetRegisterThrottleCounter();
  });

  test('crear, renombrar, mover, abrir y borrar en recursivo sin errores de consola', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // 1. Cuenta nueva: el correo es único por ejecución, así que el árbol de partida está vacío
    //    incluso si un intento anterior murió a mitad de camino.
    const email = uniqueE2eEmail('workspace');

    await page.goto('/register');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'One Markdown' })).toBeVisible();

    // El contenedor del árbol existe desde el principio, pero vacío no ocupa un solo píxel: quien
    // cuenta que no hay nada es el texto de la barra lateral, no una caja invisible.
    await expect(page.getByRole('tree', { name: 'Documentos' })).toBeAttached();
    await expect(page.getByText('Todavía no hay directorios ni documentos.')).toBeVisible();

    // Desde aquí ya hay sesión: cualquier cosa que aparezca en la consola es un defecto.
    const errorsBeforeSession = consoleErrors.length;

    // 2. Un directorio en la raíz.
    await page.getByRole('button', { name: 'Nuevo en la raíz' }).click();

    const rootCreate = page.getByRole('dialog', { name: 'Nuevo en la raíz' });

    // El tipo por defecto es «Directorio», así que crear una categoría es escribir y aceptar.
    await expect(rootCreate.getByRole('radio', { name: 'Directorio' })).toBeChecked();
    await rootCreate.getByLabel('Nombre').fill(DIRECTORY);
    await rootCreate.getByRole('button', { name: 'Crear' }).click();

    await expect(rootCreate).toBeHidden();
    await expect(treeItem(page, DIRECTORY)).toBeVisible();

    // 3. Un subdirectorio dentro: el padre se despliega solo, sin tener que abrirlo a mano.
    await page.getByRole('button', { name: `Nuevo en «${DIRECTORY}»` }).click();

    const nestedCreate = page.getByRole('dialog', { name: `Nuevo en «${DIRECTORY}»` });

    await nestedCreate.getByLabel('Nombre').fill(SUBDIRECTORY);
    await nestedCreate.getByRole('button', { name: 'Crear' }).click();

    await expect(nestedCreate).toBeHidden();
    await expect(treeItem(page, DIRECTORY)).toHaveAttribute('aria-expanded', 'true');
    await expect(treeItem(page, SUBDIRECTORY)).toHaveAttribute('aria-level', '2');

    // 4. Un documento dentro del subdirectorio. Al elegir «Documento» el campo deja de pedir un
    //    nombre y pasa a pedir un título: un documento no se llama igual que una carpeta.
    await page.getByRole('button', { name: `Nuevo en «${SUBDIRECTORY}»` }).click();

    const documentCreate = page.getByRole('dialog', { name: `Nuevo en «${SUBDIRECTORY}»` });

    await documentCreate.getByRole('radio', { name: 'Documento' }).check();
    await expect(documentCreate.getByLabel('Nombre')).toHaveCount(0);
    await documentCreate.getByLabel('Título').fill(DOCUMENT_DRAFT);
    await documentCreate.getByRole('button', { name: 'Crear' }).click();

    await expect(documentCreate).toBeHidden();
    await expect(treeItem(page, DOCUMENT_DRAFT)).toHaveAttribute('aria-level', '3');

    // 5. Renombrarlo. El campo llega precargado con el título actual.
    await page.getByRole('button', { name: `Renombrar «${DOCUMENT_DRAFT}»` }).click();

    const rename = page.getByRole('dialog', { name: `Renombrar «${DOCUMENT_DRAFT}»` });

    await expect(rename.getByLabel('Título')).toHaveValue(DOCUMENT_DRAFT);
    await rename.getByLabel('Título').fill(DOCUMENT);
    await rename.getByRole('button', { name: 'Guardar' }).click();

    await expect(rename).toBeHidden();
    await expect(treeItem(page, DOCUMENT)).toBeVisible();
    await expect(treeItem(page, DOCUMENT_DRAFT)).toHaveCount(0);

    // 6. Moverlo a la raíz. El destino se elige por su ruta completa, y la raíz es la primera
    //    opción; el subdirectorio se queda donde está, que es lo que hará falta para el borrado
    //    recursivo del paso 8.
    await page.getByRole('button', { name: `Mover «${DOCUMENT}»` }).click();

    const move = page.getByRole('dialog', { name: `Mover «${DOCUMENT}»` });

    // La raíz encabeza la lista y cada directorio se ofrece por su ruta completa, que es lo que
    // distingue dos «Diario» que cuelgan de sitios distintos.
    await expect(move.getByRole('option')).toHaveText([
      'Raíz',
      DIRECTORY,
      `${DIRECTORY} / ${SUBDIRECTORY}`,
    ]);
    await move.getByLabel('Destino').selectOption({ label: 'Raíz' });
    await move.getByRole('button', { name: 'Mover' }).click();

    await expect(move).toBeHidden();
    await expect(treeItem(page, DOCUMENT)).toHaveAttribute('aria-level', '1');
    await expect(treeItem(page, SUBDIRECTORY)).toHaveAttribute('aria-level', '2');

    // 7. Abrirlo desde el árbol: la aplicación navega a su ruta y enseña lo que hay dentro.
    await treeItem(page, DOCUMENT).getByText(DOCUMENT, { exact: true }).click();

    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/);
    await expect(treeItem(page, DOCUMENT)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 2, name: DOCUMENT })).toBeVisible();

    // La ruta del documento es un único paso: acaba de mudarse a la raíz.
    await expect(page.getByRole('navigation', { name: 'Ruta del documento' })).toHaveText(DOCUMENT);

    // El markdown se lee en crudo. Está vacío porque un documento nace sin texto y hasta la spec
    // 003 no hay editor: lo que se comprueba aquí es que la vista trae **el contenido del
    // servidor**, no un hueco sin pedir —de ahí que la región tenga que existir y estar visible—.
    const raw = page.getByRole('region', { name: 'Markdown en crudo' });

    await expect(raw).toBeVisible();
    await expect(raw).toHaveText('');

    // 8. Borrar el directorio, que sigue teniendo dentro el subdirectorio: la confirmación dice
    //    cuánto se lleva por delante y solo entonces el borrado sale en recursivo.
    await page.getByRole('button', { name: `Borrar «${DIRECTORY}»` }).click();

    const remove = page.getByRole('dialog', { name: `Borrar «${DIRECTORY}»` });

    await expect(remove.getByText(`¿Seguro que quieres borrar «${DIRECTORY}»?`)).toBeVisible();
    await expect(remove.getByText('También se borrará su contenido: 1 elemento.')).toBeVisible();
    await remove.getByRole('button', { name: 'Borrar' }).click();

    await expect(remove).toBeHidden();

    // 9. El árbol queda con el documento movido y con nada más: el subdirectorio cayó con su padre.
    const rows = page.getByRole('treeitem');

    await expect(rows).toHaveCount(1);
    await expect(rows).toHaveAccessibleName(DOCUMENT);

    // El documento abierto no era del subárbol borrado, así que sigue a la vista y en su ruta.
    await expect(page.getByRole('heading', { level: 2, name: DOCUMENT })).toBeVisible();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/);

    // Nada inesperado en toda la travesía…
    expect(consoleErrors.filter((message) => !ANONYMOUS_REFRESH_PROBE.test(message))).toEqual([]);
    // …y desde que hay sesión, ni el sondeo: nueve pasos de árbol sin una sola queja del navegador.
    expect(consoleErrors.slice(errorsBeforeSession)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

/**
 * La fila de un nodo por su nombre accesible, que es **solo** el nombre del nodo (los botones de
 * acción quedan fuera gracias al `aria-labelledby` de la fila).
 *
 * `exact` no es opcional: sin él «Diario» también casaría con «Diario de julio».
 */
function treeItem(page: Page, name: string): Locator {
  return page.getByRole('treeitem', { name, exact: true });
}
