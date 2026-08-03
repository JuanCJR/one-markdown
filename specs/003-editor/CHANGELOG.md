# Changelog — Spec 003 Editor

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.2.0 — 2026-07-29

**Minor de enmienda, pedido por la spec `005` y aplicado por su `T-000` sin tocar una línea de
código.** Dos AC cambian de redacción y **el recuento no se mueve**: siguen **34 AC · 17 tareas**.

**(1) `AC-28` pierde su segunda mitad.** Decía «el guardado pendiente se **fuerza** antes de
desmontar; **si tiene éxito, la entrada del documento se descarta del store**; y si falla, la entrada
se conserva con su `draft`». El descarte **deja de ocurrir al navegar** y pasa a ser competencia de
**cerrar una pestaña**. Las otras dos mitades se quedan **literales**.

**Por qué.** Esta spec ya había asignado esa decisión: su `plan.md`, decisión 9, dice que el estado
vive indexado por id y que «lo que `005` cambiará es la **política de desalojo**, no la forma». En la
`003` navegar fuera **era** cerrar, así que descartar era correcto; con pestañas son dos gestos
distintos con dos resultados distintos. Mantener el descarte obligaría a releer el documento del
servidor en cada salto entre pestañas y tiraría el modo de vista **que esta misma spec quería
conservar** —el comentario de `ViewMode` en `editor.store.ts` dice literalmente «la spec `005` lo
conserva al volver a su pestaña sin trabajo extra», y con el descarte eso era imposible—.

**(2) `AC-22` pasa de dos modos a tres**, con `'split'`, y su redacción deja de llevar el número: dice
«un `role="tab"` por cada modo de vista», porque el número se deriva de la enumeración `VIEW_MODES` y
escribirlo aquí sería un segundo sitio donde mantenerlo. Es la lección que la `004` pagó al escribir
«14 elementos» en diez sitios mientras su propia tabla enumeraba 16. La línea de §4 «Ver texto y
vista previa a la vez» deja de estar fuera de alcance y queda **tachada, no borrada**: lo que decía a
continuación es justo lo que hizo barata la ampliación.

**Por qué minor y no major.** Lo que AC-28 le promete a la persona —no perder lo que escribió al
navegar— **no se rompe: se refuerza**, porque el borrador pasa a conservarse también cuando el
guardado tuvo éxito. Lo que cambia es el **mecanismo interno**, y obliga a tocar tests que hoy están
verdes: es exactamente el criterio con el que la **v0.4.0 de la `002`** se declaró minor siendo
aditiva. **El argumento contrario queda escrito porque era legítimo**: por la letra de
`specs/README.md` («major — cambia comportamiento observable ya implementado») esto sería **v1.0.0**,
y el descarte de la entrada **es** observable desde el store, con un test verde que lo afirma. Se
eligió la lectura por la garantía y no por la letra (decisión **E** de `005/spec.md` §8.1, resuelta
por el usuario el 2026-07-29), y se deja dicho para que nadie tenga que reconstruir por qué.

**Consecuencia asumida y escrita en los tres sitios donde se lee** —el `Estado` de la spec, cada uno
de los dos AC, y las dos filas de §7—: desde el 2026-07-29 **`AC-22` y `AC-28` van por delante del
código**. Los implementan `T-005` y `T-008` de la `005`. Es el mismo trato que la `002` se dio a sí
misma con los cinco AC de su v0.4.0.

**Verificado**: `rm -rf packages/shared/dist && pnpm test` → `shared` **81** · `apps/web` 19 archivos
/ **470** · api unit 21 suites / **305**, corrido **antes y después** de la enmienda con resultado
idéntico — que es justamente lo que demuestra que no se tocó código, junto con un
`git status --porcelain apps packages` **vacío**.

## v0.1.5 — 2026-07-29

**Patch de precisión escrito desde la `004`, sin tocar una línea de código, ningún AC y ningún
contrato.** La spec sigue **complete: 34/34 AC · 17/17 tareas**. Se abre por un hallazgo de `T-010`
de la `004`, y se escribe aquí en vez de dejar solo constancia allí porque la `005` va a leer estas
notas de cierre para dimensionar su propio presupuesto de cupo.

**El defecto: una cifra de cupo sin ventana.** La v0.1.4 y las notas de `T-015` dan «la suite gasta
**4 de 120**» de `documentContent`. Es cierto **por corrida**, y está escrito junto al comando de
verificación de AC-34 —`--retries=2 --repeat-each=3`—, que **no** mide eso: la suite entera dura
~23 s, así que las tres repeticiones caen **dentro de la misma ventana de 60 s** del throttler y sus
gastos **se suman**. Medido desde la `004` con sondeo de Redis cada 300 ms sobre
`throttle:documentContent:{sha256(ip)}`, y comprobado con `--grep-invert` para aislar los casos de
esta spec: **12 de 120** bajo ese comando (4 × 3), frente a **4** por corrida.

**AC-34 no cambia, y esto no es un descuido.** No lleva número: afirma que la suite pasa entera y que
ninguna llamada recibe un `429`. Con 12 de 120 eso es cierto, lo era cuando se cerró y lo sigue
siendo. Lo único que se añade es una nota de precisión debajo del AC.

**Por qué importa entonces.** Porque la `004` heredó esa cifra y la metió **dentro de un criterio que
sí llevaba número**: su AC-33 exigía «< 10 de 120» y mandaba verificarlo con el comando que triplica
el gasto. Resultado: un criterio **cierto por corrida y falso bajo su propio comando de
verificación**, que además ya estaba roto (en 12) antes de que la `004` escribiera una línea. Se
corrigió allí partiendo el AC en dos ventanas con dos comandos (`004/CHANGELOG.md` v0.2.1).

**La regla que queda, para la `005` y las siguientes**: **toda cifra de cupo lleva pegada su ventana
(«por corrida», «por ventana de 60 s») y el comando con el que se mide**. Un número sin ventana no es
verificable, aunque sea el dato más concreto del criterio — y es especialmente traicionero cuando el
comando de verificación multiplica el escenario, que es justo lo que hacen `--repeat-each` y
`--retries`.

## v0.1.4 — 2026-07-28

**Patch de cierre. La spec pasa a `complete`: 34/34 AC y 17/17 tareas.** No añade alcance, no cambia
ningún contrato, ningún DTO ni ninguna respuesta HTTP.

**Cifras del cierre**, corridas de una vez: `shared` **81** · `apps/web` 16 archivos / **321** · api unit
21 suites / **305** · api e2e 22 suites / **511** (40,2 s) · `pnpm test:e2e` **8** ·
`--retries=2 --repeat-each=3` **24 passed, sin un solo `429`** · `typecheck` y `lint` en **0** en los tres
paquetes.

### Una afirmación de la v0.1.2 que la implementación desmintió

`plan.md` §2.2.1 decía que **`rehype-sanitize` era redundante** —quitarlo dejaba los 51 tests verdes— y
defendía esa redundancia como el objetivo de una capa de defensa en profundidad. El argumento sigue
siendo válido, pero **ya no hace falta**: al añadir al corpus la carga de imagen `![logo](irc://…)`, el
sanitizador pasó a tener un **agujero propio con nombre**. Quitándolo cae **exactamente** esa carga,
porque `urlTransform` aplica su regex de **seis** protocolos a todas las URL mientras que el esquema
permite solo `http`/`https` en `src`: para los protocolos de `src`, **`rehype-sanitize` es la única capa
que actúa**.

Lo notable es que estaba **predicho por escrito** en la propia §2.3 —«añadir esa carga convertiría la
redundancia en no-redundancia sin cambiar una línea de código»— y se confirmó añadiéndola. El corpus pasa
de 12 a **13** cargas, y las dos de `irc:` son complementarias a propósito: la de **enlace** documenta que
el protocolo se permite (AC-25 ampliado), la de **imagen** que se recorta.

### `T-013`, `T-014` y `T-015`

- **`T-013`** — web 290 → **313**. Retiró el andamio de la `002` (`DocumentViewPage` borrado) y trasladó
  **11 de 12** casos. Los **tres de navegación no estaban en el encargo**: los portó tras comprobar que
  `WorkspaceTreeView.test.tsx` solo afirma `selectedId`/`aria-selected` y **nunca la ruta**, así que eran
  la única cobertura de «activar un documento abre `/documents/:id`» **en todo el proyecto**. Borrarlos la
  habría hecho desaparecer **sin que ningún test se pusiera rojo** — la misma clase de hueco silencioso
  que el `WORKSPACE_RESPONSE_SCHEMAS` sin `toHaveLength` de `T-009`.
