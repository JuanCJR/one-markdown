# Plan 005 — Pestañas de documentos y vista dividida

Spec de referencia: `spec.md` v0.1.4

## 0. Verificaciones previas — qué se comprobó y contra qué

**Ninguna dependencia nueva.** Ni en `apps/web` ni en ningún otro paquete. La tira de pestañas es un
componente propio con el mismo patrón que los dos que ya hay (`tablist` de `DocumentEditorPage`,
`role="tree"` de `WorkspaceTreeView`), y la vista dividida es disposición con las utilidades de
Tailwind que ya están. La `003` dejó medido el coste del ecosistema `unified` (+255 módulos,
+160,7 kB) como la vara contra la que juzgar cualquier añadido; aquí no hay nada que juzgar.

Lo que sí se verificó **contra el código instalado y la documentación**, el 2026-07-29:

| Qué | Cómo se comprobó | Resultado |
|---|---|---|
| `useShallow` para seleccionar `openIds` sin renders de más | `context7` (`/pmndrs/zustand`) **y** el `.d.ts` instalado de `zustand` **5.0.14** | Existe y se importa de **`zustand/react/shallow`** (`export declare function useShallow<S, U>(selector: (state: S) => U): (state: S) => U`). En v5 un selector que devuelve un array **nuevo** en cada llamada provoca renders en bucle; con `useShallow` no. Hoy no se usa en `apps/web` en ningún sitio: es el primero |
| `navigate(to, options?)` de React Router **8.3.0** | `.d.ts` instalado (`lib/hooks.d.ts:97`) | `interface NavigateFunction { (to: To, options?: NavigateOptions): void \| Promise<void>; (delta: number): void \| Promise<void> }`. **Devuelve `void | Promise<void>`**, así que las llamadas van con `void navigate(...)` para no dejar una promesa flotante — que es como ya lo escribe `WorkspaceTreeView.tsx:122` |
| `useBlocker` | `.d.ts` instalado (`lib/hooks.d.ts:880`) | Existe (`useBlocker(shouldBlock: boolean \| BlockerFunction): Blocker`) y **no se usa**: la `003` decidió que la navegación **no se bloquea nunca** (su AC-28) y esta spec no lo cambia |
| Patrón *tabs* de la APG | `context7` (`/w3c/wai-aria-practices`) | `role="tablist"` + `<button role="tab">` con `aria-selected`, `aria-controls` y `tabindex="-1"` en las no seleccionadas. **Y el hallazgo que decide la decisión B de la spec**: el único ejemplo de la APG con un control dentro de una pestaña (`tabs-actions`) está marcado *«Experimental content! Do not use except for new standards development purposes»* y depende de `aria-actions`, que no está en ninguna especificación publicada |
| `include` de Vitest en `apps/web` | `apps/web/vite.config.ts` | `['src/**/*.{test,spec}.{ts,tsx}']` — los archivos de `e2e/` **no** los recoge Vitest. Por eso la guarda de AC-30 vive en `src/test/`, no junto a lo que vigila |
| Puerto del servidor web de desarrollo | `apps/web/vite.config.ts` (`server.port: 5173`) | El `--port` de la CLI de Vite **gana** al de la configuración, así que AC-29 se resuelve sin tocar `vite.config.ts` — que es contrato de la `000` y de la `002`, con un bloque de comentario que nadie debería tener que releer para cambiar un puerto |

