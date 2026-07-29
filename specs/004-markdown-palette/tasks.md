# Tareas 004 — Paleta de elementos markdown insertables

Spec: `spec.md` **v0.3.0** (**complete**) · Plan: `plan.md`

**Estado a 2026-07-29: las 12 tareas cerradas y verificadas (T-001…T-012). La spec queda
`complete`.**

**La v0.3.0 añade `T-012`, la duodécima y la última**, y es la razón de que la versión sea minor: no
trae ningún AC nuevo, pero **mueve el recuento de tareas**. Cierra AC-27 en el único sitio donde
seguía incumplido: `e2e/palette.spec.ts` —creado por T-010, **antes** de que existiera el nombre
accesible— distinguía las dos regiones vivas **por contenido**. Pasaba verde, y ese era justamente el
problema: el locator viejo es **inmune** a la mutación que borra el `aria-label`, así que era un test
que no podía detectar la regresión del AC que lo rodea. Además, tres correcciones de redacción que no
mueven código: el `takeRecords()` de **AC-36** (que no era implementable, y está medido), la aserción
por **contención** del contenido final (por el `U+200B` del reanuncio), y el **fallo esperado del RED
1(b) de T-011**, que no era el que ocurría.

**La v0.2.1 es un patch que no mueve ninguna tarea**: corrige **AC-33**, que era **cierto por corrida
y falso bajo su propio comando de verificación** —y lo era ya en la `003`, con 12 de gasto antes de
que esta spec existiera—, precisa el recorrido de teclado de **AC-32**, y anota la extracción de
`watchConsole` como deuda de la `005`. Al leer `T-010` hay que leerla contra el AC corregido: las
dos cifras del presupuesto viven en **ventanas distintas** y se miden con **comandos distintos**.

**La v0.2.0 añade una tarea, la primera desde que se aprobó la spec.** **T-011** existe porque AC-27
se implementó según su letra y la letra estaba mal: la región viva de la paleta se monta **junto con
su primer anuncio**, y eso es notoriamente poco fiable en NVDA y JAWS —el AC quedaba **verde en CI y
falso para quien lo necesita**—. Arreglarlo obliga a que la región esté montada siempre, y una
segunda región `status` permanente rompe **seis** aserciones que hoy consultan `getByRole('status')`
sin desambiguar (cuatro de componente y **dos de e2e**, estas con violación de modo estricto). La
salida es poner **nombre accesible a las dos** regiones. Con ella entra **AC-36**: insertar dos veces
el mismo elemento tiene que **volver a anunciar**, y hoy no lo hace porque escribir el mismo texto no
muta el DOM.

**Dos correcciones de redacción de la misma versión, que no mueven ninguna tarea** y que solo hay que
conocer al leer los tests que ya están verdes: **AC-26** pasa a exigir el orden **relativo**
(conmutador → paleta → `<textarea>`, con el botón «Guardar» de la `003` entre los dos primeros, que
es el recorrido real y el que el test de T-007 ya afirma), y **AC-20** deja escritas sus **dos
mitades** con la medida de cada una — el conteo de peticiones **no** ve un `setDraft` de más; eso lo
ve la aserción del borrador exacto, que T-007 ya escribió en el mismo caso.

La **v0.1.2** no movió ninguna tarea de
sitio ni cambió ninguna dependencia: corrigió el recuento del catálogo (**16 elementos, no 14**),
añadió **AC-35** a T-004 —escribiendo lo que esa tarea ya implementó y ya cubre— y precisó las listas
de artefactos de T-005 y T-006 con lo aprendido al implementarlas.

**Las diez tareas originales quedan exactamente igual que en la v0.1.0** (la v0.2.0 añade la
**undécima**, T-011, y no toca ninguna de las diez). Las seis decisiones abiertas de
`spec.md` §8 se resolvieron el 2026-07-28 **todas en la opción recomendada**, así que ningún AC
cambió de redacción, ningún artefacto entró ni salió y ninguna tarea se movió. La única resolución
que añade trabajo (la **B**, la pila de deshacer) lo añade **fuera de esta spec**: queda planificada
en `spec.md` §9 y asignada a la spec **`006-editor-undo`**. **Aquí no hay nada nuevo que hacer.**

Cada tarea es atómica, se asigna a un agente y sigue RED → GREEN → REFACTOR.
El test se escribe primero y **debe fallar antes** de implementar; el agente reporta el fallo inicial.

**Las doce tareas son de `frontend`.** No hay ninguna de `backend` porque la spec no toca
`packages/shared` ni `apps/api` (`spec.md` §7, decisión 1 del plan). Si alguna tarea se ve obligada a
tocar cualquiera de esos dos paquetes, **para y reporta**: significa que la decisión 1 estaba mal y
eso es un cambio de spec, no una tarea.

---

## Regla de artefactos

Cada tarea enumera **todos** los archivos que puede tocar, tests y fixtures incluidos. En la `003`
esa lista se quedó corta **dos veces**, las dos por el mismo motivo: el radio de un cambio incluye
todo lo que construye un valor del tipo, no solo el archivo donde vive el tipo. Aquí ningún tipo
compartido cambia, así que el riesgo es el otro: **olvidarse de las guardas duplicadas**. La guarda
del tamaño del corpus está afirmada en **dos** archivos (`MarkdownPreview.test.tsx` y
`e2e/editor.spec.ts`) y hay que mover las dos (T-009).

**Si un artefacto no está en la lista de la tarea, no se toca.** Si hace falta tocarlo, se para y se
reporta.

---

## Tareas

