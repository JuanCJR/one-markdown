# Plan 004 — Paleta de elementos markdown insertables

Spec de referencia: `spec.md` **v0.1.1** (**approved** el 2026-07-28, con las seis decisiones de su
§8 resueltas en la opción recomendada). El plan **no cambió** con la aprobación: ninguna resolución
movió un contrato, un artefacto ni un AC.

---

## 1. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|---|---|---|
| 1 | **Solo `apps/web`.** `packages/shared` y `apps/api` no reciben ni una línea | Catálogo en `packages/shared`; endpoint de favoritos/recientes | El servidor guarda el contenido como texto opaco y no interpreta markdown en ningún punto; el catálogo es copia de interfaz sin un solo consumidor de servidor. El precio de equivocarse está medido: un cambio en `shared` deja `apps/api` en rojo de compilación hasta que aterriza la tarea de DTO —así que esas tareas no se paralelizan— y el radio incluye los **fixtures de test de los dos paquetes**, que se encuentran por el nombre del **tipo** y no por el del endpoint. A la `002` se le quedó corto dos veces por eso. Aquí no se compra ese coste a cambio de nada. Razonamiento completo en `spec.md` §7; AC-34 lo verifica |
| 2 | **Núcleo puro separado del adaptador.** `markdown-insert.ts` es una función de `(estado de selección, elemento) → (estado de selección)`; no importa React, ni el store, ni menciona `document` | Manipular el `<textarea>` directamente desde el manejador del clic con `setRangeText` | Es la frontera de hexagonal aplicada al frontend: dominio puro dentro, adaptador fuera. Y tiene un beneficio concreto e inmediato: los ~40 casos de §3.A-D de la spec son de **cadenas**, sin `render`, sin jsdom, sin temporizadores falsos — se escriben y corren en milisegundos, y no pueden ponerse en rojo por un cambio de interfaz. Precedente en el repo: `contentBytesOf` de la `003` (`T-002`), que también se verificó comprobando que no importaba nada de su entorno |
| 3 | **No se usa `setRangeText` pese a que `003/spec.md` §4 lo daba por el camino** | `element.setRangeText(...)` en el manejador | `setRangeText` muta el `value` del DOM **por fuera** de React. En un `<textarea>` controlado, React sobrescribe ese valor en el render siguiente con lo que diga el estado, así que o se duplica la lógica o se pelean. La forma correcta con un control controlado es: calcular la cadena nueva → `setDraft` → restaurar la selección tras el render. La `003` no se equivocó al decir que la API estaba disponible; simplemente el camino limpio resultó ser otro, y se escribe aquí para que nadie lo «arregle» de vuelta |
| 4 | **La selección se restaura en un `useLayoutEffect`, no en el manejador del clic** | `setSelectionRange` justo después de `setDraft`; `requestAnimationFrame`; `setTimeout(0)` | React documenta que un `<textarea>` controlado al que se le asigna un valor distinto de `e.target.value` **manda el caret al final**. Llamar a `setSelectionRange` antes de que el valor nuevo aterrice en el DOM no sirve de nada: lo pisa el render. `useLayoutEffect` corre **después** del commit y **antes** del repintado, así que la persona nunca ve el caret en el sitio equivocado. Un `setTimeout` lo dejaría ver un fotograma |
| 5 | **`role="toolbar"` con roving tabindex**, no una lista de botones ni un `menu` | Catorce `<button>` sueltos; `role="menubar"` + `role="menuitem"`; un `<select>` | Catorce paradas de tabulación entre el conmutador de vista y el área de escritura es una barrera real para quien navega con teclado. `menubar` es el patrón de **menús desplegables** y trae expectativas (submenús, `Escape`, activación con letra) que aquí no se cumplen. `toolbar` es literalmente el patrón de «conjunto de controles agrupados que actúan sobre otra cosa». Y hay dos precedentes de roving en el propio repo de los que copiar el idiom: el `tablist` de `DocumentEditorPage` y el `role="tree"` de `WorkspaceTreeView` |
| 6 | **Sin `Ctrl`+`Z` agrupado** (la `003` lo había asignado aquí y se devuelve) | `document.execCommand('insertText')` | Está deprecado y **jsdom no lo implementa**: adoptarlo obliga a mockearlo en todos los tests de componente, o sea a verificar el mock. Un `execCommand` con respaldo es peor todavía: el respaldo sería lo **único** que los tests ejercitan. La salida honesta no es recuperar la pila del navegador, es tener una propia en el store, y eso es una spec entera. **RESUELTA el 2026-07-28** (decisión **B** de `spec.md` §8): la limitación se acepta en la `004` y la pila propia queda **planificada con destinatario** en `spec.md` **§9**, asignada a la spec **`006-editor-undo`**, dependiente de la `005` |
| 7 | **El catálogo es datos, no código.** Una tabla de objetos congelados; el despacho son tres funciones (`inline`, `linePrefix`, `block`) | Una clase o una función por elemento | Añadir un elemento tiene que ser una fila. AC-18 recorre el catálogo entero, así que un elemento nuevo sin cubrir sale en rojo solo |
| 8 | **Ninguna dependencia nueva.** Cero paquetes instalados | `@uiw/react-md-editor`, `react-markdown-editor-lite`, iconos de `lucide-react` | La `003` midió el coste del ecosistema `unified`: **+255 módulos y +160,7 kB (+48 kB gzip)**, y dejó ese número escrito como la vara contra la que juzgar cualquier añadido de la `004` o la `005`. La paleta son cadenas y botones. Los iconos van como `<svg aria-hidden="true">` en línea, igual que `RowActionButton` de `TreeNodeRow.tsx` |
| 9 | **Cero plugins de remark/rehype.** La cadena de saneado de la `003` se queda idéntica | `remark-directive`, `rehype-raw` «para las tablas» | GFM ya renderiza tablas, listas de tareas y tachado; el resto es CommonMark. El conjunto que la paleta produce es un **subconjunto** de lo que la `003` ya renderiza y ya midió. Si algún día se añade un plugin, la capa de `rehype-sanitize` pasa a cubrir mucho más y **hay que volver a medir** (`003/plan.md` §2.2.1) |
| 10 | **Los atajos se escuchan en el `<textarea>`, no en la ventana** | `window.addEventListener('keydown')`, como el `Ctrl`+`S` de la `003` | El `Ctrl`+`S` es de ventana **a propósito** (guardar debe funcionar con el foco en cualquier sitio). Formatear, no: aplicar negrita cuando el foco está en el árbol de la barra lateral no tiene significado, y pisar `Ctrl`+`B` y `Ctrl`+`K` del navegador en toda la página es más de lo que hace falta |
| 11 | **Un único guardado por ráfaga de inserciones.** La paleta no fuerza `saveNow` | Guardar tras cada inserción | Heredar el debounce es gratis (`setDraft` ya lo programa) y es lo que mantiene el cupo de `documentContent` donde está. Es la aplicación directa de la política del proyecto: **gastar menos, no neutralizar más** |

