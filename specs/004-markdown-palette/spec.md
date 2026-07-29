# Spec 004 — Paleta de elementos markdown insertables

- **Versión**: 0.1.1
- **Estado**: approved
- **Fecha**: 2026-07-28 (v0.1.0 draft) · **aprobada el 2026-07-28** con las seis decisiones de §8 resueltas
- **Depende de**: `003-editor` (complete, v0.1.4) · `002-workspace-tree` (complete, v0.4.4) · `001-auth` · `000-foundation`

---

## 0. Alcance en una línea, y la decisión que lo fija

**Esta spec toca exclusivamente `apps/web`.** `packages/shared` y `apps/api` no reciben ni una línea.
El razonamiento completo está en §7, porque es la decisión de la que cuelga todo el reparto de tareas
y la que hace que esta spec no tenga ninguna tarea de backend ni ninguna secuencia forzada entre
paquetes.

---

## 1. Contexto y problema

`CLAUDE.md` describe el producto para «usuarios que no dominan la sintaxis». Hoy, después de la
spec `003`, el modo texto del editor es un `<textarea>` desnudo: quien no sepa que un encabezado se
escribe con `#`, que una tabla necesita una fila de guiones y dos tuberías por celda, o que un bloque
de código lleva tres acentos graves, **no tiene forma de descubrirlo desde la interfaz**. La vista
previa le enseña el resultado, pero solo después de haber acertado la sintaxis; no es un camino de
aprendizaje, es un espejo.

La `003` cerró a propósito el contrato que esta spec necesita, y lo dejó escrito en su §4:

1. El modo texto es **un solo `<textarea>`** con nombre accesible, así que `selectionStart`,
   `selectionEnd` y `setSelectionRange` están disponibles sin API de terceros.
2. **Todo** cambio de contenido entra por una única acción del store, `setDraft(id, texto)`, y el
   marcado de sucio, el debounce de 1.500 ms y la coalescencia reaccionan a ella **sea quien sea
   quien la llame**.
3. Por tanto la paleta solo tiene que **calcular la cadena nueva y llamar a `setDraft`**. No toca el
   guardado, no toca la red, no toca el conflicto.

Lo que la `003` dejó explícitamente fuera y aquí entra: la propia API de inserción, la posición del
cursor tras insertar, el comportamiento con texto seleccionado, y los atajos por elemento.

El problema, dicho como problema: **hace falta un camino visible y operable con teclado para producir
cada construcción de markdown que la vista previa ya sabe renderizar, sin escribir un solo carácter
de sintaxis.**

### 1.1 Lo que ya está renderizado y por tanto es insertable sin tocar nada

La cadena de plugins de la `003` es `remark-gfm` + `rehypeRawAsText` + `rehype-sanitize`. GFM ya
cubre **tablas, listas de tareas y tachado**; CommonMark cubre el resto. La consecuencia es la mejor
noticia de esta spec y hay que decirla en voz alta porque condiciona el modelo de amenaza:

> **La `004` no añade ni un solo plugin de remark o de rehype.** El conjunto de construcciones que la
> paleta puede producir es un **subconjunto** del que la `003` ya renderiza y ya sanea. La cadena de
> cinco capas de `003/plan.md` §2 se queda **exactamente** como está, y con ella la medición que la
> justifica.

Eso no significa que el modelo de amenaza no se mueva. Sí se mueve, y en una dirección concreta: la
paleta convierte en **un clic** construcciones que antes exigían teclear sintaxis que casi nadie
teclea. Un bloque de código vallado, una celda de tabla y un elemento de lista de tareas pasan a ser
contenedores triviales de alcanzar, y el corpus de XSS de hoy **no tiene ni una carga dentro de
ninguno de los tres**. Eso lo arregla AC-27 (§3.H).

---

## 2. Historias de usuario

- **US-1** — Como persona que no domina markdown, quiero ver una lista de los elementos disponibles
  con su nombre en castellano para insertarlos sin memorizar símbolos.
- **US-2** — Como persona que escribe, quiero seleccionar un trozo de texto y darle formato para que
  el elemento **envuelva lo que ya escribí** en vez de tirarlo o de añadirse al final.
- **US-3** — Como persona que escribe, quiero que después de insertar el cursor quede **donde voy a
  seguir escribiendo** —dentro del elemento, sobre el hueco que hay que rellenar— y no al final del
  documento.
- **US-4** — Como persona que navega con teclado, quiero llegar a la paleta con `Tab`, recorrerla con
  las flechas y activar un elemento con `Enter` o `Espacio`, sin que la paleta me robe una parada de
  tabulación por cada botón.
- **US-5** — Como persona que usa lector de pantalla, quiero que cada botón tenga un nombre que
  describa lo que hace y que se me anuncie que la inserción ocurrió, porque el cambio pasa dentro de
  un `<textarea>` cuyo contenido no se relee solo.
- **US-6** — Como persona que ya conoce markdown, quiero atajos para lo más frecuente (negrita,
  cursiva, enlace) sin tener que soltar el teclado ni salir del área de texto.
- **US-7** — Como responsable del producto, quiero que la paleta **no** abra un camino nuevo de
  guardado ni un modelo de estado paralelo: lo que inserte tiene que ser indistinguible de lo que
  alguien hubiera tecleado.

---

## 3. Criterios de aceptación

Todo AC es verificable por al menos un test automatizado. La trazabilidad completa está en §11.

Vocabulario que se usa en todos los AC: el **núcleo de inserción** es una función pura que recibe
`{ text, selectionStart, selectionEnd }` y un elemento del catálogo, y devuelve
`{ text, selectionStart, selectionEnd }`. No conoce React, ni el DOM, ni el store. El **componente**
es quien traduce ese resultado a `setDraft` + `setSelectionRange`.

### A. Núcleo de inserción — elementos que envuelven (negrita, cursiva, tachado, código en línea)

- **AC-1** — Dado el texto `hola mundo` con la selección `[0, 4]` (`hola`), cuando se aplica
  `bold`, entonces el texto resultante es `**hola** mundo` y la selección resultante es `[2, 6]` —es
  decir, **sigue cubriendo `hola` y no los asteriscos**, para que aplicar cursiva a continuación lo
  envuelva otra vez en vez de envolver los marcadores.

- **AC-2** — Dado el texto `hola ` con el cursor al final (selección `[5, 5]`, vacía), cuando se
  aplica `bold`, entonces el texto resultante es `hola **texto en negrita**` y la selección
  resultante cubre **exactamente** el marcador de posición `texto en negrita` (`[7, 23]`), de modo
  que la siguiente tecla lo sustituye.

- **AC-3** — Dada una selección que abarca varias líneas, cuando se aplica un elemento que envuelve,
  entonces se envuelve **la selección entera tal cual**, sin partirla por líneas y sin insertar
  marcadores intermedios.

- **AC-4** — Dados los cuatro elementos que envuelven, cuando se aplica cada uno sobre la selección
  `[0, 4]` de `hola mundo`, entonces los marcadores son exactamente `**`/`**` (negrita), `*`/`*`
  (cursiva), `~~`/`~~` (tachado) y `` ` ``/`` ` `` (código en línea), y en los cuatro casos la
  selección resultante cubre `hola`.

