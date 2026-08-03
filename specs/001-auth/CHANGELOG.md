# Changelog — Spec 001 Auth

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.1.4 — 2026-07-29

**Entrada de cierre por un cambio en `apps/web/e2e/support/**`, que es contrato de esta spec.** La
escribe `T-007` de la `006-editor-undo`. **Ningún AC de la `001` cambia y ningún límite de producción
se toca**; tampoco se mueve su recuento (siguen 26/26 AC).

- **Qué cambia**: `support/editor-e2e.ts` gana un séptimo ayudante compartido, `watchContentSaves`
  —cuenta los `PUT …/content` contando **peticiones** que llegan al API, no espiando el store—, y el
  inventario de la guarda `apps/web/src/test/e2e-support.test.ts` lo incluye. `palette.spec.ts` y
  `tabs.spec.ts` pierden su copia local y lo importan.
- **Por qué ahora**: iba por su **segunda** copia y `e2e/undo.spec.ts` habría sido la tercera, que es
  cuando la regla de la casa manda extraer. La deuda estaba anotada con destinatario desde el cierre
  de la `005`.
- **Y una diferencia con la extracción de la `005` que conviene registrar**: aquellos seis ayudantes
  **ya habían divergido** —dos de ellos en firma, midiendo cosas distintas mientras creían medir lo
  mismo—, así que extraer fue **elegir**. Estas dos copias eran **idénticas carácter por carácter**,
  comentario incluido, y se comprobó **antes** de mover en vez de suponerlo: aquí extraer fue mover.
- **Verificado**: `test e2e-support` → **5 passed** (el RED previo señaló los dos archivos que lo
  declaraban por su cuenta) · `typecheck` y `lint` en **0** · la suite de navegador con **los mismos
  casos y los mismos nombres** que antes de la extracción.

## v0.1.3 — 2026-07-29

**Patch. Cambia el andamiaje e2e de esta spec; sus 26 AC y todos sus límites de producción, no.**
Lo traen `T-001` (su **AC-29**) y `T-002` (sus **AC-30** y **AC-31**) de la spec `005`, que tocan
`apps/web/e2e/support/**` por ser contrato de `001` — igual que hicieron `T-027` de la `002` y
`T-015` de la `003`. **No se modificó `THROTTLE_LIMITS` ni ningún umbral de seguridad, ni se añadió
ni se quitó ningún reset de contador.**

- **El problema.** `dev-env.ts` le daba al API un puerto propio (**3011**, «distinto del 3001 de
  `pnpm dev`») pero dejaba el web en **5173**, que es exactamente el de `pnpm dev`. Con
  `reuseExistingServer: false` —correcto y deliberado: un servidor reutilizado proxearía al API de
  desarrollo y la suite mediría el backend equivocado sin decirlo— la suite abortaba con
  `http://localhost:5173 is already used` **antes de ejecutar un solo caso** en cuanto alguien
  tuviera el servidor de desarrollo levantado. Es un fallo de **entorno disfrazado de fallo de
  suite**: no aparece ningún caso en rojo, aparece un error antes de empezar. Bloqueó dos mediciones
  al cerrar la `004`, que lo dejó anotado como su riesgo #14.

- **El arreglo, simétrico con lo que ya había.** `E2E_WEB_PORT = 5183` en `dev-env.ts`, con
  `E2E_WEB_ORIGIN` derivado de él, y el `webServer` del web arrancando con
  `pnpm dev --port <puerto> --strictPort`.

- **Dos decisiones que valen, y su motivo.** **(a) El puerto va por la CLI y no por
  `vite.config.ts`**: la línea de órdenes de Vite gana a la configuración, así que la suite se lleva
  su puerto sin tocar un archivo que es contrato de las specs `000` y `002` y que lleva un bloque de
  comentario que nadie debería releer para cambiar un puerto. **(b) `--strictPort` es obligatorio**:
  sin él, ante un puerto ocupado Vite se muda al siguiente libre **en silencio** y Playwright se
  queda esperando en una URL donde no hay nadie hasta agotar su tiempo — cambiar un aborto claro por
  un cuelgue oscuro es empeorar justo el problema que esto arregla.

