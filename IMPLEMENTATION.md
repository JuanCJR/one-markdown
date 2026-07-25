# One Markdown — Seguimiento de implementación

Archivo base de seguimiento. **Solo el agente `orchestrator` lo edita**, y únicamente después de verificar (comando corrido + salida real).

Leyenda: `[ ]` pendiente · `[~]` en curso o bloqueado (con motivo) · `[x]` hecho y verificado.

---

## Fase 0 — Agentes y tooling

- [x] **Discovery de skills** en skills.sh (`npx skills find`) — 2026-07-24
      Verificado: 15 skills instaladas a nivel proyecto en `.claude/skills/`, registradas en `skills-lock.json` (`ls .claude/skills` → 15 entradas).
- [x] **Agentes definidos** — 2026-07-24
      `.claude/agents/orchestrator.md`, `frontend.md`, `backend.md` con skills asignadas por rol.
- [x] **MCP integrados** — 2026-07-24
      `.mcp.json`: `context7`, `playwright`, `coderag`, `postgres`. Pendiente de handshake en el próximo arranque de sesión (ver nota abajo).
- [x] **Base de metodología** — 2026-07-24
      `specs/` con plantillas SDD (`spec.md`, `plan.md`, `tasks.md`, `CHANGELOG.md`), `CLAUDE.md` con reglas del proyecto, este archivo de seguimiento.
- [x] **Scaffolding del monorepo** — 2026-07-24
      `apps/web` (Vite 8+React 19+TS+Tailwind 4+Zustand+Router 8+Vitest 4+Playwright), `apps/api` (NestJS 11+Prisma 7+Redis+Swagger+Jest), `packages/shared`, `docker-compose.yml` (postgres+redis), CI escrito.
      Verificado: `pnpm typecheck` → 0 · `pnpm lint` → 0 · `pnpm test` → 0 · `pnpm build` → 0 · `pnpm test:e2e` → 3 passed. Detalle por tarea en Fase 2.

## Fase 1 — Planificación SDD

- [x] **spec 000-foundation** — `specs/000-foundation/` (`spec.md` v0.1.1 + `plan.md` + `tasks.md` + `CHANGELOG.md`), estado **implemented**. — 2026-07-24
      14 criterios de aceptación; 13 verificados con test automatizado, AC-14 (CI) pendiente de un run real.
      Verificado: ver Fase 2 y las notas de verificación al final.
- [ ] **spec 001-auth** — registro, login, JWT access+refresh, bcrypt, MFA TOTP, Redis, rate limit.
- [ ] **spec 002-workspace-tree** — directorios/subdirectorios y documentos markdown (CRUD, propiedad por usuario).
- [ ] **spec 003-editor** — vista texto/preview, guardado, sanitización del preview.
- [ ] **spec 004-markdown-palette** — listado de elementos markdown insertables.
- [ ] **spec 005-tabs-split-view** — tabs tipo VS Code y vista dividida.

_(Cada spec se escribe cuando la anterior está aprobada, para apoyarse en contratos cerrados. Índice y dependencias en `specs/README.md`.)_

## Fase 2 — Implementación de `000-foundation`

Detalle completo en `specs/000-foundation/tasks.md`. Todas las tareas se hicieron en esta sesión (2026-07-24);
cada línea lleva el comando que se corrió y su salida real.

- [x] **T-001** · backend · setup · Raíz del monorepo: tsconfig base, ESLint plano, Prettier, TS 5.9.3
      `pnpm exec tsc --version` → `Version 5.9.3` · `pnpm exec eslint --version` → `v10.8.0`
- [~] **T-002** · backend · setup · `docker-compose.yml` con PostgreSQL 17 y Redis 7 + `.env.example`
      `docker compose ps` → ambos `healthy` · `pg_isready` → `accepting connections` · `redis-cli PING` → `PONG`.
      **Pendiente**: `.env.example` no se pudo tocar (las reglas de permisos deniegan `.env.*`); lo actualiza el usuario.
      **Desvío**: PostgreSQL quedó en el puerto **5433** del host, el 5432 estaba ocupado por otro proyecto.
- [x] **T-003** · backend · setup · Scaffold `apps/api` (NestJS 11, prefijo `/api`, Jest + Supertest)
      `pnpm --filter @one-markdown/api build` → exit 0
- [x] **T-004** · backend · Configuración de entorno validada al arranque (AC-6)
      RED: `Cannot find module './env.validation'` → GREEN: `test env.validation` → **16 passed**
