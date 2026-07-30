# Plan 006 — Pila de deshacer/rehacer propia del editor

Spec de referencia: `spec.md` v0.1.0

## 0. Verificaciones previas — qué se comprobó y contra qué

Nada de lo de abajo se escribió de memoria. Lo que se comprobó, y dónde:

| Qué | Contra qué | Resultado |
|---|---|---|
| `MAX_DOCUMENT_CONTENT_CHARS` | `packages/shared/src/index.ts:218` y `apps/api/src/workspace/workspace.constants.ts:34` | **200.000**, espejado en los dos paquetes |
| `AUTOSAVE_DEBOUNCE_MS` | `apps/web/src/features/editor/editor.constants.ts:20` | **1.500** |
| Quién escribe `draft` en el store | lectura completa de `editor.store.ts` | `setDraft`, `readDocument`, `resolveKeepMine` (mismo valor) y `resolveTakeServer` — la tabla de `spec.md` §1.3 |
| `Map`s de módulo sin limpiar | `editor.store.ts:148,155,167` y `beforeEach` de `editor.store.test.ts:101` | tres, y el `beforeEach` no los alcanza |
| Temporizadores falsos y `Date` | context7 `/vitest-dev/vitest` — `vi.useFakeTimers()` envuelve `setTimeout`, `setInterval`, **`Date`** y otros (implementación sobre `@sinonjs/fake-timers`) | `Date.now()` avanza con `advanceTimersByTimeAsync`, así que la ventana de agrupación es comprobable sin relojes reales |
| Atajos ya usados por la paleta | `markdown-palette.ts:141,154,275` | `b`, `i`, `k`. **Ni `z` ni `y`** |
| Cómo se pulsa un atajo en el navegador | context7 `/microsoft/playwright` — `ControlOrMeta` resuelve a `Meta` en macOS y `Control` en Windows/Linux | `page.keyboard.press('ControlOrMeta+z')` |
| Proyectos de Playwright | `apps/web/playwright.config.ts` | **uno**: `chromium`. De ahí el riesgo #2 de la spec |
| La guarda de pureza y su lista | `markdown-palette.test.ts:276-284` | `PURE_MODULES` con dos entradas; `FORBIDDEN_TOKENS` con seis |
| Copias de `watchContentSaves` | `grep -rn` en `apps/web/e2e` | **dos**: `palette.spec.ts:207` y `tabs.spec.ts:314` |
| Precedente de nombre accesible con mecanismo | `DocumentTabs.tsx:84` | `` `«${title}»${unsaved ? ' · sin guardar' : ''} · Supr para cerrar` `` |
| Regiones vivas de la página del editor | `SaveStatus.tsx:46`, `MarkdownPalette.tsx:216`, `DocumentTabs.tsx:356`, `DocumentEditorPage.tsx:237` | **cuatro**, las cuatro con `aria-label` |
| Versiones instaladas | `apps/web/package.json` | react **19.2.8** · zustand **5.0.14** · vitest **4.1.10** · @playwright/test **1.62.0** · jsdom **29.1.1** |

**Cero dependencias nuevas.** El *diff* de prefijo/sufijo son dos bucles; no entra ninguna biblioteca.

---