---

## 2. Contrato de API

**Ninguno.** Esta spec no crea, modifica ni consume ningún endpoint nuevo. Los dos que ya usa el
editor —`GET /api/workspace/documents/:id` y `PUT /api/workspace/documents/:id/content`— se
quedan **exactamente** como los cerró la `003`, con sus DTO y sus códigos de error intactos.

No hay `*.request.dto.ts` ni `*.response.dto.ts` nuevos, no hay decoradores de Swagger que añadir y
no hay `ValidationPipe` que tocar. La regla dura de backend de `CLAUDE.md` sigue satisfecha por
omisión: no se añade ninguna entrada ni ninguna salida.

---

## 3. Esquema / migración Prisma

**Ninguno.** No hay modelos nuevos ni columnas nuevas. `contentVersion`, la columna que introdujo la
`003`, no se toca. No hay migración que nombrar.

---

## 4. Frontend

### 4.1 Archivos

```
apps/web/src/features/editor/
  markdown-insert.ts          NUEVO · núcleo puro: (selección, elemento) → selección
  markdown-insert.test.ts     NUEVO · ~40 casos de cadenas, sin DOM
  markdown-palette.ts         NUEVO · catálogo (datos) + tipos del elemento
  markdown-palette.test.ts    NUEVO · exhaustividad, pureza, guardas del catálogo
  MarkdownPalette.tsx         NUEVO · toolbar ARIA con roving tabindex
  MarkdownPalette.test.tsx    NUEVO · roles, nombres, teclado, región viva
  DocumentEditorPage.tsx      MODIFICADO · ref del textarea, selección pendiente, atajos, render
  DocumentEditorPage.test.tsx MODIFICADO · integración (modo, setDraft, foco, límite, tabulación)
  MarkdownPreview.test.tsx    MODIFICADO · cada plantilla renderizada + guarda del corpus 10 → 15
apps/web/src/test/
  markdown-xss-corpus.ts      MODIFICADO · +3 cargas (valla, celda de tabla, tarea)
apps/web/e2e/
  palette.spec.ts             NUEVO · recorrido solo con teclado + tamaño de objetivo
  editor.spec.ts              MODIFICADO · guarda del corpus 10 → 15 (una línea)
```

