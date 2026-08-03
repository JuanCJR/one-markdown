# Changelog — Spec 000 Foundation

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.1.7 — 2026-07-25

**Cierre de la revisión que la v0.1.4 dejó apuntada** («se revisará cuando la spec `002` amplíe el contrato
compartido»). La amplió, y salió mal: la mitigación de la v0.1.4 —`optimizeDeps: { include:
['@one-markdown/shared'] }` en `apps/web/vite.config.ts`— **no era suficiente**. La corrección la trae
`T-026` de la spec `002` (su **AC-34**), que toca este archivo por ser contrato de `000`, igual que `T-024`
tocó `AllExceptionsFilter`.

- **Qué faltaba, con el mecanismo exacto — y la explicación aproximada lleva a la solución equivocada**:
  Vite invalida `node_modules/.vite` comparando **dos** hashes, `lockfileHash` y `configHash`
  (`optimizer/index.ts`, `loadCachedDepOptimizationMetadata`; verificado con `context7` el 2026-07-25). El
  **contenido** de un paquete enlazado del workspace no entra en ninguno de los dos, y la propia
  documentación de Vite lo dice: *«Vite detects dependency overrides but not `npm link` usage»*. O sea que
  **no** es que Vite hashee el `package.json` del paquete enlazado: **es que no mira el paquete en
  absoluto**. La primera hipótesis fue la primera, y llevaba a buscar el arreglo en `packages/shared`,
  donde no está.
- **Lo que costó, medido**: al añadir la spec `002` sus tipos y guards a `packages/shared`, la caché de la
  spec `001` seguía dándose por válida y el navegador recibía un módulo **sin** `isWorkspaceTree`. El árbol
  moría con «Ocurrió un error inesperado» tras un `GET /api/workspace/tree` que había respondido `200`,
  porque `expectShape` reventaba con `TypeError: guard is not a function` — **con `packages/shared/dist`
  perfectamente al día**. Solo se arreglaba borrando `node_modules/.vite` a mano.
- **Corrección**: `optimizeDeps: { include: ['@one-markdown/shared'], force: true }` en
  `apps/web/vite.config.ts`, con el comentario ampliado en el propio archivo para que nadie lo quite por
  parecer redundante. Y `apps/web/playwright.config.ts` vuelve a `pnpm dev` **sin `--force`**: la suite deja
  de compensar un defecto del producto, que es la mitad del valor del cambio.
- **Coste asumido y explícito**: `force: true` re-empaqueta **todas** las dependencias en cada arranque del
  servidor de desarrollo, no solo `shared`. A este tamaño son un par de segundos, y se prefiere un arranque
  algo más lento a un árbol roto en silencio.
- **La salida de raíz sigue siendo la misma que apuntaba la v0.1.4 y sigue sin hacerse aquí**: que `shared`
  emita ESM. Sin CJS no haría falta pre-empaquetarlo —se serviría por el grafo de módulos y no habría caché
  que envejecer—, pero `apps/api` es NestJS **CommonJS** sobre el mismo `dist` y exigiría salida dual o
  mover el backend a ESM. Es empaquetado de los tres paquetes: **spec propia**, no un cierre de fase. El
  día que se haga, `include` y `force` se van juntos.
- **Verificado** (comandos corridos y salida real): con la caché envenenada y el `--force` ya retirado de
  Playwright, `pnpm test:e2e` → `1 failed / 4 passed` con el fallo correcto (alerta de la UI **y**
  `/api/workspace/tree | 200` en la traza de red); con `force: true`, `pnpm test:e2e` → **5 passed**; y
  envenenando **contra el `configHash` nuevo** (`grep -c` 2 → 0, `node --check` conforme) → **5 passed**
  otra vez, que es lo que descarta que a la caché la salvara el hash y no el `force`. `pnpm --filter
  @one-markdown/web test` → 12 archivos / **188**, sin cambios. `typecheck` y `lint` EXIT=0.
  **Ningún test de `000` se puso en rojo.**
