# Changelog — Spec 001 Auth

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.1.0 — 2026-07-24

Hallazgos del Bloque A (T-001…T-003), sin cambio de alcance ni de criterios:

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
