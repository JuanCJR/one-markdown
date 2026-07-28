# Changelog — Spec 002 Workspace tree

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.3.1 — 2026-07-25

**Patch de cierre definitivo.** `T-026` y `T-027` implementadas y verificadas: **AC-34 y AC-35 quedan
cubiertos** y la spec pasa a **35/35 AC · 27/27 tareas**, estado **complete**. No se añade alcance, no
cambia ningún endpoint, DTO, límite ni respuesta HTTP, y `plan.md` no se toca. Lo que sí hace este patch,
además de cerrar, es **corregir dos decisiones que había escrito el orchestrator** y dejar por escrito
**qué no queda con cobertura automática**.

### 1. Cierre de `T-026` (AC-34) — la caché de `optimizeDeps`

**RED de comportamiento, medido**: con el `--force` retirado de `playwright.config.ts` y
`@one-markdown_shared.js` sembrado sin `isWorkspaceTree` (`grep -c` → `0`) **sin tocar `_metadata.json`**,
`pnpm test:e2e` → `1 failed / 4 passed`, y el fallo es el correcto — snapshot con
`alert: Ocurrió un error inesperado…` **y** traza de red del mismo caso con `/api/workspace/tree | 200`.
El servidor respondía bien; quien fallaba era el bundle rancio.

**La demostración en tres pasos, que es la parte que vale.** Ese rojo, solo, deja viva la explicación
alternativa de que a la caché la salve después el `configHash` **nuevo** que introduce el propio cambio de
`vite.config.ts` —y no el `force`, que sería entonces decorativo—. Se descarta envenenando **contra ese
mismo `configHash`**:

1. `pnpm test:e2e` ya con `force: true` → **5 passed**; la caché queda reconstruida con el `configHash`
   nuevo.
2. Se envenena **esa** caché: `grep -c isWorkspaceTree` pasa de **2** a **0**, y `node --check` confirma
   que el fichero envenenado **sigue siendo JS válido** — el guard llega `undefined` y no hay error de
   parseo que enmascare el resultado por otra vía.
3. `pnpm test:e2e` → **5 passed**.

Con los hashes casando, lo único que puede salvar esa caché es `force`.

**Lo que no queda automatizado, y se escribe sin adornar**: el envenenado es **manual** y **CI no lo cazará
nunca** — el runner arranca siempre con `node_modules/.vite` frío, así que allí `force: true` y su ausencia
son **indistinguibles**. Lo que sí queda vigilando es la retirada del `--force`: si alguien quita el `force`
de `vite.config.ts`, `pnpm test:e2e` se rompe **en local** para cualquiera con caché previa, y en CI no. El
defecto vive en la máquina de quien desarrolla, que es justo donde CI no mira.

Entrada gemela de cierre en `specs/000-foundation/CHANGELOG.md` **v0.1.7** (`vite.config.ts` es contrato
de esa spec), igual que `T-024` la dejó en su v0.1.6.

### 2. Cierre de `T-027` (AC-35) — y dos correcciones de la decisión del orchestrator

**RED real, antes de tocar nada**:
`pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` → `10 failed /
5 passed`, con `POST /api/auth/register devolvió 429`. **DONE**: ese mismo comando → **15 passed**,
EXIT=0 · `pnpm test:e2e` → **5 passed** · `pnpm --filter @one-markdown/api test:e2e` → 20 suites / **455**.

**Corrección 1 — AC-35 no se cierra tocando solo `throttle:register:*`.** El reset hubo que aplicarlo
**también a `throttle:login:*`**. La cuenta real del escenario del AC (todos los casos agotando
`retries: 2`): smoke 3 casos × 3 intentos = **9** entradas, más el flujo de auth, que vuelve a entrar en
cada intento (**3**) → **12 contra un cupo de 10/min**. Ese gasto **ya existía** antes del cambio —el
`signIn` viejo también hacía `login` tras el `409`—; lo tapaba el `429` de `register`, que llegaba primero.
Medido: con el reset solo de `register`, el `DONE` seguía rojo con `POST /api/auth/login devolvió 429`.
Antes de neutralizarlo se verificó que el límite de `login` está cubierto en
`apps/api/test/auth-throttle.e2e-spec.ts`, así que **la cobertura perdida es cero**. Redacción de AC-35 y
del enunciado de `T-027` corregida en consecuencia.

**Corrección 2 — `global-setup.ts` no estaba en la lista de archivos de `T-027` y tenía que estar.** La
cuenta compartida se crea **una sola vez**, antes de que arranque ningún caso. El motivo es un efecto de
segundo orden que la decisión «login antes de registrar» arrastraba y que la cuenta no contemplaba: si cada
caso prepara la cuenta por su lado, en una base limpia **todos** los trabajadores empiezan con un `login`
fallido contra una cuenta que aún no existe, y **5 fallos bloquean la cuenta 15 minutos**
(`LoginAttemptService`, spec `001`). Ese bloqueo es **por cuenta, no por IP**, así que ningún reset de
`throttle:*` lo evita; en local Playwright levanta **6** trabajadores y era una moneda al aire. Hacerlo una
sola vez lo elimina **por construcción** y de paso baja el gasto del smoke de **3 altas a 0**. Verificado en
el bundle de Playwright 1.62 (`runner/index.js`, `createGlobalSetupTasks`) que los plugins de `webServer`
corren **antes** de `globalSetup`, así que el API ya responde; `signIn` conserva un camino de reserva.

**Lo que cuesta en cobertura, escrito en `spec.md` y no solo aquí**: la suite de navegador **ya no detecta
los límites de `register` ni de `login`** —los neutraliza a propósito—, y **el bloqueo por cuenta tampoco lo
ejercita**, ni antes ni ahora (se evita por construcción, no se neutraliza). Quien verifica los dos límites
es `apps/api/test/auth-throttle.e2e-spec.ts`, un caso por cada uno, y el bloqueo por cuenta
`apps/api/test/auth-login.e2e-spec.ts`. **No se aplicó ningún reset en la suite del API** —verificado:
`grep -rn "throttle:" apps/api/test/` no devuelve nada— y queda una nota en
`apps/web/e2e/support/services.ts` diciendo que no se haga: allí destruiría la prueba de que el límite
existe.

Entrada gemela de cierre en `specs/001-auth/CHANGELOG.md` **v0.1.1** (el andamiaje e2e es de esa spec).

### 3. Cifras finales de la spec

