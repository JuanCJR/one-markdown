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
- [x] **spec 001-auth** — `specs/001-auth/` (`spec.md` v0.1.0 + `plan.md` + `tasks.md` + `CHANGELOG.md`),
      estado **approved** (aprobada por el usuario el 2026-07-24, sin cambios de alcance). — 2026-07-24
      26 criterios de aceptación y 26 tareas TDD en 7 bloques; la implementación es la Fase 3.
      Versiones de las dependencias nuevas fijadas contra npm y APIs verificadas con `context7`
      (`otplib` 13.x cambió de API respecto de la 12.x; `@nestjs/throttler` 6.x).
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
      **2026-07-24, primer run real** (`30139345799`, tras el push del usuario): **rojo** en `Typecheck`, en
      las dos versiones de Node. No fue un falso positivo del CI: era un defecto real del AC-1 (ver la nota
      de verificación abajo y `specs/000-foundation/CHANGELOG.md` v0.1.2). Con eso queda cubierta la mitad
      negativa del `DONE` (el job se pone rojo cuando algo falla), y con más valor que un test roto a mano.
      **Falta**: el run verde con el arreglo pusheado.
- [x] **T-016** · backend · Regla anti-`any` verificable con fixture de lint (AC-13)
      Con la regla desactivada el fixture sale 0; con la config del proyecto sale 1 con `@typescript-eslint/no-explicit-any` × 2. `pnpm lint` sigue en 0.

## Fase 3 — Implementación de `001-auth`

Detalle completo en `specs/001-auth/tasks.md`. Spec **aprobada el 2026-07-24**: la fase está en curso.
Cada línea llevará el comando que se corrió y su salida real, igual que la Fase 2.

Base (dependencias, entorno, esquema):

