# Changelog — Spec 002 Workspace tree

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.4.4 — 2026-07-28

**Patch de estado: la enmienda de la v0.4.0 queda implementada y la spec vuelve a estar alineada con el
código.** Ningún AC cambia de significado.

Los **cinco AC** que la v0.4.0 dejó **por delante del código** los cerró la spec `003` el mismo día:

| AC | Quién lo cerró | Qué quedó |
|---|---|---|
| AC-12, AC-15 | `T-007` | `contentVersion` en el juego exacto de claves del alta y el detalle |
| AC-26 | `T-009` | **once** rutas y **diez** con `404`. Fueron **cuatro** recuentos y no tres: el cuarto —DTO de **salida**— no dio rojo porque su lista no tiene `toHaveLength`, o sea que era un hueco silencioso |
| AC-31 | `T-013` | `DocumentViewPage.test.tsx` borrado y **11 de 12** casos trasladados al editor |
| AC-32 | `T-013` | La aserción pasa del `<pre>` del andamio al `<textarea>` del editor; el resto del recorrido, intacto |

**El detalle de AC-31 que merece sobrevivir a esta entrada.** `T-013` portó **tres casos que no estaban en
su encargo** —los de navegación— tras comprobar que `WorkspaceTreeView.test.tsx` solo afirma
`selectedId`/`aria-selected` y **nunca la ruta**. Eran la **única** cobertura de «activar un documento
abre `/documents/:id`» en todo el proyecto: borrarlos con el resto del andamio la habría hecho desaparecer
**sin que ningún test se pusiera rojo**. Es la misma clase de hueco silencioso que el cuarto recuento de
`T-009`, y se encontró con el mismo método — preguntarse **quién más cubre esto** antes de borrar.

**Se deja escrito que la spec estuvo por delante de su código durante unas horas**, en el `Estado` y en el
aviso de §6, en vez de borrar el episodio ahora que está resuelto. Una spec puede ir por delante del
código si está **dicho**; lo que no puede es decir «35/35 verificados» mientras cinco de esos AC describen
algo que nadie ha implementado.

Verificado en el cierre de la `003`: api e2e 22 suites / **511** · api unit 21 suites / **305** ·
`apps/web` 16 archivos / **321** · `pnpm test:e2e` **8** · `typecheck` y `lint` en 0.

## v0.4.3 — 2026-07-28

**Patch. La enmienda alcanza a un archivo más, y van dos.** Ningún AC cambia de significado, ningún
contrato cambia: lo que crece otra vez es **el alcance registrado**.

`T-012` de la spec `003` encontró que **`apps/web/src/test/workspace-fixtures.ts`** —código intacto de
esta spec, commit `168b840`— construye un `MarkdownDocument` a mano y no ponía `contentVersion`, que el
tipo pasó a exigir. **Coste medido: 14 tests en rojo en 5 suites**, más un error de `tsc`. El arreglo es
una línea (`contentVersion: 0`). Mismo procedimiento que `T-007`: parar, verificar que era código de esta
spec, autorizar, registrar en `specs/003-editor/spec.md` §6, y después aplicar.

**Por qué se repite, que es lo único que evita una tercera vez.** Las dos veces la lista cerrada falló por
el mismo sitio: se pensó el radio de un cambio de contrato como «los DTO y los tests que afirman
respuestas HTTP», y el radio real es **todo lo que construye un valor de ese tipo**, incluidos los
**fixtures de test de los dos paquetes**. Un tipo compartido con un campo requerido nuevo es un *tripwire*
que alcanza a cualquier archivo que fabrique uno a mano, y esos archivos no aparecen buscando el nombre
del endpoint — aparecen buscando el nombre del **tipo**. La regla queda escrita en §6 de la `003`.

**Cobertura**: no se pierde nada. El fixture sigue siendo un `MarkdownDocument` válido; ahora lo es de
verdad.

## v0.4.2 — 2026-07-28

**Patch. La enmienda de la v0.4.0 tocó un archivo más de lo que su lista autorizaba.** Ningún AC de esta
spec cambia de significado, ningún contrato cambia y ningún límite cambia: lo que cambia es **el alcance
registrado** de la enmienda.

**Qué pasó.** `T-007` de la spec `003` encontró una **tercera** aserción de claves exactas que la lista
cerrada de `specs/003-editor/spec.md` §6 no contemplaba:

- `apps/api/src/workspace/workspace.repository.spec.ts`, caso **«no deja salir del repositorio las
  columnas internas de un documento»** (línea ~334). La lista de claves que ese test afirma sobre lo que
  devuelve `createDocument` gana `contentVersion`.

**Es inevitable y correcta**: AC-11 de la `003` obliga a que `createDocument` devuelva `contentVersion`,
así que el test que enumera exactamente lo que sale del repositorio tenía que crecer con él. Es una línea.

**Lo que hay que retener no es el cambio, es cómo apareció.** `T-007` **paró y reportó** en vez de
ampliar la lista por su cuenta, y antes de reportar verificó con `git show HEAD` que la aserción era
código **de esta spec** y no algo que hubiera roto `T-003` de la `003`. Esa distinción es la que separa
«la enmienda alcanza a un test que no habíamos previsto» de «acabamos de romper la `002`», y es
exactamente lo que el procedimiento de `T-024`/`T-026`/`T-027` existe para provocar. La lista cerrada
**estaba corta** —la escribió el orchestrator— y el mecanismo lo cazó. Se autorizó y se añadió a §6
**antes** de aplicarlo.

**Cobertura**: no se pierde nada. El test sigue afirmando el juego **exacto** de claves; solo enumera una
más. Y la `003` refuerza esa red en su AC-11, después de **medir** que una columna de más en
`DOCUMENT_SUMMARY_SELECT` es **indetectable por HTTP** —los DTO se construyen campo a campo, así que
jamás llega a la respuesta— mientras el árbol descargaba de TOAST el texto de todos los documentos.

## v0.4.1 — 2026-07-28

**Patch de corrección de este mismo archivo. No toca ningún AC, ningún contrato, ningún límite ni una
línea de código.** Se sustituyen **dos bytes de control** —un `U+0000` y un `U+007F` en bruto, en la
entrada de la v0.3.1— por el nombre de su punto de código.

**Por qué importaba.** Con esos dos bytes dentro, `grep` clasificaba el archivo como **binario** y salía
con **exit 1** aunque el patrón estuviera presente: `grep -n "^## v0.4.0" CHANGELOG.md` → sin salida,
exit 1, mientras `grep -a` sobre lo mismo → `5:## v0.4.0 — 2026-07-28`, exit 0. Se descubrió al verificar
el `DONE` de `T-000` de la spec `003`, que es precisamente un `grep` sobre este archivo: la comprobación
fallaba y **el archivo estaba bien**. Un `DONE` que no puede distinguir «no está» de «grep no lo ve» no
verifica nada.

**Precisión sobre el alcance del defecto**, porque el primer diagnóstico lo dijo de más: el que se rompía
era **`grep`**. `git diff` funcionaba con normalidad sobre el archivo.

**De dónde salieron.** De la propia entrada de la v0.3.1 que **documentaba este mismo problema** en
`tasks.md`: al escribir «Sustituidos por `…` y `…` escapados» se incrustaron los bytes en bruto en lugar
de su representación. La frase prometía una cosa y contenía la contraria, así que la corrección hace que
por fin afirme lo que dice.

**Por qué `U+0000`/`U+007F` y no una secuencia con barra invertida.** Es la notación que ya usa §3 de
`spec.md` para estos mismos caracteres («contiene un carácter de control (`U+0000`–`U+001F`, `U+007F`)»),
así que no introduce vocabulario nuevo. Y es la única que **no se puede volver a romper en tránsito**: al
aplicar el arreglo, dos herramientas distintas reinterpretaron una secuencia con barra invertida y
devolvieron los bytes crudos al archivo. Una notación que no lleva barras invertidas no tiene esa
superficie.

**Verificación, elegida para que falle si el arreglo no funcionó**: `grep -c` sobre este archivo → exit
**0** (antes exit 1); `grep -n "^## v0.4.0"` **sin `-a`** → encuentra la línea 5; y un barrido de bytes de
control sobre **los 21 archivos `.md` de `specs/`** → **cero**. Ningún otro archivo estaba afectado.

**Regla que se refuerza, ya que la v0.3.1 la había escrito y aun así cayó**: un carácter de control nunca
se escribe literal en un documento; se escribe su nombre.

## v0.4.0 — 2026-07-28

**Minor pedido desde fuera: lo pide la spec `003-editor`, aprobada hoy, y lo paga ella.** Aditivo —ningún
campo desaparece ni cambia de tipo, ningún consumidor se rompe— pero obliga a cambiar aserciones de tests
**verdes**, así que no puede ser un patch. Aplicado por `T-000` de la `003`, cuya lista cerrada de
artefactos tocables está en `specs/003-editor/spec.md` §6. **No se tocó ni una línea de código**: los
cambios de test los harán `T-007`, `T-009` y `T-013` de la `003`, cada uno junto a la implementación que
los provoca.

### Qué cambia y por qué

El editor necesita guardar contenido sin pisar el trabajo de otra pestaña, y para eso hace falta un token
de concurrencia optimista. La `003` eligió una **columna dedicada**, `contentVersion Int @default(0)`, que
viaja en la respuesta del documento. De ahí salen los cinco AC tocados:

- **AC-12** y **AC-15** — `WorkspaceDocumentResponseDto` gana `contentVersion`, así que el juego **exacto**
  de claves que los dos afirman cambia. Nace en `0` con o sin contenido inicial: fijar el texto al crear
  no es un guardado.
- **AC-26** — «diez rutas» pasa a **once** y «las nueve que resuelven un `:id`» a **diez**, por
  `PUT /api/workspace/documents/{id}/content`. **La decisión de fondo no cambia**: `GET /tree` sigue siendo
  la única ruta del tag que no declara `404`, y se sigue afirmando en negativo. Esta entrada mueve dos
  números, no el criterio que la v0.2.2 fijó para derivar la lista.
- **AC-31** y **AC-32** — se retira la descripción del **andamio** (`Markdown en crudo` en un `<pre>`), que
  esta misma spec declaró como tal en su §4 y que la `003` sustituye por el editor.

### Por qué una columna y no `updatedAt`, que es lo que esta spec había apuntado

El riesgo #12 de esta spec decía: «`WorkspaceDocumentResponseDto` ya lleva `updatedAt`, que es lo que
`003` necesita para una comprobación optimista […]. **No** se añade una columna `version` por adelantado:
sería especular sobre un mecanismo que `003` todavía no ha decidido». La `003` lo ha decidido, y ha
decidido lo contrario, por un motivo que solo se ve al escribirlo: **renombrar y mover también mueven
`updatedAt`**. Con `updatedAt` como token, renombrar un documento desde la barra lateral haría fallar un
guardado pendiente del editor con un **conflicto que no existe**. La `003` tiene un AC (su AC-9) dedicado a
clavar que las tres operaciones son ortogonales, y con `updatedAt` sería imposible de cumplir.

No fue un error de esta spec: fue exactamente lo que su riesgo #12 pedía —no adelantar un mecanismo sin
datos— y el mecanismo se decidió cuando hubo con qué decidirlo.

### Lo que esta enmienda cuesta, escrito donde se lea

**Desde hoy, cinco AC de esta spec describen un contrato que el código todavía no cumple.** La spec va
**por delante** del código, a propósito. Las 27 tareas siguen cerradas y los 35 AC siguen verificados
contra el código de la v0.3.1; la diferencia la implementan `T-007`, `T-009` y `T-013` de la `003`. Se
anota en el `Estado` de la spec, en §6 (trazabilidad) y en cada uno de los cinco AC, en vez de dejar que
«35/35 verificados» diga algo que ya no es del todo cierto.

**Lo que NO se tocó**, aunque estaba cerca: `PATCH /api/workspace/documents/{id}` sigue aceptando solo
`title` y sigue rechazando `content` con un `400` de `forbidNonWhitelisted`. La `003` evaluó ampliarlo y lo
descartó — habría metido el guardado automático en el camino del `409 DOCUMENT_TITLE_TAKEN` y habría
convertido esta entrada en un **major**.

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
  Sustituidos por el nombre de su punto de código, `U+0000` y `U+007F` (corregido en la v0.4.1). **Regla que sale de aquí**: los caracteres de control se
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

---

## Registro de implementación — movido desde `IMPLEMENTATION.md` (2026-08-03)

> Trasladado **literal**, sin podar. El documento de seguimiento había crecido a 3.317 líneas y había
> dejado de servir de índice; el detalle de cada feature pasa a vivir con su feature. Si algo de aquí
> repite lo que ya dice el historial de versiones de arriba, se recorta cuando se tengan los dos
> delante — no antes.


### Planificación de la spec

