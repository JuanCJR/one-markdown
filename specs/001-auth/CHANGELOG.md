# Changelog — Spec 001 Auth

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.1.0 — 2026-07-24

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