### B. Núcleo — enlace e imagen

- **AC-5** — Dado el texto `mira la web` con la selección `[8, 11]` (`web`), cuando se aplica `link`,
  entonces el texto resultante es `mira la [web](https://ejemplo.com)` y la selección resultante
  cubre **la URL** `https://ejemplo.com`, no el texto del enlace: lo que la persona ya escribió es el
  rótulo, y lo que falta por rellenar es el destino.

- **AC-6** — Dado el cursor sin selección, cuando se aplica `link`, entonces se inserta
  `[texto del enlace](https://ejemplo.com)` y la selección cubre `texto del enlace`. Con `image`,
  se inserta `![texto alternativo](https://ejemplo.com/imagen.png)` y la selección cubre
  `texto alternativo`.

### C. Núcleo — elementos de prefijo de línea (encabezados 1-3, cita, viñetas, numerada, tareas)

- **AC-7** — Dado el texto `una línea` con el cursor en la posición `4` (sin selección), cuando se
  aplica `heading2`, entonces el texto resultante es `## una línea` y el cursor queda en la posición
  `7`: se ha desplazado los **3 caracteres** que mide el prefijo, conservando su posición relativa
  dentro de la prosa. El prefijo se aplica **al principio de la línea**, no en el cursor.

- **AC-8** — Dada una selección que abarca tres líneas con texto, cuando se aplica `bulletList`,
  entonces **cada una** de las tres recibe `- `, y la selección resultante cubre las tres líneas ya
  prefijadas, de la primera columna de la primera a la última columna de la tercera. Con
  `numberedList`, los prefijos son `1. `, `2. ` y `3. ` **en orden**.

- **AC-9** — Dada una selección multilínea que incluye **líneas vacías**, cuando se aplica un
  elemento de prefijo, entonces las líneas vacías **no** reciben prefijo: un `- ` colgado en medio
  rompe la lista en dos y produce exactamente el resultado que la persona no pidió.

- **AC-10** — Dado que cada elemento de prefijo declara qué prefijos **sustituye**, entonces:
  aplicar `heading2` a una línea que empieza por `# ` produce `## ` (los encabezados son mutuamente
  excluyentes y no se acumulan); aplicar `bulletList` a una línea que ya empieza por `- ` la deja
  **igual** (idempotente por construcción, sin `- - `); y aplicar `taskList` a una línea que empieza
  por `- ` produce `- [ ] `.

- **AC-11** — Dado el cursor en una línea **vacía** sin selección, cuando se aplica un elemento de
  prefijo, entonces se inserta el prefijo **y su marcador de posición** (por ejemplo
  `## Encabezado 2`), con la selección cubriendo el marcador. Sobre una línea con texto, en cambio,
  **no** se inserta ningún marcador (AC-7): el texto de la persona ya es el contenido.

### D. Núcleo — bloques (bloque de código, tabla, separador)

- **AC-12** — Dado el documento **vacío** (`''`, selección `[0, 0]`), cuando se aplica `divider`,
  entonces el texto resultante es exactamente `---\n` y **no** empieza con líneas en blanco
  sobrantes.

- **AC-13** — Dado el texto `párrafo anterior` con el cursor al final, cuando se aplica un bloque,
  entonces el bloque queda separado del texto de alrededor por **exactamente una** línea en blanco
  por arriba y por abajo, sin crear una segunda cuando ya la había.

- **AC-14** — Dado el cursor sin selección, cuando se aplica `codeBlock`, entonces se inserta una
  valla de tres acentos graves con el hueco de lenguaje **vacío** y el cursor **dentro** de la valla.
  Con una selección, el texto seleccionado va **dentro** de la valla y sigue seleccionado.

- **AC-15** — Dado el cursor sin selección, cuando se aplica `table`, entonces se inserta una tabla
  GFM de **3 columnas y 2 filas de cuerpo** más la fila de encabezado y la de separación, y la
  selección cubre el texto de la **primera celda de encabezado**.

### E. Catálogo, pureza y exhaustividad

- **AC-16** — Dado el catálogo, entonces expone **14 elementos** con `id` único, etiqueta en
  castellano, descripción, grupo y —donde lo haya— atajo; y cubre la lista de `CLAUDE.md` completa:
  encabezados (3), negrita, cursiva, tachado, código en línea, bloque de código, cita, lista con
  viñetas, lista numerada, lista de tareas, enlace, imagen, tabla, separador.

- **AC-17** — Dados los archivos del núcleo y del catálogo, entonces **no importan** `react`,
  `react-dom`, `zustand` ni el store, y **no mencionan** `document` ni `window`. Se comprueba leyendo
  el código fuente, con el mismo patrón que `no-dangerous-html.test.ts` de la `003`, no por revisión.

- **AC-18** — Dado el catálogo, cuando se recorre entero aplicando cada elemento a un documento
  vacío, entonces **todos** producen un texto distinto del de entrada y una selección dentro de los
  límites del resultado. La guarda existe para que añadir un elemento al catálogo sin cubrirlo ponga
  el test en rojo, y no para que se descubra en producción.

### F. Integración con el editor

- **AC-19** — Dado el editor en modo **texto**, entonces la paleta está en el documento; dado el modo
  **vista previa**, entonces **no** lo está. Insertar en un área de texto que no se ve no es una
  funcionalidad, es una fuente de desconcierto.

- **AC-20** — Dado un documento abierto en modo texto, cuando se activa un botón de la paleta,
  entonces se llama a `setDraft` **una sola vez** con la cadena que devolvió el núcleo, el estado
  pasa a `dirty`, y **no** se emite ninguna petición inmediata: la inserción hereda el debounce y la
  coalescencia de la `003` sin ninguna rama nueva. Tres activaciones dentro de la misma ventana de
  1.500 ms producen **una** petición `PUT`.

- **AC-21** — Dado que se acaba de insertar, entonces el foco vuelve al `<textarea>` y sus
  `selectionStart` y `selectionEnd` **reales** son los que calculó el núcleo. Esto es un AC propio y
  no un detalle porque React documenta que un `<textarea>` controlado al que se le asigna un valor
  distinto de `e.target.value` **manda el cursor al final**: sin restaurar la selección a mano, cada
  inserción tira a la persona al final del documento.

- **AC-22** — Dado el documento **vacío** y sin que el `<textarea>` haya tenido el foco nunca, cuando
  se activa un botón de la paleta, entonces el contenido pasa de `''` a la plantilla del elemento y
  el foco acaba en el `<textarea>` con la selección correcta. Insertar en un documento recién creado
  es el caso más frecuente de todos y el que más fácil es dejarse.

- **AC-23** — Dado un borrador que ya supera `MAX_DOCUMENT_CONTENT_CHARS`, cuando se inserta desde la
  paleta, entonces la inserción **se aplica igual** y quien reacciona es el camino que ya existe (el
  contador de AC-30 de la `003` y el rechazo del servidor). La paleta **no** añade una rama de
  bloqueo propia: dos formas distintas de impedir lo mismo es cómo se produce el aviso que no
  coincide con la realidad.

### G. Accesibilidad

