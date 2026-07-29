# Tareas 004 — Paleta de elementos markdown insertables

Spec: `spec.md` **v0.1.1** (**approved**) · Plan: `plan.md`

**Las diez tareas quedan exactamente igual que en la v0.1.0.** Las seis decisiones abiertas de
`spec.md` §8 se resolvieron el 2026-07-28 **todas en la opción recomendada**, así que ningún AC
cambió de redacción, ningún artefacto entró ni salió y ninguna tarea se movió. La única resolución
que añade trabajo (la **B**, la pila de deshacer) lo añade **fuera de esta spec**: queda planificada
en `spec.md` §9 y asignada a la spec **`006-editor-undo`**. **Aquí no hay nada nuevo que hacer.**

Cada tarea es atómica, se asigna a un agente y sigue RED → GREEN → REFACTOR.
El test se escribe primero y **debe fallar antes** de implementar; el agente reporta el fallo inicial.

**Las diez tareas son de `frontend`.** No hay ninguna de `backend` porque la spec no toca
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

- [ ] **T-001** · `frontend` · Núcleo de inserción: tipos, despacho y familia que envuelve
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

- [ ] **T-002** · `frontend` · Núcleo: enlace e imagen
      **AC**: AC-5, AC-6
      **Depende de**: T-001 (mismo archivo — **no paralelizar**)
      **RED**: ampliación de `markdown-insert.test.ts`: con selección, `link` sobre `[8,11]` de
      `mira la web` da `mira la [web](https://ejemplo.com)` con **la URL** seleccionada; sin
      selección da `[texto del enlace](https://ejemplo.com)` con el rótulo seleccionado; `image` con
      su plantilla y su `![…]`.
      **GREEN**: la marca `selectTargetWhenWrapping` en la rama `inline` de `markdown-insert.ts`.
      **Artefactos**: `apps/web/src/features/editor/markdown-insert.ts` ·
      `apps/web/src/features/editor/markdown-insert.test.ts`
      **DONE**: `pnpm --filter @one-markdown/web test markdown-insert`

- [ ] **T-003** · `frontend` · Núcleo: prefijos de línea
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
      **Artefactos**: `apps/web/src/features/editor/markdown-insert.ts` ·
      `apps/web/src/features/editor/markdown-insert.test.ts`
      **DONE**: `pnpm --filter @one-markdown/web test markdown-insert`

- [ ] **T-004** · `frontend` · Núcleo: bloques (código, tabla, separador)
      **AC**: AC-12, AC-13, AC-14, AC-15
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
      **Artefactos**: `apps/web/src/features/editor/markdown-insert.ts` ·
      `apps/web/src/features/editor/markdown-insert.test.ts`
      **DONE**: `pnpm --filter @one-markdown/web test markdown-insert`

- [ ] **T-005** · `frontend` · Catálogo de 14 elementos, guarda de pureza y de exhaustividad
      **AC**: AC-16, AC-17, AC-18
      **Depende de**: T-004
      **RED**: `apps/web/src/features/editor/markdown-palette.test.ts` — el catálogo tiene 14
      entradas, ids únicos, los tres grupos, etiquetas en castellano y los atajos de `spec.md` §6;
      recorrerlo entero aplicando cada elemento a `{ text: '', selectionStart: 0, selectionEnd: 0 }`
      produce en **todos** los casos un texto distinto de `''` y una selección dentro de los límites
      del resultado; y **la guarda de pureza**: leyendo el código fuente de `markdown-insert.ts` y
      `markdown-palette.ts` con `readFileSync`, ninguno menciona `from 'react'`, `react-dom`,
      `zustand`, `./editor.store`, `document.` ni `window.` — mismo patrón que
      `apps/web/src/features/editor/no-dangerous-html.test.ts` de la `003`, que es el precedente a
      copiar literalmente.
      **GREEN**: `apps/web/src/features/editor/markdown-palette.ts` con los tipos del elemento
      (`PaletteElement`, `PaletteGroup`) y el catálogo congelado. Si T-001 dejó los tipos en
      `markdown-insert.ts`, se mueven aquí y `markdown-insert.ts` los importa.
      **Artefactos**: `apps/web/src/features/editor/markdown-palette.ts` (nuevo) ·
      `apps/web/src/features/editor/markdown-palette.test.ts` (nuevo) ·
      `apps/web/src/features/editor/markdown-insert.ts` (solo el `import` de los tipos) ·
      `apps/web/src/features/editor/markdown-insert.test.ts` (solo el `import`, si cambia)
      **DONE**: `pnpm --filter @one-markdown/web test markdown-palette && pnpm --filter @one-markdown/web test markdown-insert`

