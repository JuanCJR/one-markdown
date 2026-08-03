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

---

## Registro de implementación — movido desde `IMPLEMENTATION.md` (2026-08-03)

> Trasladado **literal**, sin podar. El documento de seguimiento había crecido a 3.317 líneas y había
> dejado de servir de índice; el detalle de cada feature pasa a vivir con su feature. Si algo de aquí
> repite lo que ya dice el historial de versiones de arriba, se recorta cuando se tengan los dos
> delante — no antes.


### Planificación de la spec

- [x] **spec 005-tabs-split-view** — `specs/005-tabs-split-view/` (`spec.md` **v0.1.1** + `plan.md` +
      `tasks.md` + `CHANGELOG.md`), estado **approved** (aprobada por el usuario el 2026-07-29,
      **sin cambios de alcance**). — 2026-07-29
      **Las 12 tareas están pendientes de despacho**; la implementación será la Fase 7. Las tres que
      pueden arrancar a la vez son `T-000` (enmienda de la `003`, sin código), `T-001` (puerto propio
      del web para los e2e) y `T-003` (`openIds` en el store), por conjuntos de archivos disjuntos.
      **Convenio de versionado al aprobar, por consistencia con las cuatro specs anteriores**:
      aprobar **no** sube la versión ni salta a 1.0.0 — lo que cambia es el `Estado`. La v0.1.1 ya
      había subido antes, por el contenido de §8.1.
      **La v0.1.1 resuelve las cinco decisiones abiertas, las cinco en la opción que la spec
      recomendaba y sin ningún cambio de alcance**: el recuento se mantiene en **33 AC** y **12
      tareas**, ni un AC cambia de redacción y ningún artefacto entra ni sale, así que es **patch** y
      no minor —mismo criterio con el que la v0.1.1 de la `004` se justificó a sí misma—. **A** la
      tira es `role="tablist"` con **botones**, asumiendo a sabiendas la pérdida de `Ctrl`+clic sobre
      las pestañas y con el radio de rotura **contado** (1 consulta que hay que tocar igual, frente a
      2 de specs cerradas sin otro motivo) · **B** el cierre con ratón es un `<span aria-hidden>`
      dentro del botón de pestaña, con `Delete` como camino de teclado: un `<button>` dentro de un
      `<button>` es HTML inválido y el único ejemplo de la APG con un control dentro de una pestaña
      está marcado **«Experimental content! Do not use»** y depende de `aria-actions`, que no está en
      ninguna especificación publicada · **C** vista dividida **fija 50/50**, con el separador
      arrastrable fuera de alcance por ser un widget ARIA completo que además exigiría persistir la
      proporción · **D** **las pestañas no se persisten**, que es lo que **confirma que la spec es
      solo `apps/web`** y deja las 12 tareas exactamente como estaban —era la decisión de la que
      colgaba todo el reparto, y por eso se tomó antes de escribir `tasks.md`— · **E** la enmienda de
      la `003` es **minor, v0.2.0**, con el argumento contrario (v1.0.0 por la letra de la regla, que
      el descarte de la entrada sí es observable desde el store) **escrito en §6.1 porque era
      legítimo**. Con esto, `T-000` deja de llevar una condicional.
      **33 criterios de aceptación** (todos con al menos un test automatizado declarado, y cada uno
      diciendo con qué mecanismo se verifica) en **seis bloques** —A modelo de pestañas · B
      deduplicación de `open(id)` · C vista dividida · D accesibilidad · E deuda de entorno y de e2e ·
      F alcance y presupuesto— y **12 tareas** TDD (`T-000`…`T-011`): **once de `frontend`** más
      `T-000`, de `orchestrator`, que **no toca una línea de código**. **Ninguna despachada todavía.**
      **Alcance decidido: solo `apps/web`**, como la `004`. `packages/shared` y `apps/api` no reciben
      ni una línea, y **AC-32** lo verifica (`git status` + los recuentos de los otros dos paquetes
      idénticos a los del cierre de la `004`: shared **81** · api unit **305** · api e2e **511**).
      **La decisión depende entera de otra**: las pestañas abiertas **no se persisten**. Si esa cayera
      del otro lado, la `005` tendría tabla, migración, DTO de entrada y de salida, endpoint, tipo en
      `packages/shared` y la secuencia forzada entre paquetes que la `004` describe en su §7 —así que
      se decidió **antes** de escribir `tasks.md` y queda como decisión abierta **D**.
      **Una afirmación heredada que esta spec corrige (§1.2): con vista dividida NO hay dos paletas.**
      Lo daban por hecho tres documentos cerrados —`004/spec.md` riesgo #13, la fila `005` de
      `specs/README.md` y el propio encargo—, pero **no se sigue** de la definición que el proyecto
      fijó el 2026-07-28: «split view» es texto y vista previa del **MISMO** documento, así que hay
      **un** panel de texto y por tanto **una** paleta. La propia `004` lo tenía bien en su riesgo #10.
      Lo que sí sobrevive de esas notas —y la spec lo aplica entero— es **la regla**: toda región viva
      nace con nombre y nadie consulta una región por su contenido. Y la `005` **sí** añade una región
      nueva (anuncio de cierre, AC-28), así que la página pasa a tener **tres** `role="status"` en
      modo texto. El problema es el mismo; el recuento y el motivo, no. **AC-18** lo hace rompible:
      afirma la paleta con `getAllByRole(...)` y **longitud 1**, porque «hay una paleta» pasa igual
      con dos.
      **La restricción que la `004` §9.4 le dejó, resuelta y por escrito (§6.3)**: **cambiar de
      pestaña no desaloja** (AC-8) —el historial de deshacer de la `006` sobrevive a los saltos, que
      es el gesto frecuente— y **cerrar sí desaloja**, así que **cerrar pierde el historial**. Se
      acepta por tres razones: cerrar es un gesto **explícito**; el contenido **no** se pierde, porque
      cerrar fuerza el guardado y **no cierra si falla** (AC-6, AC-7); y conservar el historial de lo
      cerrado sería una caché sin cota que produce el peor defecto posible de un deshacer —reabrir un
      documento y que `Ctrl`+`Z` deshaga algo de hace tres horas—. **Consecuencia para la `006`**: la
      política de desalojo de la `005` **es** su cota; no necesita expulsión, ni serialización, ni
      límite propios.
      **Dos enmiendas a la spec `003`, que aplica `T-000` sin tocar código** (mismo procedimiento con
      el que la `003` enmendó a la `002`): **AC-28** conserva sus mitades primera y tercera —forzar el
      guardado, conservar el borrador ante un fallo— y **pierde la segunda**, el desalojo al
      desmontar, que pasa a ser competencia de cerrar la pestaña; y **AC-22** pasa de **dos modos
      excluyentes a tres**. **Qué versión le toca a la `003` queda abierto (decisión E)**: por la
      letra de `specs/README.md` sería **major (v1.0.0)**; por lo que AC-28 protege —que nadie pierda
      lo escrito al navegar, garantía que aquí se **refuerza**— sería **minor (v0.2.0)**, que es la
      recomendación y el mismo criterio con el que la v0.4.0 de la `002` se declaró minor siendo
      aditiva.
      **Las siete restricciones heredadas quedan atendidas, y dos ampliadas al comprobarlas contra el
      código**: (1) desalojo → §6.3 y AC-4…AC-9; (2) dedup de `open(id)` → AC-10…AC-13, *single-flight*
      **por id y no global** (una promesa compartida haría que abrir dos documentos a la vez leyera
      uno solo); (3) regiones vivas con nombre → AC-26, con **cuatro** nombres enumerados —la del
      mensaje de carga de la `003`, hoy anónima, también lo recibe, porque la tira de pestañas se
      pinta **mientras** el documento carga—; (4) la regla «por nombre» también en los tests → AC-25,
      **ampliada de las regiones vivas a los `tablist` y los landmarks**, con la única consulta
      afectada localizada (`DocumentEditorPage.test.tsx:353`); (5) `watchConsole` a `e2e/support/` →
      AC-30 y AC-31, **ampliado de uno a seis ayudantes** contados en el código (`createDocument`,
      `textarea`, `uniqueTitle`, el *fixture* `test` con `session` y la constante `SAVE_REGION_NAME`
      también están duplicados), con la unificación quedándose la firma **tolerante**, que es superset;
      (6) toda cifra de cupo con su ventana y su comando → AC-33, con **tres** ventanas y **dos**
      comandos y una tercera mitad que la `004` no tenía —**el ahorro de la dedup tiene que verse**,
      midiendo antes y después: la `003` documentó que **8 de 21** peticiones de `workspace` eran
      lecturas duplicadas—; (7) `E2E_WEB_PORT` → AC-29 y `T-001`, con **`--strictPort` obligatorio**
      (sin él Vite se muda de puerto en silencio y Playwright se cuelga en una URL vacía) y **sin
      tocar `vite.config.ts`**, porque el `--port` de la CLI gana al de la configuración.
      **Las cuatro lecciones de la `004` aplicadas al escribir**: ningún número derivable de una
      enumeración se escribe a mano (AC-14 afirma los rótulos contra la enumeración importada; las
      cuatro regiones vivas se enumeran en **un** sitio); cada AC de los bloques A y B lleva escrita
      **la mutación que lo mata** —**AC-3** existe justo por eso: sin él, un `activeId` en el store
      sería indetectable hasta que alguien usara el botón «atrás»—; lo que **ningún test de este
      repositorio puede cubrir** (cómo locuta un lector real tres regiones vivas y el cierre de una
      pestaña) está **declarado** en §3.D en vez de fingido con un test; y **AC-27** se escribió contra
      la cabecera real, con el botón «Guardar» de la `003` en medio, que es lo que hacía inalcanzable
      el AC-26 de la `004`.
      **Cinco decisiones abiertas** (§8.1), todas con opción recomendada. **Dos cambian el reparto de
      tareas si caen en contra**: **A** (semántica de la tira: `tablist` con botones —recomendada, y
      con el radio de rotura **contado**— o `<nav>` con enlaces) y **D** (persistencia). Las otras
      tres: **B** cómo se cierra con el ratón, **C** proporción fija 50/50 o separador arrastrable, y
      **E** la versión de la `003`. La **B** se decidió **contra la fuente**: el único ejemplo de la
      APG con un control dentro de una pestaña (`tabs-actions`) está marcado *«Experimental content!
      Do not use except for new standards development purposes»* y depende de `aria-actions`, que no
      está en ninguna especificación publicada.
      **Cero dependencias nuevas.** Verificado contra el código instalado y la documentación
      (`plan.md` §0): `useShallow` existe en zustand **5.0.14** y se importa de
      `zustand/react/shallow` (hoy no se usa en `apps/web` en ningún sitio); `navigate` de React
      Router **8.3.0** devuelve `void | Promise<void>`, así que va con `void`; `useBlocker` existe y
      **no se usa**, porque la `003` decidió que la navegación no se bloquea nunca; Vitest solo recoge
      `src/**`, así que la guarda de AC-30 vive ahí y no junto a lo que vigila.
      **`Ctrl`+`W` descartado con motivo** (AC-22): es un atajo **reservado por el navegador**, así que
      un AC sobre él sería imposible de pasar en Chromium. Cerrar con teclado es `Delete`, y **cómo se
      cierra forma parte del nombre accesible de la pestaña** (AC-23), porque sin ratón es la única
      forma.
      **Paralelismo real: dos ramas y ninguna más.** La de e2e (`T-001` → `T-002`) contra la del store
      (`T-003` → `T-004` → `T-005`), con conjuntos de archivos disjuntos; y `T-006` (componente nuevo)
      contra `T-008` (página y tipo `ViewMode`), y luego `T-007` contra `T-008`. `T-003`…`T-005`
      comparten archivo y no se paralelizan; `T-010` y `T-011` van las últimas **y solas**, porque
      cualquier tarea que toque `e2e/` invalida las mediciones de presupuesto —lo que la `004` pagó
      dos veces.
      Verificado: los cuatro archivos existen en `specs/005-tabs-split-view/`; `specs/README.md`
      actualizado. **Sin comandos de test que correr todavía** — no hay código de esta spec.