- [x] **spec 002-workspace-tree** — `specs/002-workspace-tree/` (`spec.md` **v0.4.1** + `plan.md` + `tasks.md` + `CHANGELOG.md`),
      estado **complete, con la enmienda de la v0.4.0 pendiente de implementar** (2026-07-28).
      La **v0.4.1** es un patch que **solo toca `CHANGELOG.md`**: dos **bytes de control** en bruto (un
      `U+0000` y un `U+007F`) hacían que `grep` clasificara el archivo como **binario** y saliera con
      exit 1 aunque el patrón estuviera. Se detectó verificando el `DONE` de `T-000`, que es justamente un
      `grep` sobre ese archivo: la comprobación fallaba y **el archivo estaba bien**. Los bytes venían de
      la entrada de la v0.3.1 que **documentaba este mismo problema** en `tasks.md` — la frase prometía
      «sustituidos por … escapados» e incrustaba los bytes en bruto. Verificado con una comprobación que
      falla si el arreglo no funcionó: `grep -c` → exit **0** (antes 1), `grep` sin `-a` encuentra la
      línea, y un barrido de bytes de control sobre **los 21 `.md` de `specs/`** → **cero**, sin ningún
      otro archivo afectado. `git diff` nunca estuvo roto: el que se rompía era `grep`.
      La **v0.4.0** (minor) **no la pide esta spec sino la `003`**, aprobada el 2026-07-28, y la aplicó su
      `T-000`: `WorkspaceDocumentResponseDto` gana `contentVersion` (token de concurrencia optimista del
      guardado) y el recuento de rutas del tag `workspace` pasa de **diez a once**. Es aditivo —ningún
      campo desaparece ni cambia de tipo— pero obliga a cambiar aserciones de tests **verdes**, así que no
      podía ser un patch. Toca cinco AC: **AC-12**, **AC-15**, **AC-26**, **AC-31** y **AC-32**.
      **Consecuencia asumida y escrita en los tres sitios donde se lee** (el `Estado` de la spec, el aviso
      que abre su §6 de trazabilidad, y cada uno de los cinco AC): desde el 2026-07-28 **esos cinco AC van
      por delante del código**. Los implementan `T-007`, `T-009` y `T-013` de la `003`. Dejar «35/35
      verificados» a secas habría sido más cómodo y falso.
      **Lo que la v0.4.0 NO tocó**, aunque estaba cerca: `PATCH /api/workspace/documents/{id}` sigue
      aceptando solo `title` y sigue rechazando `content` con un `400` de `forbidNonWhitelisted`.
      **Y por qué la columna y no `updatedAt`**, que es lo que el riesgo #12 de esta misma spec había
      apuntado: renombrar y mover **también** mueven `updatedAt`, así que renombrar desde la barra lateral
      haría fallar un guardado pendiente del editor con un conflicto que no existe. No fue un error de la
      `002` — su riesgo #12 pedía expresamente no adelantar el mecanismo sin datos, y se decidió cuando
      hubo con qué decidirlo.
      Lo anterior, intacto: la **v0.3.1** (patch)
      cierra `T-026` y `T-027`, con lo que AC-34 y AC-35 quedan cubiertos, y **corrige dos decisiones que
      había escrito el orchestrator**: el reset de AC-35 necesitaba también `throttle:login:*`, y
      `global-setup.ts` tenía que estar en la lista de archivos de `T-027`. Ver el cierre de la Fase 4.
      _(Antes de la v0.3.1: **33/33 AC** del alcance aprobado y **25/25 tareas**.)_
      Fue approved el 2026-07-25 sin cambios de alcance: los cuatro puntos
      señalados se aceptaron tal como estaban escritos; ver el punto 6 de pendientes. — 2026-07-25
      Aprobada con **33 criterios de aceptación y 25 tareas** TDD en 5 bloques (A esquema y dominio puro ·
      B directorios · C documentos · D árbol y transversales · E frontend), más el **Bloque F** de
      endurecimiento (AC-34, AC-35 · `T-026`, `T-027`) que abrió la v0.3.0 y cerró la v0.3.1; la
      implementación es la Fase 4.
      La v0.2.2 (patch) resuelve la contradicción del `404` de `GET /api/workspace/tree` y añade `T-025`
      —la mitad de código de esa decisión—, sin tocar ningún AC de comportamiento. La **v0.2.3** (patch)
      corrige el criterio con que ese mismo RED derivaba las nueve rutas con `404` (no es «lleva `{id}`»,
      que da siete, sino «todas menos `/tree`») y cierra `T-025` y `T-022`.
      Aprobada con 32 AC y 23 tareas; la v0.2.0 añade **AC-33** y **`T-024`** (el `413` del límite de
      cuerpo, que hoy sale `500`). Es alcance nuevo, no un cambio de lo aprobado: no toca ninguno de los
      cuatro puntos que el usuario aceptó ni ningún AC anterior.
      **Cero dependencias nuevas** en los tres paquetes. Verificado con `context7` contra la doc de Prisma:
      en un `@@unique` los `NULL` se consideran **distintos**, así que `@@unique([userId, parentId, nameKey])`
      no impediría dos directorios homónimos en la raíz → columnas derivadas no nulas `nameKey`/`titleKey` y
      `parentScopeId`. Verificado además en el código instalado que `Prisma.TransactionIsolationLevel`,
      `Prisma.PrismaClientKnownRequestError` y `app.useBodyParser('json', { limit })` existen tal como
      los usa el plan.
      Decisiones de más impacto: `404` nunca `403` para lo ajeno · borrado físico con cascada real y
      `?recursive=true` explícito · árbol completo, plano y sin contenidos · renombrar y mover en endpoints
      separados · `code?: string` aditivo en `ErrorResponseDto` · quinto throttler `workspace` (cierra el
      punto que el CHANGELOG de `001` dejó para esta spec).


### Fase 4 — Implementación de `002-workspace-tree`


Detalle completo en `specs/002-workspace-tree/tasks.md`. Spec **aprobada el 2026-07-25**, sin cambios de
alcance: **33 AC · 25 tareas** de alcance aprobado, más **AC-34** y **AC-35** (`T-026`, `T-027`) que añadió
la v0.3.0 como endurecimiento de entorno. Cada línea lleva el comando que se corrió y su salida real, igual
que las Fases 2 y 3.

**Estado al 2026-07-25: FASE CERRADA POR COMPLETO, spec `002` en estado `complete`.** Las **27 tareas**
hechas y verificadas —`T-001`…`T-016`, `T-024` y `T-025` de backend; `T-017`…`T-023`, `T-026` y `T-027` de
frontend— y los **35 AC** cubiertos. **Ningún AC sin cobertura**, con **una salvedad escrita y no
escondida**: el rojo de AC-34 es **manual** y CI no lo cazará nunca (el runner arranca siempre con
`node_modules/.vite` frío, así que allí `force: true` y su ausencia son indistinguibles). La tabla de
cifras finales y la comprobación AC a AC están en «Cierre de la Fase 4 y de la spec `002`», más abajo,
junto con los tres hallazgos del navegador que `T-023` destapó y el cierre de las dos tareas de
endurecimiento que aquéllos abrieron.

La spec va por **v0.3.1**. La **v0.3.1** (patch) cierra `T-026` y `T-027` —con lo que AC-34 y AC-35 quedan
cubiertos y la spec pasa a 35/35 AC y 27/27 tareas— y **corrige dos decisiones que había escrito el
orchestrator, no el agente**: (1) AC-35 no se cierra tocando solo `throttle:register:*`, hace falta también
`throttle:login:*`; (2) `global-setup.ts` tenía que estar en la lista de archivos de `T-027`. Las dos
correcciones están en la spec, no solo aquí. La **v0.3.0** (minor) cerró la implementación, corrigió la
redacción de
**AC-32** —decía «el árbol queda vacío» y su propio recorrido lo impide, porque el documento se muda a la
raíz **antes** del borrado recursivo— y añade **AC-34** y **AC-35** con sus tareas. La **v0.2.3** (patch) corrigió un **error de criterio del RED de `T-025`** que
había escrito la propia v0.2.2 —las nueve rutas que declaran `404` **no** son las que llevan `{id}` en la
plantilla de ruta, que son siete— y cierra `T-025` y `T-022`. Ver la nota «Las nueve rutas con `404` no son
las que llevan `{id}`» al final de este archivo. La **v0.2.2** (patch) resuelve la contradicción del `404` de
`GET /api/workspace/tree` entre AC-26 y `plan.md` §4 —gana `plan.md`, la ruta deja de declararlo—, añade
la tarea **`T-025`** con la retirada del decorador, y corrige el «seis endpoints con parámetro de ruta»
del RED de `T-012`, que son **siete**. La nota «El `404` que no puede ocurrir» al final de este archivo
tiene el razonamiento completo; el resumen está en `specs/002-workspace-tree/CHANGELOG.md` v0.2.2.
La **v0.2.0** (minor) añadió **AC-33** y la tarea **`T-024`**, salidas de un
hueco de contrato que destapó `T-008`: `plan.md` §4 promete `413` para un cuerpo por encima de
`JSON_BODY_LIMIT` y lo que salía de verdad era `500`. Se decidió **arreglar el comportamiento en vez de
reescribir el contrato**; el porqué está en la nota «El `413` que no era `413`» al final de este archivo y
en `specs/002-workspace-tree/CHANGELOG.md` v0.2.0. Esa misma versión recogió tres desviaciones de
implementación de `T-006`/`T-007`/`T-008` (`plan.md` §2 decisión 7, §4 y §6) y un endurecimiento del RED
de `T-012`. La **v0.2.1** (patch) cierra AC-33 con su verificación y **deja escrita la regla de
detección**, que es la pieza que se afloja sola; entrada gemela de cierre en
`specs/000-foundation/CHANGELOG.md` **v0.1.6**.
Antes iba por v0.1.1: un patch con tres correcciones que salieron de implementar, ninguna de alcance
—`meta.target` de Prisma no existe en este stack, `tasks.md` contradecía a `plan.md` §6 en el nombre de
los servicios, y §6 no listaba dos archivos que §4 exige de facto—.

Reglas que esta fase hereda de lo aprendido en las anteriores y que se aplican a **todas** sus tareas:

- Los comandos `DONE` se corren también **desde estado limpio** (`rm -rf packages/shared/dist` antes), por
  la lección de `000` v0.1.2: un `dist/` heredado convierte un fallo real en falso verde.
- Un fallo que no se reproduce **no** es transitorio hasta que se explica por qué desapareció
  (lección del `mfa-secret.cipher` intermitente de la Fase 3).
- **Cero dependencias nuevas** (`plan.md` §1). Si una tarea parece necesitar un paquete, se para y se
  reporta.
- `T-004` toca `ErrorResponseDto` y `ApiErrorShape`, que son contrato de la spec `000`. Si algún test de
  `000` o `001` se pone en rojo, se **para y se reporta**: no se ajusta el test de otra spec por cuenta
  propia.

Bloque A — Esquema y dominio puro:

- [x] **T-001** · backend · setup · Modelos `Directory` y `Document` + migración `workspace_tree` — 2026-07-25
      Migración **`20260725045944_workspace_tree`** aplicada · `pnpm exec prisma migrate status` →
      `Database schema is up to date!` (**2** migraciones, la de `001` y esta).
      **Verificado contra el esquema real con `psql` en `localhost:5433`**, no solo contra `schema.prisma`
      (misma exigencia que en `T-003` de la Fase 3, y por el mismo motivo: el archivo declara la intención,
      la base es la que decide):
      · unicidad — existen `directories_parentScopeId_nameKey_key` y `documents_parentScopeId_titleKey_key`,
        y son los **dos únicos** índices únicos de las tablas nuevas (si hubiera quedado además un
        `@@unique` con `parentId` nulable, la decisión 3 del plan estaría a medias y AC-3/AC-14 pasarían en
        local y fallarían con datos reales);
      · índices — `directories_userId_parentId_idx`, `directories_parentId_idx`,
        `documents_userId_directoryId_idx`, `documents_directoryId_idx`;
      · cascada — las **cuatro** claves ajenas (`directories_userId_fkey`, `directories_parentId_fkey`,
        `documents_userId_fkey`, `documents_directoryId_fkey`) con `confdeltype = 'c'`, o sea
        `ON DELETE CASCADE`. Es lo que sostiene AC-11 y AC-19, y se comprueba en `pg_constraint` porque un
        `onDelete: Cascade` mal migrado no se nota hasta que alguien borra algo.
      **Desvío previsto por el propio plan** (§5): el prefijo de la migración lo pone Prisma en UTC, así que
      el nombre real de la carpeta es `20260725045944_workspace_tree`. Igual que en `001`.
- [x] **T-002** · backend · Dominio puro: normalización y validación de nombres (AC-3, AC-4, AC-13, AC-14) — 2026-07-25
      `pnpm --filter @one-markdown/api test workspace` → **2 suites, 70 tests** verdes (medición conjunta
      con T-003, que corrió en paralelo sobre archivos disjuntos; es el estado previo a T-004).
- [x] **T-003** · backend · Dominio puro: grafo del árbol — ancestros, profundidad, altura, ciclo (AC-6, AC-8, AC-10) — 2026-07-25
      Mismo comando y misma corrida que T-002: `test workspace` → **2 suites, 70 tests**.
- [x] **T-004** · backend · `WorkspaceRepository` y traducción de errores de Prisma (AC-22 mecánico, AC-25 traducción) — 2026-07-25
      `pnpm --filter @one-markdown/api test workspace` → **5 suites / 102 tests** ·
      `pnpm --filter @one-markdown/api test` → **16 suites / 241 tests** ·
      `pnpm --filter @one-markdown/shared test` → **39 tests** (venía de 37: el `code?` de `ApiErrorShape`).
      Regresión completa por tocar contrato de la spec `000`: `pnpm --filter @one-markdown/api test:e2e` →
      **11 suites / 171 tests** verdes, más `typecheck` y `lint` en el `DONE`. **Todo desde estado limpio**
      (`rm -rf packages/shared/dist` antes), por la regla de la Fase 4.
      **Corrigió el plan, y es el hallazgo que más valor tiene de la ola**: `plan.md` describía la
      traducción del `P2002` leyendo `meta.target`, y **con Prisma 7.9 + `@prisma/adapter-pg` ese campo no
      llega**. Verificado ejecutando contra la base, no leyendo documentación: lo que emite el cliente es
      `meta.modelName` más `meta.driverAdapterError.cause` (`originalCode: '23505'`, `originalMessage`,
      `constraint.fields` / `constraint.index`). La traducción usa `modelName` como fuente principal y cae a
      `meta.target` y al nombre de la restricción del adapter, **con tests de las dos formas**, para que
      siga funcionando si el adapter entra o sale. Recogido en `specs/002-workspace-tree/CHANGELOG.md`
      v0.1.1: un `meta.target` siempre `undefined` habría mandado los cinco `409` de dominio al mismo
      mensaje genérico sin que ningún test lo delatara.