## 1. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|---|---|---|
| 1 | **`openIds: readonly string[]` vive en `editor.store.ts`**, junto a `entries` | Un `tabs.store.ts` nuevo; `ui.store.ts` (que se anuncia a sí mismo como el sitio de «las tabs abiertas») | Porque la invariante que hay que defender es **entre los dos**: el conjunto de claves de `entries` tiene que ser el de `openIds` (AC-1). En dos stores esa invariante no tiene dueño y se rompe en la primera secuencia rara —cerrar mientras hay un guardado en vuelo—, dejando pestañas sobre la nada o entradas que nadie ve. Además el desalojo **es** una operación sobre `entries`, y el orden «guardar, comprobar, desalojar» (AC-6, AC-7) es una sola transacción. El comentario de `ui.store.ts` que lo reclamaba se escribió en la `000`, antes de que existiera un store del editor |
| 2 | **La pestaña activa NO se guarda: es el `:id` de la ruta** | Un `activeId` en el store, sincronizado con la ruta por un efecto | Dos orígenes de verdad para lo mismo, y el segundo se desincroniza exactamente donde nadie prueba a mano: el botón «atrás» del navegador. Con la ruta como único origen, «atrás» funciona gratis y no hay ningún efecto que escribir. AC-3 lo convierte en algo comprobable (el store **no muta** al cambiar de pestaña) en vez de en una intención |
| 3 | **El desalojo se mueve de `flush` a `closeTab`** | Dejar `flush` como está y que la pestaña «reviva» la entrada al volver | `flush` desaloja hoy porque en la `003` navegar fuera **era** cerrar. Con pestañas son dos gestos distintos con dos resultados distintos, y mezclarlos obliga a releer del servidor en cada salto (AC-13) y tira el modo de vista que la propia `003` quería conservar. Es la enmienda de §6.1 de la spec |
| 4 | **`closeTab(id)` es asíncrono y devuelve si se cerró y cuál es el destino** | Un `closeTab` síncrono con el guardado «que ya se hará»; que la interfaz guarde primero y luego llame a un `closeTab` tonto | Cerrar es **guardar → comprobar → desalojar**, en ese orden y con una rama de fallo (AC-6, AC-7): partirlo entre el componente y el store deja la mitad interesante en el componente, donde no hay test de store que la persiga. El destino se calcula **antes** de desalojar, sobre `openIds`, porque después ya no está la información |
| 5 | **`open(id)` es *single-flight* por id**, con la promesa en vuelo en un `Map` fuera del estado | Deduplicar en el cliente HTTP; deduplicar por petición en vuelo global | Es el idiom que `apps/web/src/shared/api/http.ts` ya usa en `refreshSession()`, y la `003` lo dejó recomendado por nombre en su §8.1. Fuera del estado por la misma razón que los temporizadores del debounce ya lo están: una promesa no se pinta, y meterla en el store haría que cada apertura provocara dos renders. **Por id y no global** (AC-11): `refreshSession` tiene un solo recurso y esto tiene uno por documento |
| 6 | **`ViewMode` gana `'split'`; no hay un booleano `splitView` aparte** | `viewMode` + `split: boolean` | Con un booleano, `preview` + `split` es un estado representable que no significa nada, y alguien acabará escribiéndolo. Tres valores excluyentes son tres pestañas excluyentes, que es literalmente lo que se ve. Además el conmutador ya recorre una enumeración: el tercer modo no añade ni una rama |
| 7 | **La tira de pestañas se pinta en `AppShell`, entre la cabecera y el `<main>`** | Dentro de `DocumentEditorPage`; en un layout intermedio nuevo | Tiene que **sobrevivir** al documento que muestra: se ve mientras uno carga, se ve con la ruta en `/` si quedan pestañas, y no debe desmontarse y remontarse en cada salto (perdiendo el foco y disparando su región viva). `AppShell` ya se anuncia como «el punto de anclaje de las specs 002–005». Y da gratis el orden de tabulación de AC-27, porque está por encima del `<main>` |
| 8 | **Vista dividida con una retícula de dos columnas fijas, sin separador** | Separador arrastrable con `role="separator"`; `flex` con `resize` de CSS | Decisión **C** de la spec: el separador es un widget ARIA completo, con teclado propio y con una proporción que habría que persistir para que sirviera de algo. Fijo es una clase de Tailwind y un AC de navegador |
| 9 | **En `split` la página deja de estar limitada a `max-w-3xl`** | Dejar el ancho y partirlo en dos | Dos columnas dentro de 768 px son dos columnas inservibles. El ancho es **función del modo**, y AC-19 afirma que crece — sin esa mitad, el defecto pasaría verde en un test que solo mirara «hay dos cajas» |
| 10 | **Un solo `role="tabpanel"`; en `split` contiene las dos regiones**, cada una con nombre | Dos `tabpanel` a la vez; quitar el patrón *tabs* en `split` | El patrón *tabs* tiene **un** panel visible por definición, y `aria-controls` apunta a uno. Modelar `split` como «el panel del modo dividido, que dentro tiene dos regiones con nombre» es honesto y no rompe nada de lo que la `003` verificó. Dos `tabpanel` visibles a la vez sería inventarse una variante del patrón |
| 11 | **Cero cambios en `MarkdownPreview.tsx` y en la cadena de plugins** | Reutilizarlo con una prop de «modo compacto» | La vista dividida cambia **dónde** se pinta, no **qué**. Tocar la cadena obligaría a volver a medir el modelo de amenaza entero (`003/plan.md` §2), y no hay ni una construcción nueva que sanear |
| 12 | **Los ayudantes de e2e se extraen a `apps/web/e2e/support/`, y la extracción unifica** | Dejar la tercera copia; extraer solo `watchConsole` | La regla de la casa es extraer **a la tercera copia**, y esta spec crea la tercera. Extraer solo `watchConsole` sería hacer una fracción del trabajo: la tabla de §5.2 enumera **todos** los ayudantes duplicados, y **dos de ellos ya divergieron**. `e2e/support/**` es contrato de la `001`, así que la extracción deja entrada en su CHANGELOG |

