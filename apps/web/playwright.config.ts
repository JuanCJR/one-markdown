import { defineConfig, devices } from '@playwright/test';

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
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
