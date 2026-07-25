import { expect, test } from '@playwright/test';

import { E2E_PASSWORD, uniqueE2eEmail } from './support/session';

/**
 * El navegador anota en la consola toda respuesta 4xx, y el arranque de la aplicación sondea el
 * refresh a ciegas: la cookie es `HttpOnly`, así que desde JavaScript no hay forma de saber si hay
 * sesión sin preguntar. Ese `401` es el resultado normal de llegar sin sesión —no un error de la
 * aplicación— y es lo único que se tolera, y solo mientras nadie ha entrado todavía.
 */
const ANONYMOUS_REFRESH_PROBE = /status of 401 \(Unauthorized\)/;

/**
 * AC-25: el flujo de auth completo en un navegador real, contra el API real.
 *
 * Es un único caso y no cinco: lo que se verifica es que los pasos encadenan (la cuenta que se crea
 * es la que luego entra, y la sesión de esa entrada es la que sobrevive a la recarga). Partirlo en
 * casos independientes exigiría una cuenta nueva por caso y perdería justo esa continuidad.
 */
test.describe('Flujo de autenticación en el navegador (AC-25)', () => {
  test('registro, ruta protegida, cierre de sesión, vuelta a entrar y recarga', async ({
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

    const email = uniqueE2eEmail('flow');

    // 1. Registro desde el formulario.
    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeVisible();

    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
    await page.getByLabel('Nombre (opcional)').fill('Persona E2E');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // 2. La ruta protegida se ve, y con la identidad recién creada.
    const shellHeading = page.getByRole('heading', { level: 1, name: 'One Markdown' });

    await expect(shellHeading).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page).toHaveURL('/');

    // Desde aquí ya hay sesión: lo que aparezca en la consola de ahora en adelante no tiene excusa.
    const errorsBeforeSession = consoleErrors.length;

    // 3. Cerrar sesión devuelve al formulario de entrada.
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();

    // 4. Volver a entrar con las mismas credenciales.
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(shellHeading).toBeVisible();
    await expect(page).toHaveURL('/');

    // 5. La recarga tira el access token (vive solo en memoria) y la sesión se recupera sola con la
    //    cookie de refresh: si el refresh silencioso no funcionara, aquí acabaríamos en `/login`.
    await page.reload();

    await expect(shellHeading).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page).toHaveURL('/');

    // Nada inesperado en toda la travesía…
    expect(consoleErrors.filter((message) => !ANONYMOUS_REFRESH_PROBE.test(message))).toEqual([]);
    // …y desde que hay sesión, ni el sondeo: registro, salida, vuelta a entrar y recarga dejan la
    // consola completamente limpia.
    expect(consoleErrors.slice(errorsBeforeSession)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