_(Cada spec se escribe cuando la anterior está aprobada, para apoyarse en contratos cerrados. Índice y dependencias en `specs/README.md`.)_


### Fase 7 — Implementación de `005-tabs-split-view`


Detalle completo en `specs/005-tabs-split-view/tasks.md`. Spec **aprobada el 2026-07-29**: la fase está
en curso. **12 de 12 tareas** cerradas y verificadas. **Seis de las once de código las implementaron agentes `frontend`** (T-002, T-006, T-008, T-009, T-010). Cada línea lleva el
comando que se corrió y su salida real.

- [x] **T-000** · orchestrator · spec · Enmienda de la spec `003` a **v0.2.0** (AC-28 y AC-22) — 2026-07-29
      **AC-28** conserva sus mitades primera y tercera —forzar el guardado pendiente antes de
      desmontar, y conservar la entrada **con su `draft`** si falla— y **pierde la segunda**: el
      desalojo deja de ocurrir al navegar y pasa a ser competencia de **cerrar una pestaña**, que es la
      política que la propia `003` le había asignado a la `005` (su decisión 9). **AC-22** pasa de dos
      modos a tres, con la redacción diciendo «un `role="tab"` por cada modo» y **sin número**, para no
      tener el recuento en dos sitios.
      **Minor y no major** (decisión E, resuelta por el usuario): lo que AC-28 le promete a la persona
      no se rompe, **se refuerza** —el borrador se conserva ahora también cuando el guardado tuvo
      éxito—; lo que cambia es el mecanismo interno y obliga a tocar tests verdes, mismo criterio que
      la v0.4.0 de la `002`. **El argumento contrario queda escrito** en el CHANGELOG de la `003`
      porque era legítimo: por la letra de la regla sería v1.0.0, y el descarte **es** observable desde
      el store con un test verde que lo afirma.
      **Consecuencia asumida y escrita en los tres sitios donde se lee** (el `Estado` de la `003`, cada
      uno de los dos AC, y sus dos filas de §7): desde el 2026-07-29 **esos dos AC van por delante del
      código**, y los implementan `T-005` y `T-008`. Mismo trato que la `002` se dio con los cinco AC
      de su v0.4.0.
      Verificado: `rm -rf packages/shared/dist && pnpm test` **antes** → `shared` **81** · web 19
      archivos / **470** · api unit 21 suites / **305**; **después** → **idénticos**. Y
      `git status --porcelain apps packages` → **vacío**, que es lo que demuestra que no se tocó código.
      **Hallazgo de la guarda, y la razón de que hiciera falta correrla varias veces**: una corrida
      intermedia de `pnpm test` salió con **18 rojos** repartidos entre `DocumentEditorPage.test.tsx`,
      `WorkspaceTreeView.test.tsx` y `LoginPage.test.tsx`, sin relación entre sí. **No era la
      enmienda.** Se reconoce por la **duración y no por el mensaje**: el primero declaraba
      **81.782 ms** para un caso que tarda decenas de milisegundos y murió con
      `Test timed out in 5000ms`; los otros 17 eran **cascada** —tras el timeout la página se queda en
      «Cargando el documento…», así que el `textbox` no existe todavía—. Contraste que lo confirma: la
      suite web **sola** dio **470 passed tres veces seguidas, 17 s cada una**, con ~10 GB de la
      máquina en manos de procesos ajenos al repositorio. Queda como **riesgo #10** de la `005`, con la
      regla: antes de declarar roja una medición, correr el paquete **solo**, y **no** subir el
      `testTimeout`, que cambiaría un síntoma ruidoso por uno silencioso.