- **Verificado, las dos mitades.** Con `pnpm dev` levantado: RED previo con el
  `is already used` literal, y tras el arreglo **`9 passed` (21,1 s)**. Sin `pnpm dev`: **`9 passed`
  (13,7 s)**. La precondición «parar `pnpm dev` antes de medir con Playwright» **deja de existir**.

- **`support/` gana un módulo: `editor-e2e.ts` (`T-002`, AC-30 y AC-31).** Los archivos de navegador
  que abren un documento del editor tenían **seis** ayudantes duplicados literalmente entre
  `editor.spec.ts` y `palette.spec.ts` —el *fixture* de sesión incluido, que es el que consume el
  `signIn` y los resets de contador de esta spec—, y la regla de la casa es extraer a la tercera
  copia. **Dos de las seis ya habían divergido**: la vigilancia de errores de consola tenía una
  versión que sabía tolerar patrones y otra que no, y el título único llevaba el prefijo escrito a
  mano en cada archivo. Al unificar sobrevive la firma **tolerante** (superset, así que quien no
  perdona nada no nota diferencia) y el prefijo pasa a ser **parámetro**, para que cada suite siga
  produciendo títulos que no chocan con un `409 DOCUMENT_TITLE_TAKEN` ajeno a lo que mide.
  **Nada del andamiaje de sesión cambia de comportamiento**: el *fixture* se mudó de sitio con sus
  dos resets y su `auto: true` idénticos, y `session.ts` y `services.ts` no se tocaron.

- **Y la extracción viene con guarda**, porque una regla que solo vive en la cabeza de quien la
  escribió se rompe en la siguiente spec: `apps/web/src/test/e2e-support.test.ts` lee el fuente de
  los archivos de casos y falla si alguno vuelve a hacerse su copia. Vive en `src/` porque es donde
  mira Vitest. Verificado: RED con las **12** copias enumeradas (seis por archivo) y, tras la
  extracción, `test e2e-support` en verde y `test:e2e` con los **mismos 9 casos en verde** que antes
  (18,4 s frente a los 17,8 s de la medición previa, con los mismos nombres de caso).

## v0.1.2 — 2026-07-28

**Patch. Vuelve a cambiar el andamiaje e2e de esta spec; sus 26 AC y todos sus límites de producción, no.**
Lo trae `T-015` de la spec `003` (su **AC-34**), que toca `apps/web/e2e/support/**` por ser contrato de
`001`, igual que hizo `T-027`. **No se modificó `THROTTLE_LIMITS` ni ningún umbral de seguridad.**

- **El problema, con las cifras medidas.** La spec `003` añade `apps/web/e2e/editor.spec.ts`, con su
  `login` por caso y un consumo nuevo de la superficie del workspace. El RED de `T-015`
  (`playwright test --retries=2 --repeat-each=3`) murió en el tercer repeat con **1 failed / 23 passed**:
  el `error-context.md` enseña la aplicación con `alert: Demasiadas peticiones desde esta dirección`,
  es decir un **`429` de `workspace`**. Y el caso que caía era el del árbol (`workspace.spec.ts`), no el
  del editor: el cupo es **por IP y global de la suite**, así que lo paga quien pasa por ahí, no quien
  gasta. Instrumentado con un muestreo de los contadores de Redis durante la corrida, el pico de
  `throttle:workspace:*` era **98 de 120** en una corrida **verde y sin un solo reintento**, toda ella
  dentro de una sola ventana de 60 s. Margen: 22 peticiones, **menos de lo que cuesta un reintento** del
  recorrido del árbol.