- **Lo que este cambio NO deja vigilado, y se escribe sin adornar**: el envenenado de la caché es un paso
  **manual** y **CI no lo cazará nunca** —el runner arranca siempre con `node_modules/.vite` frío, así que
  allí `force: true` y su ausencia son indistinguibles—. Lo que sí queda vigilando es que
  `playwright.config.ts` ya no lleva `--force`: si alguien quita el `force` de `vite.config.ts`,
  `pnpm test:e2e` se rompe **en local** para cualquiera con caché previa, y en CI no. El defecto vive en la
  máquina de quien desarrolla, que es justo donde CI no mira.

## v0.1.6 — 2026-07-25

**Cierre de la ampliación de AC-5 que abrió la v0.1.5**: `T-024` de la spec `002` está implementada y
verificada, y AC-33 en verde. Esta entrada registra **cómo quedó la detección**, que es la parte que se
erosiona con el tiempo: quien la lea dentro de seis meses tiene que poder distinguir la regla que se
eligió de la que parece equivalente y no lo es.

- **Verificado** (comandos corridos y salida real): `pnpm --filter @one-markdown/api test all-exceptions`
  → **1 suite / 12 tests** · `pnpm --filter @one-markdown/api test:e2e "body-limit|validation"` →
  **2 suites / 11 tests** · suite unitaria completa del API → **18 suites / 255 tests** · regresión
  dirigida `test:e2e "auth-|health|swagger"` → **10 suites / 163 tests**, **ningún test de `000` ni de
  `001` en rojo**, que era la condición explícita de la tarea. Archivo e2e nuevo:
  `apps/api/test/body-limit.e2e-spec.ts`.
- **La detección es por forma y con rango cerrado, no «tiene `status`»**: se leen `status` y `statusCode`
  (`http-errors` pone las dos) y solo pasa un valor que cumpla
  `Number.isInteger(value) && value >= 400 && value <= 499`. Los dos extremos son deliberados. Un
  `status` no entero solo puede venir de un error de programación y no puede decidir el código de una
  respuesta; y si bastara «tiene un `status`», cualquier `5xx` —o un `200`— de una librería se saltaría el
  `logger.error`, que es justo la señal que no se puede perder. Casos con test:
  `'nope'`, `413.5`, `NaN`, `null`, `true` (no enteros) y `399`, `200`, `0`, `-1`, `600` (fuera de rango).
- **Sin `import` de `http-errors`**, como prometía la v0.1.5: se reconoce por forma, nunca con
  `instanceof`. La dependencia sigue siendo transitiva de Express y no declarada.
- **Cambia el criterio de registro, y esto sí es observable**: antes se registraba por **origen**
  (`!isHttp || status >= 500`) y ahora por **estado** (`status >= HttpStatus.INTERNAL_SERVER_ERROR`). Un
  `4xx` es un fallo del cliente lo emita quien lo emita, así que el `413` deja de escribir traza; y un
  `status: 502` de una librería **no entra en el rango**, cae al `500` genérico y **sigue** pasando por
  `logger.error` con traza. Las dos mitades tienen test.
- **Del error ajeno solo se publica `message`, y solo si es texto**; **`code` nunca se copia**. El `code`
  del contrato es el de los errores de dominio del workspace (spec `002`), con el que el frontend
  distingue cinco `409` distintos: dejar que una librería cualquiera lo rellene lo volvería inservible.
- **Deuda anotada, no cerrada**: `T-024` **no** corrió el e2e completo del API (`pnpm --filter
  @one-markdown/api test:e2e`) porque otros agentes estaban escribiendo en `test/**`; lo sustituyó por la
  regresión dirigida de 12 suites / 174 tests citada arriba. La corrida completa queda pendiente para el
  cierre de la ola 4 de la Fase 4 (ver `IMPLEMENTATION.md`).

## v0.1.5 — 2026-07-25

**Ampliación de AC-5 pedida desde la spec `002`** (ver `specs/002-workspace-tree/CHANGELOG.md` v0.2.0,
punto 1). Es aditiva: ningún comportamiento ya verificado de `AllExceptionsFilter` cambia.

