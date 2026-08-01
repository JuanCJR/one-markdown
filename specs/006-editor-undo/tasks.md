# Tareas 006 — Pila de deshacer/rehacer propia del editor

Spec: `spec.md` **v0.1.1** (**approved** el 2026-07-29, con las cuatro decisiones de §9.1 resueltas) ·
Plan: `plan.md`

**Estado: las 10 tareas cerradas y verificadas (`T-000`…`T-009`). La spec queda `complete` en
v0.1.3.** La `004` queda en **v0.3.1** y la `001` en **v0.1.4**.

**Diez tareas** (`T-000`…`T-009`). **Ocho son de `frontend`** y dos de `orchestrator`: `T-000`, que
**no toca una línea de código**, y `T-009`, la de cierre, que solo edita `specs/**` e
`IMPLEMENTATION.md` — los dos artefactos de los que el `orchestrator` es dueño. **No hay ninguna de `backend`**, porque la spec no toca `packages/shared`
ni `apps/api` (`spec.md` §8, decisión de alcance de §0). Si alguna tarea se ve obligada a tocar
cualquiera de esos dos paquetes, **para y reporta**: significa que la decisión de alcance estaba mal,
y eso es un cambio de spec, no una tarea.

Cada tarea es atómica y sigue RED → GREEN → REFACTOR. El test se escribe primero y **debe fallar
antes** de implementar; el agente reporta **la salida del rojo**.

**Las cuatro decisiones de `spec.md` §9.1 se resolvieron el 2026-07-29, las cuatro en la opción
recomendada, y ninguna mueve este archivo.** La que podía haberlo reescrito cayó del lado que ya
estaba escrito: la **B** —**no se añade ninguna región viva**—, así que **AC-31 se queda como está**,
no entra ninguna tarea y `T-006` puede empezar en cuanto le toque. Las otras tres tampoco mueven
nada: **A** (el tercer argumento de `setDraft` es opcional, con la regla de respaldo de `plan.md`
§4.5), **C** (el nombre accesible dice `Ctrl`+`Z` sin rama por plataforma) y **D** (la ventana son
500 ms). **Siguen 36 AC y 10 tareas, y no hay nada nuevo que hacer aquí.**

---

## Regla de artefactos

Cada tarea enumera **todos** los archivos que puede tocar, tests y fixtures incluidos. **Si un
artefacto no está en la lista de la tarea, no se toca**; si hace falta tocarlo, se para y se reporta.
A la `002` esa lista se le quedó corta **dos veces**, a la `004` una y a la `005` una: siempre por el
mismo motivo, que el radio de un cambio incluye todo lo que construye un valor del tipo.

**Aquí el radio tiene tres formas concretas y conocidas**:

1. **Las cabeceras de los módulos vigilados por la guarda de pureza cuentan como artefacto.** La
   guarda lee el fuente con `readFileSync` y **no distingue código de comentario**: escribir en la
   cabecera de `text-edit.ts` que «no usa `window.`» pone el archivo en rojo, y el rojo es correcto
   (`004` §9.6). A la `004` esto le costó una desviación reportada en su `T-005`.
2. **Extraer un ayudante de e2e toca los dos archivos que tenían la copia**, no solo el destino.
3. **`e2e/support/**` es contrato de la `001`**, así que quien lo toque escribe la entrada de cierre
   en `specs/001-auth/CHANGELOG.md`.

---

## Tareas

