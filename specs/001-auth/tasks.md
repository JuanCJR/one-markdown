# Tareas 001 — Auth

Spec: `spec.md` v0.1.0 · Plan: `plan.md`

Cada tarea es atómica, se asigna a un agente y sigue RED → GREEN → REFACTOR.
El test se escribe primero y **debe fallar antes** de implementar.

**Tareas de tipo `setup`**: instalar dependencias o correr una migración no tiene un test que pueda
fallar antes de que exista el paquete o la tabla. Se marcan `setup` y se verifican con un comando de
salida observable. **Toda tarea que introduce comportamiento es TDD estricta.** No se admite una tarea
`setup` que además implemente comportamiento.

---

## Bloque A — Base (dependencias, entorno, esquema)

- [x] **T-001** · `backend` · `setup` · Dependencias de auth
      **AC**: — (habilita todo el bloque)
      **Depende de**: —
      **QUÉ**: instalar en `apps/api` las versiones **exactas** de `plan.md` §1: `@nestjs/jwt`,
      `@nestjs/passport`, `passport`, `passport-jwt` (+ tipos), `bcrypt` (+ tipos), `otplib`, `qrcode`
      (+ tipos), `@nestjs/throttler`, `cookie-parser` (+ tipos). Nada más.
      **DONE**: `pnpm --filter @one-markdown/api build` sale 0 · un script de un solo uso que hace
      `bcrypt.hash('x', 4)` + `compare` correcto/incorrecto imprime `true false`
      **NOTA**: si `bcrypt` no compila (riesgo #3), **parar y reportar** al orchestrator; el cambio a
      `bcryptjs` no se decide en la tarea.

- [x] **T-002** · `backend` · Variables de entorno de auth validadas al arranque
      **AC**: AC-26
      **Depende de**: T-001
      **RED**: ampliar `apps/api/src/config/env.validation.spec.ts` — sin `MFA_ENCRYPTION_KEY` el
      validador lanza un error cuyo mensaje contiene `MFA_ENCRYPTION_KEY`; con una clave base64 que
      decodifica a 16 bytes, también falla nombrándola; `JWT_ACCESS_TTL`/`JWT_REFRESH_TTL`/`BCRYPT_ROUNDS`
      fuera de rango fallan nombrando la variable; ausentes toman los defaults de `plan.md` §4 y el
      objeto devuelto los expone tipados.
      **GREEN**: nuevos campos en `EnvironmentVariables` y en `AppConfig` según `plan.md` §4;
      `MFA_ENCRYPTION_KEY` con validador propio (decodifica base64 → 32 bytes exactos). Cero `any`.
      **DONE**: `pnpm --filter @one-markdown/api test env.validation`
      **NOTA**: `.env.example` está denegado a la sesión; el orchestrator lo deja anotado como pendiente
      del usuario y añade las claves de test a `apps/api/test/setup-env.ts`.

- [x] **T-003** · `backend` · `setup` · Modelos `User` y `MfaRecoveryCode` + primera migración
      **AC**: — (habilita AC-1, AC-2, AC-4, AC-14, AC-18)
      **Depende de**: T-002
      **QUÉ**: `apps/api/prisma/schema.prisma` con los dos modelos de `plan.md` §5 (índice único en
      `email`, `@@index([userId])`, `onDelete: Cascade`, `@@map` a `users` / `mfa_recovery_codes`).
      Migración `20260724_auth_user_mfa`.
      **DONE**: `pnpm --filter @one-markdown/api exec prisma migrate dev --name auth_user_mfa` sale 0 ·
      `prisma migrate status` → sin migraciones pendientes · verificación del esquema real con el MCP
      `postgres` (o `\d+ users`): columnas, tipos, índice único en `email` y FK con cascada

## Bloque B — Primitivas de sesión

- [x] **T-004** · `backend` · `PasswordService` (bcrypt)
      **AC**: AC-4
      **Depende de**: T-002
      **RED**: `apps/api/src/auth/password.service.spec.ts` — `hash()` devuelve un valor con prefijo
      `$2b$`, distinto del texto original, y distinto entre dos llamadas con la misma contraseña (salt);
      `compare()` da `true` con la correcta y `false` con otra; el coste sale de `BCRYPT_ROUNDS`
      (con `12` el hash empieza por `$2b$12$`); `compareWithDecoy()` devuelve `false` y **sí** ejecuta
      un bcrypt (se verifica con un espía) cuando no hay usuario.
      **GREEN**: `PasswordService` con `hash`, `compare` y `compareWithDecoy` (hash señuelo generado al
      inicializar el servicio). Decisión 9 de `plan.md`.
      **DONE**: `pnpm --filter @one-markdown/api test password.service`

- [x] **T-005** · `backend` · `TokenService` (access, refresh y `mfaToken`)
      **AC**: AC-5, AC-12
      **Depende de**: T-002
      **RED**: `apps/api/src/auth/token.service.spec.ts` — `signAccess({ userId, sid })` produce un JWT
      que `verifyAccess` acepta y cuyo payload trae `sub`, `sid`, `typ: 'access'` y `exp` a
      `JWT_ACCESS_TTL` del `iat`; `verifyAccess` **rechaza** un token firmado con el secreto de refresh y
      uno con `typ: 'refresh'` o `typ: 'mfa'`; ídem en espejo para `verifyRefresh` (que además expone
      `jti`); un token expirado (TTL negativo inyectado) se rechaza; `signMfa` produce `typ: 'mfa'` con
      TTL de 5 min y no lo acepta `verifyAccess`.
      **GREEN**: `TokenService` sobre `@nestjs/jwt` con dos configuraciones de secreto y `typ` explícito
      en cada payload; tipos de payload exportados, cero `any`.
      **DONE**: `pnpm --filter @one-markdown/api test token.service`

- [x] **T-006** · `backend` · `SessionStore` en Redis (rotación, reutilización, revocación)
      **AC**: AC-9, AC-10, AC-11
      **Depende de**: T-005
      **RED**: `apps/api/src/auth/session.store.spec.ts` (contra el Redis de docker, claves con prefijo
      propio del test) — `create()` guarda `auth:session:{userId}:{sid}` con TTL ≈ `JWT_REFRESH_TTL` y
      añade el `sid` al índice; `rotate()` con el `jti` vigente devuelve el `jti` nuevo y deja el
      anterior inválido; `rotate()` con un `jti` **ya rotado** devuelve el resultado de reutilización
      **y** deja vacías todas las claves del usuario (familia revocada); `revoke(sid)` invalida solo esa
      sesión; `revokeAll()` invalida todas; una sesión inexistente no lanza, devuelve "no encontrada".
      **GREEN**: `SessionStore` con el mapa de claves de `plan.md` §6 y las cuatro operaciones; la
      rotación es atómica (Lua o `WATCH`/`MULTI`) para que dos refresh simultáneos no acepten los dos.
      **DONE**: `pnpm --filter @one-markdown/api test session.store`

- [x] **T-007** · `backend` · `LoginAttemptService` (bloqueo por cuenta)
      **AC**: AC-7
      **Depende de**: T-002
      **RED**: `apps/api/src/auth/login-attempt.service.spec.ts` — cuatro fallos no bloquean; el quinto
      bloquea y `assertNotLocked()` lanza con `retryAfterSeconds > 0`; `reset()` tras un login correcto
      pone el contador a cero; la clave usada es `sha256(email)` y **no** contiene el correo en claro
      (se verifica leyendo las claves de Redis); el correo se normaliza (mayúsculas y espacios dan la
      misma clave).
      **GREEN**: `LoginAttemptService` con `registerFailure`, `reset`, `assertNotLocked` y las claves de
      `plan.md` §6; constantes (5 intentos, 15 min) en el propio servicio, no en env.
      **DONE**: `pnpm --filter @one-markdown/api test login-attempt.service`

## Bloque C — Endpoints de sesión

- [x] **T-008** · `backend` · `POST /api/auth/register`
      **AC**: AC-1, AC-2, AC-3
      **Depende de**: T-003, T-004, T-005, T-006
      **RED**: `apps/api/test/auth-register.e2e-spec.ts` — alta válida → `201`, claves del cuerpo
      exactamente las de `AuthSessionResponseDto`, `user` sin `passwordHash` ni `mfaSecret`, y
      `Set-Cookie` con `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`; el mismo correo en otra caja →
      `409` y una sola fila en `users`; correo inválido / contraseña de 11 caracteres / contraseña sin
      dígito / propiedad no declarada → `400` nombrando el campo y sin crear usuario; la fila guardada
      tiene hash `$2b$` que valida con la contraseña enviada (AC-4).
      **GREEN**: `AuthModule`, `AuthController`, `AuthService.register()`, `RegisterRequestDto`,
      `UserResponseDto`, `AuthSessionResponseDto` (construidos explícitamente, con `@ApiProperty`), y el
      helper de cookie de refresh (`plan.md` §3). Nunca se devuelve la entidad Prisma.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e auth-register`

- [x] **T-009** · `backend` · `POST /api/auth/login` (sin segundo factor)
      **AC**: AC-5, AC-6, AC-7
      **Depende de**: T-007, T-008
      **RED**: `apps/api/test/auth-login.e2e-spec.ts` — credenciales correctas → `200`,
      `mfaRequired: false`, `session` presente, `mfaToken: null`, cookie de refresh, y el `accessToken`
      verifica con `JWT_ACCESS_SECRET` con `sub`/`sid`/`typ`; contraseña incorrecta y correo inexistente
      → dos `401` con `message` **idéntico** (se compara literal); cinco fallos y luego la contraseña
      **correcta** → `429` con `retryAfterSeconds` y cabecera `Retry-After`; un login correcto antes del
      quinto fallo resetea el contador.
      **GREEN**: `AuthService.login()` con `LoginRequestDto`, `LoginResponseDto` y el flujo de
      `plan.md` §3: bloqueo → búsqueda → `compareWithDecoy` si no hay usuario → sesión.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e auth-login`

- [x] **T-010** · `backend` · `JwtAccessStrategy`, `JwtAuthGuard`, `@CurrentUser()` y `GET /api/auth/me`
      **AC**: AC-8, AC-12
      **Depende de**: T-009
      **RED**: `apps/api/test/auth-me.e2e-spec.ts` — con Bearer válido → `200` con las claves exactas de
      `UserResponseDto` y **sin** `passwordHash` ni `mfaSecret`; sin cabecera → `401`; firma alterada →
      `401`; token expirado → `401`; token de refresh usado como Bearer → `401`; token válido de un
      usuario borrado de la base → `401` (decisión 12 de `plan.md`).
      **GREEN**: `JwtAccessStrategy` (`passport-jwt`, extractor de Bearer), `JwtAuthGuard`, decorador
      `@CurrentUser()` con el tipo `AuthenticatedUser` exportado, y `GET /api/auth/me`.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e auth-me`
      **NOTA**: el guard y el decorador son la interfaz que consumirá la spec `002`: se exportan desde
      el índice público de `AuthModule`.

- [x] **T-011** · `backend` · `POST /api/auth/refresh` y `POST /api/auth/logout`
      **AC**: AC-9, AC-10, AC-11
      **Depende de**: T-006, T-010
      **RED**: `apps/api/test/auth-session.e2e-spec.ts` — refresh con la cookie del login → `200` con
      access token nuevo y cookie nueva de `jti` distinto; reusar la cookie **anterior** → `401`; y tras
      ese reuso, la cookie **nueva** también → `401` (familia revocada, AC-10); logout → `204` sin
      cuerpo, cookie borrada (`Max-Age=0`) y refresh posterior → `401`; logout sin cookie → `204`;
      cuerpo no vacío en refresh → `400`.
      **GREEN**: `AuthService.refresh()` y `logout()` sobre `SessionStore`, lectura de la cookie con
      `cookie-parser`, `@ApiNoContentResponse` en el logout, `enableCors({ origin: WEB_ORIGIN,
      credentials: true })` en `bootstrap.ts` (decisión 13).
      **DONE**: `pnpm --filter @one-markdown/api test:e2e auth-session`

## Bloque D — MFA TOTP

- [x] **T-012** · `backend` · `MfaSecretCipher` (AES-256-GCM)
      **AC**: AC-14
      **Depende de**: T-002
      **RED**: `apps/api/src/auth/mfa/mfa-secret.cipher.spec.ts` — `encrypt(secreto)` devuelve un texto
      que **no** contiene el secreto y que `decrypt` devuelve idéntico; dos cifrados del mismo secreto
      son distintos (IV aleatorio); manipular un byte del texto cifrado hace fallar el descifrado (tag
      GCM); una clave de longitud incorrecta lanza al construir el servicio.
      **GREEN**: `MfaSecretCipher` con `node:crypto` (`aes-256-gcm`), formato `iv.tag.ciphertext` en
      base64url, clave desde `MFA_ENCRYPTION_KEY`.
      **DONE**: `pnpm --filter @one-markdown/api test mfa-secret.cipher`

- [x] **T-013** · `backend` · `TotpService` (otplib 13) y QR
      **AC**: AC-13, AC-17
      **Depende de**: T-001
      **RED**: `apps/api/src/auth/mfa/totp.service.spec.ts` — `generateSecret()` devuelve base32 (solo
      `A–Z2–7`) y distinto en cada llamada; `generateCode(secret, epoch)` con un epoch fijo es
      determinista y `verify(secret, code, epoch)` lo acepta; un código de otro secreto se rechaza; un
      código de hace 90 s se rechaza y uno de hace 25 s se acepta (tolerancia de `plan.md`);
      `buildUri()` empieza por `otpauth://totp/` e incluye el `MFA_ISSUER` y el correo;
      `buildQrDataUrl()` empieza por `data:image/png;base64,`.
      **GREEN**: `TotpService` que envuelve `new OTP({ strategy: 'totp' })` (API **13.x**: `generate` y
      `verify` asíncronos, `verify` → `VerifyResult.valid`, `epochTolerance` en segundos) más `qrcode`
      para el data URL. El `epoch` es parámetro opcional para que los tests no dependan del reloj.
      **DONE**: `pnpm --filter @one-markdown/api test totp.service`
      **NOTA**: no copiar ejemplos de `otplib` 12 (`authenticator.check`, síncrono): riesgo #1.

- [x] **T-014** · `backend` · `POST /api/auth/mfa/setup` y `POST /api/auth/mfa/enable`
      **AC**: AC-13, AC-14, AC-15
      **Depende de**: T-010, T-012, T-013
      **RED**: `apps/api/test/auth-mfa.e2e-spec.ts` — `setup` autenticado → `200` con `secret` base32,
      `otpauthUri` con el issuer y `qrCodeDataUrl`; tras el `setup`, el usuario sigue con
      `mfaEnabled: false` y `mfaSecret` nulo en la base; `enable` con el código correcto del secreto →
      `200` con 8 códigos distintos con formato `XXXX-XXXX`, `mfaEnabled: true`, y `mfaSecret` en base
      **distinto** del base32 en claro pero que descifra a él; `enable` con código inválido → `401` y
      MFA sigue apagado; `enable` sin `setup` previo (o expirado) → `409`; `setup` con MFA ya activo →
      `409`; ambos sin Bearer → `401`.
      **GREEN**: `MfaService` + `MfaController` con `MfaSetupResponseDto`, `MfaEnableRequestDto`,
      `MfaRecoveryCodesResponseDto`; secreto pendiente cifrado en `auth:mfa:setup:{userId}` (TTL 10 min);
      códigos de recuperación generados con `node:crypto`, hasheados con bcrypt y guardados en
      `mfa_recovery_codes`.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e auth-mfa`

- [x] **T-015** · `backend` · Login con segundo factor y `POST /api/auth/mfa/verify`
      **AC**: AC-16, AC-17, AC-18
      **Depende de**: T-014
      **RED**: (a) `apps/api/src/auth/mfa/mfa-challenge.store.spec.ts` — el desafío se guarda con TTL,
      cuenta intentos y al quinto fallo se destruye (un `consume` posterior no lo encuentra).
      (b) `apps/api/test/auth-mfa-login.e2e-spec.ts` — login de un usuario con MFA → `200` con
      `mfaRequired: true`, `session: null`, `mfaToken` no nulo y **sin** `Set-Cookie` de refresh;
      `mfa/verify` con el TOTP correcto → `200` con sesión y cookie; con código incorrecto → `401`;
      tras 5 fallos, el código **correcto** también → `401`; un código de recuperación válido → `200`, y
      el mismo código reutilizado → `401`; `mfaToken` de otro usuario o expirado → `401`.
      **GREEN**: rama MFA en `AuthService.login()`, `MfaChallengeStore` (`plan.md` §6),
      `MfaVerifyRequestDto` y la verificación que acepta TOTP **o** código de recuperación marcándolo
      `usedAt` de forma atómica (`updateMany` con `usedAt: null` en el `where`).
      **DONE**: `pnpm --filter @one-markdown/api test mfa-challenge.store` ·
      `pnpm --filter @one-markdown/api test:e2e auth-mfa-login`

- [x] **T-016** · `backend` · `POST /api/auth/mfa/disable`
      **AC**: AC-19
      **Depende de**: T-015
      **RED**: ampliar `apps/api/test/auth-mfa.e2e-spec.ts` — con contraseña y código correctos → `200`
      con `mfaEnabled: false`, y en la base `mfaSecret` nulo y cero filas en `mfa_recovery_codes` para
      ese usuario; con contraseña incorrecta → `401` y MFA sigue activo; con código incorrecto → `401`;
      con MFA no habilitado → `409`; las otras sesiones del usuario quedan revocadas y la actual sigue
      viva (se comprueba con dos cookies de refresh distintas).
      **GREEN**: `MfaService.disable()` con `MfaDisableRequestDto`, borrado del secreto y de los códigos
      en una transacción, y revocación de la familia salvo el `sid` actual.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e auth-mfa`

## Bloque E — Transversales del backend

- [ ] **T-017** · `backend` · Rate limit por IP con storage en Redis
      **AC**: AC-20
      **Depende de**: T-009
      **RED**: (a) `apps/api/src/auth/redis-throttler.storage.spec.ts` — `increment` devuelve
      `totalHits` creciente y `timeToExpire` > 0, la clave expira sola, y **dos instancias distintas del
      storage sobre el mismo Redis comparten el contador** (esto es lo que el store en memoria no hace).
      (b) `apps/api/test/auth-throttle.e2e-spec.ts` — al superar el límite de `login`, la respuesta es
      `429` con forma `ErrorResponseDto`; `GET /api/health` sigue sin límite (`@SkipThrottle`).
      **GREEN**: `RedisThrottlerStorage implements ThrottlerStorage` sobre `RedisService`;
      `ThrottlerModule.forRoot({ throttlers, storage, getTracker, errorMessage })` con los throttlers
      nombrados de `plan.md` §3 (`register`, `login`, `mfa`, `refresh`), `ThrottlerGuard` como
      `APP_GUARD` y `@Throttle(...)` por ruta. `@SkipThrottle()` en health.
      **DONE**: `pnpm --filter @one-markdown/api test redis-throttler.storage` ·
      `pnpm --filter @one-markdown/api test:e2e auth-throttle`
      **NOTA**: implementar la interfaz del propio `@nestjs/throttler` 6.x (riesgo #2); no añadir
      `@nest-lab/throttler-storage-redis` sin pasar por el orchestrator.

- [ ] **T-018** · `backend` · Swagger de auth (bearer, cookie y DTOs)
      **AC**: AC-21
      **Depende de**: T-016
      **RED**: ampliar `apps/api/test/swagger.e2e-spec.ts` — el documento contiene las nueve rutas
      `/api/auth/*` con sus métodos, el `securityScheme` `bearer` de tipo `http`/`JWT`, los schemas
      `UserResponseDto`, `AuthSessionResponseDto`, `LoginResponseDto`, `MfaSetupResponseDto`,
      `MfaRecoveryCodesResponseDto`; los endpoints protegidos declaran `security` con `bearer`; y
      **ningún** schema del documento se llama como un modelo de Prisma.
      **GREEN**: `addBearerAuth` + `addCookieAuth` en `bootstrap.ts`, `@ApiBearerAuth('bearer')`,
      `@ApiTags('auth')` y las respuestas de error declaradas (`@ApiUnauthorizedResponse`, etc.) con
      `ErrorResponseDto`.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e swagger`

- [x] **T-019** · `backend` · Contrato de auth en `packages/shared`
      **AC**: — (habilita AC-22, AC-23, AC-24)
      **Depende de**: T-011
      **RED**: ampliar `packages/shared/src/index.test.ts` — los guards `isAuthUser`, `isAuthSession`,
      `isLoginResult`, `isMfaSetup` aceptan las formas válidas y rechazan `session` ausente en vez de
      `null`, `mfaRequired` no booleano y `recoveryCodes` que no sean array de strings.
      **GREEN**: tipos `AuthUser`, `AuthSession`, `LoginResult`, `MfaSetup`, `MfaRecoveryCodes` + guards,
      y los DTO del backend declarando `implements` contra ellos (patrón de la spec `000`), para que una
      divergencia rompa el typecheck.
      **DONE**: `pnpm --filter @one-markdown/shared test` · `pnpm typecheck` (los tres paquetes en 0)

## Bloque F — Frontend

- [ ] **T-020** · `frontend` · Cliente HTTP autenticado con refresh y reintento único
      **AC**: AC-24
      **Depende de**: T-019
      **RED**: ampliar `apps/web/src/shared/api/http.test.ts` (con `fetch` mockeado) — una llamada
      autenticada manda `Authorization: Bearer` y `credentials: 'include'`; un `401` dispara **una**
      llamada a `/api/auth/refresh` y **un** reintento (3 fetch en total, no más); si el refresh falla,
      la promesa rechaza con `ApiError` y se notifica la pérdida de sesión una sola vez; dos llamadas
      concurrentes que reciben `401` comparten **un solo** refresh (*single-flight*); un `401` de
      `/api/auth/login` o `/api/auth/refresh` **no** entra en el circuito de reintento.
      **GREEN**: `authorizedRequest()`, el *single-flight* de refresh y las funciones del contrato
      (`register`, `login`, `verifyMfa`, `refresh`, `logout`, `getMe`, `mfaSetup`, `mfaEnable`,
      `mfaDisable`) tipadas con `@one-markdown/shared`. Cero `any`.
      **DONE**: `pnpm --filter @one-markdown/web test http`

- [ ] **T-021** · `frontend` · `useAuthStore` y arranque con refresh silencioso
      **AC**: AC-22, AC-23
      **Depende de**: T-020
      **RED**: `apps/web/src/features/auth/auth.store.test.ts` — el estado arranca en `'unknown'`;
      `bootstrap()` con refresh correcto pasa a `'authenticated'` con usuario y token en memoria; con
      refresh fallido pasa a `'anonymous'`; `login()` con `mfaRequired` deja `pendingMfa` y **no**
      autentica; `verifyMfa()` completa la sesión y limpia `pendingMfa`; `logout()` vuelve a
      `'anonymous'` y borra el token; **nada** queda en `localStorage` ni `sessionStorage` (se
      comprueban ambos vacíos al final de cada caso).
      **GREEN**: `auth.store.ts` según `plan.md` §7, sin middleware de persistencia.
      **DONE**: `pnpm --filter @one-markdown/web test auth.store`

- [ ] **T-022** · `frontend` · `/login`, `/register` y `RequireAuth`
      **AC**: AC-22
      **Depende de**: T-021
      **RED**: `apps/web/src/features/auth/RequireAuth.test.tsx` — con estado anónimo, una ruta
      protegida redirige a `/login` guardando el destino, y al autenticarse aterriza en el destino
      original; con `status: 'unknown'` muestra el estado de carga y **no** redirige;
      `apps/web/src/features/auth/LoginPage.test.tsx` y `RegisterPage.test.tsx` — campos con `<label>`
      asociado y `autoComplete` correcto, un `401` del servidor se muestra en un contenedor
      `role="alert"` que recibe el foco, y el botón queda deshabilitado mientras la petición está en
      vuelo.
      **GREEN**: `LoginPage`, `RegisterPage`, `RequireAuth` y las rutas de `plan.md` §7 (`AppShell`
      envuelto por `RequireAuth`).
      **DONE**: `pnpm --filter @one-markdown/web test RequireAuth LoginPage RegisterPage`

- [ ] **T-023** · `frontend` · Paso de segundo factor en el login
      **AC**: AC-23
      **Depende de**: T-022
      **RED**: ampliar `apps/web/src/features/auth/LoginPage.test.tsx` — cuando el login responde
      `mfaRequired: true`, aparece el campo de código con `autocomplete="one-time-code"` y
      `inputMode="numeric"`, el campo de contraseña desaparece, un código incorrecto muestra el error en
      el `role="alert"` sin perder el `mfaToken`, y el correcto navega a la ruta destino; el
      `accessToken` no aparece en ningún storage del navegador.
      **GREEN**: `MfaChallengeForm` y su integración en `LoginPage`.
      **DONE**: `pnpm --filter @one-markdown/web test LoginPage`

- [ ] **T-024** · `frontend` · `/settings/security`: alta y baja de MFA
      **AC**: AC-13, AC-14, AC-19 (desde la UI)
      **Depende de**: T-014, T-016, T-022
      **RED**: `apps/web/src/features/auth/SecurityPage.test.tsx` — sin MFA, el botón de activar llama a
      `setup` y muestra el QR (con `alt` descriptivo) **y** el secreto en texto copiable; al confirmar
      con un código se listan los 8 códigos de recuperación con un aviso de que solo se ven una vez; un
      código inválido muestra el error y no cambia el estado; con MFA activo, la baja pide contraseña y
      código y al confirmar la vista vuelve al estado "sin MFA".
      **GREEN**: `SecurityPage` y su ruta protegida.
      **DONE**: `pnpm --filter @one-markdown/web test SecurityPage`

- [ ] **T-025** · `frontend` · e2e del flujo de auth en navegador
      **AC**: AC-25
      **Depende de**: T-011, T-022
      **RED**: `apps/web/e2e/auth.spec.ts` — registra un usuario con correo único, comprueba que la ruta
      protegida se ve, cierra sesión, vuelve a entrar con las mismas credenciales, recarga la página
      (el refresh silencioso mantiene la sesión) y verifica **cero errores de consola**. Debe fallar
      antes de que exista la UI.
      **GREEN**: segundo `webServer` en `playwright.config.ts` que levanta el API (además del dev server
      de la web), con las variables de entorno de test; el smoke existente sigue pasando.
      **DONE**: `pnpm test:e2e`

## Bloque G — CI

- [ ] **T-026** · `backend` · CI con migraciones y entorno de auth
      **AC**: — (cierra la brecha operativa de AC-1…AC-25 en CI)
      **Depende de**: T-003, T-025
      **QUÉ**: en `.github/workflows/ci.yml`, añadir `prisma migrate deploy` antes de los tests y las
      variables de auth (`JWT_*`, `MFA_ENCRYPTION_KEY`, `BCRYPT_ROUNDS=4`) a los jobs que corren
      `test` y `test:e2e`. Verificar que `bcrypt` compila en Node 22 **y** 24 (riesgo #3).
      **DONE**: run del workflow en verde en un push de rama (se reporta el enlace del run) ·
      verificación negativa: un commit con un test de auth roto deja el job en rojo
      **NOTA**: comparte el bloqueo de la tarea `T-015` de la spec `000` (hace falta `git push`).

## Definition of Done (todas las tareas)

1. El test se escribió primero y falló primero (reportado por el agente con la salida real del fallo).
   Las tareas `setup` no aplican esta regla pero sí el comando `DONE` con salida real.
2. Cada AC de la spec tiene al menos un test automatizado (ver tabla de trazabilidad en `spec.md` §6).
3. Backend: entrada y salida con DTO validado y documentado en Swagger; sin entidades Prisma crudas;
   sin `any`. Ningún endpoint devuelve `passwordHash` ni `mfaSecret`.
4. Autorización por recurso: todo endpoint autenticado resuelve el usuario desde el token, nunca desde
   un parámetro del cliente.
5. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan.
6. `IMPLEMENTATION.md` actualizado por el orchestrator con el comando de verificación y su resultado.