- **AC-24** — Dada la paleta, entonces es un `role="toolbar"` con `aria-label`, cuyos botones están
  repartidos en elementos `role="group"` con `aria-label` propio; cada botón es un `<button
  type="button">` con nombre accesible en castellano, y todo icono lleva `aria-hidden="true"` y
  `focusable="false"`.

- **AC-25** — Dada la paleta, entonces implementa **roving tabindex**: es **una sola** parada de
  tabulación para el conjunto (un botón con `tabIndex=0`, el resto con `-1`); `ArrowRight` y
  `ArrowLeft` recorren **todos** los botones en orden del documento **atravesando los grupos** y
  envolviendo por los extremos; `Home` y `End` van al primero y al último. El foco se mueve de
  verdad (`document.activeElement`), no solo el `tabIndex`.

- **AC-26** — Dado el editor en modo texto, entonces el orden de tabulación es: conmutador de vista →
  **paleta** → `<textarea>`. La paleta va **antes** del área de texto en el DOM, para que quien la
  recorra con lector de pantalla la encuentre antes de entrar a escribir y no después.

- **AC-27** — Dado que se ha insertado un elemento, entonces una región `role="status"` **propia de
  la paleta** anuncia el nombre del elemento insertado. Esa región y la de `SaveStatus` conviven en
  la página sin contenerse la una a la otra —se comprueba explícitamente, igual que la `003`
  comprueba la pareja `status`/`alert`—, porque dos regiones vivas anidadas producen anuncios
  duplicados.

- **AC-28** — Dado el foco **dentro del `<textarea>`**, cuando se pulsa `Ctrl`/`Cmd`+`B`,
  `Ctrl`/`Cmd`+`I` o `Ctrl`/`Cmd`+`K`, entonces se aplica negrita, cursiva o enlace respectivamente,
  se llama a `preventDefault()`, y **no** se dispara el guardado de `Ctrl`+`S` de la `003`. Con el
  foco **fuera** del `<textarea>` los tres atajos no hacen nada: son atajos del área de escritura, no
  de la ventana.

- **AC-29** — Dada la paleta renderizada en **Chromium real**, entonces cada botón mide al menos
  **24 × 24 px CSS** (WCAG 2.2, SC 2.5.8) y tiene indicador de foco visible al recorrerla con
  teclado. El tamaño no se puede afirmar en jsdom, que no calcula disposición: este AC es de
  navegador a propósito.

### H. Sanitización, corpus y presupuesto

- **AC-30** — Dado el catálogo entero, cuando el resultado de aplicar **cada** elemento a un
  documento vacío se pasa por `MarkdownPreview`, entonces produce el elemento HTML esperado
  (`h1`/`h2`/`h3`, `strong`, `em`, `del`, `code`, `pre > code`, `blockquote`, `ul`, `ol`,
  `input[type=checkbox]`, `a`, `img`, `table`, `hr`) y **cero** elementos activos y **cero**
  atributos que empiecen por `on`. Y la cadena de plugins de `MarkdownPreview` sigue siendo
  exactamente la de la `003`: la `004` **no instala ninguna dependencia**.

- **AC-31** — Dado `apps/web/src/test/markdown-xss-corpus.ts`, entonces incorpora **tres cargas
  nuevas** que hoy no existen y que la paleta vuelve alcanzables de un clic: (a) un **bloque de
  código vallado** que contiene `<script>alert(1)</script>`, (b) una **celda de tabla** que contiene
  `<img src=x onerror="alert(1)">`, y (c) un **elemento de lista de tareas** con un enlace
  `javascript:`. Las tres traen su `survives` no vacío, como todas. La guarda de tamaño del corpus
  sube de `>= 10` a `>= 15` **en los dos archivos que la afirman** (`MarkdownPreview.test.tsx` y
  `e2e/editor.spec.ts`), y las tres cargas quedan cubiertas por los cuatro `it.each` de jsdom y por
  el recorrido de Chromium **sin tocar una línea de ninguno de los dos**.

- **AC-32** — Dado el navegador real, cuando alguien abre un documento y opera **solo con teclado**
  —`Tab` hasta la paleta, flechas hasta «Negrita», `Enter`, escribir el texto, `Ctrl`+`S`—, entonces
  al **recargar la página** el documento conserva el texto en negrita y la vista previa lo muestra
  dentro de un `<strong>`. Es el recorrido que demuestra que los tres eslabones (paleta → `setDraft`
  → guardado de la `003`) están de verdad enganchados.

- **AC-33** — Dada la suite de navegador ejecutada con `--retries=2 --repeat-each=3`, entonces pasa
  entera **sin un solo `429`**, y el contador de `documentContent` —que **no** se resetea nunca, por
  política heredada de `003/tasks.md` `T-015`— se mantiene **por debajo de 10 de 120**. La regla del
  proyecto ante un presupuesto justo es **gastar menos, no neutralizar más**: el caso nuevo agrupa
  sus inserciones dentro de una única ventana de debounce y fuerza **un** guardado, no cinco.

- **AC-34** — Dado el cierre de la spec, entonces `packages/shared` y `apps/api` **no tienen ni una
  línea modificada**: sus suites dan exactamente los mismos recuentos que al cerrar la `003`
  (`shared` 81 · api unit 305 · api e2e 511) y `git status` no muestra archivos tocados fuera de
  `apps/web/**`, `specs/**` e `IMPLEMENTATION.md`.

---

## 4. Fuera de alcance

- **Deshacer nativo agrupado (`Ctrl`+`Z`) de las inserciones de la paleta.** La `003` había asignado
  «deshacer agrupado» a esta spec (su §4) y **la `004` lo devuelve**, con motivo y no por comodidad:
  la única forma de meter una inserción en la pila de deshacer del navegador desde un `<textarea>`
  controlado es `document.execCommand('insertText')`, que está **deprecado** y que **jsdom no
  implementa**. Adoptarlo obligaría a mockearlo en todos los tests de componente, es decir, a
  verificar el mock en vez del comportamiento. Consecuencia asumida y visible: `Ctrl`+`Z` deshace lo
  **tecleado**, pero no una inserción de la paleta.
  _Resuelto el 2026-07-28 (decisión **B** de §8)_: la limitación se **acepta**, y a cambio el remedio
  queda **planificado con destinatario** y no como una nota al pie — **§9**, asignado a la spec
  **`006-editor-undo`**, dependiente de la `005`.
- **Deshacer propio del editor** (pila de estados en el store, `Ctrl`+`Z`/`Ctrl`+`Shift`+`Z` a mano).
  Es una spec entera: modelo de transacción, interacción con el guardado automático, con el conflicto
  de la `003` y con el desalojo de entradas de la `005`. **Está planificado en §9 y asignado a la
  `006`**, con el qué, el porqué y el cómo escritos con detalle suficiente para arrancarla sin releer
  esta spec entera.
- **Alternar formato (toggle-off).** Aplicar `bold` a un texto **que ya está en negrita** vuelve a
  envolverlo (`****hola****`) en vez de quitárselo. Quitar formato exige reconocer el árbol de
  markdown alrededor del cursor —o sea, parsear—, y eso convierte una función de cadenas en un
  problema de sintaxis. Lo único que sí es idempotente aquí es el **prefijo de línea** (AC-10),
  porque ahí sí basta una expresión regular anclada.