- [x] **T-000** · `orchestrator` · `spec` · Enmienda de la spec `004` a **v0.3.1**: la guarda de pureza amplía su alcance — **hecha el 2026-07-29**
      **AC**: ninguno de la `006` — habilita AC-9
      **Depende de**: —
      **Artefactos**: `specs/004-markdown-palette/spec.md` (encabezado y versión, `Estado`, la
      redacción de **AC-17** para que diga que la lista de módulos vigilados **crece con las specs
      que estrenan módulos puros**, y su §9.6) · `specs/004-markdown-palette/CHANGELOG.md` (entrada
      nueva) · `specs/README.md` (filas `004` y `006`) · `IMPLEMENTATION.md` (entrada de
      planificación de la `006`)
      **RED**: no aplica — es una enmienda de documentación. Lo que sí aplica es su **guarda**: se
      corre `pnpm test` **antes y después** y los recuentos tienen que salir **idénticos**, más un
      `git status --porcelain apps packages` **vacío**. Es el procedimiento con el que la `003`
      enmendó a la `002` y la `005` a la `003`.
      **GREEN**: la `004` queda en **v0.3.1 (patch)**, con el motivo escrito y con puntero a
      `006/spec.md` §7.1: **no mueve su recuento** (siguen 36 AC y 12 tareas), ninguno de sus AC
      cambia de significado, y lo único que cambia es el **alcance de un instrumento**, hacia arriba.
      La línea que añade los módulos a `PURE_MODULES` **no la escribe esta tarea**: la escribe `T-001`
      en su RED, porque el módulo todavía no existe.
      **DONE**: `grep -n 'PURE_MODULES\|v0.3.1' specs/004-markdown-palette/spec.md` muestra la
      redacción nueva · `pnpm test` con los mismos recuentos que antes (`shared` **81** · web **21
      archivos / 524** · api unit **305**) · el estado del árbol bajo `apps/**` y `packages/**`
      **idéntico** al de antes de empezar.
      **HECHO — 2026-07-29.** La `004` a **v0.3.1**: AC-17 pasa a hablar de «los módulos puros
      vigilados» y deja dicho que **la lista crece con cada spec que estrena uno**, con el recuento en
      `PURE_MODULES` y en ningún literal; §9.6 queda **dada por cobrada**, porque anticipó esta
      situación por escrito. Tocados: `004/spec.md`, `004/CHANGELOG.md`, `specs/README.md`,
      `IMPLEMENTATION.md`.
      Verificado: `rm -rf packages/shared/dist && pnpm test` **antes** → `shared` **81** · web **21
      archivos / 524** · api unit **21 suites / 305**; **después** → **idénticos**. Árbol de código
      **sin una sola diferencia**.
      **Corrección del propio comando `DONE`, con la medición delante**: pedía `git status --porcelain
      apps packages` **vacío**, y en este árbol **no puede salir vacío** — el trabajo de la `005` está
      sin commitear, así que hay quince entradas que ya estaban antes de tocar nada. Lo que la guarda
      demuestra no es «vacío» sino **«idéntico a antes»**, y así se midió (instantánea antes,
      instantánea después, `diff` sin salida). Es la misma familia de defecto que la v0.2.1 de la
      `004` corrigió en su AC-33 —un criterio que su propio comando de verificación no puede
      cumplir—, con la diferencia de que aquí **se corrige el comando y no se relaja la aserción**.

---

- [x] **T-001** · `frontend` · `text-edit.ts`: el álgebra del delta, y la guarda que la vigila — **hecha el 2026-07-29**
      **AC**: AC-1, AC-2, AC-9 (la mitad de la lista)
      **Depende de**: T-000
      **Artefactos**: `apps/web/src/features/editor/text-edit.ts` (**nuevo**, **incluida su cabecera
      de comentario**, que no puede deletrear ninguno de los seis tokens prohibidos) ·
      `apps/web/src/features/editor/text-edit.test.ts` (**nuevo**) ·
      `apps/web/src/features/editor/markdown-palette.test.ts` (**solo** la constante `PURE_MODULES`
      y el título del `describe`, que pasa a citar AC-17 de la `004` **y** AC-9 de la `006`)
      **RED**: **primero el andamio** (`004` §9.7): se crean las cuatro firmas con cuerpos que
      devuelven un valor vacío, **sin una línea de la lógica**. Con el andamio puesto, el rojo que se
      reporta es **el de la aserción** —del estilo «esperaba `'hola mundo'`, recibí `''`»— y no un
      `Failed to resolve import`. Un RED reportado como fallo de resolución **se devuelve**.
      Casos del RED: el corpus de ida y vuelta de AC-1 (inserción, borrado, sustitución en medio,
      sustitución total, vacío en cada extremo, textos iguales) y la minimalidad de AC-2 con dos
      textos de `MAX_DOCUMENT_CONTENT_CHARS` caracteres que se distinguen en uno solo.
      **GREEN**: `diffEdit` recorta prefijo común y luego sufijo común **sin que los dos recortes se
      solapen** —`before = 'aa'`, `after = 'aaa'` es el caso que lo destapa—; `applyEdit` es un
      `slice`+`slice`; `invertEdit` intercambia `removed` e `inserted` conservando el `at`;
      `editCost` suma las dos longitudes. Textos iguales → `{at: 0, removed: '', inserted: ''}`.
      **DONE**: `pnpm --filter @one-markdown/web test text-edit markdown-palette` en verde ·
      `pnpm --filter @one-markdown/web typecheck` y `lint` en **0**
      **Aviso**: el filtro de `test` de Vitest 4 es **subcadena, no expresión regular**. Dos patrones
      separados por espacio funcionan; `test "a|b"` sale con `No test files found` (`005` v0.1.3).
      **HECHO — 2026-07-29.** RED **de la aserción** con el andamio puesto: **28 rojos**
      (`expected +0 to be 6`, `expected 'hola' to be 'hola gran mundo'`), ni uno de resolución de
      módulo. GREEN: **77 passed** en los dos archivos, `typecheck` y `lint` en **0**.
      **La guarda de pureza pasó desde el andamio**, y se dice en vez de contarlo como cobertura: un
      archivo que todavía no hace nada es puro por construcción. Queda como guarda de regresión.
      **Un hallazgo, y era del plan**: `diffEdit` con dos textos iguales devuelve `at` = longitud del
      texto, no 0, porque el prefijo común agota la cadena. `plan.md` §4.2 había escrito la forma
      `{at: 0, …}` sin necesitarla. **Se corrigió el plan y no el código** (v0.1.2 de la spec):
      normalizar a 0 habría añadido una rama que **solo la afirmaría su propio test**, porque en
      producción nadie llama aquí con dos textos iguales. El caso pasa a afirmar el no-op y el coste.

