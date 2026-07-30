# Spec 005 — Pestañas de documentos y vista dividida

- **Versión**: 0.2.1
- **Estado**: **complete** (2026-07-29) — **34/34 AC** verificados y **12/12 tareas** cerradas, todas
  con su comando corrido y su salida real. Aprobada por el usuario el 2026-07-29 **sin cambios de
  alcance**.
  **Cifras del cierre**: `apps/web` **21 archivos / 524** · `shared` **81** · api unit 21 suites /
  **305** · api e2e 22 suites / **511** · `test:e2e` **11** · `--retries=2 --repeat-each=3` **33
  passed sin un solo `429`** · `typecheck` y `lint` en **0**.
  **Presupuesto, con su ventana pegada**: pico de `workspace` **28 de 120 por corrida** (criterio
  < 60), y **36 → 28** con y sin deduplicación: **ocho peticiones de ahorro**, medidas con
  contrafáctico y no de memoria.
  **Sin ninguna salvedad de verificación manual** salvo la que §3.D declara **explícitamente como no
  cubrible por ningún test de este repositorio** —cómo locuta un lector real las cuatro regiones
  vivas y el cierre de una pestaña—, que sigue siendo revisión manual y **no** tiene un test que
  finja lo contrario. Las cinco
  decisiones de §8.1 quedaron resueltas el mismo día, las cinco en la opción que la spec recomendaba.
  **Convenio de versionado al aprobar, por consistencia con la `001`, la `002`, la `003` y la
  `004`**: aprobar **no** salta a 1.0.0 y **no** sube la versión — lo que cambia es el `Estado`. La
  v0.1.1 ya había subido por el contenido de §8.1, no por la aprobación
- **Fecha**: 2026-07-29 (v0.1.0 draft) · **v0.1.1 el 2026-07-29**: se resuelven las cinco decisiones
  abiertas. **Es patch y no minor porque el recuento no se mueve**: siguen **33 AC** y **12 tareas**,
  ningún AC cambia de redacción y ningún artefacto entra ni sale — que es el criterio con el que la
  v0.1.1 de la `004` se justificó a sí misma como patch. Lo único que cambia de verdad es que la
  enmienda de la `003` (§6.1) deja de tener una versión por decidir y pasa a ser **v0.2.0 (minor)**
  · **v0.1.2 el 2026-07-29**: patch escrito **con `T-002` verde**. **AC-30 decía «cinco» ayudantes al
  lado de una enumeración que tenía seis filas** — el defecto exacto que esta spec cita como lección
  de la `004` («no escribas a mano un número que se pueda derivar de una enumeración») y que cometió
  en su propia redacción. Se quita el número de AC-30, el sexto elemento pasa a ser **fila de la
  tabla** de `plan.md` §5.2 en vez de prosa detrás de ella, y el recuento se cuenta en **un solo
  sitio**. **No mueve nada**: siguen 33 AC y 12 tareas, y `T-002` ya había implementado los seis
  porque `tasks.md` y el cuerpo de §5.2 sí los enumeraban bien
  · **v0.1.3 el 2026-07-29**: patch escrito **con `T-008` verde**. Tres comandos `DONE` de
  `tasks.md` (`T-005`, `T-007`, `T-008`) usaban la forma `test "A|B"`, y **el filtro de Vitest 4 es
  una subcadena, no una expresión regular**: sale `No test files found`. Misma familia que el AC-33
  de la `004` —un criterio junto a un comando que no puede verificarlo—, con el atenuante de que
  este **falla ruidoso** (exit 1) en vez de pasar en falso. **No mueve nada**: siguen 33 AC y 12
  tareas
  · **v0.1.4 el 2026-07-29**: patch escrito **con `T-006` verde**. `plan.md` §4.3 decía que la tira
  «devuelve `null` si no hay pestañas abiertas», y era falso de una forma que costaba **dos AC**:
  `closeTab` es asíncrono y React repinta entre su desalojo y la reanudación del `await`, así que el
  `return null` desmontaba la región viva **antes** de que hubiera nada que anunciar y el foco caía
  al `<body>`. Se corrige el plan con la medición delante. Y **AC-4 pasa de `T-007` a `T-006`** en la
  trazabilidad: la navegación acabó viviendo en el componente, porque `AppShell` lo monta **sin
  props** y no hay otro sitio donde pueda estar sin obligar a `T-007` a editar un archivo ajeno.
  **No mueve el recuento**: siguen 33 AC y 12 tareas
  · **v0.2.0 el 2026-07-29**: **minor, y el único que ha añadido alcance**. **AC-34 nuevo** (tamaño de
  objetivo ≥ 24 × 24 px de las pestañas y su control de cierre): el requisito **ya estaba** en
  `plan.md` §4.6 y en el cuerpo de `T-010`, pero **sin AC que lo respaldara**, y por ese hueco se coló
  un defecto real —la «×» medía **19,73 × 20 px**—. Lo destapó el caso de navegador de `T-010`, que
  **paró y lo reportó en vez de debilitar la aserción**. **34 AC**, mismas 12 tareas. Trae además una
  precisión medida en **AC-19**: el ancho que crece es el del `role="tabpanel"`, **no** el del
  `<textarea>` — sobre el textarea el criterio sería imposible por aritmética (768 px contra ~568)
- **Depende de**: `004-markdown-palette` (complete, v0.3.0) · `003-editor` (complete, v0.1.5) ·
  `002-workspace-tree` (complete, v0.4.4) · `001-auth` · `000-foundation`

---

## 0. Alcance en una línea, y las dos decisiones que lo fijan

**Esta spec toca exclusivamente `apps/web`.** `packages/shared` y `apps/api` no reciben ni una línea.
El razonamiento está en §7 y depende por entero de una segunda decisión: **las pestañas abiertas no
se persisten** —ni en el servidor ni en `localStorage`/`sessionStorage`—, así que recargar deja
abierta exactamente la pestaña que dice la URL. Si esa decisión cayera del otro lado, la `005`
dejaría de ser una spec de frontend: tabla, migración, DTO de entrada y de salida, endpoint, tipo en
`packages/shared` y la secuencia forzada entre paquetes que la `004` describe en su §7. Por eso se
decide **antes** de escribir `tasks.md` y no después.

Es la **última pieza del producto descrito en `CLAUDE.md`**: con ella, las cinco capacidades del
párrafo de cabecera (crear/editar/borrar, texto o preview, paleta, pestañas y vista dividida) quedan
implementadas.

---

## 1. Contexto y problema

Hoy, después de la `003` y la `004`, el editor abre **un documento cada vez**. Al navegar a otro, la
`003` fuerza el guardado pendiente y —si tiene éxito— **descarta la entrada del store** (su AC-28).
Funciona, y para un editor de un solo documento es lo correcto. Lo que no permite es lo que
`CLAUDE.md` pide: trabajar con varios documentos a la vez, saltar entre ellos sin perder el sitio, y
ver el texto y su resultado **a la vez** en vez de alternarlos.

Los dos huecos, dichos como problemas:

1. **No hay forma de saber qué documentos tengo abiertos, ni de volver a uno sin buscarlo en el
   árbol.** La barra lateral es un mapa del *workspace* entero, no de lo que estoy tocando ahora.
2. **El conmutador texto/vista previa es de dos modos excluyentes** (`003`, AC-22). Para comprobar
   que una tabla quedó bien hay que ir a «Vista previa», mirar, y volver — y quien está aprendiendo
   markdown, que es el usuario que `CLAUDE.md` nombra, es justo quien más veces necesita ese viaje.

### 1.1 Lo que la `003` dejó cerrado y esta spec usa tal cual

La `003` no dejó esto para después por accidente: lo preparó y lo escribió.

