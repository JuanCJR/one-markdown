# Changelog — Spec 006 Pila de deshacer/rehacer propia del editor

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

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