## 2. Contrato de API

**Ninguno.** Esta spec no añade, no quita y no modifica ningún endpoint, ningún DTO ni ningún código
de error. La regla dura de `CLAUDE.md` —toda entrada y toda salida por un DTO explícito, validado y
documentado— se satisface **por omisión**, y AC-32 lo convierte en algo verificable (`git status` en
`apps/api/**` y los recuentos de sus suites idénticos).

Lo que la `005` consume, y lo consume **tal cual**: `GET /api/workspace/documents/:id` (una vez por
documento abierto, y ahora **una de verdad**, AC-10) y `PUT /api/workspace/documents/:id/content`
(sin cambios: mismo cuerpo, mismo `expectedVersion`, mismo `409`).

## 3. Esquema / migración Prisma

**Ninguno.** No hay modelo nuevo, ni columna nueva, ni migración. Si alguna tarea se ve obligada a
tocar `apps/api/prisma/**`, **para y reporta**: significa que la decisión de alcance de §7 de la spec
estaba mal, y eso es un cambio de spec.

## 4. Frontend

### 4.1 Archivos

```
apps/web/src/features/editor/
  editor.store.ts               # + openIds, openTab, closeTab, single-flight; flush deja de desalojar
  editor.store.test.ts          # + los bloques A y B de la spec
  DocumentTabs.tsx              # NUEVO · la tira de pestañas
  DocumentTabs.test.tsx         # NUEVO
  DocumentEditorPage.tsx        # + tercer modo, doble panel, nombre a la región de carga
  DocumentEditorPage.test.tsx   # + bloque C, AC-25, AC-26, AC-27
apps/web/src/app/
  AppShell.tsx                  # + <DocumentTabs /> entre la cabecera y <main>
  AppShell.test.tsx             # + la tira presente/ausente según haya pestañas
  routes.test.tsx               # consultas que dejan de ser inequívocas
apps/web/src/test/
  e2e-support.test.ts           # NUEVO · guarda de AC-30
apps/web/e2e/
  support/editor-e2e.ts         # NUEVO · los ayudantes compartidos (los enumera §5.2)
  support/dev-env.ts            # + E2E_WEB_PORT
  editor.spec.ts                # importa de support/ en vez de definir
  palette.spec.ts               # ídem
  tabs.spec.ts                  # NUEVO · recorrido de pestañas y vista dividida en Chromium
apps/web/playwright.config.ts   # el webServer del web arranca en E2E_WEB_PORT, con --strictPort
```