- [x] **T-002** · `frontend` · `undo-history.ts`: la política de la pila, la fusión y la cota — **hecha el 2026-07-29**
      **AC**: AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 (la otra mitad), AC-10
      **Depende de**: T-001
      **Artefactos**: `apps/web/src/features/editor/undo-history.ts` (**nuevo**, **incluida su
      cabecera**) · `apps/web/src/features/editor/undo-history.test.ts` (**nuevo**) ·
      `apps/web/src/features/editor/editor.constants.ts` (**solo** para añadir `UNDO_GROUP_MS` y
      `UNDO_HISTORY_BUDGET_CHARS`; no se toca nada de lo que ya hay) ·
      `apps/web/src/features/editor/markdown-palette.test.ts` (**solo** para añadir la segunda
      entrada a `PURE_MODULES`)
      **RED**: andamio primero, igual que `T-001`. Casos: dos escrituras dentro de la ventana → **una**
      transacción con el `before` de la primera y el `after` de la segunda (AC-3); las mismas
      separadas por `UNDO_GROUP_MS` exactos → **dos** (AC-4); una escritura con `mergeable: false`
      que **no** se funde con el grupo abierto **y** lo cierra, de modo que el tecleo siguiente
      empieza transacción nueva aunque caiga dentro de la ventana (AC-5, tres subcasos);
      registrar tras deshacer deja `future` vacío (AC-6); superar el presupuesto desaloja por el
      extremo antiguo **y el `cost` declarado coincide con la suma recorrida** (AC-7); una escritura
      mayor que el presupuesto deja **exactamente una** transacción y deshacer la aplica (AC-8);
      `UNDO_GROUP_MS < AUTOSAVE_DEBOUNCE_MS` y son constantes distintas (AC-10).
      **GREEN**: las seis reglas de `plan.md` §4.3 en el orden que fija, con dos precisiones que ya
      están decididas y no se reabren: la fusión **reconstruye** el texto del inicio del grupo con
      `applyEdit(before, invertEdit(cima.edit))` en vez de guardarlo; y si el delta recalculado sale
      de coste 0, la cima **se retira**, porque una transacción que no cambia nada no es un paso.
      `undoStep` y `redoStep` dejan `openedAt` en `null`.
      **DONE**: `pnpm --filter @one-markdown/web test undo-history markdown-palette` en verde ·
      `typecheck` y `lint` en **0**
      **Nota**: `recordWrite` recibe `now` **como argumento**. No lee el reloj, y por eso sus tests
      **no** necesitan temporizadores falsos. El único que llama a `Date.now()` es el store (`T-003`).
      **HECHO — 2026-07-29.** RED de la aserción: **15 rojos** (`expected [] to have length 1`,
      `Target cannot be null or undefined`). GREEN: **68 passed** en sus dos archivos, **100** contando
      el núcleo; `typecheck` y `lint` en **0**.
      **Una decisión de implementación que conviene no perder**: el coste **se recorre, no se lleva en
      un contador incremental**. Un contador que se desincroniza de lo que cuenta desaloja de más o de
      menos y no lo nota nadie; el recorrido es una suma sobre unos pocos miles de enteros y ocurre una
      vez por escritura. La consecuencia honesta es que **la segunda mitad de AC-7 —«el coste declarado
      coincide con la suma real»— se cumple por construcción**, así que hoy no puede fallar: vale como
      guarda de regresión para el día en que alguien lo pase a incremental, no como descubrimiento.
      **Y un caso que escribí mal y hubo que rehacer**: la segunda mitad de AC-10 —«no se deriva del
      debounce»— la había escrito como una comparación de valores que era **una tautología siempre
      falsa**. Dos constantes con valores distintos pueden estar atadas (`UNDO_GROUP_MS =
      AUTOSAVE_DEBOUNCE_MS / 3` pasaría la primera mitad), así que la propiedad es del **código**: se
      comprueba leyendo el fuente y exigiendo que la ventana sea un literal. Mismo patrón que la guarda
      de pureza.