Bloque B — Directorios:

- [x] **T-005** · backend · `POST /api/workspace/directories` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6) — 2026-07-25
      `pnpm --filter @one-markdown/api test:e2e workspace-directories` → **1 suite / 23 tests** verdes.
      Regresión: `pnpm --filter @one-markdown/api test` → **241** (sin cambio) ·
      `pnpm --filter @one-markdown/api test:e2e` → **12 suites / 194 tests** (171 + 23) ·
      `typecheck` y `lint` en el `DONE`.
      Implementa **`DirectoriesService`**, no `WorkspaceService`: manda `plan.md` §6 (tres servicios), que
      `tasks.md` contradecía. Corregido en `tasks.md` — ver `CHANGELOG.md` v0.1.1, punto 2.
- [x] **T-006** · backend · `PATCH` y `DELETE` de directorio (AC-7, AC-11) — 2026-07-25 · agente `backend`
      RED: los **16** casos nuevos en rojo por ruta inexistente → GREEN:
      `pnpm --filter @one-markdown/api test:e2e workspace-directories` → **1 suite / 43 tests** verdes
      (los 27 de `T-005` más los 16 nuevos).
      Aporta dos piezas que el resto de la fase reutiliza y que por eso se subieron a `plan.md` §6:
      **`DirectoryNotEmptyError`** (el `409 DIRECTORY_NOT_EMPTY` del borrado sin `recursive`, traducido por
      el mismo `domain-error.ts` que los otros dos errores de dominio) y
      **`countDirectoryChildren(scope, id)`** en el repositorio, que suma subdirectorios **y** documentos
      con `userId` en **los dos** `where`. Lo segundo importa: sin el `userId` en el segundo `where`, un
      documento ajeno colgado del mismo id bloquearía un borrado legítimo, y AC-22 no lo vería porque no
      es una lectura.
      **`toStrictBoolean`** queda **exportado** desde `dto/delete-directory.query.dto.ts` a propósito, para
      que la próxima query booleana no escriba un `value === 'true'` que convierte `?recursive=sí` en
      `false` en silencio.
- [x] **T-007** · backend · `POST /api/workspace/directories/:id/move` (AC-8, AC-9, AC-10) — 2026-07-25 · agente `backend`
      RED: **20 de 20** en rojo (ver abajo: la primera pasada dio `18 failed, 2 passed` y **eso no valía**)
      → GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-move` → **1 suite / 20 tests** verdes.
      **La transacción `Serializable` acabó en el repositorio, no en el servicio**, expuesta como
      `inSerializableTransaction(scope, run)` con la interfaz `WorkspaceTreeTransaction`
      (`listDirectoryRefs` / `findDirectory` / `moveDirectory`, las tres con el `userId` cerrado dentro, sin
      firma por la que pasar otro). La **decisión** —ciclo, profundidad, no-op— se queda en el servicio.
      No es un capricho: era la única forma de cumplir a la vez la decisión 7 de `plan.md` §2 («el move va
      en `$transaction`») y el invariante de `workspace-data-access.spec.ts` («solo `workspace.repository.ts`
      nombra `PrismaService`»), que con el `$transaction` en el servicio se habría roto. Recogido en
      `plan.md` §2 decisión 7 y §6.
      **El no-op no escribe**: mover un directorio al padre que ya tiene devuelve la fila leída dentro de
      la transacción, **sin `update`**, y se prueba con `updatedAt` idéntico. `tasks.md` decía «200 sin
      cambios» y esta es la lectura estricta; un `update` idéntico habría movido `updatedAt` y le habría
      dicho al cliente que algo cambió. Es contrato observable —`003-editor` va a leer esas marcas—, así
      que está escrito en `plan.md` §4.
- [x] **T-008** · backend · `POST /api/workspace/documents` y `GET /api/workspace/documents/:id` (AC-12…AC-15) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-documents` → **1 suite / 31 tests**
      verdes · regresión `pnpm --filter @one-markdown/api test:e2e auth-register` → **12** verdes, que hay
      que correr **precisamente porque el límite de cuerpo es global** y esta tarea lo cambia.
      `JSON_BODY_LIMIT` vive en `workspace.constants.ts` y se aplica en `bootstrap.ts` con un *type
      predicate* (`isBodyParserCapable`) en vez de cambiar la firma `INestApplication` de `configureApp`:
      ese cambio de firma habría obligado a tocar **cinco** archivos e2e en mitad de la fase, con otros
      agentes escribiendo en `test/**`. El predicado **lanza al arrancar** si la app no fuera Express, en
      vez de saltarse el límite en silencio y dejar que AC-13 falle por un motivo ajeno al dominio.
      **Destapó un hueco de contrato real, y por eso la spec sube a v0.2.0**: `plan.md` §4 promete `413`
      para un cuerpo por encima de `JSON_BODY_LIMIT` y lo que sale es **`500`**. Ver la nota «El `413` que
      no era `413`» al final de este archivo y `specs/002-workspace-tree/CHANGELOG.md` v0.2.0.

Regresión conjunta corrida por el orchestrator tras cerrar las tres, **desde estado limpio**
(`rm -rf packages/shared/dist` antes, por la regla de la Fase 4):

| Comando | Resultado |
|---|---|
| `pnpm --filter @one-markdown/api test` | 16 suites, **241 passed** |
| `pnpm --filter @one-markdown/api test:e2e` | 14 suites, **265 passed** (venía de 12 / 194) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |

**Ningún test de `000` ni de `001` en rojo**, que era la condición explícita de la fase para `T-008`: es
la única tarea de la ola 3 que toca algo global (el límite de cuerpo de `bootstrap.ts`).

Bloque C — Documentos:

_(`T-008` está arriba, cerrada junto a `T-006` y `T-007`: se despachó en paralelo con ellas a un segundo
agente `backend`, que es justo el reparto que justifica los tres servicios de `plan.md` §6 —
`DocumentsService` frente a `DirectoriesService`, sin dos agentes en el mismo archivo.)_

- [x] **T-009** · backend · `PATCH`, `DELETE` y `move` de documento (AC-16, AC-17, AC-18) — 2026-07-25 · agente `backend`
      RED: **23 + 14** casos nuevos en rojo por ruta inexistente → GREEN:
      `pnpm --filter @one-markdown/api test:e2e workspace-documents` → **1 suite / 54 tests** ·
      `pnpm --filter @one-markdown/api test:e2e workspace-move` → **1 suite / 34 tests**.
      Regresión: `pnpm --filter @one-markdown/api test` → **16 suites / 241** (sin cambio: la tarea no
      añade unitarios) · `pnpm --filter @one-markdown/api test:e2e` → **14 suites / 302** (265 → 302,
      **+37**; el archivo de move pasa a compartirlo con `T-007`, de ahí que las suites no suban).
      **Hizo una mutación de control para demostrar que el test muerde, y eso es lo que salva el
      check-off de ser decorativo**: quitó el `parentScopeId: parentScopeIdFor(...)` del `moveDocument`
      del repositorio y `workspace-move` pasó a **`4 failed, 30 passed`**, cazando exactamente el caso
      «el ámbito de unicidad viaja con el documento» — mover un documento sin recalcular `parentScopeId`
      lo deja compitiendo por la unicidad de su carpeta **anterior**, así que el título duplicado en el
      destino colaría y el duplicado en el origen se bloquearía. Restaurado después, verde otra vez.
      Verificado por el orchestrator contra el código: `workspace.repository.ts` → `moveDocument()` sigue
      escribiendo `parentScopeId: parentScopeIdFor({ userId: scope.userId, parentId: directoryId })` junto
      al `directoryId`.
      **Esta es la práctica que se pide de aquí en adelante para toda tarea cuyo GREEN sea grande**: un
      RED por ruta inexistente prueba que el endpoint no existía, no que las aserciones discriminen. La
      mutación de control es lo único que distingue «54 tests en verde» de «54 tests que pasarían igual
      con el invariante roto».

Bloque D — Árbol y transversales:

- [x] **T-010** · backend · `GET /api/workspace/tree` (AC-20) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-tree` → **1 suite / 12 tests** verdes.
      Regresión: `pnpm --filter @one-markdown/api test` → **241** (sin cambio) ·
      `pnpm --filter @one-markdown/api test:e2e` → **15 suites / 314** (302 + 12) · `typecheck` y `lint`
      en el `DONE`.
      **Detalle del RED que vale la pena guardar: en `workspace-tree.e2e-spec.ts` ningún caso espera
      `404`, y es deliberado.** El `404` de ruta inexistente de Nest es justo el que produce el falso
      verde que destapó `T-007` (`18 failed, 2 passed`), así que aquí todos los asertos de estado son
      `200` o `401`: dos estados que el framework **no** regala mientras la ruta no existe, con lo que el
      rojo inicial no puede pasar por el motivo equivocado. Es la regla del `404` aplicada por diseño del
      archivo en vez de por endurecimiento a posteriori.
      **Nota de medición**: el archivo ya no tiene 12 casos. `T-011` (en curso) le añadió su bloque «tope
      de nodos por usuario (AC-21)» con tres casos que esperan `409`, así que a día de hoy son 15 `it`.
      El **12** es la cifra del `DONE` de esta tarea, corrida cuando esos tres casos aún no existían.
- [x] **T-011** · backend · Tope de nodos por usuario (AC-21) — 2026-07-25 · agente `backend`
      RED unitario: **`4 failed, 2 passed`** con `Expected constructor: ConflictException / Received:
      undefined` (los dos que pasaban son los casos «con un nodo menos, no lanza», que efectivamente no
      lanzaban). RED e2e **de comportamiento, no de compilación**: `expected 409, got 201` en las dos
      altas — la ruta ya existía desde `T-005`/`T-008`, así que el rojo no puede venir del `404` gratis de
      Nest, que es la trampa contra la que se escribió `workspace-tree.e2e-spec.ts` (ver `T-010`).
      GREEN: `pnpm --filter @one-markdown/api test "directories.service|documents.service"` →
      **2 suites / 6 tests** · `pnpm --filter @one-markdown/api test:e2e workspace-tree` →
      **1 suite / 15 tests**. Verificado por el orchestrator, los dos comandos, con esas mismas cifras.
      **`countWorkspaceNodes(scope)` nuevo en `workspace.repository.ts`**, y **solo frena altas**:
      renombrar, mover y borrar siguen funcionando con el workspace en el tope. No es un detalle menor —
      un límite que también bloqueara el borrado dejaría al usuario sin forma de salir de él, que es el
      único camino de vuelta que tiene.
      **El e2e espía el contador, no crea 5.000 nodos**, tal como exigía el RED escrito en `tasks.md`: un
      e2e que tarda minutos deja de correrse, y entonces el AC deja de estar verificado de hecho aunque
      siga en verde en el papel.
- [x] **T-012** · backend · Matriz de propiedad y de credencial sobre los diez endpoints (AC-22, AC-23) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-ownership` → **1 suite / 42 tests**
      verdes **a la primera**. Verificado por el orchestrator con la misma cifra.
      **Ningún agujero de autorización**: los diez endpoints devuelven `404` con los ids de otro usuario,
      ninguno `403`, ninguno `200`; sin `Authorization` y con un *refresh token* como `Bearer`, los diez
      dan `401`; y tras la matriz completa el estado del usuario A es idéntico al inicial.
      Un GREEN a la primera no prueba nada por sí solo, así que se anotan las **dos mutaciones de control**
      con las que se demostró que la matriz discrimina. Enseñan cosas distintas y por eso van las dos:
      1. **Una errata en una URL** de la constante de endpoints hizo caer 5 casos… pero el caso «ninguna
         es `403` / todas son `404`» **siguió verde**, porque el `404` de ruta inexistente de Nest también
         es `404`. Lo que caza la errata es afirmar el **`code`** y el **juego exacto de claves**: el
         cuerpo de una ruta inexistente trae cinco claves y **sin** `code`. Es la confirmación empírica de
         la regla que salió del falso RED de `T-007`, y la razón por la que el RED de esta tarea la exigía
         por escrito en vez de dejarla como buena costumbre.
      2. **Quitar el `userId` del `where` de `findDocument`** lo detectó **primero el compilador**:
         `TS6133: 'scope' is declared but its value is never read`. O sea que `noUnusedParameters` es una
         defensa de primer nivel contra el fallo de autorización más común de este diseño — un parámetro
         de ámbito que se acepta y no se usa. Forzado a compilar, la matriz cayó con
         `getDocument: expected 404, received 200`.
      **Detalle de diseño que queda escrito**: el `DELETE` de un directorio **ajeno y no vacío** responde
      `404`, no `409 DIRECTORY_NOT_EMPTY`. El servicio cuenta los hijos con el `userId` del token
      (`countDirectoryChildren`, de `T-006`), así que para B ese directorio no existe y nunca llega a
      contar nada. Importa porque el `409` sería una **filtración**: confirmaría que el id existe y que
      tiene contenido, que es exactamente lo que la decisión de «`404` nunca `403`» quiere evitar.