- **`AllExceptionsFilter` no reconoce los errores de `http-errors`**, que es como Express y body-parser
  señalan los fallos de protocolo. El caso que lo destapó: con el límite de cuerpo JSON que la spec `002`
  sube a 2 MiB, un cuerpo por encima del límite produce un `PayloadTooLargeError` que **no es una
  `HttpException`** y por tanto sale como **`500`**, aunque el error traiga `status: 413`.
- **Dos consecuencias, y la segunda no es cosmética**: (a) el cliente recibe un `5xx` por un error suyo,
  o sea la única respuesta que le dice «reintenta, no es culpa tuya»; (b) el filtro registra `logger.error`
  **con traza completa** en todo lo que no es `HttpException`, así que cualquiera con un token válido
  dispone de un amplificador de ruido en los logs y de un disparador de alertas de `5xx`.
- **Corrección**, en `apps/api/src/common/filters/all-exceptions.filter.ts`, implementada por la tarea
  `T-024` de la spec `002` y verificada por su **AC-33**: antes de la rama genérica, un *type guard* que
  reconozca un error con `status`/`statusCode` **entero y en `4xx`** y lo emita con ese estado. El rango
  es deliberadamente estrecho: un `5xx` reportado por una librería debe seguir registrándose como error, y
  un `status` que no sea un entero solo puede venir de un fallo de programación. Un `Error` pelado sigue
  saliendo `500` con `message: 'Error interno del servidor'` y sigue pasando por `logger.error`; hay test
  unitario de los dos sentidos, para que la traducción no se coma los fallos que sí deben ser `5xx`.
- **Sin dependencias nuevas**: no se importa `http-errors` ni se usa `instanceof` contra ninguna clase de
  body-parser. `http-errors` es transitiva de Express, no una dependencia declarada del proyecto, y
  acoplarse a ella por tipo la convertiría en una de facto.
- **Higiene del propio artefacto**: la cabecera de `spec.md` se había quedado en `0.1.3` cuando este
  changelog ya iba por `0.1.4` (la v0.1.4 solo tocó decisiones y no se bajó el número al encabezado).
  Corregida a `0.1.5`, que es lo que exige la convención de que la versión sea de la **spec completa**.

## v0.1.4 — 2026-07-25

Tercera consecuencia de la decisión 2b (`packages/shared` compila a CommonJS), y la más cara de las tres,
descubierta al implementar el e2e de navegador de la spec `001`:

- **La aplicación web no arrancaba en un navegador real.** `packages/shared/dist/index.js` es CJS
  (`exports.isApiErrorShape = …`) y, siendo un paquete **enlazado del workspace**, Vite no lo
  pre-empaqueta por su cuenta: el `import { isApiErrorShape } from '@one-markdown/shared'` del cliente
  HTTP moría con `does not provide an export named 'isApiErrorShape'`.
- **Ningún test lo veía**: Vitest sobre jsdom y `apps/api` consumen CJS sin problema, `vite build` lo
  resuelve por Rollup, y el único test que abre un navegador de verdad (el smoke, AC-11) llevaba días en
  rojo por otro motivo. Es decir: el AC-11 existía justamente para atrapar esto y estaba tapado.
- **Mitigado en el consumidor**, sin tocar `packages/shared`: `optimizeDeps: { include:
  ['@one-markdown/shared'] }` en `apps/web/vite.config.ts`, verificado además con la caché de Vite en frío.
- **La solución de raíz sigue pendiente y es una decisión, no una tarea olvidada**: que `shared` emita
  también ESM (doble salida con `exports` en su `package.json`). No se hace ahora porque el CJS venía de
  evitar que `nest build` desplazara el `rootDir` (decisión 2b) y el arreglo actual deja los cuatro
  escenarios verdes. Se revisará cuando la spec `002` amplíe el contrato compartido.
- Lección repetida: **un test rojo tolerado tapa los fallos que ese test existía para encontrar.**

## v0.1.3 — 2026-07-24

