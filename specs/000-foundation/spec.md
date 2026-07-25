# Spec 000 — Foundation: monorepo, tooling, contratos base y CI

- **Versión**: 0.1.1
- **Estado**: implemented — 13 de 14 AC verificados con test automatizado; **AC-14 (CI) pendiente**
  de una ejecución real del workflow, que requiere `git push` (denegado en esta sesión)
- **Fecha**: 2026-07-24
- **Depende de**: —

## 1. Contexto y problema

El repositorio hoy solo contiene metodología (agentes, MCP, plantillas SDD, seguimiento). No existe
código ejecutable: no hay `apps/web`, `apps/api` ni `packages/shared`, no hay base de datos levantable,
no hay pipeline de verificación. Ninguna feature de producto (auth, árbol de documentos, editor, tabs)
puede especificarse en tareas TDD verificables mientras no exista un esqueleto donde el comando
`DONE` de una tarea pueda correr y fallar/pasar de verdad.

El problema a resolver aquí no es funcionalidad de usuario final, sino **hacer verificable el resto del
proyecto**: un monorepo instalable, un backend que arranca con configuración validada y expone su
contrato en Swagger, un frontend que renderiza su shell, tipos compartidos entre ambos, infraestructura
local reproducible (PostgreSQL + Redis) y CI que corre `lint`, `typecheck`, `test` y `build`.

Esta spec también fija las **versiones reales del stack** (verificadas en npm el 2026-07-24) para que
los agentes de implementación no las inventen ni deriven a versiones distintas entre paquetes.

## 2. Historias de usuario

- **US-1** — Como desarrollador del proyecto, quiero clonar el repo y con `pnpm install && pnpm dev`
  tener web y api corriendo, para empezar a trabajar sin configuración manual.
- **US-2** — Como agente de implementación, quiero que exista un comando de verificación real por
  paquete (`test`, `lint`, `typecheck`, `build`), para poder aplicar TDD y reportar RED antes de GREEN.
- **US-3** — Como desarrollador del backend, quiero que la aplicación falle al arrancar si falta una
  variable de entorno requerida, para no descubrir en producción que un secreto no estaba definido.
- **US-4** — Como consumidor de la API, quiero que toda entrada rechace campos no declarados y que
  toda salida esté documentada en Swagger, para tener un contrato explícito desde el primer endpoint.
- **US-5** — Como operador, quiero un endpoint de readiness que distinga "el proceso está vivo" de
  "las dependencias (PostgreSQL, Redis) responden", para poder desplegar con health checks reales.
- **US-6** — Como desarrollador del frontend, quiero un shell de aplicación con enrutado y estilos
  funcionando, para que las features de UI se monten encima sin rehacer la base.

## 3. Criterios de aceptación

Todo AC debe ser verificable por un test automatizado o por un comando con salida observable.

- **AC-1** — Dado el repositorio recién clonado, cuando se ejecuta `pnpm install && pnpm typecheck`,
  entonces el comando termina con código 0 y cubre los tres paquetes (`@one-markdown/web`,
  `@one-markdown/api`, `@one-markdown/shared`).

- **AC-2** — Dado el API arrancado, cuando se hace `GET /api/health`, entonces responde `200` con un
  cuerpo que corresponde exactamente a `HealthResponseDto` (`status: "ok"`, `uptimeSeconds: number`,
  `version: string`) y sin propiedades adicionales.

- **AC-3** — Dado el API arrancado con PostgreSQL y Redis disponibles, cuando se hace
  `GET /api/health/ready`, entonces responde `200` con `ReadinessResponseDto`
  (`status: "ready"`, `checks: { database: "up", redis: "up" }`).

- **AC-4** — Dado el API arrancado y Redis o PostgreSQL caídos, cuando se hace `GET /api/health/ready`,
  entonces responde `503` con `status: "not_ready"` y el `check` correspondiente en `"down"`.

- **AC-5** — Dado un endpoint que recibe un DTO, cuando el cuerpo incluye una propiedad no declarada en
  ese DTO, entonces la respuesta es `400` y el cuerpo lista la propiedad rechazada
  (`ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`).

- **AC-6** — Dado el proceso del API, cuando falta una variable de entorno requerida (`DATABASE_URL`,
  `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`), entonces el bootstrap lanza un error que
  nombra la variable faltante y el proceso no queda escuchando.

- **AC-7** — Dado el API arrancado en entorno no productivo, cuando se hace `GET /api/docs-json`,
  entonces responde `200` con un documento OpenAPI que incluye la ruta `/api/health` y el schema
  `HealthResponseDto`.

- **AC-8** — Dado `docker compose up -d`, cuando se consulta la conectividad, entonces PostgreSQL
  acepta conexiones en el puerto configurado y Redis responde `PONG` a `PING`.

- **AC-9** — Dada la app web, cuando se navega a `/`, entonces se renderiza el shell (barra lateral
  del árbol de documentos y región principal de contenido) con landmarks accesibles
  (`role="navigation"` y `role="main"`).

- **AC-10** — Dada la app web, cuando se navega a una ruta inexistente, entonces se renderiza la vista
  404 sin desmontar el shell y sin errores en consola.