- **Primero se gastó menos** (`support/session.ts`, `editor.spec.ts`): `signIn` pasa a devolver un
  `E2eSession { email, authorization }`, con la cabecera construida a partir del `accessToken` que el
  propio `login` ya devolvía. Dos casos del editor arrancaban la aplicación entera en `/` solo para tomar
  prestada esa cabecera de la petición del árbol —un `POST /auth/refresh` + un `GET /workspace/tree` por
  caso, para leer una cabecera—; ese arranque desaparece. Es la **misma** credencial de la **misma**
  sesión: que el refresh silencioso rote la cookie no invalida el access token, porque
  `jwt-access.strategy.ts` lo valida por firma, `typ` y existencia del usuario, **sin** consultar el `sid`
  en Redis.
- **Y solo después se neutralizó** (`support/services.ts`): se añade
  `resetWorkspaceThrottleCounter()`, que pone a cero `throttle:workspace:*` **en los límites** de cada
  caso de `editor.spec.ts` —en el *fixture* de sesión, antes de entrar—, nunca a mitad de una secuencia.
  Mismo camino RESP-sobre-TCP que ya usaban `register` y `login`, **sin dependencias nuevas**. El cupo de
  **`documentContent` NO se resetea**: la suite entera gasta 4 de sus 120 por corrida y neutralizarlo
  restaría cobertura a cambio de nada.
- **Qué cobertura se pierde y dónde vive ahora**: la suite de navegador **deja de poder detectar** el
  límite de la superficie del workspace (120/min por IP). Quien lo verifica es
  `apps/api/test/workspace-throttle.e2e-spec.ts` (**AC-24** de la spec `002`), que agota las 120
  peticiones y exige el `429` con forma de `ErrorResponseDto` en cuatro casos, y que además comprueba que
  agotar `workspace` **no** agota `login` ni `documentContent`. Es su sitio: un límite **por IP** se
  prueba contra el API, no a través de un navegador. La cobertura de AC-24 se comprobó **antes** de
  neutralizar nada.
- **LA PROHIBICIÓN SIGUE EN PIE, y es sobre el momento.** Resetear en los **límites** de un caso hace la
  prueba determinista; a mitad de una secuencia de agotamiento hace que el `429` no llegue nunca. **No se
  tocó ni un archivo de `apps/api/test/`** en esta tarea.
- **Deuda que esta entrada deja escrita, porque no se arregla desde aquí**: de las peticiones de
  `workspace` que gasta el editor, la mitad son el `GET /api/workspace/documents/:id` **duplicado** que
  `StrictMode` provoca en cada apertura, porque el `webServer` de Playwright levanta `pnpm dev`. No es un
  defecto del editor y no se puede quitar sin tocar `playwright.config.ts` / `vite.config.ts` (contrato de
  la `000`) o el propio `main.tsx` / `editor.store.ts` (fuera del alcance de `T-015`). Se reporta al
  orchestrator en vez de tocarlo por cuenta propia.
- **Verificado** (comandos corridos y salida real): RED
  `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` → **1 failed /
  23 passed**, con el `429` a la vista en el contexto de error; tras el cambio, el mismo comando →
  **24 passed** (19,5 s), EXIT=0, con el pico de `throttle:workspace:*` bajando de **98** a **20** de 120 ·
  `pnpm test:e2e` → **8 passed**, EXIT=0 · `pnpm --filter @one-markdown/web test` → 16 archivos /
  **321** · `typecheck` y `lint` en **0**. **Ningún test de `001` se puso en rojo.**

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

---

## Registro de implementación — movido desde `IMPLEMENTATION.md` (2026-08-03)

> Trasladado **literal**, sin podar. El documento de seguimiento había crecido a 3.317 líneas y había
> dejado de servir de índice; el detalle de cada feature pasa a vivir con su feature. Si algo de aquí
> repite lo que ya dice el historial de versiones de arriba, se recorta cuando se tengan los dos
> delante — no antes.


### Planificación de la spec

