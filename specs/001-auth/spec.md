# Spec 001 — Auth: registro, login, JWT access+refresh, bcrypt, MFA TOTP, Redis, rate limit

- **Versión**: 0.1.0
- **Estado**: approved — aprobada por el usuario el 2026-07-24; la implementación es la Fase 3 de `IMPLEMENTATION.md`
- **Fecha**: 2026-07-24
- **Depende de**: `000-foundation` (implemented)

## 1. Contexto y problema

La aplicación existe hoy como esqueleto verificable: el API arranca con configuración validada, expone
`/api/health`, valida toda entrada con DTO y documenta su contrato en Swagger; la web renderiza su shell
con enrutado. No hay usuarios. Nadie puede identificarse y, por lo tanto, **nada puede pertenecer a
nadie**.

Eso bloquea el resto del producto: la regla dura del proyecto es que todo acceso a documentos y
directorios se filtra por el `userId` del token (`CLAUDE.md`). La spec `002-workspace-tree` no puede
escribir un solo endpoint sin saber de dónde sale ese `userId`, cómo se prueba una petición autenticada
en un e2e, ni qué forma tiene el usuario que viaja al frontend.

El problema a resolver aquí es la **identidad y la sesión**: que una persona pueda registrarse, iniciar
sesión con una contraseña que nunca se guarda en claro, mantener la sesión sin volver a escribirla,
cerrarla, y — si lo decide — proteger su cuenta con un segundo factor TOTP. Y que todo eso resista los
ataques baratos y automáticos que recibe cualquier endpoint de login expuesto: fuerza bruta de
contraseñas, enumeración de cuentas, robo y reutilización de tokens de refresco.

El backend es dueño del auth (decisión ya tomada: Auth.js está fuera de alcance). El frontend consume el
contrato, no lo define.

## 2. Historias de usuario

- **US-1** — Como visitante, quiero crear una cuenta con correo y contraseña y quedar dentro de la
  aplicación, para empezar a escribir sin un paso extra de activación.
- **US-2** — Como usuario registrado, quiero iniciar sesión y seguir dentro al recargar la página o al
  volver más tarde, sin tener que reescribir la contraseña en cada visita.
- **US-3** — Como usuario, quiero cerrar sesión y que el dispositivo deje de tener acceso, para poder
  usar un equipo compartido.
- **US-4** — Como usuario preocupado por su cuenta, quiero activar un segundo factor con mi app de
  autenticación (Google Authenticator, 1Password, Aegis) y recibir códigos de recuperación, para no
  perder el acceso si pierdo el teléfono.
- **US-5** — Como usuario, quiero que quien intente adivinar mi contraseña se topé con un bloqueo
  temporal, para que un ataque automático no tenga intentos infinitos.
- **US-6** — Como usuario, quiero que un correo mal escrito en el login no revele si esa cuenta existe,
  para no filtrar mi dirección a quien pruebe direcciones al azar.
- **US-7** — Como desarrollador de la spec `002`, quiero un guard y un decorador que me den el `userId`
  autenticado en cualquier controlador, y una forma sencilla de autenticar peticiones en los e2e, para
  implementar autorización por recurso sin reinventar el mecanismo.
- **US-8** — Como operador, quiero poder invalidar la sesión de un usuario (por rotación de tokens,
  reutilización detectada o desactivación de MFA) sin esperar a que expire el token de acceso.

## 3. Criterios de aceptación

Todo AC debe ser verificable por un test automatizado.

### Registro y contraseñas

- **AC-1** — Dado un correo no registrado, cuando se hace `POST /api/auth/register` con correo y
  contraseña válidos, entonces responde `201` con `AuthSessionResponseDto` (`accessToken`, `tokenType`
  `"Bearer"`, `expiresInSeconds`, `user`), **sin** propiedades adicionales, y con una cabecera
  `Set-Cookie` para el refresh que incluye `HttpOnly`, `SameSite=Strict` y `Path=/api/auth`.

- **AC-2** — Dado un correo ya registrado (en cualquier combinación de mayúsculas), cuando se hace
  `POST /api/auth/register` con ese correo, entonces responde `409` con `ErrorResponseDto` y la tabla
  `users` sigue teniendo exactamente una fila para ese correo.

- **AC-3** — Dado un cuerpo con correo inválido, contraseña de menos de 12 caracteres, contraseña sin
  dígito o una propiedad no declarada, cuando se hace `POST /api/auth/register`, entonces responde `400`
  con `ErrorResponseDto` cuyo `message` nombra el campo rechazado, y no se crea ningún usuario.