- **Menú contextual, barra flotante sobre la selección, arrastrar y soltar elementos.** La paleta es
  una barra de herramientas fija.
- **Personalizar la paleta** (favoritos, orden propio, elementos recientes). Cualquiera de las tres
  necesita persistencia por usuario, y persistencia por usuario es un endpoint, un DTO y una tabla:
  exactamente lo que §7 argumenta que esta spec no debe abrir.
- **Vista previa del elemento al pasar por encima** (miniatura del resultado). El `title` y la
  descripción bastan; una miniatura es un segundo renderizador que sanear.
- **Plantillas de documento** («acta de reunión», «informe»). Es una feature de creación de
  documentos, no de edición.
- **Insertar imágenes subiendo un archivo.** Sigue fuera de alcance desde la `002`. El elemento
  `image` inserta una URL de ejemplo que la persona sustituye.
- **Un selector de tamaño de tabla** (la retícula de `n × m` al estilo de los procesadores de texto).
  La `004` inserta una tabla fija de 3 × 2 (AC-15). _Confirmado el 2026-07-28 (decisión **E** de §8)._
- **Resaltado de sintaxis, editor de código, matemáticas, diagramas, emoji por `:atajo:`,
  front-matter.** Siguen fuera de alcance por las mismas razones que en la `003`, y ahora además por
  una más concreta: cada uno es un plugin, y añadir un plugin obliga a **volver a medir** la cadena
  de saneado (§5).
- **Tabs y split view** (spec `005`). La paleta se renderiza dentro del panel de texto del documento
  abierto; cuando la `005` ponga dos paneles, la paleta va con el panel de texto y no hay estado
  compartido que decidir.
- **Deduplicar `GET /documents/:id`.** Deuda con destinatario asignada a la `005`
  (`003/spec.md` §8.1). La `004` **no** la toca.
- **Diseño visual definitivo.** La paleta es funcional y accesible.

---

## 5. Lo que esta spec hereda de la `003` y no puede tocar

Tres cosas llegan con instrucciones explícitas de la spec anterior. Se escriben aquí para que ninguna
tarea las «mejore» sin darse cuenta.

1. **La cadena de saneado no se toca.** `rehype-sanitize` **no es redundante**: la lista de protocolos
   permitidos depende del atributo —`href` admite seis, `src` solo `http` y `https`— y es la **única**
   capa que defiende los protocolos de `src`, medido con una mutación en `003/plan.md` §2.2.1. Y hay
   una regla más general que sigue vigente: **una capa no se retira porque ningún test la eche de
   menos**; las capas 1 y 2 siguen sin rojo propio. Si algún día la `004` o quien venga añade un
   plugin de remark/rehype, esa capa pasa a cubrir mucho más y **hay que volver a medir**. La `004`
   no añade ninguno (AC-30), así que la medición de la `003` sigue siendo válida sin repetirla.

2. **El corpus de XSS es el punto de ampliación barato.** Vive en un único archivo
   (`apps/web/src/test/markdown-xss-corpus.ts`) que importan el test de jsdom y el de Chromium.
   Añadir una entrada genera **cuatro casos nuevos en jsdom más uno en navegador** sin tocar ni una
   línea de ninguno de los dos. AC-31 lo usa: tres cargas nuevas, doce casos nuevos, cero líneas de
   test escritas a mano.

3. **El cupo de `documentContent` no se neutraliza.** La suite de navegador resetea `workspace` y
   `login`, pero **nunca** `documentContent` (gasta 4 de 120). La política del proyecto ante un
   presupuesto justo es **gastar menos, no neutralizar más**, y por eso el caso de AC-32 agrupa sus
   inserciones dentro de una ventana de debounce y fuerza **un** guardado. Y la regla real sobre los
   resets, la que costó descubrir: importa **el momento** (en los límites de un caso sí, a mitad de
   una secuencia de agotamiento no), no el lugar.

Y un riesgo conocido que conviene no diagnosticar mal: si el caso de conflicto **AC-33 de la `003`**
parpadea en CI, la causa es la ventana de decenas de milisegundos entre el `PUT` externo y el
vencimiento del debounce, **no** el cupo del throttler. La `004` no lo toca ni lo empeora.

---

## 6. El catálogo, cerrado

Se fija aquí, en la spec y no en el plan, porque es **contrato de producto**: son las etiquetas que
lee la persona y las cadenas exactas que acaban en su documento. Ninguna tarea puede inventarlas.

### Grupo «Formato» — envuelven la selección

| id | Etiqueta | Marcadores | Marcador de posición | Atajo |
|---|---|---|---|---|
| `bold` | Negrita | `**` … `**` | `texto en negrita` | `Ctrl`/`Cmd`+`B` |
| `italic` | Cursiva | `*` … `*` | `texto en cursiva` | `Ctrl`/`Cmd`+`I` |
| `strikethrough` | Tachado | `~~` … `~~` | `texto tachado` | — |
| `inlineCode` | Código en línea | `` ` `` … `` ` `` | `código` | — |

### Grupo «Bloques de texto» — prefijo de línea

| id | Etiqueta | Prefijo | Sustituye | Marcador de posición |
|---|---|---|---|---|
| `heading1` | Encabezado 1 | `# ` | `^#{1,6} ` | `Encabezado 1` |
| `heading2` | Encabezado 2 | `## ` | `^#{1,6} ` | `Encabezado 2` |
| `heading3` | Encabezado 3 | `### ` | `^#{1,6} ` | `Encabezado 3` |
| `quote` | Cita | `> ` | `^> ` | `Cita` |
| `bulletList` | Lista con viñetas | `- ` | `^(- \[[ xX]\] \|[-*+] \|\d+\. )` | `Elemento de la lista` |
| `numberedList` | Lista numerada | `N. ` (numera desde 1) | `^(- \[[ xX]\] \|[-*+] \|\d+\. )` | `Elemento de la lista` |
| `taskList` | Lista de tareas | `- [ ] ` | `^(- \[[ xX]\] \|[-*+] \|\d+\. )` | `Tarea pendiente` |

### Grupo «Insertar» — enlaces, imágenes y bloques

| id | Etiqueta | Plantilla | Qué queda seleccionado | Atajo |
|---|---|---|---|---|
| `link` | Enlace | `[texto del enlace](https://ejemplo.com)` | con selección: la **URL**; sin ella: el rótulo | `Ctrl`/`Cmd`+`K` |
| `image` | Imagen | `![texto alternativo](https://ejemplo.com/imagen.png)` | con selección: la **URL**; sin ella: el texto alternativo | — |
| `codeBlock` | Bloque de código | valla de tres acentos graves, hueco de lenguaje vacío | el contenido de la valla | — |
| `table` | Tabla | GFM, 3 columnas × 2 filas de cuerpo | la primera celda de encabezado | — |
| `divider` | Separador | `---` | nada; el cursor va a la línea siguiente | — |

Plantilla exacta de `table`:

```
| Encabezado 1 | Encabezado 2 | Encabezado 3 |
| --- | --- | --- |
| Celda | Celda | Celda |
| Celda | Celda | Celda |
```