1. **El estado del editor está indexado por id de documento** (`Record<string, EditorEntry>`), no en
   un singleton «documento actual» (`003/plan.md`, decisión 9). Su propio texto dice qué cambia la
   `005`: «lo que `005` cambiará es la **política de desalojo**, no la forma». Esta spec no reescribe
   el bucle de guardado, la coalescencia ni el conflicto: **cambia cuándo desaparece una entrada**.
2. **El modo de vista vive por documento y no en la página** (`editor.store.ts`, comentario de
   `ViewMode`), con esta razón escrita: «la spec `005` lo conserva al volver a su pestaña sin trabajo
   extra». Esta spec cobra esa previsión — pero solo si el desalojo deja de ocurrir al cambiar de
   documento, que es exactamente el punto 1.
3. **`setDraft(id, texto)` es el único camino por el que cambia el contenido** (decisión 10). La
   `005` no añade ninguno: no toca el contenido, toca la disposición.
4. **`AppShell` es «el punto de anclaje de las specs 002–005»**, y lo dice su propio comentario.

### 1.2 Una afirmación heredada que esta spec corrige: con vista dividida **no** hay dos paletas

Tres documentos cerrados —`004/spec.md` riesgo #13, `specs/README.md` fila `005`, y el encargo de
esta spec— dan por hecho que la vista dividida traerá **dos paletas** y por tanto dos regiones vivas
homónimas. **No se sigue de la definición de «split view» que el propio proyecto fijó.**

«Split view» quedó definido el 2026-07-28 (`003/plan.md`, decisión E, y `CLAUDE.md`): **texto y vista
previa del MISMO documento, lado a lado**, no dos documentos distintos. Con esa definición hay
exactamente **un** panel de texto —el otro panel es la vista previa, que no se edita— y la paleta
solo tiene sentido donde se escribe. La propia `004` lo tenía bien en su riesgo #10: «la paleta se
renderiza **dentro del panel de texto** […] con dos paneles, va con el de texto». El #13 y la fila de
`specs/README.md` se escribieron con el modelo mental contrario.

Lo que sí sobrevive de esas notas, y esta spec lo aplica entero: **la regla**. Toda región viva que
esta spec añada nace con nombre accesible, y ninguna consulta —de producción o de test— pide una
región por su contenido. La `005` **sí** añade una región viva nueva (el anuncio de cierre de
pestaña, AC-28), así que la página del editor pasa a tener **tres** `role="status"` en modo texto, no
dos. El problema es el mismo; el recuento y el motivo, no. Ver AC-26 y el riesgo #4.

---

## 2. Historias de usuario

- **US-1** — Como persona que escribe, quiero **ver qué documentos tengo abiertos** y saltar entre
  ellos con un clic, sin volver a buscarlos en el árbol.
- **US-2** — Como persona que escribe, quiero que **volver a una pestaña me devuelva donde estaba**:
  mi texto sin guardar, mi modo de vista y mi mensaje de error si lo había.
- **US-3** — Como persona que escribe, quiero **cerrar una pestaña sin miedo**: lo que hubiera
  pendiente se guarda, y si no se pudo guardar, la pestaña **no se cierra**.
- **US-4** — Como persona que está aprendiendo markdown, quiero **ver el texto y el resultado a la
  vez** para el mismo documento, en vez de alternar entre dos modos.
- **US-5** — Como persona que navega con teclado, quiero recorrer y cerrar las pestañas **sin ratón**,
  y que al cerrar una el foco no se caiga al principio de la página.
- **US-6** — Como persona que usa lector de pantalla, quiero que cada pestaña diga **de qué documento
  es y si tiene cambios sin guardar**, y que el cierre se anuncie.
- **US-7** — Como responsable del producto, quiero que las pestañas **no abran un segundo modelo de
  estado** ni un segundo camino de guardado: una pestaña abierta es una entrada del store que ya
  existe, y nada más.

---

## 3. Criterios de aceptación

Todo AC es verificable por al menos un test automatizado, y cada uno dice con qué mecanismo. La
trazabilidad completa está en §10.

Vocabulario: **pestaña abierta** = un id que está en `openIds`; **entrada** = el `EditorEntry` de ese
id en `entries`; **pestaña activa** = el `:id` de la ruta actual, y **nada más** (AC-3). **Desalojar**
= borrar la entrada del diccionario.

### A. Modelo de pestañas en el store

- **AC-1** — Dado el store vacío, cuando se abre un documento que no estaba abierto, entonces su id
  se **añade al final** de `openIds` y su entrada aparece en `entries`. En todo momento y tras
  cualquier secuencia de aperturas y cierres, **el conjunto de claves de `entries` es exactamente el
  de `openIds`**: ni una entrada sin pestaña ni una pestaña sin entrada.
  _Verificado por_: unit del store, con la comprobación del conjunto de claves **como aserción
  propia** y no como efecto colateral de otra. _Mutación que lo mata_: desalojar la entrada sin sacar
  el id de la lista (la pestaña quedaría pintada sobre la nada).

- **AC-2** — Dado un documento **ya abierto**, cuando se vuelve a abrir, entonces `openIds` no cambia
  —ni se duplica el id ni se mueve de posición— y su entrada **se conserva con su borrador**.
  _Verificado por_: unit del store. _Mutación que lo mata_: un `push` incondicional, o un `openIds`
  recalculado poniendo el último abierto al final (que es lo que hacen los navegadores con el
  historial y **no** lo que hace un gestor de pestañas).

- **AC-3** — La pestaña activa **no tiene representación en el store**: es el `:id` de la ruta. Dado
  un documento ya abierto, cuando se cambia a él, entonces **el estado del store no muta** —las
  referencias de `entries` y de `openIds` son idénticas antes y después— y lo único que cambia es la
  ruta.
  _Verificado por_: unit de componente comparando referencias con `toBe`. _Mutación que lo mata_:
  cualquier `activeId` en el store, que es el segundo origen de verdad que este AC existe para
  impedir; con él, una vuelta atrás del navegador dejaría la pestaña marcada y el contenido no.

- **AC-4** — Dada una pestaña **no activa**, cuando se cierra, entonces desaparece de `openIds`, su
  entrada se desaloja, **la pestaña activa no cambia** y **no hay navegación**.
  _Verificado por_: unit del store + unit de componente (la ruta no se toca).

- **AC-5** — Dada la pestaña **activa**, cuando se cierra, entonces el destino es **la vecina de la
  derecha**; si no hay ninguna a la derecha, **la de la izquierda**; y si no queda ninguna, `null`,
  que la interfaz traduce a navegar a `/`. La regla se enuncia sobre `openIds`, no sobre lo pintado.
  _Verificado por_: unit del store con los **tres** casos (media, última por la derecha, única).

- **AC-6** — Dada una pestaña con borrador sin guardar, cuando se cierra, entonces **primero se
  fuerza el guardado pendiente** (un `PUT`, cancelando el debounce) y **solo después** se desaloja la
  entrada.
  _Verificado por_: unit del store contando peticiones y afirmando el **orden**: en el instante en que
  la entrada desaparece, el `PUT` ya se resolvió.

- **AC-7** — Dado ese mismo cierre, cuando el guardado **falla** (`conflict`, `rejected` o
  `unreachable`), entonces **la pestaña no se cierra**: sigue en `openIds`, conserva su `draft` y su
  estado de error, y quien pidió el cierre recibe que no se cerró.
  _Verificado por_: unit del store con las tres ramas de fallo de la `003`. _Mutación que lo mata_:
  desalojar sin mirar el resultado del guardado — que es la forma exacta de perder el trabajo de
  alguien mientras se le dice que se guardó.