**Lo que NO se toca, dicho a propósito**: `editor.store.ts` (la paleta usa `setDraft` tal cual),
`editor.constants.ts`, `MarkdownPreview.tsx` (el componente; solo su test), `http.ts`,
`workspace-fixtures.ts`, `auth-fixtures.ts`, `api-stub.ts`, `setup.ts`, `vite.config.ts`,
`package.json` de cualquier paquete, `packages/shared/**` y `apps/api/**`.

### 4.2 El núcleo de inserción

```ts
/** Lo que se sabe de un área de texto en un instante. Es también lo que se devuelve. */
export interface TextSelection {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

export function applyPaletteElement(
  element: PaletteElement,
  selection: TextSelection,
): TextSelection;
```

Entrada y salida tienen **la misma forma** a propósito: encadenar dos inserciones es componer la
función consigo misma, y eso es lo que hace que AC-1 pueda afirmar «aplicar cursiva después de
negrita vuelve a envolver el texto y no los asteriscos» sin ninguna maquinaria.

Tres familias, un despacho:

**`inline`** — `{ kind: 'inline', before, after, placeholder }`

- Con selección: `text[0..start] + before + seleccionado + after + text[end..]`; la selección
  resultante es `[start + before.length, start + before.length + seleccionado.length]`.
- Sin selección: se inserta `before + placeholder + after` y la selección cubre el `placeholder`.
- `link` e `image` son `inline` con una vuelta de tuerca declarada en el catálogo
  (`selectTargetWhenWrapping: true`): con selección, lo que queda seleccionado es **la URL**, porque
  el rótulo ya lo escribió la persona y el hueco por rellenar es el destino (AC-5).

**`linePrefix`** — `{ kind: 'linePrefix', prefix | numbered, replaces: RegExp, placeholder }`

1. Se calcula el rango de **líneas completas** que toca `[start, end]` (desde el `\n` anterior a
   `start` hasta el `\n` posterior a `end`, ambos exclusive).
2. De esas líneas se **excluyen las vacías** (AC-9). Si no queda ninguna —cursor en línea vacía, sin
   selección— se inserta `prefix + placeholder` y la selección cubre el `placeholder` (AC-11).
3. A cada línea restante se le quita el prefijo que declare `replaces` (anclado al inicio) y se le
   pone el suyo. `numberedList` numera **desde 1 contando solo las líneas que reciben prefijo**
   (AC-8 + AC-9 juntos).
4. Selección resultante: si la de entrada estaba vacía, el cursor se desplaza el **delta** de la
   línea que lo contenía (AC-7). Si abarcaba varias líneas, la selección resultante cubre el bloque
   entero ya prefijado, de la primera columna de la primera línea a la última columna de la última.

**`block`** — `{ kind: 'block', render(seleccionado): string, selectionInside }`

