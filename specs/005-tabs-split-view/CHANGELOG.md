# Changelog — Spec 005 Pestañas de documentos y vista dividida

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.2.1 — 2026-07-29

**Patch de cierre. Cierra la spec entera**: **34/34 AC** y **12/12 tareas** verificadas. No añade
alcance ni cambia ningún contrato.

**Cifras del cierre**: `apps/web` **21 archivos / 524** · `shared` **81** · api unit **305** · api
e2e **511** · `test:e2e` **11** · `--retries=2 --repeat-each=3` **33 passed sin un solo `429`** ·
`typecheck` y `lint` en **0**. `git status` sobre `packages` y `apps/api` **vacío**: la decisión de
alcance de §0 se sostuvo hasta el final.

**El presupuesto, con las tres ventanas que AC-33 exige**: pico de `workspace` **28 de 120 por
corrida** (criterio < 60); **sin un solo `429`** bajo reintentos, y **sin cifra ahí**, a propósito; y
el ahorro de la deduplicación **medido con contrafáctico**: **36** sin ella contra **28** con ella,
**ocho peticiones por corrida**, que es exactamente el desperdicio que la `003` había documentado.
El «antes» no se recordó: se revirtió `open(id)` a la lógica de la `003`, se midió y se restauró.

**Una lección de instrumentación que vale más que la cifra.** La primera sonda de Redis reportó
**`pico=0`**, y no porque el valor fuera cero: **`redis-cli` no existe en esta máquina** y el `PONG`
de la comprobación previa lo había devuelto el `docker.exe` de respaldo de un `||`. **Un cero de un
instrumento desconectado es indistinguible de un cero real**, y habría cerrado AC-33 con una cifra
falsa y tranquilizadora. Se detectó porque `DBSIZE` devolvía cadena vacía en vez de un número, y la
sonda se rehízo **dentro del contenedor**, comprobando antes con una clave de prueba que veía lo que
tenía que ver. Regla para quien mida después: **valida el instrumento contra un valor conocido antes
de creerte el que buscas**.

**Seis de las once tareas de código las implementaron agentes `frontend`** (T-002, T-006, T-008,
T-009, T-010), y las cinco que reportaron algo lo reportaron **en vez de decidir en silencio**: los
seis ayudantes duplicados donde la spec decía cinco, tres comandos `DONE` que no ejecutaban nada, el
`return null` que desmontaba una región viva, un requisito de tamaño de objetivo **sin AC** que
escondía un defecto real, y una consulta ambigua que era una mina puesta en otro archivo. Ninguno
debilitó una aserción para cerrar su tarea.

## v0.2.0 — 2026-07-29

**Minor, y el único de esta spec que añade alcance.** Pasa a **34 AC** con las mismas **12 tareas**.

**AC-34 nuevo — tamaño de objetivo (WCAG 2.2 SC 2.5.8).** Cada pestaña de documento y su control de
cierre miden **≥ 24 × 24 px CSS**, verificado con `boundingBox()` en Chromium, en el mismo caso que
AC-19 y con el mismo mecanismo que el AC-29 de la `004`.

**Por qué llega ahora, dicho sin adornos: el requisito ya estaba, el AC no.** Vivía en `plan.md` §4.6
(«las pestañas y su cruz, ≥ 24 × 24 px») y en el cuerpo de `T-010`, pero **ningún criterio lo
respaldaba** — y por ese hueco se coló un defecto real: la «×» de cierre medía **19,73 × 20 px**. Un
requisito que vive solo en el plan es un requisito que **nadie cuenta al revisar la cobertura**, y esa
es la lección de esta versión.

**Lo destapó `T-010`, y por hacer lo correcto**: el agente encontró el rojo, **no debilitó la
aserción** —que habría sido neutralizar en vez de gastar menos— y **paró en vez de tocar
`DocumentTabs.tsx`**, que no estaba en su lista de artefactos. El arreglo fue una línea (`size-6`),
autorizada y verificada después: `test:e2e tabs` → **2 passed**.

**Precisión medida en AC-19**: el ancho que tiene que crecer es el del `role="tabpanel"`, **no** el
del `<textarea>`. Sobre el textarea el criterio sería **imposible por aritmética** —768 px
(`max-w-3xl`) en modo texto contra ~568 px por columna en dividida—, y lo que el AC vigila es que la
**página** ensanche. El contrafáctico funciona así medido: dejando `max-w-3xl` en `split`, los dos
anchos salen iguales y la aserción se pone roja.