- **`T-014`** — `playwright test editor` **3 passed**, con **cinco mutaciones de control**, porque los
  tres casos pasaron a la primera y un verde inmediato no distingue «funciona» de «no mide». Dos valen
  doble: que el centinela `window.__xssTripped` se dispara **independientemente** del manejador de
  `dialog` (son **dos redes**, no una), y que la rama de `src` —que con el corpus real nunca se activa
  porque el saneado la vacía antes— **existe y etiqueta bien**, comprobado con una carga de control. Sin
  eso, esa rama sería código muerto del que nadie sabría si funciona.
- **`T-015`** — RED real con `429`, y **el caso que cayó no fue el del editor sino el del árbol**: el cupo
  es **por IP y global de la suite**, así que lo paga quien pasa por ahí, no quien gasta. GREEN en dos
  pasos: gastar menos (pico **98/120**) y, como AC-34 exige el escenario **con reintentos** y 22 de margen
  no cubren uno, resetear **`workspace` únicamente** (pico **20/120**). **`documentContent` no se
  resetea**: la suite gasta **4 de 120** y neutralizarlo restaría cobertura a cambio de nada. Dejó entrada
  en el CHANGELOG de la `001` (**v0.1.2**) por tocar `apps/web/e2e/support/*`.

### Trabajo futuro, con destinatario — §8 nueva

Se añade una sección §8 para que las dos deudas no vivan solo en el seguimiento:

- **Deduplicar `GET …/documents/:id` en vuelo → spec `005`.** `StrictMode` lo emite dos veces por montaje
  en desarrollo (**8 de las 21** peticiones de `workspace` por corrida). **No entra en la `003`**: las
  tres salidas quedaban fuera del alcance de `T-015`, no hay presión de cupo (pico 20/120) y **en
  producción el síntoma no existe**, porque `StrictMode` solo duplica en desarrollo. Es de la `005`
  porque esa spec **tiene que tocar `open(id)` de todas formas** (política de desalojo) y porque es ella
  la que lo convierte en un problema real de producción: con tabs, abrir y cerrar pestañas deprisa produce
  aperturas solapadas sin ninguna ayuda de `StrictMode`. Recomendación concreta: guardar la promesa en
  vuelo por `id`, el mismo idiom *single-flight* que `http.ts` ya usa en `refreshSession()`.
- **La ventana estrecha de AC-33 → no tocar preventivamente.** Corrió **13 veces sin parpadear**, pero el
  margen son **decenas de milisegundos** entre el `PUT` externo y el vencimiento del debounce de 1.500 ms.
  Se deja escrita **la causa**, no un arreglo: las tres formas de estabilizarlo cambian o el producto o lo
  que el AC demuestra. Lo que importa es que, si algún día parpadea en CI, **no se diagnostique como un
  problema de cupo** — que es justo donde mirará todo el mundo después de `T-015`.

### Balance de las dos correcciones de fondo que la implementación obligó a hacer

1. **La lista de §6 se quedó corta dos veces** (`workspace.repository.spec.ts` y `workspace-fixtures.ts`),
   las dos por el mismo motivo: el radio de un cambio de contrato incluye **todo lo que construye un valor
   del tipo**, fixtures de test incluidos. Las dos veces el agente **paró y reportó**, que es lo único que
   hace que una lista cerrada valga para algo.
2. **`rehype-sanitize` pasó de «redundante» a tener un agujero propio con nombre.** La spec afirmaba una
   cosa y la medición acabó diciendo otra; se corrige en vez de dejar la afirmación cómoda.

## v0.1.3 — 2026-07-28

**Patch. Los 34 AC siguen siendo 34.** Uno cambia de redacción (**AC-25**) y el resto son registros de lo
que la implementación destapó entre `T-009` y `T-012`. Ningún contrato cambia.

### 1. AC-25 se amplía a los protocolos reales — decisión del usuario

La mutación **M3** de `T-011` destapó que **AC-25 y la decisión 7 se contradecían**. Verificado contra el
**código instalado**:

- `react-markdown/lib/index.js:124` → `const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i`
- `hast-util-sanitize/lib/schema.js:143` → `href: ['http','https','irc','ircs','mailto','xmpp']`
- `hast-util-sanitize/lib/schema.js:145` → `src: ['http','https']`

Las dos capas dejan pasar `irc:`, `ircs:` y `xmpp:` en un enlace, así que `[chat](irc://…)` sobrevive y
AC-25 lo declaraba fallo.

**Era un descuido de redacción, no un agujero**, y conviene decirlo con precisión: no había ninguna carga
que pasara sin ser vista; había un criterio que habría marcado como defecto algo que las librerías
elegidas permiten a propósito. `javascript:` y `data:` siguen bloqueados por las dos capas.

**El usuario eligió ampliar el AC a la lista real** en vez de estrechar las librerías. Mantiene intacta la
decisión 7 (`defaultSchema` sin modificar), no obliga a tocar `urlTransform` —que §2.2 señala como lo
**único** que el README de `react-markdown` marca como forma de romper su seguridad— y es lo que GitHub
lleva años permitiendo.

**Lo que se añade y no estaba en el encargo: la asimetría `href`/`src`.** El esquema permite **seis**
protocolos en `href` pero **solo `http`/`https` en `src`**. Importa porque es el caso donde
`rehype-sanitize` **no** es redundante: `urlTransform` aplica su regex de seis protocolos a **todas** las
URL, imágenes incluidas, así que quien recorta `![x](irc://…)` a un `<img>` sin `src` es el esquema. AC-25
lo separa en dos aserciones.

### 2. §6 se quedó corta por segunda vez, y ahora con la lección escrita

`T-012` encontró que `apps/web/src/test/workspace-fixtures.ts` —código intacto de la `002`, `168b840`— no
ponía `contentVersion`, que `MarkdownDocument` pasó a exigir. Coste medido: **14 tests en rojo en 5
suites** más un error de `tsc`. Arreglo: una línea. Mismo procedimiento que `T-007` y mismo resultado.

**Van dos, y las dos por el mismo motivo.** Al escribir §6 se pensó el radio de un cambio de contrato como
«los DTO y los tests que afirman respuestas HTTP», y el radio real es **todo lo que construye un valor de
ese tipo**, incluidos los **fixtures y helpers de test de los dos paquetes**. Un tipo compartido con un
campo requerido nuevo es un *tripwire* que alcanza a cualquier archivo que fabrique uno a mano, y esos
archivos no aparecen buscando el nombre del endpoint. La regla para la próxima spec queda escrita en §6:
buscar **quién construye literales del tipo** (`test/fixtures/**`, `src/test/**`, `*-fixtures.ts`), no
solo quién lo consume. Es un `grep`, no una revisión.

### 3. El cuarto recuento de swagger

`T-009` hizo **cuatro** cambios de recuento, no tres. El que faltaba: `WorkspaceDocumentContentResponseDto`
en `WORKSPACE_RESPONSE_SCHEMAS`. **No provocó rojo** porque esa lista no tiene `toHaveLength` —solo
alimenta un `it.each`—, así que dejarla corta habría significado que el DTO de salida nuevo **no tenía
aserción de existencia** por esa vía: un hueco silencioso, no un fallo. La fila de §6 lo dice ya.

### 4. `EditorEntry` necesitaba un séptimo campo, y `plan.md` §7 declaraba seis

`T-012` añadió `serverVersion: number | null`. **Es un error de diseño del plan, no una licencia del
agente**: con solo `serverContent`, `resolveTakeServer` deja el editor limpio **pero con el
`contentVersion` viejo**, así que la primera tecla siguiente vuelve al **mismo `409`** — el usuario
resolvería un conflicto para caer inmediatamente en él otra vez. Lo fija el caso «tras descartar mis
cambios, el guardado siguiente ya no vuelve a chocar».

Se registran además dos decisiones de `T-012` que son **contrato** y no detalle: `open(id)` **propaga** el
error en vez de tragárselo, para que la página conserve el tratamiento `loading`/`missing`/`error` que
AC-31 obliga a heredar; y si tras un `409` **falla la relectura**, el estado es `unreachable` y **no**
`conflict`, porque un conflicto que no puede enseñar el texto del servidor no se puede ofrecer a resolver
y anunciarlo con botones que no funcionan sería justo el aviso genérico que AC-19 existe para evitar.

### 5. `setViewMode` no era de nadie — fallo de reparto, ya resuelto