1. Se corta en el **borde de línea** más cercano al cursor: los bloques no se meten en medio de un
   párrafo.
2. Se normaliza la separación a **exactamente una** línea en blanco antes y después, y **ninguna**
   cuando el bloque queda pegado al principio o al final del documento (AC-12 y AC-13). La regla
   operativa: contar los `\n` que ya hay y añadir solo los que falten, nunca concatenar `\n\n` a
   ciegas.
3. `codeBlock` mete la selección dentro de la valla y la deja seleccionada; sin selección, el cursor
   queda dentro y el hueco de lenguaje vacío (AC-14). `table` deja seleccionada la primera celda de
   encabezado (AC-15). `divider` no deja nada seleccionado: el cursor va a la línea siguiente.

### 4.3 El adaptador — `DocumentEditorPage.tsx`

Tres piezas y ninguna más:

```tsx
const textareaRef = useRef<HTMLTextAreaElement | null>(null);
// Selección que hay que aplicar DESPUÉS de que el valor nuevo aterrice en el DOM. Es un `ref` y no
// estado porque no se pinta: meterlo en `useState` sería un render extra por inserción.
const pendingSelection = useRef<{ start: number; end: number } | null>(null);

const insert = (element: PaletteElement): void => {
  const node = textareaRef.current;
  if (node === null) return;

  const next = applyPaletteElement(element, {
    text: entry.draft,                 // el borrador del store, no `node.value`: el store es la verdad
    selectionStart: node.selectionStart,
    selectionEnd: node.selectionEnd,
  });

  pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd };
  useEditorStore.getState().setDraft(documentId, next.text);   // único camino (decisión 10 de la 003)
};

useLayoutEffect(() => {
  const target = pendingSelection.current;
  if (target === null) return;
  pendingSelection.current = null;
  const node = textareaRef.current;
  if (node === null) return;
  node.focus();                                     // AC-21: el foco vuelve al área de escritura
  node.setSelectionRange(target.start, target.end); // AC-21: y el caret al sitio calculado
});
```

Notas que valen su línea:

- El **texto de partida es `entry.draft`**, no `node.value`. En régimen son iguales, pero el store es
  quien manda y leer del DOM abriría la puerta a insertar sobre un valor que React está a punto de
  pisar.
- El `useLayoutEffect` va **sin array de dependencias** y se protege con el `ref`: solo hace algo
  cuando hay una selección pendiente, y la consume. Un array de dependencias sobre `entry.draft`
  también dispararía al teclear.
- `node.focus()` antes de `setSelectionRange` es lo que hace que AC-22 (documento vacío, el
  `<textarea>` nunca tuvo el foco) funcione.

**Orden en el DOM** (AC-26): conmutador de vista → **paleta** → `tabpanel` con el `<textarea>`. La
paleta se renderiza únicamente cuando `viewMode === 'text'` (AC-19).

**Atajos** (AC-28): un `onKeyDown` **en el `<textarea>`**, no en la ventana. Reconoce
`(ctrlKey || metaKey)` + `b`/`i`/`k`, llama a `preventDefault()` y despacha al elemento del catálogo
cuyo `shortcut` coincide. No toca el `Ctrl`+`S` de la `003`, que sigue en `window` y filtra por `s`.

**Límite de caracteres** (AC-23): no hay rama. Se inserta y ya; el contador y el rechazo del servidor
son los de la `003`.

### 4.4 El componente — `MarkdownPalette.tsx`

```tsx
export interface MarkdownPaletteProps {
  readonly onInsert: (element: PaletteElement) => void;
  /** Lo que se anuncia en la región viva; lo gestiona la paleta, no la página. */
  readonly disabled?: boolean;   // reservado; hoy no se usa (decisión C: la paleta no se deshabilita)
}
```

- `div[role="toolbar"][aria-label="Elementos de markdown"]`, con tres
  `div[role="group"][aria-label]`: «Formato», «Bloques de texto», «Insertar».
- Cada botón: `<button type="button" aria-label="{etiqueta}" title="{descripción}">` con un
  `<svg aria-hidden="true" focusable="false">` dentro. Nombre accesible en castellano (AC-24).