- [x] **T-001** · frontend · `E2E_WEB_PORT`: la suite de navegador y `pnpm dev` dejan de excluirse (AC-29) — 2026-07-29
      RED reproducido literal con `pnpm dev` levantado:
      `Error: http://localhost:5173 is already used`, **antes de ejecutar un solo caso** — no hay
      ningún test en rojo, hay un error antes de empezar.
      GREEN: `E2E_WEB_PORT = 5183` en `dev-env.ts` con `E2E_WEB_ORIGIN` derivado, y el `webServer` del
      web arrancando con `pnpm dev --port 5183 --strictPort`.
      **Dos decisiones con motivo**: el puerto va por la **CLI** y no por `vite.config.ts` (la línea de
      órdenes de Vite gana a la configuración, así que no se toca un archivo que es contrato de las
      specs `000` y `002`); y **`--strictPort` es obligatorio**, porque sin él Vite se muda al
      siguiente puerto libre **en silencio** y Playwright se queda esperando en una URL vacía — cambiar
      un aborto claro por un cuelgue oscuro es empeorar justo el problema que esto arregla.
      Verificado **las dos mitades**: con `pnpm dev` levantado → **9 passed (21,1 s)**; sin `pnpm dev`
      → **9 passed (13,7 s)**. `typecheck` y `lint` de `apps/web` en **0**.
      **La `001` sube a v0.1.3** (patch) con su entrada de cierre, porque `e2e/support/**` es contrato
      suyo — igual que hicieron `T-027` de la `002` y `T-015` de la `003`. Ningún AC suyo cambia y
      ningún límite de producción se toca.
      **Consecuencia**: la precondición «parar `pnpm dev` antes de medir con Playwright», que la `004`
      dejó escrita como su riesgo #14, **deja de existir**.
