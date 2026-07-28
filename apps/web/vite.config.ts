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
  //
  // `force` no es celo, y no lo quites por parecer redundante (AC-34, spec 002). Vite invalida
  // `node_modules/.vite` comparando **dos** hashes, `lockfileHash` y `configHash`, y el
  // **contenido** de un paquete enlazado del workspace no entra en ninguno de los dos: su propia
  // documentación lo dice —«Vite detects dependency overrides but not `npm link` usage»—, o sea que
  // no mira el paquete en absoluto. No es que hashee su `package.json`: es que no lo mira.
  //
  // Lo que eso costó, medido: al añadir la spec 002 sus guards, la caché de la spec 001 seguía
  // dándose por válida y el navegador recibía un `shared` **sin** `isWorkspaceTree`. El árbol moría
  // con «Ocurrió un error inesperado» tras un `GET /api/workspace/tree` que había respondido `200`,
  // porque `expectShape` reventaba con `TypeError: guard is not a function`. Con `packages/shared/
  // dist` perfectamente al día: lo rancio era la caché, y solo se arreglaba borrándola a mano.
  //
  // Coste asumido: re-empaqueta **todas** las dependencias en cada arranque del servidor de
  // desarrollo, no solo `shared`. A este tamaño son un par de segundos, y se prefiere un arranque
  // algo más lento a un árbol roto en silencio.
  //
  // Salida futura: publicar `shared` en ESM. Sin CJS no habría que pre-empaquetarlo —se serviría
  // por el grafo de módulos y no habría caché que envejecer—, pero `apps/api` es NestJS CommonJS
  // sobre el mismo `dist`, así que exige salida dual o mover el backend a ESM: spec propia, no un
  // cierre de fase. Cuando se haga, `include` y `force` se van juntos.
  optimizeDeps: { include: ['@one-markdown/shared'], force: true },
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
