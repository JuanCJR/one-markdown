import { randomUUID } from 'node:crypto';

import type { APIResponse, Page } from '@playwright/test';
import { isAuthSession, isLoginResult, type AuthSession } from '@one-markdown/shared';

import { E2E_API_ORIGIN } from './dev-env';

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
 * Crea la cuenta compartida **una sola vez por ejecución**, antes de que arranque ningún caso.
 *
 * Por qué está aquí y no dentro de `signIn` (AC-35): el alta de esta cuenta es preparación de la
 * suite, no algo que mida ningún caso, y hacerla una vez tiene dos efectos que importan.
 *
 * 1. **Gasta una sola alta del cupo** (5 por IP cada 15 min) en vez de una por caso del smoke.
 * 2. **Elimina la carrera** que aparecería si cada trabajador la preparase por su cuenta: en local
 *    Playwright levanta varios trabajadores a la vez, todos empezarían con un `login` fallido
 *    contra una cuenta que aún no existe y cinco fallos seguidos **bloquean la cuenta** quince
 *    minutos (`LoginAttemptService`, spec 001). El bloqueo es por cuenta, no por IP, así que el
 *    reset del cupo de altas no lo evitaría.
 *
 * `global-setup` corre después de que Playwright levante los `webServer`, así que el API ya
 * responde. Si aun así no se pudiera hablar con él, se avisa y se sigue: `signIn` conserva su
 * camino de reserva y el rojo, si lo hay, saldrá donde se pueda leer.
 */
export async function ensureSharedAccount(): Promise<void> {
  const response = await fetch(`${E2E_API_ORIGIN}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: SHARED_ACCOUNT_EMAIL, password: E2E_PASSWORD }),
  }).catch((cause: unknown) => cause);

  if (!(response instanceof Response)) {
    console.warn(
      `[e2e] no se pudo preparar la cuenta compartida: ${response instanceof Error ? response.message : String(response)}`,
    );

    return;
  }

  // `409` es el caso normal cuando una ejecución anterior no llegó a limpiarla: ya está creada.
  if (!response.ok && response.status !== 409) {
    throw new Error(
      `No se pudo preparar la cuenta compartida: POST /api/auth/register devolvió ${String(response.status)} ${await response.text()}`,
    );
  }

  console.warn(`[e2e] cuenta compartida lista: ${SHARED_ACCOUNT_EMAIL}`);
}

/** La sesión que `signIn` deja abierta, con lo que hace falta para hablar con el API desde el caso. */
export interface E2eSession {
  readonly email: string;
  /**
   * Cabecera `Authorization` de **esta misma** sesión, lista para `page.request`.
   *
   * Sale del `accessToken` que devuelve el propio `login` que ya se hacía: no cuesta ni una petición
   * más. Antes, quien necesitaba un `Bearer` desde un caso cargaba la aplicación y se lo tomaba
   * prestado de la petición del árbol, lo que gastaba un arranque entero (`POST /auth/refresh` +
   * `GET /workspace/tree`) por caso solo para leer una cabecera — y el cupo de `workspace` (120/min
   * por IP) es justo el que aprieta en esta suite (AC-34 de la spec `003`).
   *
   * Sigue siendo la credencial de la **misma** sesión que usa la pestaña: pedir otra entrada gastaría
   * cupo y estrenaría familia, y un `refresh` desde aquí rotaría la cookie que la pestaña está usando.
   * Que el refresh silencioso del arranque rote esa cookie **no** invalida este token: el access token
   * es un JWT que `jwt-access.strategy.ts` valida por firma, `typ` y existencia del usuario, sin
   * consultar el `sid` en Redis.
   */
  readonly authorization: string;
}

function bearerOf(session: AuthSession): string {
  return `${session.tokenType} ${session.accessToken}`;
}

/**
 * La sesión de una respuesta de `login`. El cuerpo nunca se vuelca en el mensaje de error: lleva el
 * access token dentro.
 */
async function sessionOfLogin(response: APIResponse, email: string): Promise<E2eSession> {
  const body: unknown = await response.json();

  if (!isLoginResult(body) || body.session === null) {
    throw new Error(
      'POST /api/auth/login respondió 200 sin sesión utilizable: la cuenta compartida no debería pedir segundo factor',
    );
  }

  return { email, authorization: bearerOf(body.session) };
}

/** Ídem para `register`, que devuelve la sesión directamente (`AuthSessionResponseDto`). */
async function sessionOfRegister(response: APIResponse, email: string): Promise<E2eSession> {
  const body: unknown = await response.json();

  if (!isAuthSession(body)) {
    throw new Error('POST /api/auth/register respondió 2xx con un cuerpo que no es una sesión');
  }

  return { email, authorization: bearerOf(body) };
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
 *
 * **Se entra antes de registrar** (AC-35). Antes era al revés y cada caso del smoke gastaba una de
 * las cinco altas por IP aunque le respondieran `409`: tres de las cinco se iban aquí, y con
 * `retries: 2` el primer reintento de CI se quedaba sin cupo. Ahora el alta solo ocurre si
 * `ensureSharedAccount` no pudo hacerla, que es el camino de reserva y no el normal.
 */
export async function signIn(page: Page): Promise<E2eSession> {
  const credentials = { email: SHARED_ACCOUNT_EMAIL, password: E2E_PASSWORD };
  const session = await page.request.post('/api/auth/login', { data: credentials });

  if (session.ok()) {
    return await sessionOfLogin(session, credentials.email);
  }

  if (session.status() !== 401) {
    throw new Error(
      `No se pudo abrir sesión con la cuenta compartida: POST /api/auth/login devolvió ${String(session.status())} ${await session.text()}`,
    );
  }

  // Sin cuenta que valga: se estrena. Un `409` significa que otro trabajador se adelantó entre el
  // `login` y este `register`, no un fallo.
  const created = await page.request.post('/api/auth/register', { data: credentials });

  if (created.ok()) {
    return await sessionOfRegister(created, credentials.email);
  }

  if (created.status() !== 409) {
    throw new Error(
      `No se pudo preparar la cuenta compartida: POST /api/auth/register devolvió ${String(created.status())} ${await created.text()}`,
    );
  }

  const retry = await page.request.post('/api/auth/login', { data: credentials });

  if (!retry.ok()) {
    throw new Error(
      `No se pudo abrir sesión con la cuenta compartida: POST /api/auth/login devolvió ${String(retry.status())} ${await retry.text()}`,
    );
  }

  return await sessionOfLogin(retry, credentials.email);
}