- [x] **T-013** · backend · Cascada del usuario y concurrencia (AC-19, AC-25) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-cascade` → **1 suite / 2 tests** ·
      `pnpm --filter @one-markdown/api test:e2e workspace-concurrency` → **1 suite / 3 tests**.
      Verificado por el orchestrator, las dos cifras.
      **Cero cambios de producción, y ése era el objetivo**: la tarea existe para demostrar que el índice
      único y la cascada de la migración de `T-001` hacen el trabajo sin código extra. Un GREEN sin
      diff es justo el resultado que se buscaba, y es también el que más fácil se cuela sin verificar, así
      que se hicieron **cuatro mutaciones de control, todas revertidas**:
      · FK sin `ON DELETE CASCADE` (aplicada dentro de `BEGIN … ROLLBACK`, sin tocar la migración) →
        `23503`, o sea que la cascada es lo que hace pasar el test y no el orden de borrado;
      · `renameDirectory` con `nameKey` único **por fila** en vez de por ámbito →
        `Expected [200, 409] / Received [200, 200]`: las dos peticiones concurrentes ganan, que es
        exactamente el defecto que AC-25 vigila;
      · errata en la URL del move → rojo **por la clave `code` ausente, no por el status**, otra vez la
        lección de `T-007`;
      · `@Throttled('login')` en `WorkspaceController` → `429` en la petición 11, que demuestra que el
        cupo de 120/min de `workspace` es real y no heredado.
- [x] **T-014** · backend · Throttler `workspace` y cobertura de throttler en todos los controladores (AC-24) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test throttle-coverage` → **1 suite / 9 tests** ·
      `pnpm --filter @one-markdown/api test:e2e workspace-throttle` → **1 suite / 6 tests** ·
      `pnpm --filter @one-markdown/api test:e2e auth-throttle` → **1 suite / 12 tests** (regresión: los
      throttlers de auth siguen igual) · `pnpm --filter @one-markdown/api test redis-throttler` →
      **1 suite / 7 tests** (el quinto nombre no rompe el storage). Verificado por el orchestrator, los
      cuatro comandos, con esas cifras.
      **Cero cambios de producción**: el GREEN ya estaba hecho por `T-005` y `T-010`, que añadieron
      `workspace` a `THROTTLE_NAMES`/`THROTTLE_LIMITS` (120 / 60 s) y `@Throttled('workspace')` a los tres
      controladores del módulo al crearlos. Lo que faltaba eran los dos archivos de test, y **el agente lo
      dijo en vez de inventar un rojo** — misma conducta que `T-016` y `T-024` con las partes de su
      enunciado ya cerradas. Un RED fabricado para que el guion cuadre es el falso positivo que este
      seguimiento existe para no tener.
      La pieza que sí es nueva y la que da valor duradero es `throttle-coverage.spec.ts`: recorre los
      `*.controller.ts` de `src/**` y exige que **cada uno** declare `@Throttled(` o `SkipThrottling(`.
      Con throttlers nombrados y opt-in, un controlador nuevo no se queda con un límite malo: se queda
      **sin ninguno**, que es un fallo silencioso. Este test lo convierte en un rojo.
- [x] **T-015** · backend · Swagger de workspace (AC-26) — 2026-07-25 · agente `backend`
      RED: **3 fallos reales** → GREEN: `pnpm --filter @one-markdown/api test:e2e swagger` →
      **2 suites / 105 tests** (62 casos nuevos; venía de 43 tras `T-018` de la Fase 3). Verificado por el
      orchestrator con la misma cifra.
      **Uno de los tres rojos enseña algo que merece quedar escrito**: un `@Query()` con DTO se publica
      **explotado en parámetros sueltos**, así que la clase nunca llega por sí sola a
      `components.schemas` — `DeleteDirectoryQueryDto` no aparecía aunque estuviera perfectamente
      decorada. Se resolvió con `@ApiExtraModels(DeleteDirectoryQueryDto)` en `directories.controller.ts`,
      que la registra sin cambiar cómo viaja el parámetro. Verificado en el código por el orchestrator.
      **Los siete DTO de entrada son exactamente siete, y la cifra no está escrita a mano**: el test los
      deriva con `readdirSync` sobre `src/workspace/dto/` filtrando `*.request.dto.ts` y `*.query.dto.ts`,
      así que un octavo DTO sin documentar rompe la igualdad en vez de pasar desapercibido.
      **La red de nombres de Prisma se demostró no vacía**, que es lo que le faltaba al test heredado de la
      spec `001`: igualdad **exacta** con `['Directory', 'Document', 'MfaRecoveryCode', 'User']` —si la
      regex sobre `schema.prisma` dejara de leer, la lista quedaría vacía y el test pasaría por vacuidad—
      más una mutación de control (`@ApiSchema({ name: 'Directory' })`) que hizo caer **tres** tests,
      incluido el heredado de `001`.
      **Destapó la contradicción del `404` de `/tree`**, que se resuelve en la v0.2.2 de la spec y deja la
      tarea `T-025`. Ver la nota «El `404` que no puede ocurrir» al final de este archivo. El agente
      siguió el AC —que es lo correcto— y **reportó la discrepancia en vez de elegir por su cuenta entre
      dos artefactos aprobados**; la decisión era del orchestrator.
- [x] **T-025** · backend · `GET /api/workspace/tree` deja de declarar el `404` que no puede emitir (AC-26) — 2026-07-25 · agente `backend`
      Tarea **nueva de la v0.2.2**, salida de la contradicción que midió `T-015`. Numeración append-only,
      igual que `T-024`. **No añade comportamiento**: quita `@ApiNotFoundResponse` de
      `workspace.controller.ts` y separa en `swagger.e2e-spec.ts` la aserción de `404` (nueve rutas) de la
      de `401`/`429` (las diez), con un caso **en negativo** que exige que `/api/workspace/tree` **no**
      tenga la clave `'404'`.
      **RED: un solo fallo y en negativo**, que es exactamente lo que la tarea predecía —
      `GET /api/workspace/tree no declara 404, y no por estar vacío` →
      `Expected value: not "404" / Received array: ["200","401","404","429"]`.
      El «y no por estar vacío» del título no es adorno: el array recibido **es** el juego real de claves de
      la operación resuelta, y el caso afirma antes que la operación existe, que su `operationId` es
      `getWorkspaceTree` y que declara `200`/`401`/`429`. Sin esas tres afirmaciones previas, «no tiene la
      clave `404`» sería cierto por vacuidad sobre un objeto ausente y el test seguiría verde con la ruta
      borrada. Verificado en el código por el orchestrator (`apps/api/test/swagger.e2e-spec.ts`).
      GREEN: `@ApiNotFoundResponse` y su `import` fuera de `workspace.controller.ts`, con el comentario
      invertido —esta ruta no resuelve ningún id, así que no documenta `404`—. Ningún otro controlador
      tocado.
      **Verificación corrida por el orchestrator, no reportada por el agente** (su suite de cierre no llegó
      a ejecutarse), **desde estado limpio** (`rm -rf packages/shared/dist` + rebuild antes):

      | Comando | Resultado |
      |---|---|
      | `pnpm --filter @one-markdown/api test:e2e swagger` | 2 suites, **125 passed** |
      | `pnpm --filter @one-markdown/api test` | 19 suites, **264 passed** |
      | `pnpm --filter @one-markdown/api test:e2e` (**completo, sin filtro**) | 20 suites, **455 passed** |
      | `pnpm --filter @one-markdown/api --filter @one-markdown/shared typecheck` | exit 0 |
      | `pnpm --filter @one-markdown/api --filter @one-markdown/shared lint` | exit 0 |

      **La cuenta cuadra, y por eso vale como medición**: 435 → 455 son +20, que es exactamente el
      desdoblamiento de los dos `it.each` de 10 en 10+9 y 10+9 (los de `401`/`429` y `ErrorResponseDto`
      siguen sobre las diez rutas; los de `404` pasan a nueve) **más** los 2 casos nuevos (el ancla de la
      partición y el caso en negativo). Ni un test apareció ni desapareció por otra vía.
      **`prettier --check` sobre los dos archivos tocados dio un fallo de formato real** —el agente lo
      avisó como incierto en vez de darlo por bueno—; se corrigió con `--write` y se revalidó el e2e de
      swagger en **125** verdes.
      **Con esta tarea el backend de la spec `002` queda completo**: `T-001`…`T-016`, `T-024` y `T-025`.
      **Destapó un error de criterio en el RED que había escrito el orchestrator**, corregido en la v0.2.3
      de la spec: ver la nota «Las nueve rutas con `404` no son las que llevan `{id}`» al final de este
      archivo.
- [x] **T-016** · backend · Contrato de workspace en `packages/shared` (AC-27) — 2026-07-25 · agente `backend`
      RED: **25 casos** en rojo con `TypeError: isDirectoryNode is not a function` (y lo mismo con los
      otros tres guards) → GREEN: `pnpm --filter @one-markdown/shared test` → **65 tests** (venía de 39) ·
      `pnpm typecheck` **con `packages/shared/dist` borrado antes** → los **tres** paquetes en el `DONE` ·
      `pnpm lint` en el `DONE`. Verificado por el orchestrator: `--filter shared test` → **65 passed**, y
      `DirectoryNode`, `DocumentSummary`, `MarkdownDocument` y `WorkspaceTree` con sus cuatro guards
      exportados desde `packages/shared/src/index.ts`.
      **La verificación extra que hizo, y que es la que da valor al `implements`**: alteró `depth: number`
      → `string` **en el artefacto compilado `dist/index.d.ts`** (no en el fuente) y el `typecheck` de
      `apps/api` falló **en dos archivos**. O sea que el `implements DirectoryNode` de los DTO **no es
      decorativo**: si el contrato compartido y el DTO divergen, el fallo sale en compilación y no en el
      navegador. Comprobado por el orchestrator que los cuatro DTO de respuesta del workspace declaran su
      `implements` contra el tipo compartido.
      **Y lo que no hizo, que también cuenta**: parte del enunciado —el `code?: string` de
      `ApiErrorShape`— ya estaba cerrada por `T-004`. El agente lo comprobó y lo **dijo**, en vez de
      fabricar un rojo para que el guion cuadrara.
- [x] **T-024** · backend · `AllExceptionsFilter` traduce el `PayloadTooLargeError` de body-parser (AC-33) — 2026-07-25 · agente `backend`
      **La salvedad de verificación que llevaba escrita queda LEVANTADA el 2026-07-25**: al cerrar la ola
      4 se corrió `pnpm --filter @one-markdown/api test:e2e` **completo y sin filtro** → 20 suites /
      **435 passed**. Ver la tabla «Cierre del backend de la spec `002`» más arriba.
      GREEN: `pnpm --filter @one-markdown/api test all-exceptions` → **1 suite / 12 tests** ·
      `pnpm --filter @one-markdown/api test:e2e "body-limit|validation"` → **2 suites / 11 tests** ·
      suite unitaria completa del API → **18 suites / 255 tests** · regresión dirigida
      `pnpm --filter @one-markdown/api test:e2e "auth-|health|swagger"` → **10 suites / 163 tests**,
      **ningún test de `000` ni de `001` en rojo**, que era la condición explícita de la tarea ·
      `typecheck` y `lint` en el `DONE`. Archivo e2e nuevo: `apps/api/test/body-limit.e2e-spec.ts`.
      Verificado por el orchestrator: `test all-exceptions` → **12 passed**, y el filtro leído entero.
      **Tarea nueva de la v0.2.0**, salida de lo que midió `T-008`. Lleva el número 24 porque la
      numeración es **append-only** —renumerarla dentro del Bloque D rompería las referencias ya escritas
      en este archivo y en la tabla de trazabilidad—, pero pertenece al Bloque D y va en la **ola 4**.
      Toca `apps/api/src/common/filters/all-exceptions.filter.ts`, que es contrato de la spec `000`: mismas
      reglas que `T-004`. Su cierre deja entrada en `specs/000-foundation/CHANGELOG.md` **v0.1.6** (la
      v0.1.5 anunciaba el cambio; la v0.1.6 lo cierra) y en `specs/002-workspace-tree/CHANGELOG.md`
      **v0.2.1**, con la regla también en `plan.md` §1 y §4.

      **Cómo quedó la detección** — se registra aquí porque es la parte que se erosiona con el tiempo, y
      la versión laxa parece equivalente y no lo es:
      · **Duck typing sobre `status` y `statusCode`** (`http-errors` pone las dos) con
        `Number.isInteger(value) && value >= 400 && value <= 499`: rango **cerrado**, no «tiene `status`».
        Sin `import` de `http-errors` ni `instanceof` — sigue siendo transitiva de Express y la regla de
        cero dependencias nuevas queda intacta.
      · **Un `status: 502` no entra en el rango**: cae al `500` genérico y **sigue** pasando por
        `logger.error` con traza. Lo sostiene el otro cambio de la tarea: la decisión de loguear dejó de
        depender del **origen** (`!isHttp || status >= 500`) y ahora depende del **estado**
        (`status >= 500`). Con eso el `413` deja de escribir traza —el defecto operativo que motivó
        AC-33— sin que ningún `5xx` deje de registrarse.
      · **Del error ajeno solo se publica `message`, y solo si es string**; **`code` nunca se copia**, para
        que una librería cualquiera no pueda rellenar el `code` de dominio del workspace, que es con el que
        el frontend distingue cinco `409` distintos.
      · Casos cubiertos por test: `'nope'`, `413.5`, `NaN`, `null`, `true` (no enteros) y `399`, `200`,
        `0`, `-1`, `600` (fuera de rango).

      **Salvedad de verificación (deuda ya SALDADA el 2026-07-25; se conserva el texto porque explica por
      qué se aceptó una regresión dirigida en su momento)**: `T-024` **no** corrió
      `pnpm --filter @one-markdown/api test:e2e` completo — se lo prohibió el orchestrator porque otros
      agentes estaban escribiendo e2e de workspace en `test/**` y una corrida completa habría medido un
      árbol a medias. Lo sustituyó por la regresión dirigida de **12 suites / 174 tests** (las 2 suites /
      11 de `body-limit|validation` más las 10 suites / 163 de `auth-|health|swagger`). **El e2e completo
      del backend debe correrse al cerrar la ola 4**; hasta entonces este check-off lleva la salvedad
      escrita. Ver «Deuda abierta de la ola 4» al final del archivo.
      **Parte del enunciado ya estaba cerrada**: el `code?: string` de `ApiErrorShape` lo había hecho
      `T-004`, y el agente lo reportó en vez de inventar un rojo.