- [x] **T-005** · backend · `GET /api/health` con `HealthResponseDto` (AC-2)
      RED: `Cannot find module '../src/bootstrap'` → GREEN: `test:e2e health` → **2 passed**
- [x] **T-006** · backend · `GET /api/health/ready` con checks PostgreSQL/Redis (AC-3, AC-4)
      RED: `Property 'readiness' does not exist` → GREEN: `test health.service` → **6 passed** (incluye timeout con fake timers) · `test:e2e health.e2e` → **3 passed** contra los contenedores reales
- [x] **T-007** · backend · `ValidationPipe` global + `AllExceptionsFilter` con `ErrorResponseDto` (AC-5)
      RED: **7 de 8 fallando** → GREEN: `test:e2e validation` → **8 passed**
- [x] **T-008** · backend · Swagger montado fuera de producción (AC-7)
      RED: 3 fallando → GREEN: `test:e2e swagger` → **7 passed** (dos archivos, uno por entorno)
- [x] **T-009** · backend · setup · Prisma 7 (`prisma.config.ts`) y Redis conectados
      `prisma generate` → `Generated Prisma Client (7.9.0)` · `prisma migrate status` → conecta a `localhost:5433`.
      `prisma generate` **sí funciona con un schema sin modelos**: no hizo falta adelantar ningún modelo de `001-auth`.
- [x] **T-010** · backend · `packages/shared` con el contrato compartido (AC-12)
      RED: módulo inexistente → GREEN: `--filter @one-markdown/shared test` → **11 passed** · `pnpm typecheck` → 0
- [x] **T-011** · frontend · setup · Scaffold `apps/web` (Vite 8, React 19, Tailwind 4 vía plugin de Vite)
      `pnpm --filter @one-markdown/web build` → `✓ built in 149ms`
- [x] **T-012** · frontend · App shell, enrutado y 404 (AC-9, AC-10)
      RED: `./routes` inexistente → GREEN: `test` → **7 passed**
- [x] **T-013** · frontend · Cliente HTTP tipado contra el contrato compartido (AC-12)
      RED: `./http` inexistente → GREEN: `test` (web completo) → **14 passed**
- [x] **T-014** · frontend · Smoke e2e con Playwright (AC-11)
      RED: sin `playwright.config.ts` Playwright recogía los tests de Vitest y fallaba → GREEN: `pnpm test:e2e` → **3 passed**
- [~] **T-015** · backend · CI en GitHub Actions (AC-14)
      `.github/workflows/ci.yml` escrito y parseado con js-yaml (13 pasos, matriz Node 22/24, servicios postgres+redis).
      **Bloqueada en**: el `DONE` pide un run real y `git push` está denegado en esta sesión. Los 7 pasos se corrieron en local y pasan.
- [x] **T-016** · backend · Regla anti-`any` verificable con fixture de lint (AC-13)
      Con la regla desactivada el fixture sale 0; con la config del proyecto sale 1 con `@typescript-eslint/no-explicit-any` × 2. `pnpm lint` sigue en 0.

---

## Notas de verificación

