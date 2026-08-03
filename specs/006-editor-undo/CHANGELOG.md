# Changelog — Spec 006 Pila de deshacer/rehacer propia del editor

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.1.3 — 2026-08-01

**Versión de cierre. La spec queda `complete`: 36/36 AC y 10/10 tareas.** Es **patch** y no minor
porque **el recuento no se mueve** —siguen 36 AC y 10 tareas—, ningún AC cambia lo que exige y ningún
artefacto entra ni sale. Lo que trae son **dos precisiones escritas con la medición delante**.

- **Cifras del cierre**: `apps/web` **23 archivos / 607** · `shared` **81** · api unit **21 suites /
  305** · api e2e **22 suites / 511** · `pnpm test:e2e` **12** · `--retries=2 --repeat-each=3`
  **36 passed sin un solo `429`** · `typecheck` y `lint` en **0** · `git status --porcelain packages
  apps/api` **vacío** (AC-34).
- **Precisión (a) — §1.1, con el contrafáctico delante.** Decía que con la pila nativa `Ctrl`+`Z`
  «restaura un estado anterior a la inserción, deshace dos pasos, o no hace nada». **Medido**: se
  desactivó el manejador de historial de la página, se corrió `e2e/undo.spec.ts` y se restauró; en
  Chromium, con una inserción de la paleta justo antes, `Ctrl`+`Z` **no hace absolutamente nada** —el
  `<textarea>` se queda en `hola mundo**texto en negrita**` tras **14 reintentos en 5 s**—. La pila
  nativa no queda impredecible: queda **inservible**. Es un caso particular de lo que la spec decía, y
  el que de verdad ocurre.
- **Precisión (b) — el presupuesto sube de 28 a 31 de 120 por corrida** (criterio < 60). Las tres
  peticiones de diferencia son el documento que crea el caso nuevo, así que la cifra se explica y no
  se acepta a ojo. Medido sondeando Redis **dentro del contenedor**, con el instrumento **validado
  antes contra un valor conocido** — la lección que la `005` pagó con un `pico=0` falso.
- **Dos fallos de instrumento durante el cierre, los dos registrados porque los dos enseñan algo.**
  **(1)** La primera corrida de `--retries=2 --repeat-each=3` dio «cero `429`» y **no valía**: se
  había lanzado `rm -rf packages/shared/dist` en paralelo, que le quitó el módulo debajo, y el `--`
  extra llegó literal a Playwright. La suite **no ejecutó un solo caso**, así que el cero era del
  instrumento y no del contador — exactamente el modo de fallo de la `005`, por otra puerta. **(2)**
  Repetida bien, salió un rojo **real y ajeno** en `smoke.spec.ts`: `getByText(/404/)` casaba con
  **dos** elementos porque el título aleatorio de un documento de otra suite —`Pestañas izquierda
  02740494`— contiene «404» dentro del hex. Violación de modo estricto **latente desde siempre**, que
  solo aparece con el árbol poblado y que **cada suite nueva hace más probable**. Arreglado con
  `getByRole('heading', { name: /404/ })`.
  **`smoke.spec.ts` no estaba en la lista de artefactos de `T-008`**, y queda dicho en vez de
  arreglado en silencio: una línea, consulta estrictamente más fuerte, ningún AC tocado. Misma lección
  que la `T-012` de la `004` — una consulta que puede resolver a otra cosa es una mina puesta para
  otro.
- **Lo que queda sin cobertura automática, sin adornar** (§9.3, sin cambios): cómo locuta un lector
  real el cambio del `<textarea>` tras deshacer · si Firefox sobre Windows entrega `Ctrl`+`Y` a la
  página (la suite es **Chromium-only**) · cuántos bytes ocupa el historial en el montón de V8 —AC-17
  mide el **coste declarado en caracteres**, que es el que la cota usa—. **Ninguna tiene un test que
  finja lo contrario.**

## v0.1.2 — 2026-07-29

**Patch escrito con `T-001` verde. No mueve nada**: siguen **36 AC** y **10 tareas**, ningún AC cambia
de redacción y ningún artefacto entra ni sale. Corrige **`plan.md` §4.2**, no la spec.

- **El `at` de un reemplazo vacío no se especifica.** §4.2 decía que dos textos iguales dan
  `{at: 0, removed: '', inserted: ''}`, y era una forma concreta que no hacía falta: con dos textos
  iguales el prefijo común **agota la cadena**, así que el `at` sale siendo su longitud (medido:
  `diffEdit('sin cambios', 'sin cambios')` → `at: 11`). **Da igual**, porque un reemplazo sin nada
  quitado y nada puesto es un no-op **desde cualquier posición**, y eso es lo único que el resto del
  sistema necesita de él.
- **Se descartó normalizarlo a 0 en el código**, que era la otra salida y la que habría dejado el plan
  intacto: en producción nadie llama a `diffEdit` con dos textos iguales —`setDraft` y `recordWrite`
  salen antes—, así que la rama la ejercitaría **solo el test que la pide**. Es el anti-patrón que la
  `004` rechazó al descartar `execCommand` «con respaldo» (su §9.2): el camino cubierto no sería el
  camino que corre.
- **Qué cambia en el test**: el caso del corpus se queda —sigue estando en AC-1— y pasa a afirmar **el
  no-op y el coste** en vez de la forma. Es la regla que su propia cabecera ya decía y que la
  aserción incumplía: no se afirma cómo se ve un reemplazo, se afirma qué hace.
- **`AC-1` y `AC-2` no se tocan.** Ninguno de los dos mencionaba el `at` de un reemplazo vacío; el
  número solo vivía en el plan, que es exactamente el sitio donde la `005` aprendió que un requisito
  se vuelve invisible.

## v0.1.1 — 2026-07-29

- **Se resuelven las cuatro decisiones abiertas de §9.1, las cuatro en la opción recomendada**, y el
  `Estado` pasa a **approved**. **Es patch y no minor porque el recuento no se mueve**: siguen
  **36 AC** y **10 tareas**, ningún AC cambia de redacción y ningún artefacto entra ni sale — mismo
  criterio con el que la v0.1.1 de la `004` y la v0.1.1 de la `005` se justificaron como patch. Y por
  el convenio de las specs `001` a `005`, **aprobar no sube la versión ni salta a 1.0.0**: lo que
  cambia es el `Estado`; la v0.1.1 sube por el contenido de §9.1.