- [x] **T-003** · `frontend` · El historial dentro del store: por documento, dentro de `setDraft`, y deshacer como otro `setDraft` — **hecha el 2026-07-29**
      **AC**: AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17
      **Depende de**: T-002
      **Artefactos**: `apps/web/src/features/editor/editor.store.ts` ·
      `apps/web/src/features/editor/editor.store.test.ts`
      **RED**: casos que fallan con el store de hoy: deshacer devuelve texto **y** selección de los
      dos extremos (AC-11) y rehacer los posteriores (AC-12); tres escrituras y tres deshacer dejan el
      texto inicial —no dos pasos ni un ciclo entre dos estados— (AC-13); deshacer con la pila vacía
      devuelve `null`, no cambia el `draft`, no marca sucio y **no emite ninguna petición** (AC-14);
      con dos documentos abiertos, deshacer en uno no toca el `draft` ni la pila del otro (AC-15); la
      pila sobrevive a `flush(id)` y desaparece con `closeTab(id)` (AC-16); sobre un documento de
      `MAX_DOCUMENT_CONTENT_CHARS` caracteres, teclear **un** carácter deja `cost < 100` (AC-17).
      **GREEN**: `EditorEntry` gana `undo: UndoState`, inicializado a `EMPTY_HISTORY` en
      `readDocument`; `setDraft` gana el tercer argumento opcional (`plan.md` §4.5) y registra
      **antes** del `patch`, con `Date.now()`; `undo(id)` y `redo(id)` piden el paso al módulo y
      escriben por el **camino interno con el registro apagado** —una función `writeDraft(id, draft,
      { record })` que `setDraft` también usa: **no es una segunda ruta de escritura, es la única con
      un interruptor**—; devuelven el `caret` o `null`.
      **DONE**: `pnpm --filter @one-markdown/web test editor.store` en verde y con **más** casos que
      antes · `typecheck` y `lint` en **0**
      **HECHO — 2026-07-29.** RED **real y no por mutación**: se guardó la implementación, se dejó el
      store en andamio —`setDraft` sin registrar y `undo`/`redo` devolviendo `null`— y salieron **7
      rojos** de aserción (`expected 'hola **foo** mundo' to be 'hola foo mundo'`, `expected null not to
      be null`, `expected [] to have a length of 2`). Restaurada la implementación: **55 passed** en el
      archivo, **23 archivos / 589** en el paquete; `typecheck` y `lint` en **0**.
      **El caso de AC-14 pasó desde el andamio**, y se dice: es una guarda **negativa** —sin nada que
      deshacer no cambia nada, no ensucia y no pide nada— y una implementación vacía la satisface por
      construcción. Mismo trato que le dio `T-006` de la `005` a sus dos verdes de partida.
      **Desviación de la lista de artefactos, reportada y no silenciada**: el `typecheck` destapó que
      `DocumentTabs.test.tsx` **construye un `EditorEntry`** en un *fixture*, así que añadir el campo
      `undo` lo rompía. No estaba en la lista de esta tarea. Es **exactamente** la lección que la `002`
      pagó dos veces, la `004` una y la `005` una: el radio de un cambio de tipo incluye **todo lo que
      construye un valor del tipo**. Autorizado y aplicado (una línea, `undo: EMPTY_HISTORY`, más su
      `import`), con el motivo escrito en el propio *fixture*.
      **Y una desviación de método, dicha sin adornar**: en esta tarea **implementé antes de escribir el
      test**, porque el `typecheck` del cambio de tipo me llevó a la cadena de arriba. El RED se
      recuperó **de verdad** —andamio, medición, restauración—, no por mutación, así que la señal es la
      que TDD pide; pero el orden fue el equivocado y queda registrado.
      **Trampa viva, léela antes de empezar**: `debounceTimers`, `savesInFlight` y `readsInFlight`
      son `Map`s de **módulo** y **ningún `beforeEach` los limpia** —`setState(getInitialState(),
      true)` no los alcanza—, así que un caso que deja algo colgado hace fallar al **siguiente**
      (le pasó a `T-009` de la `005`). **Esta tarea no puede añadir ninguno**: todo el estado nuevo,
      `openedAt` incluido, va dentro de `UndoState`. Si te ves necesitando un `Map` de módulo, **para
      y reporta**: significa que el diseño de `spec.md` §2.3 no se sostiene.