- [x] **spec 001-auth** — `specs/001-auth/` (`spec.md` v0.1.0 + `plan.md` + `tasks.md` + `CHANGELOG.md`),
      estado **approved** (aprobada por el usuario el 2026-07-24, sin cambios de alcance). — 2026-07-24
      26 criterios de aceptación y 26 tareas TDD en 7 bloques; la implementación es la Fase 3.
      Versiones de las dependencias nuevas fijadas contra npm y APIs verificadas con `context7`
      (`otplib` 13.x cambió de API respecto de la 12.x; `@nestjs/throttler` 6.x).


### Fase 3 — Implementación de `001-auth`


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

- [x] **T-017** · backend · Rate limit por IP con `RedisThrottlerStorage` propio (AC-20) — 2026-07-24 · agente `backend`
      RED: (a) `Cannot find module './redis-throttler.storage'` · (b) **8 failed de 12** (`expected 429, got 401`)
      → GREEN: `test redis-throttler.storage` → **7 passed** · `test:e2e auth-throttle` → **12 passed**.
      Verificado por el orchestrator **en el proceso real**: 12 logins con correos **distintos** (para que
      salte el límite por IP y no el bloqueo por cuenta) → los 10 primeros `401`, el 11.º y 12.º `429`.
      Los dos `429` no se confunden: el del throttler trae 5 claves y la cabecera `Retry-After-login` de la
      librería; el del bloqueo por cuenta trae `retryAfterSeconds` y la cabecera `Retry-After` estándar.
      `GET /api/health` aguantó 30 peticiones seguidas → **30 × 200**: no se derramó el límite.
      Tres decisiones que sostienen esto:
      · **Opt-in por ruta.** El guard evalúa *todos* los throttlers nombrados en cada petición, así que sin
        `skipIf` + `@Throttled(name)` el más estricto (`register`, 5/15 min) habría caído sobre toda la API,
        incluida la spec `002`. Health lleva además `@SkipThrottling()` explícito: `@SkipThrottle()` a secas
        solo salta un throttler llamado `default`, que aquí no existe.
      · **`generateKey` propio** (`throttle:{throttler}:{sha256(ip)}`, sin nombre de clase ni de handler):
        los cuatro endpoints de MFA comparten **un** cupo de 10/min. Con la clave por defecto de la librería,
        un atacante habría sumado 40 intentos cambiando de endpoint.
      · **`getTracker` usa `req.ip` y `trust proxy` sigue apagado**: nunca `X-Forwarded-For`, que es
        spoofable. Un despliegue tras proxy tendrá que configurarlo, y está anotado en el código.
      **Los tres huecos del Bloque D quedan cerrados, cada uno con su test**: `mfa/disable` limitado (11.º
      intento → 429), `mfa/verify` limitado incluso pidiendo desafíos nuevos a mitad (el ataque exacto), y la
      amplificación bcrypt de los 8 hashes acotada por el mismo cupo.
      **Desvío**: hubo que tocar una línea de `beforeEach`/`afterAll` en los 6 e2e de auth. El límite es por IP
      y todos salen de `127.0.0.1` sobre el mismo Redis: sin resetear el contador fallaban por acumulación, no
      por comportamiento. Ojo con un caso que ya gasta 10 de los 10 logins permitidos.
      **Entrada que atendió**: tres huecos que la autorevisión de seguridad del Bloque D encontró y
      reportó en vez de parchear (el plan asigna `@Throttle` a esta tarea). No son opcionales:
      1. **`POST /api/auth/mfa/disable` no tiene límite de ningún tipo.** `LoginAttemptService` solo cuenta
         fallos de login. Quien robe un access token puede fuerza-brutar el TOTP de 6 dígitos (~333k
         peticiones esperadas) o la contraseña sin fricción. Es el más serio de los tres.
      2. **`mfa/verify` limita a 5 intentos por desafío, pero no el número de desafíos**: quien ya tenga la
         contraseña pide un login nuevo cada 5 intentos y sigue probando.
      3. `RecoveryCodeService.consume` compara hasta 8 hashes bcrypt por intento: con coste 12 son ~2 s de
         CPU por petición en un endpoint sin límite, o sea un amplificador de DoS barato.
