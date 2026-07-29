# Plan 004 — Paleta de elementos markdown insertables

Spec de referencia: `spec.md` **v0.3.0** (**complete** el 2026-07-29; approved el 2026-07-28 con las
seis decisiones de su §8 resueltas en la opción recomendada; **v0.1.2, v0.2.0 y v0.2.1 el
2026-07-29**). El plan **no cambió** con la aprobación: ninguna resolución movió un contrato, un
artefacto ni un AC.

**Lo que cambió en la v0.3.0**, escrito al cerrar y con T-011 verde: §4.4 corrige el mecanismo de
verificación del **reanuncio** —el `takeRecords()` **a secas no es implementable**, y está medido— y
deja escrito el mecanismo elegido (`U+200B`) con las dos alternativas descartadas y su motivo. Ningún
contrato se mueve. La tarea nueva de esa versión, **T-012**, es de test y no toca este plan.

**Lo que sí cambió en la v0.1.2**, después de implementar T-001…T-005 y con la firma real delante:
§4.2 pasa a describir `selectTargetWhenWrapping` como **cadena** y no como booleano, gana la marca
`consumesSelection` (AC-35) y precisa la regla de separación y el desempate del borde de línea; §4.4
deja escrito que los rótulos de grupo salen del **catálogo**; y §5 recoge la lección de la guarda de
pureza. Nada de esto es alcance nuevo: es el plan poniéndose al día con lo que ya está verde.

**Lo que cambió en la v0.2.0** (spec `spec.md` **v0.2.0**, con T-001…T-009 verdes): §4.4 reescribe la
**región viva** —se monta desde el primer render y las dos regiones de la página llevan `aria-label`
(AC-27), y una segunda inserción del mismo elemento **vuelve a anunciar** (AC-36)— y **retira** el
`disabled?: boolean` que nunca se implementó. Esto **sí** es alcance nuevo, lo ejecuta **T-011** y por
eso la spec sube minor.

---

## 1. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|---|---|---|
| 1 | **Solo `apps/web`.** `packages/shared` y `apps/api` no reciben ni una línea | Catálogo en `packages/shared`; endpoint de favoritos/recientes | El servidor guarda el contenido como texto opaco y no interpreta markdown en ningún punto; el catálogo es copia de interfaz sin un solo consumidor de servidor. El precio de equivocarse está medido: un cambio en `shared` deja `apps/api` en rojo de compilación hasta que aterriza la tarea de DTO —así que esas tareas no se paralelizan— y el radio incluye los **fixtures de test de los dos paquetes**, que se encuentran por el nombre del **tipo** y no por el del endpoint. A la `002` se le quedó corto dos veces por eso. Aquí no se compra ese coste a cambio de nada. Razonamiento completo en `spec.md` §7; AC-34 lo verifica |
| 2 | **Núcleo puro separado del adaptador.** `markdown-insert.ts` es una función de `(estado de selección, elemento) → (estado de selección)`; no importa React, ni el store, ni menciona `document` | Manipular el `<textarea>` directamente desde el manejador del clic con `setRangeText` | Es la frontera de hexagonal aplicada al frontend: dominio puro dentro, adaptador fuera. Y tiene un beneficio concreto e inmediato: los ~40 casos de §3.A-D de la spec son de **cadenas**, sin `render`, sin jsdom, sin temporizadores falsos — se escriben y corren en milisegundos, y no pueden ponerse en rojo por un cambio de interfaz. Precedente en el repo: `contentBytesOf` de la `003` (`T-002`), que también se verificó comprobando que no importaba nada de su entorno |
| 3 | **No se usa `setRangeText` pese a que `003/spec.md` §4 lo daba por el camino** | `element.setRangeText(...)` en el manejador | `setRangeText` muta el `value` del DOM **por fuera** de React. En un `<textarea>` controlado, React sobrescribe ese valor en el render siguiente con lo que diga el estado, así que o se duplica la lógica o se pelean. La forma correcta con un control controlado es: calcular la cadena nueva → `setDraft` → restaurar la selección tras el render. La `003` no se equivocó al decir que la API estaba disponible; simplemente el camino limpio resultó ser otro, y se escribe aquí para que nadie lo «arregle» de vuelta |
| 4 | **La selección se restaura en un `useLayoutEffect`, no en el manejador del clic** | `setSelectionRange` justo después de `setDraft`; `requestAnimationFrame`; `setTimeout(0)` | React documenta que un `<textarea>` controlado al que se le asigna un valor distinto de `e.target.value` **manda el caret al final**. Llamar a `setSelectionRange` antes de que el valor nuevo aterrice en el DOM no sirve de nada: lo pisa el render. `useLayoutEffect` corre **después** del commit y **antes** del repintado, así que la persona nunca ve el caret en el sitio equivocado. Un `setTimeout` lo dejaría ver un fotograma |
| 5 | **`role="toolbar"` con roving tabindex**, no una lista de botones ni un `menu` | Dieciséis `<button>` sueltos; `role="menubar"` + `role="menuitem"`; un `<select>` | Dieciséis paradas de tabulación entre el conmutador de vista y el área de escritura es una barrera real para quien navega con teclado. `menubar` es el patrón de **menús desplegables** y trae expectativas (submenús, `Escape`, activación con letra) que aquí no se cumplen. `toolbar` es literalmente el patrón de «conjunto de controles agrupados que actúan sobre otra cosa». Y hay dos precedentes de roving en el propio repo de los que copiar el idiom: el `tablist` de `DocumentEditorPage` y el `role="tree"` de `WorkspaceTreeView` |
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
  markdown-palette.ts         NUEVO · catálogo (datos) + tipos del elemento + rótulos de los grupos
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
  (`selectTargetWhenWrapping`): con selección, lo que queda seleccionado es **la URL**, porque el
  rótulo ya lo escribió la persona y el hueco por rellenar es el destino (AC-5).

