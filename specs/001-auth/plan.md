# Plan 001 — Auth: registro, login, JWT access+refresh, bcrypt, MFA TOTP, Redis, rate limit

Spec de referencia: `spec.md` v0.1.0

## 1. Versiones fijadas del stack (nuevas dependencias)

Resueltas contra el registro npm el **2026-07-24**. Los agentes de implementación **no eligen
versiones**: usan estas. Cualquier cambio pasa por el orchestrator y deja entrada en el `CHANGELOG.md`.

| Ámbito | Paquete | Versión | Nota |
|---|---|---|---|
| API | `@nestjs/jwt` | `11.0.2` | firma y verificación de los dos tipos de token |
| API | `@nestjs/passport` + `passport` | `11.0.5` / `0.7.0` | Passport es requisito del proyecto (`CLAUDE.md`) |
| API | `passport-jwt` + `@types/passport-jwt` | `4.0.1` / `4.0.1` | estrategia del access token (Bearer) |
| API | `bcrypt` + `@types/bcrypt` | `6.0.0` / `6.0.0` | módulo nativo: ver riesgo #3 de la spec |
| API | `otplib` | `13.4.1` | **API 13.x**: `new OTP({ strategy: 'totp' })`, `generate`/`verify` async, `verify` → `VerifyResult`, `generateURI` |
| API | `qrcode` + `@types/qrcode` | `1.5.4` / `1.5.6` | data URL PNG del `otpauth://` para el enrolamiento |
| API | `@nestjs/throttler` | `6.5.0` | `forRoot({ throttlers, storage, getTracker, errorMessage })`, `@Throttle({ nombre: { limit, ttl } })`, `@SkipThrottle()`, helper `seconds()` |
| API | `cookie-parser` + `@types/cookie-parser` | `1.4.7` / `1.4.10` | leer la cookie de refresh en el controlador |

**No se añade** `passport-local` (ver decisión 3) ni `@nest-lab/throttler-storage-redis` (riesgo #2:
el storage se implementa en el proyecto sobre el `RedisService` que ya existe).