- [x] **T-018** · backend · Swagger de auth: bearer, cookie y DTOs (AC-21) — 2026-07-24 · agente `backend`
      RED: **2 failed de 40** (los dos esquemas de seguridad ausentes, `Received: undefined`) → GREEN:
      `test:e2e swagger` → **43 passed**.
      Verificado por el orchestrator contra el documento servido por el proceso real:
      `securitySchemes: bearer, om_refresh` · **9** rutas `/api/auth/*` · el documento entero **no menciona**
      `passwordHash` ni `mfaSecret`.
      El test de "ningún schema se llama como un modelo de Prisma" **lee los nombres de `schema.prisma` con
      una regex** en vez de una lista fija: así no se queda viejo cuando la spec `002` añada modelos.
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

- [x] **T-020** · frontend · Cliente HTTP autenticado con refresh single-flight y reintento único (AC-24) — 2026-07-24 · agente `frontend`
      RED: `configureAuthBridge is not a function`, **16 failed de 23** → GREEN: `test http` → **25 passed**.
      `credentials: 'include'` se aplica **después** del spread del `init`, así que ninguna llamada puede
      desactivarlo por descuido. `login`/`register`/`refresh`/`verifyMfa`/`logout` van por un camino
      distinto y **no pueden** entrar en el circuito de reintento: ahí estaría el bucle infinito.
- [x] **T-021** · frontend · `useAuthStore` y arranque con refresh silencioso (AC-22, AC-23) — 2026-07-24 · agente `frontend`
      RED: `Failed to resolve import "./auth.store"` → GREEN: `test auth.store` → **19 passed**.
- [x] **T-022** · frontend · `/login`, `/register` y `RequireAuth` (AC-22) — 2026-07-24 · agente `frontend`
      RED: **20 failed de 23** (`Unable to find a label with the text of: /correo electrónico/i`) → GREEN:
      `test RequireAuth LoginPage RegisterPage` → **29 passed**.
      `RequireAuth` **no** redirige mientras el estado es `unknown`/`authenticating` (si lo hiciera, el
      refresh silencioso no llegaría a tiempo y el usuario vería `/login` en cada recarga), y
      `readRedirectTarget` rechaza rutas externas y `/login`/`/register`: open redirect y bucle, cerrados.
- [x] **T-023** · frontend · Paso de segundo factor en el login (AC-23) — 2026-07-24 · agente `frontend`
      RED: **6 failed de 15** → GREEN: `test LoginPage` → **15 passed**.
- [x] **T-024** · frontend · `/settings/security`: alta y baja de MFA — 2026-07-24 · agente `frontend`
      RED: **7 failed de 9** → GREEN: `test SecurityPage` → **9 passed**.
      Total web: **92 passed** (venía de 14) · `typecheck` 0 · `lint` 0, verificado por el orchestrator.