- [ ] **T-006** · `frontend` · `MarkdownPalette`: toolbar ARIA, roving tabindex y región viva
      **AC**: AC-24, AC-25, AC-27 (la mitad del componente)
      **Depende de**: T-005 · **paralelizable con T-009**
      **RED**: `apps/web/src/features/editor/MarkdownPalette.test.tsx` —
      `getByRole('toolbar', { name: 'Elementos de markdown' })`; tres `getAllByRole('group')` con sus
      `aria-label`; 14 `getAllByRole('button')` con nombre accesible en castellano y ningún `svg`
      contribuyendo al nombre; **una sola** parada de tabulación (`tabIndex=0` en uno,
      `-1` en trece); `ArrowRight`/`ArrowLeft` mueven `document.activeElement` en orden del catálogo
      **atravesando los grupos** y envolviendo por los extremos; `Home`/`End` van al primero y al
      último; activar con `Enter` y con `Espacio` llama a `onInsert` con el elemento correcto; tras
      insertar, un `role="status"` propio dice `Insertado: Negrita`.
      **GREEN**: `apps/web/src/features/editor/MarkdownPalette.tsx` según `plan.md` §4.4. Iconos
      `<svg aria-hidden="true" focusable="false">` en línea, sin dependencias. Clases de foco
      copiadas literalmente del repo (`outline-solid outline-0 focus-visible:outline-2 …`): en
      Tailwind 4, `outline-none` se hereda y mata el anillo.
      **Artefactos**: `apps/web/src/features/editor/MarkdownPalette.tsx` (nuevo) ·
      `apps/web/src/features/editor/MarkdownPalette.test.tsx` (nuevo)
      **DONE**: `pnpm --filter @one-markdown/web test MarkdownPalette`

- [ ] **T-007** · `frontend` · Enganche en el editor: modo, `setDraft`, foco y selección real
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

- [ ] **T-008** · `frontend` · Atajos `Ctrl`/`Cmd`+`B`/`I`/`K` acotados al área de texto
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

- [ ] **T-009** · `frontend` · Cada plantilla renderizada + tres cargas nuevas en el corpus de XSS
      **AC**: AC-30, AC-31
      **Depende de**: T-005 · **paralelizable con T-006, T-007 y T-008**
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

- [ ] **T-010** · `frontend` · Navegador: recorrido solo con teclado, tamaño de objetivo y presupuesto
      **AC**: AC-29, AC-32, AC-33, AC-34
      **Depende de**: T-008 y T-009
      **RED**: `apps/web/e2e/palette.spec.ts` (nuevo), con el **mismo** *fixture* automático que
      `editor.spec.ts`: `Promise.all([resetLoginThrottleCounter(), resetWorkspaceThrottleCounter()])`
      y `signIn(page)`. **`documentContent` no se resetea nunca.** Un caso, dos afirmaciones:
      (a) recorrido **solo con teclado** —`Tab` hasta la paleta, flechas hasta «Negrita», `Enter`,
      escribir el texto, `Ctrl`+`S`—, **recargar** la página y ver el texto dentro de un `<strong>`
      en la vista previa;
      (b) cada botón de la paleta mide ≥ 24 × 24 px CSS por `boundingBox()`, y el botón enfocado
      tiene indicador de foco visible.
      El caso agrupa sus inserciones **dentro de una sola ventana de debounce** y fuerza **un**
      guardado: la política es gastar menos, no neutralizar más.
      **GREEN**: nada de producción. Si algo falla aquí, el arreglo va en la tarea que lo introdujo,
      no en esta.
      **Verificación adicional obligatoria de esta tarea** (AC-33 y AC-34), con la salida real
      reportada, no resumida:
      1. `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` → verde,
         **sin un solo `429`**, y el pico de `documentContent` medido y **< 10 de 120**.
      2. `pnpm test && pnpm typecheck && pnpm lint` en el monorepo → `packages/shared` **81**,
         api unit **305**, api e2e **511**, los mismos números con los que cerró la `003`.
      3. `git status --short` → ni un solo archivo tocado fuera de `apps/web/**`, `specs/**` e
         `IMPLEMENTATION.md`.
      **Artefactos**: `apps/web/e2e/palette.spec.ts` (nuevo). **Ningún otro.**
      **DONE**: `pnpm --filter @one-markdown/web exec playwright test palette` y los tres comandos de
      arriba

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

Solo hay **una** oportunidad real de paralelismo: la rama T-006 → T-007 → T-008 contra T-009. Las
cuatro primeras tareas comparten archivo y lanzarlas a la vez es garantizar conflictos.

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