Son **14 elementos**, y cubren la lista literal de `CLAUDE.md` —«encabezados, negrita, cursiva,
listas, enlaces, imágenes, código inline y en bloque, citas, tablas, separadores, tareas»— más
tachado, que llega gratis porque `remark-gfm` ya lo renderiza.

---

## 7. Por qué la `004` es solo frontend

La pregunta se responde explícitamente porque la respuesta contraria habría cambiado el reparto de
tareas entero.

**Qué haría falta para que tocara el backend.** Solo una cosa: que algo de la paleta tuviera que
persistir o que el servidor tuviera que entenderla. Ni lo uno ni lo otro:

- El servidor guarda el contenido como **texto opaco**. `PUT /api/workspace/documents/:id/content`
  recibe un `content: string` y no interpreta markdown en ningún punto. Un documento con una tabla
  insertada desde la paleta es, para el API, indistinguible de uno tecleado a mano.
- El catálogo es **copia de interfaz en castellano** más semántica de inserción. No hay ningún
  consumidor de servidor: nada que validar, nada que renderizar, nada que documentar en Swagger.
- Lo único compartido que la paleta debe respetar, `MAX_DOCUMENT_CONTENT_CHARS`, **ya está** en
  `packages/shared` y **ya lo consume** el editor (`editor.constants.ts`). No hace falta añadir nada.
- Favoritos, elementos recientes y orden personalizado —lo único que sí exigiría tabla, DTO y
  endpoint— están **fuera de alcance** (§4).

**Qué costaría equivocarse, con precio conocido.** La lección está pagada por la `003` y por la `002`
y merece repetirse entera, porque es la que hace que esta decisión importe más de lo que parece:

1. Un cambio en `packages/shared` deja `apps/api` **en rojo de compilación** hasta que aterriza la
   tarea que actualiza los DTO. Esas dos tareas **no se pueden paralelizar**, y la ventana entre
   ellas es una ventana en la que ninguna otra tarea puede verificar nada.
2. El radio de un cambio de contrato incluye los **fixtures de test de los dos paquetes**, y esos
   fixtures **no se encuentran buscando el nombre del endpoint**: se encuentran buscando el nombre
   del **tipo**. A la `002` la enmienda se le quedó corta **dos veces** por este motivo exacto
   (v0.4.2 y v0.4.3), las dos veces con el agente parando y reportando, que es lo que salvó el
   cierre.

Poner en `packages/shared` un catálogo que solo consume `apps/web` compraría ese coste a cambio de
nada. **Decisión: `packages/shared` y `apps/api` no se tocan**, y AC-34 lo convierte en algo
verificable en vez de en una intención.

**Consecuencias operativas.** Las diez tareas son todas de `frontend`; no hay ninguna secuencia
forzada entre paquetes; y `workspace-fixtures.ts` y `auth-fixtures.ts` **no aparecen** en la lista de
artefactos tocables de ninguna tarea, porque ningún tipo cambia. El único archivo de `src/test/` que
se toca es el corpus de XSS, y se toca **añadiendo entradas**, no cambiando su forma.

---

## 8. Riesgos y decisiones

Las seis primeras filas eran **decisiones abiertas**. **Quedaron resueltas el 2026-07-28**, las seis
en la opción que la spec recomendaba y **sin ningún cambio de alcance**: el recuento sigue en **34
AC** y **10 tareas**, y ni un solo AC cambió de redacción. Se conservan abajo —con su razonamiento
íntegro— porque el motivo de una decisión es lo que hace falta el día que alguien quiera revisarla, y
borrarlo dejaría solo el resultado. El resto de filas son riesgos ya mitigados por el plan.

| Decisión | Resuelta el | Opción elegida | Qué queda tocado |
|---|---|---|---|
| **A** — qué queda seleccionado al insertar sin selección | 2026-07-28 | **Plantilla completa con el marcador de posición preseleccionado** (`**texto en negrita**` con `texto en negrita` resaltado), para que la siguiente tecla lo sustituya | Nada: AC-1…AC-15 ya estaban escritos con esta opción |
| **B** — `Ctrl`+`Z` sobre una inserción de la paleta | 2026-07-28 | **Se acepta la limitación**, pero **no como nota al pie**: la pila de deshacer propia queda **planificada como trabajo futuro con destinatario** — ver **§9**, y asignada a la spec **`006-editor-undo`** | §4 y §9 (nueva). Ningún AC de la `004` |
| **C** — visibilidad de la paleta | 2026-07-28 | **Solo en modo texto**; oculta en vista previa | Nada: AC-19 se queda literal |
| **D** — atajos `Ctrl`/`Cmd`+`B`/`I`/`K` | 2026-07-28 | **Los tres**, acotados al foco **dentro del `<textarea>`** | Nada: AC-28 y T-008 se quedan |
| **E** — tamaño de la tabla | 2026-07-28 | **Fija, 3 × 2**, sin selector de retícula | Nada: AC-15 se queda |
| **F** — anuncio en región viva tras insertar | 2026-07-28 | **Se incluye**, con el riesgo de doble locución documentado | Nada: AC-27 se queda, y el riesgo sigue escrito en su fila |

**La única resolución que añade trabajo es la B**, y lo añade **fuera** de la `004`: la limitación se
acepta aquí y el remedio se planifica en §9 para la spec `006`. Las otras cinco confirman lo que ya
estaba escrito, así que la implementación puede arrancar sin releer los AC.

### 8.1 Las seis decisiones, con su razonamiento original

