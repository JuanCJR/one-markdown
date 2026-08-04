import { expect, test } from '@playwright/test';

import { resetLoginThrottleCounter } from './support/services';
import { signIn } from './support/session';

test.describe('Smoke (AC-11)', () => {
  /**
   * Desde la spec 001 (T-022) el árbol de la aplicación vive detrás de `RequireAuth`: sin sesión,
   * `/` redirige a `/login` y no hay ni `main` ni `navigation` que comprobar.
   *
   * Se siembra la sesión por el API (la cookie `HttpOnly` de refresh queda en el contexto) en vez de
   * pasar por el formulario: lo que mide este archivo es que la aplicación carga, no cómo se entra
   * —eso es AC-25, en `auth.spec.ts`—. La exigencia no baja: la carga sigue teniendo que ocurrir sin
   * un solo error de consola, y ahora además con el refresh silencioso de por medio.
   */
  test.beforeEach(async ({ page }) => {
    // Cada caso abre **su** sesión, así que con reintentos las entradas se acumulan contra el cupo
    // de diez por minuto y el rojo acabaría siendo un `429` ajeno a lo que este archivo mide
    // (AC-35). Lo que se pierde con este reset, y por qué se acepta, está en `support/services.ts`.
    await resetLoginThrottleCounter();
    await signIn(page);
  });

  test('la app carga en el navegador sin errores de consola', async ({ page }) => {
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

    await page.goto('/');

    await expect(page).toHaveTitle('One Markdown');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    // El nombre de la aplicación ya **no** es un `h1` (fase 6, §4.1): el `h1` de cada pantalla es lo
    // que esa pantalla contiene, y el nombre vive en el bloqueo de la cabecera y en el título de la
    // pestaña, que se acaba de afirmar arriba. Se consulta por **rol y nombre accesible**, que es lo
    // que oye un lector de pantalla, y no por el texto dibujado dentro del SVG.
    await expect(
      page.getByRole('banner').getByRole('img', { name: 'One Markdown' }),
    ).toBeAttached();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('una ruta desconocida muestra el 404 sin perder la navegación', async ({ page }) => {
    await page.goto('/ruta-que-no-existe');

    // **Por rol y no por texto suelto** (arreglo de la `006`): `getByText(/404/)` casaba también con
    // cualquier documento del árbol cuyo título aleatorio contuviera «404» dentro del hex —pasó de
    // verdad con «Pestañas izquierda 02740494»—, y eso es violación de modo estricto: dos elementos.
    // El rojo era **real y ajeno**, aparecía solo cuando el árbol tenía documentos de otros casos, y
    // se hace más probable con cada suite que crea documentos. Misma lección que la `T-012` de la
    // `004`: una consulta que puede resolver a otra cosa es una mina puesta para otro.
    // Sin el número: `404` es el código con el que hablan dos máquinas (fase 6, §4.9). La consulta
    // sigue siendo por encabezado y no por texto suelto, por la misma razón que ya estaba escrita
    // arriba: un documento titulado así haría que una consulta por texto resolviera a otra cosa.
    await expect(
      page.getByRole('heading', { name: 'Esta dirección no está en tu archivo.' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('el toggle de la estructura responde al teclado', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /^(mostrar|ocultar) la estructura$/i });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.focus();
    await page.keyboard.press('Enter');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
