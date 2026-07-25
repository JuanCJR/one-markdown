import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';

/**
 * Prefijo de todas las cuentas que crea la suite e2e de la web.
 *
 * `global-teardown` borra por este prefijo (y el dominio `example.test` es reservado): sin un
 * prefijo compartido no habría forma de limpiar la base sin arriesgarse a tocar cuentas reales.
 */
export const E2E_EMAIL_PREFIX = 'e2e-web-';

/** Cumple las reglas de `RegisterRequestDto`: ≥12 caracteres, con letra y número. */
export const E2E_PASSWORD = 'Contrasena-e2e-2026';

/**
 * Cuenta compartida por los casos que solo necesitan *estar dentro* (el smoke).
 *
 * Es fija a propósito: el registro está limitado a cinco altas por IP cada quince minutos, así que
 * una cuenta nueva por caso agotaría el cupo y la suite fallaría por acumulación en vez de por el
 * comportamiento que mide.
 */
const SHARED_ACCOUNT_EMAIL = `${E2E_EMAIL_PREFIX}smoke@example.test`;

/** Correo único por caso, para los flujos que ejercitan el registro de verdad. */
export function uniqueE2eEmail(purpose: string): string {
  return `${E2E_EMAIL_PREFIX}${purpose}-${randomUUID().slice(0, 8)}@example.test`;
}

/**
 * Deja el contexto de la pestaña con sesión abierta en la cuenta compartida.
 *
 * `page.request` comparte el almacén de cookies con la pestaña, así que la cookie `HttpOnly` de
 * refresh que emite el API queda en el contexto y el arranque de la aplicación la usa para
 * recuperar la sesión: exactamente el camino que recorre alguien que vuelve a la app.
 *
 * Cada caso abre **su** sesión (nunca una cookie compartida entre casos): el refresh rota en cada
 * uso y reutilizar el mismo token dos veces revoca la familia de sesión en el backend.
 */
export async function signIn(page: Page): Promise<string> {
  const credentials = { email: SHARED_ACCOUNT_EMAIL, password: E2E_PASSWORD };

  // La cuenta puede no existir (base limpia, o `global-teardown` la borró): se intenta el alta y un
  // `409` significa que ya está creada, no un fallo.
  const created = await page.request.post('/api/auth/register', { data: credentials });

  if (created.ok()) {
    return credentials.email;
  }

  if (created.status() !== 409) {
    throw new Error(
      `No se pudo preparar la cuenta compartida: POST /api/auth/register devolvió ${String(created.status())} ${await created.text()}`,
    );
  }

  const session = await page.request.post('/api/auth/login', { data: credentials });

  if (!session.ok()) {
    throw new Error(
      `No se pudo abrir sesión con la cuenta compartida: POST /api/auth/login devolvió ${String(session.status())} ${await session.text()}`,
    );
  }

  return credentials.email;
}