- [x] **T-001** · backend · setup · Dependencias de auth — 2026-07-24
      13 paquetes en las versiones exactas del plan (`pnpm add -E`), `pnpm --filter api build` → exit 0.
      Smoke real de las tres dependencias con riesgo: **bcrypt** (nativo, riesgo #3) → hash `$2b$04$`,
      `compare` correcto/incorrecto → `true false` en Node v25.8.2 · **otplib 13** → secret base32,
      token de 6 dígitos, `verify().valid === true`, `generateURI` → `otpauth://totp/One%20Markdown:…` ·
      **qrcode** → `data:image/png;base64,…` · `@nestjs/throttler` → `seconds(60) === 60000` (ms).
      El riesgo #1 (API nueva de otplib 13) queda cerrado: se comporta como dice el plan.
      **Pendiente**: bcrypt en Node 22/24 se confirma en el próximo run de CI.
- [x] **T-002** · backend · Variables de entorno de auth validadas al arranque (AC-26) — 2026-07-24
      RED: `Property 'MFA_ENCRYPTION_KEY' does not exist on type 'AppConfig'` (+7 errores TS más) →
      GREEN: `test env.validation` → **33 passed** (antes 16).
      Verificado además en el **proceso real** (no solo en el test): sin la variable →
      `MFA_ENCRYPTION_KEY es requerida`; con una clave de 16 bytes →
      `debe decodificar a exactamente 32 bytes (tiene 16); genérala con: openssl rand -base64 32`.
      Y arrancando con el `.env` del usuario → `Nest application successfully started`, lo que **verifica
      indirectamente que sus variables nuevas son correctas** (pendiente 5 de la lista de abajo).
      `BCRYPT_ROUNDS=4` y una `MFA_ENCRYPTION_KEY` fija quedaron en `test/setup-env.ts`.
- [x] **T-003** · backend · setup · Modelos `User` y `MfaRecoveryCode` + migración — 2026-07-24
      `prisma migrate dev --name auth_user_mfa` → migración **`20260725020837_auth_user_mfa`** aplicada ·
      `prisma migrate status` → `Database schema is up to date!`
      Esquema real verificado con `psql`, no solo con el schema: `users` con sus 8 columnas,
      `users_email_key` UNIQUE, `mfa_recovery_codes` con `mfa_recovery_codes_userId_idx` y FK
      `ON DELETE CASCADE`. Probado en una transacción con `ROLLBACK`: el correo duplicado revienta con
      `duplicate key value violates unique constraint "users_email_key"` y al borrar el usuario quedan
      **0** códigos huérfanos. Sin filas residuales (`0|0`).
      **Desvío**: el prefijo de la migración lo pone Prisma (`20260725020837`, UTC), no el
      `20260724_auth_user_mfa` que anticipaba el plan.

Primitivas de sesión:

- [x] **T-004** · backend · `PasswordService` con bcrypt y hash señuelo (AC-4) — 2026-07-24
      RED: `Cannot find module './password.service'` → GREEN: `test password.service` → **10 passed**.
      Incluye la verificación del coste real de producción (`$2b$12$`) además del 4 de los tests, y que
      `compareWithDecoy` **ejecuta un bcrypt de verdad** contra un hash señuelo (decisión 9: sin eso el
      tiempo de respuesta delata qué correos existen, aunque el cuerpo del 401 sea idéntico).
      **Hallazgo**: `jest.spyOn(bcrypt, 'compare')` falla con `Cannot redefine property`; los exports de
      bcrypt no son reconfigurables. Se resolvió con `jest.mock` que **delega en `requireActual`**, así el
      test sigue ejecutando bcrypt real y además observa las llamadas.
- [x] **T-005** · backend · `TokenService`: access, refresh y `mfaToken` (AC-5, AC-12) — 2026-07-24
      RED: `Cannot find module './token.service'` → GREEN: `test token.service` → **14 passed**.
      Los cuatro casos de token cruzado están cubiertos: refresh como access, access como refresh,
      `mfaToken` como access, y un token con el **secreto correcto pero `typ` equivocado** (que es el que
      seguiría fallando si algún día los secretos se unificaran por error).
- [x] **T-006** · backend · `SessionStore` en Redis (AC-9…AC-11) — 2026-07-24
      RED: `Cannot find module './session.store'` → GREEN: `test session.store` → **12 passed** contra el
      Redis real de docker. Verificado: TTL de la clave y del índice, que el `jti` viejo muere al rotar,
      que la reutilización **vacía toda la familia**, `revokeAll` con `exceptSid`, y que de **dos
      rotaciones simultáneas con el mismo `jti` solo una gana** (la rotación es un script Lua: con
      GET+SET las dos se habrían creído válidas).
- [x] **T-007** · backend · `LoginAttemptService`: bloqueo por cuenta (AC-7) — 2026-07-24
      RED: módulos inexistentes → GREEN: `test login-attempt` → **7 passed**.
      4 fallos no bloquean, el 5.º sí (429 con `retryAfterSeconds` entre 1 y 900), `reset` levanta el
      bloqueo, las claves son `auth:login:(fail|lock):<sha256>` **sin el correo en claro**, y la
      normalización evita que `A@B.test` abra un contador aparte.

Endpoints de sesión:

- [x] **T-008** · backend · `POST /api/auth/register` (AC-1, AC-2, AC-3) — 2026-07-24 · agente `backend`
      RED: **12 failed**, todas `expected 201, got 404` → GREEN: `test:e2e auth-register` → **12 passed**.
      El `409` sale de la violación de índice único de Prisma (`P2002`) y **no** de un `findUnique` previo:
      entre la consulta y el insert cabe otro registro con el mismo correo, y el índice es el único juez atómico.
- [x] **T-009** · backend · `POST /api/auth/login` sin segundo factor (AC-5, AC-6, AC-7) — 2026-07-24 · agente `backend`
      RED: **10 failed** (404) → GREEN: `test:e2e auth-login` → **10 passed**.
      El mensaje del 401 es una **constante compartida** por los dos caminos, no un literal repetido: si cada
      rama escribiera su texto, un retoque reabriría la enumeración de cuentas sin que se note.
- [x] **T-010** · backend · `JwtAuthGuard`, `@CurrentUser()` y `GET /api/auth/me` (AC-8, AC-12) — 2026-07-24 · agente `backend`
      RED: **10 failed** (404) → GREEN: `test:e2e auth-me` → **10 passed**.
      **Contrato para la spec `002`**: `import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../auth'`.
      `AuthenticatedUser` incluye `sid` (lo necesita `mfa/disable` para preservar la sesión actual). El guard
      valida que el `sub` sea UUID antes de consultar, para que un token manipulado dé 401 y no un 500 de Postgres.
- [x] **T-011** · backend · `POST /api/auth/refresh` y `POST /api/auth/logout` (AC-9…AC-11) — 2026-07-24 · agente `backend`
      RED: **12 failed** (404) → GREEN: `test:e2e auth-session` → **12 passed**.
      `refresh` rota sobre el **mismo `sid`**: un `sid` nuevo por refresh haría crecer la familia sin límite y
      "revocar la familia" dejaría de servir. `RefreshRequestDto` es una clase vacía a propósito, para que
      `forbidNonWhitelisted` rechace con 400 cualquier cuerpo en un endpoint cuya credencial es la cookie.
      `bootstrap.ts` monta `cookie-parser` y `enableCors({ credentials: true })` (decisión 13).

MFA TOTP:

- [x] **T-012** · backend · `MfaSecretCipher` AES-256-GCM (AC-14) — 2026-07-24 · agente `backend`
      RED: `Cannot find module './mfa-secret.cipher'` → GREEN: **17 passed**.
      Verificado por el orchestrator (`test "mfa-secret.cipher|totp.service"` → **37 passed**) y revisado
      a mano: IV de 12 bytes por operación, tag GCM verificado, formato `iv.tag.ciphertext` en base64url,
      guarda de clave de 32 bytes en el constructor y **error único** en todo fallo de descifrado (no
      dice en qué byte se equivocó quien manipule la fila).
- [x] **T-013** · backend · `TotpService` sobre otplib 13 + QR (AC-13, AC-17) — 2026-07-24 · agente `backend`
      RED: `Cannot find module './totp.service'` → GREEN: **20 passed**.
      Tolerancia ±30 s comprobada empíricamente (−25 s acepta, ±90 s rechaza); `epoch` inyectable, así
      que ni los tests ni los e2e dependen del reloj de la máquina.
      **Desvío autorizado a posteriori**: el agente tuvo que tocar el bloque `jest` de
      `apps/api/package.json`. `otplib` 13 arrastra `@scure/base` y `@noble/hashes`, que son **ESM puro**,
      y el runtime CJS de Jest moría con `SyntaxError: Unexpected token 'export'`. El arreglo es aditivo
      (`allowJs` + `transformIgnorePatterns` que solo exceptúa esos dos paquetes) y no afecta a `tsc` ni
      a `nest build`. Consecuencias: (a) `test/jest-e2e.json` necesita el mismo par de claves antes de
      T-014/T-015 — se aplica en cuanto el agente del Bloque C suelte `test/**`; (b) `require('otplib')`
      exige `require(esm)`, que Node trae sin flag **desde 22.12**, así que `engines` pasa a `>=22.12`
      (la matriz de CI ya instala el último 22.x).
- [x] **T-014** · backend · `mfa/setup` y `mfa/enable` con códigos de recuperación (AC-13…AC-15) — 2026-07-24 · agente `backend`
      RED: **19 failed** (`got 404`) → GREEN: `test:e2e auth-mfa` → **19 passed**.
      El secreto pendiente vive cifrado en Redis con TTL de 10 min: tras el `setup`, `mfaEnabled` sigue
      `false` y `mfaSecret` nulo en la base (AC-13 verificado leyendo la fila, no la respuesta).
      Los códigos de recuperación evitan `I`, `O`, `0` y `1`: se copian a mano de una pantalla.
- [x] **T-015** · backend · Login con segundo factor y `mfa/verify` (AC-16…AC-18) — 2026-07-24 · agente `backend`
      RED: (a) `Cannot find module './mfa-challenge.store'` · (b) **26 failed de 27** → GREEN: `test
      mfa-challenge.store` → **9 passed** · `test:e2e auth-mfa-login` → **27 passed**.
      Dos decisiones que valen: el intento se **contabiliza antes** de verificar el código (un fallo a
      mitad no regala intentos) y el script Lua usa `KEEPTTL`, así que teclear códigos no alarga los 5
      minutos del desafío. `verifyChallenge` cruza `lookup.userId === payload.sub`: un `mfaToken` no sirve
      para completar el login de otra cuenta.
- [x] **T-016** · backend · `mfa/disable` (AC-19) — 2026-07-24 · agente `backend`
      RED: **15 failed de 34** → GREEN: `test:e2e auth-mfa` → **34 passed**.
      Comprueba la contraseña antes del código, con test dedicado a que un intento con contraseña mala
      **no queme** un código de recuperación. Revoca las demás sesiones y deja viva la actual (verificado
      con dos cookies de refresh distintas).

Transversales del backend:

- [ ] **T-017** · backend · Rate limit por IP con `RedisThrottlerStorage` propio (AC-20)
      **Entrada obligatoria**: tres huecos que la autorevisión de seguridad del Bloque D encontró y
      reportó en vez de parchear (el plan asigna `@Throttle` a esta tarea). No son opcionales:
      1. **`POST /api/auth/mfa/disable` no tiene límite de ningún tipo.** `LoginAttemptService` solo cuenta
         fallos de login. Quien robe un access token puede fuerza-brutar el TOTP de 6 dígitos (~333k
         peticiones esperadas) o la contraseña sin fricción. Es el más serio de los tres.
      2. **`mfa/verify` limita a 5 intentos por desafío, pero no el número de desafíos**: quien ya tenga la
         contraseña pide un login nuevo cada 5 intentos y sigue probando.
      3. `RecoveryCodeService.consume` compara hasta 8 hashes bcrypt por intento: con coste 12 son ~2 s de
         CPU por petición en un endpoint sin límite, o sea un amplificador de DoS barato.
- [ ] **T-018** · backend · Swagger de auth: bearer, cookie y DTOs (AC-21)
- [x] **T-019** · backend · Contrato de auth en `packages/shared` — 2026-07-24 · agente `backend`
      RED: `TypeError: isAuthUser is not a function` → **25 failed** → GREEN: `--filter shared test` →
      **37 passed** (antes 11). Verificado por el orchestrator, más `lint` y `typecheck` de `shared` en 0.
      Publica `AuthUser`, `AuthSession`, `LoginResult`, `MfaSetup`, `MfaRecoveryCodes` y sus guards.
      Dos detalles que valen más que el resto:
      · **`ApiErrorShape` gana `retryAfterSeconds?`** — hueco que salió al revisar el Bloque C: el backend
        ya emitía el campo en el `429` de cuenta bloqueada, pero el contrato no lo conocía y el frontend no
        habría podido decir cuánto esperar.
      · Los guards comprueban **presencia de la clave** antes del valor, así que un campo *ausente* no cuela
        como `null`. Sin eso, la regla de "`null` explícito, nunca ausente" sería solo un comentario.
      **Pendiente derivado**: falta añadir `implements LoginResult` en `login.response.dto.ts` y los
      `implements` de los DTO de MFA cuando existan (el agente no los tocó porque otro los estaba editando).

Frontend:

- [ ] **T-020** · frontend · Cliente HTTP autenticado con refresh single-flight y reintento único (AC-24)
- [ ] **T-021** · frontend · `useAuthStore` y arranque con refresh silencioso (AC-22, AC-23)
- [ ] **T-022** · frontend · `/login`, `/register` y `RequireAuth` (AC-22)
- [ ] **T-023** · frontend · Paso de segundo factor en el login (AC-23)
- [ ] **T-024** · frontend · `/settings/security`: alta y baja de MFA
- [ ] **T-025** · frontend · e2e del flujo de auth en navegador (AC-25)

CI:

- [ ] **T-026** · backend · CI con `prisma migrate deploy` y variables de auth (comparte el bloqueo de push de T-015 de la spec 000)

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

### Verificación del Bloque C contra el proceso real (2026-07-24)

Los 62 e2e pasan, pero además se arrancó el binario (`node dist/main.js`, puerto 3099, con el `.env` real)
y se recorrió el flujo con `curl`, que es lo que en la Fase 2 destapó el `EADDRINUSE` que ningún test veía:

| Comprobación | Resultado observado |
|---|---|
| `POST /api/auth/register` | `201` · `Set-Cookie: om_refresh=…; Max-Age=604800; Path=/api/auth; HttpOnly; SameSite=Strict` · cuerpo con `accessToken,expiresInSeconds,tokenType,user` y nada más |
| `GET /api/auth/me` con Bearer | `200`, claves exactas de `UserResponseDto`, **sin** `passwordHash` ni `mfaSecret` |
| `POST /api/auth/refresh` | `200` y cookie **distinta** de la anterior (rotación) |
| Reutilizar la cookie vieja | `401` — y la cookie **nueva** también `401`: familia revocada (AC-10 de punta a punta) |
| 5 fallos + 6.º intento **con la contraseña correcta** | `429` · cabecera `Retry-After: 900` · cuerpo con `retryAfterSeconds: 900` (AC-7) |
| Contraseña mala vs correo inexistente | `message` **idéntico** en los dos: `Credenciales inválidas` (AC-6) |
| `logout` con cookie / sin cookie | `204` y `204`; la cookie sale con `Max-Age=0` y el refresh posterior da `401` |
| `refresh` con cuerpo no vacío | `400` (el DTO vacío hace su trabajo) |
| Regresión: un `404` cualquiera | sigue con las 5 claves de siempre, **sin** `retryAfterSeconds` |

Datos de la prueba borrados después: 0 usuarios en `users`, 0 claves `auth:*` en Redis.

**Falso positivo mío, anotado para no repetirlo**: en el primer intento conté mal los fallos (el intento
contra un correo inexistente cuenta en **otra** clave) y creí ver un bloqueo que no saltaba. La
implementación estaba bien; el guion de prueba, no.

**Un error de diagnóstico mío, peor que el anterior**: cuando el agente del Bloque C reportó un fallo
unitario en `mfa-secret.cipher.spec.ts`, lo despaché como "transitorio, el otro agente estaba escribiendo a
la vez". No lo era: **el test era intermitente de verdad**, ~1 de cada 8 corridas. `alterarParte` cambiaba el
último carácter base64url de una de las tres partes, y cuando la parte no mide múltiplo de 3 bytes (el tag son
16 y el texto cifrado 32) los bits bajos de ese carácter son relleno que `Buffer.from(…, 'base64url')`
descarta: la parte "alterada" decodificaba a los **mismos** bytes y GCM la aceptaba con toda la razón. Lo
detectó y lo arregló el agente del Bloque D invirtiendo un bit de un byte real; verificado con **10 corridas
verdes de 10**. Lección: un fallo que no se reproduce no es un fallo transitorio hasta que se explica **por
qué** desapareció.

### Lo que destapó el primer run de CI (2026-07-24)

Run `30139345799` (push de `d9c2854` a `main`): **rojo en `Typecheck`**, Node 22 y Node 24, con
`TS2307: Cannot find module '@one-markdown/shared'` en los tres DTO que lo importan.

- **Causa**: `apps/api` y `apps/web` resuelven el paquete compartido por su `types: ./dist/index.d.ts`
  (decisión 2b de `specs/000-foundation/plan.md`), y en un clon limpio ese `dist/` **no existe** cuando
  corre `pnpm typecheck`. En esta máquina pasaba porque el `dist/` estaba construido de antes — incluido
  el `tsc --watch` que dejó corriendo `pnpm dev`.
- **El AC-1 de la spec `000` estaba mal verificado**: dice "clon nuevo → `pnpm install && pnpm typecheck`
  en 0" y se comprobó sobre un árbol sucio. Reproducido en local con `rm -rf packages/shared/dist`.
- **Arreglo**: script `shared:build` en la raíz, y `typecheck`, `test` y `test:e2e` lo ejecutan antes.
  En los scripts y no solo en el workflow, porque el AC-1 habla del clon nuevo, no del CI. `build` no
  necesitó cambio: `pnpm -r build` ya respeta el orden topológico.
- **Verificado borrando `packages/shared/dist` antes de cada comando**: `pnpm typecheck` → 0 ·
  `pnpm test` → 0 (api 22, web 14, shared 11) · `pnpm lint` → 0 · `pnpm build` → 0.
- **Regla que sale de aquí**: los comandos `DONE` se corren también desde estado limpio. Un `dist/`
  heredado convierte un fallo real en falso verde, que es exactamente lo que este seguimiento
  pretende evitar.

### Pendientes que dependen del usuario

1. **`.env.example`** — `.claude/settings.json` deniega leer y escribir `.env.*`, así que no se tocó.
   Estado verificado el 2026-07-24 (solo metadatos, sin leer contenido): existen `.env.example` en la raíz
   y `apps/api/.env`. **Falta confirmar** que contengan las 7 claves de `plan.md` §4:

   ```
   NODE_ENV=development
   PORT=3001
   DATABASE_URL=postgresql://one_markdown:one_markdown@localhost:5433/one_markdown
   REDIS_URL=redis://localhost:6379
   JWT_ACCESS_SECRET=<mínimo 32 caracteres>
   JWT_REFRESH_SECRET=<mínimo 32 caracteres, distinto del anterior>
   WEB_ORIGIN=http://localhost:5173
   ```
2. **~~Ejecutar el CI~~** — hecho por el usuario el 2026-07-24: push de `d9c2854` a `main` → run
   `30139345799`. Salió en rojo por un defecto real (ver la sección anterior). Queda pendiente el run
   verde con el arreglo.
3. **~~Commit~~** — la Fase 2 quedó commiteada en `d9c2854` y pusheada.
4. **~~Aprobar la spec `001-auth`~~** — aprobada el 2026-07-24. Fase 3 en curso.
5. **~~`.env.example` para `001-auth`~~** — el usuario confirma que creó las variables el 2026-07-24. No
   se pudo verificar desde la sesión (`.env.*` está denegado, y `ConfigModule` las carga en runtime, así
   que tampoco aparecen en el entorno del proceso). Se comprobará de forma indirecta al cerrar `T-002`:
   con la validación en su sitio, el API no arranca si falta `MFA_ENCRYPTION_KEY`. Claves esperadas:

   ```
   JWT_ACCESS_TTL=900
   JWT_REFRESH_TTL=604800
   BCRYPT_ROUNDS=12
   MFA_ENCRYPTION_KEY=<openssl rand -base64 32>
   MFA_ISSUER=One Markdown
   ```

   Ojo: perder `MFA_ENCRYPTION_KEY` inutiliza los secretos TOTP ya guardados (los usuarios con MFA
   tendrían que re-enrolarse con un código de recuperación).