Tomadas de una vez, tras `rm -rf packages/shared/dist` + rebuild:

| Suite | Resultado |
|---|---|
| `pnpm --filter @one-markdown/shared test` | **65 passed** |
| `pnpm --filter @one-markdown/web test` | 12 archivos, **188 passed** |
| `pnpm --filter @one-markdown/api test` | 19 suites, **264 passed** |
| `pnpm --filter @one-markdown/api test:e2e` | 20 suites, **455 passed** |
| `pnpm test:e2e` (Playwright) | **5 passed** |
| `playwright test --retries=2 --repeat-each=3` | **15 passed** |
| `pnpm typecheck` · `pnpm lint` (raíz) | exit 0 |
| `prettier --check` | limpio |

### 4. Higiene de artefactos

`tasks.md` llevaba las **27** casillas vacías mientras el check-off vivía solo en `IMPLEMENTATION.md`. Era
una inconsistencia y no una convención —la spec `001` sí las marca—, así que se marcan aquí, en una sola
pasada y contra el registro de verificación de la Fase 4. La cabecera de `tasks.md` pasa a `v0.3.1`.

**Por qué es un patch y no un minor, con la duda escrita.** No entra alcance nuevo: AC-34 y AC-35 ya
existían desde la v0.3.0 y lo que cambia es su **precisión** —AC-35 nombra ahora los dos contadores y el
efecto de segundo orden que no se había previsto— más el cierre de las dos tareas. Ningún comportamiento
observable ya implementado cambia: los límites de producción (`THROTTLE_LIMITS`) están intactos, y lo que se
tocó es andamiaje de test y una opción del servidor de desarrollo. Lo discutible es que `force: true`
**sí** cambia algo observable para quien desarrolla —re-empaqueta todas las dependencias en cada arranque—;
se acepta como patch porque el cambio de comportamiento ya estaba especificado y aprobado en AC-34 desde la
v0.3.0, y esta versión solo lo implementa.

## v0.3.0 — 2026-07-25

**Minor de cierre.** Cierra las **25 tareas** y los **33 AC del alcance aprobado**, corrige una
contradicción de redacción en **AC-32** y añade **alcance nuevo de endurecimiento** (**AC-34**, **AC-35**;
tareas `T-026`, `T-027`) salido de ejecutar el recorrido en un navegador real. Ningún AC anterior cambia de
significado, ningún endpoint, DTO, límite ni respuesta HTTP se toca. **`plan.md` no se modifica**: los dos
AC nuevos no alteran arquitectura ni contratos —viven en `vite.config.ts` y en el andamiaje de la suite
e2e—, y su estrategia de test va entera en `tasks.md`.

### 1. Cierre de `T-020`, `T-021` y `T-023`, y con ellas de la spec

Cifras finales, corridas **por el orchestrator** con `apps/web` ya libre de agentes:

| Suite | Resultado |
|---|---|
| `pnpm --filter @one-markdown/web test` | 12 archivos, **188 passed** (venía de 169) |
| `pnpm --filter @one-markdown/api test` | 19 suites, **264 passed** |
| `pnpm --filter @one-markdown/api test:e2e` | 20 suites, **455 passed** |
| `pnpm --filter @one-markdown/shared test` | **65 passed** |
| `pnpm test:e2e` (Playwright) | **5 passed** |
| `pnpm typecheck` · `pnpm lint` (**raíz**, los tres paquetes) | exit 0 |

Decisiones de `T-020`/`T-021` que se registran por ser decisiones y no detalles:

- **`ModalDialog.tsx`**, caparazón compartido que `tasks.md` no nombraba: `role="dialog"`, `aria-modal`,
  foco atrapado, `Escape` y devolución del foco al elemento que abrió. A mano y **sin librería porque
  `jsdom` no implementa el modo modal de `<dialog>`** — con el elemento nativo los tests no habrían podido
  comprobar nada de lo que AC-29 exige. Los cuatro diálogos lo usan.
- **El formulario de creación va en un modal, no *inline* en la fila**: un `<form>` dentro del
  `role="tree"` rompería el patrón WAI-ARIA, que solo admite `treeitem`/`group` como descendientes.
- **Dos añadidos al store de `T-018`**, que es contrato de otra tarea y por eso importa el porqué: la
  acción `expand(id)` idempotente, y un `mutate` que acepta `{ reloadOnError }` y que **solo** pasan
  `moveDirectory`/`moveDocument`. Motivo: AC-30 exige recargar el árbol ante `409` **y** `404`, mientras
  que el `mutate` genérico recarga solo ante `404` — y AC-29 necesita ese contrato **intacto** para su
  caso «el `409` no cambia el árbol». Ampliar `mutate` para todos habría hecho pasar AC-30 rompiendo
  AC-29. Ningún test de `T-018` se tocó y los 21 siguen verdes.
- **«Nuevo en la raíz» va DESPUÉS del árbol en el DOM.** Puesto antes, robaba la primera parada de
  tabulación al roving tabindex de `T-019` y rompía **10** tests de teclado. Se arregló **moviendo el
  botón**, no ajustando aquellos tests, que es la parte que vale la pena registrar: el rojo estaba
  diciendo la verdad.
- **Borrar el documento abierto saca de la ruta.** Tras un borrado con éxito, si el id de `/documents/:id`
  ya no está en `documentsById` **tras la recarga**, se navega a `/`. La comprobación es *post-recarga* y
  **no** por «id borrado», así que cubre también borrar el **directorio** que lo contenía — un caso que la
  comprobación ingenua se habría dejado. Lo hace el árbol; `DocumentViewPage` sigue sin escuchar el store.
  **Con esto se cierra la deuda funcional que dejó `T-022` explícitamente.**
- **Un error de mutación cierra el diálogo** y lleva el foco al `role="alert"` que ya existía en el árbol
  (no a un tercer contenedor). Consecuencia asumida y escrita: **se pierde el texto tecleado**.

`T-023` no tenía rojo natural —la UI ya existía— y el agente lo resolvió como debía: **tres mutaciones de
control, una por eje del recorrido**, todas revertidas y verificadas con `grep`. (a) forzar
`recursive=false` → `Expected: 1 · Received: 3` treeitems; (b) un `console.error` al abrir un documento →
el aserto de consola lo caza; (c) `onMove(node.parentId)` en vez del destino elegido → `aria-level`
`Expected: "1" · Received: "3"`. Un solo control habría dejado dos ejes sin demostrar.