- **AC-11** — Dado el navegador real con web y api corriendo, cuando Playwright abre `/`, entonces la
  página carga con título "One Markdown" y el shell es visible (smoke e2e).

- **AC-12** — Dado un tipo publicado por `@one-markdown/shared`, cuando lo importan tanto `apps/api`
  como `apps/web`, entonces ambos compilan (`pnpm typecheck` en 0) usando la misma definición.

- **AC-13** — Dado un archivo TypeScript que contiene un `any` explícito, cuando se ejecuta `pnpm lint`,
  entonces el lint falla con la regla `@typescript-eslint/no-explicit-any` en nivel `error`.

- **AC-14** — Dado un push o pull request contra `main`, cuando corre el workflow de CI, entonces
  ejecuta en orden `install → lint → typecheck → test → build` con servicios PostgreSQL y Redis, y
  falla el job si cualquiera de esos pasos falla.

## 4. Fuera de alcance

- Autenticación, usuarios, JWT, MFA, bcrypt, Passport y rate limiting → spec `001-auth`.
- Modelos de dominio (directorios, documentos) y su primera migración Prisma → spec `002-workspace-tree`.
  Esta spec deja Prisma **configurado y conectado**, pero sin modelos de negocio ni migración inicial.
- Editor markdown, preview, sanitización, paleta de elementos, tabs y split view → specs `003`–`005`.
- Despliegue, dominios, TLS, observabilidad y backups.
- Diseño visual definitivo: el shell es estructural, no una propuesta de UI final.
- Auth.js: descartado por decisión del usuario, el backend es dueño del auth.

## 5. Riesgos y decisiones abiertas

| # | Riesgo / duda | Impacto | Mitigación / quién decide |
|---|---------------|---------|---------------------------|
| 1 | TypeScript 7.x (port nativo, `latest` al 2026-07-24) puede no soportar `emitDecoratorMetadata`, del que dependen NestJS, class-validator y class-transformer | Alto: bloquea todo el backend | Se fija **TypeScript 5.9.3** en `apps/api` (combinación soportada oficialmente por NestJS 11). `T-001` valida el toolchain antes de seguir; si `apps/web` con TS 5.9.3 no da fricción, se unifica en 5.9.3 en todo el monorepo. Migrar a 6.x/7.x es una decisión posterior, fuera de esta spec |
| 2 | Prisma 7 mueve la URL de datasource al archivo `prisma.config.ts` en vez de `env()` dentro de `schema.prisma` | Medio: guías antiguas no aplican | El plan fija `prisma.config.ts` explícitamente; `T-009` verifica con `prisma migrate status` contra la base de docker |
| 3 | Vite 8, Vitest 4, React Router 8 y Tailwind 4 son majors recientes; ejemplos de entrenamiento pueden estar desactualizados | Medio: tiempo perdido en APIs viejas | Obligatorio consultar `context7` antes de escribir configuración de cada una; Tailwind 4 se integra con `@tailwindcss/vite` + `@import "tailwindcss"` (verificado), no con `tailwind.config.js` + PostCSS |
| 4 | El AC-13 (lint falla ante `any`) necesita un archivo que viole la regla, y ese archivo no puede quedar en el árbol de fuentes | Bajo | Fixture bajo `tools/lint-fixtures/` excluido de `tsconfig` de build, verificado corriendo eslint contra el fixture y esperando exit ≠ 0 |
| 5 | El readiness (AC-3/AC-4) depende de contenedores levantados; en CI hay que declarar servicios | Medio: CI verde en local, rojo en CI | El workflow declara `services: postgres, redis`; el e2e de readiness se salta con `describe.skip` solo si las env de infra no existen, y eso se reporta, no se oculta |
| 6 | Node local es v25; `engines` declara `>=22` | Bajo | CI corre sobre Node 22 LTS y 24 para detectar divergencias; `engines` no se relaja |

## 6. Trazabilidad

| AC | Cubierto por | Tarea |
|----|--------------|-------|
| AC-1 | `pnpm typecheck` (raíz, recursivo) | T-001, T-010 |
| AC-2 | `apps/api/test/health.e2e-spec.ts` | T-005 |
| AC-3 | `apps/api/test/health.e2e-spec.ts` (readiness ok) | T-006 |
| AC-4 | `apps/api/src/health/health.service.spec.ts` (dependencia caída) | T-006 |
| AC-5 | `apps/api/test/validation.e2e-spec.ts` | T-007 |
| AC-6 | `apps/api/src/config/env.validation.spec.ts` | T-004 |
| AC-7 | `apps/api/test/swagger.e2e-spec.ts` | T-008 |
| AC-8 | `docker compose up -d` + `pg_isready` / `redis-cli PING` | T-002 |
| AC-9 | `apps/web/src/app/AppShell.test.tsx` | T-012 |
| AC-10 | `apps/web/src/app/routes.test.tsx` | T-012 |
| AC-11 | `apps/web/e2e/smoke.spec.ts` | T-014 |
| AC-12 | `packages/shared/src/index.test.ts` + `pnpm typecheck` | T-010 |
| AC-13 | `tools/lint-fixtures/` + `pnpm lint` | T-016 |
| AC-14 | `.github/workflows/ci.yml` (run verde/rojo observable) | T-015 |