**Ningún archivo de `packages/shared` ni de `apps/api`.** Ninguno de `src/test/workspace-fixtures.ts`,
`auth-fixtures.ts` ni `api-stub.ts`: ningún tipo cambia y el doble de red ya sabe contar peticiones.

### 4.2 El estado — lo que se añade a `editor.store.ts`

```ts
export interface EditorState {
  readonly entries: Readonly<Record<string, EditorEntry>>;
  /**
   * Pestañas abiertas, en orden de apertura. Invariante (AC-1): su conjunto de ids es
   * exactamente el conjunto de claves de `entries`.
   */
  readonly openIds: readonly string[];

  open: (id: string) => Promise<void>;          // ahora single-flight por id (AC-10…AC-13)
  close: (id: string) => void;                  // (se retira: lo sustituye closeTab)
  closeTab: (id: string) => Promise<CloseResult>;
  setDraft: (id: string, draft: string) => void;
  saveNow: (id: string) => Promise<void>;
  flush: (id: string) => Promise<void>;         // fuerza el guardado y YA NO desaloja
  resolveKeepMine: (id: string) => Promise<void>;
  resolveTakeServer: (id: string) => Promise<void>;
  setViewMode: (id: string, viewMode: ViewMode) => void;
}

/** Lo que la interfaz necesita saber tras pedir un cierre, y nada más. */
export interface CloseResult {
  /** `false` si el guardado forzado falló: la pestaña sigue abierta con su borrador (AC-7). */
  readonly closed: boolean;
  /**
   * A dónde ir si la cerrada era la activa: la vecina de la derecha, si no la de la izquierda,
   * y `null` si no queda ninguna (AC-5). Se calcula **antes** de desalojar.
   */
  readonly next: string | null;
}

export type ViewMode = 'text' | 'preview' | 'split';
```

**`open(id)` queda así**, y el orden de las guardas importa:

1. Si ya hay entrada —**limpia o sucia**—, no hace nada y no pide nada (AC-13).
2. Si hay una lectura en vuelo para ese id, devuelve **su** promesa (AC-10).
3. Si no, arranca la lectura, la guarda en el `Map` por id, y la **libera en el `finally`** (AC-12).
4. Al resolver, crea la entrada **y** añade el id a `openIds` si no estaba (AC-1, AC-2).

El `Map<string, Promise<void>>` va **fuera del estado**, junto a `debounceTimers` y `savesInFlight`,
por el mismo motivo que ellos y con el mismo comentario.

**`closeTab(id)`**, en este orden exacto y sin atajos:

1. Calcula `next` sobre `openIds` (AC-5) — antes de tocar nada.
2. `await flush(id)`, que fuerza lo pendiente y **ya no desaloja**.
3. Si el estado resultante **no** es `clean`, devuelve `{ closed: false, next }` **sin tocar
   `openIds` ni `entries`** (AC-7).
4. Si es `clean`: cancela el debounce, saca el id de `openIds`, desaloja la entrada, y devuelve
   `{ closed: true, next }` (AC-4, AC-6).

**`flush(id)`** conserva su primera mitad literal (cancelar el debounce y forzar el guardado) y
pierde el `drop`. Su comentario de la `003` —«si sale bien descarta la entrada»— se reescribe con el
motivo, no se borra.

### 4.3 El componente — `DocumentTabs.tsx`

Recibe **nada**: lee `openIds` del store del editor, los títulos de `workspace.store` y la pestaña
activa de la ruta. Sin pestañas abiertas **desaparece la tira**, pero **no el componente**.