**Y un endurecimiento que no cambia ningún AC**: las tres consultas de `e2e/editor.spec.ts` que piden
una pestaña del conmutador pasan a `exact: true`. Con **dos** `tablist` en la página y el título del
documento **dentro** del nombre accesible de su pestaña, la coincidencia por subcadena de Playwright
haría que un documento titulado «Texto» resolviera a dos elementos. Hoy los títulos llevan un uuid y
no colisionan: la mina estaba puesta y no había disparado.

## v0.1.4 — 2026-07-29

**Patch escrito con `T-006` verde. No mueve el recuento**: siguen **33 AC** y **12 tareas**.

**`plan.md` §4.3 decía que la tira «devuelve `null` si no hay pestañas abiertas», y era falso de una
forma que costaba dos AC.** `closeTab` es **asíncrono**, y entre su desalojo —que ya deja `openIds`
vacío en el store— y la reanudación del `await` hay puntos de comprobación de microtareas en los que
React **ya ha vuelto a pintar**. Con `return null`, la región viva se desmontaba **antes** de que
hubiera nada que anunciar: se llevaba el `ref`, el anuncio de **AC-28** y el destino del foco de
**AC-22**, y el foco caía al `<body>`. Instrumentado por el agente: `live=undefined`,
`after focus active=BODY`.

**Lo encontró un test, no una revisión**: el caso «al cerrar la última pestaña el foco va a un
destino existente y nunca al `<body>`» quedó rojo con el `return null`. Es exactamente lo que ese AC
existía para cazar.

**Arreglo**: sin pestañas desaparece **la tira**, no el componente. Lo que se pinta de más es un
párrafo `sr-only` **vacío**; lo que se perdía era AC-28 entero y la cola de AC-22.

**Y una corrección de trazabilidad: AC-4 pasa de `T-007` a `T-006`.** La navegación (clic → el
documento; cerrar la activa → la vecina o `/`; cerrar una no activa → sin navegar) acabó viviendo en
`DocumentTabs`, porque `AppShell` lo monta **sin props** y no hay otro sitio donde pueda estar sin
obligar a `T-007` a editar un archivo que no es suyo. `T-007` se queda con lo que de verdad le toca:
montar la tira y poner el `id` al `<main>`.

## v0.1.3 — 2026-07-29

**Patch escrito con `T-008` verde. No mueve el recuento**: siguen **33 AC** y **12 tareas**, y no
cambia ni una línea de código.

**Tres comandos `DONE` de `tasks.md` no ejecutaban nada.** `T-005`, `T-007` y `T-008` los tenían
escritos como `test "A|B"`, y **el filtro de archivos de Vitest 4 es una subcadena, no una expresión
regular**: la forma con tubería sale con `No test files found, exiting with code 1`. Comprobado a
mano contra las dos formas, no deducido: con tubería, `No test files found`; con dos filtros
(`test A B`), `Test Files 2 passed · Tests 97 passed`.

**Es la misma familia que el AC-33 de la `004`** —un criterio escrito junto a un comando que no puede
verificarlo—, con una diferencia que le quita gravedad y que conviene dejar dicha: este **falla
ruidoso** (exit 1) en vez de pasar en falso, así que no podía colar un GREEN inexistente; lo que
producía era una tarea imposible de cerrar. Lo destapó el agente que implementó `T-008`, que lo
reportó en vez de sustituir el comando en silencio.

**Arreglo**: los tres pasan a dos filtros, y `tasks.md` gana una **nota al final** con el motivo,
para que la próxima tarea no lo reintroduzca por costumbre de escribir alternativas con `|`.

## v0.1.2 — 2026-07-29

**Patch escrito con `T-002` verde, y lo abre un defecto de esta spec contra sí misma.** No mueve el
recuento: siguen **33 AC** y **12 tareas**.

**AC-30 decía «los ayudantes son cinco y están enumerados en `plan.md` §5.2»**, y la enumeración de
§5.2 tenía **seis**: cinco filas de tabla más `SAVE_REGION_NAME`, que estaba en un párrafo **detrás**
de la tabla. Es exactamente el defecto que esta misma spec cita como lección de la `004` —que escribió
«14 elementos» en diez sitios mientras su propia tabla enumeraba 16— y lo cometió en su propia
redacción, en el AC que hablaba de enumerar.

