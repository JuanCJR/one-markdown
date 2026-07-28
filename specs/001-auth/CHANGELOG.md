# Changelog — Spec 001 Auth

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.1.1 — 2026-07-25

**Patch. El andamiaje e2e de esta spec cambia; sus 26 AC y todos sus límites de producción, no.** Lo trae
`T-027` de la spec `002` (su **AC-35**), que toca `apps/web/e2e/**` por ser andamiaje de `001`, igual que
`T-026` tocó `vite.config.ts` de `000`. **No se modificó `THROTTLE_LIMITS` ni ningún umbral de seguridad**:
un límite no se relaja para que pase una suite.

- **El problema, con las dos cuentas medidas.** La suite de navegador comparte presupuesto de rate limit
  con esta spec: `register` admite **5 altas por IP cada 15 min** y `login` **10 entradas por minuto**. Una
  ejecución limpia gastaba **exactamente 5** altas, así que el primer reintento de CI (`retries: 2`) pedía
  la sexta y recibía un `429`. Y en el escenario del AC —todos los casos agotando los reintentos— las
  **entradas** se iban igual de arriba: smoke 3 casos × 3 intentos = **9**, más el flujo de auth que vuelve
  a entrar en cada intento (**3**) → **12 contra 10**. En los dos casos el rojo no tiene nada que ver con
  lo que la suite mide, y aparece justo cuando algo ya había ido mal.
- **Lo que se hizo**, en `apps/web/e2e/support/session.ts`, `support/services.ts` y `global-setup.ts`:
  · `signIn` intenta `POST /login` **antes** de registrar, y solo cae al `register` si el login falla por
    credenciales (camino de reserva, no el normal);
  · la cuenta compartida se crea **una sola vez** en `global-setup.ts`, antes de que arranque ningún caso;
  · se ponen a cero los contadores **`throttle:register:*` y `throttle:login:*`** antes de cada caso que
    los gaste, por el mismo camino RESP-sobre-TCP que ya usaba `global-setup` — **sin dependencias nuevas**.
    Los contadores de `mfa`, `refresh` y `workspace` quedan intactos y la suite los sigue gastando de
    verdad.
- **El bloqueo por cuenta era la parte no obvia, y por eso la cuenta compartida se crea una sola vez.**
  «Login antes de registrar» hace que, en una base limpia, **todos** los trabajadores empiecen con un
  `login` fallido contra una cuenta que aún no existe — y **5 fallos bloquean la cuenta 15 minutos**
  (`LoginAttemptService`, AC-7). Ese bloqueo es **por cuenta, no por IP**, así que ningún reset de
  `throttle:*` lo evita; en local Playwright levanta **6** trabajadores y era una moneda al aire. Hacer el
  alta una vez lo elimina **por construcción** y baja el gasto del smoke de 3 altas a **0**. Verificado en
  el bundle de Playwright 1.62 (`runner/index.js`, `createGlobalSetupTasks`) que los plugins de `webServer`
  corren **antes** de `globalSetup`, así que el API ya responde cuando se prepara la cuenta.
- **Qué cobertura se pierde y dónde vive ahora, que es lo que importa de esta entrada**: la suite de
  navegador **deja de poder detectar** los límites de `register` y de `login` — los neutraliza a propósito.
  Quien los verifica es `apps/api/test/auth-throttle.e2e-spec.ts`, con **un caso por cada uno**, y el
  bloqueo por cuenta `apps/api/test/auth-login.e2e-spec.ts` (`AC-7: bloqueo por cuenta tras cinco fallos`).
  Es su sitio: un límite **por IP** se prueba contra el API, no a través de un navegador. La cobertura de
  AC-7 y AC-20 queda **intacta**; se comprobó **antes** de neutralizar nada.
- **NO LLEVES ESTE RESET A LA SUITE DEL API.** Es el atajo obvio el día que aquella suite moleste por
  acumulación, y allí destruiría la única prueba de que los límites existen. **No se aplicó ninguno** —
  verificado: `grep -rn "throttle:" apps/api/test/` no devuelve nada— y la prohibición está escrita también
  en `apps/web/e2e/support/services.ts`, junto a la función que lo hace, porque en el código es donde la
  lee quien está a punto de hacerlo.
- **Verificado** (comandos corridos y salida real): RED
  `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` → `10 failed /
  5 passed` con `POST /api/auth/register devolvió 429`; tras el cambio, el mismo comando → **15 passed**,
  EXIT=0 · `pnpm test:e2e` → **5 passed** · `pnpm --filter @one-markdown/api test:e2e` → 20 suites /
  **455**, es decir que los e2e de auth de esta spec siguen enteros en verde. **Ningún test de `001` se
  puso en rojo.**

## v0.1.0 — 2026-07-24

