import { defineConfig, devices } from '@playwright/test';

import { apiServerEnv, E2E_API_ORIGIN, E2E_WEB_ORIGIN } from './e2e/support/dev-env';

const isCI = process.env['CI'] !== undefined;

export default defineConfig({
  // Sin `testDir`, Playwright recogería también los tests de Vitest y fallaría al arrancar.
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Spread condicional en vez de `workers: isCI ? 1 : undefined`: con `exactOptionalPropertyTypes`
  // pasar `undefined` explícito no es lo mismo que omitir la propiedad.
  ...(isCI ? { workers: 1 } : {}),
  reporter: isCI ? 'github' : 'list',
  // Cuentas de prueba y contadores de rate limit: se limpian antes y después de la suite.
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: E2E_WEB_ORIGIN,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // El API real, no un mock: lo que verifica AC-25 es que el navegador, el proxy, las cookies y
      // el backend encajan. `nest start` compila y arranca la misma app que se despliega.
      command: 'pnpm --filter @one-markdown/api exec nest start',
      url: `${E2E_API_ORIGIN}/api/health`,
      env: apiServerEnv,
      // Nunca se reutiliza: un API vivo en este puerto sería de una ejecución anterior (o con otro
      // entorno), y depurar un `429` heredado o un endpoint que falta cuesta más que los segundos
      // que ahorra. La compilación del API es lo que domina el arranque, no el reuso.
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // `pnpm dev` a secas, sin `--force`. Aquí hubo un `--force` mientras el defecto de la caché
      // de `optimizeDeps` seguía vivo; se retira a propósito (AC-34): quien fuerza la
      // reoptimización es ahora `vite.config.ts`, que es donde el arreglo alcanza también a quien
      // desarrolla. Una suite que compensa un defecto del producto deja de poder verlo.
      command: 'pnpm dev',
      url: E2E_WEB_ORIGIN,
      // El dev server tiene que ser el nuestro: uno reutilizado de `pnpm dev` proxearía al API de
      // desarrollo (3001) y la suite mediría el backend equivocado sin decirlo.
      env: { API_PROXY_TARGET: E2E_API_ORIGIN },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