### Cierre del backend de la spec `002` (ola 4) — 2026-07-25

Corrida **de una vez y sin ningún agente escribiendo en `apps/api`**, que es la condición que la propia
fase se puso para que la cifra signifique algo, y **desde estado limpio** (`rm -rf packages/shared/dist`
antes, dejando que `shared:build` lo reconstruya):

| Comando | Resultado |
|---|---|
| `pnpm --filter @one-markdown/api test` | 19 suites, **264 passed** |
| `pnpm --filter @one-markdown/api test:e2e` (**completo, sin filtro**) | 20 suites, **435 passed** |
| `pnpm --filter @one-markdown/api --filter @one-markdown/shared typecheck` | exit 0 |
| `pnpm --filter @one-markdown/api --filter @one-markdown/shared lint` | exit 0 |

`typecheck` y `lint` se corren filtrados a los dos paquetes del backend **a propósito**: el agente
`frontend` está escribiendo `apps/web` en este momento, y un `pnpm typecheck` de la raíz mediría un árbol
a medias — el mismo motivo por el que `T-024` no corrió el e2e completo en su día. La corrida de raíz se
hace al cerrar la Fase 4.

**Con esto queda saldada la deuda del e2e completo que dejó `T-024`** (punto 1 de «Deuda abierta de la
ola 4»): se corrió entero **dos veces**, `373` tras `T-014` y `435` tras `T-015`, en las dos ocasiones con
las 20 suites en verde. La salvedad escrita en la línea de `T-024` **queda levantada**.
La diferencia entre las dos corridas **cuadra exactamente**: `435 − 373 = 62`, que son los 62 casos que
`T-015` añadió a `swagger.e2e-spec.ts`. O sea que entre una y otra no apareció ni desapareció ningún test
por otra vía, que es la comprobación que convierte dos números en una medición.

Bloque E — Frontend:

- [x] **T-017** · frontend · Cliente HTTP: `PATCH`, `DELETE`, `204` y funciones de workspace — 2026-07-25 · agente `frontend`
      RED: **23 fallos** (`TypeError: getWorkspaceTree is not a function`, y lo mismo con las otras nueve)
      → GREEN: `pnpm --filter @one-markdown/web test http` → **48 tests** verdes (venía de 25 tras `T-020`
      de la Fase 3). Verificado por el orchestrator con la misma cifra, y las **diez** funciones de
      workspace leídas en `apps/web/src/shared/api/http.ts`.
      **Hubo un segundo rojo intermedio, y es el que `tasks.md` predecía**: con las diez funciones ya
      escritas pero los `DELETE` pasando todavía por el camino JSON, el test dio
      `expected "json" to not be called at all, but actually been called 1 times`. Un `204` no trae
      cuerpo, así que `response.json()` revienta o devuelve basura según el navegador; la aserción no es
      sobre el valor devuelto sino sobre **que no se intente parsear**, que es la única forma de fijar
      eso. Vale la pena registrarlo porque es un RED que llegó **después** del primer verde parcial: la
      tarea no estaba hecha cuando las funciones existían.
- [x] **T-018** · frontend · `useWorkspaceStore` — 2026-07-25 · agente `frontend`
      GREEN: `pnpm --filter @one-markdown/web test workspace.store` → **21 tests** verdes. Verificado por
      el orchestrator con la misma cifra.
- [x] **T-019** · frontend · Árbol accesible en la barra lateral (AC-28) — 2026-07-25 · agente `frontend`
      GREEN: `pnpm --filter @one-markdown/web test WorkspaceTreeView` → **19 tests** ·
      `pnpm --filter @one-markdown/web test` (completo) → **10 archivos / 156 tests**. Verificado por el
      orchestrator: los 19 de `WorkspaceTreeView`, y el completo hoy da **11 / 169** porque `T-022` ya
      añadió `DocumentViewPage.test.tsx` — el 10 / 156 es la foto del `DONE`, igual que el `12` de
      `T-010` frente a los 15 casos de hoy.
      **Hallazgo que ningún test habría cazado, y por eso se registra entero.** Los tests de la web corren
      con `css: false`, así que ninguna aserción de JSDOM ve una clase de Tailwind resuelta. El agente
      construyó con `vite build` y **grepeó el CSS generado**; ahí apareció un defecto real: el
      `treeitem` llevaba `outline-none`, que fija `--tw-outline-style: none`, la fila hija lo **hereda**,
      y `outline-2` resuelve el estilo **por esa variable** — con lo que **el anillo de foco no se habría
      pintado nunca**. Corregido con `outline-solid` explícito y verificado en el CSS de salida.
      Verificado por el orchestrator en `apps/web/src/features/workspace/TreeNodeRow.tsx`: el `treeitem`
      conserva `outline-none` y la fila lleva
      `[[role=treeitem]:focus-visible>&]:outline-solid` junto a `outline-2` y `outline-blue-700`.
      Es exactamente la clase de defecto de accesibilidad que un test de JSDOM no puede ver: la marca es
      correcta, los `role`/`aria-*` son correctos, el roving tabindex funciona… y el usuario de teclado no
      ve dónde está. **Lección aplicable a `T-020`…`T-023`**: para un criterio de foco visible, el
      artefacto a inspeccionar es el CSS construido o el navegador real (`T-023`), no el DOM de Vitest.
- [x] **T-020** · frontend · Crear, renombrar y borrar desde la UI (AC-29) — 2026-07-25 · agente `frontend`
      RED **de aserción, no de import**: `12 failed | 19 passed`, todos por comportamiento ausente
      (`Unable to find role="button" and name "Nuevo en la raíz"`, y sus hermanos). Los 19 que pasaban son
      los de `T-019`: el rojo no arrastró el árbol accesible que ya estaba cerrado.
      GREEN: `pnpm --filter @one-markdown/web test WorkspaceTreeView` → **1 archivo / 31 tests** ·
      completo → **12 archivos / 188** (venía de 11 / 169) · `typecheck`, `lint` y
      `prettier --check apps/web/src` limpios. Verificado por el orchestrator: `pnpm test` de raíz →
      web **12 / 188**, api **19 / 264**, shared **65**.
      **Cinco decisiones que se registran porque son decisiones, no detalles de implementación**:
      · **`ModalDialog.tsx`**, caparazón compartido que `tasks.md` no nombraba: `role="dialog"`,
        `aria-modal`, foco atrapado, `Escape` y devolución del foco al elemento que abrió. A mano y **sin
        librería porque `jsdom` no implementa el modo modal de `<dialog>`** — con el elemento nativo los
        tests no habrían podido comprobar nada de lo que AC-29 exige. Los cuatro diálogos lo usan.
        Verificado en el código por el orchestrator (`role="dialog"`, `aria-modal="true"`, `Escape`,
        `focusableItems`, `opener?.focus()`).
      · **`CreateNodeForm` va en un modal, no *inline* en la fila**: un `<form>` dentro del `role="tree"`
        rompería el patrón WAI-ARIA, que solo admite `treeitem`/`group` como descendientes.
      · **Dos añadidos al store, que es contrato de `T-018`** — por eso importa el porqué: `expand(id)`
        idempotente, y un `mutate` que acepta `{ reloadOnError }` **que solo pasan
        `moveDirectory`/`moveDocument`**. AC-30 exige recargar ante `409` **y** `404`; el `mutate`
        genérico recarga solo ante `404`, y AC-29 necesita ese contrato **intacto** para su caso «el `409`
        no cambia el árbol». Ampliarlo para todos habría hecho pasar AC-30 rompiendo AC-29. Ningún test de
        `T-018` se tocó y los 21 siguen verdes. Verificado en `workspace.store.ts`: `reloadOnError` solo
        aparece en las dos acciones de move.
      · **«Nuevo en la raíz» va DESPUÉS del árbol en el DOM.** Puesto antes, robaba la primera parada de
        tabulación al roving tabindex de `T-019` y rompió **10** tests de teclado. Se arregló **moviendo el
        botón, no ajustando aquellos tests** — que es lo que vale la pena registrar: el rojo estaba
        diciendo la verdad, y la salida fácil habría sido relajar diez aserciones de accesibilidad.
        Verificado en `WorkspaceTreeView.tsx`: el botón está tras el `role="tree"`, con el motivo en un
        comentario.
      · **Borrar el documento abierto saca de la ruta**: tras un borrado con éxito, si el id de
        `/documents/:id` ya no está en `documentsById` **tras la recarga**, se navega a `/`. La
        comprobación es *post-recarga* y **no** por «id borrado», así que cubre también borrar el
        **directorio** que lo contenía — el caso que la comprobación ingenua se habría dejado. Lo hace el
        árbol; `DocumentViewPage` sigue sin escuchar el store. **Con esto queda cerrada la deuda funcional
        que `T-022` dejó escrita.** Verificado en `deleteNode()` de `WorkspaceTreeView.tsx`.
      Y una consecuencia asumida, escrita para que nadie la descubra como si fuera un fallo: un error de
      mutación **cierra el diálogo** y lleva el foco al `role="alert"` que ya existía en el árbol (no a un
      tercer contenedor), así que **se pierde el texto tecleado**.
- [x] **T-021** · frontend · Mover desde la UI (AC-30) — 2026-07-25 · agente `frontend`
      RED: `7 failed (7)` — el archivo entero en rojo, que es lo correcto para un diálogo que no existía.
      GREEN: `pnpm --filter @one-markdown/web test MoveNodeDialog` → **1 archivo / 7 tests** · regresión
      completa de la web → **12 archivos / 188**. Verificado por el orchestrator con la misma cifra.
      El `{ reloadOnError: true }` del store es de esta tarea (ver `T-020`): AC-30 pide recargar el árbol
      ante `409` **y** `404`, y ése es el único punto donde el árbol de la pantalla puede haber dejado de
      ser cierto — si el servidor dice que el destino es un descendiente y aquí no lo parecía, lo que está
      viejo es el cliente.
- [x] **T-022** · frontend · Ruta `/documents/:id` con vista en crudo (AC-31) — 2026-07-25 · agente `frontend`
      RED **de aserción, no de import**: `10 failed | 1 passed`. El agente dejó un andamio
      `<p>Pendiente</p>` a propósito para que el rojo fuera de **comportamiento** — un módulo inexistente
      habría dado el mismo rojo con cualquier aserción, incluidas las que no discriminan. Los mensajes
      reales: `expected '/' to be '/documents/doc-raiz'`, `Unable to find role="heading" and name "Lunes"`,
      `Unable to find .../cargando el documento/i` y `Unable to find role="alert"`.
      GREEN: `pnpm --filter @one-markdown/web test DocumentViewPage` → **1 archivo / 12 tests** ·
      `pnpm --filter @one-markdown/web test routes` → **1 archivo / 5 tests** ·
      `pnpm --filter @one-markdown/web test` (completo) → **11 archivos / 169 tests** (venía de 10 / 156
      tras `T-019`) · `typecheck`, `lint` y `prettier --check apps/web/src` limpios.
      **Decisión de diseño que conviene tener escrita**: el **título** de la vista sale del documento que
      devuelve el `GET`, **no** de `documentsById`; la **ruta del breadcrumb** sí sale de
      `directoriesById` + `parentId`. El motivo es que entrar por URL directa a `/documents/:id` —un enlace
      pegado, un recargar— tiene que funcionar aunque el árbol todavía no haya llegado, y además el título
      del `GET` es el autoritativo: si el árbol está viejo, la vista no debe mostrar un nombre que ya no es.
      **Cambio obligado en un test ajeno, y el acoplamiento que lo causó**: enganchar `useNavigate()` en
      `activate()` de `WorkspaceTreeView.tsx` rompió las **19** pruebas de `T-019`, porque `useNavigate()`
      revienta fuera de un `<Router>`. El arreglo fue mecánico y mínimo —un helper `renderTree()` que
      envuelve el árbol en `MemoryRouter`—, y queda registrado porque es justo el tipo de acoplamiento que
      sorprende a quien toque el árbol después: desde `T-022`, **montar `WorkspaceTreeView` exige un
      router**. Verificado en el código por el orchestrator: `WorkspaceTreeView.tsx` importa `useNavigate`
      y `WorkspaceTreeView.test.tsx` monta con `{ wrapper: MemoryRouter }`.
      La navegación se hace en `activate()` y **no** con un `<Link>` dentro de la fila, también a propósito:
      el elemento enfocable del roving tabindex es el `treeitem`, y un ancla añadiría una segunda parada de
      tabulación por nodo, rompiendo el patrón *tree* que cerró `T-019`.
      **Deuda funcional que `T-022` dejó explícita y que `T-020` resolvió**: la vista de
      `/documents/:id` **no escucha el store**, así que por sí sola no se entera de que el documento abierto
      se ha borrado. `T-020` tenía que decidir si añadía la navegación de salida, y **la añadió en el árbol,
      no en la vista**: `deleteNode()` de `WorkspaceTreeView.tsx` lee el id abierto de la ruta antes de
      borrar y, si tras la recarga ese id ya no está en `documentsById`, navega a `/`. Verificado en el
      código por el orchestrator; el check-off formal va con `T-020`, que sigue en curso.
