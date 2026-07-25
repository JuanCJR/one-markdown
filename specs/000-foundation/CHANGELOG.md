# Changelog — Spec 000 Foundation

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.1.4 — 2026-07-25

Tercera consecuencia de la decisión 2b (`packages/shared` compila a CommonJS), y la más cara de las tres,
descubierta al implementar el e2e de navegador de la spec `001`:

- **La aplicación web no arrancaba en un navegador real.** `packages/shared/dist/index.js` es CJS
  (`exports.isApiErrorShape = …`) y, siendo un paquete **enlazado del workspace**, Vite no lo
  pre-empaqueta por su cuenta: el `import { isApiErrorShape } from '@one-markdown/shared'` del cliente
  HTTP moría con `does not provide an export named 'isApiErrorShape'`.
- **Ningún test lo veía**: Vitest sobre jsdom y `apps/api` consumen CJS sin problema, `vite build` lo
  resuelve por Rollup, y el único test que abre un navegador de verdad (el smoke, AC-11) llevaba días en
  rojo por otro motivo. Es decir: el AC-11 existía justamente para atrapar esto y estaba tapado.
- **Mitigado en el consumidor**, sin tocar `packages/shared`: `optimizeDeps: { include:
  ['@one-markdown/shared'] }` en `apps/web/vite.config.ts`, verificado además con la caché de Vite en frío.
- **La solución de raíz sigue pendiente y es una decisión, no una tarea olvidada**: que `shared` emita
  también ESM (doble salida con `exports` en su `package.json`). No se hace ahora porque el CJS venía de
  evitar que `nest build` desplazara el `rootDir` (decisión 2b) y el arreglo actual deja los cuatro
  escenarios verdes. Se revisará cuando la spec `002` amplíe el contrato compartido.
- Lección repetida: **un test rojo tolerado tapa los fallos que ese test existía para encontrar.**

## v0.1.3 — 2026-07-24

Segunda corrección de la misma naturaleza que la v0.1.2 — algo que solo se ve desde un entorno limpio —
detectada al crear la primera migración en la spec `001`:

- **`prisma.config.ts` necesita `import 'dotenv/config'`**: Prisma 7 dejó de cargar `.env` de forma
  implícita, así que el CLI fallaba con
  `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`. En la spec `000` (T-009)
  esto no se notó porque la sesión tenía las variables exportadas en el shell. Añadido `dotenv@17.4.2`
  como devDependency de `apps/api` y `migrations.path` explícito en la config. Verificado con
  `context7` contra la doc actual de Prisma.
- **`prisma migrate dev` NO regenera el cliente** con esta configuración: tras aplicar la migración,
  `prisma.user` seguía sin existir hasta correr `prisma generate` aparte. Queda como paso explícito.

## v0.1.2 — 2026-07-24

Corrección de un defecto que **destapó el primer run real del CI** (run `30139345799`, en rojo): el AC-1
("clon nuevo → `pnpm install && pnpm typecheck` en 0") no se cumplía de verdad.

- `apps/api` y `apps/web` resuelven `@one-markdown/shared` por su `types: ./dist/index.d.ts`
  (decisión 2b de `plan.md`), así que en un clon limpio el typecheck fallaba con
  `TS2307: Cannot find module '@one-markdown/shared'` × 3. En local pasaba porque `packages/shared/dist`
  ya existía de builds anteriores: **el estado sucio del árbol tapaba el fallo**.
- Arreglo en los scripts de la raíz, no solo en el workflow, porque el AC-1 habla del clon nuevo: se añade
  `shared:build` y `typecheck`, `test` y `test:e2e` lo ejecutan antes. `build` ya funcionaba porque
  `pnpm -r build` respeta el orden topológico del workspace.
- Verificado borrando `packages/shared/dist` antes de cada comando: `pnpm typecheck` → 0 ·
  `pnpm test` → 0 (api 22, web 14, shared 11) · `pnpm lint` → 0 · `pnpm build` → 0.
- Lección: los comandos de verificación hay que correrlos también **desde un estado limpio**; un `dist/`
  o un `node_modules` heredado convierte un fallo real en un falso verde.

## v0.1.1 — 2026-07-24

Precisiones surgidas al implementar. Ningún criterio de aceptación cambió de significado, por eso es
un patch y no un minor.

- **Puerto de PostgreSQL en local: 5433** (no 5432). El 5432 de esta máquina ya estaba ocupado por un
  contenedor `postgres:13` de otro proyecto. Se ajustaron `docker-compose.yml` y el default de
  `DATABASE_URL` en `.mcp.json` para no apuntar por accidente a una base ajena. En CI se mantiene 5432.
- **Prisma 7 exige driver adapter**: `new PrismaClient()` sin adapter lanza `P2038`. Se añadieron
  `@prisma/adapter-pg` y `pg` al plan y a las dependencias. `prisma generate` sí funciona con un
  schema sin modelos, así que no hizo falta adelantar ningún modelo de `001-auth`.
- **Puerto por defecto del API: 3001** (no 3000). Al arrancar el proceso real dio `EADDRINUSE`: el 3000
  lo ocupaba una app Next.js de otro proyecto. Se ajustaron el default de `PORT` y el proxy de Vite.
- **`packages/shared` compila a CommonJS**; los tests de `apps/api` lo resuelven al fuente vía
  `moduleNameMapper`. Apuntar `main` al `.ts` habría desplazado el `rootDir` de `nest build`.
- Los DTO del backend ahora declaran `implements` contra los tipos de `@one-markdown/shared`: si el
  contrato y el DTO divergen, falla el typecheck en vez de fallar en runtime en el navegador.
- **TypeScript 5.9.3 quedó confirmado** con NestJS 11: decoradores y `emitDecoratorMetadata`
  funcionan, y el cliente generado por Prisma 7 pasa el modo estricto completo
  (`exactOptionalPropertyTypes` incluido). El riesgo #1 queda cerrado para esta fase.

## v0.1.0 — 2026-07-24

- Spec inicial (draft). Alcance: monorepo pnpm, `apps/api` (NestJS + Prisma + Redis + Swagger),
  `apps/web` (Vite + React + Tailwind + Router + Zustand), `packages/shared`, docker-compose de
  infraestructura local, endpoints de health/readiness con DTO, configuración validada al arranque,
  `ValidationPipe` global y CI.
- Versiones del stack fijadas contra npm el 2026-07-24 (ver `plan.md` §1).
- Decisión registrada: TypeScript se fija en **5.9.3** y no en el `latest` (7.0.2) por el riesgo de
  `emitDecoratorMetadata` con NestJS 11 (riesgo #1 de la spec).
- Decisión registrada: Prisma queda configurado y conectado, **sin modelos de negocio**; la primera
  migración pertenece a la spec `002-workspace-tree` (o a `001-auth` si el modelo `User` llega antes).