## 2. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|----------|--------------------------|--------|
| 1 | **Access token JWT de 15 min en memoria del cliente**; **refresh token JWT de 7 días en cookie `HttpOnly`** (`om_refresh`, `SameSite=Strict`, `Path=/api/auth`, `Secure` en producción) | Token de acceso en `localStorage`; sesión de servidor con cookie de sesión clásica | El token corto en memoria no es legible por XSS y el refresh en cookie `HttpOnly` tampoco; el mismo origen en dev (proxy de Vite, decisión 3 de la spec `000`) hace que la cookie funcione igual en dev y en producción |
| 2 | **Refresh con rotación y detección de reutilización**: cada refresh emite un `jti` nuevo; presentar un `jti` ya rotado revoca **toda** la familia de sesiones del usuario | Refresh de un solo uso sin rotación; refresh de larga vida sin control | Un refresh robado sirve una sola vez, y su uso delata el robo: la víctima pierde la sesión (señal visible) en vez de compartirla en silencio con el atacante |
| 3 | **Passport solo para el access token** (`passport-jwt` → `JwtAccessStrategy` + `JwtAuthGuard`). El login valida credenciales en `AuthService`, no en una `LocalStrategy` | `passport-local` para el login | La regla dura del proyecto es que toda entrada pasa por un DTO validado con class-validator; `LocalStrategy` recibe `username`/`password` del request antes del pipe y obligaría a duplicar la validación. Passport sigue presente donde aporta: proteger rutas |
| 4 | **Sesiones en Redis, no en PostgreSQL**: `auth:session:{userId}:{sid}` guarda el `jti` vigente con TTL igual al del refresh, y `auth:sessions:{userId}` es el índice (SET de `sid`) para revocar la familia sin `SCAN` | Tabla `Session` en Postgres; `SCAN` por patrón | El refresh escribe en cada rotación: en Redis es O(1) y expira solo. `SCAN` en un Redis compartido es una operación cara y no atómica. Consecuencia asumida: riesgo #10 de la spec |
| 5 | **Un solo endpoint de login con respuesta discriminada** (`LoginResponseDto` con `mfaRequired`, `session \| null`, `mfaToken \| null`) y un segundo paso en `POST /api/auth/mfa/verify` con un `mfaToken` de 5 min | Devolver `403` con "MFA requerido"; emitir el access token y exigir MFA en cada petición | Un `200` con dato explícito es más fácil de tipar y de testear que un error de control de flujo. El `mfaToken` acredita "la contraseña ya fue correcta" sin ser una sesión: su claim `typ` es `'mfa'` y no lo acepta el guard de acceso |
| 6 | **Secreto TOTP cifrado con AES-256-GCM** (`MFA_ENCRYPTION_KEY`) y persistido **solo al confirmar**; el secreto pendiente vive en Redis con TTL de 10 min | Guardarlo en claro; guardarlo en la fila desde el `setup` | Riesgo #6 de la spec: un dump de la base no debe bastar para generar códigos. Y no persistir enrolamientos a medio hacer evita filas con `mfaSecret` que nadie confirmó nunca |
| 7 | **8 códigos de recuperación de uso único**, hasheados con bcrypt en `mfa_recovery_codes`, mostrados una única vez en el `enable` | Sin códigos de recuperación; guardarlos en claro | Sin ellos, perder el teléfono es perder la cuenta (no hay correo para recuperación, está fuera de alcance). Hasheados porque son credenciales equivalentes a un segundo factor |
| 8 | **Dos capas de límite**: `ThrottlerGuard` global por IP (ventanas cortas, storage propio en Redis) **más** un `LoginAttemptService` de bloqueo por cuenta (5 fallos → 15 min, clave `sha256(email)`) | Solo throttler; solo bloqueo por cuenta | Son ataques distintos: muchas contraseñas contra una cuenta (lo para el bloqueo por cuenta) y muchas cuentas desde una IP (lo para el throttler). El correo se hashea para no dejar direcciones en claro en Redis |
| 9 | **Respuesta uniforme en el login** (`401` con el mismo mensaje para usuario inexistente y contraseña incorrecta) y comparación bcrypt contra un hash señuelo cuando el usuario no existe | `404` para usuario inexistente; cortocircuitar sin comparar | AC-6. Y sin el señuelo, la diferencia de tiempo de respuesta (bcrypt vs. nada) reintroduce la enumeración por un canal lateral |
| 10 | **`null` explícito, nunca ausencia de propiedad**, en todo lo opcional del contrato (`displayName`, `session`, `mfaToken`) | Campos opcionales (`?`) en los DTO de respuesta | `exactOptionalPropertyTypes` está activo (riesgo #11): un `null` explícito se tipa y se serializa igual en los dos lados; una propiedad ausente obliga a ramas distintas en cada consumidor |
| 11 | **Módulo `AuthModule` autocontenido** con submódulo de MFA en `src/auth/mfa/`; el guard, el decorador `@CurrentUser()` y el tipo `AuthenticatedUser` se exportan para las specs siguientes | Repartir auth entre `common/` y `users/` | La spec `002` solo necesita importar `JwtAuthGuard` y `@CurrentUser()`. Un `UsersModule` separado se extrae cuando exista gestión de perfil, no ahora |
| 12 | **El `userId` del token es la única fuente de propiedad**; el guard resuelve el usuario desde la base en cada petición y rechaza tokens de usuarios borrados | Confiar solo en los claims del token | El claim es suficiente para autenticar, pero la `002` filtrará documentos por `userId`: un token válido de un usuario ya inexistente no debe pasar el guard. Coste: una consulta por petición autenticada (aceptable a esta escala; si estorba, se cachea en Redis) |
| 13 | **CORS con credenciales** activado contra `WEB_ORIGIN` en el bootstrap | Dejar el bootstrap sin CORS (estado actual) | En dev el proxy de Vite hace mismo origen, pero en cualquier despliegue con dominios distintos la cookie de refresh no viajaría sin `credentials: true` y origen explícito |
| 14 | **Estado de auth en el frontend en un store Zustand con el token solo en memoria** y arranque que intenta un refresh silencioso (*single-flight*) | Persistir el token; `Context` + `useReducer` | Riesgo #9 de la spec: se paga una petición al cargar y se evita que un XSS lea la sesión. Zustand ya es el estado del proyecto |

## 3. Contrato de API

Prefijo global `/api`. **Toda entrada y toda salida tiene DTO**; los `204` se documentan con
`@ApiNoContentResponse` y no llevan cuerpo. Todos los errores salen como `ErrorResponseDto`
(filtro global de la spec `000`).

DTOs de respuesta compartidos:

- `UserResponseDto` — `id: string` (uuid) · `email: string` · `displayName: string | null` ·
  `mfaEnabled: boolean` · `createdAt: string` (ISO-8601)
- `AuthSessionResponseDto` — `accessToken: string` · `tokenType: 'Bearer'` ·
  `expiresInSeconds: number` · `user: UserResponseDto`

### `POST /api/auth/register`

- **Auth**: pública · **Throttle**: `register` — 5 por 15 min por IP
- **Request DTO**: `RegisterRequestDto`
  - `email: string` — `@IsEmail`, `@MaxLength(254)`, `@Transform` a minúsculas y sin espacios
  - `password: string` — `@MinLength(12)`, `@MaxLength(128)`, `@Matches(/[A-Za-z]/)` y `@Matches(/\d/)`
  - `displayName?: string` — `@IsOptional`, `@Length(1, 80)`
- **Response DTO**: `AuthSessionResponseDto` (`201`) + `Set-Cookie: om_refresh=…`
- **Errores**: `400` validación · `409` correo ya registrado · `429` límite por IP

### `POST /api/auth/login`

- **Auth**: pública · **Throttle**: `login` — 10 por minuto por IP (además del bloqueo por cuenta)
- **Request DTO**: `LoginRequestDto` — `email: string` (`@IsEmail`, normalizado igual que en el registro) ·
  `password: string` (`@IsString`, `@MaxLength(128)`)
- **Response DTO**: `LoginResponseDto` (`200`)
  - `mfaRequired: boolean`
  - `session: AuthSessionResponseDto | null` — presente solo si `mfaRequired` es `false`
  - `mfaToken: string | null` · `mfaTokenExpiresInSeconds: number | null` — presentes solo si `mfaRequired` es `true`
  - Cookie de refresh **solo** cuando `mfaRequired` es `false`
- **Errores**: `400` validación · `401` `Credenciales inválidas` (mensaje único e idéntico para correo
  inexistente y contraseña incorrecta) · `429` cuenta bloqueada (cuerpo con `retryAfterSeconds`,
  cabecera `Retry-After`) o límite por IP

### `POST /api/auth/mfa/verify`

- **Auth**: pública (la credencial es el `mfaToken`) · **Throttle**: `mfa` — 10 por minuto por IP
- **Request DTO**: `MfaVerifyRequestDto`
  - `mfaToken: string` — `@IsJWT`
  - `code: string` — `@Matches(/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$/)`: TOTP de 6 dígitos **o** código de recuperación
- **Response DTO**: `AuthSessionResponseDto` (`200`) + cookie de refresh
- **Errores**: `400` validación · `401` `mfaToken` inválido/expirado/agotado, código incorrecto o código
  de recuperación ya usado (mensaje único) · `429` límite por IP
- **Comportamiento**: 5 intentos por `mfaToken`; al sexto el desafío se destruye y hay que volver al login

### `POST /api/auth/refresh`

- **Auth**: cookie `om_refresh` · **Throttle**: `refresh` — 60 por minuto por IP
- **Request DTO**: — (sin cuerpo; la credencial viaja en la cookie. Un cuerpo cualquiera se rechaza con
  `400` por `forbidNonWhitelisted`)
- **Response DTO**: `AuthSessionResponseDto` (`200`) + cookie de refresh **nueva** (rotación)
- **Errores**: `401` sin cookie, firma inválida, expirado, sesión revocada o **reutilización detectada**
  (que además revoca la familia completa) · `429` límite por IP

### `POST /api/auth/logout`

- **Auth**: cookie `om_refresh` (opcional: sin ella también responde `204`)
- **Request DTO**: — · **Response**: `204` sin cuerpo, con la cookie borrada (`Max-Age=0`)
- **Errores**: ninguno; es idempotente por diseño (un logout que falla deja al usuario sin saber qué hacer)

### `GET /api/auth/me`

- **Auth**: `Authorization: Bearer <accessToken>` · **Rol/propiedad**: el propio usuario del token
- **Request DTO**: — · **Response DTO**: `UserResponseDto` (`200`)
- **Errores**: `401` sin token, token expirado, firma inválida, `typ` distinto de `'access'` o usuario inexistente

### `POST /api/auth/mfa/setup`

- **Auth**: Bearer · **Throttle**: `mfa`
- **Request DTO**: — · **Response DTO**: `MfaSetupResponseDto` (`200`)
  - `secret: string` (base32) · `otpauthUri: string` · `qrCodeDataUrl: string` (`data:image/png;base64,…`) ·
    `expiresInSeconds: number`
- **Errores**: `401` · `409` MFA ya habilitado
- **Comportamiento**: guarda el secreto **cifrado** en `auth:mfa:setup:{userId}` (TTL 10 min); no toca la base

### `POST /api/auth/mfa/enable`

- **Auth**: Bearer · **Throttle**: `mfa`
- **Request DTO**: `MfaEnableRequestDto` — `code: string` (`@Matches(/^\d{6}$/)`)
- **Response DTO**: `MfaRecoveryCodesResponseDto` (`200`) — `recoveryCodes: string[]` (8, formato
  `XXXX-XXXX`, mostrados una única vez) · `generatedAt: string` (ISO-8601)
- **Errores**: `400` · `401` código incorrecto · `409` MFA ya habilitado o sin setup pendiente (expiró)

### `POST /api/auth/mfa/disable`

- **Auth**: Bearer · **Throttle**: `mfa`
- **Request DTO**: `MfaDisableRequestDto` — `password: string` · `code: string`
  (`@Matches(/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$/)`)
- **Response DTO**: `UserResponseDto` (`200`) con `mfaEnabled: false`
- **Errores**: `400` · `401` contraseña o código incorrectos · `409` MFA no habilitado
- **Comportamiento**: borra `mfaSecret` y todos los códigos de recuperación, y **revoca la familia de
  sesiones** salvo la actual (bajar el segundo factor es un cambio de postura de seguridad)

### Seguridad declarada en Swagger

`DocumentBuilder().addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')` y
`addCookieAuth('om_refresh', …)`; los endpoints protegidos llevan `@ApiBearerAuth('bearer')`.

## 4. Configuración y entorno

Se amplía `apps/api/src/config/env.validation.ts` (spec `000` §4) con:

| Variable | Requerida | Tipo / regla | Uso |
|---|---|---|---|
| `JWT_ACCESS_TTL` | no (default `900`) | entero 60–3600, segundos | vida del access token |
| `JWT_REFRESH_TTL` | no (default `604800`) | entero 3600–2592000, segundos | vida del refresh y TTL de la sesión en Redis |
| `BCRYPT_ROUNDS` | no (default `12`) | entero 4–15 | coste de bcrypt; **4 en tests** (riesgo #4) |
| `MFA_ENCRYPTION_KEY` | **sí** | base64 que decodifica a exactamente 32 bytes | clave AES-256-GCM del secreto TOTP |
| `MFA_ISSUER` | no (default `One Markdown`) | string 1–64 | issuer que ve el usuario en su app de autenticación |

`JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` ya existen y ya se validan (≥32 caracteres y distintos entre sí).

`.env.example` debe sumar estas claves. **Perder `MFA_ENCRYPTION_KEY` inutiliza los secretos TOTP
guardados**: los usuarios con MFA tendrían que re-enrolarse (y entrar con un código de recuperación).
Generación de ejemplo: `openssl rand -base64 32`.

## 5. Esquema / migración Prisma

Primera migración con modelos de negocio del proyecto (la spec `000` dejó Prisma conectado y sin modelos).

```prisma
model User {
  id            String            @id @default(uuid()) @db.Uuid
  email         String            @unique
  passwordHash  String
  displayName   String?
  mfaEnabled    Boolean           @default(false)
  /// Base32 del secreto TOTP cifrado con AES-256-GCM: `iv.tag.ciphertext` en base64url.
  mfaSecret     String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  recoveryCodes MfaRecoveryCode[]

  @@map("users")
}

model MfaRecoveryCode {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @db.Uuid
  /// bcrypt del código; el código en claro solo existe en la respuesta del `enable`.
  codeHash  String
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("mfa_recovery_codes")
}
```

- **Unicidad del correo**: índice único sobre `email` y normalización a minúsculas en el DTO de entrada.
  No se usa `citext` para no depender de una extensión de PostgreSQL; la normalización en el borde es
  suficiente porque **ninguna** escritura de correo entra por otra vía.
- **Nombre de la migración**: `20260724_auth_user_mfa`.
- `onDelete: Cascade` en los códigos de recuperación: borrar un usuario no debe dejar credenciales huérfanas.
- La spec `002` colgará `Directory` y `Document` de `User` con `userId` como FK; este modelo es el ancla.

## 6. Claves de Redis

Todas con prefijo `auth:` para poder limpiarlas por patrón en los tests sin tocar nada más
(**nunca `FLUSHALL`**, riesgo #5).

| Clave | Tipo | TTL | Contenido |
|---|---|---|---|
| `auth:session:{userId}:{sid}` | string (JSON) | `JWT_REFRESH_TTL` | `{ jti, createdAt, rotatedAt }` — `jti` vigente de esa sesión |
| `auth:sessions:{userId}` | set | `JWT_REFRESH_TTL` (se refresca) | índice de `sid` del usuario, para revocar la familia |
| `auth:login:fail:{sha256(email)}` | string (contador) | 15 min | intentos fallidos consecutivos |
| `auth:login:lock:{sha256(email)}` | string | 15 min | marca de cuenta bloqueada |
| `auth:mfa:setup:{userId}` | string | 10 min | secreto TOTP **cifrado**, enrolamiento sin confirmar |
| `auth:mfa:challenge:{jti}` | string (JSON) | 5 min | `{ userId, attempts }` del desafío de segundo factor |
| `throttle:{…}` | string | ventana del throttler | contadores del `RedisThrottlerStorage` |

## 7. Frontend

- **Rutas** (se amplía `apps/web/src/app/routes.tsx`):
  - `/login` y `/register` — públicas, fuera del `AppShell` (layout propio y centrado).
  - `/` — protegida: `RequireAuth` envuelve el `AppShell` actual.
  - `/settings/security` — protegida: enrolamiento y baja de MFA.
- **Store Zustand** `src/features/auth/auth.store.ts`:
  - Estado: `status: 'unknown' | 'authenticating' | 'authenticated' | 'anonymous'` ·
    `user: AuthUser | null` · `accessToken: string | null` (**solo en memoria, nada persiste**) ·
    `pendingMfa: { mfaToken: string } | null` · `error: string | null`.
  - Acciones: `bootstrap()` (refresh silencioso al arrancar), `register()`, `login()`, `verifyMfa()`,
    `logout()`, `refresh()` (*single-flight*: llamadas concurrentes comparten la misma promesa).
- **Cliente HTTP** (`src/shared/api/http.ts`, se amplía el de la spec `000`):
  - `credentials: 'include'` en todo, para que la cookie de refresh viaje.
  - `authorizedRequest()` añade `Authorization: Bearer` desde el store.
  - Ante `401`: un único refresh y **un solo** reintento; si el refresh falla, `logout()` local y
    redirección a `/login` (AC-24). El `401` de `/auth/login` y `/auth/refresh` **no** entra en ese
    circuito: sería un bucle.
- **Componentes**: `LoginPage` (formulario + paso MFA condicional) · `RegisterPage` ·
  `MfaChallengeForm` · `RequireAuth` (redirección con `state.from` y estado de carga mientras
  `status === 'unknown'`) · `SecurityPage` (QR del `otpauthUri`, alta con código, lista de códigos de
  recuperación mostrada una vez, baja con contraseña + código).
- **Tipos compartidos**: `AuthUser`, `AuthSession`, `LoginResult`, `MfaSetup`, `MfaRecoveryCodes` y sus
  type guards desde `@one-markdown/shared` (`T-019`).
- **Accesibilidad**: `<label>` asociado a cada campo; errores de servidor en un contenedor
  `role="alert"` que recibe el foco; `aria-invalid` en los campos rechazados; `autoComplete` correcto
  (`email`, `current-password`, `new-password`, `one-time-code`); un único `<h1>` por vista; el QR con
  `alt` descriptivo y el secreto también en texto seleccionable (quien no pueda escanear debe poder
  copiarlo).

## 8. Estrategia de tests

| Nivel | Qué cubre | Dónde |
|-------|-----------|-------|
| unit (api) | hash y comparación bcrypt con señuelo (AC-4) · firma/verificación y tokens cruzados (AC-5, AC-12) · rotación, reutilización y revocación de familia (AC-9, AC-10) · bloqueo por cuenta (AC-7) · cifrado AES-GCM del secreto (AC-14) · TOTP con epoch inyectado (AC-13, AC-17) · storage del throttler (AC-20) · env ampliado (AC-26) | `apps/api/src/**/*.spec.ts` |
| e2e (api) | registro (AC-1…AC-3) · login y uniformidad de errores (AC-5…AC-7) · `me` (AC-8, AC-12) · refresh/logout (AC-9…AC-11) · MFA setup/enable/disable (AC-13…AC-15, AC-19) · login con MFA y recuperación (AC-16…AC-18) · límite por IP (AC-20) · OpenAPI (AC-21) | `apps/api/test/*.e2e-spec.ts` |
| unit (shared) | los tipos y guards de auth compilan y validan en ambos lados | `packages/shared/src/**/*.test.ts` |
| unit/componente (web) | reintento único tras `401` (AC-24) · redirección de ruta protegida (AC-22) · paso MFA y ausencia de token en storage (AC-23) · alta/baja de MFA desde la UI | `apps/web/src/**/*.test.tsx` |
| e2e (web) | registro → logout → login → ruta protegida (AC-25) | `apps/web/e2e/auth.spec.ts` |

Convenciones de los e2e de auth (para no arrastrar flakiness):

- **Correos únicos por caso** (`auth-${contador}-${sufijo}@example.test`) en vez de limpiar la tabla:
  varios archivos e2e corren contra la misma base.
- **Limpieza de Redis por prefijo** con `SCAN` sobre `auth:*` del propio caso; nunca `FLUSHALL`.
- **Cookies**: `supertest.agent(app.getHttpServer())` mantiene la cookie entre peticiones; para los
  casos de reutilización se guarda la cabecera `Set-Cookie` a mano y se reenvía la vieja.
- **TOTP**: el `TotpService` acepta un `epoch` explícito, así que los e2e generan el código válido
  para el instante actual sin `sleep` ni relojes falsos.
- **`BCRYPT_ROUNDS=4`** en `test/setup-env.ts`, y `MFA_ENCRYPTION_KEY` de test fija en el mismo archivo.
- Los e2e que necesitan PostgreSQL/Redis siguen el patrón de la spec `000`: si faltan las variables de
  infraestructura, se **reporta el salto**, no se oculta.

## 9. Orden de ejecución

Dependencias y env (`T-001`, `T-002`) → esquema y migración (`T-003`) → primitivas testeables en
aislamiento (`T-004` contraseñas, `T-005` tokens, `T-006` sesiones, `T-007` bloqueo) → endpoints de
sesión (`T-008` registro, `T-009` login, `T-010` guard + `me`, `T-011` refresh/logout) → MFA (`T-012`
cifrado, `T-013` TOTP, `T-014` alta, `T-015` login con segundo factor, `T-016` baja) → transversales
(`T-017` throttler, `T-018` Swagger) → contrato compartido (`T-019`) → frontend (`T-020`…`T-024`) →
e2e de navegador (`T-025`) → CI (`T-026`).

Paralelizable: `T-019` (contrato en `packages/shared`) puede escribirse en cuanto `T-011` cierra los DTO
de sesión; desde ahí el `frontend` avanza en paralelo con el bloque de MFA del `backend`, porque el
contrato ya está fijado por escrito. `T-024` (UI de MFA) sí espera a que `T-014` y `T-016` estén verdes.