- **2026-07-24** — Skills instaladas con `npx skills add <repo> --skill <name> -y --copy`. `.claude/skills/` y `.agents/` están en `.gitignore`; `skills-lock.json` sí se versiona y permite restaurar con `npx skills experimental_install`.
- **2026-07-24** — La skill `test-driven-development-tdd` venía con `name: Test-Driven Development (TDD)` en su frontmatter; se normalizó a kebab-case para que Claude Code la cargue.
- **2026-07-24** — Los servidores MCP declarados en `.mcp.json` se conectan al iniciar sesión en este directorio; `postgres` requiere `DATABASE_URL` y una base levantada (aún no existe), así que aparecerá desconectado hasta la Fase 0 de scaffolding.
- **2026-07-24** — Versiones del stack resueltas con `npm view <pkg> version`: TypeScript `7.0.2` es el `latest`, pero se fija **5.9.3** en el monorepo porque NestJS 11 + `class-validator` dependen de `emitDecoratorMetadata` y el soporte del port nativo no está confirmado (riesgo #1 de la spec 000). Otras: Vite `8.1.5`, React `19.2.8`, React Router `8.3.0`, Vitest `4.1.10`, Tailwind `4.3.3`, NestJS `11.1.28`, Prisma `7.9.0`, Zustand `5.0.14`, Playwright `1.62.0`.
- **2026-07-24** — Verificado con `context7`: Tailwind 4 se integra con `@tailwindcss/vite` + `@import "tailwindcss"` (sin `tailwind.config.js` ni PostCSS), y Prisma 7 lee la URL del datasource desde `prisma.config.ts`, no desde `env()` en `schema.prisma`. Ambas cosas quedaron fijadas en `specs/000-foundation/plan.md`.

### Cierre de la Fase 2 (2026-07-24)

Secuencia completa corrida de punta a punta, en este orden y con estas salidas:

| Comando | Resultado |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm exec eslint tools/lint-fixtures/explicit-any.ts` | exit 1 (esperado: es la verificación negativa del AC-13) |
| `pnpm typecheck` | exit 0 (los 3 paquetes) |
| `pnpm test` | exit 0 — api 22, web 14, shared 11 |
| `pnpm --filter @one-markdown/api test:e2e` | 4 suites, **18 passed** |
| `pnpm build` | exit 0 |
| `pnpm test:e2e` | **3 passed** (chromium) |

Además se arrancó el proceso real (`node dist/main.js`, no solo `app.init()` de los tests) y se consultó con curl:

```
GET /api/health       → {"status":"ok","uptimeSeconds":15,"version":"0.0.0"}
GET /api/health/ready → {"status":"ready","checks":{"database":"up","redis":"up"}}  [HTTP 200]
GET /api/docs         → HTTP 200 (Swagger UI)
GET /api/nada         → {"statusCode":404,"error":"Not Found","message":"Cannot GET /api/nada","path":"/api/nada","timestamp":"..."}
```

Este arranque real destapó un `EADDRINUSE` en el 3000 que ningún test habría visto: los e2e usan
`app.init()` y nunca llegan a hacer `listen`. De ahí que `PORT` pase a **3001** por defecto.

**68 tests en total.** Todos los tests de comportamiento se escribieron antes que la implementación y se
verificó su fallo inicial (ver columna RED en la Fase 2).

Hallazgos que costaron tiempo y conviene no volver a pagar:

- **`ConfigModule.forRoot()` lee el entorno al importar el módulo**, no al instanciar la app. Un test que
  cambia `NODE_ENV` en `beforeAll` no tiene efecto. Solución adoptada: un archivo de test por entorno con
  un import de efecto lateral antes de `AppModule`. `jest.resetModules()` **no** sirve: carga una segunda
  copia de `@nestjs/common` y los `instanceof HttpException` del filtro de excepciones dejan de casar,
  convirtiendo 404 en 500.
- **ioredis con `lazyConnect` + `enableOfflineQueue: false`** rechaza el primer comando antes de que la
  conexión llegue a establecerse: el readiness daba Redis `down` con Redis sano. El tope de tiempo lo pone
  el probe del health (2 s), no ioredis.
- **Dos puertos por defecto colisionaban con otros proyectos de esta máquina**: PostgreSQL (5432, ocupado
  por un `postgres:13` ajeno) y el API (3000, ocupado por una app Next.js). Quedaron en **5433** y **3001**.
  No se tocó ninguno de los dos contenedores ajenos.
- **`exactOptionalPropertyTypes`** rechaza `workers: isCI ? 1 : undefined` en la config de Playwright.
  Se resolvió con spread condicional, sin aflojar el tsconfig.
- **eslint-plugin-react-hooks v7**: `configs['recommended-latest']` es formato eslintrc; el de config plana
  es `configs.flat['recommended-latest']`.
- **`ErrorResponseDto` no aparecía en el OpenAPI** por no estar referenciado en ningún endpoint concreto;
  se registra con `extraModels` al crear el documento.

### Pendientes que dependen del usuario

1. **`.env.example`** — `.claude/settings.json` deniega leer y escribir `.env.*`, así que no se tocó.
   Debe contener las 7 claves de `plan.md` §4:

   ```
   NODE_ENV=development
   PORT=3001
   DATABASE_URL=postgresql://one_markdown:one_markdown@localhost:5433/one_markdown
   REDIS_URL=redis://localhost:6379
   JWT_ACCESS_SECRET=<mínimo 32 caracteres>
   JWT_REFRESH_SECRET=<mínimo 32 caracteres, distinto del anterior>
   WEB_ORIGIN=http://localhost:5173
   ```
2. **Ejecutar el CI** — requiere `git push` (denegado en esta sesión). Hasta entonces AC-14 no está verificado.
3. **Commit** — el árbol tiene todo el trabajo sin commitear; no se hizo commit por no haberlo pedido.