**Firma real de `selectTargetWhenWrapping`** (corregida en la v0.1.2, tras implementar T-002):

```ts
readonly selectTargetWhenWrapping?: string;   // el fragmento literal DE `after` que queda seleccionado
```

La v0.1.1 la había escrito como `selectTargetWhenWrapping: true`. **Mismo nombre, dato explícito.** El
motivo del cambio, para que nadie lo revierta: con un booleano el núcleo tiene que **deducir** qué
trozo de `after` seleccionar, y la única forma de deducirlo es analizar los paréntesis de
`](https://ejemplo.com)` —es decir, meter un miniparser de plantillas dentro de una función de
cadenas, para recuperar una información que el catálogo ya tiene y podría simplemente decir. Con la
cadena, el núcleo hace `after.indexOf(target)` y se acabó: cero magia, y una invariante afirmada con
test —**el valor declarado es siempre un fragmento de `after`**—, que es justo lo que el booleano
dejaba sin poder comprobar.

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

**`block`** — `{ kind: 'block', render(seleccionado): RenderedBlock, consumesSelection: boolean }`

`render` devuelve `{ text, selection }`: el bloque **sin** las líneas en blanco de separación —esas
las pone el núcleo— y qué queda seleccionado en desplazamientos relativos al principio del bloque,
o `null` si no queda nada.

1. **Dónde se corta.** Si el bloque **consume** la selección (solo `codeBlock`) y la selección no
   está vacía, el corte es la selección misma: se la lleva dentro. Si **no** la consume, el bloque se
   abre en un borde de línea y **la selección sobrevive intacta** (AC-35). Con selección, ese borde
   es el **final de la última línea que toca**, para que el bloque quede detrás de lo seleccionado y
   no encima. Sin selección, es el **borde de línea más cercano al cursor** —distancia al inicio
   frente a distancia al final, **empate al inicio**—: un bloque metido a mitad de frase parte el
   párrafo en dos.
   _(El desempate es de la v0.1.2. La v0.1.1 decía «el borde más cercano» y no definía el empate, que
   ocurre siempre que el cursor está justo en el medio de la línea. Se implementó al inicio y tiene
   test propio; si algún día se prefiere «siempre el final de la línea», es un cambio de una línea y
   de un test, pero hay que **decidirlo**, no dejarlo al azar del `<=`.)_
2. **Separación.** El bloque **siempre cierra su línea con un `\n`**, y la línea en blanco entera
   (dos saltos) solo aparece **del lado donde hay texto** (AC-12 y AC-13). La regla operativa:
   contar los `\n` que ya hay y añadir solo los que falten, nunca concatenar `\n\n` a ciegas.
3. `codeBlock` (`consumesSelection: true`) mete la selección dentro de la valla y la deja
   seleccionada; sin selección, el cursor queda dentro y el hueco de lenguaje vacío (AC-14). `table`
   (`consumesSelection: false`) deja seleccionada la primera celda de encabezado (AC-15). `divider`
   (`consumesSelection: false`) no deja nada seleccionado: el cursor va a la línea siguiente.

