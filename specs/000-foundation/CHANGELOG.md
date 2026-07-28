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