`plan.md` §7 lo declara como acción del store, pero el RED de `T-012` no lo pedía y las ARCHIVOS de
`T-013` no incluían `editor.store.ts`. Es un fallo del orchestrator al repartir, no de los agentes. Se
autoriza a `T-013` a añadirlo **al store**, con su test, y **no** a bajarlo a `useState` local: con
«split view = texto y preview del mismo documento» (decisión E), el modo activo es estado **por
documento**; en el store va indexado por `id` y la `005` lo conserva al cambiar de pestaña, mientras que
en estado local se perdería en cada montaje.

### 6. Dos mediciones que cambian lo que la spec puede afirmar

**`rehype-sanitize` es redundante hoy, y eso es el objetivo.** `T-011` fue quitando capas: sin el
sanitizador los 51 tests siguen verdes; quitando **además** `urlTransform` caen 3 (`javascript:` en
enlace, `data:` en enlace, `javascript:` en imagen). O sea que hoy sujetan la capa **1** (no haber
instalado `rehype-raw`) y la **4** (`defaultUrlTransform`).

**Que ningún test lo eche de menos no es un defecto del test.** Es literalmente el argumento de la
decisión 6: las capas 1 y 4 son seguras por **la configuración de plugins de hoy**, y el sanitizador es la
red para cuando la `004` o la `005` añadan uno. Queda escrito en `plan.md` §2.2.1 con la regla derivada,
porque el razonamiento contrario llega solo: **una capa no se retira porque ningún test la eche de
menos**, sino cuando el escenario del que protege ha dejado de existir.

**Coste del preview en el bundle: +255 módulos, +160,7 kB (+48 kB gzip)**, y `vite.config.ts` no necesitó
nada. Con un detalle que vale la pena: hoy **nadie importa `MarkdownPreview`**, así que el build lo
*tree-shakeaba* y la medición habría dado **cero** — `T-011` tuvo que importarlo temporalmente desde
`main.tsx` para que el coste apareciera. Es el número contra el que juzgar cualquier plugin futuro.

## v0.1.2 — 2026-07-28

**Patch. Los 34 AC siguen siendo 34 y ninguno cambia de significado.** Registra cuatro cosas que la
implementación destapó entre `T-001` y `T-008` y que la spec no decía. Las cuatro son correcciones de la
spec, no del código; ninguna cambia un contrato.

### 1. AC-11 gana un mecanismo de verificación, porque el que tenía no podía ver el defecto

`T-007` **midió** algo que no era obvio: coló un `content: true` en `DOCUMENT_SUMMARY_SELECT` —el `select`
del árbol— y **los 76 casos HTTP siguieron en verde** mientras `GET /api/workspace/tree` descargaba de
TOAST el texto de todos los documentos del usuario.

La causa es la regla dura del proyecto trabajando en contra: los DTO se construyen **campo a campo** y
nunca por *spread*, así que una columna de más en un `select` **no puede** llegar a la respuesta, y
ninguna aserción sobre el cuerpo HTTP la verá jamás. El defecto es de coste de lectura, no de contrato, y
era **invisible por el único canal que esta spec verificaba**. AC-11 pasa a comprobarse también sobre el
juego exacto de claves de `DOCUMENT_SUMMARY_SELECT` y `DOCUMENT_SELECT`, que es donde vive. Es la misma
clase de aserción mecánica que AC-22 de la `002` (`PrismaService` en un solo archivo).

### 2. La tabla de §6 estaba corta, y el procedimiento lo detectó

`T-007` encontró una **tercera** aserción de claves exactas que §6 no autorizaba
(`workspace.repository.spec.ts:334`), **paró**, y verificó con `git show HEAD` que era código de la `002`
y no algo que hubiera roto `T-003`. Se autorizó y se añadió a la tabla **antes** de aplicarlo.

Queda escrito en §6 porque es la única evidencia de que el procedimiento sirve: una lista cerrada de
artefactos tocables solo vale si, cuando se queda corta, alguien se para en vez de ampliarla por su
cuenta. La lista **estaba** corta —la escribió el orchestrator— y el mecanismo lo cazó.

También se precisa la fila de `swagger.e2e-spec.ts`, que decía «el recuento de rutas y de rutas con
`404`». Son **tres** recuentos: el tercero es el de **DTO de entrada** (`WORKSPACE_REQUEST_SCHEMAS`,
`toHaveLength(7)` → `8`, más su comparación contra los nombres de DTO **en disco**). Estaba en AC-12 y en
el RED de `T-009`, pero no en la regla dura que limita lo que `T-009` puede tocar — que es donde tenía
que estar.

### 3. La regla sobre los resets de contadores estaba **mal escrita**

`tasks.md` prohibía llevar resets «a la suite del API» porque «destruiría la única prueba de que los
límites existen», nombrando `auth-throttle`, `workspace-throttle` y `workspace-document-content-throttle`.

**Es falso en los hechos, y se comprobó en el código**: `workspace-throttle.e2e-spec.ts` resetea en sus
tres hooks de ciclo de vida **y aun así exige `429` nueve veces**. El idioma está en **17** archivos e2e
del API con **39** puntos de llamada. Se confundió «resetear» con «resetear en el momento equivocado», y
así una regla sobre el **momento** acabó escrita como una prohibición sobre el **lugar**.

La regla real, ya en `T-015`: resetear **en los límites** de un caso sí —hace la prueba determinista,
porque parte de un contador limpio y después agota—; **a mitad de una secuencia de agotamiento** no —ahí
el `429` no llega nunca y el test pasa sin comprobar nada—; y en la **suite de navegador**, nada que
impida ver un `429`, que es lo que la intención original protegía de verdad.

**Coste ya causado, anotado en `T-008`**: esa tarea cumplió la letra de la regla equivocada y resolvió la
limpieza **esperando a que venza la ventana del `ttl`**. Funciona, pero cuesta **~60 s de espera pura por
corrida** —de ~65 s totales, solo ~5 s son las ~248 peticiones HTTP— e introduce un idioma distinto del de
los otros 17 archivos. Se realinea con el convenio en cuanto la base quede libre; **no cambia ningún AC**.

### 4. `plan.md` §3 prometía algo que no se podía cumplir

Decía que `MAX_DOCUMENT_CONTENT_CHARS` «se reexporta y no se duplica a mano». Para el frontend se cumple,
pero **`packages/shared` no puede importar de `apps/api`** —la dependencia va al revés—, así que `T-006`
implementó un **valor espejo**. El `200_000` está escrito dos veces y el test de `shared` solo fija **su
propio** literal: subir el de `apps/api` a `300_000` no rompería nada, y el cliente ofrecería sitio que el
servidor rechaza con un `400`.

**Se cierra en esta spec, con `T-016` (17 tareas), y con un test de acoplamiento en `apps/api`, no con una
reexportación.** La reexportación es más fuerte sobre el papel —imposible divergir, en vez de divergencia
detectada— y aun así se descarta: hoy la dependencia de `apps/api` sobre `packages/shared` es
**exclusivamente de tipos** (`import type`, que desaparece al compilar), y reexportar sería la primera
dependencia de **runtime** del backend sobre `packages/shared/dist`. Un `dist` rancio sirviendo un límite
equivocado es la clase de defecto que documentó AC-34 de la `002`, con el agravante de que aquí el síntoma
sería un `400` inexplicable en producción en vez de una pantalla rota en desarrollo. El test cuesta tres
líneas, detecta la divergencia al instante y mantiene la dependencia en tipos.

Queda escrita además la **dirección de la verdad**, que es lo que se estaba erosionando: la fuente es
`apps/api/src/workspace/workspace.constants.ts`; `packages/shared` la **espeja** para el navegador, igual
que espeja los DTO como tipos. Nunca al revés.

## v0.1.1 — 2026-07-28

**Patch de aprobación. Ningún AC cambia, ningún contrato cambia, ningún límite cambia.** La spec pasa a
**approved** y `T-000` queda **hecha y verificada**. La versión sube porque **el contenido de §5 sí
cambió**: las cinco decisiones abiertas dejan de estarlo.

**Convenio, para que no se invente uno nuevo**: aprobar **no** salta a 1.0.0. Es lo que hicieron `001`
(approved el 2026-07-24 en v0.1.0) y `002` (approved el 2026-07-25 sin bump); lo que cambia al aprobar es
el campo `Estado`. Aquí la versión sube un patch, y sube por el cambio de §5, no por la aprobación.

### Las cinco decisiones, resueltas el 2026-07-28

Las cinco en la opción que el plan recomendaba, y **sin cambios de alcance**:

| # | Elegido |
|---|---|
| **A** | `PUT /api/workspace/documents/:id/content`, ruta nueva. El `PATCH /:id` queda intacto y su `400` de `forbidNonWhitelisted` sigue siendo comportamiento verificado |
| **B** | Columna `contentVersion`; enmienda de la `002` a **v0.4.0** aprobada como **minor** |
| **C** | La cadena propuesta, y —aprobada **explícitamente** como postura de producto— que **el HTML embebido se muestra como texto literal y no se renderiza nunca** |
| **D** | `<textarea>` plano, sin CodeMirror ni Monaco |
| **E** | «Split view» = **texto y preview lado a lado del MISMO documento**, no dos documentos distintos |

Las filas A…E de §5 se **conservan con su razonamiento íntegro** y se marcan como resueltas, en vez de
borrarse: el motivo de una decisión es lo que hace falta el día que alguien quiera revisarla, y dejar solo
el resultado convierte una decisión razonada en un dogma.

**Lo que la resolución de E cambia de verdad.** Con «el mismo documento», el split de la `005` es esta
misma pareja de paneles con otra disposición: los dos leen el **mismo** `draft` de la **misma** entrada
del store, así que no hay un segundo estado que sincronizar ni un segundo bucle de guardado — que es
exactamente lo que la decisión 9 de `plan.md` fue diseñada para sostener. La otra lectura habría exigido
dos entradas vivas a la vez, y con ella una política de desalojo que la `003` no tiene. La `005` seguirá
necesitándola para los **tabs**; ya no para el split.

### `T-000` — ejecutada

Aplicada la tabla de §6 sobre `specs/002-workspace-tree/`: `spec.md` (encabezado, `Estado`, AC-12, AC-15,
AC-26, AC-31, AC-32 y el aviso al principio de su §6 de trazabilidad), `plan.md` (§4 lista de DTO y tabla
de rutas, §5 modelo `Document`, §7 `DocumentViewPage`) y entrada `## v0.4.0 — 2026-07-28` en su
`CHANGELOG.md`. Más `specs/README.md`, `IMPLEMENTATION.md` y `CLAUDE.md`.

**Sin tocar una línea de código**, que era la regla: los cambios de test los harán `T-007`, `T-009` y
`T-013`, cada uno junto a la implementación que los provoca. Verificado con `pnpm test` **antes y
después**, con resultado idéntico —shared **65**, web **188**, api **264**, exit 0— y con `git status`
mostrando cero archivos modificados en `apps/**` y `packages/**`.

**La consecuencia incómoda, escrita en los dos sitios en vez de en ninguno**: desde hoy y hasta que
cierren esas tres tareas, **cinco AC de la `002` describen un contrato que el código todavía no cumple**.
Queda anotado en el `Estado` de la `002`, en el aviso que abre su §6 y en cada uno de los cinco AC. La
alternativa —dejar «35/35 verificados» tal cual— habría sido más cómoda y falsa.

**`CLAUDE.md`**: la frase «tabs tipo VS Code al abrir documentos y split view» era ambigua y la `005` se
iba a apoyar en ella. Corregida con la edición mínima que quita la ambigüedad, no reescrita.

## v0.1.0 — 2026-07-28

**Spec inicial (draft).** 34 criterios de aceptación, todos con al menos un test automatizado
declarado, y 16 tareas TDD. Nada se implementa hasta que el usuario apruebe: hay **cinco decisiones
abiertas** (`spec.md` §5, filas A…E) que son baratas de cambiar hoy y caras después.

### Lo que se decidió, y sobre qué evidencia

**Guardado: endpoint nuevo `PUT /api/workspace/documents/:id/content`, no una ampliación del
`PATCH /:id`.** El estado heredado de la `002` es que **ningún** endpoint modifica `content`: el
`RenameDocumentRequestDto` acepta solo `title` y el `forbidNonWhitelisted` global rechaza `content`
con un `400`. Se elige ruta nueva por la misma razón por la que la `002` separó renombrar de mover (su
decisión 10) y por tres más, medibles: los modos de fallo son distintos (renombrar puede dar
`409 DOCUMENT_TITLE_TAKEN`, guardar solo puede dar `409` de versión, y un DTO combinado haría que un
guardado automático cada 1,5 s reenviara el título y pudiera chocar con un hermano sin que nadie haya
tocado el título); las frecuencias son incomparables, lo que además permite un throttler propio
imposible de dar a medio endpoint; y ampliar el `PATCH` **rompería** un comportamiento verificado de
la `002` en vez de añadir una ruta, lo que convertiría su enmienda en un **major**. `PUT` y no `PATCH`
porque el cuerpo reemplaza el subrecurso completo y la operación es idempotente **respecto de su
token**, que es lo que hace que un reintento del guardado automático no pueda duplicar nada.

**Concurrencia: columna `contentVersion Int @default(0)` que solo incrementa el guardado de
contenido.** La `002` dejó esto abierto a propósito en su riesgo #12 («no se añade una columna
`version` por adelantado: sería especular sobre un mecanismo que `003` todavía no ha decidido») y
apuntaba a `updatedAt`. Se descarta `updatedAt` por un motivo concreto, no estético: **renombrar y
mover también lo mueven**, así que renombrar desde la barra lateral haría fallar un guardado pendiente
con un conflicto que no existe. AC-9 existe para clavar esa ortogonalidad, y con `updatedAt` sería
imposible de cumplir. `If-Unmodified-Since` es peor todavía: la fecha HTTP tiene resolución de
**segundos**. `ETag`/`If-Match`, que es el mecanismo canónico de HTTP, se descarta por tres razones
del proyecto y no por gusto: la regla dura es que toda entrada y salida va por un DTO explícito y una
cabecera no lo es; los guards de `packages/shared` validan **cuerpos**, así que el token quedaría
fuera del único mecanismo que comprueba el contrato; y `expectShape` de `http.ts` solo ve el cuerpo.

**Preview: `react-markdown` 10.1.0 + `remark-gfm` 4.0.1 + un paso propio `rehypeRawAsText` +
`rehype-sanitize` 6.0.0 con `defaultSchema` sin modificar, y nunca `dangerouslySetInnerHTML`.**
Versiones fijadas contra npm y API comprobada con `context7` el 2026-07-28; `react-markdown` 10.1.0
declara `peerDependencies` `react >=18`, que React 19.2.8 satisface.

Lo que decidió el diseño no fue la documentación sino **la medición** (`plan.md` §1.3): se instalaron
las tres librerías fuera del repositorio y se renderizó un corpus de cargas comparando la salida con y
sin sanitizador. Dos resultados no obvios:

1. **Sin `rehype-sanitize`, `react-markdown` ya es seguro con esas cargas**: el HTML del markdown no
   se convierte en elementos, se **escapa como texto**, y el `urlTransform` por defecto ya vacía el
   `href` de un `javascript:`. Pero esa seguridad es una propiedad de **la configuración de plugins de
   hoy**: el día que `004` o `005` añadan uno, se evapora sin avisar.
2. **Con `rehype-sanitize` y nada más, el preview borra texto que la persona escribió.**
   `<!-- oculto -->visible` se queda en **nada**: markdown trata la línea entera como bloque HTML,
   `hast-util-sanitize` descarta los nodos `raw` y con ellos se va la palabra «visible». Para un
   editor, que el preview se coma prosa es un defecto.

De ahí sale el paso propio de ~12 líneas que convierte los nodos `raw` en nodos de **texto** antes de
sanear: no puede introducir un elemento (un nodo de texto es estrictamente menos poderoso) y evita la
pérdida. Medido con él en la cadena: `<script>alert(1)</script>` se ve como texto literal,
«visible» sobrevive, y **todo lo de GFM sigue intacto** —tablas, listas de tareas, tachado, enlaces
automáticos y el `class="language-js"` de los bloques de código—.

Se descartaron `marked` y `markdown-it` con `dompurify` porque producen una **cadena de HTML** que hay
que inyectar con `dangerouslySetInnerHTML`: la seguridad pasaría a depender de configurar DOMPurify
bien en **cada** punto de uso, para siempre, y además DOMPurify depende de la implementación del DOM,
así que un test que pasa en jsdom no diría nada sobre Blink.

### Los dos puntos que la `002` dejó anotados sin tarea, resueltos

**Riesgo #15 (el aviso genérico no distingue un fallo del cliente de uno del servidor): entra, pero
acotado al editor.** AC-19 exige **tres** estados distinguibles en el guardado —`conflict`, `rejected`
y `unreachable`—, porque los tres piden acciones distintas de la persona y porque aquí hay datos que
perder. La barra lateral **no se toca**: cambiar su mensaje es producto, y el riesgo #15 sigue abierto
para ella, ahora con un precedente que copiar.