- [x] **T-004** · `frontend` · La frontera con el guardado y con el conflicto — **hecha**
      **AC**: AC-18, AC-19, AC-20, AC-21, AC-22
      **Depende de**: T-003
      **Artefactos**: `apps/web/src/features/editor/editor.store.ts` (**solo** `resolveTakeServer`) ·
      `apps/web/src/features/editor/editor.store.test.ts`
      **RED**: tras un guardado correcto, deshacer deja el documento en `dirty` y al vencer el
      debounce emite **un** `PUT` con el texto restaurado (AC-18); deshacer hasta el texto ya guardado
      deja `clean`, cancela el guardado programado y **no emite nada** (AC-19); una ráfaga de deshacer
      dentro de la ventana del debounce produce **una** petición (AC-20); `resolveTakeServer` deja
      `past` y `future` vacíos y el coste en cero (AC-21); `resolveKeepMine` **no toca la pila** y
      deshacer sigue funcionando después (AC-22).
      **GREEN**: **AC-18, AC-19 y AC-20 deberían pasar sin una línea de producción nueva** —los
      hereda de `setDraft`, que es justo lo que la decisión 8 del plan compra—. Si alguno pasa en
      verde desde el RED, **dilo en vez de disfrazarlo**: el caso queda como guarda de regresión y es
      un resultado, no un fallo del proceso (precedente: AC-27 de la `005`). Lo único que exige
      código es `resolveTakeServer`, que añade `undo: clearHistory()` a su `patch`.
      **DONE**: `pnpm --filter @one-markdown/web test editor.store` en verde · `typecheck` y `lint`
      en **0**
      **HECHA.** **Los cinco casos pasaron desde el primer intento, así que no hay RED que reportar**, y
      se dice en vez de fabricar uno. Dos motivos distintos: AC-18, AC-19 y AC-20 **no piden código
      propio** —los hereda de que deshacer pase por la misma ruta que teclear, que es justo lo que
      compró la decisión 8 del plan—; y la línea de AC-21 (`undo: clearHistory()` en
      `resolveTakeServer`) **se había escrito ya en `T-003`**, en el mismo lote de cambios del store.
      Eso último es un desliz de alcance mío entre tareas, no del diseño, y queda anotado.
      **Verificado por mutación, una a una, porque un verde sin rojo no demuestra nada por sí solo**:
      **(A)** quitar `undo: clearHistory()` → cae **AC-21** (`expected { …(4) } to deeply equal`);
      **(B)** hacer que deshacer escriba con `patch` directo en vez de por la ruta única → caen
      **AC-18** y **AC-19** (`to match object { status: 'dirty' }`, `{ status: 'clean' }`);
      **(C)** hacer que deshacer fuerce el guardado en vez de programarlo → cae **AC-20**
      (`expected [ {…} ] to have a length of +0`). **AC-20 sobrevivió a la mutación (B)**, y por eso
      hizo falta la (C): sin ella no habría constancia de que ese AC mida algo.
      Resultado: **60 passed** en `editor.store.test.ts`.

- [x] **T-005** · `frontend` · Los atajos, acotados al área de escritura, y la guarda de colisión — **hecha**
      **AC**: AC-23, AC-24, AC-25, AC-26, **AC-11 en su mitad de cableado**
      **Depende de**: T-003 (no de T-004)
      **Artefactos**: `apps/web/src/features/editor/DocumentEditorPage.tsx` (**solo**
      `handleTextareaKeyDown`, lo que necesite para llamar a `undo`/`redo`, y la llamada de
      `insertElement`, que pasa a mandar `mergeable: false` y **las dos selecciones exactas** —la
      anterior ya la lee del nodo, la posterior la devuelve `applyPaletteElement`—) ·
      `apps/web/src/features/editor/DocumentEditorPage.test.tsx`
      **RED**: con el foco en el `<textarea>`, `Ctrl`+`Z` y `Cmd`+`Z` deshacen **y** el evento queda
      con `defaultPrevented` (AC-23); `Ctrl`/`Cmd`+`Shift`+`Z` y `Ctrl`+`Y` rehacen, y
      `Ctrl`+`Shift`+`Z` **no** deshace (AC-24); el cruce entre `MARKDOWN_PALETTE` y la enumeración
      de teclas de historial es **vacío** (AC-25); con el foco **fuera** del área —en una pestaña de
      la tira, por ejemplo— los atajos no cambian el `draft` (AC-26). **Y el caso de cableado de
      AC-11**: se inserta un elemento desde la paleta con texto **seleccionado**, se deshace, y se
      afirman `selectionStart`/`selectionEnd` del `<textarea>`. Sin él, quitarle las selecciones a la
      llamada de `insertElement` no lo notaría ningún test —la regla del store seguiría verde con las
      que le pasa su propio caso—, que es justo la mutación que este subcaso existe para cazar.
      **GREEN**: el manejador atiende **primero** el historial y **después** el catálogo. La
      enumeración de teclas de historial se **exporta** para que AC-25 la cruce con el catálogo
      **sin ningún número escrito a mano**: el recuento vive en las dos enumeraciones y en ningún
      literal (lección de la `005` v0.1.2).
      **DONE**: `pnpm --filter @one-markdown/web test DocumentEditorPage` en verde · `typecheck` y
      `lint` en **0**
      **Aviso de consulta**: la página tiene **dos** `role="tablist"` («Modo de vista» y «Documentos
      abiertos») y **cuatro** `role="status"`. Toda consulta va **por nombre accesible**;
      `filter({ hasText })` no lee `aria-label` y deja el test verde ante la regresión que dice
      vigilar (`T-012` de la `004`).
      **HECHA.** RED de la aserción: **6 rojos** (`expected '**texto en negrita**…' to be '# Título del
      servidor\n'`). GREEN: **62 passed** en el archivo, **23 archivos / 601** en el paquete;
      `typecheck` y `lint` en **0**.
      **Un caso mío nacía roto y hubo que endurecerlo antes de implementar.** El de `Ctrl`+`Y` afirmaba
      «tras deshacer y rehacer el texto vuelve a la inserción», y eso **también es cierto si ni
      deshacer ni rehacer hacen nada**: pasaba en verde con la página sin tocar. Se le añadió la
      aserción del **paso intermedio** —tras `Ctrl`+`Z` el texto es el del servidor—, y con ella el
      recuento del RED subió de 5 a 6. Es la pregunta que la spec exige por AC —«¿qué mutación lo haría
      caer?»— aplicada al propio test: si no se te ocurre ninguna, el AC no mide lo que crees.
      **Y un rojo que no era de la aserción**: el de AC-25 salió como `TypeError: Cannot read
      properties of undefined`, porque `HISTORY_SHORTCUT_KEYS` todavía no existía. Es ruido de
      andamiaje —§9.7 de la `004`—, y lo correcto habría sido exportar la enumeración vacía antes de
      escribir el caso. Los otros cinco sí eran de aserción.
      **El caso de AC-26 pasó desde el principio**: es una guarda negativa (un atajo fuera del área no
      hace nada) y una página sin manejador la satisface por construcción. Queda como regresión.