| # | Decisión abierta | Impacto | Opción recomendada y por qué |
|---|---|---|---|
| **A** | **Qué queda seleccionado al insertar sin selección.** Opción 1: la plantilla completa con su **marcador de posición seleccionado** (`**texto en negrita**` con `texto en negrita` resaltado), de modo que la siguiente tecla lo sustituye. Opción 2: solo los marcadores, con el cursor en medio (`**‸**`) | Medio: es lo primero que se nota al usar la paleta, y cambia todos los AC de §3.A-D | **Opción 1.** Para quien no domina la sintaxis, ver `texto en negrita` seleccionado **enseña** qué va ahí; un par de asteriscos vacíos no enseña nada. El coste es que hay que borrar el marcador si no se quiere, pero está preseleccionado, así que se borra tecleando |
| **B** | **`Ctrl`+`Z` no deshará una inserción de la paleta.** Aceptarlo, o pagar `document.execCommand('insertText')` para conservar la pila nativa | Medio-alto en percepción: deshacer que no deshace es de las cosas que más se notan | **Aceptarlo**, y decirlo aquí en vez de descubrirlo. `execCommand` está deprecado y **jsdom no lo implementa**, así que adoptarlo obliga a mockearlo en todos los tests de componente —verificar el mock en vez del comportamiento— o a renunciar a cubrir la inserción fuera del navegador. Si el usuario prefiere la otra opción, la salida honesta **no** es el `execCommand` con respaldo (el respaldo sería lo único que los tests ejercitarían): es una pila de deshacer propia en el store, que es una spec |
| **C** | **La paleta solo se ve en modo texto** (AC-19), o se ve siempre y se deshabilita en vista previa | Bajo-medio: afecta al aprendizaje pasivo y a la estabilidad visual de la página | **Solo en modo texto.** Una barra de catorce botones deshabilitados es ruido, y WCAG desaconseja controles deshabilitados sin explicación. La alternativa interesante —clicar en vista previa y que **conmute** a texto e inserte— es más lista de lo que conviene: cambia el modo de vista como efecto secundario de un clic que no pedía cambiarlo |
| **D** | **Atajos `Ctrl`/`Cmd`+`B`/`I`/`K`** (AC-28). La `003` los asignó a esta spec. Los tres pisan atajos del navegador: `Ctrl`+`B` abre marcadores en Firefox, `Ctrl`+`K` enfoca la búsqueda del omnibox en Chrome y Firefox | Medio: pisar un atajo del navegador con `preventDefault` es habitual en editores, pero no es gratis | **Incluirlos**, acotados al foco **dentro del `<textarea>`** (no a la ventana, a diferencia del `Ctrl`+`S` de la `003`). Es lo que hacen todos los editores de markdown, y fuera del área de escritura los atajos del navegador siguen intactos. Si el usuario prefiere no pisar `Ctrl`+`K`, quitarlo es borrar una fila del catálogo y un caso de AC-28 |
| **E** | **Tamaño fijo de la tabla: 3 × 2** (AC-15), frente a un selector de retícula | Bajo | **Fijo.** Añadir filas a una tabla markdown es teclear una línea; el selector es una interfaz emergente con su propio patrón ARIA (`grid`) y su propio recorrido de teclado, para ahorrar dos líneas de texto |
| **F** | **Anuncio en región viva tras insertar** (AC-27) | Bajo-medio: puede resultar hablador | **Incluirlo.** El cambio ocurre dentro de un `<textarea>` y ningún lector de pantalla lo relee solo; sin anuncio, quien no ve la pantalla no tiene forma de saber que el clic hizo algo. Riesgo real: al devolver el foco al `<textarea>` (AC-21) algunos lectores lo reanuncian, así que puede haber doble locución. El mensaje es corto y `polite` a propósito |

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 1 | **El cursor se va al final en cada inserción.** React lo documenta: un `<textarea>` controlado al que se le asigna un valor distinto de `e.target.value` pierde la posición del caret | **Alto**: rompe US-3 entera y es el defecto más fácil de introducir | AC-21 es un AC propio, con aserción sobre `selectionStart`/`selectionEnd` **reales** del DOM y no sobre lo que devolvió el núcleo. El plan fija el mecanismo (§4.3): selección pendiente en un `ref` + `useLayoutEffect` que la aplica **después** de que el valor aterrice, nunca dentro del manejador del clic |
| 2 | **La paleta abre un segundo camino de cambio de contenido** y con él un segundo modelo de sucio/guardado | Alto y silencioso: se manifestaría como guardados perdidos o duplicados | La paleta llama a `setDraft` y **solo** a `setDraft` (AC-20), que es la invariante que la `003` dejó escrita en el código (`editor.store.ts`, comentario de `setDraft`). El test lo mide **contando peticiones**, no espiando la acción: tres inserciones en una ventana de debounce → una petición |
| 3 | **El núcleo se contamina de DOM** y deja de poder probarse como función pura | Medio: se descubre tarde, cuando el archivo ya tiene cien casos | AC-17, con lectura del código fuente y el mismo patrón que `no-dangerous-html.test.ts`. La frontera es la de siempre: núcleo puro dentro, adaptador (React + DOM) fuera |
| 4 | **La paleta hace trivial producir construcciones que el corpus de XSS no visita**: dentro de una valla de código, dentro de una celda de tabla, dentro de un elemento de tarea | Medio-alto: es un hueco **real** del modelo de amenaza, no teórico | AC-31: tres cargas nuevas, que el corpus multiplica sola por cuatro casos de jsdom más el recorrido de Chromium. Es el retorno más alto por línea escrita de toda la spec |
| 5 | **El presupuesto de la suite de navegador se queda corto otra vez.** Es la tercera spec seguida en que aparece | Medio: rojos que no tienen que ver con lo que se mide | AC-33, con el comando como verificación y el número (`< 10/120` de `documentContent`) escrito en el propio AC. Y el diseño del caso ayuda: agrupa las inserciones dentro de una ventana de debounce y fuerza **un** guardado |
| 6 | **Roving tabindex mal implementado deja la paleta fuera del alcance del teclado** o le da catorce paradas de tabulación | Medio-alto: es exactamente la barrera que la spec existe para no crear | AC-25 y AC-26, que afirman el movimiento **real** del foco (`document.activeElement`) y no solo el atributo. Hay precedente exacto en el repo del que copiar: el `tablist` de `DocumentEditorPage` y el `role="tree"` de `WorkspaceTreeView`, los dos con roving y flechas |
| 7 | **`markdown-insert.ts` crece hasta ser inmantenible** si cada elemento trae su caso especial | Medio | Tres familias y **una sola** función de despacho (`inline`, `linePrefix`, `block`); el catálogo es **datos**, no código. Añadir un elemento debe ser una fila de tabla, y AC-18 pone en rojo el que se añada sin cubrir |
| 8 | **Los `it.each` del corpus crecen a 15 × 4 = 60 casos en jsdom** más los de navegador | Bajo | Son casos baratos (`render` síncrono, sin red ni temporizadores falsos) y es el mecanismo que la `003` diseñó a propósito para que ampliar cobertura fuese barato |
| 9 | **La numeración de `numberedList` se recalcula mal** al aplicarla sobre una selección con líneas vacías | Bajo, pero produce listas rotas | AC-8 y AC-9 juntos lo clavan: las vacías no reciben prefijo, y la numeración cuenta **solo las líneas que sí lo reciben** |
| 10 | **La `005` (tabs y split view) mueve la paleta de sitio** | Bajo | La paleta se renderiza **dentro del panel de texto** y su única entrada es `(id, elemento)`. Con dos paneles, va con el de texto; no hay estado compartido entre paletas porque no hay estado: la selección vive en el `<textarea>` y el contenido en el store, ya indexado por documento |

---

## 9. Trabajo futuro planificado: pila de deshacer propia → spec `006-editor-undo`

Esto **no es una nota al pie ni una limitación suelta**: es trabajo con destinatario, con motivo y
con enfoque, escrito con el detalle suficiente para que la sesión que lo recoja pueda planificarlo
**sin releer nada de esta conversación**. Nace de la resolución de la decisión **B** (§8), donde el
usuario aceptó la limitación de la `004` a cambio de que el remedio quedara planificado.

**Asignación**: spec **`006-editor-undo`**, dependiente de la **`005`**. El número es nuevo a
propósito, y §9.4 explica por qué no se mete dentro de la `005` y por qué tiene que ir **después** de
ella y no antes.

### 9.1 Qué se hará

Una **pila de deshacer/rehacer propia del editor**, en el store, **por documento**, que cubra
**todos** los cambios de contenido —lo tecleado y lo insertado desde la paleta— con
`Ctrl`/`Cmd`+`Z` y `Ctrl`/`Cmd`+`Shift`+`Z` (y `Ctrl`+`Y` en Windows) como su interfaz.