- [x] **T-001** · `frontend` · Núcleo de inserción: tipos, despacho y familia que envuelve
      **AC**: AC-1, AC-2, AC-3, AC-4
      **Depende de**: —
      **RED**: `apps/web/src/features/editor/markdown-insert.test.ts` — casos de cadenas puras, sin
      `render` ni jsdom ni temporizadores: envolver `[0,4]` de `hola mundo` con `bold` da
      `**hola** mundo` y selección `[2,6]`; sin selección da `hola **texto en negrita**` con el
      marcador de posición seleccionado; una selección multilínea se envuelve entera sin partirse;
      los cuatro marcadores (`**`, `*`, `~~`, `` ` ``) son los del catálogo de `spec.md` §6.
      **GREEN**: `apps/web/src/features/editor/markdown-insert.ts` con `TextSelection`,
      `applyPaletteElement` y **solo** la rama `inline`. Las otras dos ramas pueden lanzar o quedar
      sin implementar; las cierran T-003 y T-004.
      **Artefactos**: `apps/web/src/features/editor/markdown-insert.ts` (nuevo) ·
      `apps/web/src/features/editor/markdown-insert.test.ts` (nuevo). Los tipos del elemento pueden
      vivir provisionalmente aquí y los mueve T-005 a `markdown-palette.ts`; si se mueven, es un
      refactor **dentro** de esta pareja de archivos.
      **DONE**: `pnpm --filter @one-markdown/web test markdown-insert`

- [x] **T-002** · `frontend` · Núcleo: enlace e imagen
      **AC**: AC-5, AC-6
      **Depende de**: T-001 (mismo archivo — **no paralelizar**)
      **RED**: ampliación de `markdown-insert.test.ts`: con selección, `link` sobre `[8,11]` de
      `mira la web` da `mira la [web](https://ejemplo.com)` con **la URL** seleccionada; sin
      selección da `[texto del enlace](https://ejemplo.com)` con el rótulo seleccionado; `image` con
      su plantilla y su `![…]`.
      **GREEN**: la marca `selectTargetWhenWrapping` en la rama `inline` de `markdown-insert.ts`.
      **Nota de la v0.1.2 (desviación ratificada)**: se implementó como `?: string` —el fragmento
      literal de `after` que queda seleccionado— y no como el `: true` que decía `plan.md` §4.2. Mismo
      nombre, dato explícito; el booleano obligaba a deducir el trozo de `after` analizando
      paréntesis. `plan.md` §4.2 ya recoge la firma real y el motivo.
      **Artefactos**: `apps/web/src/features/editor/markdown-insert.ts` ·
      `apps/web/src/features/editor/markdown-insert.test.ts`
      **DONE**: `pnpm --filter @one-markdown/web test markdown-insert`

- [x] **T-003** · `frontend` · Núcleo: prefijos de línea
      **AC**: AC-7, AC-8, AC-9, AC-10, AC-11
      **Depende de**: T-002 (mismo archivo — **no paralelizar**)
      **RED**: ampliación de `markdown-insert.test.ts`: prefijo al **principio de la línea** con el
      cursor desplazado el largo del prefijo; tres líneas seleccionadas reciben las tres su prefijo,
      y `numberedList` numera `1.`/`2.`/`3.`; las líneas **vacías** del rango no reciben nada y no
      cuentan para la numeración; `heading2` sobre `# ` da `## ` (no `## # `); `bulletList` sobre
      `- ` es idempotente; `taskList` sobre `- ` da `- [ ] `; cursor en línea vacía inserta prefijo
      **+ marcador de posición** seleccionado.
      **GREEN**: rama `linePrefix` de `markdown-insert.ts`, con `replaces` como expresión regular
      anclada y la numeración contando solo las líneas prefijadas.
      **Dos precisiones de la v0.1.2, ratificadas sobre lo implementado y con test**: (a) la regla es
      **cualquier selección no vacía**, no solo la multilínea —seleccionar tres letras de una línea
      prefija esa línea entera (AC-8)—; (b) «línea vacía» incluye las de **solo espacios o
      tabuladores**, que es un superconjunto de lo que decía la v0.1.1 y evita el `-    ` colgado que
      rompe la lista igual (AC-9).
      **Artefactos**: `apps/web/src/features/editor/markdown-insert.ts` ·
      `apps/web/src/features/editor/markdown-insert.test.ts`
      **DONE**: `pnpm --filter @one-markdown/web test markdown-insert`

- [x] **T-004** · `frontend` · Núcleo: bloques (código, tabla, separador)
      **AC**: AC-12, AC-13, AC-14, AC-15, **AC-35**
      **Depende de**: T-003 (mismo archivo — **no paralelizar**)
      **RED**: ampliación de `markdown-insert.test.ts`: `divider` en documento vacío da exactamente
      `---\n` **sin** líneas en blanco por delante; sobre `párrafo anterior` deja **una sola** línea
      en blanco arriba y abajo, y no crea una segunda cuando ya la había; `codeBlock` sin selección
      deja el hueco de lenguaje vacío y el cursor dentro de la valla, y con selección la mete dentro
      y la deja seleccionada; `table` inserta la plantilla literal de `spec.md` §6 (3 columnas × 2
      filas de cuerpo) con la primera celda de encabezado seleccionada.
      **GREEN**: rama `block` de `markdown-insert.ts`, con el corte en borde de línea y la
      normalización de separación **contando** los `\n` existentes, nunca concatenando `\n\n` a
      ciegas.
      **AC-35, añadido en la v0.1.2 sobre lo ya implementado.** El caso «bloque con selección activa»
      no estaba definido y la lectura literal de `spec.md` §3.D («el bloque sustituye la selección»)
      convertía un clic en «Separador» con un párrafo seleccionado en **borrado del párrafo**. La
      marca del catálogo es `consumesSelection` y **solo `codeBlock` la lleva a `true`**: tabla y
      separador respetan la selección y se abren detrás de ella. Cubierto por
      `markdown-insert.test.ts` y matado por la mutación **M26**.
      **Dos precisiones más de la v0.1.2, las dos ya implementadas y con test**: el bloque **siempre
      cierra su línea con `\n`** y la línea en blanco entera solo aparece del lado donde hay texto
      (regla única que satisface AC-12 y AC-13 a la vez); y sin selección, el corte va al **borde de
      línea más cercano al cursor con empate al inicio** —`plan.md` §4.2 decía «el más cercano» y no
      definía el empate—.
      **Artefactos**: `apps/web/src/features/editor/markdown-insert.ts` ·
      `apps/web/src/features/editor/markdown-insert.test.ts`
      **DONE**: `pnpm --filter @one-markdown/web test markdown-insert`

- [x] **T-005** · `frontend` · Catálogo de 16 elementos, guarda de pureza y de exhaustividad
      **AC**: AC-16, AC-17, AC-18
      **Depende de**: T-004
      **RED**: `apps/web/src/features/editor/markdown-palette.test.ts` — el catálogo tiene **16**
      entradas (**4 + 7 + 5**; la v0.1.1 decía 14 por un error aritmético), ids únicos, los tres
      grupos **con sus rótulos en castellano**, etiquetas en castellano y los atajos de `spec.md` §6;
      recorrerlo entero aplicando cada elemento a `{ text: '', selectionStart: 0, selectionEnd: 0 }`
      produce en **todos** los casos un texto distinto de `''` y una selección dentro de los límites
      del resultado; y **la guarda de pureza**: leyendo el código fuente de `markdown-insert.ts` y
      `markdown-palette.ts` con `readFileSync`, ninguno menciona `from 'react'`, `react-dom`,
      `zustand`, `./editor.store`, `document.` ni `window.` — mismo patrón que
      `apps/web/src/features/editor/no-dangerous-html.test.ts` de la `003`, que es el precedente a
      copiar literalmente.
      **GREEN**: `apps/web/src/features/editor/markdown-palette.ts` con los tipos del elemento
      (`PaletteElement`, `PaletteGroup`), **`PALETTE_GROUP_LABELS`** y el catálogo congelado. Si T-001
      dejó los tipos en `markdown-insert.ts`, se mueven aquí y `markdown-insert.ts` los importa.
      **`PALETTE_GROUP_LABELS` queda bendecido retroactivamente (v0.1.2).** El agente lo añadió por
      su cuenta y con test, adelantándose a T-006, y **es donde debe estar**: los rótulos «Formato» /
      «Bloques de texto» / «Insertar» son copia de interfaz en castellano, del mismo tipo que las
      etiquetas de los botones que ya viven aquí, y son el `aria-label` de cada `role="group"`
      (AC-24). T-006 los **consume**; no los declara ni los toca.
      **Artefactos**: `apps/web/src/features/editor/markdown-palette.ts` (nuevo) ·
      `apps/web/src/features/editor/markdown-palette.test.ts` (nuevo) ·
      `apps/web/src/features/editor/markdown-insert.ts` (el `import` de los tipos **y el comentario
      de cabecera**) · `apps/web/src/features/editor/markdown-insert.test.ts` (solo el `import`, si
      cambia)
      **Por qué la cabecera está ahora en la lista (v0.1.2, desviación ratificada).** La guarda de
      pureza de AC-17 lee el **código fuente** con `readFileSync` y **no distingue código de
      comentario**: el comentario de cabecera de `markdown-insert.ts` no podía seguir deletreando
      `zustand`, `document.` ni `window.` **ni en prosa**. Reescribirlo era parte de hacer pasar la
      guarda, no un extra, y la lista de artefactos («solo el `import` de los tipos») estaba mal. El
      agente lo reportó él mismo; el archivo era suyo desde T-001 y no hubo cambio de comportamiento.
      La lección, para quien vuelva a usar este patrón, está escrita entera en `spec.md` §9.6.
      **DONE**: `pnpm --filter @one-markdown/web test markdown-palette && pnpm --filter @one-markdown/web test markdown-insert`

- [x] **T-006** · `frontend` · `MarkdownPalette`: toolbar ARIA, roving tabindex y región viva
      **AC**: AC-24, AC-25, AC-27 (la mitad del componente)
      **Depende de**: T-005 · **paralelizable con T-009**
      **RED**: `apps/web/src/features/editor/MarkdownPalette.test.tsx` —
      `getByRole('toolbar', { name: 'Elementos de markdown' })`; tres `getAllByRole('group')` con sus
      `aria-label` («Formato», «Bloques de texto», «Insertar»); **16** `getAllByRole('button')` con
      nombre accesible en castellano y ningún `svg` contribuyendo al nombre; **una sola** parada de
      tabulación (`tabIndex=0` en uno, `-1` en **quince**); `ArrowRight`/`ArrowLeft` mueven
      `document.activeElement` en orden del catálogo **atravesando los grupos** y envolviendo por los
      extremos; `Home`/`End` van al primero y al último; activar con `Enter` y con `Espacio` llama a
      `onInsert` con el elemento correcto; tras insertar, un `role="status"` propio dice
      `Insertado: Negrita`.
      **GREEN**: `apps/web/src/features/editor/MarkdownPalette.tsx` según `plan.md` §4.4. Iconos
      `<svg aria-hidden="true" focusable="false">` en línea, sin dependencias. Clases de foco
      copiadas literalmente del repo (`outline-solid outline-0 focus-visible:outline-2 …`): en
      Tailwind 4, `outline-none` se hereda y mata el anillo.
      **Nota de implementación obligatoria (v0.1.2), medida con mutación — el orden sale del
      catálogo.** Tanto el orden de pintado como el recorrido de las flechas se derivan de
      **`MARKDOWN_PALETTE`**, agrupando el catálogo ya ordenado. **No** de
      `Object.keys(PALETTE_GROUP_LABELS)`: el orden del catálogo es contrato afirmado con test (la
      mutación **M41**, que lo reordena, mata tests), mientras que el orden de las claves de un objeto
      **no es contrato de nada** (la mutación **M38**, que reordena las claves de los rótulos,
      **sobrevive — y debe sobrevivir**). Montar la navegación con teclado sobre lo segundo la ata a
      un detalle que ningún test defiende.
      **Los tres `aria-label` de grupo se leen de `PALETTE_GROUP_LABELS`** (`markdown-palette.ts`,
      cerrado en T-005). Por eso AC-24 es alcanzable con esta lista de artefactos **sin** tocar el
      catálogo: T-006 **consume**, no declara. Si algo obliga a modificar `markdown-palette.ts`, se
      para y se reporta.
      **Artefactos**: `apps/web/src/features/editor/MarkdownPalette.tsx` (nuevo) ·
      `apps/web/src/features/editor/MarkdownPalette.test.tsx` (nuevo). **`markdown-palette.ts` no
      está en la lista a propósito**: se importa, no se toca.
      **DONE**: `pnpm --filter @one-markdown/web test MarkdownPalette`

- [x] **T-007** · `frontend` · Enganche en el editor: modo, `setDraft`, foco y selección real
      **AC**: AC-19, AC-20, AC-21, AC-22, AC-23, AC-26, AC-27 (la mitad de la página)
      **Depende de**: T-006
      **RED**: ampliación de `apps/web/src/features/editor/DocumentEditorPage.test.tsx` con un
      `describe` nuevo: la paleta está en modo texto y **no** en vista previa; una activación llama a
      `setDraft` una vez y deja `dirty` **sin** emitir petición; **tres** activaciones dentro de la
      misma ventana de 1.500 ms producen **una** petición `PUT` (`api.callsTo(PUT_ROUTE)` con
      longitud 1, contando peticiones y no espías); tras insertar,
      `document.activeElement === textarea` y sus `selectionStart`/`selectionEnd` **reales** son los
      del núcleo; con el documento **vacío** y sin foco previo, el contenido pasa de `''` a la
      plantilla; con un borrador por encima de `MAX_DOCUMENT_CONTENT_CHARS` la inserción **se aplica
      igual** y no aparece ninguna rama de bloqueo nueva; el orden de tabulación es conmutador →
      paleta → `<textarea>`; y los dos `role="status"` de la página (paleta y `SaveStatus`) **no se
      contienen** el uno al otro.
      **GREEN**: `apps/web/src/features/editor/DocumentEditorPage.tsx` según `plan.md` §4.3 —
      `textareaRef`, `pendingSelection` en un `ref`, `useLayoutEffect` que enfoca y aplica la
      selección, y `<MarkdownPalette>` **antes** del `tabpanel` y solo en modo texto.
      **`editor.store.ts` NO se toca**: la paleta llama a `setDraft` tal cual.
      **Artefactos**: `apps/web/src/features/editor/DocumentEditorPage.tsx` ·
      `apps/web/src/features/editor/DocumentEditorPage.test.tsx`
      **DONE**: `pnpm --filter @one-markdown/web test DocumentEditorPage`

- [x] **T-008** · `frontend` · Atajos `Ctrl`/`Cmd`+`B`/`I`/`K` acotados al área de texto
      **AC**: AC-28
      **Depende de**: T-007
      **RED**: ampliación de `DocumentEditorPage.test.tsx`: con el foco **en el `<textarea>`**, los
      tres atajos aplican negrita, cursiva y enlace y llaman a `preventDefault()`; con el foco
      **fuera** (por ejemplo en el botón «Guardar») no hacen nada; y `Ctrl`+`S` **sigue** guardando
      sin insertar nada — la regresión de la `003` hay que afirmarla, no suponerla.
      **GREEN**: `onKeyDown` **en el `<textarea>`** de `DocumentEditorPage.tsx` que despacha al
      elemento del catálogo cuyo `shortcut` coincide. **No** se toca el manejador de `window` de la
      `003`.
      **Artefactos**: `apps/web/src/features/editor/DocumentEditorPage.tsx` ·
      `apps/web/src/features/editor/DocumentEditorPage.test.tsx` ·
      `apps/web/src/features/editor/markdown-palette.ts` (solo si los `shortcut` del catálogo no
      quedaron cerrados en T-005; deberían haberlo quedado)
      **DONE**: `pnpm --filter @one-markdown/web test DocumentEditorPage`

- [x] **T-009** · `frontend` · Cada plantilla renderizada + tres cargas nuevas en el corpus de XSS
      **AC**: AC-30, AC-31
      **Depende de**: T-005 · **paralelizable con T-006, T-007 y T-008**
      **En curso desde el 2026-07-29, sin verificar por el orchestrator.** Recordatorio de la v0.1.2:
      son **16** elementos de catálogo que recorrer, no 14.
      **RED**: dos frentes.
      (a) `apps/web/src/features/editor/MarkdownPreview.test.tsx`, `describe` nuevo: para **cada**
      elemento del catálogo, el resultado de aplicarlo a un documento vacío, pasado por
      `MarkdownPreview`, produce el elemento HTML esperado (`h1`/`h2`/`h3`, `strong`, `em`, `del`,
      `code`, `pre > code`, `blockquote`, `ul`, `ol`, `input[type=checkbox]`, `a`, `img`, `table`,
      `hr`), **cero** elementos activos y **cero** atributos que empiecen por `on`; y una aserción de
      que la cadena de plugins del componente sigue siendo la de la `003` (`remark-gfm` +
      `rehypeRawAsText` + `rehype-sanitize`), es decir, que la `004` **no instaló nada**.
      (b) `apps/web/src/test/markdown-xss-corpus.ts`: tres cargas nuevas —bloque de código vallado
      con `<script>alert(1)</script>`; celda de tabla con `<img src=x onerror="alert(1)">`; elemento
      de lista de tareas con enlace `javascript:`— cada una con su `survives` **no vacío**. Las tres
      son alcanzables de un clic desde la paleta y **hoy el corpus no visita ninguno de los tres
      contenedores**: ese es el motivo, y va escrito en el comentario de cada carga.
      **GREEN**: subir la guarda `toBeGreaterThanOrEqual(10)` a `15` **en los dos archivos que la
      afirman**: `apps/web/src/features/editor/MarkdownPreview.test.tsx:204` y
      `apps/web/e2e/editor.spec.ts:260`. Son 12 + 3 = 15. **Olvidar la segunda es el error que esta
      tarea existe para no cometer**: la guarda está duplicada a propósito para que jsdom y navegador
      no puedan divergir, y moverla en un solo sitio rompe justo esa garantía.
      **`MarkdownPreview.tsx` NO se toca.** Si algo obliga a tocarlo, se para y se reporta: sería un
      cambio en la cadena de saneado, que exige volver a medir (`003/plan.md` §2.2.1).
      **Artefactos**: `apps/web/src/features/editor/MarkdownPreview.test.tsx` ·
      `apps/web/src/test/markdown-xss-corpus.ts` · `apps/web/e2e/editor.spec.ts` (**solo** la línea
      de la guarda)
      **DONE**: `pnpm --filter @one-markdown/web test MarkdownPreview` y, para la guarda del e2e,
      `pnpm --filter @one-markdown/web exec playwright test editor`

- [x] **T-010** · `frontend` · Navegador: recorrido solo con teclado, tamaño de objetivo y presupuesto
      **Cerrada y verificada el 2026-07-29.** Destapó que **AC-33 era autocontradictorio** (ver el
      CHANGELOG de la v0.2.1): el criterio pedía una cifra por corrida y mandaba medirla con un
      comando que triplica el gasto dentro de la misma ventana de 60 s. **El defecto es de la spec y
      venía de la `003`, no lo introduce esta tarea**; el AC quedó partido en dos ventanas con dos
      comandos y la tarea se da por cumplida contra el AC corregido.
      **AC**: AC-29, AC-32, AC-33, AC-34
      **Depende de**: T-008 y T-009
      **RED**: `apps/web/e2e/palette.spec.ts` (nuevo), con el **mismo** *fixture* automático que
      `editor.spec.ts`: `Promise.all([resetLoginThrottleCounter(), resetWorkspaceThrottleCounter()])`
      y `signIn(page)`. **`documentContent` no se resetea nunca.** Un caso, dos afirmaciones:
      (a) recorrido **solo con teclado** —`Tab` hasta la paleta, **recorrerla con las flechas y
      volver a «Negrita»** (`→` Cursiva, `→` Tachado, `←` `←` Negrita: la parada del tabulador **ya
      es** «Negrita», así que sin ida y vuelta el paso mediría dónde arranca el foco y no la
      navegación), `Enter`, escribir el texto, `Ctrl`+`S`—, **recargar** la página y ver el texto
      dentro de un `<strong>` en la vista previa;
      (b) cada botón de la paleta mide ≥ 24 × 24 px CSS por `boundingBox()`, y el botón enfocado
      tiene indicador de foco visible.
      El caso agrupa sus inserciones **dentro de una sola ventana de debounce** y fuerza **un**
      guardado: la política es gastar menos, no neutralizar más.
      **GREEN**: nada de producción. Si algo falla aquí, el arreglo va en la tarea que lo introdujo,
      no en esta.
      **Verificación adicional obligatoria de esta tarea** (AC-33 y AC-34), con la salida real
      reportada, no resumida:
      1. **AC-33(b)** — `pnpm --filter @one-markdown/web exec playwright test --retries=2
         --repeat-each=3` → verde y **sin un solo `429`**. **Corregido en la v0.2.1**: aquí **no** se
         exige la cifra «< 10 de 120», porque este comando suma las tres repeticiones dentro de la
         misma ventana de 60 s del throttler (medido: **15**; sin el caso nuevo, **12** — o sea que
         el criterio ya no se cumplía antes de esta tarea).
      1bis. **AC-33(a)** — `pnpm --filter @one-markdown/web test:e2e` con sondeo de
         `throttle:documentContent:{sha256(ip)}` en Redis cada 300 ms → pico **< 10 de 120**.
         Medido: **5** (baseline `003` = 4, y el caso nuevo añade exactamente 1).
      2. `pnpm test && pnpm typecheck && pnpm lint` en el monorepo → `packages/shared` **81**,
         api unit **305**, api e2e **511**, los mismos números con los que cerró la `003`.
      3. `git status --short` → ni un solo archivo tocado fuera de `apps/web/**`, `specs/**` e
         `IMPLEMENTATION.md`.
      **Artefactos**: `apps/web/e2e/palette.spec.ts` (nuevo). **Ningún otro.**
      **DONE**: `pnpm --filter @one-markdown/web exec playwright test palette` y los comandos de
      arriba
      **DEUDA ANOTADA AL CERRAR**: `watchConsole` queda **duplicado** entre `editor.spec.ts` y
      `palette.spec.ts`, y es consecuencia directa de que esta lista de artefactos sea **un solo
      archivo** (ampliarla habría metido la tarea en `editor.spec.ts`, prohibido en la ola 4). Van
      dos copias, **ya divergidas en firma**; se extrae a `e2e/support/` **a la tercera**, y eso es
      de la `005` (§4 de `spec.md`).

- [x] **T-011** · `frontend` · Regiones vivas con nombre, montadas siempre y que reanuncian — 2026-07-29
      **AC**: **AC-27** (reescrito en la v0.2.0) y **AC-36** (nuevo)
      **Depende de**: T-007 por el código · **se despacha después de T-010**, ver «Secuencia» abajo
      **Es la única tarea de la spec autorizada a tocar un archivo de producción de la `003`**
      (`SaveStatus.tsx`), y lo toca **añadiendo un `aria-label`**: ni una línea de comportamiento.

      **Por qué existe.** AC-27 se implementó según su letra y la letra estaba mal. La región viva de
      la paleta aparece **con su primer anuncio dentro**, y un lector de pantalla anuncia los
      **cambios** de una región viva que ya conocía, no su aparición: en NVDA y JAWS ese primer
      anuncio puede no oírse nunca. El AC estaba **verde en CI y era falso** justo para las personas
      para las que existe. Y un problema hermano que ningún AC cubría: **insertar dos veces el mismo
      elemento no vuelve a anunciar**, porque escribir el mismo texto no muta el DOM.

      **RED** — se escribe **antes** de tocar producción y **falla por aserción**, no por resolución
      de módulo (todos los archivos existen ya; ver `spec.md` §9.7):
      1. `apps/web/src/features/editor/MarkdownPalette.test.tsx` —
         (a) **al primer render y sin haber insertado nada**,
         `getByRole('status', { name: 'Elemento insertado' })` **existe** y su contenido está
         **vacío**. Esto **invierte** el caso «anuncia … y solo tras insertar», que hoy afirma
         `queryByRole('status')).not.toBeInTheDocument()`: esa aserción era la traducción fiel del
         AC anterior y se sustituye entera, no se añade otra al lado;
         (b) **AC-36**: un `MutationObserver` sobre esa región; dos activaciones **idénticas** de
         «Negrita» producen **≥ 2** registros de cambio y el contenido final **contiene**
         `Insertado: Negrita`. El observador **acumula en su callback** y **cierra con
         `takeRecords()`** antes de contar, para no dejarse fuera un último lote sin depender de
         `waitFor` ni del reloj falso.
         _(Redacción corregida en la **v0.3.0**. La v0.2.0 pedía contar «con `takeRecords()` **y no**
         con el callback», y eso **no es implementable**: medido con una sonda de callback vacío, la
         salida fue `registros solo con takeRecords(): 0`, y lo sería con **cualquier** mecanismo,
         porque la cola del observador se entrega en **cada** punto de comprobación de microtareas y
         `await user.click()` cruza varios. Ver AC-36.)_
         _Fallo esperado_: **el mismo en (a) y en (b)** —
         `Unable to find an accessible element with the role "status" and name "Elemento insertado"`.
         _(Corregido en la **v0.3.0**: la v0.2.0 predijo para (b) «**1** registro en vez de 2», y
         **no es lo que ocurre**. El caso (b) revienta **antes** de llegar a su propia aserción,
         al buscar la región, porque con la región perezosa no hay nada que encontrar: los dos
         subcasos dependen de la **misma** precondición que falta, así que fallan igual. El «1 en vez
         de 2» **sí existe**, pero como **mutación (c)** sobre producción ya corregida —devolver el
         reanuncio a escribir siempre el mismo texto— y ahí sale literalmente
         `expected 1 to be greater than or equal to 2`. **La lección, que va más allá de esta tarea**:
         predecir el rojo de un subcaso dando por bueno que el anterior pasa es predecir mal; cuando
         dos aserciones cuelgan de la misma precondición ausente, el RED de las dos es el de la
         precondición, y el fallo «interesante» solo aparece como mutación.)_
      2. `apps/web/src/features/editor/DocumentEditorPage.test.tsx` —
         (a) las **cuatro** consultas `getByRole('status')` sueltas pasan a
         `getByRole('status', { name: 'Estado del guardado' })`;
         (b) el helper `liveRegions()` deja de discriminar **por el texto** (`startsWith('Insertado:')`,
         que con la región vacía ya no distingue nada) y pasa a hacerlo **por nombre accesible**;
         (c) el caso de AC-27 comprueba además que la región de la paleta **está montada y vacía
         antes** de insertar, y las dos siguen sin contenerse.
         _Fallo esperado_: `Unable to find an accessible element with the role "status" and name
         "Estado del guardado"`.
      3. `apps/web/e2e/editor.spec.ts` — las **dos** `page.getByRole('status')` pasan a
         `page.getByRole('status', { name: 'Estado del guardado' })`. Son **dos líneas** y ninguna
         aserción se relaja.
         _Fallo esperado_: el locator resuelve a **0** elementos.
         _(Y si se implementara producción sin tocar estas dos líneas, el fallo sería el otro:
         **violación de modo estricto** con dos `status` en la página. Es el motivo de que esta tarea
         no se pueda partir en dos.)_

      **GREEN**:
      - `apps/web/src/features/editor/SaveStatus.tsx`: `aria-label="Estado del guardado"` en su
        `p[role="status"]`. **Nada más.** El `role="alert"` **no** se toca: es único en la página y se
        consulta por rol sin ambigüedad.
      - `apps/web/src/features/editor/MarkdownPalette.tsx`: la región se pinta **siempre** (contenido
        `''` mientras no haya nada que anunciar) y lleva `aria-label="Elemento insertado"`. El
        `inserted === null ? null : …` desaparece.
      - **Reanuncio (AC-36)**: hace falta un **cambio observable** de la región entre un anuncio y el
        siguiente. Dos mecanismos aceptables: vaciarla y volver a escribirla en **dos commits**
        distintos, o hacer que el texto difiera de forma imperceptible entre anuncios consecutivos.
        **La spec no impone cuál**: el test observa que **la región cambió**, no el truco. El agente
        **reporta cuál eligió y por qué**, y si el mecanismo que elige no sobrevive a
        `takeRecords()`, **para y reporta** en vez de rebajar la aserción a comprobar el mecanismo.

        **Mecanismo elegido y ratificado en la v0.3.0: alternar un `U+200B`** (espacio de ancho cero)
        al final del texto entre anuncios consecutivos. Es **síncrono y de un solo render**, y las
        dos alternativas se descartaron con motivo, no por gusto:
        - **Un espacio normal, no**: el whitespace es justo lo que colapsan `textContent`, jest-dom,
          Playwright y el propio cálculo de texto de un lector. Una diferencia hecha **solo** de
          whitespace es la más fácil de que se normalice hasta desaparecer **en el consumidor al que
          va dirigida**, que es el peor sitio donde puede desaparecer.
        - **Vaciar y reescribir, no**: React agrupa las dos actualizaciones del mismo manejador en un
          solo render, así que el paso por vacío solo existe con `flushSync` —un render extra forzado
          por un detalle de accesibilidad— o con un temporizador, que saca el segundo cambio del
          alcance síncrono con el que AC-36 se verifica.

        **Consecuencia ratificada**: tras un número **par** de anuncios el `textContent` real es
        `Insertado: Negrita` **más el `U+200B`**. No se pinta y no se locuta, y `toHaveTextContent`
        lo da por bueno, pero **no es literalmente igual** a la cadena del AC. Se ajusta **el AC**
        —afirma por contención— y no el mecanismo: pedir igualdad literal devolvería el dilema de
        `flushSync`/temporizador a cambio de nada que un lector note.

      **Lo que esta tarea NO hace**: no toca `DocumentEditorPage.tsx` (el orden del DOM y el montaje
      de la paleta ya son los de T-007), no toca `editor.store.ts`, no toca `markdown-palette.ts` ni
      el núcleo, y **no** renombra ni añade regiones vivas fuera de la página del editor
      (`RequireAuth.tsx` y `SecurityPage.tsx` tienen las suyas, en otras páginas, y sus tests siguen
      consultando por rol a secas con razón: ahí solo hay una).

      **Secuencia, y por qué no va en paralelo con T-010.** Sobre el papel los archivos son disjuntos
      —T-010 solo crea `e2e/palette.spec.ts`—, pero T-010 corre `playwright test` sobre **todo** el
      directorio y mide con él el presupuesto de cupo de AC-33. Editar `editor.spec.ts` mientras esas
      medidas se están tomando las invalida. **T-011 se despacha cuando T-010 esté cerrada**, y
      vuelve a correr el e2e de editor para dejar su cifra propia.

      **Artefactos** (cinco, y ninguno más): `apps/web/src/features/editor/MarkdownPalette.tsx` ·
      `apps/web/src/features/editor/MarkdownPalette.test.tsx` ·
      `apps/web/src/features/editor/SaveStatus.tsx` (**solo** el `aria-label`) ·
      `apps/web/src/features/editor/DocumentEditorPage.test.tsx` (**solo** las consultas de `status`
      y el helper `liveRegions`) · `apps/web/e2e/editor.spec.ts` (**solo** las dos líneas del
      locator).
      **DONE**: `pnpm --filter @one-markdown/web test MarkdownPalette` ·
      `pnpm --filter @one-markdown/web test DocumentEditorPage` ·
      `pnpm --filter @one-markdown/web test` (los 19 archivos, con el total re-medido) ·
      `pnpm --filter @one-markdown/web exec playwright test editor` · `pnpm typecheck` · `pnpm lint`

- [x] **T-012** · `frontend` · El último locator que distinguía las regiones vivas por contenido — 2026-07-29
      **AC**: **AC-27** (no añade ninguno; lo cierra donde seguía incumplido)
      **Depende de**: T-011 (necesita el nombre accesible que T-011 introduce)
      **Tarea nueva de la v0.3.0**, y la razón de que esa versión sea **minor**: no trae AC nuevo,
      pero mueve el recuento de tareas de 11 a 12.

      **Por qué existe, y por qué no se dejó como deuda de la `005`.** `e2e/palette.spec.ts` lo creó
      **T-010**, es decir **antes** de que existiera el nombre accesible, y desambiguaba las dos
      regiones vivas **por contenido**:
      `getByRole('status').filter({ hasText: /^(Guardado|Guardando…|Cambios sin guardar|Sin guardar)$/ })`.
      Resolvía a un solo elemento y el archivo pasaba verde. Aplazarlo era barato y habría sido un
      error, por tres razones y ninguna estética:
      1. **AC-27 dice literalmente «se distinguen por nombre y no por lo que dicen en ese momento»**,
         así que este locator era el único punto del repositorio que contradecía el AC que la propia
         spec acababa de reescribir.
      2. **El locator viejo es inmune a la mutación que borra el `aria-label`.** `filter({ hasText })`
         compara contra el texto renderizado y **no lee** `aria-label`: si alguien retira el nombre
         accesible, `palette.spec.ts` sigue verde. Un test que no puede fallar cuando su criterio se
         rompe no está verificando ese criterio.
      3. **Es un archivo de esta spec**, no herencia de la `003`. Cerrar la `004` dejando un apaño en
         un artefacto que la `004` creó, y que existe **solo** porque el nombre todavía no estaba, es
         exactamente la clase de arqueología que las cinco fases anteriores han pagado.

      **No hay RED clásico, y decirlo es parte de la tarea.** El comportamiento ya lo implementó
      T-011 y el locator nuevo pasa a la primera; escribir un rojo artificial sería teatro. Lo que
      sustituye al RED es una **mutación obligatoria**, que es la pregunta que el RED contesta
      —«¿puede esta aserción ponerse roja?»— hecha directamente.

      **GREEN**: en `e2e/palette.spec.ts`, la constante `SAVE_STATE_TEXT` (la expresión regular de los
      cuatro rótulos) pasa a `SAVE_REGION_NAME = 'Estado del guardado'` —mismo nombre y misma forma
      que en `editor.spec.ts`, para que las dos suites llamen igual a la misma región— y el locator
      pasa a `page.getByRole('status', { name: SAVE_REGION_NAME })`. **Ninguna aserción se relaja ni
      se borra.**

      **Artefactos** (uno, y ninguno más): `apps/web/e2e/palette.spec.ts`. `SaveStatus.tsx` se toca
      **temporalmente** para la mutación y se restaura byte a byte.

      **DONE**:
      `pnpm --filter @one-markdown/web exec playwright test palette` (verde) ·
      **mutación**: borrar el `aria-label` de `SaveStatus.tsx` → el mismo comando **en rojo por el
      locator**, restaurar, verde otra vez ·
      `pnpm --filter @one-markdown/web lint` · `pnpm --filter @one-markdown/web typecheck`

      **Verificado**: verde en 2.2 s; con el `aria-label` borrado, rojo con `element(s) not found` en
      `await expect(saveStatus).toHaveText('Guardado')`, que es la **primera** aserción sobre la
      región; restaurado y verde. Lint y typecheck limpios.
      _Media medida y no entera, dicho aquí para que nadie lo lea como más de lo que es_: que el
      locator **viejo** siguiera verde bajo esa misma mutación **no se midió** —cada corrida gasta un
      `PUT` del cupo de `documentContent`, que no se resetea—. Se sigue por construcción
      (`filter({ hasText })` no lee `aria-label`), y queda escrito como deducción, no como medición.

---

## Reparto y paralelismo

| Tarea | Agente | Depende de | Puede ir en paralelo con |
|---|---|---|---|
| T-001 | `frontend` | — | — |
| T-002 | `frontend` | T-001 | — (mismo archivo) |
| T-003 | `frontend` | T-002 | — (mismo archivo) |
| T-004 | `frontend` | T-003 | — (mismo archivo) |
| T-005 | `frontend` | T-004 | — |
| T-006 | `frontend` | T-005 | **T-009** |
| T-007 | `frontend` | T-006 | **T-009** |
| T-008 | `frontend` | T-007 | **T-009** |
| T-009 | `frontend` | T-005 | **T-006, T-007, T-008** |
| T-010 | `frontend` | T-008, T-009 | — |
| T-011 | `frontend` | T-007 (código) y **T-010** (calendario) | — |
| T-012 | `frontend` | **T-011** (necesita el nombre accesible) | — |

Solo hay **una** oportunidad real de paralelismo: la rama T-006 → T-007 → T-008 contra T-009. Las
cuatro primeras tareas comparten archivo y lanzarlas a la vez es garantizar conflictos.

**T-011 y T-012 van las últimas y solas.** T-011 depende de T-007 por el código, pero se despacha
después de **T-010** por un motivo de calendario y no de archivos: T-010 corre `playwright test`
sobre **todo** el directorio de e2e para medir el presupuesto de AC-33, y T-011 edita
`editor.spec.ts`. Tocar el directorio mientras se toman esas medidas las invalida. **T-012 va detrás
de T-011 por dependencia real**: su locator busca el nombre accesible que T-011 introduce, así que
antes de T-011 no resolvería a nada.

**Y una consecuencia de calendario que la v0.3.0 pagó**: como T-012 vuelve a tocar `e2e/`, **la
re-medición de cierre que se hizo antes de T-012 queda obsoleta** y hay que repetirla después. Es la
misma regla que puso a T-011 detrás de T-010, aplicada al último eslabón.

---

## Lo que ninguna tarea puede tocar

Escrito como lista cerrada, porque las tres cosas vienen con instrucciones explícitas de la `003`:

1. **`apps/web/src/features/editor/MarkdownPreview.tsx`** y su cadena de plugins. `rehype-sanitize`
   **no es redundante**: es la única capa que defiende los protocolos de `src`, medido con una
   mutación. Y las capas 1 y 2 siguen **sin un rojo propio**: una capa no se retira porque ningún
   test la eche de menos. Añadir un plugin obliga a volver a medir el modelo de amenaza entero.
2. **`apps/web/src/features/editor/editor.store.ts`**. La paleta usa `setDraft` tal cual; ese es el
   contrato que la `003` cerró y la invariante que hace que la inserción herede el debounce, la
   coalescencia y el marcado de sucio sin código nuevo.
3. **`packages/shared/**` y `apps/api/**`.** Ni una línea (AC-34).

**Una excepción, y una sola, añadida por la v0.2.0**: `apps/web/src/features/editor/SaveStatus.tsx`
—que es producción de la `003`— lo toca **T-011 y nadie más**, para añadirle un `aria-label` a su
`role="status"`. Es un nombre accesible, no un cambio de comportamiento: sus textos, sus estados y su
pareja `status`/`alert` se quedan exactamente como están. Cualquier otra tarea que se vea obligada a
abrir ese archivo **para y reporta**.

Y una lista corta de lo que tampoco se toca porque no hay motivo, y tocarlo sería señal de que algo
se torció: `apps/web/src/test/workspace-fixtures.ts`, `auth-fixtures.ts`, `api-stub.ts`, `setup.ts`,
`vite.config.ts`, `playwright.config.ts`, `apps/web/e2e/support/**` y cualquier `package.json`.

---

## Definition of Done (todas las tareas)

1. El test se escribió primero y **falló primero** (el agente reporta la salida del RED).
2. Cada AC de la spec tiene al menos un test automatizado.
3. Backend: **no aplica** — esta spec no añade ninguna entrada ni ninguna salida de API. La regla
   dura de `CLAUDE.md` se satisface por omisión, y AC-34 lo verifica.
4. Cero `any` (`@typescript-eslint/no-explicit-any` es `error` en el repo). En los tests, `unknown` +
   estrechamiento, como ya hace `DocumentEditorPage.test.tsx`.
5. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan, corridos **desde estado limpio**
   (`rm -rf packages/shared/dist` y dejar que el flujo lo reconstruya).
6. `IMPLEMENTATION.md` actualizado **por el orchestrator** con el comando de verificación y su
   salida real. Los agentes de implementación no lo editan.

Y una regla operativa que las cinco fases anteriores han pagado por aprender: **un fallo que no se
reproduce no es transitorio hasta que se explica por qué desapareció.**