- [x] **T-006** · `frontend` · Los dos controles visibles, su estado y el foco que no se roba — **hecha**
      **AC**: AC-27, AC-28, AC-29, AC-30, AC-31
      **Depende de**: T-005. La decisión **B** ya está resuelta —**no se añade región viva**—, así que
      esta tarea no tiene ningún bloqueo de spec pendiente.
      **Artefactos**: `apps/web/src/features/editor/DocumentEditorPage.tsx` (fila de herramientas,
      `pendingSelection` y su `useLayoutEffect`) ·
      `apps/web/src/features/editor/DocumentEditorPage.test.tsx`
      **RED**: los dos controles existen con nombre accesible que **dice su atajo** (AC-27); cada uno
      está deshabilitado exactamente cuando su lado de la pila está vacío, en los cuatro estados
      (AC-28); están en `text` y `split` y **no** en `preview` (AC-29); activar «Deshacer» con `Enter`
      restaura la selección y **el elemento activo sigue siendo el botón**, mientras que con el atajo
      el foco sigue en el `<textarea>` (AC-30); el número de `role="status"` de la página en modo
      texto es el mismo que antes, comparado contra la **enumeración de nombres esperados** y no
      contra un literal (AC-31).
      **GREEN**: `pendingSelection` gana el campo `focus` y el `useLayoutEffect` llama a `focus()`
      **solo si** viene en `true`; la paleta y el atajo pasan `true`, el botón `false`. Los botones
      se pintan junto a «Guardar», con clases que garanticen ≥ 24 × 24 px — el número lo verifica
      `T-008` en el navegador, aquí solo se pinta.
      **DONE**: `pnpm --filter @one-markdown/web test DocumentEditorPage` en verde · paquete **solo**
      (`pnpm --filter @one-markdown/web test`) para descartar cascada · `typecheck` y `lint` en **0**
      **Por qué el foco importa tanto que tiene AC propio**: si el botón enfoca el `<textarea>` al
      activarse, la **segunda** pulsación de `Enter` sobre el botón escribe un salto de línea en el
      documento. Es un defecto que solo aparece navegando con teclado, que es exactamente el público
      para el que existe el botón.
      **HECHA.** RED: **4 rojos** (`Unable to find an accessible element with the role "button" and
      name "Deshacer · Ctrl+Z"`). GREEN: **68 passed** en el archivo, **23 archivos / 607** en el
      paquete; `typecheck` y `lint` en **0**.
      **Dos casos pasaron desde el principio y se dice cuáles y por qué**: el del foco con atajo —el
      `useLayoutEffect` ya enfocaba, así que es guarda de regresión de lo que `T-005` dejó hecho— y el
      de AC-31, que con los botones aún sin existir no podía fallar; **con los botones puestos sí mide
      algo**, porque cae en cuanto alguien añada una quinta región viva.
      **Implementación**: `pendingSelection` gana el campo `focus`, y ese booleano **es AC-30 entero**
      —la paleta y los atajos pasan `true`, los botones `false`—. Los dos controles salen de una
      enumeración `HISTORY_CONTROLS` con su rótulo, su atajo y el lado de la pila que los habilita, para
      no tener dos bloques copiados que puedan divergir.