**Lo encontró el agente que implementó `T-002`**, que además hizo lo correcto: implementó **seis**,
porque `tasks.md` y el cuerpo de §5.2 sí los enumeraban bien, y **reportó la discrepancia en vez de
elegir en silencio**. Ninguna línea de código cambia por este patch.

**Arreglo, y es de forma y no de cifra**: (a) AC-30 **pierde el número** y remite a la tabla —«cuáles
son, uno por uno, está en la tabla de `plan.md` §5.2»—; (b) `SAVE_REGION_NAME` pasa a ser **fila de la
tabla**, porque un elemento fuera de la enumeración es un elemento que no se cuenta; (c) las otras dos
menciones a «cinco» de `plan.md` (decisión 12 y el árbol de archivos de §4.1) dejan de llevar cifra.
**El recuento vive ahora en un solo sitio: la tabla.** Poner «seis» en los cuatro sitios habría
arreglado el síntoma de hoy y dejado armada la misma trampa para el día que aparezca un séptimo.

## v0.1.1 — 2026-07-29

- **Las cinco decisiones abiertas de §8.1 quedan resueltas, las cinco en la opción que la spec
  recomendaba y sin ningún cambio de alcance.** El recuento se mantiene en **33 AC** y **12 tareas**,
  ni un solo AC cambió de redacción y ningún artefacto entró ni salió: por eso la subida es **patch
  (v0.1.0 → v0.1.1)** y no minor. Es el mismo criterio con el que la v0.1.1 de la `004` se justificó
  a sí misma.

- **A — la tira de pestañas es `role="tablist"` con botones.** Es lo que hace VS Code y el patrón que
  ya hay dos veces en el repositorio, expresa `aria-selected` —que un `<nav>` de enlaces no puede—, y
  su radio de rotura es **menor y está contado**: una consulta (`DocumentEditorPage.test.tsx:353`) que
  hay que tocar igual, frente a dos de specs cerradas sin ningún otro motivo. **Se asume a sabiendas
  la pérdida de `Ctrl`+clic y clic central** sobre las pestañas; la barra lateral, que sí es
  navegación, no se toca.

- **B — se cierra con un `<span aria-hidden>` dentro del botón de pestaña**, y con `Delete` como
  camino de teclado. No había alternativa razonable: un `<button>` dentro de un `<button>` es HTML
  inválido, y el único ejemplo de la APG con un control dentro de una pestaña (`tabs-actions`) está
  marcado *«Experimental content! Do not use except for new standards development purposes»* y depende
  de `aria-actions`, que no está en ninguna especificación publicada.

- **C — vista dividida fija al 50/50**, sin separador arrastrable. El separador es un widget ARIA
  completo (enfocable, con `aria-valuenow`/`min`/`max` y teclado propio) y además exigiría persistir
  la proporción para servir de algo. Sigue **fuera de alcance** (§4) y entra como spec propia si se
  quiere.

- **D — las pestañas abiertas NO se persisten**, ni en el navegador ni en el servidor: recargar deja
  abierta la que dice la URL. **Confirma que la `005` es solo `apps/web`** y que las 12 tareas se
  quedan como están. Es la decisión de la que colgaba todo el reparto, y por eso se tomó **antes** de
  escribir `tasks.md`: con persistencia en servidor habría tabla, migración, DTO de entrada y de
  salida, endpoint, tipo en `packages/shared` y un bloque de backend que **no se paraleliza** con la
  tarea de `shared`.

- **E — la enmienda de la `003` es minor, v0.2.0.** Lo que AC-28 le promete a la persona —no perder lo
  escrito al navegar— **no se rompe: se refuerza**, porque el borrador pasa a conservarse también
  cuando el guardado tuvo éxito; lo que cambia es el mecanismo interno y obliga a tocar tests verdes,
  que es el criterio con el que la v0.4.0 de la `002` se declaró minor siendo aditiva. **El argumento
  contrario queda escrito en §6.1 porque era legítimo**: por la letra de `specs/README.md` sería
  **v1.0.0**, y el descarte de la entrada es observable desde el store con un test verde que lo
  afirma. Se elige la lectura por la garantía y no por la letra, y se deja dicho para que nadie tenga
  que reconstruir por qué. Con esto, `T-000` deja de llevar una condicional.

## v0.1.0 — 2026-07-29