- [x] **T-003** · frontend · `openIds`: abrir, cerrar y la vecina (AC-1, AC-2, AC-4, AC-5) — 2026-07-29
      RED: **7 rojos y 32 verdes**, y en la **aserción**, no en un módulo que falta.
      GREEN: `openIds: readonly string[]`, `open` añadiendo al final **solo si no estaba**,
      `closeTab(id): CloseResult` con la vecina calculada **antes** de desalojar, y `CloseResult`
      exportado.
      **La invariante de AC-1 se mantiene por construcción y no por disciplina**: quien quita la
      entrada (`drop`) quita también su id, así que ninguna ruta futura puede dejar una entrada sin
      pestaña ni una pestaña sin entrada. La alternativa —que cada llamante se acuerde de las dos
      cosas— es la que se rompe en la primera secuencia rara.
      **Rama defensiva con criterio**: `closeTab` de un id **no abierto** devuelve
      `{ closed: false, next: null }`. Con `closed: true` la interfaz navegaría a `/` por un gesto que
      no ocurrió.
      Verificado: `test editor.store` → **39 passed** · suite web completa → **19 archivos / 477
      passed** (eran 470: **+7** casos nuevos y ninguno de los anteriores tocado) · `typecheck` y
      `lint` en **0**.

- [x] **T-004** · frontend · `open(id)` *single-flight* por id (AC-10…AC-13) — 2026-07-29
      RED: **2 rojos** (AC-10 y AC-13) y 41 verdes.
      **AC-11 y AC-12 pasaron desde el primer momento y no podían no pasar**: son guardas contra la
      implementación **equivocada**, no contra su ausencia —antes de esta tarea no había single-flight,
      así que no podía ser ni global ni quedarse sin liberar—. Un RED artificial habría sido teatro
      (misma situación que la `T-012` de la `004`), así que **se verifican por mutación**:
      **(A)** clave **global** en vez de por id, que es el error natural al copiar el idiom de
      `refreshSession()` sin adaptarlo → cae **AC-11 y solo AC-11** (`1 failed | 42 passed`);
      **(B)** la promesa en vuelo **nunca se libera** (se quita el `delete` del `finally`) → cae
      **AC-12**, y con él otros 34, porque `readsInFlight` es estado de módulo y una promesa sin
      limpiar **se filtra al caso siguiente**. Las dos se revirtieron y la suite volvió a 43 verdes.
      GREEN: `readsInFlight: Map<string, Promise<void>>` fuera del estado —junto a `debounceTimers` y
      `savesInFlight`, y por el mismo motivo—, liberada en el `finally`; `open` con entrada presente
      —limpia **o** sucia— no pide nada; y el cuerpo de la lectura extraído a `readDocument(id)`, que
      **sigue propagando el error** (contrato de `T-012` de la `003`).
      Verificado: `test editor.store` → **43 passed** · web completa → **19 archivos / 481 passed** ·
      `typecheck` y `lint` en **0**.
- [x] **T-005** · frontend · El desalojo se muda: `flush` deja de descartar, `closeTab` guarda antes (AC-6…AC-9) — 2026-07-29
      RED: **4 rojos**, los tres previstos más el caso de `flush` reescrito — que es la enmienda de la
      `003` hecha visible.
      GREEN: `flush` pierde el `drop`; `closeTab` pasa a `async` con el orden **calcular vecina →
      `flush` → comprobar → desalojar**, comprobando el estado **después** del `await`.
      **Desviación autorizada, y es la decisión de la tarea: se retira `close(id)`.** El plan lo daba
      por retirado pero el GREEN de la tarea no lo decía. Se hace porque dejarlo mantendría **dos**
      caminos de desalojo y el segundo descarta **sin guardar**: con pestañas ese es el camino por el
      que alguien pierde su trabajo, y la invariante «por construcción» de `T-003` deja de estar
      garantizada en cuanto hay dos puertas. Ninguna parte de producción lo usaba.
      **Efecto colateral que conviene registrar**: el `beforeEach` de `DocumentEditorPage.test.tsx`
      usaba `close(id)` **como mecanismo de aislamiento**, así que retirarlo puso **44 casos en rojo de
      golpe** por `TypeError`, no por comportamiento. No se resucitó nada: `useRealTimers()` en el
      `afterEach` **desmonta el reloj falso entero**, así que un temporizador del caso anterior no
      puede dispararse en el siguiente. **Comprobado y no supuesto**: el archivo corrió **cinco veces
      seguidas** con el mismo resultado antes de tocar el caso de desmontaje.
      **Los dos casos que afirmaban el desalojo se reescriben, no se borran**, y la mitad que **no**
      cambia —que el guardado pendiente se fuerza— se afirma explícitamente en los dos, para que la
      enmienda no se lea como «AC-28 ya no garantiza nada».
      Verificado: `test editor.store` → **46 passed** · web completa → **19 archivos / 484 passed** ·
      `typecheck` y `lint` en **0** · `test:e2e` → **9 passed (25,1 s)**, que es lo que comprueba que
      el cambio no rompe la aplicación en marcha y no solo los tests.