**Corrección de la v0.1.4, medida al implementar `T-006`.** Este párrafo decía «devuelve `null` si no
hay pestañas abiertas», y era falso de una forma que costaba dos AC. `closeTab` es **asíncrono**, y
entre su desalojo —que ya deja `openIds` vacío— y la reanudación del `await` hay puntos de
comprobación de microtareas en los que React **ya ha vuelto a pintar**. Con `return null`, la región
viva se desmontaba **antes** de que hubiera nada que anunciar: se llevaba por delante el `ref`, el
anuncio de AC-28 y el destino del foco de AC-22, y el foco caía al `<body>` —instrumentado:
`live=undefined`, `after focus active=BODY`—. Lo que se pinta de más sin pestañas es un párrafo
`sr-only` **vacío**; lo que se perdía era AC-28 entero y la cola de AC-22.

```
<div role="tablist" aria-label="Documentos abiertos">        ← una parada de tabulación en total
  <button role="tab" aria-selected id=… aria-controls=…      ← una por id de openIds
          tabIndex={activo ? 0 : -1}
          aria-label="«Notas» · sin guardar · Supr para cerrar">
    Notas <span aria-hidden="true">●</span> <span aria-hidden="true">×</span>
  </button>
  …
</div>
<p role="status" aria-label="Pestañas abiertas" class="sr-only">…</p>
```

- **`aria-controls`** apunta al `<main>` de `AppShell`, que es el que estas pestañas controlan.
  `AppShell` le pone un `id` estable.
- **El nombre accesible lleva el estado** (AC-24) y **la forma de cerrar** (AC-22, AC-23): el punto y
  la cruz son `aria-hidden` porque son la versión visual de algo que ya está dicho con palabras.
  Anunciar «Supr para cerrar» en el nombre es lo que hace descubrible un atajo que, sin ratón, es la
  **única** forma de cerrar (decisión B de la spec).
- **El clic sobre la cruz cierra; el clic en el resto activa.** Se distingue por el objetivo del
  evento, porque un `<button>` dentro de un `<button>` es HTML inválido y la alternativa de la APG es
  experimental (§0).
- **Roving tabindex** y teclado **delegado en el contenedor**, igual que `MarkdownPalette` y
  `WorkspaceTreeView`: el evento nace en el botón enfocado y no hace falta un manejador por pestaña.
- **La región viva** se monta con el componente y está **vacía** hasta el primer cierre, y alterna un
  `U+200B` para volver a anunciar el mismo título — el mecanismo ya está resuelto, medido y comentado
  en `MarkdownPalette.tsx`, y se reutiliza tal cual en vez de inventarse otro.
- **Selección de `openIds` con `useShallow`** (§0): sin él, un selector que derive un array nuevo en
  cada llamada provoca renders en bucle en Zustand 5.

### 4.4 La página — `DocumentEditorPage.tsx`

Tres cambios y ninguno más:

1. **`VIEW_MODES` pasa a `['text', 'preview', 'split']`** y `VIEW_MODE_LABELS` gana `split: 'Dividida'`.
   El `tablist`, las flechas y el `panelId` ya recorren la enumeración: **no hay ninguna rama nueva**.
2. **El panel** deja de ser un ternario de dos ramas y pasa a tres. En `split`:
   ```
   <div role="tabpanel" …>
     <div class="grid gap-4 md:grid-cols-2">
       <section aria-label="Texto">      <textarea …/>          </section>
       <section aria-label="Vista previa"><MarkdownPreview …/>  </section>
     </div>
   </div>
   ```
   y el `<article>` pasa de `max-w-3xl` a un ancho mayor **cuando el modo es `split`** (decisión 9).
3. **La paleta se pinta si el modo es `text` **o** `split`**, una sola vez, fuera de la retícula y
   encima del panel — donde ya está, para no mover el orden de tabulación que AC-27 fija.
4. **El `role="status"` del mensaje de carga gana `aria-label="Carga del documento"`** (AC-26). Es un
   atributo, no un cambio de comportamiento: la tira de pestañas se pinta mientras el documento carga,
   así que en ese instante hay dos regiones y una de ellas era anónima.

