# Tareas 000 — Foundation

Spec: `spec.md` v0.1.1 · Plan: `plan.md`

Cada tarea es atómica, se asigna a un agente y sigue RED → GREEN → REFACTOR.
El test se escribe primero y **debe fallar antes** de implementar.

**Tareas de tipo `setup`**: el scaffolding puro (instalar, generar proyecto, levantar contenedores) no
tiene un test que pueda fallar antes de que exista el paquete. Esas tareas se marcan `setup` y se
verifican con un comando de salida observable, no con un test fingido. **Toda tarea que introduce
comportamiento es TDD estricta.** No se admite una tarea `setup` que además implemente comportamiento.

---

- [x] **T-001** · `backend` · `setup` · Raíz del monorepo: tooling compartido
      **AC**: AC-1
      **Depende de**: —
      **QUÉ**: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
      ESLint plano (`eslint.config.js`) con `typescript-eslint` y `@typescript-eslint/no-explicit-any: 'error'`,
      Prettier, `.editorconfig`. `typescript@5.9.3` como devDependency de la raíz.
      **DONE**: `pnpm install && pnpm exec tsc --version` → `5.9.3` · `pnpm exec eslint --version` → sale 0
      **NOTA**: si NestJS 11 o Vite 8 obligan a otra versión de TS, **parar y reportar** al orchestrator
      (riesgo #1 de la spec); no cambiar la versión por cuenta propia.

- [~] **T-002** · `backend` · `setup` · Infraestructura local (PostgreSQL + Redis)
      **PARCIAL**: `docker-compose.yml` hecho y verificado (ambos contenedores `healthy`). Falta
      actualizar `.env.example`: las reglas de permisos de la sesión deniegan leer y escribir `.env.*`,
      así que lo tiene que hacer el usuario con las claves de `plan.md` §4 (ojo: `DATABASE_URL` en el 5433).
      **AC**: AC-8
      **Depende de**: —
      **QUÉ**: `docker-compose.yml` con `postgres:17-alpine` y `redis:7-alpine`, healthchecks y volúmenes
      nombrados, según `plan.md` §6. Actualizar `.env.example` con las claves de `plan.md` §4.
      **DONE**: `docker compose up -d && docker compose ps` (ambos `healthy`) ·
      `docker compose exec -T postgres pg_isready -U one_markdown` · `docker compose exec -T redis redis-cli PING` → `PONG`

- [x] **T-003** · `backend` · `setup` · Scaffold de `apps/api` (NestJS 11)
      **AC**: — (habilita AC-2…AC-7)
      **Depende de**: T-001
      **QUÉ**: paquete `@one-markdown/api` con NestJS 11 (adapter Express), prefijo global `/api`,
      scripts `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`. Jest + Supertest configurados.
      **DONE**: `pnpm --filter @one-markdown/api build` sale 0 · `pnpm --filter @one-markdown/api test` corre
      (aunque no haya tests aún) sin error de configuración

- [x] **T-004** · `backend` · Configuración validada al arranque
      **AC**: AC-6
      **Depende de**: T-003
      **RED**: `apps/api/src/config/env.validation.spec.ts` — con `DATABASE_URL` ausente, el validador lanza
      un error cuyo mensaje contiene `DATABASE_URL`; ídem `REDIS_URL`, `JWT_ACCESS_SECRET`,
      `JWT_REFRESH_SECRET`; con secretos de <32 chars también falla; con el set completo, devuelve el
      objeto tipado. Debe fallar antes de existir `env.validation.ts`.
      **GREEN**: `ConfigModule.forRoot({ isGlobal: true, validate })` con el esquema de `plan.md` §4.
      Cero `any`, tipo de configuración exportado.
      **DONE**: `pnpm --filter @one-markdown/api test env.validation`

- [x] **T-005** · `backend` · `GET /api/health` con `HealthResponseDto`
      **AC**: AC-2
      **Depende de**: T-004
      **RED**: `apps/api/test/health.e2e-spec.ts` — `GET /api/health` → `200`, cuerpo con exactamente
      `status: 'ok'`, `uptimeSeconds` (number ≥ 0) y `version` (string no vacío); el test afirma también
      que **no** hay claves extra (`Object.keys(body).sort()`).
      **GREEN**: `HealthModule` + `HealthController` + `HealthResponseDto` construido explícitamente,
      con `@ApiProperty` en cada campo. Nada de devolver objetos anónimos.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e health`

- [x] **T-006** · `backend` · `GET /api/health/ready` con checks de PostgreSQL y Redis
      **AC**: AC-3, AC-4
      **Depende de**: T-005, T-009
      **RED**: (a) `apps/api/src/health/health.service.spec.ts` — con el check de base fallando, el servicio
      devuelve `status: 'not_ready'` y `checks.database === 'down'` sin propagar la excepción; ídem Redis;
      con ambos ok, `'ready'`. (b) `apps/api/test/health.e2e-spec.ts` — readiness con infra arriba → `200`
      y `checks` en `'up'`; el caso degradado (dependencia caída) devuelve `503`.
      **GREEN**: `HealthService` con `SELECT 1` vía Prisma y `PING` vía ioredis, timeout de 2 s por check,
      `ReadinessResponseDto` + `ReadinessChecksDto`, `503` cuando algún check está `down`.
      **DONE**: `pnpm --filter @one-markdown/api test health.service` · `pnpm --filter @one-markdown/api test:e2e health`

- [x] **T-007** · `backend` · `ValidationPipe` global + filtro de errores con `ErrorResponseDto`
      **AC**: AC-5
      **Depende de**: T-003
      **RED**: `apps/api/test/validation.e2e-spec.ts` — usando el `ValidationProbeModule` de test
      (`plan.md` §8), un `POST` con una propiedad no declarada → `400` y el cuerpo (forma `ErrorResponseDto`)
      menciona la propiedad rechazada; un cuerpo con tipo inválido → `400` con el mensaje de class-validator;
      un cuerpo válido → `201`.
      **GREEN**: `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`,
      `enableImplicitConversion: false`) + `AllExceptionsFilter` global que siempre emite `ErrorResponseDto`.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e validation`

- [x] **T-008** · `backend` · Swagger montado fuera de producción
      **AC**: AC-7
      **Depende de**: T-005
      **RED**: `apps/api/test/swagger.e2e-spec.ts` — con `NODE_ENV=development`, `GET /api/docs-json` → `200`
      y el documento contiene la ruta `/api/health` y el schema `HealthResponseDto` con sus tres propiedades;
      con `NODE_ENV=production`, `GET /api/docs-json` → `404`.
      **GREEN**: `SwaggerModule` en `main.ts` condicionado por `NODE_ENV`, título/descripción/versión del
      documento y `@ApiTags` en el controlador.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e swagger`

- [x] **T-009** · `backend` · `setup` · Prisma 7 y Redis conectados
      **AC**: — (habilita AC-3/AC-4)
      **Depende de**: T-002, T-004
      **QUÉ**: `prisma/schema.prisma` y `prisma.config.ts` según `plan.md` §5 (generator `prisma-client`,
      datasource desde `DATABASE_URL`); `PrismaModule`/`PrismaService` con conexión y desconexión en el
      ciclo de vida de Nest; `RedisModule` con `ioredis` y token de inyección.
      **DONE**: `pnpm --filter @one-markdown/api exec prisma generate` sale 0 ·
      `pnpm --filter @one-markdown/api exec prisma migrate status` conecta contra la base de docker
      **NOTA**: si `prisma generate` falla por no haber modelos, **no inventar un modelo de relleno**:
      reportar al orchestrator (ver `plan.md` §5).

- [x] **T-010** · `backend` · `packages/shared` con el contrato compartido
      **AC**: AC-12
      **Depende de**: T-005
      **RED**: `packages/shared/src/index.test.ts` — un objeto que cumple `Health` es aceptado y uno con
      `status: 'down'` no compila/no valida contra el type guard exportado; el test falla antes de existir
      el módulo.
      **GREEN**: `@one-markdown/shared` exportando `Health`, `Readiness`, `ApiErrorShape` y sus type guards,
      derivados de los DTO de `apps/api`. Sin dependencias de runtime.
      **DONE**: `pnpm --filter @one-markdown/shared test` · `pnpm typecheck` (los tres paquetes en 0)

- [x] **T-011** · `frontend` · `setup` · Scaffold de `apps/web` (Vite 8 + React 19 + Tailwind 4)
      **AC**: — (habilita AC-9…AC-11)
      **Depende de**: T-001
      **QUÉ**: paquete `@one-markdown/web`; Tailwind 4 vía `@tailwindcss/vite` + `@import "tailwindcss"`
      (**sin** `tailwind.config.js` ni PostCSS); proxy `'/api' → http://localhost:3000`; Vitest 4 + jsdom +
      Testing Library; scripts `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`.
      Consultar `context7` antes de escribir la config de Vite 8 y React Router 8.
      **DONE**: `pnpm --filter @one-markdown/web build` sale 0 · `pnpm --filter @one-markdown/web test` corre sin error de config

- [x] **T-012** · `frontend` · App shell, enrutado y 404
      **AC**: AC-9, AC-10
      **Depende de**: T-011
      **RED**: `apps/web/src/app/AppShell.test.tsx` — al renderizar en `/` existen `role="navigation"` y
      `role="main"` y un único `<h1>`. `apps/web/src/app/routes.test.tsx` — al navegar a `/ruta-que-no-existe`
      se muestra el texto de 404 **y** el `role="navigation"` sigue montado.
      **GREEN**: `AppShell`, `WorkspaceEmptyState`, `NotFoundPage` y el router de `plan.md` §7;
      `useUiStore` con `sidebarCollapsed`/`toggleSidebar` y el botón con `aria-expanded`.
      **DONE**: `pnpm --filter @one-markdown/web test AppShell routes`

- [x] **T-013** · `frontend` · Cliente HTTP tipado contra el contrato compartido
      **AC**: AC-12
      **Depende de**: T-010, T-011
      **RED**: `apps/web/src/shared/api/http.test.ts` — con `fetch` mockeado: una respuesta `200` válida
      devuelve un `Health` tipado; una respuesta de error con forma `ErrorResponseDto` lanza `ApiError` con
      `statusCode` y `message` accesibles; una respuesta con cuerpo no-JSON también lanza `ApiError`.
      **GREEN**: `http.ts` con el wrapper de `fetch`, `ApiError` y `getHealth()` usando los tipos de
      `@one-markdown/shared`. Cero `any`.
      **DONE**: `pnpm --filter @one-markdown/web test http`

- [x] **T-014** · `frontend` · Smoke e2e con Playwright
      **AC**: AC-11
      **Depende de**: T-012
      **RED**: `apps/web/e2e/smoke.spec.ts` — abre `/`, espera título `One Markdown`, `role="main"` visible
      y **cero errores de consola** (`page.on('console')`). Debe fallar antes de existir el shell/config.
      **GREEN**: `playwright.config.ts` con `webServer` que levanta el dev server, proyecto chromium.
      **DONE**: `pnpm test:e2e`

- [~] **T-015** · `backend` · CI en GitHub Actions
      **BLOQUEADA EN**: el workflow está escrito y su YAML parsea correctamente (13 pasos, matriz 22/24,
      servicios postgres+redis), pero el `DONE` exige un run real y `git push` está denegado en esta
      sesión. Los 7 pasos de verificación se corrieron en local uno a uno y pasan.
      **SIGUIENTE PASO**: hacer push de la rama y pegar el enlace del run (verde), más un commit con un
      test roto para comprobar que el job queda en rojo.
      **AC**: AC-14
      **Depende de**: T-005, T-012
      **QUÉ**: `.github/workflows/ci.yml` — matriz Node 22 y 24, `services: postgres, redis`, pasos
      `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `test` → `test:e2e` → `build`, con caché de pnpm.
      **DONE**: run del workflow en verde en un push de rama; y verificación negativa: un commit con un
      test roto deja el job en rojo (se reporta el enlace del run, no una captura)

- [x] **T-016** · `backend` · Regla anti-`any` verificable
      **AC**: AC-13
      **Depende de**: T-001
      **RED**: `tools/lint-fixtures/explicit-any.ts` con un `any` explícito; el comando de verificación debe
      salir ≠ 0 antes de que la regla esté en `error` (o salir 0, delatando que la regla no aplica).
      **GREEN**: `@typescript-eslint/no-explicit-any` en `error` en la config plana, fixture excluido de los
      `tsconfig` de build y del `pnpm lint` normal.
      **DONE**: `pnpm exec eslint tools/lint-fixtures/explicit-any.ts; test $? -ne 0` · `pnpm lint` sale 0

## Definition of Done (todas las tareas)

1. El test se escribió primero y falló primero (reportado por el agente con la salida real del fallo).
   Las tareas `setup` no aplican esta regla pero sí el comando `DONE` con salida real.
2. Cada AC de la spec tiene al menos un test automatizado (ver tabla de trazabilidad en `spec.md` §6).
3. Backend: entrada y salida con DTO validado y documentado en Swagger; sin entidades Prisma crudas;
   sin `any`.
4. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan.
5. `IMPLEMENTATION.md` actualizado por el orchestrator con el comando de verificación y su resultado.