- **AC-4** — Dado un usuario recién registrado, cuando se lee su fila en la base, entonces
  `passwordHash` es un hash bcrypt (prefijo `$2b$`), es distinto de la contraseña enviada, y
  `bcrypt.compare(contraseña, passwordHash)` devuelve `true`.

### Login, sesión y tokens

- **AC-5** — Dado un usuario sin MFA, cuando se hace `POST /api/auth/login` con credenciales correctas,
  entonces responde `200` con `LoginResponseDto` donde `mfaRequired` es `false` y `session` es un
  `AuthSessionResponseDto`; el `accessToken` verifica con `JWT_ACCESS_SECRET` y su payload contiene
  `sub` (id del usuario), `sid` (id de sesión) y `typ: 'access'`.

- **AC-6** — Dado un correo inexistente y dado un usuario con contraseña incorrecta, cuando se hace
  `POST /api/auth/login` en ambos casos, entonces las dos respuestas son `401` con **exactamente el
  mismo** `message`, y ninguna revela si la cuenta existe.

- **AC-7** — Dado un usuario que acumula 5 intentos fallidos consecutivos de contraseña, cuando se
  intenta un sexto login **incluso con la contraseña correcta**, entonces responde `429` con
  `retryAfterSeconds` en el cuerpo y cabecera `Retry-After`; y dado que antes del quinto fallo hay un
  login correcto, entonces el contador vuelve a cero y el login siguiente no está bloqueado.

- **AC-8** — Dado un `accessToken` válido, cuando se hace `GET /api/auth/me` con
  `Authorization: Bearer <token>`, entonces responde `200` con `UserResponseDto` (`id`, `email`,
  `displayName`, `mfaEnabled`, `createdAt`) y el cuerpo **no** contiene `passwordHash` ni `mfaSecret`;
  y sin cabecera, con token expirado o con firma alterada, responde `401` con `ErrorResponseDto`.

- **AC-9** — Dada una cookie de refresh válida, cuando se hace `POST /api/auth/refresh`, entonces
  responde `200` con un `accessToken` nuevo y una cookie de refresh nueva cuyo `jti` es distinto del
  anterior; y un segundo `POST /api/auth/refresh` con la cookie **anterior** responde `401`.

- **AC-10** — Dado un refresh ya rotado que se vuelve a presentar (reutilización), cuando se hace
  `POST /api/auth/refresh` con él, entonces responde `401` y **toda** la familia de sesiones de ese
  usuario queda revocada: un `POST /api/auth/refresh` con la cookie más reciente también responde `401`.

- **AC-11** — Dada una sesión activa, cuando se hace `POST /api/auth/logout`, entonces responde `204`
  sin cuerpo, la respuesta borra la cookie de refresh y un `POST /api/auth/refresh` posterior con esa
  cookie responde `401`; y sin cookie alguna, `POST /api/auth/logout` también responde `204`
  (idempotente).

- **AC-12** — Dado un token firmado con `JWT_REFRESH_SECRET` o cuyo claim `typ` no es `'access'`,
  cuando se envía como `Bearer` a `GET /api/auth/me`, entonces responde `401`: los tokens de refresco no
  sirven como tokens de acceso ni al revés.

### MFA TOTP

- **AC-13** — Dado un usuario autenticado sin MFA, cuando se hace `POST /api/auth/mfa/setup`, entonces
  responde `200` con `MfaSetupResponseDto`: `secret` en base32, `otpauthUri` que empieza por
  `otpauth://totp/` e incluye el issuer configurado, y `qrCodeDataUrl` que empieza por
  `data:image/png;base64,`; mientras no se confirme, el usuario sigue con `mfaEnabled: false` y la
  columna `mfaSecret` sigue nula (el secreto pendiente vive solo en Redis, con TTL).

- **AC-14** — Dado un setup pendiente, cuando se hace `POST /api/auth/mfa/enable` con un código TOTP
  válido para ese secreto, entonces responde `200` con 8 códigos de recuperación distintos,
  `mfaEnabled` pasa a `true`, y el valor de `mfaSecret` en la base **no** es el base32 en claro pero
  descifra exactamente a él.

- **AC-15** — Dado un setup pendiente, cuando se hace `POST /api/auth/mfa/enable` con un código
  incorrecto, entonces responde `401` y el usuario sigue con `mfaEnabled: false`.