## 1. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|---|---|---|
| 1 | Una transacción guarda un **delta** (`{at, removed, inserted}`), no dos instantáneas | instantáneas completas (`004` §9.3); instantáneas con límite de 200 transacciones | La aritmética de `spec.md` §2.1: 200 transacciones × 400 KB = ~80 MB **por documento**, sin cota al número de pestañas. Y «200 transacciones» describe dos mundos que se diferencian en cuatro órdenes de magnitud |
| 2 | La cota se expresa en **caracteres**, `UNDO_HISTORY_BUDGET_CHARS = MAX_DOCUMENT_CONTENT_CHARS` | contar transacciones; no poner cota | Con deltas, una transacción no tiene tamaño fijo. Y sin cota, pegar el documento entero en bucle vuelve a los 80 MB. Derivado y no escrito, como `CONTENT_COUNTER_THRESHOLD` |
| 3 | La **más reciente nunca se desaloja** | desalojar por coste sin excepción | Sin la excepción, una escritura mayor que el presupuesto vacía la pila incluida ella misma, y `Ctrl`+`Z` no deshace justo lo que la persona acaba de hacer |
| 4 | El texto del inicio del grupo abierto **se reconstruye**, no se guarda | guardar el ancla del grupo (una cadena más) | Retener una copia transitoria de hasta 400 KB es lo que la decisión 1 existe para evitar; y el camino de reconstrucción **es el mismo que deshacer**, ya cubierto por sus tests |
| 5 | Dos módulos puros: `text-edit.ts` (delta) y `undo-history.ts` (pila) | uno solo; meterlo en el store | Separar el álgebra del texto de la política de historial da dos superficies pequeñas, las dos comprobables sin store ni DOM y las dos vigiladas por la guarda de pureza. Y hace que `T-001` y `T-002` sean tareas de verdad y no dos mitades del mismo archivo |
| 6 | `openedAt` vive **dentro de `UndoState`** | un `Map` de módulo, como `debounceTimers` | Los tres `Map`s de módulo que ya hay no los limpia ningún `beforeEach`, y un caso que deja algo colgado hace fallar al siguiente (`005`, `T-009`). Un dato que se pinta indirectamente —habilita o no un botón— no tiene por qué estar fuera del estado |
| 7 | `setDraft` gana un **tercer argumento opcional** con la selección y si la escritura se puede fundir | argumento obligatorio; una acción nueva `applyEdit` | Obligatorio obliga a tocar todas las llamadas de una spec cerrada sin ganar comportamiento; una acción nueva sería el segundo camino de cambio de contenido que `004` §9.3 marca como riesgo. Decisión abierta **A** de la spec |
| 8 | Deshacer y rehacer son **`setDraft` con el registro apagado** | una ruta paralela que escriba la entrada | Es lo que hace que hereden sucio, debounce y coalescencia sin una rama nueva, y lo que permite que AC-19 y AC-20 se cumplan **sin código propio** |
| 9 | Los atajos van **en el `<textarea>`**; los botones, en la fila de herramientas junto a «Guardar» | los atajos en la ventana, como `Ctrl`+`S` | Guardar es una acción de la página; deshacer solo significa algo donde se escribe. Precedente de la `004` (AC-28 suyo) y AC-26 de esta |
| 10 | **Ninguna región viva nueva** | una quinta `role="status"` que anuncie cada paso | Cuatro ya conviven en la página y algunos lectores locutan el `aria-label` además del contenido (`004` riesgo #13). Es la decisión abierta **B**: recomendada, no cerrada |
| 11 | La restauración de la selección reutiliza `pendingSelection` + `useLayoutEffect` de la `004`, **con un campo más**: si hay que enfocar | enfocar siempre, como hace la paleta | Enfocar siempre roba el foco al botón, y la segunda pulsación de `Enter` escribiría un salto de línea en el documento (AC-30) |

---

## 2. Contrato de API

**Ninguno.** Esta spec no añade, quita ni modifica endpoints, DTO ni códigos de error. El tráfico que
genera es el `PUT /api/workspace/documents/:id/content` que ya existe, emitido por el mismo bucle de
guardado de la `003`. Ver `spec.md` §8 y AC-34.

## 3. Esquema / migración Prisma

**Ninguno.** No hay tabla, no hay migración, no hay columna. El historial vive en memoria del cliente
y muere con la entrada del store (`005` §6.3).

---

## 4. Frontend

### 4.1 Archivos

| Archivo | Estado | Qué le pasa |
|---|---|---|
| `apps/web/src/features/editor/text-edit.ts` | **nuevo** | El delta: `diffEdit`, `applyEdit`, `invertEdit`, `editCost`. Puro |
| `apps/web/src/features/editor/text-edit.test.ts` | **nuevo** | AC-1, AC-2 |
| `apps/web/src/features/editor/undo-history.ts` | **nuevo** | La pila: `EMPTY_HISTORY`, `recordWrite`, `undoStep`, `redoStep`, `clearHistory`. Puro |
| `apps/web/src/features/editor/undo-history.test.ts` | **nuevo** | AC-3…AC-8, AC-10 |
| `apps/web/src/features/editor/editor.constants.ts` | modificado | `UNDO_GROUP_MS` y `UNDO_HISTORY_BUDGET_CHARS` |
| `apps/web/src/features/editor/editor.store.ts` | modificado | `UndoState` en `EditorEntry`; tercer argumento de `setDraft`; `undo(id)` / `redo(id)`; `resolveTakeServer` vacía |
| `apps/web/src/features/editor/editor.store.test.ts` | modificado | AC-11…AC-22 |
| `apps/web/src/features/editor/DocumentEditorPage.tsx` | modificado | Atajos, los dos botones, `pendingSelection` con campo de foco |
| `apps/web/src/features/editor/DocumentEditorPage.test.tsx` | modificado | AC-23…AC-31 |
| `apps/web/src/features/editor/markdown-palette.test.ts` | modificado | `PURE_MODULES` gana dos entradas; el `describe` cita los dos AC (§7.1 de la spec) |
| `apps/web/e2e/undo.spec.ts` | **nuevo** | AC-32, AC-33 |
| `apps/web/e2e/support/editor-e2e.ts` | modificado | `watchContentSaves` extraído |
| `apps/web/e2e/palette.spec.ts` · `apps/web/e2e/tabs.spec.ts` | modificados | pierden su copia local y lo importan |
| `apps/web/src/test/e2e-support.test.ts` | modificado | el inventario gana `watchContentSaves` |
| `specs/001-auth/CHANGELOG.md` | modificado | entrada de cierre por tocar `e2e/support/**` |

**Rutas**: ninguna nueva. **Tipos compartidos**: solo `MAX_DOCUMENT_CONTENT_CHARS`, que ya se importa.

### 4.2 `text-edit.ts` — el álgebra del delta

```ts
export interface TextEdit {
  readonly at: number;
  readonly removed: string;
  readonly inserted: string;
}

/** El reemplazo mínimo que lleva de `before` a `after`. */
export function diffEdit(before: string, after: string): TextEdit;
/** `before` con el reemplazo aplicado. */
export function applyEdit(text: string, edit: TextEdit): string;
/** El reemplazo que deshace este. Mismo `at`; `removed` e `inserted` intercambiados. */
export function invertEdit(edit: TextEdit): TextEdit;
/** Lo que cuesta guardarlo: `removed.length + inserted.length`. */
export function editCost(edit: TextEdit): number;
```

`diffEdit` recorta el **prefijo común** y luego el **sufijo común** —sin que los dos recortes se
solapen, que es el único caso que se hace mal a la primera: con `before = 'aa'` y `after = 'aaa'` el
sufijo común no puede comerse lo que ya se llevó el prefijo—.

**Textos iguales dan un reemplazo vacío —`removed` e `inserted` vacíos, coste 0— y su `at` no se
especifica** (corrección de la **v0.1.2**, escrita con `T-001` verde). Esta sección decía
`{at: 0, removed: '', inserted: ''}`, y era una forma concreta que no hacía falta: con dos textos
iguales el prefijo común agota la cadena, así que el `at` sale siendo su longitud. **Da igual**, porque
un reemplazo sin nada quitado y nada puesto es un no-op **desde cualquier posición**. Normalizarlo a 0
habría añadido una rama que **solo afirmaría su propio test** —en producción nadie llama aquí con dos
textos iguales: `setDraft` y `recordWrite` salen antes—, y una rama cubierta únicamente por el test
que la pide es el anti-patrón que la `004` rechazó al descartar `execCommand` «con respaldo». El caso
del corpus se queda; lo que cambia es **qué afirma**: el no-op y el coste, no la forma.

**Cabecera del archivo**: escrita en castellano y **sin deletrear** `document.`, `window.`, `zustand`
ni `from 'react'` — la guarda de pureza lee el fuente y no distingue código de comentario
(`004` §9.6). Entra en la lista de artefactos de `T-001`.

### 4.3 `undo-history.ts` — la pila

```ts
export interface Caret { readonly start: number; readonly end: number }

export interface UndoTransaction {
  readonly edit: TextEdit;
  readonly before: Caret;
  readonly after: Caret;
}

export interface UndoState {
  readonly past: readonly UndoTransaction[];
  readonly future: readonly UndoTransaction[];
  readonly cost: number;
  readonly openedAt: number | null;
}

export const EMPTY_HISTORY: UndoState;

/** Registra una escritura. `mergeable` es lo único que decide si se funde con el grupo abierto. */
export function recordWrite(
  history: UndoState,
  write: {
    readonly before: string;
    readonly after: string;
    readonly caretBefore: Caret;
    readonly caretAfter: Caret;
    readonly mergeable: boolean;
    readonly now: number;
  },
): UndoState;

/** El paso de deshacer, o `null` si no hay ninguno. Devuelve el estado nuevo y a dónde va el texto. */
export function undoStep(
  history: UndoState,
  text: string,
): { readonly history: UndoState; readonly text: string; readonly caret: Caret } | null;

export function redoStep(/* misma forma */): /* … */;

/** Deja la pila vacía. La usa `resolveTakeServer`. */
export function clearHistory(): UndoState;
```

Reglas, en el orden en que `recordWrite` las aplica:

1. Si `before === after`, no pasa nada (devuelve el mismo estado). Es lo que hace que un `setDraft`
   sin cambio no ensucie el historial — el store ya sale antes en ese caso, pero el módulo no depende
   de que el store lo haga.
2. **`future` se vacía siempre** (AC-6).
3. **Fusión**: si `mergeable` y `openedAt !== null` y `now - openedAt < UNDO_GROUP_MS` y `past` no
   está vacío → se reconstruye el texto del inicio del grupo con
   `applyEdit(before, invertEdit(cima.edit))`, se recalcula el delta contra `after`, y la cima se
   sustituye conservando su `before` y tomando el `caretAfter` nuevo. Si el delta recalculado sale de
   coste 0 —tecleo que vuelve exactamente al texto del inicio del grupo—, la cima **se retira**: una
   transacción que no cambia nada no es un paso de deshacer.
4. Si no se funde, se apila una transacción nueva.
5. **`openedAt`** queda en `now` si `mergeable`, y en `null` si no (AC-5: una inserción cierra el
   grupo).
6. **Desalojo por coste**: mientras `cost > UNDO_HISTORY_BUDGET_CHARS` **y** queden ≥ 2 transacciones
   entre `past` y `future`, se quita la más antigua de `past` (y si `past` se queda con una sola, del
   extremo antiguo de `future`). La condición «≥ 2» es la excepción de AC-8 escrita como invariante y
   no como caso especial.

`undoStep` y `redoStep` ponen `openedAt` a `null`: lo que se teclee después empieza transacción nueva
aunque caiga dentro de la ventana.

**El coste se lleva incrementalmente y se comprueba**: `cost` es un campo, pero AC-7 lo afirma contra
la suma recorriendo `past` y `future`. Un contador que se desincroniza de lo que cuenta es la avería
clásica de este patrón, y el AC la caza.

### 4.4 `editor.constants.ts`

```ts
/**
 * Ventana de agrupación del tecleo … deliberadamente **más corta** que `AUTOSAVE_DEBOUNCE_MS`, y
 * **no derivada de él**: uno es granularidad de historial y el otro es tráfico de red …
 */
export const UNDO_GROUP_MS = 500;

/** … derivado de `MAX_DOCUMENT_CONTENT_CHARS`: el historial nunca cuesta más que una copia más. */
export const UNDO_HISTORY_BUDGET_CHARS = MAX_DOCUMENT_CONTENT_CHARS;
```

### 4.5 `editor.store.ts`

`EditorEntry` gana un campo:

```ts
readonly undo: UndoState;
```

`readDocument` lo inicializa con `EMPTY_HISTORY`. La firma de `setDraft` pasa a:

```ts
setDraft: (id: string, draft: string, write?: DraftWrite) => void;

interface DraftWrite {
  /** `true` para el tecleo; `false` para la paleta, los atajos y todo gesto único. Por defecto `true`. */
  readonly mergeable?: boolean;
  /** Dónde estaba el cursor antes. Se **deriva** si falta. */
  readonly caretBefore?: Caret;
  /** Dónde queda después. Se **deriva** si falta. */
  readonly caretAfter?: Caret;
}
```

**La regla de respaldo** (decisión abierta **A**), y es exacta para el tecleo, no una aproximación:
cuando falta una selección se deriva del propio delta, colapsada —
`caretBefore = at + removed.length` y `caretAfter = at + inserted.length`. Escribir `abc` en la
posición 5 da `{5, '', 'abc'}`, y las dos derivaciones dan 5 y 8, que es exactamente lo que se
quiere; borrar `abc` desde la posición 8 da `{5, 'abc', ''}`, y dan 8 y 5, también correcto.

De ahí sale quién pasa qué:

- **El tecleo no pasa selecciones**, solo `mergeable: true` (que además es el valor por defecto, así
  que puede no pasar nada). La derivación es correcta para él por construcción.
- **La paleta y los atajos pasan las dos exactas**: la anterior la lee del nodo
  (`node.selectionStart/End`, que es lo que `insertElement` ya hace) y la posterior la devuelve
  `applyPaletteElement`. Aquí la derivación **no** valdría: envolver `foo` en negrita deja
  `{at, removed: 'foo', inserted: '**foo**'}`, y deshacer con la selección derivada devolvería un
  cursor colapsado al final de `foo` en vez de `foo` **seleccionado**, que es lo que había. **Es
  justo lo que AC-11 hace rompible**: quitar el argumento en esa llamada cambia la selección
  restaurada y el test cae.

Sin tercer argumento, entonces, el comportamiento es el correcto para el tecleo — y es lo que
mantiene compilando, sin tocarlas, las llamadas de `editor.store.test.ts`.

**El registro va dentro de `setDraft`**, antes del `patch`, y usa `Date.now()` — el único punto de la
spec que lee el reloj, y por eso `recordWrite` recibe `now` como argumento en vez de leerlo (así el
módulo sigue siendo puro y sus tests no necesitan temporizadores falsos).

Dos acciones nuevas:

```ts
/** Aplica el paso anterior. Devuelve dónde dejar el cursor, o `null` si no había nada. */
undo: (id: string) => Caret | null;
redo: (id: string) => Caret | null;
```

Las dos hacen lo mismo con distinto módulo: piden el paso, escriben el `draft` **por el camino
interno de `setDraft`** con el registro apagado, y devuelven el `caret`. «Con el registro apagado» es
una función interna `writeDraft(id, draft, { record })` que `setDraft` también usa: no es una segunda
ruta de escritura, es la única ruta con un interruptor.

`resolveTakeServer` añade `undo: clearHistory()` a su `patch` (AC-21). `resolveKeepMine` **no toca
nada** (AC-22). `flush` y `closeTab` no cambian: la pila vive y muere con la entrada (AC-16).

### 4.6 `DocumentEditorPage.tsx`

- `pendingSelection` pasa de `{ start, end } | null` a `{ start, end, focus: boolean } | null`, y el
  `useLayoutEffect` llama a `node.focus()` **solo si `focus`**. La paleta sigue pasando `true`
  (su AC-22 lo exige); el atajo pasa `true` (el foco ya está ahí y no se mueve nada); **el botón pasa
  `false`** (AC-30).
- `handleTextareaKeyDown` atiende **primero** el historial y **después** el catálogo de la paleta. El
  orden importa: sin él, `Ctrl`+`Shift`+`Z` entraría por el `find` del catálogo si alguna vez alguien
  añadiera un elemento con `shortcut: 'z'`. AC-25 impide que eso llegue a ocurrir, y el orden es el
  cinturón.
- `onChange` del `<textarea>` **no cambia**: sigue llamando
  `setDraft(documentId, event.target.value)`. La selección del elemento **antes** del cambio no está
  disponible en `onChange`, y no hace falta: para el tecleo la derivación de §4.5 es exacta.
- `insertElement` pasa `mergeable: false` y las dos selecciones exactas. Es lo que hace AC-11
  rompible.
- Los dos botones van en la fila de herramientas, **antes** de «Guardar**»**, con
  `className` que garantice `min-h-6 min-w-6` (AC-32) y con nombre accesible
  `Deshacer · Ctrl+Z` / `Rehacer · Ctrl+Shift+Z`.

### 4.7 Accesibilidad — lo que queda comprometido

| Compromiso | AC |
|---|---|
| Los dos controles tienen nombre accesible y dicen su atajo | AC-27 |
| Estado deshabilitado que refleja la pila, y es la señal de que se acabó el historial | AC-28 |
| Objetivo ≥ 24 × 24 px (SC 2.5.8) | AC-32 |
| El control no roba el foco al activarse con el teclado | AC-30 |
| No se añade ninguna región viva; las cuatro que hay siguen siendo cuatro | AC-31 |
| Ninguna consulta pide una región, un `tablist` o un `landmark` por su contenido | §6.4 de la spec |
| Cómo locuta un lector real el cambio del `<textarea>` tras deshacer | **no cubrible** — §9.3 |

---

## 5. Estrategia de tests

| Nivel | Qué cubre | Dónde |
|-------|-----------|-------|
| unit (api) | nada — la spec no toca `apps/api` | — |
| e2e (api) | nada | — |
| unit (web) | el álgebra del delta y la política de la pila, sin store ni DOM | `text-edit.test.ts`, `undo-history.test.ts` |
| unit (web) | el historial dentro del store, el guardado y el conflicto | `editor.store.test.ts` |
| componente (web) | atajos, botones, foco y regiones | `DocumentEditorPage.test.tsx` |
| guarda (web) | pureza de los dos módulos · ayudantes de e2e sin duplicar | `markdown-palette.test.ts`, `src/test/e2e-support.test.ts` |
| e2e (web) | **el defecto que la spec arregla**, y el tamaño de objetivo | `e2e/undo.spec.ts` |

**Qué mutación tumbaría cada bloque** (la pregunta que la spec exige por AC, resumida por familias):
cambiar deltas por instantáneas tumba **AC-17**; quitar la excepción de la más reciente tumba
**AC-8**; igualar `UNDO_GROUP_MS` a `AUTOSAVE_DEBOUNCE_MS` tumba **AC-10**; registrar el propio
deshacer tumba **AC-13**; hacer la pila global tumba **AC-15**; quitar `preventDefault()` tumba
**AC-23** y **AC-33**; enfocar siempre tras deshacer tumba **AC-30**; borrar un `aria-label` tumba
**AC-27** y **AC-31**.

---

## 6. Orden de ejecución y paralelismo real

```
T-000 (enmienda documental)
   └─ T-001 text-edit.ts ─ T-002 undo-history.ts ─ T-003 store ─┬─ T-004 guardado/conflicto
                                                                └─ T-005 atajos ─ T-006 botones ─┐
T-007 e2e/support (independiente, en paralelo con TODO lo anterior) ────────────────────────────┴─ T-008 navegador ─ T-009 cierre
```

**Dónde está el paralelismo real**: solo en **`T-007`**, que toca únicamente `e2e/**` y la guarda de
`src/test/`, y no comparte un archivo con ninguna otra tarea. Puede correr desde el principio y en
paralelo con la cadena entera.

**Dónde no lo hay, y por qué**: `T-001` → `T-002` → `T-003` es una cadena de dependencia de módulo
(cada uno importa al anterior). `T-004` y `T-005` sí son independientes **entre sí** —una toca
`editor.store.test.ts` y la otra `DocumentEditorPage.tsx`—, así que se pueden despachar a la vez.
`T-005` y `T-006` **no**: los dos escriben en `DocumentEditorPage.tsx` y en su test, y dos agentes en
el mismo archivo es la forma conocida de perder trabajo. `T-008` necesita la interfaz completa y los
ayudantes extraídos.

**Nada se paralelizaría con tareas de `packages/shared` o de `apps/api`, porque no hay ninguna.**

---

## 7. Qué queda después de esta spec

Con la `006` cerrada, el producto de `CLAUDE.md` está implementado **y** el último defecto conocido
que el proyecto había aceptado a sabiendas queda saldado. No hay ninguna spec `007` planificada, y
esta no deja trabajo con destinatario: lo que quede abierto será lo que digan sus riesgos y su §9.3,
que son revisiones manuales declaradas, no deuda de código.