- [x] **T-023** · frontend · e2e del árbol en navegador (AC-32) — 2026-07-25 · agente `frontend` ·
      **última tarea de la spec**
      GREEN: `pnpm test:e2e` → **5 passed**, con el smoke (3) y el e2e de auth (1) verdes.
      **Verificado por el orchestrator con la suite corrida por él mismo**: `5 passed (8.8s)`, y la
      limpieza de `global-teardown` informando `cuentas de prueba borradas: 3` — que es la cuenta
      compartida del smoke más las dos que estrenan `auth` y `workspace`, o sea la confirmación de que el
      gasto de altas es el que dice AC-35.
      **No cabía un rojo natural** —la UI ya existía— y el agente lo resolvió como debía: **tres
      mutaciones de control, una por cada eje del recorrido**, todas revertidas y verificadas con `grep`.
      Un solo control habría dejado dos ejes sin demostrar:
      · forzar `recursive=false` → `Expected: 1 · Received: 3` treeitems (eje **borrado en cascada**);
      · un `console.error` al abrir un documento → el aserto de consola lo caza (eje **consola limpia**);
      · `onMove(node.parentId)` en vez del destino elegido → `aria-level` `Expected: "1" · Received: "3"`
        (eje **mover de verdad**, no repintar).
      **Corrigió la spec**: AC-32 decía «el árbol queda vacío» y su propio recorrido lo impide —el
      documento se muda a la raíz **antes** del borrado recursivo—. Se implementó lo que decía `tasks.md`
      («solo el documento movido»), que además prueba más: que el documento **sobreviva** es justo la
      prueba de que la cascada se lleva el subárbol y **solo** el subárbol. Redacción corregida en la
      v0.3.0 de la spec.
      **Tocó una línea de configuración, `playwright.config.ts`**, y sin ella la suite no es reproducible:
      `pnpm dev --force`. Es la mitigación del hallazgo 1 de más abajo; `T-026` la retira.

Bloque F — Endurecimiento del entorno (alcance de la v0.3.0, cerrado en la v0.3.1):

- [x] **T-026** · frontend · `optimizeDeps.force` en `vite.config.ts` y retirada del `--force` de
      `playwright.config.ts` (AC-34) — 2026-07-25 · agente `frontend`
      **RED de comportamiento, medido y no inferido**, que es lo que el enunciado exigía —un test que lea
      `vite.config.ts` y afirme que dice `force: true` sería una tautología—: con el `--force` retirado de
      `playwright.config.ts` y `apps/web/node_modules/.vite/deps/@one-markdown_shared.js` sembrado **sin**
      `isWorkspaceTree` (`grep -c` → **0**) y **sin tocar `_metadata.json`**, `pnpm test:e2e` →
      **`1 failed / 4 passed`**. Y el fallo es **el correcto**, no un rojo cualquiera: snapshot con
      `alert: Ocurrió un error inesperado…` **y** traza de red del mismo caso con
      `/api/workspace/tree | 200`. O sea que el servidor respondía bien y quien fallaba era el bundle
      rancio, que es exactamente el defecto que AC-34 describe.
      **La demostración en tres pasos, y se registra porque es la que descarta la explicación alternativa.**
      Ese rojo, solo, deja viva la hipótesis de que a la caché la salve después el **`configHash` nuevo**
      que introduce el propio cambio de `vite.config.ts` —un `configHash` distinto invalida la caché por su
      cuenta, y entonces el `force` sería decorativo—. El agente lo descartó envenenando **contra ese mismo
      `configHash`**:
      1. `pnpm test:e2e` ya con `force: true` → **5 passed**; la caché queda reconstruida **con el
         `configHash` nuevo**.
      2. Se envenena **esa** caché: `grep -c isWorkspaceTree` pasa de **2** a **0**, y `node --check`
         confirma que el fichero envenenado **sigue siendo JavaScript válido** — o sea que el guard llega
         `undefined` y **no** hay un error de parseo que enmascare el resultado por otro camino.
      3. `pnpm test:e2e` → **5 passed**.
      Con los dos hashes casando, lo único que puede salvar esa caché es `force`. Sin el paso 3 este
      check-off habría sido decorativo.
      **DONE**: `pnpm test:e2e` → **5 passed** · `pnpm --filter @one-markdown/web test` → 12 archivos /
      **188**, sin cambios · `typecheck` y `lint` EXIT=0 · `prettier --check` limpio.
      Verificado en el código por el orchestrator: `apps/web/vite.config.ts` lleva
      `optimizeDeps: { include: ['@one-markdown/shared'], force: true }` con el mecanismo de los dos hashes
      y la salida ESM escritos en el comentario, y `apps/web/playwright.config.ts` arranca la web con
      `command: 'pnpm dev'` **sin `--force`**, con el porqué anotado en el propio archivo. Se respetó la
      lista de archivos de la tarea: esos dos y nada más. **Ningún test de `000` cayó.**
      Entrada de cierre en `specs/000-foundation/CHANGELOG.md` **v0.1.7** (`vite.config.ts` es contrato de
      esa spec), que además **cierra la revisión que la v0.1.4 dejó apuntada**: «se revisará cuando la spec
      `002` amplíe el contrato compartido» — la amplió, y la mitigación de entonces resultó insuficiente.
- [x] **T-027** · frontend · Cupo de altas y de entradas de la suite de navegador (AC-35) — 2026-07-25 ·
      agente `frontend`
      **RED real, corrido antes de tocar nada**:
      `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` →
      **`10 failed / 5 passed`**, con `POST /api/auth/register devolvió 429`. Es el rojo que el enunciado
      había escrito por adelantado.
      **DONE, los tres comandos**: el mismo `--retries=2 --repeat-each=3` → **15 passed**, EXIT=0 ·
      `pnpm test:e2e` → **5 passed** · `pnpm --filter @one-markdown/api test:e2e` → 20 suites / **455**,
      que es lo que prueba que el rate limit de `001` **sigue** verificándose donde le toca.

      **Dos desviaciones, y las dos corrigen la decisión del orchestrator, no la del agente.** Van también
      en la spec (`spec.md` AC-35, `tasks.md` T-027, `CHANGELOG.md` v0.3.1), porque un pendiente que solo
      vive en el seguimiento es como desaparece la deuda en este proyecto:

      1. **AC-35 no se puede cerrar tocando solo `throttle:register:*`.** El reset hubo que aplicarlo
         **también a `throttle:login:*`**. La cuenta real del escenario del AC —todos los casos agotando
         `retries: 2`—: smoke 3 casos × 3 intentos = **9** entradas, más el flujo de auth, que vuelve a
         entrar en cada intento (**3**) → **12 contra un cupo de 10/min**. Ese gasto **ya existía** antes
         del cambio: el `signIn` viejo también hacía `login` después del `409`; lo que pasaba es que el
         `429` de `register` llegaba primero y lo tapaba. Medido, no supuesto: con el reset solo de
         `register`, el `DONE` seguía **rojo** con `POST /api/auth/login devolvió 429`. El agente verificó
         **antes** de neutralizarlo que el límite de `login` está cubierto en
         `apps/api/test/auth-throttle.e2e-spec.ts`, así que **la cobertura perdida es cero**.
      2. **`global-setup.ts` crea la cuenta compartida una sola vez, y ese archivo no estaba en la lista de
         `T-027`.** El motivo es un efecto de segundo orden que arrastraba la decisión «login antes de
         registrar» y que la cuenta no contemplaba: si cada caso prepara la cuenta por su lado, en una base
         limpia **todos** los trabajadores empiezan con un `login` fallido contra una cuenta que aún no
         existe, y **5 fallos bloquean la cuenta 15 minutos** (`LoginAttemptService`). Ese bloqueo es **por
         cuenta, no por IP**, así que **ningún reset de `throttle:*` lo evita**; en local Playwright levanta
         **6** trabajadores y era una moneda al aire. Hacer el alta **una vez, antes de que arranque ningún
         caso**, lo elimina **por construcción** y de paso baja el gasto del smoke de **3 altas a 0**. El
         agente verificó en el bundle de Playwright 1.62 (`runner/index.js`, `createGlobalSetupTasks`) que
         los plugins de `webServer` corren **antes** de `globalSetup`, así que el API ya responde cuando se
         prepara la cuenta; `signIn` conserva un camino de reserva por si acaso.

      **Verificado en el código por el orchestrator, no leído del informe**: `support/services.ts` exporta
      `resetRegisterThrottleCounter` y `resetLoginThrottleCounter` sobre un `resetThrottleCounter` acotado
      por tipo a `'register' | 'login'` —los contadores de `mfa`, `refresh` y `workspace` quedan intactos y
      la suite los sigue gastando de verdad— y ese reset **lanza** si Redis falla, en vez de ser
      best-effort, para que un `429` posterior no se lea como un fallo de la interfaz;
      `global-setup.ts` llama a `ensureSharedAccount()` **después** de `resetDevServices()`, que es justo
      quien borra la cuenta; y `grep -rn "throttle:" apps/api/test/` **no devuelve nada**, o sea que **no se
      aplicó ningún reset en la suite del API**.
      Entrada de cierre en `specs/001-auth/CHANGELOG.md` **v0.1.1** (el andamiaje e2e es de esa spec).

### Lo que queda sin cobertura automática, escrito sin adornar (2026-07-25)

Sale del cierre de `T-026` y `T-027`. Está también en `spec.md` (AC-34, AC-35 y §6) porque es donde
sobrevive cuando este archivo crezca:

1. **El envenenado de la caché de AC-34 es manual y CI no lo cazará nunca.** El runner arranca siempre con
   `node_modules/.vite` frío, así que allí `force: true` y su ausencia son **indistinguibles**. Lo que sí
   queda vigilando es la retirada del `--force` de `playwright.config.ts`: a partir de ahora, si alguien
   quita el `force` de `vite.config.ts`, `pnpm test:e2e` se rompe **en local** para cualquiera con caché
   previa, y **en CI no**. El defecto vive en la máquina de quien desarrolla, que es justo donde CI no mira.
2. **La suite de navegador ya no detecta los límites de `register` ni de `login`**: los neutraliza a
   propósito. Quien los verifica es `apps/api/test/auth-throttle.e2e-spec.ts` (un caso por cada uno) y
   `apps/api/test/auth-login.e2e-spec.ts` (`AC-7: bloqueo por cuenta tras cinco fallos`). **No se aplicó
   ningún reset en la suite del API**, y queda una nota en `apps/web/e2e/support/services.ts` —junto a la
   función que lo hace— diciendo que no se haga: aplicarlo allí destruiría la prueba de que el límite
   existe. Ese «no hacer» está también en la spec `002` (AC-35) y en el CHANGELOG de `001` v0.1.1, que es
   donde lo leerá quien no tenga el código delante.
3. **El bloqueo por cuenta (`LoginAttemptService`, 5 fallos) tampoco lo ejercita la suite de navegador**,
   ni antes ni ahora. Se evita **por construcción** —una sola alta en `global-setup.ts`—, no se neutraliza.

### Cierre de la Fase 4 y de la spec `002` (2026-07-25)

**Las 27 tareas cerradas y los 35 AC verificados.** Cifras finales corridas **por el orchestrator**, de una
vez, con `apps/web` ya libre de agentes escribiendo y **desde estado limpio** (`rm -rf
packages/shared/dist` + rebuild) — que es la condición que esta fase se puso desde el principio para que un
número signifique algo:

| Comando | Resultado |
|---|---|
| `pnpm --filter @one-markdown/shared test` | **65 passed** |
| `pnpm --filter @one-markdown/web test` | 12 archivos, **188 passed** |
| `pnpm --filter @one-markdown/api test` | 19 suites, **264 passed** |
| `pnpm --filter @one-markdown/api test:e2e` (completo, sin filtro) | 20 suites, **455 passed** |
| `pnpm test:e2e` (Playwright, navegador real) | **5 passed** |
| `playwright test --retries=2 --repeat-each=3` (el `DONE` de `T-027`) | **15 passed**, EXIT=0 |
| `pnpm typecheck` (**raíz**, los tres paquetes) | exit 0 |
| `pnpm lint` (**raíz**, los tres paquetes) | exit 0 |
| `prettier --check` | limpio |

Los `typecheck`/`lint` **de raíz** son la corrida que la ola 4 dejó aplazada a propósito mientras el agente
`frontend` escribía `apps/web`: **queda hecha y en verde**, y con ella se levanta la última restricción de
medición de la fase.

_(Las cifras de `shared` **65** y de web **12 / 188** se reverificaron en el check-off final corriendo los
dos comandos otra vez: `Tests 65 passed (65)` y `Test Files 12 passed (12) · Tests 188 passed (188)`.)_

**Cobertura de AC: 35 de 35.** Los **33** del alcance aprobado con test automatizado y **ninguno sin
cobertura**; **AC-35** con un comando automatizado (`--retries=2 --repeat-each=3` → 15 passed); y **AC-34**
con un rojo **manual**, demostrado en tres pasos, que es **la única salvedad de toda la spec** y está
escrita en el propio AC y en §6 de `spec.md` en vez de vivir solo aquí. Lo comprobado para los 33,
uno por uno contra el árbol de archivos real y
no contra la tabla de trazabilidad: los **24** archivos que la tabla nombra existen, y cada AC cae dentro
de un `describe` que lo nombra o que ejercita su comportamiento. Los AC que **no** aparecen escritos
literalmente dentro de un test (AC-1, AC-2, AC-6, AC-8, AC-15…AC-20, AC-23, AC-26) están todos en bloques
titulados con su número —`describe('AC-1: alta en la raíz')`, `describe('GET /api/workspace/tree (e2e) —
AC-20')`, `describe('AC-26: las diez rutas de workspace')`…—, así que la ausencia del literal en el `grep`
no era un hueco de cobertura. **No hay ningún AC del alcance aprobado sin test automatizado.**