- **AC-16** — Dado un usuario con MFA activo, cuando se hace `POST /api/auth/login` con credenciales
  correctas, entonces responde `200` con `mfaRequired: true`, `session: null`, un `mfaToken` de vida
  corta, y la respuesta **no** incluye cookie de refresh.

- **AC-17** — Dado un `mfaToken` vigente, cuando se hace `POST /api/auth/mfa/verify` con el código TOTP
  correcto, entonces responde `200` con `AuthSessionResponseDto` y cookie de refresh; con código
  incorrecto responde `401`; y tras 5 intentos fallidos, el `mfaToken` queda invalidado y un intento
  posterior **con el código correcto** también responde `401`.

- **AC-18** — Dado un código de recuperación entregado en el `enable`, cuando se usa en
  `POST /api/auth/mfa/verify`, entonces responde `200`; y cuando se reutiliza el mismo código, responde
  `401` (uso único).

- **AC-19** — Dado un usuario con MFA activo, cuando se hace `POST /api/auth/mfa/disable` con
  contraseña y código correctos, entonces responde `200` con `mfaEnabled: false`, y en la base
  `mfaSecret` queda nulo y no quedan códigos de recuperación de ese usuario; con la contraseña
  incorrecta responde `401` y MFA sigue activo.

### Protección de la superficie de auth

- **AC-20** — Dadas más peticiones a `POST /api/auth/login` desde la misma IP que el límite configurado
  en su ventana, cuando se supera el límite, entonces responde `429` con `ErrorResponseDto`; y los
  contadores residen en Redis (una segunda instancia del proceso ve el mismo contador, verificado con
  dos apps compartiendo el store).

- **AC-21** — Dado el API en entorno no productivo, cuando se hace `GET /api/docs-json`, entonces el
  documento incluye las nueve rutas de `/api/auth/*`, el esquema de seguridad `bearer`, y los schemas
  `UserResponseDto`, `AuthSessionResponseDto`, `LoginResponseDto`, `MfaSetupResponseDto`; y ningún
  endpoint declara como respuesta un modelo generado por Prisma.

### Frontend

- **AC-22** — Dada la web sin sesión, cuando se navega a una ruta protegida, entonces se redirige a
  `/login` conservando el destino, y al autenticarse se aterriza en la ruta pedida originalmente; con
  sesión válida, la ruta protegida renderiza el shell.

- **AC-23** — Dado un usuario con MFA, cuando envía correo y contraseña en `/login`, entonces la vista
  pide el código de 6 dígitos (`autocomplete="one-time-code"`) y al enviarlo correcto entra a la
  aplicación; y en ningún momento el `accessToken` aparece en `localStorage` ni en `sessionStorage`.

- **AC-24** — Dada una llamada autenticada que responde `401` por token expirado, cuando el cliente
  HTTP la recibe, entonces intenta un refresh y reintenta la petición original **una sola vez**; si el
  refresh falla, el estado pasa a anónimo y la app redirige a `/login` sin bucle de peticiones.

- **AC-25** — Dado el navegador real con web y api corriendo, cuando Playwright registra un usuario,
  cierra sesión, vuelve a entrar con las mismas credenciales y abre la ruta protegida, entonces el flujo
  completo pasa sin errores de consola.

### Configuración

- **AC-26** — Dado el proceso del API, cuando `MFA_ENCRYPTION_KEY` falta o no decodifica a 32 bytes,
  entonces el bootstrap lanza un error que nombra la variable y el proceso no queda escuchando.

## 4. Fuera de alcance

- **Verificación de correo y recuperación de contraseña por email**: no hay proveedor de correo en el
  proyecto. Entra cuando se decida uno (spec propia). Consecuencia asumida: quien olvida la contraseña y
  no tiene otra sesión no puede recuperarla todavía.
- **OAuth / login social / SSO / Auth.js**: descartado por decisión del usuario.
- **Roles y permisos** más allá de "el recurso es del usuario del token". Sin `admin`, sin equipos, sin
  documentos compartidos.