### 4.5 `AppShell.tsx`

Una línea de estructura: `<DocumentTabs />` entre `</header>` y `<main>`, y un `id` en el `<main>`
para que las pestañas puedan apuntarle con `aria-controls`. Nada más. El árbol, la cabecera y el
`role="main"` se quedan como están.

### 4.6 Accesibilidad — resumen de lo comprometido

| Qué | Cómo |
|---|---|
| Tira de pestañas | `role="tablist"` con `aria-label="Documentos abiertos"`, `role="tab"` con `aria-selected`, roving tabindex (AC-20) |
| Teclado | `←`/`→` con envolvimiento, `Home`/`End`, `Delete` para cerrar, foco **real** movido (AC-21, AC-22) |
| Cierre | Nombre accesible con el título del documento, nunca «×» ni «Cerrar» (AC-23) |
| Estado sin guardar | En el **nombre accesible**, no solo en el punto de color (AC-24, WCAG 1.4.1) |
| Dos `tablist` en la página | Nombres distintos, y **todas** las consultas por nombre (AC-25) |
| Regiones vivas | Cuatro nombres enumerados, ninguna anidada, la de pestañas montada y vacía (AC-26, AC-28) |
| Orden de tabulación | Pestañas → conmutador → Guardar → paleta → área de texto, **relativo** y contra la cabecera real (AC-27) |
| Vista dividida | Un `tabpanel` con dos `<section>` con nombre (decisión 10) |
| Tamaño de objetivo | Las pestañas y su cruz, ≥ 24 × 24 px CSS — heredado de la práctica de la `004`, medido en el mismo caso de navegador |

## 5. La deuda heredada, con su detalle

### 5.1 `E2E_WEB_PORT` (AC-29)

`dev-env.ts` gana la constante y deriva el origen, **simétrico con lo que ya hace el API**:

```ts
/** Puerto dedicado del web para los e2e, distinto del 5173 de `pnpm dev`. */
export const E2E_WEB_PORT = 5183;
export const E2E_WEB_ORIGIN = `http://localhost:${String(E2E_WEB_PORT)}`;
```

y el `webServer` del web arranca con `pnpm dev --port <puerto> --strictPort`. **`--strictPort` no es
adorno**: sin él, Vite ante un puerto ocupado se muda al siguiente en silencio y Playwright se queda
esperando en una URL donde no hay nadie — cambiar un aborto claro por un cuelgue oscuro sería
empeorar el problema que esto arregla. `vite.config.ts` **no se toca**: el `--port` de la CLI gana al
de la configuración (§0).

### 5.2 Los ayudantes de e2e (AC-30, AC-31)

**No es uno solo.** La `004` anotó `watchConsole` porque fue el que le tocó; el inventario real,
contado en el código:

| Ayudante | `editor.spec.ts` | `palette.spec.ts` | Qué pasa al unificar |
|---|---|---|---|
| `watchConsole` | `(page, ...tolerated: readonly RegExp[])` | `(page)` | **Divergieron.** Sobrevive la tolerante, que es superset (AC-31) |
| `createDocument` | idéntico | idéntico | Se mueve tal cual |
| `textarea` | idéntico | idéntico | Se mueve tal cual |
| `uniqueTitle` | prefijo `'Editor '` | prefijo `'Paleta '` | Se parametriza el prefijo; los títulos siguen siendo distintos por suite, que es para lo que existe |
| El *fixture* `test` con `session` | idéntico | idéntico | Se mueve tal cual, con sus dos resets y su `auto: true` |
| `SAVE_REGION_NAME` | idéntica | idéntica | No es función, pero es la misma duplicación: la constante está escrita en los dos archivos con el mismo valor. Va **en la tabla y no en un párrafo detrás**, porque un elemento fuera de la enumeración es un elemento que no se cuenta |

**La guarda de AC-30** lee el fuente de los archivos de `e2e/*.spec.ts` y falla si alguno **define**
uno de los seis. Vive en `apps/web/src/test/e2e-support.test.ts` porque Vitest solo recoge `src/**`
(§0), y **no puede llevar un comentario que nombre lo que prohíbe**: lee con `readFileSync` y no
distingue código de comentario, que es la lección que la `004` dejó escrita en su §9.6 después de
pagarla.

## 6. Estrategia de tests

| Nivel | Qué cubre | Dónde |
|-------|-----------|-------|
| unit (web, store) | Bloques A y B de la spec: lista de pestañas, invariante de claves, vecina, cierre con guardado y su fallo, single-flight por id | `apps/web/src/features/editor/editor.store.test.ts` |
| unit (web, componente) | Bloque D casi entero: roles, roving, flechas, `Delete`, foco tras cerrar, nombre accesible con estado, región viva | `apps/web/src/features/editor/DocumentTabs.test.tsx` |
| unit (web, componente) | Bloque C, y AC-25/AC-26/AC-27: tres modos, doble panel, preview en vivo, paleta única, regiones y tabulación | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` |
| unit (web, componente) | La tira presente cuando hay pestañas y ausente cuando no; el `<main>` con su `id` | `apps/web/src/app/AppShell.test.tsx` |
| guarda (web) | AC-30: ninguna definición local de los seis ayudantes | `apps/web/src/test/e2e-support.test.ts` |
| e2e (web, Chromium) | AC-19 (disposición real) y el recorrido de pestañas con teclado, que jsdom no puede afirmar | `apps/web/e2e/tabs.spec.ts` |
| e2e (web, entorno) | AC-29, con `pnpm dev` levantado | el propio `test:e2e` |
| e2e (web, presupuesto) | AC-33, con sus tres ventanas y sus dos comandos | `apps/web/e2e/` completo |

**Un solo archivo de navegador nuevo, y con dos casos**, no dos archivos. Cada caso paga una entrada
—y `login` es 10/min por IP— así que repartir lo mismo en más archivos es gastar cupo sin comprar
cobertura. Es la misma política de «gastar menos, no neutralizar más» que la `003` y la `004`.

**Qué no se cubre con test, dicho aquí y no descubierto luego**: cómo locuta un lector de pantalla
real las tres regiones vivas y el cierre de una pestaña. Ni jsdom ni Playwright locutan nada. Es
revisión manual (riesgo #5 de la spec) y **no se escribe un test que finja lo contrario**.

## 7. Orden de ejecución

Deuda de e2e y de entorno (para no medir sobre arena) → store → componente de pestañas y vista
dividida en paralelo → enganche en `AppShell` → barrido de accesibilidad de la página → navegador →
medición de cierre.

El detalle, con dependencias y con dónde está el paralelismo real, en `tasks.md`.

## 8. Qué le deja cerrado esta spec a la `006-editor-undo`

1. **El desalojo tiene dueño y regla**: cambiar de pestaña **no** desaloja; cerrar **sí**. La pila de
   deshacer vive dentro de `EditorEntry`, así que sobrevive a los saltos y muere al cerrar —y eso
   significa que la `006` **no necesita** ni cota, ni expulsión, ni serialización propias: la política
   de la `005` es su cota (spec §6.3).
2. **`setDraft` sigue siendo el único camino de cambio de contenido**, que es donde la `006` va a
   registrar sus transacciones.
3. **`Ctrl`+`S` sigue en la ventana y los atajos de la paleta siguen acotados al `<textarea>`**: hay
   precedente de las dos formas, y `Ctrl`+`Z` va en la segunda.
4. **`Ctrl`+`W` está descartado con motivo** (atajo reservado del navegador). Si la `006` quiere
   atajos de historial, que empiece por ahí: la lista de los que una página **no** puede interceptar
   es más corta de escribir que de descubrir.