- [x] **T-025** · frontend · e2e del flujo de auth en navegador (AC-25) — 2026-07-25 · agente `frontend`
      RED: los 3 del smoke heredados en rojo + el nuevo `element(s) not found` en el `h1` de "Crear cuenta"
      → GREEN: `pnpm test:e2e` → **4 passed** (verificado por el orchestrator, dos corridas seguidas).
      **Destapó un fallo que ningún otro test podía ver: la web no arrancaba en un navegador real.**
      `packages/shared` se publica como CJS y, al ser un paquete enlazado del workspace, Vite no lo
      pre-empaqueta: el `import { isApiErrorShape }` del cliente HTTP moría con `does not provide an export
      named`. Vitest sobre jsdom y `apps/api` consumen CJS sin queja, y `vite build` lo resuelve por Rollup,
      así que el único test que abría un navegador de verdad era el smoke (AC-11)… que llevaba días en rojo
      por otro motivo. **El test que existía para atrapar esto estaba tapado por su propio fallo.**
      Mitigado en el consumidor con `optimizeDeps: { include: ['@one-markdown/shared'] }` (ver
      `specs/000-foundation/CHANGELOG.md` v0.1.4; la solución de raíz —que `shared` emita ESM— queda como
      decisión abierta, no como olvido).
      El API del e2e corre en el **3011**, nunca en el 3001, y el proxy de Vite se parametrizó: así la suite
      no habla por accidente con el proceso que el usuario tenga a mano. `reuseExistingServer: false` en
      ambos servidores, con la consecuencia de que **`pnpm test:e2e` no se puede correr con `pnpm dev`
      ocupando el 5173**.
      Del smoke de la spec `000` solo se añadió un `beforeEach` que abre sesión (desde T-022 el shell vive
      detrás de `RequireAuth`): **ninguna aserción se relajó**, siguen exigiendo `main`, `navigation`, el
      `h1`, el 404, el toggle por teclado y `consoleErrors`/`pageErrors` en `[]`.
      La única tolerancia está en el flujo nuevo y está acotada: el arranque anónimo sondea
      `POST /api/auth/refresh` a ciegas (la cookie es `HttpOnly`, el JS no puede saber si existe) y Chromium
      anota todo 4xx en consola. Fuera de ese sondeo, cero errores; y **desde que hay sesión, cero de
      cualquier tipo**. Auditado por el orchestrator leyendo las aserciones, no el informe.
      El requisito que le pasé desde T-026 quedó cubierto: `globalSetup`/`globalTeardown` borran solo sus
      cuentas (por prefijo) y los contadores `throttle:*`, con un mini cliente RESP sobre `node:net` para no
      añadir dependencias. Idempotencia entre reintentos verificada con un fallo inyectado y `--retries=1`:
      correo único por **intento**, no por archivo.

CI:

- [~] **T-026** · backend · CI con `prisma migrate deploy` y variables de auth — 2026-07-25 · agente `backend`
      Workflow escrito y verificado en todo lo que se puede verificar sin pushear:
      `Apply Prisma migrations` entra en el **paso 9**, después del typecheck (lint y typecheck son baratos y
      deben fallar primero) y antes de los pasos que tocan la base · las 9 variables del job comprobadas
      contra el `validateEnv` **real** compilado, incluidos los tres casos negativos (clave ausente, clave de
      16 bytes, secretos iguales) · `prisma migrate deploy` contra la base local → `No pending migrations to
      apply`, exit 0 · YAML parseado (14 pasos) y `prettier --check` en verde.
      **Hallazgo que no era teórico**: `actions/setup-node` con `node-version: '22'` se queda con la versión
      **ya cacheada en la imagen del runner** si satisface el rango (`check-latest` es `false` por defecto).
      Como `engines` ahora pide `>=22.12` por la cadena ESM de `otplib`, la matriz pasa a un rango semver
      explícito (`>=22.12 <23`) con `include` + `label`, para no perder el nombre estable del job
      (`verify (node 22)`), que es el que verían unos *required checks*.
      **Bloqueada en**: el `DONE` exige un run verde y `git push` sigue denegado en la sesión. Comparte
      bloqueo con `T-015` de la spec `000`. La mitad negativa ya está cubierta por el run `30139345799`.
      **Riesgo cruzado que detectó y reportó en vez de parchear**: en CI el e2e de API corre antes que el de
      navegador, sobre el mismo Redis y la misma IP, y uno de sus tests **satura a propósito** el rate limit.
      Sin limpiar los contadores entre pasos, los logins del navegador darían `429` intermitentes. El punto
      natural de limpieza es el `globalSetup` de Playwright, que es de T-025: se lo pasé como requisito al
      agente que la está implementando, junto con la idempotencia entre reintentos (`retries: 2` en CI).


### Cierre de la Fase 3 (2026-07-25)