- **AC-8** — Dado un documento abierto con cambios sin guardar, cuando se cambia a **otra pestaña** y
  se vuelve, entonces la entrada es **la misma**: `draft`, `status`, `error` y `viewMode` son los de
  antes, sin ninguna petición de lectura por el camino.
  _Verificado por_: unit de componente montando, ensuciando, navegando a otro documento y volviendo.
  **Este AC enmienda la mitad del AC-28 de la `003`** que decía «si tiene éxito, la entrada se
  descarta»; ver §6.

- **AC-9** — Dado ese mismo cambio de pestaña, entonces el guardado pendiente de la que se abandona
  **sí se fuerza** (la otra mitad del AC-28 de la `003`, que sobrevive intacta), y la navegación
  **no se bloquea** en ningún caso.
  _Verificado por_: unit de componente, contando la petición emitida al desmontar.

### B. Deduplicación de `GET /api/workspace/documents/:id` — deuda heredada de la `003` §8.1

- **AC-10** — Dadas dos llamadas **concurrentes** a `open(id)` del mismo documento, entonces se emite
  **una sola** petición `GET`, las dos promesas resuelven, y ambas ven la misma entrada.
  _Verificado por_: unit del store contando peticiones del doble del cliente HTTP, sin `StrictMode`
  de por medio: el defecto que esto arregla es de producción y no del entorno de desarrollo.

- **AC-11** — Dadas dos llamadas concurrentes a `open(a)` y `open(b)` de documentos **distintos**,
  entonces se emiten **dos** peticiones. El *single-flight* es **por id**, no global.
  _Verificado por_: unit del store. _Mutación que lo mata_: una única promesa compartida, que es el
  error natural al copiar el idiom de `refreshSession()` —donde el recurso es uno solo— sin
  adaptarlo.

- **AC-12** — Dado un `open(id)` cuya lectura **falla**, entonces la promesa en vuelo **se libera**:
  un `open(id)` posterior vuelve a pedirlo, y el error se sigue propagando a quien llamó (contrato de
  la `003`, que es lo que permite a la página distinguir `missing` de `error`).
  _Verificado por_: unit del store con dos intentos. _Mutación que lo mata_: cachear la promesa sin
  limpiarla en el `finally`, con lo que un fallo de red dejaría el documento **imposible de abrir
  hasta recargar**.

- **AC-13** — Dado un documento con entrada ya en el store —**limpia o sucia**—, cuando se vuelve a
  abrir, entonces **no se emite ninguna petición**.
  _Verificado por_: unit del store, las dos ramas. Es un **cambio consciente** respecto de la `003`,
  donde la rama «entrada limpia» sí releía: allí esa rama era casi código muerto (al navegar fuera la
  entrada se descartaba), y aquí sería una lectura por cada salto entre pestañas. La consecuencia
  —una pestaña vieja puede chocar con un `409`— es exactamente el caso que la maquinaria de conflicto
  de la `003` existe para resolver, y está cubierta por sus AC-19 y AC-20.

### C. Vista dividida

- **AC-14** — `ViewMode` gana un tercer valor, `'split'`. El conmutador pinta **una pestaña por cada
  modo de la enumeración**, en su orden, y **ni el componente ni ningún test escriben ese número a
  mano**: se deriva de la enumeración.
  _Verificado por_: unit de componente afirmando la lista de rótulos contra la enumeración importada,
  no contra un literal. _Por qué así_: la `004` escribió «14 elementos» en diez sitios mientras su
  propia tabla enumeraba 16, y dos de esos números iban a usarse como aserción.

- **AC-15** — Dado el modo `split`, entonces el `<textarea>` y la vista previa están **los dos** en el
  documento y visibles a la vez, y los dos son **del mismo documento**: el texto que se edita es el
  que se previsualiza.
  _Verificado por_: unit de componente (los dos presentes) + AC-16 (que son el mismo contenido).

- **AC-16** — Dado el modo `split`, cuando se escribe en el área de texto, entonces la vista previa
  refleja lo escrito **sin ninguna acción intermedia** —pinta el `draft`, no lo último guardado— y
  sin esperar al debounce de guardado.
  _Verificado por_: unit de componente escribiendo y afirmando el árbol renderizado **antes** de
  avanzar el temporizador de 1.500 ms. _Mutación que lo mata_: pintar `savedContent` en el panel de
  vista previa, que en `preview` a secas se notaría solo tras un guardado.

- **AC-17** — El modo de vista es **por documento**: dadas dos pestañas, una en `text` y otra en
  `split`, cuando se alterna entre ellas, cada una conserva el suyo.
  _Verificado por_: unit de componente. Depende de AC-8: sin él, el modo se perdería en cada salto.

- **AC-18** — La paleta se pinta en `text` y en `split`, **una sola vez en cada uno**, y **no** se
  pinta en `preview`. Con vista dividida hay **un** panel de texto y por tanto **una** paleta.
  _Verificado por_: unit de componente con `getAllByRole('toolbar', { name })` y longitud **1** en los
  dos modos, y ausencia en `preview`. _Por qué la aserción es sobre la longitud y no sobre la
  presencia_: «hay una paleta» pasa igual con dos, y dos paletas es la regresión concreta que este AC
  vigila (ver §1.2).

- **AC-19** — En **Chromium**, dado el modo `split`, entonces los dos paneles están **lado a lado**:
  sus cajas comparten borde superior, **no se solapan** en horizontal, las dos tienen ancho > 0, y el
  ancho útil del editor —**el del `role="tabpanel"`, no el del `<textarea>`**— es **mayor** que en
  modo `text`.
  _Precisión de la v0.2.0, medida al implementar `T-010`_: sobre el `<textarea>` este criterio sería
  **imposible de cumplir**, y no por un defecto sino por aritmética: 768 px (`max-w-3xl`) en modo
  texto contra ~568 px por columna en dividida. Lo que el AC vigila es que **la página** ensanche
  (`max-w-3xl` → `max-w-6xl`), y así medido el contrafáctico funciona: dejando `max-w-3xl` en `split`
  los dos anchos salen iguales y la aserción se pone roja.
  _Verificado por_: e2e con `boundingBox()`. **jsdom no calcula disposición** y devuelve ceros, así
  que un «lado a lado» afirmado allí no afirmaría nada; es el mismo motivo que puso el tamaño de
  objetivo de la `004` (su AC-29) en el navegador. La última mitad —que el ancho crece— existe porque
  la página del editor es hoy `max-w-3xl`: dos columnas dentro de ese ancho serían dos columnas
  inservibles, y sin esta aserción el defecto pasaría verde.

### D. Accesibilidad

- **AC-20** — La tira de pestañas es un `role="tablist"` con `aria-label` propio, cuyos hijos son
  `role="tab"` con `aria-selected`, e implementa **roving tabindex**: **una sola** parada de
  tabulación para todas las pestañas.
  _Verificado por_: unit de componente (roles, nombre y `tabIndex`). Hay dos precedentes exactos en el
  repositorio de los que copiar: el `tablist` de `DocumentEditorPage` y el `role="tree"` de
  `WorkspaceTreeView`.

- **AC-21** — `ArrowLeft`/`ArrowRight` recorren las pestañas en orden del documento **envolviendo por
  los dos extremos**, y `Home`/`End` van a la primera y a la última. El foco se mueve **de verdad**
  (`document.activeElement`), no solo el `tabIndex`.
  _Verificado por_: unit de componente con al menos tres pestañas —con dos, «envolver» y «ir al otro»
  son indistinguibles— y con un viaje de **ida y vuelta**, para que el caso no acabe midiendo dónde
  arranca el foco (lección de AC-32 de la `004`).