- [x] **T-007** · `frontend` · `watchContentSaves` a `support/`, y la guarda que lo vigila — **hecha el 2026-07-29**
      **AC**: AC-36
      **Depende de**: — · **corre en paralelo con T-001…T-006**: no comparte un solo archivo con
      ninguna de ellas
      **Artefactos**: `apps/web/e2e/support/editor-e2e.ts` (destino) · `apps/web/e2e/palette.spec.ts`
      (pierde su copia local, línea 207, y lo importa) · `apps/web/e2e/tabs.spec.ts` (ídem, línea
      314) · `apps/web/src/test/e2e-support.test.ts` (**solo** la constante `SHARED_HELPERS`) ·
      `specs/001-auth/CHANGELOG.md` (entrada de cierre)
      **RED**: se añade `'watchContentSaves'` al inventario de `SHARED_HELPERS` **antes** de mover
      nada: la guarda pasa a rojo señalando los dos archivos que lo declaran por su cuenta. Ese es el
      rojo que se reporta.
      **GREEN**: el ayudante vive en `support/editor-e2e.ts` y los dos archivos de casos lo importan.
      **Extraer es unificar**: se comprueba primero si las dos copias son idénticas y se reporta el
      resultado —a la `005` le divergieron dos de seis, y el que las creía iguales medía dos cosas
      distintas—. `e2e/support/**` es contrato de la `001`, así que la entrada de cierre en su
      CHANGELOG es parte del GREEN y no un extra.
      **DONE**: `pnpm --filter @one-markdown/web test e2e-support` en verde ·
      `pnpm test:e2e` con **los mismos casos y los mismos nombres** que antes de la extracción
      (se anota el número de antes y el de después) · `typecheck` y `lint` en **0**
      **Cuidado**: la guarda de `e2e-support.test.ts` también lee el fuente y **no distingue código de
      comentario**. Un comentario en `palette.spec.ts` que escriba `const watchContentSaves` la pone
      en rojo, y el rojo sería correcto.
      **HECHO — 2026-07-29.** RED: se amplió el inventario **antes** de mover nada y la guarda señaló
      los dos archivos que lo declaraban por su cuenta (`expected [ …(2) ] to deeply equal []`).
      GREEN: `test e2e-support` → **5 passed** · `pnpm test:e2e` → **11 passed (14,9 s)**, **los mismos
      casos y los mismos nombres** que antes de la extracción · `typecheck` y `lint` en **0**.
      **Las dos copias eran idénticas carácter por carácter**, comentario incluido — comprobado
      **antes** de mover en vez de suponerlo. Es la diferencia con la extracción de la `005`, donde dos
      de los seis ayudantes ya habían divergido y extraer fue **elegir**; aquí extraer fue **mover**.
      **Un detalle de `typecheck` que sale de rebote**: al irse el ayudante, `tabs.spec.ts` se quedó con
      un `import type { Page }` sin usar (`TS6133`). Retirado. `palette.spec.ts` sí sigue usando `Page`.
      La **`001` sube a v0.1.4** con su entrada de cierre: `e2e/support/**` es contrato suyo, y sus
      ayudantes compartidos pasan a ser **siete**.

- [x] **T-008** · `frontend` · Navegador: el defecto que esta spec arregla, y el tamaño de objetivo — **hecha**
      **AC**: AC-32, AC-33
      **Depende de**: T-006, T-007
      **Artefactos**: `apps/web/e2e/undo.spec.ts` (**nuevo**)
      **RED**: **este RED es el más valioso de la spec y hay que reportarlo entero.** El caso de
      AC-33 —teclear una frase, insertar un elemento de la paleta, pulsar `Ctrl`+`Z`, y exigir que el
      contenido quede **exactamente** en el texto anterior a la inserción— **falla hoy contra el
      producto en producción**, y ese fallo es la demostración de que el problema existe fuera de la
      prosa de la spec. Se anota **qué contenido deja el navegador hoy**, porque es el único registro
      del comportamiento roto que la `006` sustituye. AC-32 mide con `boundingBox()`.
      **GREEN**: ninguno de producción — lo implementaron `T-003`…`T-006`. Si AC-32 saliera por
      debajo de 24 px, **no se debilita la aserción**: se para, se reporta y se pide autorización para
      la clase que falte, como hizo `T-010` de la `005` con la «×» de 19,73 px.
      **DONE**: `pnpm --filter @one-markdown/web test:e2e undo` en verde · suite de navegador entera
      (`pnpm test:e2e`) con **11 + los casos nuevos**
      **Cómo se pulsa el atajo**: `page.keyboard.press('ControlOrMeta+z')` — `ControlOrMeta` resuelve
      a `Meta` en macOS y a `Control` en Windows/Linux (verificado en la documentación de Playwright
      1.62). Y **se usa `watchContentSaves` de `support/`**, no una copia: la extracción es de
      `T-007` precisamente para que este archivo no sea la tercera.
      **HECHA.** El caso pasa en verde, y **el comportamiento roto quedó medido con un contrafáctico**
      en vez de recordado: se desactivó el manejador de historial de la página, se corrió el caso y se
      restauró. Resultado — **sin nuestra pila, `Ctrl`+`Z` en Chromium no hace absolutamente nada**: el
      `<textarea>` se queda en `hola mundo**texto en negrita**` tras **14 reintentos en 5 s**.
      **Es más concreto que lo que la spec suponía** (§1.1 decía «restaura un estado anterior a la
      inserción, deshace dos pasos, o nada»): en este escenario, con una inserción programática justo
      antes, la pila nativa queda tan invalidada que la tecla **no tiene efecto**. La spec se precisa
      con la medición delante en la **v0.1.3**.
      **El caso recorre los dos caminos, y no es repetirse**: el atajo y el botón llegan al store por
      rutas distintas, y la del botón es la única que existe para quien no usa teclado físico.
      **Presupuesto afirmado como cota y no como número exacto, con el motivo escrito**: entre las
      acciones del navegador pasan tiempos que el caso no controla, así que el debounce puede vencer
      una vez o dos. Afirmar un número exacto sería afirmar el reloj de la máquina; la cota (≤ 4)
      protege lo que importa, que las seis escrituras no produzcan una petición cada una.