**25 de 26 tareas hechas y verificadas; 1 bloqueada** (`T-026`, espera un run de CI que necesita `git push`).
Los **26 criterios de aceptación** de la spec `001` tienen test automatizado en verde.

Secuencia completa corrida de punta a punta, **borrando `packages/shared/dist` antes** para no repetir el
falso verde que destapó el primer CI:

| Comando | Resultado |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 (los 3 paquetes) |
| `pnpm test` | api **135** · web **92** · shared **37** |
| `pnpm --filter @one-markdown/api test:e2e` | 11 suites, **171 passed** |
| `pnpm build` | exit 0 |
| `pnpm test:e2e` | **4 passed** (2 corridas seguidas en verde) |

**439 tests en total** (68 al cerrar la Fase 2). Postgres y Redis quedan como se encontraron: 0 usuarios,
0 claves.

Lo que más costó no fue el código de auth, sino tres cosas que ningún test veía:

1. **El AC-1 de la spec `000` estaba mal verificado** (typecheck sobre un árbol sucio). Lo encontró el
   primer run real de CI, no una revisión.
2. **La web no arrancaba en un navegador real** por el CJS de `packages/shared`, y el test que existía para
   atraparlo (AC-11) llevaba días en rojo por otro motivo: un test rojo tolerado tapa exactamente los
   fallos que ese test justifica.
3. **Un test intermitente que despaché como "transitorio"** sin explicarlo. Era real, ~1 de cada 8 corridas.

Las tres tienen la misma forma: la verificación existía, pero no verificaba. De ahí las reglas nuevas de
este archivo — correr los `DONE` desde estado limpio y no cerrar un fallo sin explicar por qué desapareció.


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


### Nota del índice — movida desde `specs/README.md` (2026-08-03)

El índice volvió a ser una línea por spec; esta era su fila, literal.

- **Feature**: Auth — registro, login, JWT access+refresh, bcrypt, MFA TOTP, Redis, rate limit
- **Versión**: **0.1.4**
- **Depende de**: 000

**Estado tal como estaba escrito**: **implemented** — 26/26 AC (T-026 **sigue esperando un run verde de CI**, que necesita `git push`) · **v0.1.4** (`T-007` de la `006`): los ayudantes compartidos de `e2e/support/` pasan a ser **siete** con `watchContentSaves`, que estaba duplicado en `palette.spec.ts` y `tabs.spec.ts` y que `undo.spec.ts` habría convertido en tercera copia. **Las dos copias eran idénticas carácter por carácter**, comprobado **antes** de mover —a diferencia de los seis de la `005`, dos de los cuales ya habían divergido en firma—, así que aquí extraer fue **mover** y no **elegir**. Ningún AC suyo cambia y ningún límite de producción se toca · **v0.1.3** (`T-001` y `T-002` de la `005`): el servidor web de la suite se lleva **puerto propio** (`E2E_WEB_PORT = 5183`, con `--strictPort`) y `support/` gana `editor-e2e.ts` con los **seis** ayudantes que `editor.spec.ts` y `palette.spec.ts` duplicaban —dos de ellos ya divergidos—, más una **guarda** que falla si alguien vuelve a hacerse su copia. Ningún AC suyo cambia y ningún límite de producción se toca. **Con eso, la suite de navegador y `pnpm dev` pasan a poder coexistir** · **v0.1.1**: el andamiaje e2e neutraliza a propósito los contadores de `register`/`login`. **v0.1.2** (`T-015` de la `003`): se añade el reset de `throttle:workspace:*`; `documentContent` **no** se resetea (la suite gasta **4 de 120 por corrida**; bajo `--repeat-each=3` son **12**, porque las tres repeticiones caen dentro de la misma ventana de 60 s — precisión de la v0.1.5 de la `003`). La regla real sobre resets está en `003/tasks.md` `T-015`: importa **el momento** (en los límites sí, a mitad de una secuencia de agotamiento no), no el lugar