Hallazgos de los Bloques A y D-parcial (T-001…T-003, T-012, T-013), sin cambio de alcance ni de criterios:

- **`otplib` 13 arrastra dependencias ESM puro** (`@scure/base`, `@noble/hashes`), y eso tiene dos
  consecuencias que la spec no había previsto:
  - El runtime CJS de **Jest** no las carga: `SyntaxError: Unexpected token 'export'`. Se resolvió con
    `allowJs` en el transform de ts-jest y un `transformIgnorePatterns` que **solo** exceptúa esos dos
    paquetes. Hace falta el mismo par de claves en `test/jest-e2e.json` antes de T-014/T-015.
  - En producción, `require('otplib')` necesita `require(esm)`, que Node trae sin flag **desde
    22.12**. Con 22.0–22.11 la API arrancaría y caería al primer uso de MFA. Por eso `engines` pasa de
    `>=22` a **`>=22.12`**; la matriz de CI (`node: ['22','24']`) ya instala el último 22.x, así que no
    cambia.
- **Tolerancia TOTP fijada en ±30 s** (un paso). Verificado empíricamente: a −25 s acepta, a ±90 s
  rechaza.
- `TotpService.verify` traduce a `false` las excepciones de otplib (código no numérico, longitud
  distinta de 6, secreto no base32): un segundo factor mal formado es una credencial inválida, no un
  500 que además serviría de oráculo.

- **`otplib` 13.4.1 se comporta como dice el plan**: verificado ejecutándolo (secret base32, token de 6
  dígitos, `verify().valid`, `generateURI` con issuer). El riesgo #1 queda cerrado.
- **`bcrypt` 6.0.0 compila y funciona** en Node v25.8.2 (`$2b$04$…`, `compare` true/false). Falta
  confirmar Node 22 y 24 en CI para cerrar el riesgo #3.
- **`@nestjs/throttler` expresa el TTL en milisegundos** (`seconds(60) === 60000`): al escribir los
  throttlers nombrados de `plan.md` §3 hay que usar el helper `seconds()`, no números crudos.
- **El prefijo de la migración lo pone Prisma**: quedó `20260725020837_auth_user_mfa` (UTC) en vez del
  `20260724_auth_user_mfa` que anticipaba `plan.md` §5. El nombre del plan era una predicción, no un
  requisito.
- **`MFA_ISSUER` vacío se trata como ausente** y toma el default, igual que `PORT` y `WEB_ORIGIN` en
  `env.validation.ts`. Se prefirió la coherencia del archivo a rechazar el valor vacío; no es un secreto
  y el default evita un `otpauth://` sin issuer.
- Dos correcciones que tocaron artefactos de la spec `000` y quedaron en su CHANGELOG (v0.1.2 y v0.1.3):
  el build de `packages/shared` antes de `typecheck`/`test`, y `dotenv/config` en `prisma.config.ts`.

Decisiones y riesgos del rate limit (T-017), sin cambio de criterios:

- **`logout` y `me` no tenían throttler asignado en `plan.md` §3**: quedaron con el de `refresh`
  (60/min/IP, cupo compartido). Si `me` acaba siendo la llamada más frecuente del frontend, conviene
  revisarlo.
- **Riesgo aceptado — NAT compartido**: el límite es por IP, así que varias personas detrás del mismo NAT
  comparten cupo y una puede agotar el de segundo factor de sus vecinas. Es el mismo trade-off que ya
  aceptaba `login` con 10/min por IP; se registra explícitamente en vez de dejarlo implícito.
- **Decisión pendiente para la spec `002`, no para esta**: al ser opt-in, un endpoint futuro que se olvide
  de `@Throttled` no tiene límite ninguno. Un quinto throttler `default` holgado (~300/min/IP) como red de
  seguridad lo cerraría. No se añade aquí porque no está en el alcance de `001`; entra como entrada de la
  spec del árbol de documentos, que es la que crea endpoints nuevos.

Decisiones tomadas durante la implementación del frontend (Bloque F), sin cambio de criterios:

- **`mfa/enable` y `mfa/disable` mantienen `401` para "código o contraseña incorrectos"**, como dicen
  AC-15 y AC-19, aunque el mismo `401` signifique también "el bearer caducó". La asimetría es real y la
  destapó el frontend: un cliente genérico con refresh-on-401 interpretaría un código mal tecleado como
  token caducado, dispararía un refresh, reintentaría el código equivocado y podría **cerrar la sesión en
  medio del enrolamiento**. Se resuelve en el cliente con un opt-out explícito por endpoint
  (`refreshOn401: false`, con dos tests propios) en vez de cambiar el contrato, porque cambiarlo obligaría
  a tocar dos AC ya aprobados. Si más adelante se prefiere `403`/`422` para "segundo factor rechazado",
  es un cambio **minor** de esta spec y se decide aparte.