### 9.2 Por qué hay que hacerlo

**El problema real, y no es de la paleta: es del control controlado.** El `<textarea>` del editor es
un control **controlado** por React: su `value` sale del `draft` del store. Cada vez que un cambio no
viene de teclear —es decir, cada vez que el programa asigna un valor distinto de `e.target.value`—
React reescribe el contenido del elemento, y esa reescritura **no entra en la pila de deshacer nativa
del navegador**. Peor: la invalida. La pila nativa deja de describir el historial real del documento,
así que `Ctrl`+`Z` después de una inserción de la paleta hace algo impredecible —restaurar un estado
anterior a la inserción, deshacer dos pasos, o nada— en vez de lo que la persona pidió.

Y **un deshacer que no deshace es de los defectos que más se notan y peor se toleran**: no falla de
forma visible, falla en el momento exacto en que alguien intenta recuperarse de un error, que es
cuando menos margen tiene. Es la clase de defecto que hace que se deje de confiar en la herramienta
entera, no solo en la paleta.

**Por qué `document.execCommand('insertText')` no es la salida.** Es la técnica clásica para meter
una inserción programática en la pila nativa, y hay que descartarla por escrito para que nadie la
reproponga como el atajo obvio:

1. Está **deprecado**. Ninguna especificación viva lo respalda y su comportamiento exacto varía entre
   motores.
2. **jsdom no lo implementa.** Adoptarlo significa que **todos** los tests de componente de la
   inserción tendrían que mockearlo, es decir, **verificar el mock en lugar del comportamiento**: los
   ~40 casos del núcleo y los de integración dejarían de demostrar lo que dicen demostrar.
3. La variante «`execCommand` con respaldo al camino puro» es **peor que cualquiera de las dos**: el
   respaldo sería lo **único** que los tests ejercitan, así que el camino que corre en producción
   sería precisamente el que nadie cubre. Es el anti-patrón exacto que el proyecto ya rechazó al
   decidir no depender de mocks de módulo (`vi.mock`) y sustituir la **red** en su lugar.
4. Aunque funcionara, resuelve **la mitad**: da deshacer nativo, pero no da control sobre la
   granularidad (qué cuenta como un paso) ni sobre la interacción con el guardado, que es la parte
   que de verdad hay que diseñar.

La conclusión es la que la `004` ya escribió y aquí queda razonada: la salida honesta **no** es
recuperar la pila del navegador, es **tener una propia**.

### 9.3 Cómo se solventará — enfoque previsto

**Dónde vive el estado.** Dentro de `EditorEntry`, en `editor.store.ts` — es decir, **por documento**
y dentro del diccionario `Record<string, EditorEntry>` que la `003` ya dejó indexado por `id`:

```ts
interface UndoState {
  readonly past: readonly Transaction[];
  readonly future: readonly Transaction[];
}
interface Transaction {
  readonly before: { readonly text: string; readonly selectionStart: number; readonly selectionEnd: number };
  readonly after:  { readonly text: string; readonly selectionStart: number; readonly selectionEnd: number };
  readonly kind: 'typing' | 'palette' | 'shortcut' | 'conflict-resolution';
  readonly at: number;   // marca de tiempo, para agrupar el tecleo
}
```

Guardar el **estado de selección** en cada extremo de la transacción, y no solo el texto, es lo que
hace que deshacer devuelva el caret a donde estaba: un deshacer que restaura el texto pero deja el
cursor al final repite, en pequeño, el mismo defecto que se está arreglando.

**Qué se registra como transacción, y con qué granularidad.** Esta es la decisión de producto de la
`006`, y la recomendación es:

- **Una inserción de la paleta = una transacción, siempre.** Es un gesto único con un resultado
  único; partirla no tiene sentido. Lo mismo cada atajo `Ctrl`+`B`/`I`/`K`.
- **El tecleo se agrupa por ventana de inactividad**, no por pulsación: pulsaciones consecutivas del
  mismo `kind: 'typing'` separadas por menos de un umbral se **funden** en la transacción abierta.
  Recomendación de partida: **~500 ms**, deliberadamente **más corto** que el debounce de guardado, y
  §9.5 explica por qué no deben ser el mismo número.
- **La resolución de un conflicto es una transacción propia** y **no se funde** con nada: adoptar el
  texto del servidor (`resolveTakeServer`) cambia el documento entero, y permitir deshacerlo de
  vuelta sin más es cómo se reintroduce el conflicto que se acaba de resolver. La `006` tendrá que
  decidir si esa transacción es **deshacible** o si **vacía la pila**; la recomendación es vaciarla,
  porque después de adoptar el servidor el historial local ya no describe este documento.
- Un límite de profundidad (p. ej. 200 transacciones) para acotar la memoria, con desalojo por el
  extremo antiguo.

**Cómo interactúa con `setDraft` y con el debounce de 1.500 ms.** Las dos cosas son **ortogonales** y
tienen que seguir siéndolo:

- `setDraft` sigue siendo el **único** camino de cambio de contenido, la invariante que la `003`
  cerró y que la `004` respeta. La `006` lo **envuelve**, no lo sustituye: registrar la transacción
  ocurre **dentro** de `setDraft`, de modo que cualquier llamante —tecleo, paleta, atajo— entra en la
  pila sin saber que existe. Un segundo camino que registre aparte es exactamente el riesgo 2 de §8.
- **Deshacer es un `setDraft` más.** No es una ruta paralela: aplica el `before` de la transacción
  como si alguien lo hubiera escrito, así que hereda el marcado de sucio, el debounce y la
  coalescencia sin código nuevo. La única cautela: **no debe registrarse a sí mismo** como
  transacción nueva —o deshacer y rehacer se perseguirían—, lo que en la práctica es una marca de
  «esta llamada viene de la pila».
- **Los dos umbrales no se comparten y no deben igualarse.** El de agrupación de tecleo (~500 ms) es
  de **granularidad de historial**; el de guardado (1.500 ms) es de **tráfico de red**. Atarlos haría
  que ajustar uno moviera el otro en silencio, y un cambio de política de red acabaría cambiando qué
  significa `Ctrl`+`Z`. Que el de historial sea el más corto es lo que hace que un paso de deshacer
  sea siempre ≤ lo que se pierde en un cierre forzado.
- El restablecimiento de la selección tras deshacer usa **el mismo mecanismo** que la `004` monta
  para la paleta (`pendingSelection` en un `ref` + `useLayoutEffect`, `plan.md` §4.3). Es decir: la
  `004` deja construida la mitad de la maquinaria que la `006` necesita, y no por casualidad.

**Interfaz y accesibilidad.** `Ctrl`/`Cmd`+`Z` y `Ctrl`/`Cmd`+`Shift`+`Z` escuchados **en el
`<textarea>`** —igual que los atajos de la `004` y a diferencia del `Ctrl`+`S` de la `003`, que es de
ventana— con `preventDefault()` para desactivar el deshacer nativo, que a partir de ese momento sería
el que mintiera. Conviene que haya además botones visibles con nombre accesible: un atajo sin control
visible no es alcanzable para quien no usa teclado físico.

### 9.4 Por qué una spec propia, y por qué después de la `005`

