import { expect, test } from '@playwright/test';

test.describe('Smoke (AC-11)', () => {
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