- **AC-22** — `Delete` sobre la pestaña enfocada la cierra, y el foco **pasa a la vecina** según la
  regla de AC-5; si no queda ninguna, va a un destino declarado y existente, **nunca al `<body>`**.
  _Verificado por_: unit de componente afirmando `document.activeElement` después del cierre.
  **Se elige `Delete` y no `Ctrl`+`W`**: `Ctrl`+`W` es un atajo **reservado por el navegador** (cierra
  la pestaña del navegador) y una página no puede interceptarlo, así que un AC sobre `Ctrl`+`W`
  sería un AC que no puede pasar en Chromium. Es la misma clase de error que el AC-26 de la `004`,
  que pedía un orden de tabulación que la cabecera existente hacía imposible.

- **AC-23** — El control de cierre tiene **nombre accesible propio que incluye el título del
  documento** («Cerrar «Notas»»), nunca «×» ni «Cerrar» a secas: con varias pestañas, N controles
  llamados «Cerrar» son indistinguibles en la lista de un lector de pantalla.
  _Verificado por_: unit de componente con dos documentos de títulos distintos.

- **AC-24** — El estado **sin guardar** de una pestaña se percibe **sin depender del color ni de la
  forma**: forma parte del **nombre accesible** de la pestaña. Un punto pintado y nada más incumple
  WCAG 1.4.1 (*Use of Color*).
  _Verificado por_: unit de componente comparando el nombre accesible de una pestaña limpia y una
  sucia. _Consecuencia para los tests, escrita aquí porque muerde_: cualquier consulta de pestaña por
  nombre exacto se rompe al ensuciarse el documento; las consultas van por título **no exacto**, o
  afirman el nombre completo a propósito.

- **AC-25** — Los **dos** `role="tablist"` que conviven en la página del editor (pestañas de
  documento y conmutador de vista) llevan `aria-label` **distinto**, y **ninguna consulta de test
  pide un `tablist`, un `status` o un `navigation` sin nombre** en una página donde haya más de uno.
  _Verificado por_: unit de componente (los dos nombres) + la actualización de las consultas que hoy
  no lo cumplen, que están **enumeradas** en `tasks.md` con archivo y línea. _Por qué es un AC y no
  una nota_: la `004` lo aprendió dos veces, y la segunda (`T-012`) fue un test verde que era incapaz
  de detectar la regresión del criterio que decía verificar.

- **AC-26** — La página del editor en modo texto o dividido tiene **tres** regiones vivas
  `role="status"` —guardado, paleta y pestañas—, **las tres con `aria-label`**, ninguna anidada dentro
  de otra. El `role="status"` del mensaje de carga, que hoy no tiene nombre, también lo recibe: la
  tira de pestañas se pinta **mientras** el documento carga, así que durante la carga hay dos.
  _Verificado por_: unit de componente enumerando las regiones por nombre y comprobando la
  no-anidación. _Enumeración explícita, para que el número no se escriba a mano en ningún otro sitio_:
  «Estado del guardado» (`003`), «Elemento insertado» (`004`), «Pestañas abiertas» (`005`) y
  «Carga del documento» (`003`, que gana nombre aquí).

- **AC-27** — Orden de tabulación **relativo** en la página del editor, comprobado contra la cabecera
  que existe hoy: **tira de pestañas → conmutador de vista → «Guardar» → paleta → área de texto**. El
  criterio es el orden relativo de esos cinco, no una secuencia cerrada.
  _Verificado por_: unit de componente tabulando desde el principio. _Por qué relativo_: es la
  corrección que la `004` tuvo que hacer a su AC-26 al descubrir que el botón «Guardar» de la `003`
  vivía en medio; y la tira de pestañas va la primera **porque está en `AppShell`, por encima del
  `<main>`**, no porque convenga.

- **AC-28** — Cerrar una pestaña se **anuncia** en una región viva propia, con el título del documento
  cerrado. La región está montada **desde el primer render y vacía** hasta que hay algo que decir, y
  **cerrar dos veces el mismo título vuelve a anunciar**.
  _Verificado por_: unit de componente. Las dos mitades son las lecciones caras de la `004`: una
  región que entra en el DOM **con su texto dentro** no es un cambio sino una aparición, y NVDA y JAWS
  pueden no leerla nunca (su AC-27); y escribir el mismo texto que ya había **no muta el DOM**, así
  que no anuncia (su AC-36, y el mecanismo del `U+200B` ya está resuelto y probado en
  `MarkdownPalette.tsx`).