**AC-34 (caché rancia de `optimizeDeps`): no necesita análogo, y se escribe por qué.** Aquel defecto
era específico de un paquete **enlazado del workspace**, cuyo contenido no entra ni en el hash del
lockfile ni en el de la configuración. Las tres dependencias de esta spec son paquetes de npm de
verdad: instalarlas cambia `pnpm-lock.yaml` y Vite reoptimiza sola. Y `optimizeDeps.force: true` sigue
puesto desde la `002`. Un AC de caché aquí sería teatro. Lo que **sí** hacía falta era otra cosa: una
afirmación de seguridad verificada solo en jsdom no es una afirmación sobre navegadores, y de ahí sale
**AC-26**, que repite el corpus entero en Chromium real con centinela y manejador de diálogos,
importando **el mismo archivo** de corpus que el test de jsdom para que no puedan divergir.

Y una tercera cosa que la `002` sí enseñó y que se hereda tal cual: **AC-34 de esta spec** (presupuesto
de la suite de navegador). La `002` cerró su AC-35 con el presupuesto agotado al milímetro; esta spec
añade un archivo e2e más y un cupo nuevo (`documentContent`), así que volver a quedarse corto es lo
esperable. Con la prohibición heredada escrita literalmente en el AC y en `T-015`: **el reset de
contadores no se lleva a la suite del API.**

### Enmienda que esta spec obliga en la spec `002`

`002` pasaría de **v0.3.1** a **v0.4.0** (minor: añade a un contrato implementado sin romper a ningún
consumidor, pero obliga a cambiar aserciones de tests verdes, así que no puede ser patch). El alcance
exacto —once artefactos, ni uno más— está en `spec.md` §6 y lo ejecuta `T-000`, con la regla dura de
`T-024`/`T-026`/`T-027`: si cae **cualquier** otro test de `000`, `001` o `002`, se para y se reporta.
**No se ha aplicado**, precisamente porque la `003` está en draft.

---

## Registro de implementación — movido desde `IMPLEMENTATION.md` (2026-08-03)

> Trasladado **literal**, sin podar. El documento de seguimiento había crecido a 3.317 líneas y había
> dejado de servir de índice; el detalle de cada feature pasa a vivir con su feature. Si algo de aquí
> repite lo que ya dice el historial de versiones de arriba, se recorta cuando se tengan los dos
> delante — no antes.


### Planificación de la spec

- [x] **spec 003-editor** — `specs/003-editor/` (`spec.md` **v0.1.1** + `plan.md` + `tasks.md` +
      `CHANGELOG.md`), estado **approved** (2026-07-28), **sin cambios de alcance**. — 2026-07-28
      **34 criterios de aceptación** (todos con al menos un test automatizado declarado, y cada AC dice
      con qué mecanismo se verifica) y **16 tareas** TDD en 7 bloques (0 enmienda de la `002` · A esquema
      y dominio puro · B repositorio y throttler · C endpoint · D cliente y renderizador · E estado e
      interfaz · F navegador). **`T-000` hecha y verificada; las 15 restantes, pendientes de despacho.**
      La implementación será la Fase 5.
      **Las cinco decisiones de `spec.md` §5 quedaron resueltas el 2026-07-28**, todas en la opción que
      el plan recomendaba: (A) `PUT /api/workspace/documents/:id/content` como **ruta nueva**, con el
      `PATCH` intacto; (B) columna **`contentVersion`** y enmienda de la `002` a v0.4.0 como minor;
      (C) `react-markdown` + `remark-gfm` + `rehypeRawAsText` + `rehype-sanitize`, con la postura de
      producto aprobada **explícitamente** —el HTML embebido se muestra como **texto literal y no se
      renderiza nunca**—; (D) **`<textarea>` plano**, sin CodeMirror ni Monaco; (E) **«split view» =
      texto y preview lado a lado del MISMO documento**, no dos documentos distintos.
      Las filas A…E de §5 se **conservan con su razonamiento íntegro** y se marcan como resueltas: el
      motivo de una decisión es lo que hace falta el día que alguien quiera revisarla.
      **Convenio de versionado al aprobar, por consistencia con `001` y `002`**: aprobar **no** salta a
      1.0.0 — lo que cambia es el `Estado`. La versión sube a **v0.1.1** solo porque el contenido de §5
      cambió.
      **Tres dependencias nuevas**, todas en `apps/web` y todas instaladas por una sola tarea (`T-011`):
      `react-markdown` **10.1.0** (peer `react >=18`, satisfecho por React 19.2.8), `remark-gfm`
      **4.0.1** y `rehype-sanitize` **6.0.0**. Versiones fijadas contra npm y API verificada con
      `context7` el 2026-07-28. `rehype-raw` **no** se instala, y eso es parte del diseño.
      La cadena del preview se decidió **midiendo**, no leyendo documentación: se instalaron las tres
      librerías fuera del repositorio y se renderizó un corpus de cargas comparando salidas
      (`plan.md` §1.3). Salieron dos cosas que no eran obvias: (1) `react-markdown` **sin** sanitizador
      ya escapa el HTML del markdown como texto, así que es seguro con esas cargas —pero solo mientras
      nadie añada un plugin—; (2) `rehype-sanitize` **a secas borra prosa del usuario**
      (`<!-- oculto -->visible` se queda en nada). De ahí el paso propio `rehypeRawAsText` de ~12 líneas:
      seguro **y** sin pérdida.
      Los dos puntos que la `002` dejó anotados sin tarea quedan resueltos por escrito: el **riesgo #15**
      entra **acotado al editor** (AC-19, tres estados de error distinguibles) y la barra lateral no se
      toca; y el **AC-34** de la `002` **no necesita análogo** —aquel agujero era específico de un paquete
      enlazado del workspace, y estas tres dependencias son de npm, así que el lockfile las cubre—, pero
      sí hacía falta otra cosa: **AC-26**, que repite el corpus de XSS en Chromium real, porque una
      afirmación de seguridad verificada solo en jsdom no es una afirmación sobre navegadores.
      **`T-000` — enmienda de la `002` a v0.4.0 — hecha el 2026-07-28.** Aplicada la tabla de
      `003/spec.md` §6 sobre `specs/002-workspace-tree/` (`spec.md`: encabezado, `Estado`, AC-12, AC-15,
      AC-26, AC-31, AC-32 y el aviso que abre su §6; `plan.md`: §4, §5, §7; `CHANGELOG.md`: entrada
      `## v0.4.0 — 2026-07-28`), más `specs/README.md`, este archivo y `CLAUDE.md`.
      **Sin tocar una línea de código**, que era la regla: los cambios de test los harán `T-007`, `T-009`
      y `T-013`, cada uno junto a la implementación que los provoca.
      Verificado: `pnpm test` → **exit 0** · shared **65** · web 12 archivos / **188** · api 19 suites /
      **264**. Son las cifras exactas del cierre de la `002`, y se corrieron **antes y después** de la
      enmienda con resultado idéntico — que es justamente lo que demuestra que no se tocó código, junto
      con un `git status` sin un solo archivo modificado en `apps/**` ni `packages/**`.
      **`CLAUDE.md`**: la frase «tabs tipo VS Code al abrir documentos y split view» era ambigua y la
      `005` se iba a apoyar en ella. Corregida con la edición mínima que quita la ambigüedad.
      **Tres dependencias nuevas**, todas en `apps/web` y todas instaladas por una sola tarea (`T-011`):
      `react-markdown` **10.1.0** (peer `react >=18`, satisfecho por React 19.2.8), `remark-gfm`
      **4.0.1** y `rehype-sanitize` **6.0.0**. Versiones fijadas contra npm y API verificada con
      `context7` el 2026-07-28. `rehype-raw` **no** se instala, y eso es parte del diseño.
      Decisiones de más impacto, con su evidencia: **`PUT /api/workspace/documents/:id/content`** como
      ruta nueva en vez de ampliar el `PATCH` (ampliarlo rompería un comportamiento verificado de la
      `002` y metería el guardado automático en el camino del `409 DOCUMENT_TITLE_TAKEN`) · columna
      **`contentVersion`** como token de concurrencia en vez de `updatedAt` (que renombrar y mover
      también mueven, lo que produciría conflictos falsos) · sexto throttler **`documentContent`**
      120/min declarado a nivel de método (verificado en `throttle.ts` que `getAllAndOverride` hace ganar
      al método sobre la clase) · preview con **cuatro capas** y nunca `dangerouslySetInnerHTML`.
      La cadena del preview se decidió **midiendo**, no leyendo documentación: se instalaron las tres
      librerías fuera del repositorio y se renderizó un corpus de cargas comparando salidas
      (`plan.md` §1.3). Salieron dos cosas que no eran obvias: (1) `react-markdown` **sin** sanitizador
      ya escapa el HTML del markdown como texto, así que es seguro con esas cargas —pero solo mientras
      nadie añada un plugin—; (2) `rehype-sanitize` **a secas borra prosa del usuario**
      (`<!-- oculto -->visible` se queda en nada). De ahí el paso propio `rehypeRawAsText` de ~12 líneas:
      seguro **y** sin pérdida.
      Los dos puntos que la `002` dejó anotados sin tarea quedan resueltos por escrito: el **riesgo #15**
      entra **acotado al editor** (AC-19, tres estados de error distinguibles) y la barra lateral no se
      toca; y el **AC-34** de la `002` **no necesita análogo** —aquel agujero era específico de un paquete
      enlazado del workspace, y estas tres dependencias son de npm, así que el lockfile las cubre—, pero
      sí hacía falta otra cosa: **AC-26**, que repite el corpus de XSS en Chromium real, porque una
      afirmación de seguridad verificada solo en jsdom no es una afirmación sobre navegadores.
      Verificado: los cuatro archivos existen en `specs/003-editor/`; `specs/README.md` actualizado.
      **Sin comandos de test que correr todavía** — no hay código de esta spec.