**Por qué no dentro de la `004`.** Porque no es la misma feature: la `004` es una paleta de
inserción y la `006` es un modelo de historial del documento, con su propio modelo de transacción, su
propia interacción con el guardado y con el conflicto, y su propia interfaz. Meterla aquí sería
duplicar el tamaño de la spec para arreglar un síntoma que la `004` no causa —lo causa el control
controlado, que existe desde la `003`— y que la afecta igual que afecta a cualquier otra escritura
programática futura.

**Por qué no dentro de la `005`.** La `005` (tabs y split view) ya tiene lo suyo: la **política de
desalojo** del diccionario de entradas y la deduplicación de `GET /documents/:id` en `open(id)`
(`003/spec.md` §8.1). Colgarle además un modelo de historial la convierte en la spec donde se mete
todo lo que sobra.

**Por qué después y no antes.** Hay una dependencia real y en esta dirección: la pila vive **dentro
de `EditorEntry`**, y la `005` es quien decide **cuándo se desaloja una entrada**. Desalojar una
entrada tira su historial a la basura, así que «cerrar una pestaña y volver a abrirla pierde el
deshacer» es una consecuencia de una decisión que la `005` toma. Diseñar la pila antes de que esa
política esté fijada es diseñarla contra un supuesto.

**Y una restricción que la `005` tiene que conocer ahora**, para no descubrirla tarde: al decidir su
política de desalojo, la `005` debe dejar **escrito y consciente** que desalojar una entrada
**descarta su historial de deshacer**, y decidir si eso es aceptable o si las entradas con historial
merecen un trato distinto. Queda anotado también en `specs/README.md`, en la fila de la `005`.

**Una pila por documento, nunca global.** Con tabs, un `Ctrl`+`Z` global deshaciendo un cambio de
**otra** pestaña sería un defecto grave y silencioso. La forma que la `003` eligió —estado indexado
por `id`— ya lo impide por construcción, y por eso la pila va dentro de `EditorEntry` y no al lado.

### 9.5 Lo que la `004` deja construido para la `006`

Para que la sesión que recoja esto sepa lo que ya tiene: (a) `setDraft` como **único** camino de
cambio de contenido, verificado por AC-20 contando peticiones; (b) el mecanismo de **restauración de
selección** (`pendingSelection` + `useLayoutEffect`) ya montado y cubierto por AC-21; (c) el núcleo
de inserción **puro** (AC-17), que devuelve `{ text, selectionStart, selectionEnd }` — exactamente la
forma que necesita cada extremo de una transacción; y (d) el precedente de atajos acotados al
`<textarea>` (AC-28), que es donde `Ctrl`+`Z` tiene que ir.

---

## 10. Verificación

```bash
pnpm --filter @one-markdown/web test          # unit + componente
pnpm --filter @one-markdown/web typecheck
pnpm --filter @one-markdown/web lint
pnpm --filter @one-markdown/web test:e2e      # Chromium real
pnpm test && pnpm typecheck && pnpm lint      # el monorepo entero, para AC-34
pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3   # AC-33
```

Los comandos `DONE` se corren **desde estado limpio** (`rm -rf packages/shared/dist` y dejar que el
flujo lo reconstruya), y **un fallo que no se reproduce no es transitorio hasta que se explica por
qué desapareció**. Las dos reglas las han pagado las cinco fases anteriores.

---

## 11. Trazabilidad

| AC | Cubierto por | Tarea |
|----|--------------|-------|
| AC-1 | `apps/web/src/features/editor/markdown-insert.test.ts` (envolver con selección) | T-001 |
| AC-2 | `markdown-insert.test.ts` (marcador de posición seleccionado) | T-001 |
| AC-3 | `markdown-insert.test.ts` (selección multilínea) | T-001 |
| AC-4 | `markdown-insert.test.ts` (los cuatro marcadores) | T-001 |
| AC-5 | `markdown-insert.test.ts` (enlace con selección → URL seleccionada) | T-002 |
| AC-6 | `markdown-insert.test.ts` (enlace e imagen sin selección) | T-002 |
| AC-7 | `markdown-insert.test.ts` (prefijo al principio de línea, cursor desplazado) | T-003 |
| AC-8 | `markdown-insert.test.ts` (tres líneas, viñetas y numerada) | T-003 |
| AC-9 | `markdown-insert.test.ts` (líneas vacías sin prefijo) | T-003 |
| AC-10 | `markdown-insert.test.ts` (sustitución e idempotencia de prefijos) | T-003 |
| AC-11 | `markdown-insert.test.ts` (línea vacía → prefijo + marcador) | T-003 |
| AC-12 | `markdown-insert.test.ts` (bloque en documento vacío) | T-004 |
| AC-13 | `markdown-insert.test.ts` (una sola línea en blanco de separación) | T-004 |
| AC-14 | `markdown-insert.test.ts` (valla con y sin selección) | T-004 |
| AC-15 | `markdown-insert.test.ts` (tabla 3 × 2) | T-004 |
| AC-16 | `apps/web/src/features/editor/markdown-palette.test.ts` (catálogo completo) | T-005 |
| AC-17 | `markdown-palette.test.ts` (lectura del código fuente) | T-005 |
| AC-18 | `markdown-palette.test.ts` (recorrido exhaustivo del catálogo) | T-005 |
| AC-19 | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` (paleta por modo) | T-007 |
| AC-20 | `DocumentEditorPage.test.tsx` (tres inserciones → una petición) | T-007 |
| AC-21 | `DocumentEditorPage.test.tsx` (`selectionStart`/`selectionEnd` reales) | T-007 |
| AC-22 | `DocumentEditorPage.test.tsx` (documento vacío, sin foco previo) | T-007 |
| AC-23 | `DocumentEditorPage.test.tsx` (inserción por encima del límite) | T-007 |
| AC-24 | `apps/web/src/features/editor/MarkdownPalette.test.tsx` (roles y nombres) | T-006 |
| AC-25 | `MarkdownPalette.test.tsx` (roving tabindex y flechas) | T-006 |
| AC-26 | `DocumentEditorPage.test.tsx` (orden de tabulación) | T-007 |
| AC-27 | `MarkdownPalette.test.tsx` + `DocumentEditorPage.test.tsx` (las dos regiones vivas) | T-006, T-007 |
| AC-28 | `DocumentEditorPage.test.tsx` (atajos con y sin foco en el área de texto) | T-008 |
| AC-29 | `apps/web/e2e/palette.spec.ts` (`boundingBox()` y foco visible) | T-010 |
| AC-30 | `apps/web/src/features/editor/MarkdownPreview.test.tsx` (cada plantilla renderizada) | T-009 |
| AC-31 | `apps/web/src/test/markdown-xss-corpus.ts` + las guardas de `MarkdownPreview.test.tsx` y `e2e/editor.spec.ts` | T-009 |
| AC-32 | `apps/web/e2e/palette.spec.ts` (recorrido solo con teclado y recarga) | T-010 |
| AC-33 | `apps/web/e2e/` completo con `--retries=2 --repeat-each=3` | T-010 |
| AC-34 | `pnpm test` en los tres paquetes + `git status` | T-010 |