- [x] **T-002** · frontend · Los ayudantes de e2e a `support/`, y la extracción unifica (AC-30, AC-31) — 2026-07-29 · **agente `frontend`**
      RED **de la aserción**: la guarda enumeró las **12** copias (seis por cada uno de los dos
      archivos) con `expected [ …(12) ] to deeply equal []`.
      **La guarda se autocomprueba, y esa es la mitad que la hace utilizable**: 4 de sus 5 casos
      verifican que el detector encuentra una **declaración** y **no** marca un `import`, ni una
      llamada, ni confunde `testTitle`/`textareaOf` con `test`/`textarea`. Sin esa mitad, una guarda
      que marcara cualquier mención pediría un arreglo imposible de escribir.
      GREEN: los seis en `e2e/support/editor-e2e.ts`. `watchConsole` conserva la firma **tolerante**
      (AC-31); `uniqueTitle` recibe el prefijo **como parámetro y no como fábrica currificada** —un
      `const uniqueTitle = titlesFor('Editor')` en el archivo vigilado sería exactamente la
      declaración local que la guarda prohíbe—. `session.ts` y `services.ts` no se tocaron.
      Verificado: `test e2e-support` → **5 passed** · `test:e2e` → **antes 9 passed (17,8 s)**,
      **después 9 passed (18,4 s)**, mismos nombres de caso · `typecheck` y `lint` en **0**.
      **Dos desviaciones reportadas, las dos correctas**: creó un `tsconfig` de usar y tirar fuera de
      la lista de artefactos —para comprobar que **sus** archivos compilaban mientras el `typecheck`
      del paquete estaba contaminado por el RED en curso de `T-008`— y lo borró en la misma orden
      (`git status` limpio, comprobado); y **encontró que AC-30 decía «cinco» donde la enumeración
      tenía seis**, implementó **seis** —lo que decían `tasks.md` y el cuerpo de §5.2— y **reportó la
      discrepancia en vez de elegir en silencio**. Lo arregla la **v0.1.2** de la spec, y lo arregla
      **quitando el número** en vez de corregirlo: el recuento pasa a vivir en la tabla y en un solo
      sitio. Era, literalmente, el defecto que esta spec cita como lección de la `004`, cometido en
      su propia redacción.
- [x] **T-008** · frontend · Modo `split`: tercer modo, doble panel y una sola paleta (AC-14…AC-18) — 2026-07-29 · **agente `frontend`**
      RED **en dos capas, y la primera no valía**: el primer intento fue **andamio** (`TypeError` al
      importar una enumeración que aún no se exportaba). El agente lo reconoció, exportó la
      enumeración **sin** añadir `'split'` y repitió: entonces sí salió el rojo de la aserción
      —`expected [ 'text', 'preview' ] to include 'split'`— más 4 errores de `typecheck`.
      `Tests 5 failed | 92 passed (97)`.
      GREEN: `ViewMode` gana `'split'` (**solo** eso de `editor.store.ts`); **un solo**
      `role="tabpanel"` que en `split` contiene dos `<section>` con nombre; `max-w-6xl` en `split`; la
      paleta en `text` **y** `split`, **una vez**. El `tablist`, las flechas y el `panelId` **no
      necesitaron ninguna rama nueva**, que es lo que el plan había anticipado.
      Verificado: `test DocumentEditorPage editor.store` → **97 passed** (eran 90) · `typecheck` y
      `lint` en **0**.
      **Tres desviaciones reportadas, las tres correctas**: exportar `VIEW_MODES` y
      `VIEW_MODE_LABELS` (visibilidad, no comportamiento) para poder afirmar contra la enumeración;
      **tres comandos `DONE` de `tasks.md` que no ejecutaban nada** —`test "A|B"`, y el filtro de
      Vitest 4 es **subcadena y no regex**: comprobado a mano, con tubería `No test files found` y
      con dos filtros `97 passed`—, arreglado por la **v0.1.3** de la spec; y **la `<section>` de
      vista previa sin `overflow-auto` a propósito**, porque un contenedor que se desplaza y al que
      no llega el foco incumple **WCAG 2.1.1** y darle `tabIndex` metería una parada de tabulación
      que es materia de AC-27 (`T-009`). **Queda con destinatario**: si `T-009` o `T-010` quieren
      paneles con desplazamiento independiente, hay que decidir el foco **a la vez**.

- [x] **T-006** · frontend · `DocumentTabs`: tira, teclado, cierre y región viva (AC-3, AC-20…AC-24, AC-28) — 2026-07-29 · **agente `frontend`**
      RED con andamio y **de la aserción**: **17 rojos de 19**. Los 2 verdes de partida son las dos
      guardas negativas, que un componente vacío satisface por construcción — y el agente lo **dijo**
      en vez de disfrazarlas de cobertura.
      **La desviación que corrige el plan, y la encontró un test**: `plan.md` §4.3 decía «devuelve
      `null` si no hay pestañas abiertas» y **era falso de una forma que costaba dos AC**. `closeTab`
      es asíncrono y React repinta entre su desalojo y la reanudación del `await`, así que el
      `return null` desmontaba la región viva **antes** de que hubiera nada que anunciar: se llevaba
      el `ref`, el anuncio de AC-28 y el destino del foco de AC-22, y el foco caía al `<body>`
      (instrumentado: `live=undefined`, `after focus active=BODY`). **Lo cazó el test de AC-22**, que
      es justo para lo que ese AC existe. Corregido en la v0.1.4: sin pestañas desaparece **la tira**,
      no el componente.
      **Y movió trabajo entre tareas con motivo**: la navegación acabó en el componente porque
      `AppShell` lo monta **sin props**, así que **AC-4 pasó de `T-007` a `T-006`**.
      Verificado: `test DocumentTabs` → **19 passed** · paquete **solo** → **21 archivos / 515
      passed** · `typecheck` y `lint` en **0**.