### Fase 5 — Implementación de `003-editor`


Detalle en `specs/003-editor/tasks.md`. **17 de 17 tareas verificadas** — spec **complete** el 2026-07-28. Cada línea lleva el
comando corrido y su salida real.

**Estado: cerrada.** `shared` **81** · `apps/web` 16 archivos / **321** · API unit 21 suites / **305** ·
API e2e 22 suites / **511** (40,2 s) · `pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24**, sin
un solo `429` · `typecheck` y `lint` en **0** en los tres paquetes.

Dos cifras se movieron desde el registro parcial y conviene no arrastrar las viejas: **API unit son 305 y
no 304** (`T-016` añadió uno), y **la suite e2e del API baja de ~108 s a 40 s** por el realineamiento de
`workspace-document-content-throttle`, que sustituyó la espera del `ttl` por resets en los hooks.

_(Los tres rojos de `swagger.e2e-spec.ts` que este apartado anunciaba mientras `T-009` estaba pendiente
quedaron cerrados por esa tarea. Resultaron ser **cuatro** cambios de recuento y no tres; ver `T-009`.)_

- [x] **T-000** · `orchestrator` · Enmienda de la spec `002` a v0.4.0 — 2026-07-28
      Aplicada la tabla de `003/spec.md` §6 sobre `specs/002-workspace-tree/`, más `specs/README.md`,
      este archivo y `CLAUDE.md`. **Sin tocar una línea de código.**
      Verificado: `pnpm test` → exit 0 · shared **65** · web 12/**188** · api 19/**264**, corrido **antes
      y después** con resultado idéntico, y `git status` sin un solo archivo modificado en `apps/**` ni
      `packages/**`. Después salieron dos patches de la propia enmienda: **v0.4.1** (dos bytes de control
      que hacían que `grep` tratara el `CHANGELOG.md` como binario) y **v0.4.2** (la lista de §6 se quedó
      corta; ver `T-007`).

- [x] **T-001** · `backend` · `setup` · Columna `contentVersion` y migración — 2026-07-28
      Verificado: `prisma migrate dev --name document_content_version` → 0 · `prisma generate` → 0 ·
      `prisma migrate status` sin pendientes · columna comprobada en el esquema **real** con el MCP
      `postgres` (`integer NOT NULL`, `DEFAULT 0`).
      Nombre real de la migración: **`20260728202008_document_content_version`**. Es la primera vez en el
      proyecto que la predicción del plan **acierta** — en `001` y `002` no coincidió.

- [x] **T-002** · `backend` · Dominio puro `contentBytesOf` — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test document-content`. Cubre el multibyte (`ñ`→2,
      `🙂`→4), el vacío y el `\r\n` sin normalizar, y comprueba que el archivo no importa nada de Nest ni
      de Prisma.

- [x] **T-003** · `backend` · `WorkspaceRepository.saveDocumentContent` — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test workspace.repository` → **27**.
      `updateMany` condicional con `userId` **y** `contentVersion` en el mismo `where`; versión rancia no
      escribe nada, `updatedAt` incluido; `createDocument` pasa a usar `contentBytesOf`.

- [x] **T-004** · `backend` · Throttler `documentContent` — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test throttle` → **26** ·
      `pnpm --filter @one-markdown/api test throttle-coverage` → **9**.
      Confirmado por test lo que el plan había verificado leyendo el código: `getAllAndOverride` hace que
      el `@Throttled` de **método** gane al de **clase**, así que no hizo falta partir el controlador.

- [x] **T-005** · `backend` · `PUT /api/workspace/documents/:id/content` — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test:e2e workspace-document-content` → **23**.
      Cubre AC-1…AC-9 y AC-13: feliz, vaciado, validación con la fila intacta, 200.000 caracteres,
      conflicto de versión, concurrencia con `Promise.all`, propiedad y credencial (`404` **también** con
      versión incorrecta, nunca `409` sobre documento ajeno), idempotencia por versión, ortogonalidad con
      renombrar/mover, y `413` por encima de 2 MiB.

- [x] **T-006** · `backend` · Contrato compartido — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/shared test` → **81** (antes 65).
      **Dejó deuda, y está registrada**: `plan.md` §3 prometía que `MAX_DOCUMENT_CONTENT_CHARS` «se
      reexporta y no se duplica a mano», pero `packages/shared` **no puede importar de `apps/api`** —la
      dependencia va al revés—, así que se implementó como **valor espejo**. El `200_000` está escrito dos
      veces y el test de `shared` solo fija **su propio** literal, o sea que una divergencia no la
      detectaría nadie. Se cierra con **`T-016`**, añadida el 2026-07-28.

- [x] **T-007** · `backend` · `contentVersion` en las respuestas de documento — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test:e2e workspace-documents` → **62** ·
      `pnpm --filter @one-markdown/api test:e2e workspace-tree` → **15** · api unit → **304**.
      **Paró y reportó, que es lo que había que hacer**: cae una **tercera** aserción de claves exactas
      que §6 no autorizaba (`workspace.repository.spec.ts:334`). Antes de reportar verificó con
      `git show HEAD` que era código de la `002` y no una rotura de `T-003`. Se autorizó, se añadió a §6 y
      la `002` subió a **v0.4.2**.
      **Y midió algo que cambia la spec**: coló un `content: true` en `DOCUMENT_SUMMARY_SELECT` y **los 76
      casos HTTP siguieron verdes** mientras el árbol descargaba de TOAST el texto de todos los
      documentos. Como los DTO se construyen **campo a campo**, una columna de más en un `select` no puede
      llegar a la respuesta y **ninguna aserción HTTP la verá jamás**. Por eso AC-11 pasa a verificarse
      también sobre el juego exacto de claves de los dos `select` exportados. Es el hallazgo más valioso
      de la fase: un defecto real, de coste de lectura, invisible por el único canal que la spec miraba.

- [x] **T-008** · `backend` · Cupo propio del guardado — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test:e2e workspace-document-content-throttle` → **3**.
      Comprueba AC-10 en los dos sentidos: agotar `documentContent` no agota `workspace` ni al revés.
      **Deuda abierta, por culpa de una regla que el orchestrator escribió mal.** `tasks.md` prohibía
      llevar resets de contadores «a la suite del API», lo cual **es falso**:
      `workspace-throttle.e2e-spec.ts` ya resetea en sus tres hooks **y aun así exige `429` nueve veces**,
      y el idioma está en **17** archivos e2e con **39** puntos de llamada. La regla real es sobre el
      **momento** (en los límites sí, a mitad de una secuencia de agotamiento no), no sobre el lugar.
      `T-008` cumplió la letra de la regla equivocada y resolvió la limpieza **esperando a que venza la
      ventana del `ttl`**: funciona, pero cuesta **~60 s de espera pura por corrida** —de ~65 s totales,
      solo ~5 s son las ~248 peticiones HTTP— y usa un idioma distinto del de los otros 17 archivos. Se
      realinea en cuanto la base quede libre; no cambia ningún AC. Regla corregida en `T-015` y en el
      CHANGELOG de la `003` v0.1.2.

- [x] **T-009** · `backend` · OpenAPI de la ruta nueva — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test:e2e swagger` en verde, y con él **la suite e2e
      del API completa: 511/511 en 22 suites**.
      **Fueron cuatro recuentos, no tres.** El que faltaba en la lista de §6:
      `WorkspaceDocumentContentResponseDto` en `WORKSPACE_RESPONSE_SCHEMAS`. **No provocó rojo** porque
      esa lista no tiene `toHaveLength` —solo alimenta un `it.each`—, así que dejarla corta habría
      significado que el DTO de salida nuevo **no tenía aserción de existencia** por esa vía. Un hueco
      silencioso, que es peor que un rojo.

- [x] **T-010** · `frontend` · `saveDocumentContent` en el cliente HTTP — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/web test http` → **61**.

- [x] **T-011** · `frontend` · `MarkdownPreview`, `rehypeRawAsText` y el corpus de XSS — 2026-07-28
      Verificado: `MarkdownPreview` → **51** · `rehype-raw-as-text` → **6** · `no-dangerous-html` → **4**.
      Instaló las tres dependencias con las versiones exactas del plan; `vite.config.ts` **no necesitó
      nada** y no se tocó.
      **Tres cosas medidas que valen más que el verde**, todas ya escritas en la spec:
      1. **La mutación M3 destapó que AC-25 contradecía la decisión 7.** Las librerías permiten `irc:`,
         `ircs:` y `xmpp:` en `href` (`react-markdown/lib/index.js:124`,
         `hast-util-sanitize/lib/schema.js:143`) y el AC decía «`http`, `https`, `mailto`». Era un
         **descuido de redacción, no un agujero**: ninguna carga pasaba sin ser vista. El usuario eligió
         ampliar el AC a la lista real; `003` → v0.1.3.
      2. **`rehype-sanitize` es redundante hoy**: quitándolo, los 51 siguen verdes; quitando **además**
         `urlTransform` caen 3. Sujetan la capa 1 (no haber instalado `rehype-raw`) y la 4. **Eso es el
         objetivo, no un defecto del test**, y está escrito en `plan.md` §2.2.1 con la regla derivada —
         una capa no se retira porque ningún test la eche de menos.
      3. **Coste en el bundle: +255 módulos, +160,7 kB (+48 kB gzip)**. Hubo que importar
         `MarkdownPreview` temporalmente desde `main.tsx` para medirlo: hoy nadie lo importa y el build lo
         *tree-shakeaba*, así que la comprobación habría dado **cero**.

- [x] **T-012** · `frontend` · Store del editor — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/web test editor.store` → **28**, y `apps/web` completa en
      **290/290**.
      **Volvió a quedarse corta la lista de §6, y van dos**: `apps/web/src/test/workspace-fixtures.ts`
      —código intacto de la `002` (`168b840`)— construye un `MarkdownDocument` a mano y no ponía
      `contentVersion`. **14 tests en rojo en 5 suites** más un error de `tsc`; arreglo de una línea.
      Mismo procedimiento que `T-007`: paró, verificó, se autorizó, se registró. `002` → v0.4.3.
      **Añadió un séptimo campo a `EditorEntry` que el plan no declaraba**, `serverVersion`, y es un error
      de diseño del plan y no una licencia: con solo `serverContent`, `resolveTakeServer` deja el editor
      limpio pero con el `contentVersion` viejo, así que la primera tecla siguiente vuelve al **mismo
      `409`**.
      Dos decisiones suyas quedan como contrato en `plan.md` §7: `open(id)` **propaga** el error (si no,
      la página no puede conservar el `loading`/`missing`/`error` que AC-31 obliga a heredar), y si tras
      un `409` **falla la relectura** el estado es `unreachable` y **no** `conflict` — un conflicto que no
      puede enseñar contra qué no se puede ofrecer a resolver.

- [x] **T-016** · `backend` · El espejo de `MAX_DOCUMENT_CONTENT_CHARS` no puede divergir en silencio —
      2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test document-content` → **20**.
      Tarea **nueva** del 2026-07-28, salida de la deuda de `T-006`. Cerrada con un test de acoplamiento
      en `apps/api` y **no** con una reexportación: hoy la dependencia de `apps/api` sobre
      `packages/shared` es solo de **tipos**, y reexportar pondría un límite de dominio del servidor
      detrás de `packages/shared/dist` — la clase de defecto de AC-34 de la `002`, pero saliendo como un
      `400` inexplicable en producción.

- [x] **Realineamiento de `workspace-document-content-throttle`** — 2026-07-28
      La deuda que abrió `T-008` por cumplir al pie de la letra una regla que el orchestrator había
      escrito mal. Sustituida la espera del `ttl` por `resetThrottleCounters` en los hooks de ciclo de
      vida, que es el idioma de los otros 17 archivos: **de 65 s a 6,3 s**.
      **Y se comprobó que no se cambió un test que medía por uno que no mide**: con la mutación aplicada
      vuelven a caer **los mismos dos casos**. Sin esa comprobación, «ahora tarda diez veces menos» es
      indistinguible de «ahora no comprueba nada».

- [x] **T-013** · `frontend` · `DocumentEditorPage` y retirada del andamio de la `002` — 2026-07-28
      Verificado: `apps/web` **290 → 313**.
      Se le amplió el alcance con **`setViewMode`**, que `plan.md` §7 declaraba como acción del store pero
      que no pedía el RED de `T-012` ni incluían las ARCHIVOS de `T-013`: **no era de nadie**, y es un
      fallo de reparto del orchestrator. Va **al store** y no a un `useState` local, porque con «split
      view = texto y preview del mismo documento» el modo activo es estado **por documento** y la `005`
      tiene que conservarlo al cambiar de pestaña.
      **Retiró el andamio** (`DocumentViewPage` borrado) trasladando **11 de 12** casos. Y **los tres de
      navegación no estaban en el encargo**: los portó tras comprobar que `WorkspaceTreeView.test.tsx`
      solo afirma `selectedId`/`aria-selected` y **nunca la ruta**, así que eran la **única** cobertura de
      «activar un documento abre `/documents/:id`» en todo el proyecto. Borrarlos la habría hecho
      desaparecer **sin que ningún test se pusiera rojo**: la misma clase de hueco silencioso que el
      `WORKSPACE_RESPONSE_SCHEMAS` sin `toHaveLength` de `T-009`, y encontrado por el mismo método —
      preguntarse quién más cubre esto antes de borrar.

- [x] **T-014** · `frontend` · e2e de navegador — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/web exec playwright test editor` → **3 passed**.
      **Los tres casos pasaron a la primera, así que hizo cinco mutaciones de control**, que es la única
      forma de distinguir «funciona» de «no mide». Dos valen doble:
      1. El centinela `window.__xssTripped` se dispara **independientemente** del manejador de `dialog`:
         son **dos redes**, no una con dos nombres.
      2. La rama de `src` —que con el corpus real **nunca** se activa, porque el saneado vacía el atributo
         antes— **existe y etiqueta bien**, comprobado con una carga de control. Sin eso sería código
         muerto del que nadie sabría si funciona, en el test que sostiene una afirmación de seguridad.

- [x] **T-015** · `frontend` · Presupuesto de la suite de navegador — 2026-07-28
      Verificado (AC-34): `playwright test --retries=2 --repeat-each=3` → **24 passed**, **ningún `429`**.
      **RED real**, y con una lección: el caso que cayó **no fue el del editor sino el del árbol**. El cupo
      es **por IP y global de la suite**, así que lo paga quien pasa por ahí, no quien gasta — que es
      exactamente lo que la `002` aprendió con su AC-35 y lo que hace que este AC no se pueda deducir
      leyendo el archivo que más consume.
      **GREEN en dos pasos**: primero gastar menos (pico **98/120**); después, como AC-34 exige el
      escenario **con reintentos** y 22 de margen no cubren uno, resetear **`workspace` únicamente** (pico
      **20/120**). **`documentContent` NO se resetea**: la suite gasta **4 de 120**, así que neutralizarlo
      restaría cobertura a cambio de nada. Dejó entrada en el CHANGELOG de la `001` (**v0.1.2**) por tocar
      `apps/web/e2e/support/*`, y el orchestrator cerró la cabecera de versión de esa spec y su fila en
      `specs/README.md`, que son suyas.
      **Evaluó y NO tocó** el `GET …/documents/:id` duplicado por `StrictMode` (8 de 21 peticiones):
      correctamente, porque las tres salidas quedaban fuera de su alcance. Queda como deuda con
      destinatario en `003/spec.md` §8.1 → spec `005`.

**La Fase 5 cierra la spec `003` en `complete`: 34/34 AC y 17/17 tareas**, sin ninguna salvedad de
verificación manual —a diferencia de la `002`, cuyo AC-34 no lo caza CI—. Cifras finales, corridas de una
vez: `shared` **81** · `apps/web` 16 archivos / **321** · api unit 21 suites / **305** · api e2e 22 suites
/ **511** (40,2 s) · `pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24** · `typecheck` y `lint`
en **0** en los tres paquetes.

**Dos deudas quedan vivas, las dos con destinatario y razón escritos** (`003/spec.md` §8): la
deduplicación de `open(id)` es de la **`005`** —que tiene que tocar ese método de todas formas y que es
quien convierte el problema en real de producción—, y el caso de conflicto de AC-33 **no se estabiliza
preventivamente**: corrió 13 veces sin parpadear y lo que se deja escrito es **la causa**, para que un rojo
futuro no se diagnostique como un problema de cupo.

**Y dos afirmaciones de la propia spec que la implementación obligó a corregir**, que es lo que más vale
de esta fase:

1. **La lista cerrada de artefactos tocables (§6) se quedó corta dos veces** —`workspace.repository.spec.ts`
   (`T-007`) y `apps/web/src/test/workspace-fixtures.ts` (`T-012`, 14 tests en rojo)—, las dos por el mismo
   motivo: el radio de un cambio de contrato incluye **todo lo que construye un valor del tipo**, fixtures
   de test incluidos, no solo los DTO. Las dos veces el agente **paró y reportó**, que es lo único que
   hace que una lista cerrada sirva de algo.
2. **`rehype-sanitize` pasó de «redundante» a tener un agujero propio con nombre.** La v0.1.2 afirmaba,
   con medición, que quitarlo no rompía nada. Al añadir la carga de imagen con `irc:` cae **exactamente**
   esa carga: es la **única** capa que defiende los protocolos de `src`. Estaba **predicho por escrito** en
   §2.3 y se confirmó añadiendo la carga.

### Plan de despacho de la Fase 4 (2026-07-25)

Reparto por **archivos**, no solo por tarea: en la Fase 3 dos agentes coincidieron en un mismo archivo
(uno no pudo añadir `implements LoginResult` porque el otro lo tenía abierto). Cada ola indica qué archivos
son de quién.

| Ola | Tareas | Paralelismo real | Condición de entrada |
|---|---|---|---|
| 1 | `T-001` → luego `T-002` ‖ `T-003` | `T-002` y `T-003` en paralelo: archivos disjuntos (`workspace-name.*` vs. `tree-graph.*`); `workspace.constants.ts` lo crea **solo** `T-002` | `T-001` verificado (migración aplicada) |
| 2 | `T-004` | En solitario: toca `ErrorResponseDto` (spec `000`) y `packages/shared` | `T-002` y `T-003` en verde |
| 3 | `T-005` → (`T-006` → `T-007`) ‖ (`T-008` → `T-009`) | Directorios y documentos **sí** van en paralelo: `plan.md` §6 reparte la orquestación en `directories.service.ts` y `documents.service.ts` justo por esto. `workspace.module.ts` lo **crea** `T-005` (con los tres controladores) y `T-008` solo añade su servicio, ya con `T-005` cerrada: nunca a la vez | `T-004` en verde |
| 4 | `T-010` → `T-016` ‖ `T-011` ‖ `T-012` ‖ `T-013` ‖ `T-014` ‖ `T-024` | `T-016` es del backend pero solo toca `packages/shared` + los `implements` de los DTO: se despacha aparte. `T-024` también va aparte y por el mismo motivo que `T-004` en la ola 2: toca `src/common/filters/**`, que es contrato de la spec `000`, y nadie más del Bloque D entra en `common/` | `T-007` y `T-009` en verde |
| 5 | `T-017` → `T-018` → `T-019` → (`T-020` → `T-021`) ‖ `T-022` | Frontend en serie salvo `T-022`, que solo toca `DocumentViewPage` + `routes.tsx` | `T-016` en verde (contrato compartido publicado) |
| 6 | `T-015` (Swagger) y `T-023` (e2e de navegador) | En paralelo: `swagger.e2e-spec.ts` vs. `apps/web/e2e/` | `T-014` en verde para `T-015`; `T-013`, `T-021` y `T-022` para `T-023` |
| 6b | `T-025` (retirada del `404` de `/tree`) | En solitario, pero **compatible con la ola 5**: solo toca `src/workspace/workspace.controller.ts` y `test/swagger.e2e-spec.ts`, que son de `apps/api`, y el agente `frontend` está en `apps/web` | `T-015` en verde (es la que dejó la declaración puesta) |

**Estado de las olas al 2026-07-25**:

| Ola | Estado |
|---|---|
| 1 · 2 · 3 · 4 | **cerradas y verificadas** |
| 6b | **cerrada** — `T-025`. Corrió en paralelo con la ola 5 tal como preveía la tabla, sin ningún cruce de archivos |
| 5 | **cerrada** — `T-017`…`T-022`. `T-020` y `T-021` fueron en serie sobre `WorkspaceTreeView.tsx`, como preveía la tabla |
| 6 | **cerrada** — `T-015` (adelantada a la ola 4) y `T-023`, la última tarea de la spec |

**Las seis olas están cerradas y la Fase 4 con ellas.** La corrida de `typecheck` y `lint` **de raíz**, que
la ola 4 dejó aplazada mientras el agente `frontend` tenía `apps/web`, está hecha y en verde: ver la tabla
de «Cierre de la Fase 4 y de la spec `002`».

El endurecimiento que abre la v0.3.0 (`T-026`, `T-027`) **no entra en esta tabla de olas**: no es alcance
aprobado y los dos son de `frontend` sobre archivos disjuntos (`vite.config.ts` + `playwright.config.ts`
frente a `e2e/support/*`), así que pueden ir **en paralelo** cuando se despachen. Ojo con un cruce que sí
existe: `T-026` **retira** el `--force` de `playwright.config.ts` y `T-027` cambia cuántas veces se llama a
`POST /register`; si se lanzan a la vez, el que mida `pnpm test:e2e` medirá también el cambio del otro. Se
despachan en paralelo, pero **se verifican por separado**.

**Cerradas las dos el 2026-07-25**, y el cruce previsto se manejó como estaba escrito: cada una llevó su
propio RED medido y su propio `DONE`, y las cifras finales se tomaron una vez con las dos ya dentro. El
aviso valió la pena: el RED de `T-026` se midió **con el `--force` ya retirado**, que es la única forma de
que el envenenado de la caché signifique algo.

---


### Nota del índice — movida desde `specs/README.md` (2026-08-03)

El índice volvió a ser una línea por spec; esta era su fila, literal.

- **Feature**: Editor — vista texto/preview, guardado, sanitización del preview
- **Versión**: **0.2.0**
- **Depende de**: 002

**Estado tal como estaba escrito**: **complete** (2026-07-29) — **34/34 AC** y **17/17 tareas** verificadas, y **la enmienda de la v0.2.0 ya implementada** por `T-005` y `T-008` de la `005` el mismo día: la entrada deja de descartarse al navegar y el conmutador tiene tres modos. La **v0.2.0** es un **minor de enmienda pedido por la `005`** y aplicado por su `T-000` **sin tocar una línea de código**: **AC-28** pierde su segunda mitad —«si tiene éxito, la entrada se descarta del store»—, porque el desalojo pasa a ser competencia de **cerrar una pestaña**, que es la política que esta misma spec ya le había asignado a la `005` (su decisión 9); y **AC-22** pasa de **dos modos a tres** con `'split'`, con la redacción diciendo «uno por cada modo» en vez de un número, para no tener el recuento en dos sitios. **Minor y no major** porque la garantía que AC-28 le da a la persona no se rompe, **se refuerza** —el borrador se conserva ahora también cuando el guardado tuvo éxito— y lo que cambia es el mecanismo interno obligando a tocar tests verdes, mismo criterio que la v0.4.0 de la `002`; el argumento contrario (v1.0.0 por la letra de la regla, con un test verde que afirma el descarte) queda **escrito** en el CHANGELOG porque era legítimo. **Consecuencia asumida**: desde el 2026-07-29 esos **dos AC van por delante del código**, y los implementan `T-005` y `T-008` de la `005`. Antes de la enmienda · shared **81** · web 16/**321** · api unit 21/**305** · api e2e 22/**511** · `pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24** sin un solo `429` · `typecheck`+`lint` en 0. **Sin ninguna salvedad de verificación manual** (a diferencia del AC-34 de la `002`). Decisiones: `PUT …/content` como ruta nueva · columna `contentVersion` · `react-markdown` + `remark-gfm` + `rehypeRawAsText` + `rehype-sanitize`, con el HTML embebido **como texto literal, nunca renderizado** · `<textarea>` plano · «split view» = texto y preview del **mismo** documento. Dos deudas con destinatario en su §8: deduplicar `open(id)` (→ `005`) y la ventana estrecha de AC-33, **no estabilizada a propósito**