- Spec inicial (**draft**): **33 criterios de aceptación** en seis bloques (A modelo de pestañas ·
  B deduplicación de `open(id)` · C vista dividida · D accesibilidad · E deuda de entorno y de e2e ·
  F alcance y presupuesto) y **12 tareas** TDD (T-000…T-011), **once de `frontend`** más una de
  `orchestrator` que no toca código.

- **Alcance decidido: solo `apps/web`**, igual que la `004`. `packages/shared` y `apps/api` no
  reciben ni una línea, y **AC-32** lo convierte en verificable (`git status` + los recuentos de los
  otros dos paquetes idénticos a los del cierre de la `004`: shared **81** · api unit **305** ·
  api e2e **511**). La decisión depende **entera** de otra: **las pestañas abiertas no se
  persisten**. Si esa cayera del otro lado, la `005` tendría tabla, migración, DTO de entrada y de
  salida, endpoint, tipo en `packages/shared` y la secuencia forzada entre paquetes que la `004`
  describe en su §7 — por eso se decide **antes** de escribir `tasks.md` y queda como decisión
  abierta **D**.

- **Una afirmación heredada que esta spec corrige, y está en §1.2: con vista dividida NO hay dos
  paletas.** Tres documentos cerrados lo daban por hecho —`004/spec.md` riesgo #13,
  `specs/README.md` fila `005`, y el encargo de esta spec—, pero no se sigue de la definición que el
  propio proyecto fijó el 2026-07-28: «split view» es **texto y vista previa del MISMO documento**,
  así que hay **un** panel de texto y por tanto **una** paleta. La propia `004` lo tenía bien en su
  riesgo #10. Lo que sí sobrevive de esas notas —y esta spec lo aplica entero— es **la regla**: toda
  región viva nace con nombre accesible y nadie consulta una región por su contenido. Y la `005` **sí**
  añade una región nueva (el anuncio de cierre, AC-28), así que la página pasa a tener **tres**
  `role="status"` en modo texto. El problema es el mismo; el recuento y el motivo, no. **AC-18** lo
  convierte en algo que se puede romper: afirma la paleta con `getAllByRole(...)` y **longitud 1**,
  porque «hay una paleta» pasa igual con dos.

- **La restricción que la `004` §9.4 le dejó, resuelta y por escrito (§6.3)**: **cambiar de pestaña
  no desaloja** (AC-8), así que el historial de deshacer de la `006` sobrevive a los saltos —el gesto
  frecuente—; **cerrar una pestaña sí desaloja**, así que **cerrar pierde el historial**, y se acepta
  por tres razones: cerrar es un gesto explícito, el contenido no se pierde (cerrar fuerza el
  guardado y **no cierra si falla**, AC-6 y AC-7), y conservar el historial de documentos cerrados
  sería una caché sin cota que produce el peor defecto posible de un deshacer —reabrir un documento y
  que `Ctrl`+`Z` deshaga algo de hace tres horas—. **Consecuencia para la `006`**: la política de
  desalojo de la `005` **es** su cota, así que no necesita expulsión, ni serialización, ni límite
  propios.

- **Dos enmiendas a la spec `003`, que las aplica `T-000` sin tocar una línea de código** (mismo
  procedimiento con el que la `003` enmendó a la `002`): **AC-28** conserva sus mitades primera y
  tercera —forzar el guardado, conservar el borrador ante un fallo— y **pierde la segunda**, el
  desalojo al desmontar, que pasa a ser competencia de cerrar la pestaña; y **AC-22** pasa de **dos
  modos excluyentes a tres**, con la línea de su §4 «Ver texto y vista previa a la vez» trasladada de
  «fuera de alcance» a «lo implementa la `005`». **Qué versión le toca a la `003` queda como decisión
  abierta E**: por la letra de `specs/README.md` sería **major (v1.0.0)**; por lo que AC-28 protege
  —que nadie pierda lo escrito al navegar, garantía que aquí se **refuerza**— sería **minor
  (v0.2.0)**, que es la recomendación y el mismo criterio con el que la v0.4.0 de la `002` se declaró
  minor siendo aditiva.

