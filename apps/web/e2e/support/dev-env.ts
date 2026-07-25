/**
 * Entorno de la suite e2e: puertos y credenciales con los que Playwright levanta el API real.
 *
 * Vive aparte de `playwright.config.ts` porque también lo usan `global-setup`/`global-teardown`
 * para hablar con Postgres y Redis directamente.
 */

/**
 * Puerto dedicado del API para los e2e, distinto del 3001 de `pnpm dev`.
 *
 * Con el puerto de desarrollo, la suite hablaría con el proceso que la persona tenga levantado (con
 * su código, su base y su cupo de rate limit gastado) en vez de con el API que ella misma arranca.
 */
export const E2E_API_PORT = 3011;

export const E2E_API_ORIGIN = `http://localhost:${String(E2E_API_PORT)}`;

/** Origen de la web bajo test. El proxy de Vite hace que el API sea mismo origen. */
export const E2E_WEB_ORIGIN = 'http://localhost:5173';

/**
 * Servicios de infraestructura. Se respeta lo que venga del entorno (CI apunta a los suyos, con
 * Postgres en 5432) y solo se cae al `docker-compose.yml` local cuando no hay nada definido.
 */
export const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://one_markdown:one_markdown@localhost:5433/one_markdown';

export const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

/**
 * Entorno del API bajo test. Mismos valores válidos que `apps/api/test/setup-env.ts` (no se importa
 * nada de `apps/api`: la web no depende del backend para levantar su suite).
 *
 * `BCRYPT_ROUNDS=4` porque el coste 12 de producción añade ~250 ms a cada alta y a cada entrada; el
 * coste real se verifica en el test unitario de `PasswordService`, no aquí.
 */
export const apiServerEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(E2E_API_PORT),
  DATABASE_URL,
  REDIS_URL,
  WEB_ORIGIN: E2E_WEB_ORIGIN,
  JWT_ACCESS_SECRET:
    process.env['JWT_ACCESS_SECRET'] ?? 'e2e-web-access-secret-de-mas-de-32-caracteres',
  JWT_REFRESH_SECRET:
    process.env['JWT_REFRESH_SECRET'] ?? 'e2e-web-refresh-secret-de-mas-de-32-caracteres',
  // 32 bytes exactos en base64 (`Buffer.alloc(32, 7)`), fijos y sin valor real.
  MFA_ENCRYPTION_KEY:
    process.env['MFA_ENCRYPTION_KEY'] ?? 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
  BCRYPT_ROUNDS: process.env['BCRYPT_ROUNDS'] ?? '4',
};