- **B — no se añade ninguna región viva.** Era **la única de las cuatro que movía el recuento** (una
  quinta `role="status"` habría traído un AC nuevo y habría ampliado `T-006`), y se decidió con el
  argumento en contra delante y no por omisión: quien usa lector de pantalla pulsa `Ctrl`+`Z` y **no
  recibe confirmación explícita**, y eso queda escrito. Pesó que la página ya tiene **cuatro**
  regiones vivas y que la `004` dejó anotado (su riesgo #13) que algunos lectores locutan el
  `aria-label` **además** del contenido, así que una quinta que se dispara en cada `Ctrl`+`Z` de una
  ráfaga es la clase de aviso que enseña a ignorar los avisos. La señal que sí queda es **AC-28**: el
  botón deshabilitado, que es lo que distingue «se acabó el historial» de «esto está roto».
  **La variante intermedia se ofreció y también se descartó** —anunciar **solo el final del
  historial** en vez de cada paso—, y queda escrita en §9.1 porque es la salida por la que habría que
  empezar si la revisión con lector real de §9.3 dijera que la falta de confirmación pesa más de lo
  previsto. **`AC-31` no cambia una coma.**
- **A — el tercer argumento de `setDraft` es opcional**, con la regla de respaldo de `plan.md` §4.5,
  que es **exacta para el tecleo** y solo aproximada para una inserción que envuelve texto; **AC-11
  la hace rompible** en su mitad de cableado (`T-005`).
- **C — el nombre accesible dice `Ctrl`+`Z`, sin rama por plataforma.** Imprecisión conocida en
  macOS, donde el atajo que funciona es `Cmd` —el manejador acepta los dos—; detectar la plataforma
  metería una rama que **ningún test de esta suite ejercitaría**, porque corre solo en Chromium sobre
  Linux. Mismo trato que la `005` le dio a `· Supr para cerrar`.
- **D — la ventana de agrupación son 500 ms.** Es convención y no medida, y así queda dicho; lo que
  está atado es **la relación**, que **AC-10** exige: estrictamente menor que los 1.500 ms del
  debounce.
- **`T-000` hecha y verificada el 2026-07-29**: la `004` queda en **v0.3.1** y su AC-17 ya dice que
  la lista de módulos vigilados crece con cada spec que estrena uno. **Las nueve tareas de código
  siguen sin empezar**, en espera de la señal de arranque del usuario. La línea que mete
  `text-edit.ts` y `undo-history.ts` en `PURE_MODULES` la escriben `T-001` y `T-002`, así que **AC-17
  de la `004` va por delante del código** hasta entonces — igual que les pasó a la `002` y a la `003`
  al ser enmendadas.

## v0.1.0 — 2026-07-29

- Spec inicial (**draft**). **36 AC** en seis bloques y **10 tareas** (`T-000`…`T-009`), **ocho de
  `frontend`** y dos de `orchestrator` (`T-000`, que no toca código, y `T-009`, la de cierre).
- **Alcance: exclusivamente `apps/web`.** Tercera spec seguida sin una sola tarea de `backend`.
  Depende por entero de que el historial **no se persista**, que es lo que la `005` ya decidió en su
  §6.3 al fijar la política de desalojo. §8 deja hecha la comparación de lo que costaría lo
  contrario —tabla, migración, DTO de entrada y de salida, endpoint, tipo en `shared`, secuencia
  forzada entre paquetes y el radio de los fixtures de los dos paquetes— para que la decisión no
  haya que reconstruirla.
- **La decisión de diseño que condiciona todo lo demás queda tomada antes de `tasks.md`** (§2):
  **una transacción guarda un delta, no dos instantáneas**, y la cota se expresa **en caracteres y
  no en transacciones**.
  - **Se rechaza lo que proponía `004/spec.md` §9.3** —instantáneas completas más un límite de «p.
    ej. 200 transacciones»— con la aritmética delante: 200 transacciones × ~400 KB = **~80 MB por
    documento**, y la `005` no pone cota al número de pestañas abiertas. El problema de fondo del
    límite es peor que el tamaño: **200 transacciones de un carácter y 200 que sustituyen el
    documento entero son el mismo número describiendo dos mundos que se diferencian en cuatro
    órdenes de magnitud**. Eso no es una cota.
  - Con deltas, el coste pasa a ser proporcional al **volumen de lo editado**: teclear un carácter
    en un documento de 200.000 cuesta ~1 carácter, y escribir un documento entero desde cero cuesta
    **menos que la copia extra que la entrada ya guarda**. Sin biblioteca de *diff*: recortar
    prefijo y sufijo comunes es exacto para cualquier par de cadenas.
  - **La cota sigue haciendo falta y se dice por qué**: los deltas quitan el caso común, no el
    patológico —seleccionar todo y pegar cuesta dos veces el documento—. Queda
    `UNDO_HISTORY_BUDGET_CHARS = MAX_DOCUMENT_CONTENT_CHARS`, **derivado y no escrito**, que se lee
    «el historial de un documento nunca cuesta más que una copia más del documento más grande que se
    admite». Peor caso por pestaña: tres copias, ~1,2 MB.
  - **Qué se tira**: los pasos más antiguos. **Qué se siente**: `Ctrl`+`Z` retrocede y en algún punto
    deja de hacer nada — y por eso **AC-28** (el botón se deshabilita) no es accesibilidad opcional
    sino la única señal que distingue «se acabó el historial» de «esto está roto».
  - **Excepción escrita como invariante**: la transacción **más reciente nunca se desaloja**, aunque
    ella sola supere el presupuesto (**AC-8**). Sin ella, pegar 200.000 caracteres vaciaría la pila
    incluida la propia transacción de pegar.
  - **Consecuencia no obvia de los deltas**, resuelta en §2.3: fundir una pulsación en el grupo
    abierto exige el texto en que empezó el grupo, que ya no se guarda — **se reconstruye** con
    `applyEdit(before, invertEdit(cima))`, que es literalmente el mismo camino que deshacer. Dos
    recorridos O(n) por tecla mientras hay grupo abierto, y **ni una cadena extra retenida**.
- **Se corrige una imprecisión de `004/spec.md` §9.3 leída contra el código real** (§1.3): «el
  registro va dentro de `setDraft`, que es el único camino que cambia el contenido» es cierto para
  la **interfaz** y falso para el **store** — `readDocument`, `resolveKeepMine` y `resolveTakeServer`
  también escriben `draft`. Las tres quedan decididas en una tabla, y dos de ellas son AC (**AC-21**
  vacía la pila, **AC-22** no la toca). Sin esa tabla, `resolveTakeServer` se habría quedado sin
  decidir, que es justo el caso que §9.3 marcaba como el más peligroso.
- **`openedAt` vive dentro de `UndoState`, no en un `Map` de módulo**, y es decisión y no
  casualidad: los tres `Map`s de módulo de `editor.store.ts` (`debounceTimers`, `savesInFlight`,
  `readsInFlight`) **no los limpia ningún `beforeEach`**, así que un caso que deja algo colgado hace
  fallar al siguiente — le pasó a `T-009` de la `005`. Esta spec **no hereda el problema**, y `T-003`
  lleva la instrucción de parar y reportar si el diseño la empujara a añadir uno.
- **Enmienda a la `004` → v0.3.1 (patch)**, aplicada por `T-000` **sin tocar una línea de código**
  (§7.1): la guarda de pureza de `markdown-palette.test.ts` amplía su lista `PURE_MODULES` con los
  dos módulos nuevos, y su `describe` deja de citar un solo AC. **Patch y no minor** porque no mueve
  el recuento de la `004` —siguen 36 AC y 12 tareas—, ninguno de sus AC cambia de significado, y lo
  único que cambia es el alcance de un instrumento, hacia arriba. Se descarta un archivo de guarda
  nuevo: sería un segundo detector con la misma lista de tokens, es decir, la avería que la `005`
  pagó con los seis ayudantes de e2e.
- **Deuda heredada saldada**: `watchContentSaves` iba por su **segunda** copia (`palette.spec.ts` y
  `tabs.spec.ts`) y `e2e/undo.spec.ts` sería la tercera, así que `T-007` lo extrae a
  `e2e/support/editor-e2e.ts`, amplía el inventario de la guarda y escribe la entrada de cierre en el
  CHANGELOG de la `001` —`e2e/support/**` es contrato suyo—. **Extraer es unificar**: se comprueba
  que las dos copias sean idénticas antes de quedarse con una.
- **Atajos**: `Ctrl`/`Cmd`+`Z`, `Ctrl`/`Cmd`+`Shift`+`Z` y `Ctrl`+`Y`, **acotados al `<textarea>`**
  —precedente de la `004`, y no el de `Ctrl`+`S`, que es de ventana porque guardar es acción de
  página—. La lista de atajos **no interceptables** es la de gestión de ventanas y pestañas
  (`Ctrl`+`W`/`T`/`N`, `Ctrl`+`Shift`+`N`/`T`/`W`, `Ctrl`+`Tab`, `Ctrl`+`1`…`9`, `Alt`+`F4`); los de
  **edición** sí se entregan, y **AC-33 lo demuestra en un navegador de verdad** en vez de afirmarlo
  de memoria. **AC-25** impide con una guarda que un elemento futuro del catálogo de la paleta
  reclame `z` o `y` y rompa el historial en silencio, **sin ningún número escrito a mano**.
- **`preventDefault()` sobre `Ctrl`+`Z` desactiva el deshacer nativo para siempre en esa página, y es
  deliberado** (riesgo #3): la pila nativa ya está invalidada por el control controlado, así que la
  red de seguridad que se retira **ya mentía**.
- **Cuatro decisiones abiertas** (§9.1), las cuatro con recomendación. La única que movería este
  archivo es la **B** —si deshacer se anuncia en una región viva—: la recomendación es **no añadir
  ninguna**, con el argumento en contra escrito, y `tasks.md` deja dicho que `T-006` no empieza sin
  resolverla.
- **Tres cosas declaradas como no cubribles por ningún test de este repositorio** (§9.3), sin
  ningún test que finja lo contrario: cómo locuta un lector real el cambio del `<textarea>` tras
  deshacer; si Firefox sobre Windows entrega `Ctrl`+`Y` a la página (la suite es **Chromium-only**,
  un único *project* en `playwright.config.ts`); y cuántos bytes ocupa de verdad el historial en el
  montón de V8 — **AC-17 mide el coste declarado en caracteres**, que es el que la cota usa, y la
  cuenta de §2.1 es aritmética sobre el modelo, no una medición de `heapUsed`.
- **Cero dependencias nuevas.** Verificado contra el código instalado y contra la documentación
  vigente: `MAX_DOCUMENT_CONTENT_CHARS` = 200.000 en los dos paquetes · `AUTOSAVE_DEBOUNCE_MS` =
  1.500 · atajos ya usados por la paleta = `b`, `i`, `k` (ni `z` ni `y`) · `vi.useFakeTimers()`
  envuelve también `Date`, así que la ventana de agrupación es comprobable sin relojes reales ·
  `page.keyboard.press('ControlOrMeta+z')` es la forma correcta en Playwright 1.62 · react 19.2.8,
  zustand 5.0.14, vitest 4.1.10, jsdom 29.1.1.

---

## Registro de implementación — movido desde `IMPLEMENTATION.md` (2026-08-03)

> Trasladado **literal**, sin podar. El documento de seguimiento había crecido a 3.317 líneas y había
> dejado de servir de índice; el detalle de cada feature pasa a vivir con su feature. Si algo de aquí
> repite lo que ya dice el historial de versiones de arriba, se recorta cuando se tengan los dos
> delante — no antes.


### Fase 8 — Implementación de `006-editor-undo`


Detalle completo en `specs/006-editor-undo/tasks.md`. Spec **aprobada el 2026-07-29 en v0.1.1**, con
**las cuatro decisiones de §9.1 resueltas el mismo día, las cuatro en la opción recomendada**.
**Fase cerrada: 10/10 tareas.** La spec `006` queda **complete** en **v0.1.3**, y con ella se salda
el último defecto que el proyecto había aceptado a sabiendas dejar roto. Todas las tareas las
implementó el orchestrator.
**Cifras del cierre**: `apps/web` **23 archivos / 607** · `shared` **81** · api unit **21 suites /
305** · api e2e **22 suites / 511** · `pnpm test:e2e` **12** · `--retries=2 --repeat-each=3` **36
passed sin un solo `429`** · `typecheck` y `lint` en **0**. Pico de `workspace` **31 de 120 por
corrida** (criterio < 60). La `004` queda en **v0.3.1** y la `001` en **v0.1.4**.

**10 tareas** (`T-000`…`T-009`), **ocho de `frontend`** y dos de `orchestrator` — `T-000`, que no
toca código, y `T-009`, la de cierre, que solo edita `specs/**` e `IMPLEMENTATION.md`.
**Ninguna de `backend`**: la spec toca **exclusivamente `apps/web`**, y `AC-34` lo verifica con los
mismos recuentos con los que lo verificaron la `004` y la `005`.

### Entrada de planificación (2026-07-29)

**Qué es esta spec y qué no.** Es la primera del proyecto que **no añade producto**: con la `005`
cerrada, las cinco capacidades del párrafo de cabecera de `CLAUDE.md` están implementadas. Arregla lo
único que el proyecto había aceptado a sabiendas dejar roto —`Ctrl`+`Z` deshace lo tecleado pero no
una inserción de la paleta— y lo hace donde está la causa: **no es la paleta de la `004`, es el
control controlado de la `003`**. El `<textarea>` recibe su `value` del `draft`, así que toda
escritura programática la reescribe React, y esa reescritura no entra en la pila nativa del
navegador: la invalida.

**Lo que se leyó antes de especificar, y no se supuso**: `editor.store.ts` entero (566 líneas),
`DocumentEditorPage.tsx`, `markdown-insert.ts`, `markdown-palette.ts`, `DocumentTabs.tsx`,
`editor.constants.ts`, el `beforeEach` de `editor.store.test.ts`, las dos guardas de fuente
(`markdown-palette.test.ts` y `src/test/e2e-support.test.ts`), `playwright.config.ts` y los
`package.json`. La tabla de verificaciones previas está en `plan.md` §0, con el archivo y la línea de
cada dato.

**La decisión que más condiciona la spec quedó tomada antes de `tasks.md`, y rechaza lo que la `004`
§9.3 proponía.** Una transacción guarda un **delta** `{at, removed, inserted}` y **no dos
instantáneas**:

- La aritmética: `MAX_DOCUMENT_CONTENT_CHARS` son 200.000 caracteres, ~400 KB por copia en UTF-16, y
  una entrada **ya guarda dos** (`savedContent` + `draft`). Con instantáneas, 200 transacciones —el
  límite que la `004` sugería— son **~80 MB por documento**, y la `005` **no acota el número de
  pestañas abiertas**.
- Pero lo que descarta el límite no es su tamaño: es que **200 transacciones de un carácter y 200 que
  sustituyen el documento entero son el mismo número describiendo dos mundos separados por cuatro
  órdenes de magnitud**. Eso no es una cota.
- Con deltas el coste es proporcional al **volumen de lo editado**: teclear un carácter en un
  documento de 200.000 cuesta ~1 carácter, y escribir un documento entero desde cero cuesta **menos
  que la copia extra que la entrada ya guarda hoy**. Sin biblioteca de *diff*: recortar prefijo y
  sufijo comunes es exacto para cualquier par de cadenas, incluida la sustitución total.
- **La cota sigue haciendo falta y la spec dice por qué**: los deltas quitan el caso común, no el
  patológico —seleccionar todo y pegar cuesta dos veces el documento—. Por eso se expresa **en
  caracteres y nunca en transacciones**: `UNDO_HISTORY_BUDGET_CHARS = MAX_DOCUMENT_CONTENT_CHARS`,
  derivado y no escrito, igual que `CONTENT_COUNTER_THRESHOLD`. Peor caso por pestaña: tres copias,
  ~1,2 MB. **Se tiran los pasos más antiguos**, se siente como que `Ctrl`+`Z` deja de hacer algo, y
  por eso **AC-28** —el botón se deshabilita— es la única señal que distingue «se acabó el historial»
  de «esto está roto». **La transacción más reciente nunca se desaloja** (AC-8), o pegar 200.000
  caracteres vaciaría la pila incluida la propia transacción de pegar.
- **Consecuencia no obvia**: fundir una pulsación en el grupo de tecleo abierto exige el texto en que
  empezó el grupo, que con deltas ya no se guarda. **Se reconstruye** con
  `applyEdit(before, invertEdit(cima))` — que es literalmente el mismo camino que deshacer, así que
  ya está cubierto por sus tests, y **no retiene ni una cadena extra**.

**Una imprecisión heredada, corregida con el archivo delante**: `004/spec.md` §9.3 dice que el
registro va «dentro de `setDraft`, que sigue siendo el único camino que cambia el contenido». Es
cierto para la **interfaz** y **falso para el store**: `readDocument`, `resolveKeepMine` y
`resolveTakeServer` también escriben `draft`. Las tres quedan decididas en una tabla (§1.3) y dos son
AC: `resolveTakeServer` **vacía** la pila (AC-21) y `resolveKeepMine` **no la toca** (AC-22). Sin esa
tabla, el caso que la propia `004` marcaba como el más peligroso se habría quedado sin decidir.

**No hereda la trampa de los `Map`s de módulo.** `debounceTimers`, `savesInFlight` y `readsInFlight`
viven fuera del estado y **ningún `beforeEach` los limpia**, así que un caso que deja algo colgado
hace fallar al siguiente (le pasó a `T-009` de la `005`). Todo el estado nuevo —`openedAt` incluido—
vive dentro de `UndoState`, dentro de `EditorEntry`, y `T-003` lleva la instrucción de **parar y
reportar** si el diseño la empujara a añadir uno.

**Enmienda a una spec cerrada: la `004` sube a v0.3.1 (patch)**, aplicada por `T-000` **sin tocar una
línea de código**. La guarda de pureza de `markdown-palette.test.ts` amplía su lista `PURE_MODULES`
con los dos módulos nuevos. Patch y no minor porque **no mueve el recuento** de la `004` —siguen 36
AC y 12 tareas—, ninguno de sus AC cambia de significado, y lo único que cambia es el alcance de un
instrumento, hacia arriba. Se descartó un archivo de guarda nuevo: sería un segundo detector con la
misma lista de tokens, es decir, la avería que la `005` pagó con los seis ayudantes de e2e.

**Deuda heredada que esta fase salda**: `watchContentSaves` iba por su **segunda** copia
(`palette.spec.ts` y `tabs.spec.ts`) y `e2e/undo.spec.ts` sería la tercera, así que `T-007` lo extrae
a `e2e/support/editor-e2e.ts`, amplía el inventario de la guarda y escribe la **entrada de cierre en
el CHANGELOG de la `001`**, porque `e2e/support/**` es contrato suyo. **Extraer es unificar**: se
comprueba que las dos copias sean idénticas antes de quedarse con una.

**Paralelismo real, dicho sin adornar**: **solo `T-007`**, que no comparte un archivo con ninguna
otra tarea y puede correr desde el principio. `T-001` → `T-002` → `T-003` es una cadena de
dependencia de módulo; `T-004` y `T-005` sí son independientes entre sí y se pueden despachar a la
vez; `T-005` y `T-006` **no**, porque los dos escriben en `DocumentEditorPage.tsx`.

**Tres cosas declaradas como no cubribles por ningún test de este repositorio** (§9.3), y **sin
ningún test que finja lo contrario**: cómo locuta un lector real el cambio del `<textarea>` tras
deshacer; si Firefox sobre Windows entrega `Ctrl`+`Y` a la página —la suite es **Chromium-only**, un
único *project* en `playwright.config.ts`—; y cuántos bytes ocupa el historial en el montón de V8
(AC-17 mide el **coste declarado en caracteres**, que es el que la cota usa; la aritmética de §2.1 es
sobre el modelo, no una medición de `heapUsed`).

**Las cuatro decisiones de §9.1, resueltas el 2026-07-29 y las cuatro en la opción recomendada, sin
mover el recuento**: **A** el tercer argumento de `setDraft` opcional, con regla de respaldo **exacta
para el tecleo** · **B** **no se añade ninguna región viva** —era la única que movía el recuento, y se
cerró con el argumento en contra delante y no por omisión: quien usa lector de pantalla **no recibe
confirmación explícita** al pulsar `Ctrl`+`Z`, y la señal que queda es **AC-28**, el botón
deshabilitado; la variante intermedia (anunciar **solo el final del historial**) se ofreció y también
se descartó, y queda escrita como la salida por la que empezar si la revisión con lector real lo
pidiera— · **C** el nombre accesible dice `Ctrl`+`Z` sin rama por plataforma, imprecisión conocida en
macOS que ninguna suite Chromium-only podría ejercitar · **D** la ventana son 500 ms, convención y no
medida; lo atado es la **relación** que exige AC-10.

**Plan de arranque acordado, para cuando llegue la señal**: `T-000` primero (enmienda documental, con
la guarda de recuentos antes y después y `git status --porcelain apps packages` vacío); después, en
paralelo, la cadena `T-001 → T-002 → T-003` y **`T-007`**, que no comparte un archivo con nadie.

- [x] **T-000** · orchestrator · spec · Enmienda de la `004` a **v0.3.1** — 2026-07-29
      La guarda de pureza de `markdown-palette.test.ts` pasa a vigilar también los dos módulos puros
      que estrena la `006`, y **AC-17 se redacta para que la lista pueda crecer** sin reescribir el
      criterio cada vez: qué módulos añade cada spec lo dice **su propio AC** (la `006`, en su AC-9) y
      el recuento vive en la constante `PURE_MODULES` y en **ningún literal**. **Patch y no minor**
      porque el recuento no se mueve —siguen 36 AC y 12 tareas— y lo que el AC exige de **sus** dos
      módulos es palabra por palabra lo mismo; lo que crece es el alcance de un instrumento. **El
      argumento contrario queda escrito** en el CHANGELOG de la `004`, porque era legítimo: AC-17 sí
      cambia de redacción, y por la letra de `specs/README.md` se podría defender un minor.
      Se descartó **un archivo de guarda nuevo** para la `006`: sería un segundo detector con la misma
      lista de tokens, es decir la avería que la `005` pagó con **seis** ayudantes de e2e duplicados,
      **dos de ellos ya divergidos en firma**. Y **§9.6 de la propia `004` ya lo había anticipado por
      escrito** («la `006` lo volverá a necesitar en cuanto tenga un módulo de historial puro»), así
      que la sección queda dada por cobrada.
      **Consecuencia asumida, la misma que se dieron la `002` y la `003` al ser enmendadas**: desde
      hoy **AC-17 va por delante del código**. La línea que mete `text-edit.ts` y `undo-history.ts` en
      `PURE_MODULES` **no la escribe esta tarea**: la escriben `T-001` y `T-002` de la `006`, cada una
      cuando estrena su módulo — añadirlos antes pondría la guarda en rojo por un archivo ausente, que
      es el fallo de resolución que §9.7 enseña a **no** confundir con un RED.
      Tocados: `004/spec.md`, `004/CHANGELOG.md`, `specs/README.md`, `IMPLEMENTATION.md`.
      Verificado: `rm -rf packages/shared/dist && pnpm test` **antes** → `shared` **81** · `apps/web`
      **21 archivos / 524** · api unit **21 suites / 305**; **después** → **idénticos**. Y el estado
      del árbol bajo `apps/**` y `packages/**` **sin una sola diferencia** respecto al de antes de
      empezar.
      **Precisión sobre el comando `DONE` de `tasks.md`, y va escrita porque el siguiente que lo corra
      se va a tropezar**: la tarea pide `git status --porcelain apps packages` **vacío**, y en este
      árbol **no puede salir vacío** — el trabajo de la `005` está sin commitear, así que hay quince
      entradas que ya estaban antes de tocar nada. Lo que demuestra la guarda no es «vacío», es
      **«idéntico a antes»**, y así se midió: instantánea antes, instantánea después, `diff` sin
      salida. Un criterio que su propio comando no puede cumplir es el defecto que la v0.2.1 de la
      `004` corrigió en su AC-33; aquí se corrige el comando, no la aserción.
- [x] **T-001** · orchestrator · `text-edit.ts`: el álgebra del reemplazo (AC-1, AC-2, AC-9) — 2026-07-29
      RED **de la aserción** con el andamio puesto: **28 rojos** (`expected +0 to be 6`,
      `expected 'hola' to be 'hola gran mundo'`), ninguno de resolución de módulo. GREEN: **77 passed**
      en los dos archivos; `typecheck` y `lint` en **0**.
      **La guarda de pureza pasó desde el andamio**, y se dice en vez de contarlo como cobertura: un
      archivo que todavía no hace nada es puro por construcción. Queda como guarda de regresión.
      **Un hallazgo, y era del plan, no del código**: `diffEdit` con dos textos iguales devuelve `at` =
      longitud del texto, no 0, porque el prefijo común agota la cadena. `plan.md` §4.2 había escrito
      la forma `{at: 0, …}` sin necesitarla. **Se corrigió el plan** (v0.1.2 de la spec) y no el
      código: normalizar a 0 habría añadido una rama que **solo la afirmaría su propio test**, porque
      en producción nadie llama ahí con dos textos iguales —`setDraft` y `recordWrite` salen antes—, y
      una rama cubierta únicamente por el test que la pide es el anti-patrón que la `004` rechazó al
      descartar `execCommand` «con respaldo».
- [x] **T-002** · orchestrator · `undo-history.ts`: pila, fusión y cota (AC-3…AC-8, AC-10) — 2026-07-29
      RED de la aserción: **15 rojos** (`expected [] to have length 1`). GREEN: **68 passed** en sus dos
      archivos, **100** contando el núcleo; `typecheck` y `lint` en **0**.
      **Decisión de implementación que conviene no perder**: el coste **se recorre, no se lleva en un
      contador incremental**. Un contador que se desincroniza de lo que cuenta desaloja de más o de
      menos y no lo nota nadie; el recorrido es una suma sobre unos pocos miles de enteros, una vez por
      escritura. **Consecuencia honesta**: la segunda mitad de AC-7 —«el coste declarado coincide con la
      suma real»— **se cumple por construcción**, así que hoy no puede fallar. Vale como guarda para el
      día en que alguien lo pase a incremental, no como descubrimiento, y así queda escrito.
      **Y un caso que escribí mal y hubo que rehacer**: la segunda mitad de AC-10 —«no se deriva del
      debounce»— la había escrito como una comparación de valores que era **una tautología siempre
      falsa**. Dos constantes con valores distintos pueden estar **atadas** (`UNDO_GROUP_MS =
      AUTOSAVE_DEBOUNCE_MS / 3` pasaría la primera mitad), así que la propiedad es del **código**: se
      comprueba leyendo el fuente y exigiendo que la ventana sea un literal. Mismo patrón que la guarda
      de pureza, y la lección general es que **una propiedad sobre cómo se define algo no se puede
      afirmar mirando su valor**.
- [x] **T-003** · orchestrator · El historial dentro del store (AC-11…AC-17) — 2026-07-29
      RED **real y no por mutación**: se guardó la implementación, se dejó el store en andamio
      —`setDraft` sin registrar y `undo`/`redo` devolviendo `null`— y salieron **7 rojos** de aserción
      (`expected 'hola **foo** mundo' to be 'hola foo mundo'`, `expected null not to be null`,
      `expected [] to have a length of 2`). Restaurada: **55 passed** en el archivo, **23 archivos /
      589** en el paquete; `typecheck` y `lint` en **0**.
      **El caso de AC-14 pasó desde el andamio**, y se dice: es una guarda **negativa** —sin nada que
      deshacer no cambia nada, no ensucia y no pide nada— y una implementación vacía la satisface por
      construcción. Mismo trato que le dio `T-006` de la `005` a sus dos verdes de partida.
      **Desviación de la lista de artefactos, reportada y no silenciada**: el `typecheck` destapó que
      `DocumentTabs.test.tsx` **construye un `EditorEntry`** en un *fixture*, así que añadir el campo
      `undo` lo rompía, y ese archivo **no estaba en la lista de la tarea**. Es exactamente la lección
      que la `002` pagó dos veces, la `004` una y la `005` una: **el radio de un cambio de tipo incluye
      todo lo que construye un valor del tipo**. Aplicado (una línea más su `import`) con el motivo
      escrito dentro del propio *fixture*.
      **Y una desviación de método, dicha sin adornar**: en esta tarea **implementé antes de escribir el
      test**, arrastrado por el `typecheck` del cambio de tipo. El RED se recuperó **de verdad**
      —andamio, medición, restauración— y no por mutación, así que la señal es la que TDD pide; pero el
      orden fue el equivocado y queda registrado en vez de maquillado.
- [x] **T-004** · orchestrator · Frontera con guardado y conflicto (AC-18…AC-22) — 2026-07-30
      **Los cinco casos pasaron desde el primer intento, así que no hay RED que reportar**, y se dice
      en vez de fabricar uno. Dos motivos distintos: AC-18, AC-19 y AC-20 **no piden código propio**
      —los hereda de que deshacer pase por la misma ruta que teclear, que es lo que compró la decisión
      8 del plan—; y la línea de AC-21 (`undo: clearHistory()`) **se había escrito ya en `T-003`**, en
      el mismo lote del store. Eso es un desliz de alcance mío entre tareas, no del diseño.
      **Verificado por mutación, una a una**: **(A)** quitar `undo: clearHistory()` → cae **AC-21**;
      **(B)** hacer que deshacer escriba con `patch` directo en vez de por la ruta única → caen
      **AC-18** y **AC-19**; **(C)** hacer que deshacer fuerce el guardado en vez de programarlo → cae
      **AC-20**. **AC-20 sobrevivió a la (B)**, y por eso hizo falta la (C): sin ella no habría
      constancia de que ese AC mida algo. Restaurado y verde: **60 passed** en `editor.store.test.ts`.
- [x] **T-005** · orchestrator · Atajos acotados al área de escritura (AC-23…AC-26, AC-11 cableado) — 2026-07-30
      RED de la aserción: **6 rojos**. GREEN: **62 passed** en el archivo, **23 archivos / 601** en el
      paquete; `typecheck` y `lint` en **0**.
      **Un caso mío nacía roto y hubo que endurecerlo antes de implementar.** El de `Ctrl`+`Y` afirmaba
      «tras deshacer y rehacer el texto vuelve a la inserción», y eso **también es cierto si ni
      deshacer ni rehacer hacen nada**: pasaba en verde con la página sin tocar. Se le añadió la
      aserción del **paso intermedio**, y con ella el RED subió de 5 a 6 rojos. Es la pregunta que la
      spec exige por AC —«¿qué mutación lo haría caer?»— aplicada al propio test.
      **Y un rojo que no era de la aserción**: el de AC-25 salió como `TypeError` porque
      `HISTORY_SHORTCUT_KEYS` aún no existía — ruido de andamiaje (§9.7 de la `004`); lo correcto habría
      sido exportar la enumeración vacía antes de escribir el caso. Los otros cinco sí eran de aserción.
      **El caso de AC-26 pasó desde el principio**: guarda negativa que una página sin manejador
      satisface por construcción. Queda como regresión.
- [x] **T-006** · orchestrator · Los dos controles y el foco (AC-27…AC-31) — 2026-08-01
      RED: **4 rojos** (`Unable to find an accessible element with the role "button" and name
      "Deshacer · Ctrl+Z"`). GREEN: **68 passed** en el archivo, **23 archivos / 607** en el paquete;
      `typecheck` y `lint` en **0**.
      **Dos casos pasaron desde el principio y se dice cuáles y por qué**: el del foco con atajo —el
      `useLayoutEffect` ya enfocaba, así que es guarda de regresión de lo que dejó `T-005`— y el de
      AC-31, que con los botones aún sin existir no podía fallar; **con los botones puestos sí mide
      algo**, porque cae en cuanto alguien añada una quinta región viva.
      **El campo `focus` de `pendingSelection` es AC-30 entero**: la paleta y los atajos pasan `true`,
      los botones `false`. Sin él, la segunda pulsación de `Enter` sobre el botón escribiría un salto
      de línea en el documento — un defecto que solo aparece navegando con teclado, o sea con el
      público exacto para el que existe el botón.
- [x] **T-007** · orchestrator · `watchContentSaves` a `support/` (AC-36) — 2026-07-29
      RED: se amplió el inventario de la guarda **antes** de mover nada, y señaló los dos archivos que
      lo declaraban por su cuenta (`expected [ …(2) ] to deeply equal []`). GREEN: `test e2e-support` →
      **5 passed** · `pnpm test:e2e` → **11 passed (14,9 s)**, **los mismos casos y los mismos nombres**
      que antes de la extracción · `typecheck` y `lint` en **0**.
      **Las dos copias eran idénticas carácter por carácter**, comentario incluido — y se comprobó
      **antes** de mover, no se supuso. Es la diferencia con la extracción de la `005`, donde dos de los
      seis ayudantes ya habían divergido en firma y extraer fue **elegir**; aquí extraer fue **mover**.
      **Un detalle que sale de rebote**: al irse el ayudante, `tabs.spec.ts` se quedó con un
      `import type { Page }` sin usar (`TS6133`), retirado. `palette.spec.ts` sí lo sigue usando.
      La **`001` sube a v0.1.4** con su entrada de cierre —`e2e/support/**` es contrato suyo— y sus
      ayudantes compartidos pasan a ser **siete**.
- [x] **T-008** · orchestrator · Navegador: el defecto y el tamaño de objetivo (AC-32, AC-33) — 2026-08-01
      El caso pasa, y **el comportamiento roto quedó medido con un contrafáctico** en vez de recordado:
      se desactivó el manejador de historial de la página, se corrió el caso y se restauró.
      **Resultado, y es más concreto que lo que la spec suponía**: sin nuestra pila, `Ctrl`+`Z` en
      Chromium **no hace absolutamente nada** — el `<textarea>` se queda en
      `hola mundo**texto en negrita**` tras **14 reintentos en 5 s**. §1.1 de la spec decía «restaura
      un estado anterior a la inserción, deshace dos pasos, o nada»; con una inserción programática
      justo antes, la pila nativa queda tan invalidada que **la tecla no tiene efecto**. Se precisa la
      spec con la medición delante (**v0.1.3**).
      El caso recorre **los dos caminos** —atajo y botón—, que llegan al store por rutas distintas y de
      los cuales solo el segundo existe para quien no usa teclado físico. Suite de navegador entera:
      **12 passed** (eran 11).
      **Presupuesto afirmado como cota y no como número exacto, con el motivo escrito**: entre las
      acciones del navegador pasan tiempos que el caso no controla, así que el debounce puede vencer
      una vez o dos. Afirmar un número exacto sería afirmar el reloj de la máquina.
- [x] **T-009** · orchestrator · Cierre: alcance y presupuesto (AC-34, AC-35) — 2026-08-01
      **AC-34**: `git status --porcelain packages apps/api` **vacío** · `shared` **81** · api unit
      **305** · api e2e **511**, idénticos a los del cierre de la `005`. **Tercera spec seguida sin
      tocar `packages/shared` ni `apps/api`.**
      **AC-35(a)**: pico de `workspace` **31 de 120 por corrida** (criterio < 60), sondeando Redis
      **dentro del contenedor** y con el instrumento **validado antes contra un valor conocido**
      (se escribió un 42 y se leyó un 42). Eran **28** en la `005`; las tres de diferencia son el
      documento que crea el caso nuevo, así que la cifra se explica en vez de aceptarse a ojo.
      **AC-35(b)**: `--retries=2 --repeat-each=3` → **36 passed sin un solo `429`**, y **sin cifra**,
      a propósito.
      **Dos fallos de instrumento, y el aviso de esta misma tarea se cobró en su propia ejecución.**
      **(1)** La primera corrida de `--repeat-each` dio «cero `429`» y **no valía**: se había lanzado
      `rm -rf packages/shared/dist` **en paralelo** con la suite —le quitó el módulo debajo— y el `--`
      extra llegó literal a Playwright. **La suite no ejecutó un solo caso.** Otro cero de un
      instrumento desconectado, por otra puerta que la de la `005`. **La regla se amplía**: los
      comandos se corren desde estado limpio **y de uno en uno**; preparar el estado mientras algo lo
      usa es desconectarlo.
      **(2)** Repetida bien, salió un rojo **real y ajeno**: `smoke.spec.ts` casaba `getByText(/404/)`
      con **dos** elementos, porque el título aleatorio de un documento de otra suite —`Pestañas
      izquierda 02740494`— contiene «404» dentro del hex. **Violación de modo estricto latente desde
      siempre**, que solo aparece con el árbol poblado y que **cada suite nueva hace más probable**.
      Arreglado con `getByRole('heading', { name: /404/ })`. **El archivo no estaba en la lista de
      artefactos de `T-008`** y queda dicho en vez de arreglado en silencio: una línea, consulta
      estrictamente más fuerte, ningún AC tocado. Misma lección que la `T-012` de la `004`.

**Fase 8 cerrada: 10/10 tareas.** La spec `006` queda **complete** en **v0.1.3**. Con ella, el
producto de `CLAUDE.md` está implementado **y** el último defecto conocido que el proyecto había
aceptado a sabiendas queda saldado: `Ctrl`+`Z` deshace una inserción de la paleta, devolviendo el
texto **y la selección** que había.

**Lo que queda sin cobertura automática, escrito sin adornar**: cómo locuta un lector real el cambio
del `<textarea>` tras deshacer · si Firefox sobre Windows entrega `Ctrl`+`Y` a la página (la suite es
**Chromium-only**, un único *project*) · cuántos bytes ocupa el historial en el montón de V8 —AC-17
mide el **coste declarado en caracteres**, que es el que la cota usa—. **Ninguna de las tres tiene un
test que finja lo contrario**, y ninguna es deuda de código: son revisiones manuales declaradas.

### El riesgo #10 de la `005`, cobrado tal cual (2026-07-29)

`pnpm test` de los tres paquetes salió con **1 rojo** que **no aparece corriendo el paquete solo**:
`DocumentEditorPage.test.tsx > contador de caracteres (AC-30)`, con `Test timed out in 5000ms`. **No es
una regresión y no es de la `006`**: es un caso de la `003` que no toca nada de lo añadido aquí.

**Se reconoce por la duración, no por el mensaje**, que es literalmente la regla que la `005` dejó
escrita: el caso declara **7.085 ms** dentro de un archivo que tardó **17.343 ms**, con `tests
108,80 s` y `environment 112,51 s` para 32,60 s de reloj — tres paquetes compitiendo por la máquina.
Corridos por separado: `apps/web` **23 archivos / 589 passed en 10,34 s** · api unit **21 suites /
305** · `shared` **81**. **No se sube el `testTimeout`**: cambiaría un síntoma ruidoso por uno
silencioso.


### Nota del índice — movida desde `specs/README.md` (2026-08-03)

El índice volvió a ser una línea por spec; esta era su fila, literal.

- **Feature**: Editor undo — pila de deshacer/rehacer propia del editor
- **Versión**: **0.1.3**
- **Depende de**: 005

**Estado tal como estaba escrito**: **complete** (2026-08-01) — **36/36 AC** y **10/10 tareas** (`T-000`…`T-009`), verificadas con su comando y su salida real · `apps/web` **23 archivos / 607** · `shared` **81** · api unit **305** · api e2e **511** · `test:e2e` **12** · `--retries=2 --repeat-each=3` **36 passed sin un solo `429`** · typecheck y lint en **0**. **Presupuesto con su ventana pegada**: pico de `workspace` **31 de 120 por corrida** (criterio < 60), sondeando Redis **dentro del contenedor** y con el instrumento **validado antes contra un valor conocido**; eran 28 en la `005`, y las tres de diferencia **se explican** — son el documento que crea el caso nuevo. **La v0.1.3 es la versión de cierre y es patch**: el recuento no se mueve y ningún AC cambia lo que exige. Trae dos precisiones **con la medición delante**: (a) §1.1 decía que con la pila nativa `Ctrl`+`Z` «restaura un estado anterior, deshace dos pasos, o no hace nada», y medido con un **contrafáctico** en Chromium —desactivar el manejador, correr el caso, restaurar— resulta que **no hace absolutamente nada**: la pila nativa no queda impredecible, queda **inservible**; (b) el pico de cupo sube de 28 a 31. **Dos fallos de instrumento durante el cierre, los dos registrados**: la primera corrida de `--repeat-each` dio «cero `429`» y **no valía** —se lanzó `rm -rf packages/shared/dist` **en paralelo** y el `--` extra llegó literal a Playwright, así que la suite **no ejecutó un solo caso**—, de donde la regla se amplía a «desde estado limpio **y de uno en uno**»; y la repetición bien hecha destapó un rojo **real y ajeno** en `smoke.spec.ts`, donde `getByText(/404/)` casaba con **dos** elementos porque el título aleatorio de otro documento contenía «404» en su hex — **violación de modo estricto latente desde siempre**, arreglada por rol y **reportada por estar fuera de la lista de artefactos**. **La v0.1.1 resuelve las cuatro decisiones abiertas, las cuatro en la opción recomendada y sin cambiar el alcance**: el recuento no se mueve (siguen 36 AC y 10 tareas), ningún AC cambia de redacción y ningún artefacto entra ni sale, así que es **patch**. **B** —la única que movía el recuento— se cierra **sin añadir ninguna región viva**, con el argumento en contra escrito y no por omisión (quien usa lector de pantalla no recibe confirmación explícita al pulsar `Ctrl`+`Z`); pesó que la página ya tiene **cuatro** y que algunos lectores locutan el `aria-label` **además** del contenido, y la señal que queda es **AC-28**, el botón deshabilitado. La variante intermedia —anunciar **solo el final del historial**— se ofreció y también se descartó, y queda escrita como la salida por la que empezar si la revisión con lector real lo pidiera · **A** el tercer argumento de `setDraft` opcional, con regla de respaldo **exacta para el tecleo** · **C** el nombre accesible dice `Ctrl`+`Z` **sin rama por plataforma** (imprecisión conocida en macOS; la rama no la ejercitaría ningún test de una suite Chromium-only) · **D** la ventana son **500 ms**, convención y no medida — lo atado es la **relación** que exige AC-10. **No añade producto**: con la `005` cerrada las cinco capacidades de `CLAUDE.md` ya están implementadas, así que esta arregla lo único que el proyecto había aceptado a sabiendas dejar roto — `Ctrl`+`Z` deshace lo tecleado pero **no** una inserción de la paleta. **Y el culpable no es la paleta**: es el **control controlado**, que existe desde la `003` (el `<textarea>` recibe su `value` del `draft`, así que toda escritura programática la reescribe React y esa reescritura no entra en la pila nativa: la invalida). **Alcance: exclusivamente `apps/web`**, tercera spec seguida sin una tarea de `backend`, y depende por entero de que el historial **no se persista** — lo decidió la `005` en su §6.3 al fijar el desalojo, así que esta spec **no necesita expulsión, ni serialización, ni cota de vida propias**. **La decisión de diseño que lo condiciona todo queda tomada antes de `tasks.md` (§2), y rechaza lo que proponía `004/spec.md` §9.3**: una transacción guarda un **delta** `{at, removed, inserted}` y **no dos instantáneas**, con la aritmética delante — 200 transacciones × ~400 KB son **~80 MB por documento** y la `005` no acota el número de pestañas; y el problema de fondo del límite «200 transacciones» es peor que su tamaño, porque **200 transacciones de un carácter y 200 que sustituyen el documento entero son el mismo número describiendo dos mundos separados por cuatro órdenes de magnitud**. Con deltas el coste es proporcional al **volumen editado**: escribir un documento entero desde cero cuesta **menos que la copia extra que la entrada ya guarda**, y sin biblioteca de *diff* (recortar prefijo y sufijo comunes es exacto para cualquier par). **La cota sigue haciendo falta** —pegar el documento entero cuesta dos veces su tamaño— y por eso se expresa **en caracteres y nunca en transacciones**: `UNDO_HISTORY_BUDGET_CHARS = MAX_DOCUMENT_CONTENT_CHARS`, derivado y no escrito, que se lee «el historial nunca cuesta más que una copia más». Se tiran los pasos **más antiguos**; se siente como que `Ctrl`+`Z` deja de hacer algo, y por eso **AC-28** (el botón se deshabilita) es la única señal que distingue «se acabó el historial» de «esto está roto». **La transacción más reciente nunca se desaloja** (AC-8), o pegar 200.000 caracteres vaciaría la pila incluida ella misma. **Corrige una imprecisión de la `004` §9.3 leída contra el código**: «`setDraft` es el único camino que cambia el contenido» es cierto para la interfaz y **falso para el store** —`readDocument`, `resolveKeepMine` y `resolveTakeServer` también escriben `draft`—, y las tres quedan decididas en una tabla, dos de ellas como AC (`resolveTakeServer` **vacía** la pila, `resolveKeepMine` **no la toca**). **No hereda la trampa de los `Map`s de módulo**: `openedAt` vive dentro de `UndoState` y no al lado del store, a propósito. **Enmienda a la `004` → v0.3.1 (patch)** por `T-000` y sin tocar código: la guarda de pureza amplía su lista `PURE_MODULES` con los dos módulos nuevos (un segundo archivo de guarda sería un segundo detector con la misma lista, la avería que la `005` pagó con seis ayudantes). **Salda la deuda de `watchContentSaves`**: iba por la segunda copia y `e2e/undo.spec.ts` sería la tercera, así que `T-007` lo extrae a `e2e/support/`, amplía la guarda y escribe la entrada de cierre en el CHANGELOG de la `001`. **Tres cosas declaradas no cubribles por ningún test de este repositorio, y sin ningún test que finja lo contrario**: cómo locuta un lector real el cambio del `<textarea>` tras deshacer; si Firefox/Windows entrega `Ctrl`+`Y` (la suite es **Chromium-only**); y cuántos bytes ocupa el historial en el montón de V8 —AC-17 mide el **coste declarado en caracteres**, que es el que la cota usa—. **Cero dependencias nuevas**, con `MAX_DOCUMENT_CONTENT_CHARS` (200.000), `AUTOSAVE_DEBOUNCE_MS` (1.500), los atajos del catálogo (`b`, `i`, `k` — ni `z` ni `y`), el `Date` que `vi.useFakeTimers()` sí envuelve y el `ControlOrMeta` de Playwright 1.62 **verificados contra el código instalado y la documentación vigente**. Historia previa: nació al resolverse la decisión **B** de la `004`, planificada en su §9 con el qué, el porqué y el cómo —incluido por qué `document.execCommand('insertText')` **no es la salida** (deprecado; **jsdom no lo implementa**, o sea verificar el mock; la variante «con respaldo» deja sin cubrir el camino de producción)—, y la `005` le resolvió su restricción el 2026-07-29: **cambiar de pestaña no desaloja** y **cerrar sí**, así que la pila sobrevive a los saltos y **cerrar pierde el historial**