**Lo que ningún test de este repositorio puede cubrir, y por tanto no se escribe como AC.** Con tres
regiones vivas en la misma página, algunos lectores anteponen el `aria-label` al contenido
(«Pestañas abiertas. Cerrada: Notas») y otros no; y cómo se locuta el cierre de una pestaña con NVDA
o VoiceOver no lo ve ni jsdom ni Playwright, **que no locutan nada**. Queda como revisión manual con
lector real (riesgo #5), y **no se escribe un test que finja que sí lo cubre** — que es exactamente lo
que la `004` descubrió al reescribir su AC-27.

### E. Deuda heredada de entorno y de la suite de navegador

- **AC-29** — La suite de navegador y `pnpm dev` **coexisten**: con `pnpm dev` levantado en el 5173,
  `pnpm --filter @one-markdown/web test:e2e` arranca su propio servidor web en **su** puerto y corre
  entera.
  _Verificado por_: el propio comando, con `pnpm dev` corriendo. Hoy aborta con
  `http://localhost:5173 is already used` **antes** de ejecutar un solo caso — un fallo de **entorno**
  disfrazado de fallo de suite, que ya bloqueó dos mediciones al cerrar la `004`.

- **AC-30** — Cero copias locales de los ayudantes compartidos en los archivos de e2e del editor:
  viven en `apps/web/e2e/support/`. **Cuáles son, uno por uno, está en la tabla de `plan.md` §5.2** —
  no solo `watchConsole`, que es el que la `004` dejó anotado. **Aquí no va el recuento a propósito**:
  la v0.1.0 escribió «cinco» al lado de una enumeración que tenía seis filas, que es exactamente el
  defecto que la `004` pagó con su «14 elementos» y que esta spec cita como lección. El número se
  cuenta en la tabla, y en un solo sitio.
  _Verificado por_: guarda que lee el código fuente de los archivos de e2e (mismo patrón que
  `no-dangerous-html.test.ts`) **más** las suites verdes. _Cuidado, y está pagado_: la guarda lee con
  `readFileSync` y **no distingue código de comentario** (`004/spec.md` §9.6), así que no puede
  convivir con un comentario que nombre lo que prohíbe.

- **AC-31** — La extracción **unifica**: `watchConsole` queda con **una** firma, la tolerante
  (`(page, ...tolerated: readonly RegExp[])`), que es superset de la otra, y los dos llamadores que
  ya existen siguen verdes sin cambiar de comportamiento — incluido el que tolera el `409` provocado
  a propósito de la `003`.
  _Verificado por_: las suites `editor.spec.ts` y `palette.spec.ts` en verde tras la extracción.
  _Por qué se dice explícitamente_: las dos copias **ya divergieron en firma**, así que «extraer» aquí
  no es mover código, es elegir cuál de las dos sobrevive.

### F. Alcance y presupuesto

- **AC-32** — La `005` no toca `packages/shared` ni `apps/api`: `git status` no reporta ni un archivo
  modificado bajo esos dos árboles, y sus recuentos de test salen **idénticos** a los del cierre de la
  `004`: `shared` **81** · api unit **305** · api e2e **511**.
  _Verificado por_: `pnpm test` en los tres paquetes + `git status`. Mismo mecanismo que el AC-34 de
  la `004`, que es el que convierte la decisión de alcance en algo comprobable.

- **AC-33** — Presupuesto de cupo, **con su ventana y su comando pegados a cada cifra** (regla que
  deja el riesgo #12 de la `004`):
  **(a)** con `pnpm --filter @one-markdown/web test:e2e` y sondeo de `throttle:workspace:{sha256(ip)}`
  en Redis, el pico de `workspace` **por corrida** queda **< 60 de 120**, y la cifra medida se escribe
  al lado;
  **(b)** con `--retries=2 --repeat-each=3`, **sin un solo `429`** — y ninguna cifra, porque ahí las
  tres repeticiones **se suman dentro de la misma ventana de 60 s** y el número hablaría del
  multiplicador y no de la suite;
  **(c)** la deduplicación de AC-10 **se nota**: el pico de `workspace` por corrida de las suites que
  ya existían (`editor.spec.ts` + `palette.spec.ts`) **baja** respecto de la medición previa, y se
  escriben las dos cifras. La `003` dejó documentado el tamaño del desperdicio: **8 de 21**
  peticiones de `workspace` eran lecturas duplicadas del mismo documento.
  _Verificado por_: los comandos de arriba. El sondeo de Redis es instrumentación de verificación y
  **no** vive en el repositorio.

- **AC-34** — En **Chromium**, cada pestaña de documento y su control de cierre miden **≥ 24 × 24 px
  CSS** (WCAG 2.2 SC 2.5.8, *Target Size (Minimum)*).
  _Verificado por_: e2e con `boundingBox()`, en el mismo caso que AC-19 y con el mismo mecanismo que
  el AC-29 de la `004`. jsdom devuelve ceros para cualquier caja, así que esto **solo** se puede
  afirmar en navegador.
  _Por qué este AC llega en la v0.2.0 y no estaba en la v0.1.0, dicho sin adornos_: el requisito **sí**
  estaba —en `plan.md` §4.6 y en el cuerpo de `T-010`— pero **sin AC que lo respaldara**, y por ese
  hueco se coló un defecto real: la «×» de cierre medía **19,73 × 20 px**. Lo destapó el caso de
  navegador de `T-010`, que **paró y lo reportó en vez de debilitar la aserción**. Un requisito que
  vive solo en el plan es un requisito que nadie cuenta al revisar la cobertura.
  _Y por qué no lo salva ninguna excepción del criterio_: la de *Spacing* no aplica porque el control
  está **anidado dentro** de la pestaña —un círculo de 24 px centrado en él intersecta por fuerza al
  objetivo que lo contiene—; y la de *Equivalent* tampoco, porque el otro camino de cierre es `Supr`,
  que es un **atajo** y no un objetivo.

---

## 4. Fuera de alcance

- **Persistir las pestañas abiertas** entre sesiones o entre recargas, en el servidor o en el
  almacenamiento del navegador. Es la decisión que hace que esta spec sea solo frontend (§0, §7 y
  decisión abierta **D**). Recargar deja abierta la pestaña que dice la URL, y ninguna más.
- **Reordenar pestañas arrastrando**, fijarlas, o el menú contextual de VS Code («cerrar las demás»,
  «cerrar a la derecha»). Cada uno es un patrón propio con su recorrido de teclado.
- **Un separador arrastrable** entre los dos paneles de la vista dividida. Es un widget ARIA completo
  (`role="separator"` enfocable, `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, teclado propio y
  persistencia de la proporción) para una spec que ya carga con dos patrones. Ver decisión **C**.
- **Dos documentos distintos lado a lado.** Está explícitamente descartado desde el 2026-07-28
  (`003/plan.md`, decisión E; `CLAUDE.md`). Un panel dividido con dos documentos es otra feature: dos
  entradas activas a la vez, dos guardados en vuelo, dos paletas —esta vez de verdad— y dos rutas en
  una URL.
- **Cota de pestañas abiertas.** No se pone, y el motivo es aritmético en vez de opinable: una entrada
  guarda dos copias del texto (`savedContent` y `draft`) con tope `MAX_DOCUMENT_CONTENT_CHARS` =
  **200.000** caracteres cada una, así que veinte pestañas en el peor caso absoluto son ~16 MB de
  cadenas, y el caso real es tres órdenes de magnitud menor. Poner una cota obligaría a decidir qué
  se cierra solo, que es una decisión de producto para la que no hay datos.
- **Deshacer/rehacer.** Es la spec `006`, y esta spec le fija la restricción que necesitaba: ver §6.3.
- **Tocar la barra lateral.** El árbol de la `002` no cambia: seguir seleccionando un documento sigue
  navegando a `/documents/:id`, que ahora además abre pestaña. El riesgo #15 de la `002` (aviso
  genérico en la barra lateral) sigue abierto y sigue sin ser de esta spec.

---

## 5. Lo que esta spec hereda y no puede tocar

1. **La cadena de saneado del preview** (`MarkdownPreview.tsx` y sus plugins). La vista dividida
   **no** cambia qué se renderiza: cambia dónde se pinta. Cero plugins nuevos, así que el modelo de
   amenaza de `003/plan.md` §2 no se vuelve a medir, y el corpus de XSS **no se amplía** — a
   diferencia de la `004`, esta spec no vuelve alcanzable ninguna construcción nueva.
2. **El bucle de guardado**: debounce de 1.500 ms, coalescencia, un intento y ningún reintento, y las
   tres ramas de error. La `005` cambia **cuándo desaparece una entrada**, no cómo se guarda.
3. **`setDraft` como único camino de cambio de contenido.**
4. **La regla de nombrar y consultar por nombre**, que la `004` pagó dos veces (sus `T-011` y `T-012`).
   Aquí se extiende de las regiones vivas a **los `tablist` y los landmarks**, porque el fallo es el
   mismo: `getByRole('tablist')` sin nombre está a una tira de pestañas de romperse, y hoy hay
   exactamente una consulta así.
5. **La política de cupo: gastar menos, no neutralizar más.** `throttle:documentContent:*` no se
   resetea nunca; `login` y `workspace` se resetean en los **límites** de un caso, nunca a mitad de una
   secuencia de agotamiento.

---

## 6. Enmiendas que esta spec obliga en specs cerradas

Las dos se aplican **sin tocar una línea de código** en la tarea que las escribe (`T-000`); el cambio
de código llega con la tarea que lo implementa. Es el mismo procedimiento con el que la `003` enmendó
la `002`.

### 6.1 Spec `003-editor` — AC-28 pierde su segunda mitad

**Qué dice hoy AC-28**: «el guardado pendiente se **fuerza** antes de desmontar; si tiene éxito, la
entrada del documento **se descarta** del store; y si falla, la entrada se conserva con su `draft`».

**Qué pasa a decir**: la primera mitad (forzar el guardado) y la tercera (conservar el borrador ante
un fallo) **se quedan literales**. La segunda —descartar la entrada— deja de ocurrir al navegar: el
desalojo pasa a ser competencia de **cerrar la pestaña** (AC-4…AC-7 de esta spec), que es la política
que la propia `003` dejó asignada aquí (su decisión 9).

**Qué versión le toca a la `003`: v0.2.0 (minor), resuelto el 2026-07-29** (decisión **E** de §8.1).
Lo que AC-28 le promete a la persona —no perder lo que escribió al navegar— no se rompe: **se
refuerza**, porque a partir de aquí el borrador se conserva también cuando el guardado tuvo éxito. Lo
que cambia es el mecanismo interno, y obliga a cambiar tests que hoy están verdes, que es exactamente
el criterio con el que la v0.4.0 de la `002` se declaró minor siendo aditiva.
**El argumento contrario queda escrito, porque era legítimo**: por la letra de `specs/README.md`
(«major — cambia comportamiento observable ya implementado») esto sería **v1.0.0**, y el descarte de
la entrada **es** observable desde el store, con un test verde que lo afirma. Se elige la lectura por
la garantía y no por la letra, y se deja dicho para que nadie tenga que reconstruir por qué.

**AC de la `003` que quedan tocados**: **AC-28** (redacción) y, por dependencia, el caso de
`editor.store.test.ts` y el de `DocumentEditorPage.test.tsx` que hoy afirman el desalojo al
desmontar. **Ningún otro.** AC-22 (conmutador de dos modos) **también** se toca, y es el segundo:
pasa a tres modos. Ver §6.2.

### 6.2 Spec `003-editor` — AC-22 pasa de dos modos a tres

AC-22 describe el conmutador como **dos modos excluyentes**, y su §4 («Fuera de alcance») dice
literalmente «Ver texto y vista previa a la vez. El conmutador de AC-22 es de **dos modos
excluyentes**». Esa exclusión era el alcance de la `003`, no una propiedad del producto: `CLAUDE.md`
pide la vista dividida desde el principio. La enmienda añade el tercer modo y traslada la línea de
«fuera de alcance» a «lo implementa la `005`». Es **aditivo** y no rompe nada verificado: las dos
pestañas de hoy siguen existiendo, con su rótulo y su comportamiento.

### 6.3 Spec `006-editor-undo` — la restricción que esperaba, resuelta

La `004` §9.4 dejó escrito que la `005` debía decidir, **conscientemente y por escrito**, si «cerrar
una pestaña y volver a abrirla pierde el deshacer» es aceptable. **Se decide que sí, y el reparto es
este**:

- **Cambiar de pestaña NO desaloja** (AC-8), así que el historial de la `006` **sobrevive a los saltos
  entre pestañas**, que es el gesto frecuente —decenas de veces por sesión.
- **Cerrar una pestaña SÍ desaloja** (AC-4…AC-7), así que **cerrar pierde el historial**. Es
  aceptable por tres razones, en orden de peso: (1) cerrar es un gesto **explícito** de «he
  terminado con esto», al contrario que cambiar de pestaña; (2) el contenido **no** se pierde,
  porque cerrar fuerza el guardado y no cierra si falla (AC-6, AC-7), así que lo que se pierde es el
  camino, no el destino; (3) la alternativa —conservar el historial de documentos cerrados— es una
  caché sin cota de la que nadie ha pedido el tamaño, y produce el peor defecto posible de un
  deshacer: reabrir un documento y que `Ctrl`+`Z` deshaga algo de hace tres horas que la persona ya
  no recuerda haber escrito.
- **Consecuencia para la `006`, escrita para que no la redescubra**: la pila vive dentro de
  `EditorEntry` y muere con ella; no hace falta ningún mecanismo de expulsión propio, ni de
  serialización, ni de cota — el desalojo de la `005` es su cota.

---

## 7. Por qué la `005` es solo frontend

La pregunta se responde explícitamente porque la respuesta contraria cambiaría el reparto de tareas
entero, y porque **hay exactamente una cosa que la voltearía**: persistir las pestañas abiertas.

**Lo que no necesita servidor.** Una pestaña abierta es un id de documento en una lista, más una
entrada del store que ya existe desde la `003`. La vista dividida es **disposición**: dos
componentes que ya existen (`<textarea>` y `MarkdownPreview`) pintados a la vez en vez de
alternados. El servidor no interpreta markdown, no sabe qué es una pestaña, y no cambia ni un DTO.

**Lo que sí necesitaría servidor, si se decidiera**: persistir las pestañas entre sesiones. Costaría
una tabla y su migración, un `*.request.dto.ts` y un `*.response.dto.ts` con Swagger, un endpoint
—o dos, si se quiere granularidad—, un tipo y su guarda en `packages/shared`, y el `contentVersion`
de la sincronización entre dispositivos. Está **fuera de alcance** (§4) y es la decisión abierta
**D**.

**Qué costaría equivocarse, con el precio ya pagado por otras specs.** Un cambio en
`packages/shared` deja `apps/api` **en rojo de compilación** hasta que aterriza la tarea de DTO, así
que esas dos tareas **no se paralelizan** y la ventana entre ellas es una ventana en la que ninguna
otra tarea puede verificar nada. Y el radio de un cambio de contrato incluye los **fixtures de test
de los dos paquetes**, que no se encuentran buscando el nombre del endpoint sino el del **tipo**: a
la `002` la enmienda se le quedó corta **dos veces** por eso exacto (sus v0.4.2 y v0.4.3).

**Consecuencias operativas.** Las **doce** tareas son de `frontend`, salvo `T-000` que es de
`orchestrator` y no toca código. No hay ninguna secuencia forzada entre paquetes.
`workspace-fixtures.ts` y `auth-fixtures.ts` **no aparecen** en la lista de artefactos de ninguna
tarea, porque ningún tipo cambia.

---

## 8. Riesgos y decisiones abiertas

### 8.1 Decisiones — resueltas el 2026-07-29

**Las cinco quedaron resueltas el 2026-07-29, las cinco en la opción que esta spec recomendaba y sin
ningún cambio de alcance**: el recuento se mantiene en **33 AC** y **12 tareas**, ni un solo AC cambió
de redacción y ningún artefacto entró ni salió. Por eso la subida es **patch (v0.1.0 → v0.1.1)**.

| Decisión | Resuelta el | Opción elegida | Qué queda tocado |
|---|---|---|---|
| **A** — semántica de la tira | 2026-07-29 | **`role="tablist"` con botones** | Nada: AC-20…AC-22 ya estaban escritos con esta opción. Se asume la pérdida de `Ctrl`+clic sobre las pestañas |
| **B** — cómo se cierra con el ratón | 2026-07-29 | **`<span aria-hidden>` dentro del botón de pestaña**, con `Delete` como camino de teclado | Nada: AC-22 y AC-23 se quedan literales |
| **C** — proporción de la vista dividida | 2026-07-29 | **Fija 50/50**, sin separador arrastrable | Nada: AC-19 se queda. El separador arrastrable sigue **fuera de alcance** (§4) |
| **D** — persistir las pestañas | 2026-07-29 | **No se persisten**: recargar deja abierta la que dice la URL | Nada: es la opción con la que están escritas §0, §4 y §7. **Confirma que la spec es solo frontend** y que las 12 tareas se quedan como están |
| **E** — versión de la `003` por la enmienda de AC-28 | 2026-07-29 | **Minor, v0.2.0** | §6.1 deja de tener una versión por decidir, y `T-000` deja de tener una condicional. Ningún AC |

**Ninguna de las cinco añade trabajo.** Las dos que podían cambiar el reparto de tareas —**A** y
**D**— cayeron del lado que ya estaba escrito, así que la implementación puede arrancar sin releer
los AC.

Se conservan abajo, **con su razonamiento íntegro**, porque el motivo de una decisión es lo que hace
falta el día que alguien quiera revisarla, y borrarlo dejaría solo el resultado.

| # | Decisión | Impacto | Opción recomendada y por qué |
|---|---|---|---|
| **A** | **Semántica de la tira de pestañas**: `role="tablist"` con `role="tab"` (botones), o `<nav>` con enlaces y `aria-current="page"`. Nuestras pestañas **cambian la URL**, que es lo que caracteriza a la navegación; pero también son «pestañas tipo VS Code», con selección y panel | **Alto**: cambia AC-20…AC-22, los tests y qué se rompe de lo verde | **`role="tablist"` con botones.** Tres motivos, uno de ellos medido: (1) es lo que pide el encargo y lo que hay en el repositorio dos veces, así que se copia en vez de inventarse; (2) `aria-selected` expresa la selección de forma que un `<nav>` de enlaces no —`aria-current` dice «esta es la página», no «esta está seleccionada entre N»—; (3) **el radio de rotura es menor y está contado**: con `tablist` se rompe **una** consulta (`DocumentEditorPage.test.tsx:353`, un `getByRole('tablist')` sin nombre, que además hay que tocar igual porque el conmutador pasa a tres pestañas); con `<nav>` se rompen las consultas `getByRole('navigation')` **sin nombre** de `AppShell.test.tsx:58` y `routes.test.tsx:69`, que son de specs cerradas y no tienen ningún otro motivo para cambiar. **Lo que se pierde y hay que decirlo**: `Ctrl`+clic y clic central para abrir en una pestaña **del navegador** dejan de funcionar sobre las pestañas, porque un `<button>` no es un enlace. La barra lateral, que sí es navegación, no se toca |
| **B** | **Cómo se cierra una pestaña con el ratón**: un `<button>` real anidado dentro del `role="tab"`, o un `<span aria-hidden>` dentro del botón de pestaña cuyo clic se distingue por el objetivo del evento | **Medio**: es la interacción más frecuente después de cambiar de pestaña | **El `<span>` dentro del botón**, con `Delete` como camino de teclado (AC-22) y el nombre accesible del cierre expuesto en el propio `aria-label` de la pestaña. Motivo, **verificado contra la fuente**: un `<button>` dentro de un `<button>` es HTML inválido, y la única receta de la APG para «una pestaña con un control dentro» es su ejemplo `tabs-actions`, que está marcado **«Experimental content! Do not use except for new standards development purposes»** y depende de `aria-actions`, un atributo que no está en ninguna especificación publicada. Adoptar un patrón experimental para el gesto más frecuente de la feature es exactamente la clase de decisión que se descubre tarde. **Lo que cuesta**: sin ratón, cerrar es `Delete` y no un control visible enfocable — por eso AC-22 y AC-23 son AC propios y no una nota |
| **C** | **Proporción de la vista dividida**: fija al 50/50, o separador arrastrable | Bajo-medio | **Fija al 50/50.** Un separador es un widget ARIA completo (`role="separator"` enfocable con `aria-valuenow`/`min`/`max` y teclado propio) más la persistencia de la proporción —que, sin persistencia, se pierde en cada recarga y molesta más que ayuda—. Es una spec de una tarea, no media línea de CSS. Si se quiere, entra como spec propia con su patrón |
| **D** | **Persistir las pestañas abiertas** entre recargas: no (recomendado), `sessionStorage`, o servidor | **Máximo**: es lo único que convierte esta spec en frontend + backend, y cambia el reparto de tareas entero | **No persistir.** (1) Es coherente con lo que el repositorio ya decidió **tres veces** y escribió: ni la sesión (`001`), ni el árbol (`002`), ni el editor (`003`) persisten nada en el navegador; (2) el comportamiento resultante es **explicable en una frase** —recargas y te queda abierto lo que dice la URL—, que es más de lo que se puede decir de una restauración parcial; (3) por el servidor, el coste está en §7 y el beneficio real es «entre dispositivos», que nadie ha pedido. **Si el usuario quiere persistencia**, la salida barata NO es `sessionStorage` a medias: es decidirlo ahora, porque con servidor esta spec pasa a tener bloque de backend, tarea de `shared` que **no se paraleliza** con la de DTO, y fixtures de dos paquetes en el radio |
| **E** | **Qué versión le toca a la `003`** por la enmienda de su AC-28 (§6.1): **major (v1.0.0)** por la letra de la regla, o **minor (v0.2.0)** por lo que el AC protege | Bajo en código, **alto en método**: es el registro de lo que se puede creer de una spec cerrada | **Minor, v0.2.0.** La garantía que AC-28 le da a la persona —no perder lo escrito al navegar— **no se rompe: se refuerza**. Lo que cambia es el mecanismo interno (el desalojo) y obliga a cambiar tests verdes, que es exactamente el criterio con el que la v0.4.0 de la `002` se declaró minor siendo aditiva. **El argumento contrario es serio y por eso está aquí**: la regla escrita dice «cambia comportamiento observable ya implementado», el desalojo **es** observable desde el store, y hay un test verde que lo afirma. Quien prefiera la letra tiene un caso legítimo, y la `003` se iría a v1.0.0 |

### 8.2 Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 1 | **El desalojo deja de ocurrir y la memoria crece sin techo.** Es la cara mala de AC-8 | Bajo, y **cuantificado**: ver §4. Dos copias del texto por pestaña, tope 200.000 caracteres | AC-1 (el conjunto de claves de `entries` es el de `openIds`) hace que no puedan quedar entradas huérfanas, que es el modo real en que esto se rompería: no «muchas pestañas», sino «entradas que nadie ve y nadie cierra» |
| 2 | **Cerrar una pestaña pierde trabajo.** Es el defecto más caro que esta spec puede introducir | **Alto** | AC-6 y AC-7, y en este orden: se guarda **antes** de desalojar, y si el guardado falla **no se cierra**. La mutación que los mata —desalojar sin mirar el resultado— está escrita en el propio AC para que el test la persiga |
| 3 | **Un segundo origen de verdad para «qué pestaña está activa»**, entre la URL y el store | Medio y silencioso: se manifiesta al usar el botón «atrás» del navegador, que nadie prueba a mano | AC-3, que afirma que el store **no muta** al cambiar de pestaña. Es un AC incómodo de escribir y es el que impide el defecto |
| 4 | **Tres regiones vivas y dos `tablist` en la misma página.** La `004` ya vivió la versión pequeña de esto con dos regiones | Medio, y **con precedente doble**: la `004` lo pagó en su `T-011` y otra vez en su `T-012` | AC-25 y AC-26, más la lista **enumerada** de consultas que hay que cambiar en `tasks.md`. Y la regla de la casa, que aquí se aplica también a los `tablist`: se consulta **por nombre**, nunca por contenido — `filter({ hasText })` no lee `aria-label` y deja el test verde ante la regresión que dice vigilar |
| 5 | **Con tres regiones vivas, un lector real puede resultar hablador** («Pestañas abiertas. Cerrada: Notas») | Bajo, **y aceptado a sabiendas** | Revisión manual con NVDA o VoiceOver, **declarada como tal** en §3.D. Ningún test de este repositorio locuta nada, y escribir uno que lo finja es lo que hizo que el AC-27 de la `004` estuviera verde en CI y falso para quien lo necesitaba. Si resulta hablador, la salida previsible es acortar el contenido, no quitar el nombre |
| 6 | **`Ctrl`+`W` no se puede interceptar** y alguien lo pedirá | Bajo | Escrito en AC-22 con su motivo. Es un atajo reservado del navegador: un AC sobre él sería un AC imposible de pasar, que es el defecto que la `004` corrigió en su AC-26 |
| 7 | **La suite de navegador crece y el cupo de `workspace` aprieta** — cuarta spec seguida en que aparece | Medio: rojos que no tienen que ver con lo que se mide | AC-33, con **sus tres ventanas separadas y su comando cada una**. Y esta vez hay viento a favor: AC-10 **quita** peticiones (la `003` midió 8 duplicadas de 21), así que (c) exige que el ahorro se vea |
| 8 | **La lista de artefactos se queda corta.** Le pasó a la `002` dos veces y a la `004` una | Medio | `tasks.md` enumera **todos** los archivos por tarea, tests y fixtures incluidos, y aquí el radio es conocido y está listado con nombre y línea: la tira de pestañas se pinta en `AppShell`, así que aparece en **todos** los tests que montan `routes` — y son tres archivos, no uno |
| 9 | **Tocar `e2e/` mientras se mide invalida la medición.** La `004` lo pagó dos veces (su `T-011` tras `T-010`, y otra vez con `T-012`) | Bajo, pero cuesta una corrida entera cada vez | Las tareas de e2e van **al principio** (`T-001`, `T-002`) y la medición de cierre va **al final** (`T-011`), después de la última que toca ese directorio |
| 10 | **`pnpm test` puede salir rojo por hambre de la máquina, no por el código.** Detectado y caracterizado el 2026-07-29 al correr la guarda de `T-000`: la suite entera lanza los **tres paquetes a la vez**, cada uno con su pool de workers, y bajo presión de memoria un test con `testTimeout` de **5 s** revienta. **Lo que se ve no se parece a lo que es**: salieron **18 rojos** repartidos entre `DocumentEditorPage.test.tsx`, `WorkspaceTreeView.test.tsx` y `LoginPage.test.tsx`, ninguno relacionado con otro | **Medio, y engañoso**: parece una regresión ancha y es un problema de entorno. Un `Unable to find an accessible element with the role "textbox"` invita a buscar el defecto en el componente equivocado | **Se reconoce por la duración, no por el mensaje**: el test que cayó primero declara **81.782 ms** para un caso que normalmente tarda decenas de milisegundos, y el error es `Test timed out in 5000ms`, no una aserción. Los otros 17 son **cascada**: tras el primer timeout la página se queda en «Cargando el documento…», así que el `textbox` no existe todavía. **Contraste que lo confirma, y que hay que repetir antes de diagnosticar nada**: la suite web **sola** dio `470 passed` **tres veces seguidas en 17 s** cada una. En la máquina donde se midió había ~10 GB en manos de procesos ajenos al repositorio y ~6 GB disponibles. **Regla para esta spec**: antes de declarar rojo cualquier medición de `T-011`, correr el paquete **solo**; y **no** subir el `testTimeout` para taparlo, que convertiría un síntoma ruidoso en uno silencioso |

---

## 9. Verificación

```bash
pnpm --filter @one-markdown/web test          # unit + componente
pnpm --filter @one-markdown/web typecheck
pnpm --filter @one-markdown/web lint
pnpm --filter @one-markdown/web test:e2e      # Chromium real
pnpm test && pnpm typecheck && pnpm lint      # el monorepo entero, para AC-32
pnpm --filter @one-markdown/web test:e2e      # AC-33(a) y (c): pico de workspace POR CORRIDA, con sondeo de Redis
pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3   # AC-33(b): sin un solo 429
```

**Toda cifra de cupo va con su ventana y su comando** (riesgo #12 de la `004`): las de AC-33(a) y (c)
son **por corrida** y se miden sondeando `throttle:workspace:{sha256(ip)}` en Redis mientras corre la
suite; bajo `--repeat-each=3` las repeticiones **se suman dentro de la misma ventana de 60 s**, así
que ahí solo se afirma la **ausencia de `429`**.

Los comandos `DONE` se corren **desde estado limpio** (`rm -rf packages/shared/dist` y dejar que el
flujo lo reconstruya), y **un fallo que no se reproduce no es transitorio hasta que se explica por qué
desapareció**.

**Precondición que deja de existir con `T-001`**: hasta que AC-29 esté cerrado, cualquier comando de
Playwright exige **`pnpm dev` parado**. Después, no.

---

## 10. Trazabilidad

| AC | Cubierto por | Tarea |
|----|--------------|-------|
| AC-1 | `apps/web/src/features/editor/editor.store.test.ts` (conjunto de claves como aserción propia) | T-003 |
| AC-2 | `editor.store.test.ts` (reapertura sin duplicar ni reordenar) | T-003 |
| AC-3 | `apps/web/src/features/editor/DocumentTabs.test.tsx` (referencias con `toBe` antes y después) | T-006 |
| AC-4 | `editor.store.test.ts` + `DocumentTabs.test.tsx` (cierre de la no activa, sin navegación) | T-003, **T-006** |
| AC-5 | `editor.store.test.ts` (los tres casos de vecina) | T-003 |
| AC-6 | `editor.store.test.ts` (orden: `PUT` resuelto antes del desalojo) | T-005 |
| AC-7 | `editor.store.test.ts` (las tres ramas de fallo de la `003`) | T-005 |
| AC-8 | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` (ir y volver sin lectura) | T-005 |
| AC-9 | `DocumentEditorPage.test.tsx` (petición al desmontar) | T-005 |
| AC-10 | `editor.store.test.ts` (dos `open` concurrentes → una petición) | T-004 |
| AC-11 | `editor.store.test.ts` (dos ids distintos → dos peticiones) | T-004 |
| AC-12 | `editor.store.test.ts` (fallo, y reintento posterior) | T-004 |
| AC-13 | `editor.store.test.ts` (entrada limpia y sucia, cero peticiones) | T-004 |
| AC-14 | `DocumentEditorPage.test.tsx` (rótulos derivados de la enumeración) | T-008 |
| AC-15 | `DocumentEditorPage.test.tsx` (los dos paneles presentes) | T-008 |
| AC-16 | `DocumentEditorPage.test.tsx` (escribir y afirmar antes del debounce) | T-008 |
| AC-17 | `DocumentEditorPage.test.tsx` (dos documentos con modos distintos) | T-008 |
| AC-18 | `DocumentEditorPage.test.tsx` (`getAllByRole('toolbar')` con longitud 1 en `text` y en `split`; cero en `preview`) | T-008 |
| AC-19 | `apps/web/e2e/tabs.spec.ts` (`boundingBox()` de los dos paneles) | T-010 |
| AC-20 | `DocumentTabs.test.tsx` (roles, nombre, roving tabindex) | T-006 |
| AC-21 | `DocumentTabs.test.tsx` (flechas y `Home`/`End`, ida y vuelta, con tres pestañas) | T-006 |
| AC-22 | `DocumentTabs.test.tsx` (`Delete` y `document.activeElement` tras el cierre) | T-006 |
| AC-23 | `DocumentTabs.test.tsx` (dos títulos distintos) | T-006 |
| AC-24 | `DocumentTabs.test.tsx` (nombre accesible limpio vs. sucio) | T-006 |
| AC-25 | `DocumentEditorPage.test.tsx` (los dos `tablist` por nombre) + la lista de consultas de `tasks.md` T-009 | T-008, T-009 |
| AC-26 | `DocumentEditorPage.test.tsx` (las regiones enumeradas por nombre, sin anidar) | T-009 |
| AC-27 | `DocumentEditorPage.test.tsx` (tabulación desde el principio, orden relativo) | T-009 |
| AC-28 | `DocumentTabs.test.tsx` (región montada y vacía; cerrar dos veces el mismo título reanuncia) | T-006 |
| AC-29 | El propio `pnpm --filter @one-markdown/web test:e2e` **con `pnpm dev` levantado** | T-001 |
| AC-30 | `apps/web/src/test/e2e-support.test.ts` (guarda que lee el fuente) + suites verdes | T-002 |
| AC-31 | `apps/web/e2e/editor.spec.ts` y `apps/web/e2e/palette.spec.ts` en verde tras la unificación | T-002 |
| AC-32 | `pnpm test` en los tres paquetes + `git status` | T-011 |
| AC-33 | **(a)** y **(c)** `apps/web/e2e/` con `test:e2e` + sondeo de `throttle:workspace:*` · **(b)** el mismo directorio con `--retries=2 --repeat-each=3` | T-011 |
| AC-34 | `apps/web/e2e/tabs.spec.ts` (`boundingBox()` de las pestañas y de su control de cierre) | T-010 |