- **Roving tabindex** (AC-25): un índice de foco en `useState`; el botón activo lleva `tabIndex={0}`
  y el resto `-1`; `onKeyDown` delegado en el `toolbar` que atiende `ArrowRight`, `ArrowLeft`, `Home`
  y `End`, mueve el índice **atravesando los grupos** (el orden es el del catálogo aplanado,
  no el de cada grupo por separado), envuelve por los extremos, llama a `preventDefault()` y **enfoca
  de verdad** el botón destino con un array de `ref`s.
- **Región viva** (AC-27): un `p[role="status"]` propio de la paleta que dice `Insertado: Negrita`.
  Es **hermano** del `role="status"` de `SaveStatus`, nunca su ancestro ni su descendiente, y el test
  lo comprueba con la misma aserción de no-contención que la `003` usa entre `status` y `alert`.
- **Estilo**: se reutilizan literalmente las clases del repo —`min-h-8` o mayor para llegar a los
  24 px de SC 2.5.8, y el anillo `outline-solid outline-0 focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-blue-700`. En Tailwind 4 `outline-none` se
  hereda y mata el anillo: es la «lección de `T-019`» y está escrita en el repo por algo.

### 4.5 Tipos compartidos

De `@one-markdown/shared` se consume lo que ya se consumía: `MAX_DOCUMENT_CONTENT_CHARS` (a través de
`editor.constants.ts`). **No se añade ni se modifica ningún tipo.**

### 4.6 Accesibilidad — resumen de lo comprometido

| Requisito | Cómo | AC |
|---|---|---|
| Nombre, rol, valor | `toolbar` + `group` + `button` con `aria-label` en castellano; iconos `aria-hidden` | AC-24 |
| Operable con teclado (SC 2.1.1) | Roving tabindex, flechas, `Home`/`End`, `Enter`/`Espacio` nativos del `<button>` | AC-25 |
| Orden del foco (SC 2.4.3) | Paleta **antes** del área de texto en el DOM | AC-26 |
| Estado dinámico anunciado (SC 4.1.3) | `role="status"` propia, `polite`, sin anidar con la de guardado | AC-27 |
| Tamaño del objetivo (SC 2.5.8) | ≥ 24 × 24 px CSS, medido con `boundingBox()` en Chromium | AC-29 |
| Foco visible (SC 2.4.11) | Anillo `focus-visible` del repo, verificado en navegador | AC-29 |
| Sin trampa de teclado (SC 2.1.2) | La toolbar no captura `Tab`: solo flechas, `Home` y `End` | AC-25, AC-26 |

---

## 5. Estrategia de tests

