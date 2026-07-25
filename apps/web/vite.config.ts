/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Destino del proxy del API. En desarrollo es el `pnpm dev` de siempre; la suite e2e levanta su
 * propio API en un puerto dedicado y lo apunta con esta variable, para no hablar con el proceso que
 * la persona tenga a mano (ver `apps/web/e2e/support/dev-env.ts`).
 */
const apiProxyTarget = process.env['API_PROXY_TARGET'] ?? 'http://localhost:3001';

// Tailwind 4 se integra por plugin de Vite: no hay tailwind.config.js ni PostCSS.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@one-markdown/shared` se publica como CommonJS y, siendo un paquete enlazado del workspace,
  // Vite no lo pre-empaqueta por su cuenta: el navegador intentaría importar nombres de un módulo
  // CJS y el arranque moriría con `does not provide an export named …`. Incluirlo aquí lo convierte
  // a ESM una vez y deja los `import { isAuthSession } from '@one-markdown/shared'` funcionando.
  optimizeDeps: { include: ['@one-markdown/shared'] },
  server: {
    port: 5173,
    // Mismo origen que la API en desarrollo: sin CORS, y las cookies de refresh de la spec 001
    // se comportarán igual que en producción.
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