**Por qué `consumesSelection` es un dato del catálogo y no una rama por `id`.** Porque es la marca
que impide el peor defecto posible de esta spec —borrar el párrafo que la persona tenía seleccionado
al pulsar «Separador» (AC-35)—, y como dato lo declara **cada elemento nuevo** en su fila. Como rama
por `id`, el elemento que alguien añada mañana cae en la que hubiera por defecto sin que nadie lo
decida.

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
  /** Se llama con el elemento del catálogo que se acaba de activar. */
  readonly onInsert: (element: PaletteElement) => void;
}
```

**`disabled?: boolean` se retira del plan en la v0.2.0, y no por descuido de nadie.** La v0.1.x lo
declaraba «reservado; hoy no se usa», y la decisión C dice que **la paleta no se deshabilita nunca**
(en vista previa no se pinta). O sea: no había ningún test que pudiera cubrirlo, porque no había
ningún comportamiento que afirmar. T-006 lo implementó sin él, que era lo correcto. Un `prop`
opcional que nadie pasa y ningún test defiende es una invitación a que alguien lo use más adelante
creyendo que está especificado; si algún día hace falta deshabilitar la paleta, eso es un AC.

- `div[role="toolbar"][aria-label="Elementos de markdown"]`, con tres
  `div[role="group"][aria-label]`: «Formato», «Bloques de texto», «Insertar». Los tres rótulos se
  **leen de `PALETTE_GROUP_LABELS`** (`markdown-palette.ts`); el componente **no** los declara. Son
  copia de interfaz en castellano, del mismo tipo que las etiquetas de los botones, y así el nombre
  accesible de un grupo tiene un solo dueño y un solo test (AC-16, AC-24).
- Cada botón: `<button type="button" aria-label="{etiqueta}" title="{descripción}">` con un
  `<svg aria-hidden="true" focusable="false">` dentro. Nombre accesible en castellano (AC-24).
- **Roving tabindex** (AC-25): un índice de foco en `useState`; el botón activo lleva `tabIndex={0}`
  y los quince restantes `-1`; `onKeyDown` delegado en el `toolbar` que atiende `ArrowRight`,
  `ArrowLeft`, `Home` y `End`, mueve el índice **atravesando los grupos**, envuelve por los extremos,
  llama a `preventDefault()` y **enfoca de verdad** el botón destino con un array de `ref`s.
- **De dónde sale el orden, y esto no es opcional**: tanto el pintado como el recorrido de las
  flechas salen del **orden de `MARKDOWN_PALETTE`** —el catálogo aplanado, no cada grupo por
  separado, y **no** `Object.keys(PALETTE_GROUP_LABELS)`—. Los grupos se pintan agrupando el catálogo
  ya ordenado, no recorriendo las claves del objeto de rótulos. El orden del catálogo es contrato
  afirmado con test; el orden de las claves de un objeto no lo es y no debe serlo. Medido con
  mutación: reordenar el catálogo mata tests, reordenar las claves del objeto de rótulos **sobrevive
  correctamente**.
- **Región viva** (AC-27, AC-36 — **reescrito en la v0.2.0; lo ejecuta T-011**): un
  `p[role="status"][aria-label="Elemento insertado"]` propio de la paleta que dice
  `Insertado: Negrita`.
  - **Se monta desde el primer render**, con el texto vacío, y **no** aparece con la primera
    inserción. Un lector de pantalla anuncia los **cambios** de una región viva que ya conocía; una
    región que entra en el DOM con su texto dentro es poco fiable en NVDA y JAWS. Montarla vacía es
    la única forma de que el primer anuncio sea un cambio.
  - Es **hermana** del `role="status"` de `SaveStatus`, nunca su ancestro ni su descendiente, y el
    test lo comprueba con la misma aserción de no-contención que la `003` usa entre `status` y
    `alert`.
  - **Las dos regiones llevan `aria-label`** —la de guardado, `"Estado del guardado"`, añadido por
    T-011 en `SaveStatus.tsx`— y a partir de ahí **toda** consulta de test las distingue por nombre:
    `getByRole('status', { name: … })`. `getByRole('status')` a secas queda prohibido en esta página;
    con dos regiones montadas siempre, en Playwright es **violación de modo estricto**. **Y también
    queda prohibido distinguirlas por contenido** (`filter({ hasText })`, que es lo que hacía
    `e2e/palette.spec.ts` hasta **T-012**): parece equivalente y no lo es, porque **no lee
    `aria-label`** y por tanto sobrevive verde a que alguien borre el nombre que AC-27 exige.
  - **Reanuncio (AC-36)** _(reescrito en la v0.3.0, con la implementación y la medición delante)_:
    escribir el mismo texto que ya había no muta el DOM y no se anuncia, así que la región tiene que
    cambiar entre un anuncio y el siguiente. **Mecanismo elegido: alternar un `U+200B`** al final del
    texto — síncrono, un solo render, no se pinta y no se locuta. Las dos alternativas se
    descartaron con motivo: un **espacio normal** es whitespace, y el whitespace es exactamente lo
    que colapsan `textContent`, jest-dom, Playwright y el cálculo de texto de un lector (una
    diferencia hecha solo de whitespace es la más fácil de que se normalice hasta desaparecer **en el
    consumidor al que va dirigida**); y **vaciar y reescribir** exige `flushSync` o un temporizador,
    porque React agrupa las dos actualizaciones del mismo manejador en un render. Consecuencia
    asumida: tras un número **par** de anuncios el `textContent` lleva el `U+200B` pegado, así que el
    contenido final se afirma **por contención**, no por igualdad literal.
    **Cómo se mide**: `MutationObserver` que **acumula en su callback** y **cierra con
    `takeRecords()`** antes de contar. El `takeRecords()` **a secas no sirve** —medido: **0**
    registros—, y no por culpa del mecanismo: navegador y jsdom entregan la cola en **cada** punto de
    comprobación de microtareas y `await user.click()` cruza varios, así que solo devolvería lo
    ocurrido desde el último `await`. Lo que aporta es el **cierre**: recoger un último lote aún no
    entregado, de forma síncrona y sin depender del reloj.
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
| Orden del foco (SC 2.4.3) | Paleta **antes** del área de texto en el DOM (orden **relativo**: entre medias está el botón «Guardar» de la `003`) | AC-26 |
| Estado dinámico anunciado (SC 4.1.3) | `role="status"` propia, `polite`, **montada desde el primer render y vacía**, con `aria-label` propio y sin anidar con la de guardado | AC-27 |
| El mismo anuncio dos veces (SC 4.1.3) | La región **cambia** entre anuncios; repetir elemento vuelve a anunciar | AC-36 |
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
  `editor.spec.ts`, y **nunca** `documentContent`. **Precisión de la v0.2.1**: el gasto de
  `documentContent` es **5 de 120 por corrida** (4 el baseline de la `003`, 1 el caso de la paleta) y
  **15** cuando la suite se repite tres veces dentro de la misma ventana de 60 s. Las cifras van
  siempre **con su ventana**; AC-33 las separa en dos comandos por eso.
- **La guarda de pureza no puede convivir con un comentario que la explique** (lección de la v0.1.2,
  pagada en T-005 y escrita entera en `spec.md` §9.6). La guarda lee el **código fuente** con
  `readFileSync` y busca cadenas prohibidas; **no distingue código de comentario**. En un archivo
  vigilado no se puede deletrear `zustand`, `document.`, `window.` ni `from 'react'` **ni siquiera en
  prosa**. Los comentarios se escriben en castellano sin los términos literales («no sabe nada de la
  interfaz, del estado de la aplicación ni del navegador»), y la tarea que crea un módulo vigilado
  debe meter **el comentario de cabecera del archivo** en su lista de artefactos: reescribirlo es
  parte de hacer pasar la guarda, no un extra.
- **El andamio vacío es parte del RED** (lección de la v0.2.0, pagada ya tres veces —T-001, T-005 y
  T-006— y escrita entera en `spec.md` §9.7). Un test que importa un módulo inexistente falla por
  **resolución de módulo**, y ese rojo solo demuestra que el archivo no está. El RED que vale es el
  **de la aserción**, así que la tarea crea primero el módulo con la firma mínima y el cuerpo vacío,
  y **ese** es el fallo que el agente reporta. Un RED reportado como `Cannot find module` es un RED
  sin verificar.
- **En la página del editor, `getByRole('status')` a secas está prohibido** (v0.2.0): hay **dos**
  regiones vivas montadas siempre y las consultas las distinguen por `aria-label`. En Playwright, la
  consulta sin nombre es violación de modo estricto directamente.

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