Segunda corrección de la misma naturaleza que la v0.1.2 — algo que solo se ve desde un entorno limpio —
detectada al crear la primera migración en la spec `001`:

- **`prisma.config.ts` necesita `import 'dotenv/config'`**: Prisma 7 dejó de cargar `.env` de forma
  implícita, así que el CLI fallaba con
  `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`. En la spec `000` (T-009)
  esto no se notó porque la sesión tenía las variables exportadas en el shell. Añadido `dotenv@17.4.2`
  como devDependency de `apps/api` y `migrations.path` explícito en la config. Verificado con
  `context7` contra la doc actual de Prisma.
- **`prisma migrate dev` NO regenera el cliente** con esta configuración: tras aplicar la migración,
  `prisma.user` seguía sin existir hasta correr `prisma generate` aparte. Queda como paso explícito.

## v0.1.2 — 2026-07-24

Corrección de un defecto que **destapó el primer run real del CI** (run `30139345799`, en rojo): el AC-1
("clon nuevo → `pnpm install && pnpm typecheck` en 0") no se cumplía de verdad.

- `apps/api` y `apps/web` resuelven `@one-markdown/shared` por su `types: ./dist/index.d.ts`
  (decisión 2b de `plan.md`), así que en un clon limpio el typecheck fallaba con
  `TS2307: Cannot find module '@one-markdown/shared'` × 3. En local pasaba porque `packages/shared/dist`
  ya existía de builds anteriores: **el estado sucio del árbol tapaba el fallo**.
- Arreglo en los scripts de la raíz, no solo en el workflow, porque el AC-1 habla del clon nuevo: se añade
  `shared:build` y `typecheck`, `test` y `test:e2e` lo ejecutan antes. `build` ya funcionaba porque
  `pnpm -r build` respeta el orden topológico del workspace.
- Verificado borrando `packages/shared/dist` antes de cada comando: `pnpm typecheck` → 0 ·
  `pnpm test` → 0 (api 22, web 14, shared 11) · `pnpm lint` → 0 · `pnpm build` → 0.
- Lección: los comandos de verificación hay que correrlos también **desde un estado limpio**; un `dist/`
  o un `node_modules` heredado convierte un fallo real en un falso verde.

## v0.1.1 — 2026-07-24

Precisiones surgidas al implementar. Ningún criterio de aceptación cambió de significado, por eso es
un patch y no un minor.

- **Puerto de PostgreSQL en local: 5433** (no 5432). El 5432 de esta máquina ya estaba ocupado por un
  contenedor `postgres:13` de otro proyecto. Se ajustaron `docker-compose.yml` y el default de
  `DATABASE_URL` en `.mcp.json` para no apuntar por accidente a una base ajena. En CI se mantiene 5432.
- **Prisma 7 exige driver adapter**: `new PrismaClient()` sin adapter lanza `P2038`. Se añadieron
  `@prisma/adapter-pg` y `pg` al plan y a las dependencias. `prisma generate` sí funciona con un
  schema sin modelos, así que no hizo falta adelantar ningún modelo de `001-auth`.
- **Puerto por defecto del API: 3001** (no 3000). Al arrancar el proceso real dio `EADDRINUSE`: el 3000
  lo ocupaba una app Next.js de otro proyecto. Se ajustaron el default de `PORT` y el proxy de Vite.
- **`packages/shared` compila a CommonJS**; los tests de `apps/api` lo resuelven al fuente vía
  `moduleNameMapper`. Apuntar `main` al `.ts` habría desplazado el `rootDir` de `nest build`.
- Los DTO del backend ahora declaran `implements` contra los tipos de `@one-markdown/shared`: si el
  contrato y el DTO divergen, falla el typecheck en vez de fallar en runtime en el navegador.
- **TypeScript 5.9.3 quedó confirmado** con NestJS 11: decoradores y `emitDecoratorMetadata`
  funcionan, y el cliente generado por Prisma 7 pasa el modo estricto completo
  (`exactOptionalPropertyTypes` incluido). El riesgo #1 queda cerrado para esta fase.

## v0.1.0 — 2026-07-24