### 2. `AC-32` decía «el árbol queda vacío» y su propio recorrido lo impide (patch)

**La contradicción**: `spec.md` AC-32 terminaba con «entonces el árbol queda vacío»; `tasks.md` `T-023`
decía «al final el árbol solo tiene el documento movido». Con el recorrido tal como está escrito —el
documento se mueve **a la raíz antes** de borrar el directorio— el árbol **no puede** quedar vacío. Se
implementó lo de `tasks.md`.

**Gana `tasks.md`, y no solo por ser lo implementado**: que el documento **sobreviva** al borrado
recursivo es justo la prueba de que la cascada del servidor se lleva el subárbol y **solo** el subárbol.
Un recorrido que acabara con el árbol vacío probaría menos.

**Matiz que se sube a la spec porque el test lo documentaba y la spec no**: «comprueba su contenido» **no
puede significar texto**. Un documento creado desde la interfaz nace **sin contenido** —el store manda
solo `title`/`directoryId` al crear y el `PATCH` solo acepta `title`; el editor es la spec `003`, ver §4—.
Lo comprobado al abrirlo es la URL `/documents/:uuid`, el `aria-selected` de su fila, el `h2` con el
título, el breadcrumb **de un solo paso** (la prueba de que la mudanza a la raíz llegó al **servidor** y no
solo al estado del cliente) y la región `Markdown en crudo` **visible y vacía**: un hueco ausente y un
contenido vacío se distinguen, y solo el primero sería un defecto.

### 3. `AC-34` — la caché de `optimizeDeps` sirve un `@one-markdown/shared` rancio (minor)

Defecto **medido**, no supuesto: recién registrado, el árbol moría con «Ocurrió un error inesperado»
**pese a que `GET /api/workspace/tree` respondía `200`**. Causa instrumentada:
`TypeError: guard is not a function` en `expectShape`, porque el navegador recibía un `shared` **sin**
`isWorkspaceTree`. `packages/shared/dist` estaba al día; lo rancio era
`apps/web/node_modules/.vite/deps/@one-markdown_shared.js`, del tiempo de la spec `001`
(`grep -c isWorkspaceTree` → `0`).

**Mecanismo exacto, verificado con `context7`** contra `optimizer/index.ts` y `guide/troubleshooting.md`
de Vite: la caché se invalida comparando `lockfileHash` y `configHash`, y la documentación dice
literalmente *«Vite detects dependency overrides but not `npm link` usage»*. O sea que **no** es que Vite
hashee el `package.json` del paquete enlazado —esa fue la primera hipótesis, y lleva a buscar el arreglo
donde no está—: **no mira el paquete en absoluto**. Consecuencia: cualquiera con un `pnpm dev` anterior a
la spec `002` ve el árbol roto hasta borrar `node_modules/.vite` a mano.

**Mitigado hoy solo para la suite** con `pnpm dev --force` en `playwright.config.ts` (única línea de
configuración que tocó `T-023`, y sin ella la suite no es reproducible). **Decisión de fondo, tomada aquí**:
se fuerza en `apps/web/vite.config.ts` y `playwright.config.ts` vuelve a `pnpm dev` a secas, para que la
suite deje de compensar un defecto del producto. Las alternativas quedan descartadas con motivo:
*publicar `shared` en ESM* es el arreglo de raíz pero `apps/api` es NestJS **CommonJS** sobre el mismo
`dist` y exige salida dual o mover el backend a ESM —spec propia, no un cierre de fase—; *documentarlo
como paso manual* se descarta porque el defecto se presenta como «el árbol está roto» con un mensaje que
apunta al servidor. Coste asumido: `force: true` re-empaqueta todas las dependencias en cada arranque de
desarrollo. Tarea `T-026`, con **RED de comportamiento** (envenenar la caché y ver fallar la app): un test
que lea el config y afirme que dice `force: true` sería una tautología.

### 4. `AC-35` — el presupuesto de altas de la suite está agotado al milímetro (minor)

`register` permite **5 por IP cada 15 min** y una ejecución limpia gasta **exactamente 5**: `smoke` 3
(su `beforeEach` llama a `signIn`, que hace `POST /register` en cada caso aunque le devuelvan `409`),
`auth` 1 y `workspace` 1. **Con `retries: 2` en CI, el primer reintento pide la sexta y recibe un `429`** —
un rojo ajeno a lo que la suite mide y que aparecerá justo cuando algo ya haya ido mal.

El agente lo **reportó en vez de arreglarlo**, que es lo correcto: toca `support/session.ts`, andamiaje de
la spec `001`. **Decisión, tomada aquí: se aplican las dos medidas**, porque la barata sola no basta.
Intentar `login` antes de registrar baja el gasto de 5 a 3, pero **no cierra AC-35**: con `retries: 2` los
dos casos que estrenan cuenta piden alta nueva en cada intento (1+2 y 1+2 = 6, otra vez por encima de 5).
Lo que sí lo cierra es **poner a cero el contador `throttle:register:*` antes de cada caso que registre**,
por el mismo camino RESP-sobre-TCP que ya usa `global-setup` (sin dependencias nuevas: `plan.md` §1 sigue
intacto). Se acepta a sabiendas de que la suite de navegador deja de poder detectar ese límite: **quien lo
verifica es `apps/api/test/auth-*.e2e-spec.ts`**, que es su sitio — un límite por IP se prueba contra el
API, no a través de un navegador. Tarea `T-027`, y el razonamiento va escrito **en el propio archivo**
porque el atajo de mañana es aplicar el mismo reset en la suite del API, donde sí destruiría la prueba.

### 5. Dos cosas que el navegador enseñó y que **no** abren tarea

- **El `role="tree"` vacío no existe para el usuario**: sin filas no ocupa un píxel y Playwright lo da por
  `hidden`, así que `toBeVisible()` sobre el árbol vacío es un aserto **imposible** (se usa
  `toBeAttached()`). **No es un fallo de accesibilidad** —el mensaje «Todavía no hay directorios ni
  documentos.» sí se ve, aunque viva fuera del árbol, y un árbol sin nodos no tiene ninguna parada de
  tabulación que ofrecer—, pero se escribe en AC-32 porque en JSDOM no se veía: allí `toBeVisible` no
  calcula *layout* y la aserción imposible habría pasado.