- **Gestión de dispositivos y sesiones desde la UI** (listar sesiones activas, "cerrar sesión en todos
  los dispositivos"). El backend ya revoca familias de sesión, pero no se expone endpoint ni pantalla.
- **Revocación inmediata del access token**: se acepta la ventana de su TTL (15 min). No hay lista de
  revocación de access tokens.
- **Cambio de contraseña y edición de perfil**: spec posterior.
- **Directorios y documentos**: spec `002-workspace-tree`. Esta spec deja el guard, el decorador de
  usuario y el helper de autenticación para e2e que la `002` va a usar.
- **Diseño visual definitivo**: las vistas de auth son funcionales y accesibles, no una propuesta de UI
  final.
- **WebAuthn / passkeys y MFA por SMS**: solo TOTP.

## 5. Riesgos y decisiones abiertas

| # | Riesgo / duda | Impacto | Mitigación / quién decide |
|---|---------------|---------|---------------------------|
| 1 | `otplib` está en **13.x**, un major que reescribió la API: ahora es `new OTP({ strategy: 'totp' })` con `generate`/`verify` **asíncronos**, `verify` devuelve `VerifyResult` (no un booleano) y la tolerancia se expresa en segundos (`epochTolerance`), no en "ventanas". Casi todo el material de entrenamiento describe la 12.x (`authenticator.check()`, síncrona) | Medio: implementación que no compila o verificación siempre falsa | Verificado con `context7` el 2026-07-24 y fijado en `plan.md` §2. `T-013` envuelve la librería en un `TotpService` propio con el epoch inyectable, para que los tests no dependan del reloj y un futuro cambio de librería toque un solo archivo |
| 2 | `@nest-lab/throttler-storage-redis` (1.2.0) es un paquete de terceros cuya compatibilidad con `@nestjs/throttler` 6.x no está confirmada | Medio: AC-20 bloqueado o dependencia abandonada | Se implementa un `RedisThrottlerStorage` propio (≈30 líneas) sobre el `RedisService` que ya existe, contra la interfaz `ThrottlerStorage` del propio `@nestjs/throttler`. Cero dependencias nuevas y testeable. Si la interfaz resultara más compleja de lo previsto, la alternativa es el paquete de terceros: decide el orchestrator |
| 3 | `bcrypt` 6.x es un módulo nativo: puede fallar al compilar en Node 22/24 del CI o en Alpine | Alto: bloquea todo el auth | `T-001` instala y corre un hash/compare real en los dos Node de la matriz antes de seguir. Si falla, **parar y reportar**: el cambio a `bcryptjs` (JS puro, misma API, más lento) lo decide el orchestrator y deja entrada en el CHANGELOG. No se cambia por cuenta propia |
| 4 | bcrypt con coste 12 tarda ~250 ms por hash; una suite con decenas de registros se vuelve lentísima | Medio: e2e de minutos, TDD insoportable | `BCRYPT_ROUNDS` es configurable con default 12 y **4 en el entorno de test** (`test/setup-env.ts`). El coste real de producción se verifica en un test dedicado que comprueba el prefijo `$2b$12$` con la config por defecto |
| 5 | Los e2e de auth necesitan PostgreSQL **con la migración aplicada** y Redis limpio entre casos. Hoy el CI levanta los servicios pero no corre migraciones | Alto: verde en local, rojo en CI | `T-026` añade `prisma migrate deploy` al workflow y las variables de auth a los jobs. Cada e2e usa correos únicos por caso y limpia sus claves de Redis por prefijo; nunca `FLUSHALL` (borraría la base de datos de un desarrollador) |
| 6 | Guardar el secreto TOTP en claro en la base convierte cualquier dump en un bypass silencioso del segundo factor | Alto (seguridad) | El secreto se cifra con AES-256-GCM (`MFA_ENCRYPTION_KEY`, 32 bytes en base64) y solo se persiste cuando el usuario confirma el `enable`; el secreto pendiente vive en Redis con TTL de 10 min. Coste asumido: una variable de entorno más, y que perderla obliga a re-enrolar a todos los usuarios (documentado en `plan.md` §4) |
| 7 | `POST /api/auth/refresh` no lleva token CSRF: un tercero podría forzar una rotación desde otro sitio y, con la detección de reutilización, dejar al usuario sin sesión | Bajo–medio | Cookie `SameSite=Strict` + `Path=/api/auth` + `HttpOnly`; en producción `Secure`. Se acepta el riesgo residual y se documenta; un token CSRF explícito queda para una spec de hardening si se despliega en dominios cruzados |
| 8 | El registro devuelve `409` ante un correo ya usado, lo que **sí** permite enumerar cuentas — justo lo que AC-6 evita en el login | Bajo | Aceptado a conciencia: la alternativa (registro que responde igual siempre y avisa por correo) exige el proveedor de correo que está fuera de alcance. Se compensa con rate limit por IP en `register`. Revisar cuando entre la spec de correo |
| 9 | El access token vive solo en memoria del frontend, así que cada recarga de página dispara un `POST /api/auth/refresh` | Bajo: una petición extra al arrancar | Es el precio de no dejar el token en `localStorage` (donde cualquier XSS lo leería). El arranque muestra estado de carga hasta que el refresh resuelve, y el refresh es una sola petición gracias al *single-flight* de `T-020` |
| 10 | Las sesiones viven solo en Redis: si Redis se reinicia sin persistencia, todos los usuarios quedan fuera | Bajo en desarrollo | Aceptado: son sesiones, no datos de negocio. La alternativa (tabla de sesiones en PostgreSQL) añade escrituras en cada refresh sin beneficio a esta escala. Si el despliegue exige durabilidad, se decide entonces |
| 11 | `exactOptionalPropertyTypes` choca con DTOs de campos opcionales (`displayName?`) y con los `null` explícitos del contrato | Bajo, pero cuesta tiempo | El contrato usa **`null` explícito, no ausencia**, en todo lo opcional que viaja al cliente (`displayName: string \| null`, `session: … \| null`). Se documenta en `plan.md` §2 para que frontend y backend no diverjan |

## 6. Trazabilidad

| AC | Cubierto por | Tarea |
|----|--------------|-------|
| AC-1 | `apps/api/test/auth-register.e2e-spec.ts` | T-008 |
| AC-2 | `apps/api/test/auth-register.e2e-spec.ts` (correo duplicado, distinta caja) | T-008 |
| AC-3 | `apps/api/test/auth-register.e2e-spec.ts` (validación) | T-008 |
| AC-4 | `apps/api/src/auth/password.service.spec.ts` + `auth-register.e2e-spec.ts` (fila en base) | T-004, T-008 |
| AC-5 | `apps/api/test/auth-login.e2e-spec.ts` + `src/auth/token.service.spec.ts` | T-005, T-009 |
| AC-6 | `apps/api/test/auth-login.e2e-spec.ts` (mensajes idénticos) | T-009 |
| AC-7 | `apps/api/src/auth/login-attempt.service.spec.ts` + `test/auth-login.e2e-spec.ts` | T-007, T-009 |
| AC-8 | `apps/api/test/auth-me.e2e-spec.ts` | T-010 |
| AC-9 | `apps/api/test/auth-session.e2e-spec.ts` + `src/auth/session.store.spec.ts` | T-006, T-011 |
| AC-10 | `apps/api/src/auth/session.store.spec.ts` (reuso → revoca familia) + `test/auth-session.e2e-spec.ts` | T-006, T-011 |
| AC-11 | `apps/api/test/auth-session.e2e-spec.ts` (logout e idempotencia) | T-011 |
| AC-12 | `apps/api/src/auth/token.service.spec.ts` + `test/auth-me.e2e-spec.ts` (token cruzado) | T-005, T-010 |
| AC-13 | `apps/api/test/auth-mfa.e2e-spec.ts` (setup) + `src/auth/totp.service.spec.ts` | T-013, T-014 |
| AC-14 | `apps/api/test/auth-mfa.e2e-spec.ts` (enable) + `src/auth/mfa-secret.cipher.spec.ts` | T-012, T-014 |
| AC-15 | `apps/api/test/auth-mfa.e2e-spec.ts` (enable con código inválido) | T-014 |
| AC-16 | `apps/api/test/auth-mfa-login.e2e-spec.ts` | T-015 |
| AC-17 | `apps/api/test/auth-mfa-login.e2e-spec.ts` + `src/auth/mfa-challenge.store.spec.ts` | T-015 |
| AC-18 | `apps/api/test/auth-mfa-login.e2e-spec.ts` (código de recuperación reutilizado) | T-015 |
| AC-19 | `apps/api/test/auth-mfa.e2e-spec.ts` (disable) | T-016 |
| AC-20 | `apps/api/test/auth-throttle.e2e-spec.ts` + `src/auth/redis-throttler.storage.spec.ts` | T-017 |
| AC-21 | `apps/api/test/swagger.e2e-spec.ts` (ampliado) | T-018 |
| AC-22 | `apps/web/src/features/auth/RequireAuth.test.tsx` | T-021, T-022 |
| AC-23 | `apps/web/src/features/auth/LoginPage.test.tsx` (paso MFA + sin storage) | T-023 |
| AC-24 | `apps/web/src/shared/api/http.test.ts` (401 → refresh → reintento único) | T-020 |
| AC-25 | `apps/web/e2e/auth.spec.ts` | T-025 |
| AC-26 | `apps/api/src/config/env.validation.spec.ts` (ampliado) | T-002 |