| Nivel | Qué cubre | Dónde |
|---|---|---|
| unit puro (web) | El álgebra de inserción entera: envolver, prefijos, bloques, cursor. Sin DOM, sin `render`, sin temporizadores | `apps/web/src/features/editor/markdown-insert.test.ts` |
| unit puro (web) | Catálogo: exhaustividad, ids únicos, recorrido completo, y la **pureza** por lectura del código fuente | `apps/web/src/features/editor/markdown-palette.test.ts` |
| componente (web) | Roles ARIA, nombres accesibles, roving tabindex y movimiento **real** del foco, región viva | `apps/web/src/features/editor/MarkdownPalette.test.tsx` |
| integración (web) | Paleta ↔ store ↔ `<textarea>`: modo de vista, `setDraft` una vez, selección real del DOM, documento vacío, límite, tabulación, atajos. Cuenta **peticiones**, no llamadas a espías | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` |
| saneado (web) | Cada plantilla del catálogo renderizada por `MarkdownPreview` + las tres cargas nuevas por los cuatro `it.each` existentes | `apps/web/src/features/editor/MarkdownPreview.test.tsx` |
| e2e (web) | Recorrido **solo con teclado** con recarga; tamaño de objetivo y foco visible en Chromium; presupuesto de cupo | `apps/web/e2e/palette.spec.ts` |
| unit/e2e (api) y unit (shared) | **Nada nuevo.** Se corren para demostrar que no se movieron (AC-34) | — |

Convenciones heredadas que las tareas **deben** respetar, y que costaron descubrirse:

- **Nada de `findBy*` ni `waitFor`** en los tests de `apps/web`: el `waitFor` de RTL busca un global
  `jest` que en Vitest no existe. Se usa el helper `settle(ms)` que ya vive en
  `DocumentEditorPage.test.tsx`.
- Temporizadores falsos con `vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1 })` y
  `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`. Sin `shouldAdvanceTime`, un `click`
  sobre el `<textarea>` agota los 5 s.
- Consultas **por rol ARIA** y etiquetas en castellano. Nunca `getByTestId`.
- La red se sustituye con `stubApi` (`src/test/api-stub.ts`); **no** se hace `vi.mock` de módulos.
- Para preparar una selección en los tests hay dos caminos verificados con la documentación de
  `user-event` 14.6.1: `node.setSelectionRange(a, b)` directo (más claro para preparar el estado), o
  `user.type(node, 'x', { skipClick: true, initialSelectionStart, initialSelectionEnd })` cuando lo
  que se quiere es simular el gesto. `user.keyboard('{Control>}a{/Control}')` selecciona todo.
- Los tests de e2e resetean `login` y `workspace` en un *fixture* automático, como hace
  `editor.spec.ts`, y **nunca** `documentContent`.

---

## 6. Orden de ejecución

No hay esquema ni backend, así que el orden canónico del proyecto se colapsa a: **núcleo puro →
catálogo → componente → integración → atajos → saneado → navegador.**

```
T-001 ─ T-002 ─ T-003 ─ T-004 ─ T-005 ─┬─ T-006 ─ T-007 ─ T-008 ─┬─ T-010
        (mismo archivo: estrictamente   │                         │
         en serie, sin paralelizar)     └─ T-009 ────────────────┘
```

- **T-001 … T-004 van en serie obligatoriamente**: los cuatro escriben en `markdown-insert.ts` y
  paralelizarlos es garantizar conflictos en el mismo archivo.
- **T-006 y T-009 sí pueden ir en paralelo** una vez cerrada T-005: tocan archivos disjuntos
  (`MarkdownPalette.*` frente a `MarkdownPreview.test.tsx` + el corpus + la guarda de
  `e2e/editor.spec.ts`).
- **T-010 es la última** por definición: mide el presupuesto de la suite entera y la ausencia de
  cambios fuera de `apps/web`.

---

## 7. Qué le deja cerrado esta spec a la `005`

Para que la `005` (tabs y split view) no tenga que suponerlo:

1. **La paleta no tiene estado propio de documento.** Su única entrada es `(elemento)` y su único
   efecto es `onInsert`. La selección vive en el `<textarea>` y el contenido en el store, ya indexado
   por `id`. Dos paneles de texto significan dos paletas independientes y **cero** sincronización.
2. **La paleta se renderiza dentro del panel de texto**, no en la cabecera de la página. Cuando el
   split ponga texto y preview lado a lado, la paleta va con el texto y no hay nada que decidir.
3. **El núcleo de inserción es puro y no conoce el documento.** Sirve igual para el panel que sea.
4. La deuda de deduplicar `GET /documents/:id` dentro de `open(id)` **sigue siendo suya**
   (`003/spec.md` §8.1) y la `004` no la ha tocado ni la ha empeorado.
5. **Una restricción nueva que la `005` tiene que conocer al decidir su política de desalojo**: la
   spec **`006-editor-undo`** —planificada en `spec.md` §9 al resolverse la decisión B— colgará una
   **pila de deshacer dentro de `EditorEntry`**, es decir, **por documento**. Desalojar una entrada
   **descarta su historial**, así que la `005` debe dejar escrito y consciente si «cerrar una pestaña
   y volver a abrirla pierde el deshacer» es aceptable, o si las entradas con historial merecen otro
   trato. La `006` va **después** de la `005` precisamente para no diseñarse contra un supuesto.