- **Los tipos de *request* no son contrato compartido todavía**: `packages/shared` publica respuestas y
  guards (T-019). El frontend declara `RegisterInput`, `LoginInput`, `MfaVerifyInput` y `MfaDisableInput`
  en su propio cliente HTTP. Promoverlos a `packages/shared` queda como mejora, no como deuda urgente: el
  `ValidationPipe` del backend es el que valida de verdad.
- **El *single-flight* del refresh vive en el cliente HTTP, no en el store** (el plan §7 lo insinuaba en el
  store). Ponerlo en el store creaba el ciclo `auth.store → http → auth.store`; se resolvió con un puente
  inyectado. El comportamiento observable de AC-24 es el mismo y está testeado en los dos niveles.
- **Hallazgo de entorno de test que invalidaba una verificación**: en este jsdom `window.localStorage`
  llega como un objeto sin `setItem` (el `localStorage` propio de Node gana la partida), así que el assert
  de AC-23 "el almacenamiento sigue vacío" pasaba **por accidente**. Ahora `src/test/setup.ts` instala un
  `Storage` en memoria que guarda de verdad; comprobado con una prueba desechable.
- **La cabecera del `AppShell` suma correo, enlace a `/settings/security` y botón de cerrar sesión.** Va
  más allá de la letra de T-024, pero sin eso la pantalla de seguridad era inalcanzable y no existía forma
  de cerrar sesión en la aplicación.

- **Aprobada por el usuario el 2026-07-24** sin cambios de alcance: los tres puntos que se le señalaron
  (enumeración de cuentas en el registro, ausencia de recuperación por correo y MFA opcional por usuario)
  quedan aceptados tal como están escritos. Estado `draft` → `approved`; arranca la Fase 3.
- Spec inicial (draft). Alcance: registro, login, JWT access (15 min, en memoria del cliente) + refresh
  (7 días, cookie `HttpOnly` con rotación y detección de reutilización), bcrypt, MFA TOTP opcional con
  códigos de recuperación, sesiones y contadores en Redis, rate limit por IP y bloqueo por cuenta, guard
  y decorador `@CurrentUser()` para las specs siguientes, y las vistas de auth de la web.
- 26 criterios de aceptación, 26 tareas TDD en 7 bloques.
- Versiones fijadas contra npm el 2026-07-24 (ver `plan.md` §1). **`otplib` 13.4.1** reescribió la API
  respecto de la 12.x: `new OTP({ strategy: 'totp' })`, `generate`/`verify` asíncronos, `verify` devuelve
  `VerifyResult` y la tolerancia se expresa en segundos (`epochTolerance`). Verificado con `context7`;
  queda encapsulado en un `TotpService` propio con `epoch` inyectable.
- `@nestjs/throttler` 6.5.0 verificado con `context7`: `forRoot({ throttlers, storage, getTracker,
  errorMessage })`, throttlers nombrados, `@Throttle` / `@SkipThrottle`.
- Decisión registrada: **el storage del throttler se implementa en el proyecto** sobre el `RedisService`
  que ya existe, en vez de añadir `@nest-lab/throttler-storage-redis` (compatibilidad con la 6.x no
  confirmada, riesgo #2).
- Decisión registrada: **Passport solo para el access token** (`passport-jwt`). Sin `passport-local`: el
  login valida por DTO en `AuthService`, porque `LocalStrategy` recibe el request antes del
  `ValidationPipe` global y obligaría a duplicar la validación.
- Decisión registrada: **el secreto TOTP se cifra con AES-256-GCM** (`MFA_ENCRYPTION_KEY`, nueva variable
  de entorno requerida) y solo se persiste al confirmar el enrolamiento; el secreto pendiente vive en
  Redis con TTL de 10 minutos.
- Decisión registrada: el contrato usa **`null` explícito en vez de propiedades ausentes** en todo lo
  opcional (`displayName`, `session`, `mfaToken`), por `exactOptionalPropertyTypes`.
- Decisión registrada: **primera migración con modelos de negocio** (`users`, `mfa_recovery_codes`,
  `20260724_auth_user_mfa`). La spec `000` había previsto que la primera migración fuera de `001` o de
  `002`; llega aquí.
- Riesgo aceptado y documentado: el registro devuelve `409` ante un correo ya usado, lo que permite
  enumerar cuentas; evitarlo exige el proveedor de correo, que está fuera de alcance (riesgo #8).
- Fuera de alcance explícito: verificación de correo, recuperación de contraseña, OAuth/SSO, roles,
  gestión de sesiones desde la UI, revocación inmediata del access token, cambio de contraseña,
  WebAuthn y MFA por SMS.