### Tres hallazgos del navegador que JSDOM no podía ver (2026-07-25)

Los tres salen de `T-023`. Ninguno es un defecto del árbol: dos son de **entorno** y el tercero es una
asimetría entre JSDOM y un navegador real. Los dos primeros abren tarea; el tercero, no.

**1. Caché rancia de `optimizeDeps` de Vite — rompe el árbol en desarrollo. Es un defecto real.**
Recién registrado, el árbol moría con «Ocurrió un error inesperado» **pese a que
`GET /api/workspace/tree` respondía `200`**. Causa instrumentada: `TypeError: guard is not a function` en
`expectShape`, porque el navegador recibía un `@one-markdown/shared` **sin `isWorkspaceTree`**.
`packages/shared/dist` estaba al día; lo rancio era
`apps/web/node_modules/.vite/deps/@one-markdown_shared.js` (del 25/07 00:09, o sea de la spec `001`, con
`grep -c isWorkspaceTree` = **0**).

**El mecanismo exacto, verificado con `context7` y no supuesto** (`optimizer/index.ts`,
`loadCachedDepOptimizationMetadata`, y `guide/troubleshooting.md` de Vite): la caché se invalida comparando
**`lockfileHash`** y **`configHash`**, y la documentación dice literalmente *«Vite detects dependency
overrides but not `npm link` usage»*. Conviene fijar la corrección: la primera hipótesis fue «Vite hashea
la caché por el `package.json` del paquete enlazado», y **no es eso** — es que **no mira el paquete en
absoluto**. La diferencia no es académica: la hipótesis original lleva a buscar el arreglo en el
`package.json` de `shared`, donde no está.

**Consecuencia**: cualquiera con un `pnpm dev` anterior a la spec `002` ve el árbol roto hasta que borre
`node_modules/.vite` a mano. Mitigado **solo para la suite** con `pnpm dev --force` en
`playwright.config.ts`.

**Decisión (mía, y queda escrita)**: se fuerza en `apps/web/vite.config.ts` y `playwright.config.ts` vuelve
a `pnpm dev` a secas — la suite deja de compensar un defecto del producto, que es la mitad del valor.
Alternativas descartadas **con motivo**: *publicar `shared` en ESM* es el arreglo de raíz —sin CJS no haría
falta `optimizeDeps.include` y no habría caché que envejecer— pero `apps/api` es NestJS **CommonJS** sobre
el mismo `dist` y exigiría salida dual o mover el backend a ESM: es empaquetado de los tres paquetes y
pertenece a una spec propia, no a un cierre de fase (queda apuntado como la salida futura, y ese día se van
juntos el `include` y el `force`); *documentarlo como paso manual* se descarta porque el defecto se
presenta como «el árbol está roto» con un mensaje que apunta al servidor. Coste asumido y explícito:
`force: true` re-empaqueta **todas** las dependencias en cada arranque de desarrollo.
→ **AC-34 · `T-026`**, con **RED de comportamiento** (envenenar la caché y ver fallar la app): un test que
lea `vite.config.ts` y afirme que dice `force: true` sería una tautología.

**Matiz con entrada propia**: el aviso genérico de la UI es **correcto** de cara al usuario y **engañoso**
de cara a quien depura — un `TypeError` del cliente se presenta exactamente igual que un error del
servidor, y aquí la petición había ido **bien**. Queda como **riesgo #15** de la spec y **a propósito sin
tarea**: distinguir «el servidor dijo que no» de «el cliente se rompió» obliga a decidir qué se le enseña a
la persona en cada caso, y eso es producto, no corrección de un defecto. Lo hereda la spec que toque el
manejo de errores de la UI (`003` es la primera candidata), con el caso real ya documentado. Lo que sí
entra ya, por AC-34, es que la causa concreta deje de ocurrir.

**2. El `role="tree"` vacío no existe para el usuario.** Sin filas tiene caja de cero píxeles y Playwright
lo da por `hidden`, así que `toBeVisible()` sobre el árbol vacío es un **aserto imposible**: se usa
`toBeAttached()`. **No es un fallo de accesibilidad** —el mensaje «Todavía no hay directorios ni
documentos.» sí se ve, aunque viva **fuera** del árbol, y un árbol sin nodos no tiene ninguna parada de
tabulación que ofrecer— pero se sube a AC-32 porque en JSDOM no se veía: allí `toBeVisible` no calcula
*layout* y la aserción imposible habría pasado tan campante. **Sin tarea**: no hay nada que arreglar, hay
algo que dejar escrito.

**3. Riesgo de `429` en CI con `retries: 2` — y no es de `T-023`, es de presupuesto compartido.**
`register` está limitado a **5 altas por IP cada 15 min** (`THROTTLE_LIMITS`, spec `001`) y una ejecución
limpia de la suite gasta **exactamente 5**: `smoke` **3** —su `beforeEach` llama a `signIn`, que hace
`POST /register` en **cada** caso aunque le devuelvan `409`—, `auth` **1** y `workspace` **1**. Verificado
en el código (`e2e/support/session.ts`) y en la corrida real (`cuentas de prueba borradas: 3`).
**Cualquier reintento en CI pediría la sexta y recibiría un `429`**: un rojo ajeno a lo que la suite mide,
que aparecerá justo cuando algo ya haya ido mal. El agente lo **reportó en vez de arreglarlo**, que es lo
correcto: toca andamiaje de la spec `001`.

**Decisión (mía)**: **las dos medidas, porque la barata sola no basta**. Que `signIn` intente `login` antes
de registrar baja el gasto de 5 a 3, pero **no cierra el AC**: con `retries: 2` los dos casos que estrenan
cuenta piden alta nueva en **cada** intento (1+2 y 1+2 = **6**, otra vez por encima de 5). Lo que sí lo
cierra es **poner a cero el contador `throttle:register:*` antes de cada caso que registre**, por el mismo
camino RESP-sobre-TCP que ya usa `global-setup` —sin dependencias nuevas—. Se acepta a sabiendas de que la
suite de navegador deja de poder detectar ese límite: **quien lo verifica es
`apps/api/test/auth-*.e2e-spec.ts`**, que es su sitio, porque un límite por IP se prueba contra el API y no
a través de un navegador. El razonamiento va escrito **en el propio archivo**, porque el atajo de mañana es
aplicar el mismo reset en la suite del API, donde sí destruiría la prueba.
→ **AC-35 · `T-027`**, con RED reproducible hoy:
`playwright test --retries=2 --repeat-each=3` → `429` en `POST /api/auth/register`.

### Trabajo abierto que dejaba la Fase 4 — SALDADO el 2026-07-25

Se listaron aquí y no se escondieron, siguiendo el precedente de `000` (cerrada como implemented con AC-14
esperando un run de CI) y de `001` (con `T-026` igual). **No eran alcance aprobado**: eran endurecimiento
de entorno salido de ejecutar AC-32 en un navegador real, y llegaron con la spec en **v0.3.0**.
**Las dos están cerradas y verificadas**; el detalle, con RED medido y `DONE` corrido, está en el Bloque F
más arriba, y el cierre de spec en la **v0.3.1**.

- [x] **T-026** · frontend · AC-34 — `optimizeDeps.force` en `vite.config.ts` y retirada del `--force` de
      `playwright.config.ts`. Tocó `vite.config.ts`, que es de la spec `000`: **ningún test de `000` cayó**
      y el cierre dejó entrada en `specs/000-foundation/CHANGELOG.md` **v0.1.7**.
- [x] **T-027** · frontend · AC-35 — `login` antes de `register` en `signIn`, cuenta compartida creada una
      sola vez en `global-setup.ts` **y** reset de los contadores `throttle:register:*` **y
      `throttle:login:*`** por caso (el enunciado solo decía `register`, y con eso el `DONE` seguía rojo).
      Tocó `e2e/support/*` y `global-setup.ts`, andamiaje de la spec `001`: **ningún test de `001` cayó** y
      el cierre dejó entrada en `specs/001-auth/CHANGELOG.md` **v0.1.1**.

**Con esto la Fase 4 no deja trabajo abierto.** Lo único que queda vivo del ciclo `002` es la salvedad de
cobertura de AC-34 —manual, invisible para CI— y está escrita arriba y en la spec, que es donde toca.


### Notas de la Fase 4 (2026-07-25) — infraestructura y hallazgos de la ola 1-3


**Infraestructura local: cómo se levantó la base, para quien retome la fase.** Docker Desktop no estaba
arrancado y **la integración WSL del CLI `docker` no está activa en esta distro**, así que `docker` a secas
no resuelve. Se arrancó Docker Desktop desde Windows y se usó **`docker.exe compose up -d`**. Con eso
PostgreSQL (**5433**) y Redis (**6379**) quedaron sanos y todo lo que toca la base (`migrate status`, los
`psql` de verificación de `T-001`, los e2e) funcionó sin más ajustes. No es un problema del proyecto ni hay
nada que arreglar en el repo: es el comando que hay que usar en esta máquina.

**Hallazgo pre-existente, no de esta spec: sin `packages/shared/dist` los e2e de `apps/api` no compilan.**
Al correr un e2e directamente desde estado limpio salta `TS2307: Cannot find module '@one-markdown/shared'`.
Se comprobó que **no es de `002`**: se reprodujo igual con el e2e de auth, que lleva días verde. La causa es
la conocida decisión 2b de la spec `000` (los paquetes resuelven el contrato por su `types:
./dist/index.d.ts`), y el flujo canónico ya la cubre: `pnpm typecheck` / `pnpm test` / `pnpm test:e2e`
ejecutan `shared:build` antes, así que reconstruyen `dist/` primero.
**Precisión que hacía falta sobre la regla de la Fase 4**, porque se estaba interpretando al revés: «correr
los `DONE` desde estado limpio» significa **borrar `dist/` y dejar que el flujo lo reconstruya**, no correr
los e2e con `dist/` ausente. Lo primero atrapa el falso verde del primer run de CI; lo segundo solo produce
un error de compilación que no informa de nada.

**Aviso menor a vigilar en CI**: en **1 de 4** corridas de la suite unitaria completa de `apps/api` apareció
`A worker process has failed to exit gracefully` de Jest. No se ha reproducido y `--detectOpenHandles` sale
limpio. Queda **anotado, no cerrado**: por la regla que salió de la Fase 3, un fallo que no se reproduce no
es transitorio hasta que se explica por qué desapareció. Si vuelve a aparecer —sobre todo en el runner, que
tiene menos CPU— el sospechoso natural es una conexión (Redis o Prisma) que sobrevive al `afterAll` de
alguna suite.

**Un RED que salió falso y cómo se detectó — patrón a repetir en todo e2e que espere `404`.** La primera
pasada del RED de `T-007` dio **`18 failed, 2 passed`**. Los dos que «pasaban» eran justamente los dos
casos que esperaban `404`… y pasaban **por el motivo equivocado**: la ruta `POST /:id/move` todavía no
existía y **Nest ya devuelve `404` para una ruta inexistente**. El agente lo vio y endureció los dos casos
con `expect(response.body.code).toBe('DIRECTORY_NOT_FOUND')`; con eso el rojo quedó completo, 20 de 20.

Es exactamente la clase de falso RED contra la que existe la regla de que **el test debe fallar por la
razón correcta**, y el `404` es su caso más traicionero: es el único estado que el framework produce
gratis, así que un test que solo mira el estado no distingue «el endpoint contesta bien» de «el endpoint
no existe». **Se aplica de aquí en adelante a todo e2e de esta fase que espere `404`**, y en particular a
`T-012`, que es una matriz entera de `404` sobre los diez endpoints, donde nadie notaría a ojo cuáles
pasan de verdad. El requisito ya está escrito en el RED de `T-012` en `tasks.md` (v0.2.0), en vez de
quedar como una regla general que hay que acordarse de aplicar.

**El `413` que no era `413`: un hueco de contrato que ningún test de esta spec podía ver.** `plan.md` §4
promete desde la v0.1.0 un **`413`** para un cuerpo por encima de `JSON_BODY_LIMIT`. Lo medido al
implementar `T-008` es un **`500`**: el `PayloadTooLargeError` de body-parser **no es una `HttpException`**,
así que `AllExceptionsFilter` cae a su rama genérica aunque el error traiga `status: 413`. Con el límite en
2 MiB y un tope de contenido de 200.000 caracteres, el caso cae **fuera del alcance de todos los tests de
la spec**, que es precisamente por lo que el contrato llevaba escrito desde el principio sin cumplirse.

**Decisión: se arregla el comportamiento, no el contrato** — AC-33 y la tarea `T-024`, en vez de reescribir
`plan.md` §4 para que diga `500`. Los tres motivos, en orden de peso:

1. **`500` es la respuesta incorrecta, y documentarla sería canonizar un defecto.** Un cuerpo demasiado
   grande es un error del cliente; el `4xx` es lo que le dice que reintentar igual no sirve. Un cliente
   escrito contra un `500` documentado lo tratará como fallo del servidor —reintento, alerta— y habrá que
   romperle el contrato el día que se arregle de verdad.
2. **No es solo cosmético.** El filtro registra `logger.error` **con traza completa** en todo lo que no es
   `HttpException`, así que hoy cualquiera con un token válido tiene un amplificador de ruido en los logs y
   un disparador de alertas de `5xx` gratis. Es un defecto operativo pequeño pero real.