- Spec inicial (draft). Alcance: monorepo pnpm, `apps/api` (NestJS + Prisma + Redis + Swagger),
  `apps/web` (Vite + React + Tailwind + Router + Zustand), `packages/shared`, docker-compose de
  infraestructura local, endpoints de health/readiness con DTO, configuración validada al arranque,
  `ValidationPipe` global y CI.
- Versiones del stack fijadas contra npm el 2026-07-24 (ver `plan.md` §1).
- Decisión registrada: TypeScript se fija en **5.9.3** y no en el `latest` (7.0.2) por el riesgo de
  `emitDecoratorMetadata` con NestJS 11 (riesgo #1 de la spec).
- Decisión registrada: Prisma queda configurado y conectado, **sin modelos de negocio**; la primera
  migración pertenece a la spec `002-workspace-tree` (o a `001-auth` si el modelo `User` llega antes).

---

## Registro de implementación — movido desde `IMPLEMENTATION.md` (2026-08-03)

> Trasladado **literal**, sin podar. El documento de seguimiento había crecido a 3.317 líneas y había
> dejado de servir de índice; el detalle de cada feature pasa a vivir con su feature. Si algo de aquí
> repite lo que ya dice el historial de versiones de arriba, se recorta cuando se tengan los dos
> delante — no antes.


### Planificación de la spec

- [x] **spec 000-foundation** — `specs/000-foundation/` (`spec.md` v0.1.1 + `plan.md` + `tasks.md` + `CHANGELOG.md`), estado **implemented**. — 2026-07-24
      14 criterios de aceptación; 13 verificados con test automatizado, AC-14 (CI) pendiente de un run real.
      Verificado: ver Fase 2 y las notas de verificación al final.


### Fase 2 — Implementación de `000-foundation`


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
- [x] **T-015** · backend · CI en GitHub Actions (AC-14) — verificado el 2026-07-25
      **AC-14 cerrado con runs reales, las dos mitades**: run **`30140383389` en verde** en Node 22 **y** 24
      (`verify (node 22)` 1m47s, `verify (node 24)` 1m9s), y dos runs en rojo por fallos de verdad
      (`30139345799`, el defecto del AC-1; `30143727278`, el e2e de navegador). El job falla cuando algo
      falla y pasa cuando todo pasa: es exactamente lo que pedía el criterio.
      **De paso cierra el riesgo #3 de la spec `001`**: `bcrypt` 6 (módulo nativo) compila y funciona en
      Node 22 y 24 del runner, no solo en el Node 25 de esta máquina.
      `.github/workflows/ci.yml` escrito y parseado con js-yaml (13 pasos, matriz Node 22/24, servicios postgres+redis).
      **2026-07-24, primer run real** (`30139345799`, tras el push del usuario): **rojo** en `Typecheck`, en
      las dos versiones de Node. No fue un falso positivo del CI: era un defecto real del AC-1 (ver la nota
      de verificación abajo y `specs/000-foundation/CHANGELOG.md` v0.1.2). Con eso queda cubierta la mitad
      negativa del `DONE` (el job se pone rojo cuando algo falla), y con más valor que un test roto a mano.
      **Falta**: el run verde con el arreglo pusheado.
- [x] **T-016** · backend · Regla anti-`any` verificable con fixture de lint (AC-13)
      Con la regla desactivada el fixture sale 0; con la config del proyecto sale 1 con `@typescript-eslint/no-explicit-any` × 2. `pnpm lint` sigue en 0.


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


### Nota del índice — movida desde `specs/README.md` (2026-08-03)

El índice volvió a ser una línea por spec; esta era su fila, literal.

- **Feature**: Foundation — monorepo, tooling, health/DTO base, CI
- **Versión**: 0.1.7
- **Depende de**: —

**Estado tal como estaba escrito**: implemented — 14/14 AC (AC-5 ampliado en v0.1.5 y **cerrado en v0.1.6** por `T-024` de la spec `002`; **v0.1.7**: `optimizeDeps.force` en `vite.config.ts`, por `T-026` de la spec `002`)
