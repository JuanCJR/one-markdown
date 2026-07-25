# Changelog — Spec 000 Foundation

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

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