- [x] **T-007** · frontend · Enganche en `AppShell` — 2026-07-29
      RED: 3 rojos. GREEN: `<DocumentTabs />` entre la cabecera y el `<main>`, y `EDITOR_PANEL_ID`
      importado —**no** un literal repetido— como `id` del `<main>`.
      **Un tropiezo que se repetirá y por eso queda escrito**: los casos nuevos salieron rojos con la
      página de **entrada** pintada en vez del shell. El `beforeEach` que autentica vive **dentro**
      del `describe` de la `000`, así que un `describe` nuevo en el mismo archivo **no lo hereda**. El
      mensaje de error no lo decía; lo decía el `<main class="max-w-sm …">` de la salida.
      Verificado: `test AppShell routes` → **16 passed** · web → **519 passed**.
- [x] **T-009** · frontend · Barrido de accesibilidad: regiones, nombres y tabulación (AC-25…AC-27) — 2026-07-29 · **agente `frontend`**
      RED: 2 rojos y **solo uno era suyo**. El otro era **cascada** por `readsInFlight`, el `Map` de
      módulo que ningún `beforeEach` limpia: un caso que aborta antes de resolver su lectura deja la
      promesa cacheada y **el caso siguiente** recibe una que no llega nunca. El agente lo contuvo
      **en el test** y **no tocó el store**. Es la fragilidad que `T-004` ya había anotado, ahora con
      un caso real — y **en producción no puede ocurrir**, porque el `finally` siempre corre, así que
      no se añade una API de reinicio solo para los tests.
      GREEN: un atributo (`aria-label="Carga del documento"`). **AC-27 pasó en verde sin cambiar una
      línea de producción**, y el agente lo dijo en vez de disfrazarlo: la predicción de la tarea era
      **anterior a `T-007`**, que al pintar la tira por encima del `<main>` dejó el orden correcto
      **gratis**. El caso queda como guarda de regresión.
      **Decisión razonada sobre el `overflow` que dejó abierta `T-008`: se queda como está.** Las dos
      razones que pesan: el `<textarea>` **ya** se desplaza solo —el cambio daría «el segundo
      también», no «dos paneles con scroll»— y dos mitades con desplazamiento independiente **sin
      sincronizar** se desalinean por construcción; sincronizar el scroll es una funcionalidad con su
      propio criterio, no un efecto colateral de `overflow-auto`.
      Verificado: `test DocumentEditorPage` → **55 passed** · web → **524 passed**.
- [x] **T-010** · frontend · Navegador: recorrido de pestañas y vista dividida (AC-19, **AC-34**) — 2026-07-29 · **agente `frontend`**
      **Se paró en un bloqueo, y esa es la parte que mejor hizo.** La «×» de cierre medía
      **19,73 × 20 px**, por debajo de los 24 × 24 de SC 2.5.8. **No debilitó la aserción** y **no
      tocó `DocumentTabs.tsx`**, que no estaba en su lista: paró, explicó por qué no lo salva ninguna
      excepción del criterio y propuso el arreglo de una línea. Autorizado y aplicado (`size-6`), más
      **AC-34 nuevo** en la v0.2.0 — el requisito estaba en `plan.md` §4.6 y en la tarea **pero sin
      AC**, y por ese hueco se coló el defecto.
      Su primer RED fue **un defecto de su propia consulta** (`getByRole('tab', { name: 'Dividida' })`
      resolvió a dos elementos), y de paso **avisó de que la misma mina estaba puesta en
      `editor.spec.ts`**: endurecidas sus tres consultas con `exact: true`.
      Verificado: `test:e2e tabs` → **2 passed** · suite de navegador entera → **11 passed** (eran 9).
      Presupuesto **afirmado, no supuesto**: `documentContent` **0 peticiones**, con
      `expect(contentSaves()).toBe(0)` en los dos casos.
- [x] **T-011** · frontend · Cierre: alcance verificado y presupuesto con sus ventanas (AC-32, AC-33) — 2026-07-29
      **AC-32**: `git status --porcelain packages apps/api` → **vacío** · `shared` **81** · api unit
      **305** · api e2e **511**, idénticos a los del cierre de la `004`.
      **AC-33(a)**: pico de `workspace` **28 de 120 por corrida**, contra un criterio de < 60.
      **AC-33(b)**: `--retries=2 --repeat-each=3` → **33 passed sin un solo `429`**, y **sin cifra**,
      a propósito.
      **AC-33(c)**: **36** sin deduplicación contra **28** con ella — **ocho peticiones de ahorro**,
      exactamente el desperdicio que la `003` documentó. El «antes» **no se recordó, se reprodujo**:
      se revirtió `open(id)` a la lógica de la `003`, se midió y se restauró.
      **Y un fallo de instrumentación que casi cierra el AC con una cifra falsa**: la primera sonda
      dio **`pico=0`**, y no porque el valor fuera cero — **`redis-cli` no existe en esta máquina**, y
      el `PONG` de la comprobación previa lo había devuelto el `docker.exe` de respaldo de un `||`. Un
      cero de un instrumento desconectado es **indistinguible** de uno real. Se detectó porque
      `DBSIZE` devolvía cadena vacía en vez de un número, y la sonda se rehízo **dentro del
      contenedor**, validándola antes con una clave de prueba. **Regla para quien mida después: valida
      el instrumento contra un valor conocido antes de creerte el que buscas.**

