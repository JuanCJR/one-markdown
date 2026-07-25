# Plan 000 — Foundation: monorepo, tooling, contratos base y CI

Spec de referencia: `spec.md` v0.1.0

## 1. Versiones fijadas del stack

Resueltas contra el registro npm el **2026-07-24**. Los agentes de implementación **no eligen versiones**:
usan estas. Cualquier cambio pasa por el orchestrator y deja entrada en el `CHANGELOG.md` de esta spec.

| Ámbito | Paquete | Versión | Nota |
|---|---|---|---|
| Runtime | Node | `>=22` (CI: 22 LTS y 24) | `engines` ya declarado en la raíz |
| Runtime | pnpm | `10.15.0` | ya fijado en `packageManager` |
| Lenguaje | `typescript` | `5.9.3` | **no** `7.0.2`: ver riesgo #1 de la spec (decoradores + `emitDecoratorMetadata`) |
| API | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/testing` | `11.1.28` | adapter Express |
| API | `@nestjs/config` | `4.0.4` | validación de env al arranque |
| API | `@nestjs/swagger` | `11.4.6` | documento OpenAPI |
| API | `class-validator` / `class-transformer` | `0.15.1` / `0.5.1` | DTOs de entrada |
| API | `prisma` / `@prisma/client` | `7.9.0` | config en `prisma.config.ts` (Prisma 7) |
| API | `@prisma/adapter-pg` + `pg` | `7.9.0` / `8.22.0` | **obligatorio**: Prisma 7 lanza `P2038` si se instancia `PrismaClient` sin driver adapter |
| API | `ioredis` | latest 5.x | cliente Redis; se fija la versión exacta al instalar |
| API | `jest` + `supertest` | los que traiga el scaffold de Nest 11 | e2e HTTP |
| Web | `react` / `react-dom` | `19.2.8` | |
| Web | `vite` | `8.1.5` | |
| Web | `tailwindcss` + `@tailwindcss/vite` | `4.3.3` | Tailwind 4: plugin de Vite + `@import "tailwindcss"`, **sin** `tailwind.config.js` ni PostCSS |
| Web | `react-router` | `8.3.0` | paquete `react-router` (no `react-router-dom`) |
| Web | `zustand` | `5.0.14` | |
| Web | `vitest` | `4.1.10` | + `@testing-library/react`, `jsdom` |
| Web | `@playwright/test` | `1.62.0` | e2e |

## 2. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|----------|--------------------------|--------|
| 1 | Monorepo pnpm workspaces con `apps/*` + `packages/*`, sin orquestador de builds (Turbo/Nx) | Turborepo, Nx | Tres paquetes y scripts `pnpm -r` bastan; añadir un orquestador ahora es complejidad sin beneficio medible. Se reevalúa si el CI supera ~5 min |
| 2 | `packages/shared` publica **solo tipos, guards y constantes de contrato** derivados de los DTO del backend; el backend es la fuente de verdad, y sus DTO declaran `implements` contra estos tipos para que la divergencia rompa el typecheck | Generar tipos desde el OpenAPI; compartir clases DTO | Compartir clases arrastraría `class-validator` al bundle del navegador. La generación desde OpenAPI se puede añadir después sin romper el contrato |
| 2b | `shared` compila a CommonJS (`dist/`) para el build del backend, y los tests de `api` lo resuelven al fuente por `moduleNameMapper` | Apuntar `main` al `.ts` fuente | Con `main` en TS, `nest build` movería el `rootDir` y rompería la ruta de `dist/main.js`; el mapper evita además tener que compilar `shared` antes de correr tests |
| 3 | Prefijo global `/api` en el backend y proxy de Vite `'/api' → http://localhost:3001` en dev | Puerto directo + CORS en dev | Mismo origen en dev: sin CORS, y las cookies de refresh de la spec `001` funcionarán igual que en producción. El puerto por defecto del API es **3001**, no 3000: el 3000 es el más disputado de cualquier máquina de desarrollo (en esta lo ocupaba otro proyecto) |
| 4 | `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted`, `transform` y `enableImplicitConversion: false` | Validación por controlador | La regla dura del proyecto es que toda entrada pasa por DTO; global evita olvidos. Conversión implícita apagada para que los tipos se declaren explícitamente |
| 5 | Configuración con `@nestjs/config` + esquema de validación que corre al bootstrap y aborta si falta o es inválida una variable | `dotenv` crudo, defaults silenciosos | AC-6: fallar temprano y nombrando la variable. Ningún secreto tiene default |
| 6 | Health dividido en `GET /api/health` (liveness, sin I/O) y `GET /api/health/ready` (readiness, toca PostgreSQL y Redis) | Un solo endpoint | Un liveness que consulta la base se cae cuando la base se cae y provoca reinicios en cascada |
| 7 | Prisma queda instalado, configurado y conectado, **sin modelos de negocio ni migración inicial** | Crear ya `User`/`Document` | Los modelos son alcance de `001-auth` y `002-workspace-tree`; adelantarlos rompería la trazabilidad AC↔spec |
| 8 | Redis se accede por un `RedisModule` propio con `ioredis` y token de inyección | `@nestjs/cache-manager` | En `001-auth` Redis guarda refresh tokens y contadores de rate limit, no cache; se necesita el cliente directo |
| 9 | Errores HTTP con un `AllExceptionsFilter` global que emite siempre `ErrorResponseDto` | Formato por defecto de Nest | La regla dura dice que **toda** salida tiene DTO, incluidas las de error |
| 10 | Frontend con estructura `src/app` (shell, rutas, providers), `src/features/*`, `src/shared/*` | Carpetas por tipo (`components/`, `hooks/`) | Las features siguientes (árbol, editor, tabs) son verticales; por tipo se dispersan |
| 11 | Estado con Zustand en stores por feature; en esta spec solo `useUiStore` | Context API | Ya es decisión del stack; se establece el patrón de slice con un caso mínimo |
| 12 | Fixture de lint bajo `tools/lint-fixtures/` fuera de los `tsconfig` de build | Test de lint con API programática de ESLint | Verificable con el mismo `eslint` que usa el proyecto y sin dependencias extra |

## 3. Contrato de API

**Toda entrada y toda salida tiene DTO.** Los tres endpoints de esta spec son de solo lectura, pero
sus respuestas se construyen explícitamente y se documentan en Swagger.

### `GET /api/health`

- **Auth**: pública · **Rol/propiedad**: —
- **Request DTO**: — (sin cuerpo ni parámetros)
- **Response DTO**: `HealthResponseDto`
  - `status: 'ok'` — literal, `@ApiProperty({ enum: ['ok'] })`
  - `uptimeSeconds: number` — entero ≥ 0, segundos desde el arranque del proceso
  - `version: string` — versión de `apps/api/package.json`
- **Errores**: ninguno esperado; un fallo interno cae en `AllExceptionsFilter` → `500` `ErrorResponseDto`

### `GET /api/health/ready`

- **Auth**: pública · **Rol/propiedad**: —
- **Request DTO**: —
- **Response DTO**: `ReadinessResponseDto`
  - `status: 'ready' | 'not_ready'`
  - `checks: ReadinessChecksDto` → `{ database: 'up' | 'down'; redis: 'up' | 'down' }`
- **Comportamiento**: `database` se comprueba con `SELECT 1` vía Prisma; `redis` con `PING`.
  Cada comprobación tiene timeout de 2 s y su fallo se traduce a `'down'`, nunca a una excepción propagada.
- **Errores**: `503` cuando cualquier check está `down` (el cuerpo sigue siendo `ReadinessResponseDto`
  con `status: 'not_ready'`, para que el operador vea *qué* falló)

### `GET /api/docs-json` y `GET /api/docs`

- **Auth**: pública en `NODE_ENV !== 'production'`; en producción **no se montan** (Swagger deshabilitado)
- **Response**: documento OpenAPI 3.1 generado por `@nestjs/swagger` / UI

### `ErrorResponseDto` (forma única de error en toda la API)

- `statusCode: number` · `error: string` (nombre HTTP) · `message: string | string[]`
  (los mensajes de `class-validator` llegan como array) · `path: string` · `timestamp: string` (ISO-8601)

## 4. Configuración y entorno

Esquema validado al bootstrap (`apps/api/src/config/env.validation.ts`). Sin defaults para secretos.

| Variable | Requerida | Tipo / regla | Uso |
|---|---|---|---|
| `NODE_ENV` | sí | `'development' \| 'test' \| 'production'` | modo, montaje de Swagger |
| `PORT` | no (default `3001`) | entero 1–65535 | puerto HTTP |
| `DATABASE_URL` | sí | URL `postgresql://` | Prisma |
| `REDIS_URL` | sí | URL `redis://` | ioredis |
| `JWT_ACCESS_SECRET` | sí | string, mín. 32 chars | reservado para `001-auth` |
| `JWT_REFRESH_SECRET` | sí | string, mín. 32 chars, ≠ access | reservado para `001-auth` |
| `WEB_ORIGIN` | no (default `http://localhost:5173`) | URL | CORS cuando no se usa el proxy |

`.env.example` de la raíz se actualiza con estas claves y **valores de ejemplo, nunca reales**.

## 5. Esquema / migración Prisma

Sin modelos de negocio en esta spec.

```prisma
// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

```ts
// apps/api/prisma.config.ts  — Prisma 7 lee aquí la URL del datasource
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DATABASE_URL') },
})
```

- Migración de esta spec: **ninguna**. La primera migración la crea la spec que introduzca el primer
  modelo (`001-auth` con `User`, o `002-workspace-tree`).
- Nota de implementación (T-009): si `prisma generate` rechaza un `schema.prisma` sin ningún modelo,
  **no se inventa un modelo de relleno**: se reporta al orchestrator, que adelanta el modelo `User`
  mínimo desde `001-auth` y deja constancia en ambos CHANGELOG. La verificación de conectividad de
  esta spec (`SELECT 1`) no depende de que existan modelos.

## 6. Infraestructura local

`docker-compose.yml` en la raíz, solo para desarrollo:

- `postgres:17-alpine` — puerto de host **`5433`** (mapeado al `5432` del contenedor), usuario/base
  `one_markdown`, volumen nombrado, `healthcheck` con `pg_isready`. El `5432` del host suele estar
  ocupado por otros proyectos; en CI, donde no hay conflicto, se usa el `5432`.
- `redis:7-alpine` — puerto `6379`, `healthcheck` con `redis-cli ping`.

El MCP `postgres` de `.mcp.json` apunta a esta misma base, así que quedará conectado al levantarla.

## 7. Frontend

- **Rutas** (React Router 8, `createBrowserRouter`):
  - `/` → `AppShell` (layout persistente) con `WorkspaceEmptyState` como índice.
  - `*` → `NotFoundPage`, renderizada **dentro** del shell (AC-10).
- **Stores Zustand**: `src/shared/store/ui.store.ts` → `useUiStore` con
  `{ sidebarCollapsed: boolean; toggleSidebar(): void }`. Nada persiste todavía.
- **Componentes**:
  - `AppShell` — grid de dos columnas: `<nav role="navigation">` (sidebar del árbol, placeholder) y
    `<main role="main">` (outlet). Es el punto de anclaje de las specs `002`–`005`.
  - `WorkspaceEmptyState` — mensaje de "sin documentos"; será reemplazado por la spec `002`.
  - `NotFoundPage` — mensaje 404 + enlace a `/`.
- **Cliente API**: `src/shared/api/http.ts` — wrapper de `fetch` tipado que resuelve contra `/api`,
  parsea `ErrorResponseDto` y lanza un `ApiError` tipado. Primer consumidor: `getHealth()`.
- **Tipos compartidos**: `Health`, `Readiness`, `ApiErrorShape` desde `@one-markdown/shared` (AC-12).
- **Accesibilidad**: landmarks `navigation`/`main`, `<h1>` único por vista, foco visible por defecto de
  Tailwind sin `outline: none`, y el toggle del sidebar como `<button>` con `aria-expanded`.

## 8. Estrategia de tests

| Nivel | Qué cubre | Dónde |
|-------|-----------|-------|
| unit (api) | validación del esquema de env (AC-6), lógica de readiness con dependencias caídas (AC-4) | `apps/api/src/**/*.spec.ts` |
| e2e (api) | health (AC-2), readiness ok (AC-3), rechazo de propiedades no declaradas (AC-5), documento OpenAPI (AC-7) | `apps/api/test/*.e2e-spec.ts` |
| unit (shared) | el contrato exportado compila y es consumible por ambos lados (AC-12) | `packages/shared/src/**/*.test.ts` |
| unit/componente (web) | shell con landmarks (AC-9), ruta desconocida → 404 dentro del shell (AC-10) | `apps/web/src/**/*.test.tsx` |
| e2e (web) | smoke con navegador real (AC-11) | `apps/web/e2e/*.spec.ts` |
| tooling | typecheck (AC-1), lint anti-`any` (AC-13), CI (AC-14), infra (AC-8) | comandos + `.github/workflows/ci.yml` |

Para AC-5 se expone un controlador **de prueba** montado solo en el módulo de test (`ValidationProbeModule`),
no en la app de producción: recibe un DTO mínimo y permite verificar el pipe global sin inventar un
endpoint de negocio que no pertenece a esta spec.

## 9. Orden de ejecución

Raíz y tooling → infraestructura (docker) → backend (config → health → validación → Swagger → Prisma/Redis)
→ `packages/shared` → frontend (scaffold → shell/rutas → cliente API) → e2e → CI.

Paralelizable: una vez cerrada `packages/shared` (T-010), las tareas de `frontend` (T-011…T-013)
corren en paralelo con las de `backend` restantes, porque el contrato ya está fijado por escrito.