- **Las siete restricciones heredadas quedan atendidas, y dos de ellas ampliadas al comprobarlas
  contra el código**:
  1. Política de desalojo → §6.3 y AC-4…AC-9, con la consecuencia para la `006` escrita.
  2. Deduplicación de `GET /documents/:id` → AC-10…AC-13, con el idiom *single-flight* que la `003`
     recomendó por nombre, **por id y no global** (AC-11: una promesa compartida haría que abrir dos
     documentos a la vez leyera uno solo).
  3. Regiones vivas con nombre → AC-26, con **cuatro** nombres enumerados: la del mensaje de carga de
     la `003`, que hoy es anónima, también lo recibe, porque la tira de pestañas se pinta **mientras**
     el documento carga.
  4. La regla «por nombre» vale también para los tests → AC-25, **ampliada de las regiones vivas a
     los `tablist` y los landmarks**: el fallo es el mismo, y hoy hay exactamente una consulta así
     (`DocumentEditorPage.test.tsx:353`).
  5. `watchConsole` a `e2e/support/` → AC-30 y AC-31, **ampliado de uno a seis ayudantes**: contados
     en el código, `editor.spec.ts` y `palette.spec.ts` duplican también `createDocument`, `textarea`,
     `uniqueTitle`, el *fixture* `test` con `session` y la constante `SAVE_REGION_NAME`. Extraer solo
     `watchConsole` habría sido un sexto del trabajo. La unificación elige la firma **tolerante**,
     que es superset de la otra.
  6. Toda cifra de cupo con su ventana y su comando → AC-33, con **tres** ventanas y **dos** comandos,
     y con una tercera mitad que la `004` no tenía: **(c)** el ahorro de la deduplicación tiene que
     **verse**, midiendo antes y después (la `003` documentó el desperdicio: **8 de 21** peticiones de
     `workspace` eran lecturas duplicadas).
  7. `E2E_WEB_PORT` → AC-29 y `T-001`, con `--strictPort` obligatorio: sin él Vite se muda de puerto
     en silencio y Playwright se cuelga esperando en una URL vacía, que es cambiar un aborto claro por
     un fallo oscuro. **`vite.config.ts` no se toca**: el `--port` de la CLI gana al de la
     configuración.

- **Las cuatro lecciones de la `004` aplicadas al escribir, no al revisar**: ningún número que se
  pueda derivar de una enumeración se escribe a mano (**AC-14** afirma los rótulos contra la
  enumeración importada, y las cuatro regiones vivas se enumeran en **un solo sitio**); cada AC de los
  bloques A y B lleva escrita **la mutación que lo mata**, y los que no la tenían se reescribieron
  hasta tenerla (**AC-3** existe justo por eso: sin él, un `activeId` en el store sería indetectable
  hasta que alguien usara el botón «atrás»); lo que **ningún test de este repositorio puede cubrir**
  está declarado como tal en §3.D en vez de fingido con un test; y **AC-27** se escribió contra la
  cabecera que existe hoy, con el botón «Guardar» de la `003` en medio, que es exactamente lo que
  hacía inalcanzable el AC-26 de la `004`.

- **Cinco decisiones abiertas en §8.1**, todas con opción recomendada. Dos cambian el reparto de
  tareas si caen en contra (**A** semántica de la tira, **D** persistencia); las otras tres son
  **B** cómo se cierra con el ratón, **C** proporción fija o separador arrastrable, y **E** la versión
  de la `003`. La **B** se decidió **contra la fuente**: el único ejemplo de la APG con un control
  dentro de una pestaña (`tabs-actions`) está marcado *«Experimental content! Do not use except for
  new standards development purposes»* y depende de `aria-actions`, que no está en ninguna
  especificación publicada.

- **Cero dependencias nuevas.** Lo que sí se verificó contra el código instalado y la documentación
  (`plan.md` §0): `useShallow` existe en zustand **5.0.14** y se importa de `zustand/react/shallow`
  (hoy no se usa en `apps/web` en ningún sitio); `navigate` de React Router **8.3.0** devuelve
  `void | Promise<void>`, así que va con `void`; `useBlocker` existe y **no se usa**, porque la `003`
  decidió que la navegación no se bloquea nunca; Vitest solo recoge `src/**`, así que la guarda de
  AC-30 vive ahí y no junto a lo que vigila; y el `--port` de la CLI de Vite gana al de
  `vite.config.ts`.

- **`Ctrl`+`W` descartado con motivo, y escrito en AC-22**: es un atajo **reservado por el navegador**
  y una página no puede interceptarlo, así que un AC sobre él sería un AC imposible de pasar en
  Chromium. Cerrar con teclado es `Delete` sobre la pestaña enfocada, y **cómo se cierra forma parte
  del nombre accesible de la pestaña** (AC-23), porque sin ratón es la única forma.