- [x] **T-009** · `orchestrator` · Cierre: alcance verificado y presupuesto con sus ventanas — **hecha**
      **AC**: AC-34, AC-35
      **Depende de**: T-008
      **Artefactos**: `specs/006-editor-undo/spec.md` (`Estado`, versión de cierre) ·
      `specs/006-editor-undo/CHANGELOG.md` · `specs/README.md` (fila `006`) · `IMPLEMENTATION.md`
      **RED**: no aplica.
      **GREEN**: AC-34 con `git status --porcelain packages apps/api` **vacío** y los recuentos de
      `shared` (**81**), api unit (**305**) y api e2e (**511**) idénticos a los del cierre de la
      `005`. AC-35 con las dos ventanas: (a) pico de `workspace` durante `pnpm test:e2e`, medido
      **dentro del contenedor de Redis**, contra un criterio de **< 60 de 120 por corrida**; (b)
      `--retries=2 --repeat-each=3` afirmando **solo la ausencia de `429`** y **sin cifra**.
      **DONE**: los comandos de arriba, con su salida real pegada en `IMPLEMENTATION.md`
      **Dos avisos que costaron caro la última vez**:
      **(1)** `redis-cli` **no existe en esta máquina** y el CLI `docker` tampoco: se usa
      `docker.exe compose` y se sondea **dentro** del contenedor. **Valida el instrumento contra un
      valor conocido antes de creerte la medida**: la primera sonda del cierre de la `005` dio
      `pico=0` y el cero era del instrumento desconectado, no del contador.
      **(2)** Los comandos se corren **desde estado limpio** (`rm -rf packages/shared/dist` y dejar
      que el flujo lo reconstruya), y un rojo ancho de `pnpm test` se diagnostica **corriendo el
      paquete solo** antes de llamarlo regresión: bajo presión de memoria un test con `testTimeout`
      de 5 s revienta y arrastra a los de al lado. Se reconoce por la **duración**. **No se sube el
      `testTimeout`.**
      **HECHA.** **AC-34**: `git status --porcelain packages apps/api` **vacío** · `shared` **81** ·
      api unit **21 suites / 305** · api e2e **22 suites / 511**, idénticos a los del cierre de la
      `005`. **AC-35(a)**: pico de `workspace` **31 de 120 por corrida** (criterio < 60), sondeando
      Redis dentro del contenedor y con el instrumento validado antes contra un valor conocido (**42**).
      **AC-35(b)**: `--retries=2 --repeat-each=3` → **36 passed sin un solo `429`**, y **sin cifra**, a
      propósito.
      **Y el aviso (2) de esta misma tarea se cobró en su propia ejecución, con una vuelta de tuerca**:
      la primera corrida de `--repeat-each` dio «cero `429`» y **no valía**, porque se había lanzado
      `rm -rf packages/shared/dist` **en paralelo** con la suite y el `--` extra llegó literal a
      Playwright — la suite no ejecutó un solo caso. Un cero de un instrumento desconectado, otra vez y
      por otra puerta. **La regla se amplía**: los comandos se corren desde estado limpio **y de uno en
      uno**; preparar el estado mientras algo lo usa es desconectarlo.
      **Un rojo real y ajeno, destapado por la repetición**: `smoke.spec.ts` casaba `getByText(/404/)`
      con **dos** elementos porque el título aleatorio de un documento de otra suite contenía «404» en
      su hex. Latente desde siempre, más probable con cada suite que crea documentos. Arreglado por
      rol; **el archivo no estaba en la lista de artefactos** y queda dicho.

---

## Definition of Done (todas las tareas)

1. El test se escribió primero y **falló primero**, y el agente reporta **la salida del rojo de la
   aserción** — no la de un `Failed to resolve import`, que es ruido de andamiaje (`004` §9.7).
2. Cada AC de la spec tiene al menos un test automatizado, y para cada uno hay una **mutación
   conocida** que lo tumbaría (`plan.md` §5).
3. Backend: **no aplica**. Ninguna tarea toca `apps/api` ni `packages/shared`; si alguna se ve
   obligada, **para y reporta**.
4. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan.
5. Toda consulta —de producción y de test— pide regiones, `tablist` y landmarks **por su nombre
   accesible**, nunca por su contenido.
6. `IMPLEMENTATION.md` actualizado por el orchestrator con el comando de verificación y su salida
   real.
