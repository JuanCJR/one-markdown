import { expect, test } from '@playwright/test';

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
    await expect(page.getByRole('heading', { level: 1, name: 'One Markdown' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('una ruta desconocida muestra el 404 sin perder la navegación', async ({ page }) => {
    await page.goto('/ruta-que-no-existe');

    await expect(page.getByText(/404/)).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('el toggle de la barra lateral responde al teclado', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /barra lateral/i });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.focus();
    await page.keyboard.press('Enter');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