**Fase 7 cerrada: 12/12 tareas.** La spec `005` queda **complete** en **v0.2.1**, y con ella las cinco
capacidades del párrafo de cabecera de `CLAUDE.md` están implementadas. Lo único que queda por
delante es la **`006-editor-undo`**, que la `005` deja con su restricción resuelta: cambiar de pestaña
**no** desaloja, cerrar **sí**, así que la política de desalojo de esta spec **es** la cota de la pila
de deshacer.

---


### Nota del índice — movida desde `specs/README.md` (2026-08-03)

El índice volvió a ser una línea por spec; esta era su fila, literal.

- **Feature**: Tabs y split view — tabs tipo VS Code y vista dividida
- **Versión**: **0.2.1**
- **Depende de**: 003

**Estado tal como estaba escrito**: **complete** (2026-07-29) — **34/34 AC** y **12/12 tareas** verificadas · `apps/web` **21 archivos / 524** · `shared` **81** · api unit **305** · api e2e **511** · `test:e2e` **11** · `--retries=2 --repeat-each=3` **33 passed sin un solo `429`** · typecheck y lint en 0. **Presupuesto con su ventana pegada**: pico de `workspace` **28 de 120 por corrida** (criterio < 60) y **36 → 28** con y sin deduplicación, o sea **ocho peticiones de ahorro**, medidas con **contrafáctico** (se revirtió `open(id)` a la lógica de la `003`, se midió y se restauró) y no de memoria. **Y la lección de instrumentación del cierre**: la primera sonda dio `pico=0` porque **`redis-cli` no existe en esta máquina** —el `PONG` previo lo había devuelto el `docker.exe` de respaldo de un `||`—, y un cero de un instrumento desconectado es indistinguible de uno real; **valida el instrumento contra un valor conocido antes de creerte el que buscas**. La **v0.2.0** es el único minor y añade **AC-34** (tamaño de objetivo ≥ 24 × 24, SC 2.5.8): el requisito estaba en `plan.md` §4.6 y en `T-010` **pero sin AC**, y por ese hueco se coló un defecto real —la «×» de cierre medía **19,73 × 20 px**—; lo destapó el caso de navegador, que **paró y lo reportó en vez de debilitar la aserción**. Un requisito que vive solo en el plan es un requisito que nadie cuenta al revisar la cobertura. **Seis de las once tareas de código las hicieron agentes `frontend`**, y las cinco que encontraron algo lo reportaron en vez de decidir en silencio: los **seis** ayudantes duplicados donde la spec decía cinco, **tres comandos `DONE` que no ejecutaban nada** (`test "A|B"` — el filtro de Vitest 4 es subcadena, no regex), el `return null` que **desmontaba una región viva antes de que hubiera nada que anunciar** (porque `closeTab` es asíncrono y React repinta entre medias), y una consulta ambigua que era una mina puesta en otro archivo. Antes del cierre — **33 AC** en seis bloques y **12 tareas** (`T-000`…`T-011`), once de `frontend` más una de `orchestrator` que no toca código. **La v0.1.1 resuelve las cinco decisiones abiertas, las cinco en la opción recomendada y sin cambiar el alcance**: el recuento no se mueve (siguen 33 AC y 12 tareas), ningún AC cambia de redacción y ningún artefacto entra ni sale, así que es **patch**. **A** la tira es `role="tablist"` con **botones** —asumiendo la pérdida de `Ctrl`+clic, y con el radio de rotura contado: 1 consulta que hay que tocar igual frente a 2 de specs cerradas— · **B** se cierra con un `<span aria-hidden>` dentro del botón más `Delete`, porque un `<button>` dentro de un `<button>` es HTML inválido y el único ejemplo de la APG con un control dentro de una pestaña está marcado *«Experimental content! Do not use»* y depende de `aria-actions`, que no está en ninguna especificación publicada · **C** vista dividida **fija 50/50**, con el separador arrastrable fuera de alcance · **D** **las pestañas no se persisten**, lo que **confirma que la spec es solo `apps/web`** y deja las 12 tareas intactas · **E** la enmienda de la `003` es **minor, v0.2.0**, con el argumento contrario (v1.0.0 por la letra de la regla) escrito en §6.1 porque era legítimo. **Alcance: solo `apps/web`**, como la `004`, y **AC-32** lo verifica con los recuentos de los otros dos paquetes (shared **81** · api unit **305** · api e2e **511**). Depende entero de la otra decisión: **las pestañas no se persisten** —con persistencia habría tabla, migración, DTO, endpoint, tipo en `shared` y la secuencia forzada entre paquetes, así que se decidió **antes** de escribir `tasks.md` (decisión abierta **D**)—. **Corrige una afirmación heredada (§1.2): con vista dividida NO hay dos paletas.** Lo daban por hecho el riesgo #13 de la `004`, esta misma fila y el encargo de la spec, pero no se sigue de la definición fijada el 2026-07-28 —texto y vista previa del **MISMO** documento—: hay **un** panel de texto y por tanto **una** paleta, como la propia `004` tenía bien en su riesgo #10. Lo que sobrevive es **la regla**, y se aplica entera; y como la `005` **sí** añade una región viva nueva (anuncio de cierre, AC-28), la página pasa a tener **tres** `role="status"` en modo texto. **AC-18** lo hace rompible: `getAllByRole(...)` con **longitud 1**, porque «hay una paleta» pasa igual con dos. **Resuelve la restricción de la `004` §9.4**: cambiar de pestaña **no** desaloja (el historial de la `006` sobrevive a los saltos), cerrar **sí**, así que **cerrar pierde el deshacer** — aceptado porque cerrar es un gesto explícito, el contenido no se pierde (cerrar fuerza el guardado y **no cierra si falla**, AC-6/AC-7) y la alternativa es una caché sin cota cuyo peor caso es reabrir un documento y que `Ctrl`+`Z` deshaga algo de hace tres horas. **Dos enmiendas a la `003`** que aplica `T-000` sin tocar código: **AC-28** pierde su segunda mitad (el desalojo al desmontar) y **AC-22** pasa de dos modos a tres; **qué versión le toca a la `003` queda abierto** (decisión **E**: v1.0.0 por la letra de la regla, **v0.2.0** por lo que el AC protege, que es la recomendación). **Las siete restricciones heredadas atendidas, dos de ellas ampliadas al comprobarlas contra el código**: el *single-flight* de `open(id)` es **por id y no global** (AC-11), y los ayudantes duplicados de e2e no son uno sino **seis** —`watchConsole`, `createDocument`, `textarea`, `uniqueTitle`, el *fixture* `session` y la constante `SAVE_REGION_NAME`—, con la unificación quedándose la firma **tolerante**. **AC-33** añade a las dos ventanas de la `004` una tercera: **el ahorro de la dedup tiene que verse** (la `003` documentó **8 de 21** peticiones duplicadas). **Cero dependencias nuevas**, con `useShallow` (zustand 5.0.14, `zustand/react/shallow`) y la firma de `navigate` de React Router 8.3.0 verificadas contra el código instalado. **`Ctrl`+`W` descartado con motivo**: es atajo reservado del navegador, así que un AC sobre él sería imposible de pasar; se cierra con `Delete`, y **cómo se cierra va en el nombre accesible de la pestaña**. Historia previa: la `003` ya le dejaba cerrado el contrato: estado del editor **indexado por id de documento**, no un singleton (`003/plan.md`, decisión 9). **«Split view» ya está definido** (2026-07-28): texto y preview lado a lado del **mismo** documento, fijado en `CLAUDE.md` — así que el split es un cambio de disposición sobre los paneles de la `003`, no un segundo estado. La política de desalojo del store sigue siendo suya, por los **tabs** — y desde el 2026-07-28 con **una restricción que tiene que conocer**: la `006` colgará una **pila de deshacer dentro de `EditorEntry`**, así que desalojar una entrada **descarta su historial**; la `005` debe dejar escrito si «cerrar una pestaña y volver a abrirla pierde el deshacer» es aceptable (`004/spec.md` §9.4). **Segunda restricción heredada, del 2026-07-29**: en la página del editor hay **dos regiones vivas** (`SaveStatus` y la paleta) y desde la `004` **las dos llevan `aria-label`**; `getByRole('status')` sin nombre está prohibido ahí y en Playwright es violación de modo estricto. Con vista dividida habrá **dos paletas**, así que cualquier región viva que la `005` añada nace **con nombre accesible** (`004/spec.md` AC-27 y riesgo #11). **Tercera restricción heredada, del 2026-07-29**: `watchConsole` está **duplicado** entre `e2e/editor.spec.ts` y `e2e/palette.spec.ts` —consecuencia de que la lista de artefactos de `T-010` fuera **un solo archivo**— y la regla de la casa es extraer **a la tercera copia**, que la escribe la `005` en cuanto añada suites de navegador: va a `apps/web/e2e/support/`, y **extraer es unificar** porque las dos copias **ya divergieron en firma** (una acepta patrones tolerados, la otra no); `e2e/support/**` es contrato de la `001` y obliga a entrada de cierre en su CHANGELOG. **Cuarta**: toda cifra de cupo que escriba la `005` lleva pegada **su ventana y su comando** — la `004` cerró un AC que era cierto por corrida y falso bajo su propio comando de verificación (`004/spec.md` riesgo #12). **Quinta, del 2026-07-29 al cerrar la `004`**: la regla «por nombre» vale **también para los tests** — desambiguar una región viva **por su contenido** (`filter({ hasText })`) parece equivalente y no lo es, porque **no lee `aria-label`** y deja el test verde ante la regresión del criterio que dice verificar; le pasó a `e2e/palette.spec.ts` y lo arregló **`T-012`**. **Sexta**: el `aria-label` de una región viva **puede locutarse además del contenido** en algunos lectores («Elemento insertado. Insertado: Negrita»); la `004` lo asume a sabiendas, pero la `005` tendrá **dos paletas** y por tanto **dos regiones homónimas**, así que le toca revisarlo **con lector real** — ni jsdom ni Playwright locutan nada, y **no se debe escribir un test que finja que sí** (`004/spec.md` riesgo #13). **Séptima**: la suite de navegador y `pnpm dev` **no pueden coexistir** — `dev-env.ts` le dio al API un puerto propio (**3011**) pero dejó el web en **5173**, el de `pnpm dev`, y con `reuseExistingServer: false` Playwright aborta con `http://localhost:5173 is already used`, un fallo de **entorno** disfrazado de fallo de suite que ya bloqueó una medición del cierre de la `004`; darle al web su `E2E_WEB_PORT` es simétrico y cuesta una constante (`004/spec.md` riesgo #14)