3. **Un pendiente sin tarea y sin test es como desaparece la deuda en este proyecto.** La lección de la
   Fase 3 —«la verificación existía, pero no verificaba»— se repite aquí en su forma más pura: el contrato
   existía y nadie lo comprobaba. La corrección tiene que llegar con su AC y su comando, o no llega.

**Coste asumido, y por eso queda escrito**: `AllExceptionsFilter` es de la spec `000` (AC-5), así que
`T-024` toca contrato ajeno y deja entrada en `specs/000-foundation/CHANGELOG.md` — ya escrita como
**v0.1.5** — además de en la de `002`. La traducción se acota a un `status` **entero y en `4xx`**, con test
unitario de los dos sentidos, para que un `5xx` de una librería siga registrándose y un `Error` pelado siga
siendo `500`; sin `import` de `http-errors`, que es transitiva de Express y no una dependencia declarada
(la regla de cero dependencias nuevas sigue en pie).

**Cerrado el 2026-07-25 por `T-024`**, con la regla de detección tal como quedó escrita en su línea de la
Fase 4 y en los CHANGELOG de `000` (v0.1.6) y `002` (v0.2.1): rango `4xx` **cerrado** sobre `status` /
`statusCode`, registro por **estado** y no por origen, y `code` nunca copiado de un error ajeno.


### El `404` que no puede ocurrir: una contradicción de spec resuelta (2026-07-25)


**Lo que encontró `T-015`.** `spec.md` **AC-26** y el RED de `tasks.md` **T-015** piden que las **diez**
rutas de `/api/workspace/*` documenten `401`, `404` y `429`. `plan.md` §4, que enumera los errores **ruta
por ruta** desde la v0.1.0, lista los de `GET /api/workspace/tree` como «`401` · `429`», **sin `404`**. Es
la única ruta que no puede emitir un `404`: no resuelve ningún `:id`, y un workspace vacío responde `200`
con las dos listas vacías. Dos artefactos aprobados de la misma spec decían cosas distintas.

**Lo que hizo el agente, que es lo correcto**: siguió el AC —es la fuente de verdad del comportamiento— y
declaró el `404` con una descripción que dice explícitamente que forma parte del contrato de error común
del tag y que **esta ruta no lo emite hoy**, para no meter una mentira muda en el contrato público. Y lo
reportó, en vez de elegir por su cuenta entre dos artefactos aprobados. La decisión era del orchestrator.

**Decisión: gana `plan.md` §4. AC-26 se acota a las nueve rutas que sí producen `404`**, y el decorador se
retira del controlador. Spec en **v0.2.2**, tarea **`T-025`** escrita con su RED, su GREEN y su `DONE`.
Cuatro motivos, en orden de peso:

1. **La ruta no puede emitir un `404`**, y no por una decisión revisable sino por su forma: no hay entrada
   del cliente —ni `:id`, ni query— capaz de producir un «no encontrado». El único recurso que devuelve es
   el workspace del portador del token, que siempre existe.
2. **El argumento de «que el contrato de error del tag sea uno solo» describe un contrato que esta spec
   nunca tuvo.** `plan.md` §4 es per-ruta y deliberadamente desigual: no todas listan `400`, no todas
   listan `409`, y cada `404` va con su `code` (`DIRECTORY_NOT_FOUND` / `PARENT_NOT_FOUND` /
   `DOCUMENT_NOT_FOUND`). La uniformidad que justificaría declararlo no existe en ningún otro sitio.
3. **Documentar una respuesta inexistente es la misma clase de defecto que la spec ya decidió no cometer**
   en la v0.2.0, cuando eligió arreglar el `413` en vez de documentar el `500` que salía («documentarlo
   sería canonizar un defecto»). Aquí el sentido es inverso y la regla la misma: el documento describe lo
   que el API hace. Y la mitigación en prosa **no es legible por máquina** — un cliente generado del
   OpenAPI se lleva igualmente una rama de error muerta, que es precisamente el consumidor para el que se
   escribe el documento.
4. **El único `404` que puede ver un cliente de `/tree` es el de ruta inexistente de Nest, que no es una
   respuesta de la operación.** Confundir esos dos `404` ya costó caro dos veces en esta misma fase: es el
   falso RED de `T-007` (`18 failed, 2 passed`) y es lo que la mutación de control de `T-012` volvió a
   demostrar. Declarar un `404` justo en la ruta cuyo `404` solo puede venir del framework consagra esa
   confusión en el contrato público.

**Por qué es un patch y no un major, con la duda escrita.** La regla de este proyecto llama major a
«cambia el comportamiento observable ya implementado». Ninguna respuesta HTTP cambia: `/tree` nunca emitió
un `404` y no lo emitirá. Lo que cambia es una clave de un documento OpenAPI que describía algo que no
ocurre, sin consumidor —el contrato que consume la web es `packages/shared`, escrito a mano, y no declara
errores por ruta—. Lo que se corrige es la **precisión de un criterio** contra el artefacto que ya era
preciso, que es la definición literal de patch aquí. **La parte discutible se deja escrita en vez de
resolverse en silencio**: el efecto colateral es retocar un test de `T-015`, que está en verde, y por eso
el retoque va en una tarea con su propio RED —el caso en negativo «`/tree` no declara `404`»— y no como un
ajuste de paso. Si algún día `/tree` acepta un `:id` o una query que pueda no resolver, esto vuelve a ser
un cambio de alcance con su versión.

**Corrección de cuenta que iba en el mismo lote**: el RED de `T-012` en `tasks.md` decía «los **seis**
endpoints con parámetro de ruta» y son **siete** — tres de directorios (`PATCH`, `move`, `DELETE`) y
cuatro de documentos (`GET`, `PATCH`, `move`, `DELETE`). El test ya lo ancla con
`expect(PATH_PARAM_ENDPOINTS).toHaveLength(7)`, derivando la lista de la constante de los diez endpoints
en vez de escribirla aparte; corregido el texto para que coincida con lo verificado.


### Las nueve rutas con `404` no son las que llevan `{id}`: error de criterio en un RED (2026-07-25)


**Contexto**: el RED de `T-025`, escrito por el orchestrator en la v0.2.2, prescribía derivar las rutas que
declaran `404` **filtrando por `{id}` en la plantilla de ruta** sobre la constante de las diez, y anclar el
resultado con `toHaveLength(9)`.

**Ese filtro da siete.** Lo encontró el agente `backend` al implementar la tarea. `POST /api/workspace/
directories` y `POST /api/workspace/documents` **también** emiten `404` —con `code` `PARENT_NOT_FOUND`,
padre inexistente o ajeno— y **no** llevan `{id}` en la plantilla: reciben el id del recurso padre **en el
cuerpo** (`parentId` / `directoryId`). `plan.md` §4 lo lista desde la v0.1.0 en las líneas de errores de
esos dos endpoints; el criterio del RED simplemente no leía lo mismo que el plan.

**Por qué importa más de lo que parece.** El ancla `toHaveLength(9)` habría fallado con la lista en 7, o
sea **un rojo por la razón equivocada**, y precisamente en la única tarea de la spec cuyo rojo esperado es
exactamente uno y está escrito por adelantado («si además cae algún otro, se para y se reporta»). El agente
habría tenido que parar por un defecto del enunciado, no del contrato. Es el mismo mecanismo de daño que el
falso RED de `T-007`: un rojo que se lee como confirmación de la hipótesis cuando en realidad viene de otro
sitio.

**Cómo lo resolvió el agente, y por qué se acepta la lectura que hizo.** Tomó el ancla `toHaveLength(9)`
como la expresión de la **intención** —nueve = diez menos `/tree`, que es literalmente lo que dice la
decisión de la v0.2.2— y derivó por **complemento de `/tree`** en vez de por presencia de `{id}`. Las dos
listas quedan ancladas (`toHaveLength(9)` y `toHaveLength(1)`), el único elemento del complemento se afirma
por igualdad contra `/api/workspace/tree`, y no hay ninguna segunda lista escrita a mano: **ningún
`it.each` puede recorrer cero casos y pasar por vacuidad**, que era el peligro que el RED original quería
conjurar con el filtro. La restricción de fondo se respeta entera.

**Criterio correcto, escrito ya en `tasks.md`**: «todas las rutas del tag **menos** `GET /tree`», que es
«las que resuelven un id de recurso — **siete** desde la plantilla de ruta y **dos** desde el cuerpo». Y es
además el criterio más estable de los dos: «resuelve algún id de recurso» es una propiedad del **contrato**,
mientras que «lleva `{id}` en la plantilla» es una propiedad de la **sintaxis de la URL**. Coinciden hoy en
siete casos de diez y no tienen por qué seguir coincidiendo.

**Es el tercer error de cuenta de esta misma spec y del mismo género**: los «seis» endpoints con parámetro
de ruta que eran siete (v0.2.2), y los siete DTO de entrada que sí eran siete pero cuya cifra no estaba
derivada de nada (v0.2.2). La lección se repite sin variación: **una cifra escrita en prosa no vale nada;
vale la cifra derivada de una constante y anclada con un `toHaveLength`**, porque solo entonces el error de
cuenta se manifiesta como un rojo en vez de como un test que pasa midiendo otra cosa. Y el corolario, que
es el que le toca al orchestrator: cuando el enunciado de una tarea prescribe **cómo** derivar una lista, la
prescripción se verifica contra `plan.md` antes de escribirla, igual que se verifica el resultado.

Recogido en `specs/002-workspace-tree/CHANGELOG.md` **v0.2.3**.


### Deuda abierta de la ola 4 (2026-07-25) — verificación pendiente, no olvidada


**Estado al cerrar la Fase 4 (2026-07-25): los DOS puntos están SALDADOS.** El punto 1 se saldó al cerrar
la ola 4: el e2e completo del backend se corrió entero **dos veces** —`373` tras `T-014` y `435` tras
`T-015`, 20 suites en verde las dos— y la foto conjunta está en la tabla «Cierre del backend de la spec
`002`». El punto 2 queda saldado ahora: con `apps/web` libre de agentes se tomó **una sola foto de todo**
—web 12 / 188, api 19 / 264 y 20 / 455, shared 65, Playwright 5, más `typecheck` y `lint` **de raíz**— en
la tabla de «Cierre de la Fase 4 y de la spec `002`». Los 10 / 156 de `T-019` y los 11 / 169 de `T-022`
eran relojes intermedios, no regresiones, exactamente como avisaba el punto 2. El texto original de los dos
puntos se conserva íntegro abajo porque documenta **por qué** se aceptó no medir en su momento, que es lo
que hay que volver a leer la próxima vez que aparezca la misma disyuntiva.

1. **El e2e completo del backend está sin correr desde `T-009`.** `pnpm --filter @one-markdown/api
   test:e2e` completo se midió por última vez tras `T-010` (**15 suites / 314**). `T-024` **no** lo corrió:
   el orchestrator se lo prohibió porque `T-011` y `T-012` estaban escribiendo en `test/**` —
   `workspace-ownership.e2e-spec.ts` y el bloque de tope de nodos de `workspace-tree.e2e-spec.ts` son suyos
   — y una corrida completa habría medido un árbol a medias, que es peor que no medir: da un número que
   parece una regresión sin serlo, o tapa una que sí lo es. La sustituyó por una **regresión dirigida de
   12 suites / 174 tests** sobre lo que su cambio podía romper (`body-limit|validation` y
   `auth-|health|swagger`), que cubre el requisito real —ningún test de `000` ni de `001` en rojo— pero
   **no** equivale a la corrida completa.
   **Acción concreta al cerrar la ola 4**, cuando `T-011`, `T-012`, `T-013` y `T-014` estén en verde y
   nadie escriba en `test/**`: `rm -rf packages/shared/dist` y luego `pnpm --filter @one-markdown/api test`,
   `pnpm --filter @one-markdown/api test:e2e`, `pnpm typecheck` y `pnpm lint`, con las cifras anotadas en la
   tabla de cierre de la ola igual que se hizo con la ola 3. Hasta entonces el check-off de `T-024` lleva
   la salvedad escrita en su propia línea.
2. **Los contadores de la fase están medidos en momentos distintos** y no se pueden sumar entre sí: **314**
   e2e es la foto tras `T-010`, **255** unitarios es la foto tras `T-024`, y entre las dos hubo tareas en
   curso añadiendo archivos. La única cifra que vale como estado de la fase es la de la tabla de cierre de
   ola, corrida de una vez y sin agentes escribiendo. Esto no es una anomalía a arreglar, es la consecuencia
   aceptada de despachar seis tareas en paralelo; se anota para que nadie lea una regresión donde solo hay
   dos relojes distintos.


### Nota del índice — movida desde `specs/README.md` (2026-08-03)

El índice volvió a ser una línea por spec; esta era su fila, literal.

- **Feature**: Workspace tree — directorios/subdirectorios y documentos markdown (CRUD, propiedad por usuario)
- **Versión**: **0.4.4**
- **Depende de**: 000, 001

**Estado tal como estaba escrito**: **complete** — **35/35 AC** y **27/27 tareas**. La enmienda de la **v0.4.0** (pedida por la `003`: `contentVersion` en la respuesta del documento y la ruta `PUT …/content` en el recuento) quedó **implementada y verificada** por `T-007`, `T-009` y `T-013` de esa spec. Tres patches más: **v0.4.1** (dos bytes de control que rompían `grep`), **v0.4.2** y **v0.4.3**, que ampliaron el alcance registrado de la enmienda — `workspace.repository.spec.ts` y `apps/web/src/test/workspace-fixtures.ts`. Las dos veces el agente **paró y reportó**, y las dos por el mismo motivo: el radio de un cambio de contrato incluye **los fixtures de test**. Salvedad de cobertura vigente: el rojo de **AC-34** es **manual** y CI no lo caza