- **El aviso genérico de la UI oculta los fallos del cliente** (riesgo **#15**, nuevo): «Ocurrió un error
  inesperado» se le enseña a la persona igual si el servidor devolvió `5xx` que si el código del navegador
  reventó por su cuenta — que es exactamente lo que pasó con la caché rancia, con la petición en `200`.
  **A propósito sin tarea**: distinguir «el servidor dijo que no» de «el cliente se rompió» obliga a
  decidir qué se le enseña a la persona en cada caso, y eso es producto, no corrección de un defecto. Se
  deja escrito para que lo herede la spec que toque el manejo de errores de la UI (`003` es la primera
  candidata), con el caso real ya documentado. Lo que sí entra ya, por AC-34, es que la causa concreta
  deje de ocurrir.

Se añade además el riesgo **#16**: `vite.config.ts` es de la spec `000` y `e2e/support/*` de la `001`, así
que `T-026` y `T-027` heredan la regla de `T-004` y `T-024` — si un test de otra spec se pone en rojo, se
para y se reporta, y el cierre deja entrada en el CHANGELOG de la spec dueña del archivo.

## v0.2.3 — 2026-07-25

**Patch**: se corrige un **error de criterio** en el RED de `T-025` que escribió la v0.2.2 —el filtro con
el que se derivan las rutas que declaran `404`— y se cierran `T-025` y `T-022`. No cambia ningún AC, ningún
DTO, ningún límite y ninguna respuesta HTTP: la decisión de la v0.2.2 (que `/tree` no declare `404`) sigue
siendo exactamente la misma, lo que se corrige es **cómo se deriva la lista de las otras nueve**.

### 1. `T-025`: el filtro por `{id}` en la ruta da **siete**, no nueve

**Lo que decía el RED de la v0.2.2**: las nueve rutas que declaran `404` se derivan de `WORKSPACE_ROUTES`
«filtrando por `{id}` en la ruta».

**Ese filtro da siete.** Los dos `POST` de creación —`POST /api/workspace/directories` y
`POST /api/workspace/documents`— **también** emiten `404`, con `code` `PARENT_NOT_FOUND` (padre inexistente
o ajeno), y **no** llevan `{id}` en la plantilla: reciben el id del recurso padre **en el cuerpo**
(`parentId` / `directoryId`). `plan.md` §4 lo lista desde la v0.1.0 en las líneas de errores de esos dos
endpoints.

**Consecuencia si se hubiera seguido al pie de la letra**: el ancla `toHaveLength(9)` habría fallado con la
lista en 7, o sea un rojo **por la razón equivocada** —el error estaba en el filtro, no en el contrato— en
la única tarea de la spec cuyo rojo esperado es exactamente uno y está escrito por adelantado. Un rojo que
no es el que la tarea predijo obliga a parar y reportar, que es justo lo que el propio RED exige.

**Cómo lo resolvió el agente, y por qué se acepta**: tomó el ancla `toHaveLength(9)` como la expresión de
la intención —nueve = diez menos `/tree`— y derivó por **complemento de `/tree`** en vez de por presencia de
`{id}`. Las dos listas quedan ancladas (`toHaveLength(9)` y `toHaveLength(1)`), el único elemento del
complemento se afirma por igualdad, y no hay ninguna segunda lista escrita a mano: ningún `it.each` puede
recorrer cero casos y pasar por vacuidad. Es el criterio correcto y además el más estable — «resuelve algún
id de recurso» es una propiedad del contrato, y «lleva `{id}` en la plantilla» es una propiedad de la
sintaxis de la URL, que no es lo mismo.

**Criterio corregido en `tasks.md`**: «todas las rutas del tag **menos** `GET /tree`», que es «las que
resuelven un id de recurso — siete desde la plantilla de ruta y dos desde el cuerpo».

**Es el tercer error de cuenta de esta misma spec, y del mismo género**: los «seis» endpoints con parámetro
de ruta que eran siete (v0.2.2 §2) y los siete DTO de entrada que sí eran siete pero no estaban derivados
(v0.2.2 §3). La lección es la misma las tres veces: **una cifra escrita en prosa no vale; vale la cifra
derivada de una constante y anclada con un `toHaveLength`**, porque entonces el error de cuenta se
manifiesta como un rojo en vez de como un test que pasa midiendo otra cosa.

### 2. Cierre de `T-025` y `T-022`

- **`T-025`** — `@ApiNotFoundResponse` fuera de `workspace.controller.ts`. RED real: un solo fallo y en
  negativo (`Expected value: not "404" / Received array: ["200","401","404","429"]`). Verificación en
  `IMPLEMENTATION.md`; la corrió el orchestrator, no el agente. **Con esto el backend de la spec queda
  completo**: `T-001`…`T-016`, `T-024` y `T-025`.
- **`T-022`** — ruta `/documents/:id` con vista en crudo (AC-31). Dos cosas quedan registradas en
  `IMPLEMENTATION.md` porque son de diseño y no de trámite: el **título** de la vista sale del documento
  cargado por `GET` y no de `documentsById` (entrar por URL directa tiene que funcionar sin árbol), mientras
  que la **ruta del breadcrumb** sí sale de `directoriesById`; y enganchar `useNavigate()` en el árbol
  acopló los 19 tests de `T-019` a un `<Router>`.

## v0.2.2 — 2026-07-25

**Patch**: se resuelve una **contradicción interna** entre `spec.md` AC-26 / `tasks.md` T-015 y `plan.md`
§4, y se corrige un **error de cuenta** en el RED de `T-012`. No cambia ninguna respuesta HTTP, ningún
límite, ningún DTO y ningún AC de comportamiento.

### 1. El `404` de `GET /api/workspace/tree`: gana `plan.md` §4

**Lo que decía cada artefacto.** AC-26 y el RED de `T-015` piden que las **diez** rutas de
`/api/workspace/*` documenten `401`, `404` y `429`. `plan.md` §4, que enumera los errores **ruta por ruta**
desde la v0.1.0, lista los de `/tree` como «`401` · `429`», sin `404`. Lo destapó `T-015` al implementarlo.

**Decisión: AC-26 se acota a las nueve rutas que resuelven un `:id`.** `/tree` no declara `404`.

**Motivos**, en orden de peso:

1. **La ruta no puede emitir un `404`.** No resuelve ningún `:id`; el único recurso que devuelve es el
   workspace del portador del token, que siempre existe, y un workspace vacío responde `200` con las dos
   listas vacías. No hay entrada del cliente capaz de producir un «no encontrado».
2. **`plan.md` §4 no es uniforme por tag, y no lo es a propósito.** Enumera los errores endpoint por
   endpoint, con su `code` de dominio: no todas las rutas listan `400`, no todas listan `409`, y cada
   `404` va con su `DIRECTORY_NOT_FOUND` / `PARENT_NOT_FOUND` / `DOCUMENT_NOT_FOUND`. El argumento de
   «que el contrato de error del tag sea uno solo» describe un contrato que esta spec nunca tuvo.
3. **Documentar una respuesta inexistente es la misma clase de defecto que corrigió la v0.2.0**, donde se
   decidió arreglar el comportamiento en vez de canonizar el `500` del límite de cuerpo. Aquí es el
   sentido inverso y la misma regla: el documento describe lo que el API hace. Una descripción en prosa
   que avisa de que «esta ruta no lo emite hoy» **no es legible por máquina** — un cliente generado del
   OpenAPI se lleva igualmente una rama de error muerta.
4. **El `404` de ruta inexistente de Nest no es una respuesta de la operación**, y confundir esos dos
   `404` ya costó caro en esta fase: es el falso RED de `T-007` (`18 failed, 2 passed`) y la razón por la
   que la matriz de `T-012` tiene que afirmar el `code` y el juego exacto de claves. Declarar un `404` en
   la única ruta cuyo `404` solo puede venir del framework consagra justo esa confusión.

**Lo que hizo `T-015` y por qué no se le reprocha**: siguió el AC —que es lo correcto— y, en vez de callar
la discrepancia, declaró el `404` con una descripción que dice explícitamente que forma parte del contrato
común del tag y que la ruta no lo emite. Reportó la contradicción en lugar de elegir por su cuenta entre
dos artefactos aprobados. La decisión era del orchestrator y es ésta.

**Consecuencia de código**: la retirada de `@ApiNotFoundResponse` de `WorkspaceController` es una tarea de
implementación, **`T-025`**, con su RED —el caso en negativo «`/tree` no declara `404`», que es lo único
que impide que la declaración vuelva a colarse— y su `DONE`. No se hace desde el seguimiento.

**Por qué es patch y no major.** La regla de versionado llama major a «cambia el comportamiento observable
ya implementado». Aquí no cambia ninguna respuesta HTTP: `/tree` nunca emitió un `404` y no lo emitirá.
Cambia una clave del documento OpenAPI que describía algo que no ocurre, y no hay consumidor de ese
documento (el contrato que consume la web es `packages/shared`, escrito a mano, y no declara errores por
ruta). Lo que se corrige es la **precisión de un criterio** contra el artefacto que ya era preciso, que es
literalmente la definición de patch de este proyecto. Queda anotado que el efecto colateral —retocar un
test de `T-015`, que está en verde— es lo que hace el caso discutible; se registra aquí en vez de
resolverse en silencio.

### 2. `T-012`: eran **siete** endpoints con parámetro de ruta, no seis

El RED de `T-012` decía «un `:id` que no es uuid → `400` en los **seis** endpoints con parámetro de ruta».
Son **siete**: tres de directorios (`PATCH`, `move`, `DELETE`) y cuatro de documentos (`GET`, `PATCH`,
`move`, `DELETE`). El test ya lo ancla con `expect(PATH_PARAM_ENDPOINTS).toHaveLength(7)`, derivando la
lista de la constante de los diez endpoints en vez de escribirla aparte; corregido el texto de `tasks.md`
para que coincida con lo verificado.

### 3. Dos precisiones de exactitud sobre artefactos reales

- **Trazabilidad de AC-21**: la tabla de `spec.md` §6 apuntaba a un `apps/api/src/workspace/
  workspace.service.spec.ts` que no existe. Los archivos reales son `directories.service.spec.ts` y
  `documents.service.spec.ts` — el tope de nodos afecta al alta de los **dos** tipos, y `tasks.md` ya lo
  decía así. Corregida la tabla.
- **`tasks.md` T-015**: se anota que los «siete DTO de entrada» no son un número escrito a mano — el test
  los deriva con `readdirSync` sobre `src/workspace/dto`, así que un octavo DTO sin documentar rompe la
  igualdad. Y que un `@Query()` con DTO se publica **explotado en parámetros sueltos**, de modo que la
  clase nunca llega a `components.schemas` por sí sola: hace falta `@ApiExtraModels`.
- **`plan.md` §4** y el encabezado de `tasks.md` pasan a referenciar `spec.md` v0.2.2 (venían de v0.2.0).

## v0.2.1 — 2026-07-25

**Patch**: se cierra **AC-33** / **`T-024`** —el `413` del límite de cuerpo ya es un `413`— y se registra
**cómo quedó la detección**, que es la pieza que se erosiona si nadie la escribe. Ningún AC cambia de
significado, ningún límite cambia y ningún contrato se toca: la v0.2.0 prometía este comportamiento y esta
entrada dice con qué regla exacta se cumple y con qué se verificó.

### 1. AC-33 verificado

`pnpm --filter @one-markdown/api test all-exceptions` → **1 suite / 12 tests** ·
`pnpm --filter @one-markdown/api test:e2e "body-limit|validation"` → **2 suites / 11 tests** · suite
unitaria completa del API → **18 suites / 255 tests** · regresión dirigida
`test:e2e "auth-|health|swagger"` → **10 suites / 163 tests**, **ningún test de `000` ni de `001` en
rojo**, que era la condición explícita de la tarea por tocar `apps/api/src/common/filters/`. Archivo e2e
nuevo: `apps/api/test/body-limit.e2e-spec.ts`. Entrada de cierre en `specs/000-foundation/CHANGELOG.md`
v0.1.6, como exigía la v0.2.0.

### 2. La regla de detección, escrita para que no se afloje sola

- **Duck typing sobre `status` y `statusCode`** (`http-errors` pone las dos), y solo pasa un valor que
  cumpla `Number.isInteger(value) && value >= 400 && value <= 499`. El rango es **cerrado**: la regla no
  es «el error trae un `status`», y la diferencia no es cosmética. Un `status` no entero solo puede venir
  de un error de programación y no puede decidir el código de una respuesta; y con la regla laxa,
  cualquier `5xx` —o un `200`— de una librería se saltaría el `logger.error`, que es la señal que no se
  puede perder. Casos cubiertos por test: `'nope'`, `413.5`, `NaN`, `null`, `true` (no enteros) y `399`,
  `200`, `0`, `-1`, `600` (fuera de rango).
- **Sin `import` de `http-errors`** y sin `instanceof`, como prometía la v0.2.0: la dependencia sigue
  siendo transitiva de Express y la regla de cero dependencias nuevas (`plan.md` §1) sigue intacta.
- **Un `status: 502` no entra en el rango**: cae al `500` genérico y **sigue** pasando por `logger.error`
  con traza. Lo sostiene el otro cambio de la tarea: la decisión de registrar dejó de depender del
  **origen** (`!isHttp || status >= 500`) y ahora depende del **estado** (`status >= 500`). Un `4xx` es un
  fallo del cliente lo emita quien lo emita, así que el `413` deja de escribir traza —que era el defecto
  operativo del punto 2 de la v0.2.0— sin que ningún `5xx` deje de registrarse. Las dos mitades tienen
  test.
- **Del error ajeno solo se publica `message`, y solo si es texto; `code` nunca se copia.** El `code` del
  contrato es el de los errores de dominio de esta spec, con el que el frontend distingue cinco `409`
  distintos: si una librería cualquiera pudiera rellenarlo, ese campo dejaría de servir para lo único
  para lo que existe.

### 3. Lo que el agente **no** inventó, y conviene que quede escrito

El enunciado de `T-024` incluía el `code?: string` de `ApiErrorShape`, pero esa mitad ya la había cerrado
`T-004`. El agente lo comprobó, lo reportó y **no fabricó un RED** para una parte ya en verde. Es la
conducta que este seguimiento pide: un rojo inventado para cumplir el guion es exactamente el falso
positivo que la Fase 3 aprendió a detestar.

## v0.2.0 — 2026-07-25

**Minor**: se añade alcance —**AC-33** y la tarea **`T-024`**— sin romper nada de lo ya implementado.
Ningún AC anterior cambia, ningún límite cambia y ningún contrato ya en verde se toca. El resto de la
entrada son precisiones de exactitud (patch) que se recogen aquí porque van en la misma versión.

### 1. El `413` del contrato no existía: hoy sale `500`. Se arregla el comportamiento, no el contrato

`plan.md` §4 promete desde la v0.1.0 un **`413`** para un cuerpo por encima de `JSON_BODY_LIMIT`. Lo
medido al implementar `T-008` es un **`500`**: el `PayloadTooLargeError` de body-parser **no es una
`HttpException`**, así que `AllExceptionsFilter` cae a su rama genérica, aunque el error traiga
`status: 413`. Con el límite en 2 MiB y un tope de contenido de 200.000 caracteres, el caso queda **fuera
del alcance de todos los tests de esta spec**, que es exactamente por lo que llevaba escrito desde el
principio sin cumplirse.

Había dos salidas y **se elige arreglar el filtro** (AC-33 + `T-024`) en vez de reescribir el contrato a
`500`. El motivo, en orden de peso:

1. **`500` es la respuesta incorrecta y escribirla en el contrato sería canonizar un defecto.** Un cuerpo
   demasiado grande es un error del cliente: el `4xx` es lo que le dice que reintentar igual no sirve.
   Un cliente escrito contra un `500` documentado tratará el caso como fallo del servidor —reintento,
   alerta— y habrá que romperle el contrato el día que se arregle de verdad.
2. **No es solo cosmético: hoy cada cuerpo grande escribe un `logger.error` con traza completa**, porque
   el filtro registra a nivel `error` todo lo que no es `HttpException`. Es decir, cualquiera con un token
   válido tiene un amplificador de ruido en los logs y un disparador de alertas de `5xx` gratis. Eso es un
   defecto operativo pequeño pero real, no una discrepancia de documentación.
3. **Un pendiente sin tarea y sin test es como desaparece la deuda en este proyecto.** La lección de la
   Fase 3 —«la verificación existía, pero no verificaba»— se repite aquí en su forma más pura: el contrato
   existía y nadie lo comprobaba. La corrección tiene que llegar con su AC y su comando, o no llega.

**Coste asumido y registrado**: `AllExceptionsFilter` es de la spec `000` (AC-5), así que `T-024` toca
contrato ajeno y deja entrada en `specs/000-foundation/CHANGELOG.md` (v0.1.5) además de en este. Se le
aplican las mismas reglas que a `T-004`: si cualquier test de `000` o `001` se pone en rojo, se para y se
reporta. La traducción se acota a un `status` **entero y en `4xx`** para que un `5xx` reportado por una
librería siga registrándose y un `Error` pelado siga siendo `500`; `T-024` lo prueba en los dos sentidos.
Sin `import` de `http-errors`: es transitiva de Express, no una dependencia declarada, y la regla de cero
dependencias nuevas sigue intacta.

Artefactos tocados: `spec.md` (AC-33, riesgo #7 corregido, trazabilidad), `plan.md` (§1 y §4),
`tasks.md` (`T-024`).

### 2. Tres desviaciones de `T-006`/`T-007`/`T-008` que pasan del código a la spec

Verificadas contra el código real antes de escribirlas, no contra el informe de los agentes:

1. **La transacción `Serializable` vive en el repositorio, no en el servicio** (`plan.md` §2 decisión 7 y
   §6): `inSerializableTransaction(scope, run)` con la interfaz `WorkspaceTreeTransaction`
   (`listDirectoryRefs` / `findDirectory` / `moveDirectory`, las tres con el `userId` cerrado dentro). La
   **decisión** —ciclo, profundidad, no-op— sigue en `directories.service.ts`. Es la única forma de
   cumplir a la vez la decisión 7 («el move va en `$transaction`») y el invariante de la decisión 14 que
   `workspace-data-access.spec.ts` comprueba de forma mecánica: con el `$transaction` en el servicio,
   `PrismaService` dejaría de aparecer en un solo archivo del módulo.
2. **El no-op del move no escribe** (`plan.md` §4): mover un directorio al padre que ya tiene devuelve la
   fila leída dentro de la transacción, **sin `update`**, y se verifica con `updatedAt` idéntico.
   `tasks.md` decía «`200` sin cambios» y esta es su lectura estricta. Queda escrito porque es **contrato
   observable**: un `update` idéntico habría movido `updatedAt` y le habría dicho al cliente que el
   directorio cambió cuando no cambió nada, y `003-editor` va a leer esas marcas de tiempo.
3. **Cuatro piezas reutilizables que §6 no listaba** y que las tareas pendientes reimplementarían con otro
   nombre: `DirectoryNotEmptyError` (`workspace.errors.ts`), `countDirectoryChildren(scope, id)` en el
   repositorio (subdirectorios + documentos, con `userId` en **los dos** `where`), `toStrictBoolean`
   (exportado desde `dto/delete-directory.query.dto.ts`) y `JSON_BODY_LIMIT` (`workspace.constants.ts`)
   aplicado en `bootstrap.ts`. Este último con su motivo: se fija con un *type predicate*
   (`isBodyParserCapable`) en vez de cambiar la firma `INestApplication` de `configureApp`, porque ese
   cambio habría obligado a tocar los cinco archivos e2e que ya la llaman en mitad de la fase y con otros
   agentes escribiendo en `test/**`; y **lanza al arrancar** si la app no fuera Express, en vez de saltarse
   el límite en silencio y dejar que AC-13 falle por un motivo ajeno al dominio.

### 3. `T-012` exige afirmar el `code` en cada `404`, no solo el estado

Del RED de `T-007`, que en su primera pasada dio `18 failed, 2 passed`: los dos «verdes» eran los dos
casos que esperaban `404`, y **pasaban por el motivo equivocado** —Nest ya devuelve `404` para una ruta
que no existe—. Se endurecieron con `expect(response.body.code).toBe('DIRECTORY_NOT_FOUND')` y el rojo
quedó completo. `T-012` es una **matriz entera** de `404` sobre diez endpoints, donde esa confusión no se
ve a ojo, así que el requisito pasa a estar escrito en su RED en vez de depender de que el agente se
acuerde de la regla general.

## v0.1.1 — 2026-07-25

**Patch**: tres correcciones de exactitud y de coherencia interna con la Fase 4 ya en marcha (T-001…T-005
hechas y verificadas). **Ningún AC cambia, ningún límite cambia, ningún contrato cambia y `spec.md` no
cambia de contenido**; el número de versión es de la spec completa, para que los cuatro artefactos sigan
apuntando al mismo sitio.

1. **`plan.md` §1 y §2 (decisión 8): `meta.target` no existe en este stack.** Las dos secciones describían
   la traducción de un `P2002` leyendo `meta.target`, que es lo que dice la documentación clásica de
   Prisma. Verificado empíricamente por el agente de `T-004` **contra la base real** con Prisma 7.9 +
   `@prisma/adapter-pg`: ese campo no llega. Lo que emite el cliente es `meta.modelName` más
   `meta.driverAdapterError.cause`, con `originalCode: '23505'`, `originalMessage` y `constraint.fields` /
   `constraint.index`. La implementación usa `meta.modelName` como fuente principal y **cae** a
   `meta.target` (forma clásica, sin adapter) y al texto de la restricción del adapter, con tests de **las
   dos formas** para sobrevivir a que el adapter entre o salga del proyecto. Corregidos la fila de la tabla
   de §1 (ahora con una fila propia para la forma real del `meta`) y la decisión 8 de §2, incluida la
   alternativa descartada («leer solo `meta.target`»), que era exactamente la trampa. Es la misma clase de
   hallazgo que la verificación de `NULL` en `@@unique` de la v0.1.0: la documentación describía una cosa y
   el cliente instalado emitía otra, y solo se ve ejecutando contra la base.
2. **`tasks.md` contradecía a `plan.md` §6 en el nombre de los servicios, y manda `plan.md`.** `tasks.md`
   decía `WorkspaceService.createDirectory()` / `.createDocument()` en T-005…T-009, pero §6 especifica
   **tres** servicios (`workspace.service.ts`, `directories.service.ts`, `documents.service.ts`) con un
   motivo explícito de despacho: con un servicio único los agentes de directorios y de documentos editarían
   el mismo archivo a la vez, que es lo que bloqueó una tarea en la Fase 3. La decisión estaba tomada **y ya
   ejecutada** — `T-005` implementó `DirectoriesService` —, así que la contradicción se resuelve a favor del
   plan y no al revés. Ajustados: T-005/T-006/T-007 → `DirectoriesService`; T-008/T-009 → `DocumentsService`
   (con sus tres métodos nombrados); T-010 sigue en `WorkspaceService.getTree()`; T-011 pasa a probar los
   **dos** servicios de alta en sus propios archivos (`directories.service.spec.ts` y
   `documents.service.spec.ts`), porque el tope de nodos afecta al alta de los dos tipos, con el `DONE`
   actualizado en consecuencia. **Solo cambia el nombre del artefacto**: ni un AC, ni un caso de test, ni
   un comando de verificación distinto del que impone ese renombrado.
3. **`plan.md` §6 no listaba dos archivos que §4 exige de facto y que ya existen en el módulo.** Añadidos a
   la estructura, con su motivo: `dto/is-workspace-name.validator.ts` (el decorador `@IsWorkspaceName()`
   que §4 pide en los cuatro DTO con nombre o título; en archivo propio para que las reglas de nombre de §3
   se apliquen llamando a `workspace-name.ts` en vez de reimplementarse con una regex distinta en cada DTO,
   que es como AC-3 y AC-14 acabarían divergiendo entre endpoints) y `domain-error.ts`
   (`toWorkspaceDomainHttpException`, simétrico de `prisma-error.ts`: `WorkspaceDomainError` → `409
   { message, code }` y todo lo demás se propaga sin tocar; el reparto queda escrito — uno traduce lo que
   viene de la base, el otro lo que viene del dominio puro, y ninguno captura de más). Documentado también
   que el repositorio ganó **`listDirectoryRefs(scope)`** (`select: { id, parentId }`): como el `depth` no
   se persiste (decisión 2), calcularlo con `tree-graph` necesita la foto de la jerarquía del usuario, y
   solo esas dos columnas.

## v0.1.0 — 2026-07-25

- **Aprobada por el usuario el 2026-07-25** sin cambios de alcance ni de criterios. Los cuatro puntos que
  se le señalaron por ser caros de cambiar con datos ya guardados quedan aceptados tal como están escritos:
  (1) el **borrado es definitivo**, sin papelera ni deshacer, con cascada real, `?recursive=true` explícito
  y confirmación en la UI; (2) las **reglas de nombres** se mantienen — unicidad entre hermanos insensible
  a la caja, sin plegar acentos (`Año` ≠ `Ano`), y un directorio y un documento pueden compartir nombre en
  la misma carpeta; (3) **editar el contenido queda fuera** de esta spec y es de `003-editor`; (4) los
  **cuatro límites** propuestos van tal cual (10 niveles de profundidad, 5.000 nodos por usuario, 200.000
  caracteres por documento, 120 peticiones/min/IP). Estado `draft` → `approved`; arranca la Fase 4.
- Ajuste de `plan.md` §6 al preparar el despacho, **sin impacto en ningún AC ni en el contrato**: la
  orquestación se reparte en **tres** servicios (`workspace.service.ts` para el árbol y el tope,
  `directories.service.ts`, `documents.service.ts`) en vez de uno. La razón es de cohesión y también de
  reparto: directorios y documentos se implementan en tareas distintas y con un servicio único los dos
  agentes editarían el mismo archivo a la vez, que es exactamente lo que bloqueó una tarea en la Fase 3.
- Corrección de higiene del propio artefacto, sin cambio de contenido: la descripción del RED de `T-002`
  llevaba un **byte NUL (0x00) y un DEL (0x7f) literales** al enumerar los caracteres de control que
  `assertWorkspaceName` debe rechazar, lo que convertía `tasks.md` en binario para `grep` y `git diff`.
  Sustituidos por ` ` y `` escapados. **Regla que sale de aquí**: los caracteres de control se
  escriben escapados en los artefactos de la spec, y el test que los necesite los construye con
  `String.fromCharCode`, nunca como literales en el archivo.
- Spec inicial (**draft**). Alcance: modelo de árbol (directorios anidables + documentos markdown en un
  directorio o en la raíz), CRUD completo de los dos tipos incluidos renombrar y mover, borrado con
  cascada y confirmación explícita, lectura del árbol completo, autorización por recurso en los diez
  endpoints, contrato compartido con type guards, Swagger, y en la web el árbol navegable y accesible
  más una vista de documento en crudo.
- **32 criterios de aceptación** y **23 tareas TDD** en 5 bloques.
- **Cero dependencias nuevas** en los tres paquetes. Se comprobó que no hace falta ninguna librería para
  el grafo del árbol: dos módulos puros de funciones resuelven ancestros, profundidad, altura y ciclo, y
  son testeables sin infraestructura.
- Verificado con `context7` contra la documentación de Prisma (2026-07-25), y de ello sale la decisión de
  esquema más importante: **en un `@@unique` los `NULL` se consideran distintos**, así que
  `@@unique([userId, parentId, nameKey])` **no** impediría dos directorios homónimos en la raíz. Los
  índices parciales existen pero como *preview feature*, y no hay índices por expresión (`lower(name)`).
  De ahí las dos columnas derivadas y no nulas: `nameKey`/`titleKey` y `parentScopeId` (`parentId ??
  userId`). Sin esa verificación, AC-3 y AC-14 habrían pasado en local y fallado con datos reales.
- Verificado también en el código instalado (no solo en la documentación):
  `Prisma.TransactionIsolationLevel` y `Prisma.PrismaClientKnownRequestError` existen en el cliente
  generado del proyecto, y `app.useBodyParser('json', { limit })` existe en `@nestjs/platform-express`
  11.1.28 — es la **única** vía correcta para subir el límite de cuerpo, porque un `app.use(json(...))`
  se registra después del body parser interno de Nest y no lo sustituye.
- Decisión registrada: **404, nunca 403**, para todo recurso que no sea del usuario del token, incluido el
  destino de un move. Al filtrar siempre por `userId` en el `where`, «no existe» y «no es tuyo» son la
  misma rama de código: el comportamiento seguro es el que sale por defecto.
- Decisión registrada: **borrado físico con cascada real de PostgreSQL**, sin `deletedAt` ni papelera. El
  freno contra el accidente es un `409 DIRECTORY_NOT_EMPTY` más `?recursive=true` explícito y una
  confirmación en la UI, no la reversibilidad. Un borrado lógico obligaría a todas las specs siguientes a
  acordarse de filtrar, y un solo olvido resucita datos borrados.
- Decisión registrada: **el árbol se sirve completo y plano** (dos arrays con `parentId`/`directoryId`),
  **sin contenidos**; el contenido viaja solo en `GET /api/workspace/documents/:id`. El tope de 5.000
  nodos por usuario es lo que hace sostenible esa decisión.
- Decisión registrada: **renombrar y mover son endpoints separados**. Con `exactOptionalPropertyTypes` y
  el `@IsOptional()` de class-validator (que trata `null` igual que ausente), un `PATCH` combinado no
  puede distinguir «mueve a la raíz» de «no toques el sitio». Las entradas usan
  `@ValidateIf((dto) => dto.parentId !== null) @IsUUID()` para exigir presencia y aceptar `null`.
- Decisión registrada: **`ErrorResponseDto` y `ApiErrorShape` ganan un `code?: string` opcional**, que
  solo emiten los errores de dominio de workspace. Hay cinco `409` distintos y la UI tiene que decir cosas
  distintas; emparejar por el texto del mensaje se rompe en cuanto alguien lo matice. Es aditivo, así que
  los tests de `000` que comprueban el juego exacto de claves de un error siguen verdes; al implementarse
  dejará una entrada de patch en `specs/000-foundation/CHANGELOG.md`.
- Decisión registrada: **quinto throttler nombrado, `workspace` (120/min/IP)**, y **no** un throttler
  `default` global. Cierra el punto que el CHANGELOG de `001` dejó explícitamente para esta spec, y el
  olvido se hace mecánico con un test que exige que **todo** controlador declare `@Throttled(...)` o
  `SkipThrottling()`.
- Decisión registrada: **módulo plano** (`controller` → `service` → `repository` + dos módulos de dominio
  puro), sin capas `domain/application/infrastructure`. La propia guía de `clean-ddd-hexagonal` dice que
  no aplica a CRUD con pocas reglas; lo que sí se respeta es que el dominio no importe Nest ni Prisma y
  que el repositorio sea el único que toque la base — verificado por un test que exige que
  `PrismaService` aparezca en **un solo** archivo del módulo.
- Fuera de alcance explícito: **editar el contenido** de un documento (spec `003`, incluido su modelo de
  conflictos), preview y sanitización, paleta, tabs y split view, *drag and drop*, papelera y deshacer,
  búsqueda y ordenación configurable, compartir y permisos, adjuntos, import/export, operaciones en lote y
  caché HTTP del árbol.
- Riesgos aceptados y documentados: borrado irreversible (#5), árbol completo en una respuesta (#6),
  columna derivada que puede desincronizarse (#2), nombres que un sistema de ficheros odiaría cuando
  llegue la exportación (#4), y profundidad/tope elegidos sin datos de uso (#14).
