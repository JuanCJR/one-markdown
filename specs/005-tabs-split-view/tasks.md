# Tareas 005 — Pestañas de documentos y vista dividida

Spec: `spec.md` **v0.2.1** (**complete**) (**approved** el 2026-07-29, con las cinco decisiones de §8.1 resueltas) ·
Plan: `plan.md`

**Estado a 2026-07-29: las 12 tareas cerradas y verificadas (T-000…T-011). La spec queda `complete`.**
**Seis de las once de código las implementaron agentes `frontend`** (T-002, T-006, T-008, T-009,
T-010) y el resto el orchestrator.

**Doce tareas** (T-000…T-011). **Once son de `frontend`**; `T-000` es de `orchestrator` y **no toca
una línea de código**. No hay ninguna de `backend` porque la spec no toca `packages/shared` ni
`apps/api` (`spec.md` §7, decisión de alcance de §0). Si alguna tarea se ve obligada a tocar
cualquiera de esos dos paquetes, **para y reporta**: significa que la decisión de alcance estaba mal,
y eso es un cambio de spec, no una tarea.

Cada tarea es atómica y sigue RED → GREEN → REFACTOR. El test se escribe primero y **debe fallar
antes** de implementar; el agente reporta la salida del rojo.

**Las cinco decisiones de `spec.md` §8.1 se resolvieron el 2026-07-29, las cinco en la opción
recomendada, y ninguna mueve este archivo.** Las dos que podían haberlo reescrito cayeron del lado
que ya estaba escrito: la **A** (la tira es `role="tablist"` con botones, así que T-006 y la lista de
consultas de T-009 se quedan como están) y la **D** (**las pestañas no se persisten**, así que no
entra ningún bloque de backend, ninguna tarea de `packages/shared` que no se paralelice con la de
DTO, y ningún fixture de otro paquete al radio de nadie). **Siguen 33 AC y 12 tareas, y no hay nada
nuevo que hacer aquí.**

---

## Regla de artefactos

Cada tarea enumera **todos** los archivos que puede tocar, tests y fixtures incluidos. **Si un
artefacto no está en la lista de la tarea, no se toca**; si hace falta tocarlo, se para y se reporta.
A la `002` esa lista se le quedó corta **dos veces** y a la `004` una, siempre por el mismo motivo: el
radio de un cambio incluye todo lo que construye un valor del tipo, no solo el archivo donde vive.

**Aquí el radio tiene una forma concreta y conocida**: la tira de pestañas se pinta en `AppShell`, así
que aparece en **todos** los tests que montan `routes` con `createMemoryRouter` — que son tres
archivos (`DocumentEditorPage.test.tsx`, `routes.test.tsx`, `AppShell.test.tsx`), no uno. Las
consultas que dejan de ser inequívocas están **enumeradas con archivo y línea** en T-009.

---

## Tareas

- [x] **T-000** · `orchestrator` · `spec` · Enmienda de la spec `003` (AC-28 y AC-22) — **hecha el 2026-07-29**
      **AC**: ninguno de la `005` — habilita AC-8, AC-9 y AC-14
      **Depende de**: —
      **Artefactos**: `specs/003-editor/spec.md` (encabezado y versión, `Estado`, **AC-22**, **AC-28**,
      la línea de §4 «Ver texto y vista previa a la vez», §7 de trazabilidad) ·
      `specs/003-editor/CHANGELOG.md` (entrada nueva) · `specs/README.md` (filas `003` y `005`) ·
      `IMPLEMENTATION.md` (entrada de planificación de la `005`)
      **RED**: no aplica — es una enmienda de documentación. Lo que sí aplica es su **guarda**: se
      corre `pnpm test` **antes y después**, y los recuentos tienen que salir **idénticos**. Es lo que
      demuestra que no se tocó código, junto con un `git status` sin un solo archivo modificado bajo
      `apps/**` ni `packages/**`. Es el mismo procedimiento con el que la `003` enmendó a la `002`.
      **GREEN**: AC-28 de la `003` conserva sus mitades primera y tercera y pierde la segunda (el
      desalojo al desmontar), con el motivo escrito y con puntero a `005/spec.md` §6.1. AC-22 pasa de
      dos modos a tres. **La `003` sube a v0.2.0 (minor)**, resuelto el 2026-07-29 (decisión **E**):
      la garantía que AC-28 le da a la persona no se rompe, se refuerza, y el cambio obliga a tocar
      tests verdes — mismo criterio que la v0.4.0 de la `002`. El argumento contrario (v1.0.0, por la
      letra de la regla) queda escrito en `005/spec.md` §6.1 y **no** se reabre aquí.
      **DONE**: `grep -n 'AC-28' specs/003-editor/spec.md` muestra la redacción nueva ·
      `pnpm test` con los mismos recuentos que antes (`shared` 81 · web 470 · api unit 305 · api e2e
      511) · `git status --porcelain apps packages` **vacío**
      **HECHO — 2026-07-29.** `003` a **v0.2.0** (minor): AC-28 pierde su segunda mitad, AC-22 pasa a
      «un `role="tab"` por cada modo», la línea de §4 queda **tachada y no borrada**, y el `Estado` y
      las dos filas de §7 dicen que **esos dos AC van por delante del código** —mismo trato que la
      `002` se dio con los cinco de su v0.4.0—. Tocados: `003/spec.md`, `003/CHANGELOG.md`,
      `specs/README.md`, `IMPLEMENTATION.md`.
      Verificado: `rm -rf packages/shared/dist && pnpm test` **antes** → `shared` **81** · web 19
      archivos / **470** · api unit 21 suites / **305**; **después** → **idénticos**. Y
      `git status --porcelain apps packages` → **vacío**, que es lo que demuestra que no se tocó
      código.
      **Hallazgo de la guarda, y por eso hizo falta correrla varias veces**: una corrida intermedia de
      `pnpm test` salió con **18 rojos** en tres archivos sin relación entre sí. **No era la
      enmienda**: el primero declaraba **81.782 ms** y murió con `Test timed out in 5000ms`, y los
      otros 17 eran cascada del primero. La suite web **sola** dio **470 passed tres veces seguidas,
      17 s cada una**. Queda como **riesgo #10** de esta spec, con la regla: antes de declarar roja
      una medición, correr el paquete **solo**; y no subir el `testTimeout`, que cambiaría un síntoma
      ruidoso por uno silencioso.

- [x] **T-001** · `frontend` · `E2E_WEB_PORT`: la suite de navegador deja de pelearse con `pnpm dev` — **hecha el 2026-07-29**
      **AC**: AC-29
      **Depende de**: —
      **Artefactos**: `apps/web/e2e/support/dev-env.ts` · `apps/web/playwright.config.ts` ·
      `specs/001-auth/CHANGELOG.md` (entrada de cierre: `e2e/support/**` es contrato suyo) ·
      `specs/001-auth/spec.md` (solo la línea de versión)
      **RED**: con `pnpm dev` levantado, `pnpm --filter @one-markdown/web test:e2e` aborta con
      `http://localhost:5173 is already used` **antes de ejecutar un solo caso** — no hay ningún test
      en rojo, hay un error antes de empezar. Se pega la salida literal.
      **GREEN**: `E2E_WEB_PORT = 5183` y `E2E_WEB_ORIGIN` derivado en `dev-env.ts`; el `webServer` del
      web arranca con `pnpm dev --port <puerto> --strictPort`. **`--strictPort` es obligatorio**: sin
      él Vite se muda al siguiente puerto libre en silencio y Playwright se queda esperando en una URL
      vacía, que es cambiar un aborto claro por un cuelgue oscuro.
      **`vite.config.ts` no se toca** y no está en la lista: el `--port` de la CLI gana al de la
      configuración, verificado en `plan.md` §0.
      **DONE**: con `pnpm dev` levantado, `pnpm --filter @one-markdown/web test:e2e` corre **entera**
      y pasa · y sin `pnpm dev`, también
      **HECHO — 2026-07-29.** RED reproducido literal con `pnpm dev` levantado:
      `Error: http://localhost:5173 is already used`, **antes de ejecutar un solo caso**. GREEN:
      `E2E_WEB_PORT = 5183` con `E2E_WEB_ORIGIN` derivado, y `pnpm dev --port 5183 --strictPort` en el
      `webServer`. Verificado **las dos mitades**: con `pnpm dev` levantado → **9 passed (21,1 s)**;
      sin `pnpm dev` → **9 passed (13,7 s)**. `typecheck` y `lint` de `apps/web` en **0**.
      **`vite.config.ts` no se tocó**, como decía la lista de artefactos.
      **La `001` sube a v0.1.3** (patch) con su entrada de cierre: `e2e/support/**` es contrato suyo.
      Ningún AC suyo cambia y ningún límite de producción se toca.
      **Consecuencia para el resto de la spec**: la precondición «parar `pnpm dev` antes de medir con
      Playwright» **deja de existir** a partir de aquí.

- [x] **T-002** · `frontend` · Los ayudantes de e2e a `support/`, y la extracción **unifica** — **hecha el 2026-07-29**
      **AC**: AC-30, AC-31
      **Depende de**: T-001 (mismo directorio; se secuencian para que `e2e/` tenga un solo dueño)
      **Artefactos**: **NUEVO** `apps/web/e2e/support/editor-e2e.ts` · **NUEVO**
      `apps/web/src/test/e2e-support.test.ts` · `apps/web/e2e/editor.spec.ts` ·
      `apps/web/e2e/palette.spec.ts` · `specs/001-auth/CHANGELOG.md` (segunda entrada de cierre)
      **RED**: la guarda de `src/test/e2e-support.test.ts` falla enumerando las definiciones locales
      que encuentra. **Son seis y están en `plan.md` §5.2**: `watchConsole`, `createDocument`,
      `textarea`, `uniqueTitle`, el *fixture* `test` con `session`, y la constante
      `SAVE_REGION_NAME`. Un `Cannot find module` **no** es este RED: es el andamio (`004/spec.md`
      §9.7).
      **GREEN**: los seis viven en `support/editor-e2e.ts` y los dos archivos los importan.
      `watchConsole` conserva **una** firma, la tolerante (`(page, ...tolerated: readonly RegExp[])`),
      que es superset de la otra — el llamador de la `003` que tolera el `409` provocado sigue
      pasándole su patrón. `uniqueTitle` recibe el prefijo, para que cada suite siga produciendo
      títulos distintos (que es para lo que existe: la cuenta es compartida y los casos corren en
      paralelo).
      **Cuidado, y está pagado**: la guarda lee con `readFileSync` y **no distingue código de
      comentario** (`004/spec.md` §9.6), así que no puede llevar un comentario que nombre lo que
      prohíbe, ni los archivos vigilados pueden mencionarlo en prosa.
      **DONE**: `pnpm --filter @one-markdown/web test e2e-support` → verde ·
      `pnpm --filter @one-markdown/web test:e2e` → las suites `editor` y `palette` **con los mismos
      casos en verde que antes** (se pega el recuento de antes y el de después)
      **HECHO — 2026-07-29, por agente `frontend`.** RED **de la aserción**: la guarda enumeró las
      **12** copias (los seis por cada uno de los dos archivos) con
      `expected [ …(12) ] to deeply equal []`.
      **La guarda se autocomprueba, y eso es la mitad que la hace utilizable**: 4 de sus 5 casos
      verifican que el detector encuentra una **declaración** y **no** marca un `import`, ni una
      llamada, ni confunde `testTitle`/`textareaOf` con `test`/`textarea`. Sin esa mitad, una guarda
      que marcara cualquier mención pediría un arreglo imposible de escribir.
      GREEN: los seis en `e2e/support/editor-e2e.ts`. `watchConsole` conserva la firma **tolerante**
      (AC-31) y el caso del `409` provocado de la `003` le sigue pasando su patrón. `uniqueTitle`
      recibe el prefijo **como parámetro y no como fábrica currificada** —un
      `const uniqueTitle = titlesFor('Editor')` en el archivo vigilado sería exactamente la
      declaración local que la guarda prohíbe—. `session.ts` y `services.ts` **no se tocaron**.
      Verificado: `test e2e-support` → **5 passed** · `test:e2e` → **antes 9 passed (17,8 s)**,
      **después 9 passed (18,4 s)**, con los mismos nombres de caso · `typecheck` y `lint` en **0**.
      **Dos desviaciones reportadas por el agente, las dos correctas**: (1) creó un `tsconfig` de
      usar y tirar fuera de la lista de artefactos —para comprobar que **sus** archivos compilaban
      mientras el `typecheck` del paquete estaba contaminado por el RED en curso de `T-008`— y lo
      borró en la misma orden; `git status` quedó limpio de él, comprobado. La regla de artefactos es
      literal y por eso lo reportó; (2) **encontró que AC-30 decía «cinco» y la enumeración tenía
      seis**. Implementó **seis** —que es lo que dicen `tasks.md` y el cuerpo de §5.2— y **reportó la
      discrepancia en vez de elegir en silencio**. Lo arregla la **v0.1.2** de la spec, quitando el
      número en vez de corregirlo: el recuento pasa a vivir en la tabla y en un solo sitio.

- [x] **T-003** · `frontend` · `openIds`: abrir, cerrar y la vecina — **hecha el 2026-07-29**
      **AC**: AC-1, AC-2, AC-4 (mitad de store), AC-5
      **Depende de**: —  · **Corre en paralelo con T-001 y T-002** (conjuntos disjuntos)
      **Artefactos**: `apps/web/src/features/editor/editor.store.ts` ·
      `apps/web/src/features/editor/editor.store.test.ts`
      **RED**: `Property 'openIds' does not exist on type 'EditorState'` y las aserciones del
      conjunto de claves. La comprobación de AC-1 se escribe como **aserción propia** (comparar los
      dos conjuntos), no como efecto colateral de otro caso: si vive dentro de otra aserción,
      desaparece el día que ese caso cambie.
      **GREEN**: `openIds: readonly string[]`, `open` añade al final si no estaba, y `closeTab`
      —todavía **síncrono y sin guardado**, que llega en T-005— saca el id y desaloja, devolviendo
      `{ closed: true, next }` con la regla de AC-5 calculada **antes** de desalojar.
      **DONE**: `pnpm --filter @one-markdown/web test editor.store`
      **HECHO — 2026-07-29.** RED: **7 rojos y 32 verdes**, y en la **aserción**, no en un módulo que
      falta. GREEN: `openIds: readonly string[]` con inicial `[]`, `open` añadiendo al final **solo si
      no estaba**, `closeTab(id): CloseResult` con la vecina calculada **antes** de desalojar, y el
      tipo `CloseResult` exportado.
      **Decisión de implementación que vale la pena registrar**: la invariante de AC-1 se mantiene
      **por construcción y no por disciplina** — quien quita la entrada (`drop`) quita también el id,
      así que ninguna ruta futura puede dejar una entrada sin pestaña. La alternativa (que cada
      llamante se acuerde de las dos cosas) es la que se rompe en la primera secuencia rara.
      **Y una rama defensiva con criterio**: `closeTab` de un id **no abierto** devuelve
      `{ closed: false, next: null }` y no `{ closed: true }`. Con `closed: true` la interfaz
      navegaría a `/` por un gesto que no ocurrió; y `closed: false` no es una licencia sobre el
      significado que AC-7 le da —«la pestaña sigue abierta»— porque aquí tampoco se cerró nada.
      Verificado: `test editor.store` → **39 passed** · suite web completa → **19 archivos / 477
      passed** (eran 470: +7 casos nuevos, ninguno de los anteriores tocado) · `typecheck` y `lint` en
      **0**.

- [x] **T-004** · `frontend` · `open(id)` *single-flight* por id (deuda de la `003` §8.1) — **hecha el 2026-07-29**
      **AC**: AC-10, AC-11, AC-12, AC-13
      **Depende de**: T-003 (mismo archivo)
      **Artefactos**: `apps/web/src/features/editor/editor.store.ts` ·
      `apps/web/src/features/editor/editor.store.test.ts`
      **RED**: dos `open(id)` concurrentes emiten **dos** peticiones (`expected 1, received 2`).
      **GREEN**: `Map<string, Promise<void>>` fuera del estado, junto a `debounceTimers` y
      `savesInFlight`; se libera en el `finally` (AC-12). Mismo idiom que `refreshSession()` de
      `http.ts`, **pero por id**: una promesa global haría que abrir dos documentos a la vez leyera
      uno solo (AC-11). Y con entrada presente —limpia o sucia— no se pide nada (AC-13), que es el
      cambio consciente respecto de la `003`.
      **DONE**: `pnpm --filter @one-markdown/web test editor.store`
      **HECHO — 2026-07-29.** RED: **2 rojos** (AC-10 y AC-13) y 41 verdes.
      **Y aquí hay algo que registrar, porque cambia cómo se lee este DONE: AC-11 y AC-12 pasaron
      desde el primer momento y no podían no pasar.** Son guardas contra la implementación
      **equivocada**, no contra la ausencia de implementación: antes de `T-004` no había ningún
      single-flight, así que no podía ser ni global ni no liberarse. Un RED artificial habría sido
      teatro —es la misma situación que la `T-012` de la `004`—, así que **se verifican por
      mutación**:
      · **Mutación A**, clave global en vez de por id (`get`/`set`/`delete` sobre `'G'`), que es el
        error natural al copiar el idiom de `refreshSession()` sin adaptarlo: cae **AC-11 y solo
        AC-11** (`1 failed | 42 passed`). Apuntado con precisión.
      · **Mutación B**, la promesa en vuelo **nunca se libera** (se quita el `delete` del `finally`):
        cae **AC-12**, y con él AC-10 y AC-13 y 32 más — porque `readsInFlight` es estado de módulo y
        una promesa que no se limpia **se filtra al caso siguiente**. El estallido es informativo, no
        ruido: enseña por qué el `delete` va en el `finally` y no tras el `await`.
      Las dos mutaciones se revirtieron y la suite volvió a **43 passed** antes de seguir.
      **Nota de diseño, por si alguien la busca**: `readsInFlight` vive **fuera del estado**, junto a
      `debounceTimers` y `savesInFlight`, y como ellos **no se reinicia entre tests** — el `beforeEach`
      reinicia el store, no los mapas de módulo. Es consistente con lo que la `003` dejó montado, y el
      `finally` garantiza la limpieza; la mutación B es justamente lo que pasa cuando esa garantía se
      rompe.
      El cuerpo de la lectura se extrajo a `readDocument(id)`, que **sigue propagando el error** a
      quien llamó: es el contrato que la `003` cerró en su `T-012` y lo que permite a la página
      distinguir `loading` de `missing` y de `error`.
      Verificado: `test editor.store` → **43 passed** · suite web completa → **19 archivos / 481
      passed** (eran 477: **+4**) · `typecheck` y `lint` en **0**.

- [x] **T-005** · `frontend` · El desalojo se muda: `flush` deja de descartar, `closeTab` guarda antes — **hecha el 2026-07-29**
      **AC**: AC-6, AC-7, AC-8, AC-9
      **Depende de**: T-004 (mismo archivo)
      **Artefactos**: `apps/web/src/features/editor/editor.store.ts` ·
      `apps/web/src/features/editor/editor.store.test.ts` ·
      `apps/web/src/features/editor/DocumentEditorPage.test.tsx` (solo los casos de desmontaje que
      hoy afirman el desalojo, y que la enmienda de T-000 vuelve falsos)
      **RED**: (a) el caso «cerrar con borrador sucio emite el `PUT` **antes** de desalojar» falla
      porque `closeTab` no guarda; (b) el caso «si el guardado falla la pestaña sigue abierta» falla
      porque `closeTab` desaloja igual; (c) los casos de desmontaje que hoy esperan que la entrada
      desaparezca fallan **al revés**, y ese rojo es la enmienda de AC-28 hecha visible.
      **GREEN**: `flush(id)` conserva su primera mitad literal (cancelar el debounce y forzar el
      guardado) y **pierde el `drop`**; su comentario se reescribe con el motivo, no se borra.
      `closeTab(id)` pasa a `async` con el orden exacto de `plan.md` §4.2: calcular `next` → `flush` →
      si no quedó `clean`, devolver `{ closed: false }` **sin tocar nada** → si sí, cancelar debounce,
      sacar de `openIds` y desalojar.
      **Cuidado con el orden**: comprobar el estado **después** del `await`, no antes; la entrada pudo
      cambiar mientras la petición volaba, que es la misma precaución que ya toma `patch`.
      **DONE**: `pnpm --filter @one-markdown/web test editor.store DocumentEditorPage` — **dos
      filtros, no una tubería**: el filtro de Vitest 4 es **subcadena y no expresión regular**, así que
      la forma con `|` no encuentra ningún archivo (ver la nota al final de este documento)
      **HECHO — 2026-07-29.** RED: **4 rojos**, los tres previstos más el caso de `flush` de la `003`
      reescrito, que es la enmienda hecha visible. GREEN: `flush` pierde el `drop`, `closeTab` pasa a
      `async` con el orden **calcular vecina → `flush` → comprobar → desalojar**, y el estado se
      comprueba **después** del `await`.
      **Desviación autorizada, y es la decisión de la tarea: se retira `close(id)`.** El plan lo daba
      por retirado («se retira: lo sustituye `closeTab`») pero el GREEN de esta tarea no lo decía. Se
      hace porque dejarlo sería mantener **dos** caminos de desalojo, y el segundo descarta **sin
      guardar**: con pestañas, eso es exactamente el camino por el que alguien pierde su trabajo, y la
      invariante «por construcción» de `T-003` deja de estar garantizada en cuanto hay dos puertas.
      **Ninguna parte de producción lo usaba** (`grep` → solo `flush` en `DocumentEditorPage.tsx`).
      **Consecuencia que la lista de artefactos sí anticipaba y conviene registrar**: el `beforeEach` de
      `DocumentEditorPage.test.tsx` usaba `close(id)` **como mecanismo de aislamiento** —cancelar un
      debounce pendiente del caso anterior—, así que retirarlo puso **44 casos en rojo de golpe** por
      `TypeError`, no por comportamiento. No se resucitó nada: el `afterEach` hace `useRealTimers()`,
      que **desmonta el reloj falso entero**, así que un temporizador del caso anterior no puede
      dispararse en el siguiente; lo único que sobrevive es un identificador muerto en el mapa del
      módulo, y `cancelDebounce` sobre él es un `clearTimeout` que no hace nada. **Comprobado, no
      supuesto**: el archivo corrió **cinco veces seguidas** con el mismo resultado (43 verdes y el
      único rojo esperado) antes de tocar el caso de desmontaje.
      **Los dos casos que afirmaban el desalojo se reescriben, no se borran**, y con el porqué al lado:
      el de `flush` en `editor.store.test.ts` y el de desmontaje en `DocumentEditorPage.test.tsx`. La
      mitad que no cambia —que el guardado pendiente **se fuerza**— se afirma explícitamente en los
      dos, para que la enmienda no se lea como «AC-28 ya no garantiza nada».
      **El caso de `close` de la `003` se retira y su aserción se hereda**: «el debounce pendiente no
      emite nada después de cerrar» pasa a afirmarse dentro del caso de AC-6, sobre `closeTab`.
      Verificado: `test editor.store` → **46 passed** · suite web completa → **19 archivos / 484
      passed** (eran 481: **+3**) · `typecheck` y `lint` en **0** · `test:e2e` → **9 passed (25,1 s)**,
      que es lo que comprueba que el cambio no rompe la aplicación en marcha y no solo los tests.

- [x] **T-006** · `frontend` · `DocumentTabs`: tira de pestañas, teclado, cierre y región viva — **hecha el 2026-07-29**
      **AC**: AC-3, AC-20, AC-21, AC-22, AC-23, AC-24, AC-28
      **Depende de**: T-005 · **Corre en paralelo con T-008** (archivos disjuntos)
      **Artefactos**: **NUEVO** `apps/web/src/features/editor/DocumentTabs.tsx` · **NUEVO**
      `apps/web/src/features/editor/DocumentTabs.test.tsx`
      **RED**: `Cannot find module './DocumentTabs'` **no basta** —es el andamio, `004/spec.md` §9.7—:
      el rojo que vale es el de la primera aserción con el componente ya creado y vacío, empezando por
      los roles y el nombre.
      **GREEN**: la estructura de `plan.md` §4.3. Cinco cosas que no son negociables y que el test
      persigue una a una:
      1. **Roving tabindex**: una sola parada de tabulación para N pestañas (AC-20).
      2. **Flechas con envolvimiento, `Home`/`End`, y foco real** (`document.activeElement`). El caso
         se escribe con **tres** pestañas —con dos, «envolver» e «ir a la otra» son indistinguibles— y
         con un viaje de **ida y vuelta**, para que no acabe midiendo dónde arranca el foco (es la
         corrección que la `004` tuvo que hacer a su AC-32).
      3. **`Delete` cierra y el foco pasa a la vecina**, nunca al `<body>` (AC-22). **No `Ctrl`+`W`**:
         es un atajo reservado del navegador y una página no puede interceptarlo.
      4. **El nombre accesible lleva el título, el estado sin guardar y cómo se cierra** (AC-23,
         AC-24). El punto y la cruz son `aria-hidden`: son la versión visual de algo ya dicho con
         palabras, y un estado que solo se ve por el color incumple WCAG 1.4.1.
      5. **Región viva montada desde el primer render y vacía**, con el reanuncio por `U+200B`
         (AC-28). Las dos mitades son lecciones ya pagadas por la `004` (sus AC-27 y AC-36), y el
         mecanismo se **reutiliza** de `MarkdownPalette.tsx` en vez de inventarse otro.
      `openIds` se selecciona con `useShallow` de `zustand/react/shallow` (verificado en `plan.md`
      §0): en Zustand 5 un selector que derive un array nuevo en cada llamada provoca renders en
      bucle.
      **DONE**: `pnpm --filter @one-markdown/web test DocumentTabs`
      **HECHO — 2026-07-29, por agente `frontend`.** RED **con andamio y de la aserción**: creó el
      componente devolviendo `null`, sin una línea de lógica, para que el rojo no fuera un
      `Failed to resolve import` — **17 rojos de 19** (`Unable to find an accessible element with the
      role "tablist" and name "Documentos abiertos"`). **Los 2 verdes de partida son las dos guardas
      negativas** (no pinta tira sin pestañas; no introduce ni un `listitem`), que un componente vacío
      satisface por construcción: están para vigilar una regresión, no para conducir el diseño, y el
      agente lo dijo en vez de disfrazarlas de cobertura.
      GREEN, con el detalle que importa de cada AC: roving tabindex con la parada siguiendo al foco;
      flechas de **ida y vuelta completa** sobre **tres** pestañas afirmando `document.activeElement`
      en cada paso; `Delete` con **casos separados** para la vecina de la derecha y la de la
      izquierda, más el `not.toBe(document.body)`; nombre accesible
      `«Notas» · sin guardar · Supr para cerrar`, con el test demostrando **por los dos lados** que el
      punto y la «×» están en el `textContent` y **no** en el `aria-label`; región viva montada desde
      el primer render y **vacía**, con el `U+200B` reutilizado tal cual de `MarkdownPalette.tsx`; y
      el caso de reanuncio con **dos documentos distintos del mismo título**, que es el escenario que
      de verdad puede colapsar el anuncio.
      **Decisión B verificada por el lado negativo**: `within(tab).queryAllByRole('button')` es **0**
      en todas las pestañas — la «×» es un `<span>`, no un botón anidado.
      **Desviación con motivo medido, y corrige el plan**: `plan.md` §4.3 decía «devuelve `null` si no
      hay pestañas abiertas» y **era falso de una forma que costaba dos AC**. `closeTab` es asíncrono
      y React repinta entre su desalojo y la reanudación del `await`, así que el `return null`
      desmontaba la región viva **antes** de que hubiera nada que anunciar, y el foco caía al
      `<body>` (instrumentado: `live=undefined`, `after focus active=BODY`). **Lo cazó el test de
      AC-22**, que es justo lo que ese AC existe para hacer. Corregido en la **v0.1.4**: sin pestañas
      desaparece **la tira**, no el componente.
      **Dos apuntes que cambian `T-007`**: exporta `EDITOR_PANEL_ID` desde `DocumentTabs.tsx` —la
      dependencia al revés obligaría a la tira a importar del contenedor que la pinta—, y **la
      navegación vive en el componente**, porque `AppShell` lo monta sin props. Por eso **AC-4 pasa de
      `T-007` a `T-006`** en la trazabilidad (v0.1.4), y `T-007` se queda con lo que de verdad le
      toca.
      Verificado: `test DocumentTabs` → **19 passed** · paquete **solo**, para descartar hambre de
      máquina → **21 archivos / 515 passed** en 14,05 s · `typecheck` y `lint` en **0**.

- [x] **T-007** · `frontend` · Enganche en `AppShell` (la navegación se la quedó `T-006`) — **hecha el 2026-07-29**
      **AC**: AC-4 (mitad de interfaz)
      **Depende de**: T-006 · **Corre en paralelo con T-008**
      **Artefactos**: `apps/web/src/app/AppShell.tsx` · `apps/web/src/app/AppShell.test.tsx` ·
      `apps/web/src/app/routes.test.tsx` (solo si alguna consulta deja de ser inequívoca; se
      comprueba, y si no hace falta se dice)
      **RED**: el caso «con dos documentos abiertos, la tira está en el shell y sobrevive al saltar
      entre ellos» falla porque `AppShell` no la pinta.
      **GREEN**: `<DocumentTabs />` entre `</header>` y `<main>`, y `EDITOR_PANEL_ID` —que `T-006`
      exporta desde `DocumentTabs.tsx`— como `id` del `<main>`, para que las pestañas puedan apuntarle
      con `aria-controls`.
      **Ajuste de alcance de la v0.1.4, con `T-006` verde**: la navegación **ya no es de esta tarea**.
      Vive en `DocumentTabs`, porque `AppShell` lo monta **sin props** y no había otro sitio donde
      pudiera estar sin obligar a esta tarea a editar un archivo ajeno; **AC-4 pasó a `T-006`**. Lo
      que queda aquí es el montaje, el `id`, y comprobar que la tira **sobrevive** al saltar entre
      documentos y a que la ruta no sea un documento.
      **Restricción de estructura, y está medida**: la tira **no puede introducir `listitem`s**.
      `DocumentEditorPage.test.tsx` afirma el breadcrumb con un `getAllByRole('listitem')` **global**
      de tres elementos; una tira hecha con `<ul>`/`<li>` lo rompería sin que ese test tenga nada que
      ver con las pestañas.
      **DONE**: `pnpm --filter @one-markdown/web test AppShell routes` — dos filtros, no una tubería
      **HECHO — 2026-07-29.** RED: **3 rojos** (`Unable to find an accessible element with the role
      "tablist" and name "Documentos abiertos"`). GREEN: `<DocumentTabs />` entre `</header>` y
      `<main>`, y `EDITOR_PANEL_ID` —importado de `DocumentTabs`, **no** un literal repetido— como
      `id` del `<main>`.
      **Un tropiezo que conviene dejar escrito porque se repetirá**: los casos nuevos salieron rojos
      con la página de **entrada** pintada en vez del shell. El `beforeEach` que autentica está
      **dentro** del `describe` de la `000`, así que un `describe` nuevo en el mismo archivo **no lo
      hereda** — el shell vive detrás de `RequireAuth` desde la `001`. No es un defecto del montaje:
      es andamiaje que hay que replicar, y el mensaje (`Unable to find … tablist`) no lo dice; lo dice
      el `<main class="max-w-sm …">` de la salida, que es el de la página de entrada.
      Los cuatro casos afirman lo que de verdad justifica la decisión 7 del plan: que la tira **sobrevive
      a que la ruta no sea un documento** (con `openIds` lleno y la ruta en `/`, sigue ahí), que el
      `aria-controls` de las pestañas y el `id` del `<main>` **salen de la misma constante**, y que la
      tira **no añade un segundo landmark de navegación** —si algún día se convirtiera en `<nav>`, este
      caso y las consultas sin nombre de `routes.test.tsx` caerían, que es lo que se quiere—.
      Verificado: `test AppShell routes` → **16 passed** · suite web completa → **21 archivos / 519
      passed** · `typecheck` y `lint` en **0**.

- [x] **T-008** · `frontend` · Modo `split`: tercer modo, doble panel y una sola paleta — **hecha el 2026-07-29**
      **AC**: AC-14, AC-15, AC-16, AC-17, AC-18, AC-25 (la mitad de los dos `tablist`)
      **Depende de**: T-005 · **Corre en paralelo con T-006 y T-007**
      **Artefactos**: `apps/web/src/features/editor/editor.store.ts` (solo el tipo `ViewMode`) ·
      `apps/web/src/features/editor/editor.store.test.ts` ·
      `apps/web/src/features/editor/DocumentEditorPage.tsx` ·
      `apps/web/src/features/editor/DocumentEditorPage.test.tsx`
      **RED**: `Type '"split"' is not assignable to type 'ViewMode'`, y el caso de los rótulos del
      conmutador falla contra la enumeración.
      **GREEN**: `ViewMode` gana `'split'`; `VIEW_MODES` y `VIEW_MODE_LABELS` lo incluyen; el panel
      pasa a tres ramas con la retícula de dos columnas de `plan.md` §4.4; el `<article>` deja de estar
      limitado a `max-w-3xl` **cuando el modo es `split`**; y la paleta se pinta en `text` **y** en
      `split`, una sola vez.
      **Cuatro trampas concretas**:
      1. **Ningún número escrito a mano.** Los rótulos se afirman contra la enumeración importada. La
         `004` escribió «14 elementos» en diez sitios mientras su tabla enumeraba 16, y dos de esos
         números iban a usarse como aserción.
      2. **La paleta se afirma con `getAllByRole(...)` y longitud `1`**, no con `getByRole`: «hay una
         paleta» pasa igual con dos, y **dos paletas es la regresión que este AC vigila** —tres
         documentos cerrados dan por hecho que con vista dividida habrá dos (`005/spec.md` §1.2).
      3. **AC-16 se afirma antes de avanzar el temporizador** de 1.500 ms: si se avanza, el caso deja
         de distinguir «la vista previa pinta el borrador» de «pinta lo último guardado».
      4. **`DocumentEditorPage.test.tsx:353` deja de funcionar**: hace
         `within(screen.getByRole('tablist')).getAllByRole('tab')` **sin nombre**, y con la tira de
         pestañas montada hay dos `tablist`. Pasa a pedir el conmutador **por su nombre**
         (`'Modo de vista'`), que además es como lo distingue quien recorre la página con un lector.
         Su lista esperada pasa a derivarse de la enumeración (trampa 1).
      **DONE**: `pnpm --filter @one-markdown/web test DocumentEditorPage editor.store` — dos filtros, no una tubería
      **HECHO — 2026-07-29, por agente `frontend`.** RED en dos capas, y la primera no valía: el
      primer intento fue **andamio** (`TypeError: Cannot read properties of undefined` al importar
      una enumeración que aún no se exportaba). El agente lo reconoció, exportó la enumeración **sin**
      añadir `'split'`, y repitió: entonces sí salió el rojo de la aserción —`expected [ 'text',
      'preview' ] to include 'split'` más `Found multiple elements with the role "tab"`— y 4 errores
      de `typecheck` con `Argument of type '"split"' is not assignable to type 'ViewMode'`.
      **`Tests 5 failed | 92 passed (97)`.**
      GREEN: `ViewMode` gana `'split'` (**solo** eso de `editor.store.ts`); `VIEW_MODES` y
      `VIEW_MODE_LABELS` con `split: 'Dividida'`; **un solo** `role="tabpanel"` que en `split`
      contiene una retícula de dos columnas con `<section aria-label="Texto">` y
      `<section aria-label="Vista previa">`; `max-w-6xl` en `split` y `max-w-3xl` en el resto; la
      paleta en `text` **y** `split`, una vez. **El `tablist`, las flechas y el `panelId` no
      necesitaron ninguna rama nueva**, que es lo que el plan había anticipado.
      Las cuatro trampas, esquivadas: rótulos afirmados con `VIEW_MODES.map(...)` y **cero números a
      mano**; paleta por `queryAllByRole` con `toHaveLength(1)` en `text` y `split` y `0` en
      `preview`; AC-16 afirmado **sin avanzar el reloj**; y la consulta de la línea 353 pasa a pedir
      el conmutador **por nombre** a través de un ayudante `viewModeTablist()`, por el que pasan
      también las consultas nuevas.
      Verificado: `test DocumentEditorPage editor.store` → **97 passed** (eran 90: +6 página, +1
      store) · `typecheck` y `lint` en **0**.
      **Tres desviaciones reportadas, las tres correctas**: (1) **exportó `VIEW_MODES` y
      `VIEW_MODE_LABELS`** —cambio de visibilidad, no de comportamiento—, que era la única forma de
      afirmar contra la enumeración en vez de contra un literal; (2) **el comando `DONE` de esta
      tarea no funcionaba**, y lo mismo el de `T-005` y `T-007`: lo arregla la **v0.1.3** de la spec
      (ver la nota al final de este documento); (3) **la `<section>` de vista previa no lleva
      `overflow-auto` a propósito**, y esto es una decisión con destinatario: un contenedor que se
      desplaza y al que no llega el foco incumple **WCAG 2.1.1**, y darle `tabIndex={0}` habría
      metido una parada de tabulación nueva, que es materia de **AC-27** y por tanto de `T-009`. Hoy
      se desplaza el `<main>` del shell, igual que ya hacía la vista previa a pantalla completa. **Si
      `T-009` o `T-010` quieren paneles con desplazamiento independiente, hay que decidir el foco a
      la vez**, no después.

- [x] **T-009** · `frontend` · Barrido de accesibilidad de la página: regiones, nombres y tabulación — **hecha el 2026-07-29**
      **AC**: AC-25, AC-26, AC-27
      **Depende de**: T-007 **y** T-008 (necesita la tira montada **y** el tercer modo)
      **Artefactos**: `apps/web/src/features/editor/DocumentEditorPage.tsx` (solo el `aria-label` de la
      región de carga) · `apps/web/src/features/editor/DocumentEditorPage.test.tsx`
      **RED**: el caso que enumera las regiones vivas por nombre falla al buscar `'Carga del
      documento'`, y el de la tabulación falla en el orden.
      **GREEN**: el `role="status"` del mensaje de carga gana `aria-label="Carga del documento"` —un
      atributo, no un cambio de comportamiento—, porque la tira de pestañas se pinta **mientras** el
      documento carga y en ese instante había dos regiones con una anónima.
      **Las cuatro regiones vivas, enumeradas aquí y no contadas en ningún otro sitio**: «Estado del
      guardado» (`003`), «Elemento insertado» (`004`), «Pestañas abiertas» (`005`) y «Carga del
      documento» (`003`, que gana nombre aquí).
      **La regla, que vale también para los tests**: se consulta **por nombre**, nunca por contenido.
      `filter({ hasText })` **no lee `aria-label`**, así que un test así sobrevive verde a la
      regresión del criterio que dice verificar — le pasó a `e2e/palette.spec.ts` y lo arregló la
      `T-012` de la `004`.
      **AC-27 se escribe contra la cabecera real**: pestañas → conmutador → **«Guardar»** → paleta →
      área de texto. El botón «Guardar» de la `003` vive entre el conmutador y la paleta, y escribir
      un orden que lo ignore es el error exacto que la `004` corrigió en su AC-26.
      **DONE**: `pnpm --filter @one-markdown/web test DocumentEditorPage`
      **HECHO — 2026-07-29, por agente `frontend`.** RED: 2 rojos, **y solo uno era el suyo**. El otro
      era **cascada**, y merece quedar escrito: `open()` cachea la lectura en vuelo en `readsInFlight`,
      un `Map` **de módulo** que ningún `beforeEach` limpia —`setState(getInitialState(), true)` no lo
      alcanza—, así que un caso que aborta antes de resolver su lectura deja la promesa cacheada y **el
      caso siguiente** recibe una que no llega nunca. Aislado, AC-27 pasaba; en el archivo entero, no.
      El agente lo contuvo **en el test** (un `finally` que resuelve la lectura pase lo que pase) y
      **no tocó el store**, que no era suyo. Es la fragilidad que `T-004` ya había anotado, ahora con
      un caso real: **en producción no puede ocurrir** —el `finally` siempre corre—, así que no se
      añade una API de reinicio solo para los tests.
      GREEN: un atributo, `aria-label="Carga del documento"`. **AC-27 pasó en verde sin cambiar una
      línea de producción**, y el agente lo dijo en vez de disfrazarlo: la predicción de esta tarea
      («el de la tabulación falla en el orden») es **anterior a `T-007`**, que al pintar la tira por
      encima del `<main>` dejó el orden correcto **gratis**. El caso queda como **guarda de
      regresión**, no como motor del GREEN.
      Los cinco casos nuevos montan `routes` —la aplicación entera— y no solo la página: sin
      `AppShell` no hay dos `tablist`, ni región de pestañas, ni orden de tabulación que medir. La
      enumeración de las cuatro regiones vive en **un solo sitio** y cada caso **deriva** la longitud
      de la lista que afirma, sin ninguna cuenta escrita a mano.
      **Barrido de AC-25**: las únicas consultas sin desambiguar del archivo eran dos
      `getAllByRole('status')` de la `004`; sustituidas por consulta **por nombre** más una guarda que
      lee el DOM —que es la única forma de afirmar *lo contrario* que una consulta: que no sobra
      ninguna región ni hay ninguna anónima—. El resto del `src` tiene consultas sin nombre solo en
      páginas donde hay **una**, así que no incumplen y no se tocaron.
      **Decisión sobre el `overflow` de la vista previa que dejó abierta `T-008`: se queda como está**,
      con cinco razones y sin consultarme porque la recomendación era no cambiar nada. Las dos que
      pesan: el `<textarea>` **ya** se desplaza solo, así que el cambio no daría «dos paneles con
      scroll» sino «el segundo también»; y dos mitades con desplazamiento independiente **y sin
      sincronizar** se desalinean por construcción — sincronizar el scroll es una funcionalidad con su
      propio criterio, no un efecto colateral de añadir `overflow-auto`. Coste asumido y dicho: en un
      documento largo, texto y previa se desplazan como una sola página.
      Verificado: `test DocumentEditorPage` → **55 passed** · suite web → **21 archivos / 524
      passed** (eran 519: +5) · `typecheck` y `lint` en **0**.

- [x] **T-010** · `frontend` · Navegador: recorrido de pestañas y vista dividida de verdad — **hecha el 2026-07-29**
      **AC**: AC-19, **AC-34** (nuevo en la v0.2.0)
      **Depende de**: T-002 (los ayudantes) **y** T-009
      **Artefactos**: **NUEVO** `apps/web/e2e/tabs.spec.ts` · `apps/web/e2e/support/editor-e2e.ts`
      (solo si algún ayudante necesita un parámetro más; si se necesita otra cosa, se para y se
      reporta)
      **RED**: el archivo no existe → se crea con el primer caso y falla en la aserción de las cajas.
      **GREEN**: **un solo archivo con dos casos**, y esto es política de presupuesto, no de estilo:
      cada caso paga una entrada y `login` es 10/min por IP, así que repartir lo mismo en más archivos
      gasta cupo sin comprar cobertura.
      **Caso 1 — pestañas, solo con teclado**: abrir tres documentos, recorrerlos con flechas de ida y
      vuelta, cerrar el del medio con `Delete`, y comprobar que el foco **cae en la vecina** y que la
      URL es la que toca. Los documentos se crean **por API** (como ya hace `palette.spec.ts`): lo que
      mide este caso es el recorrido, no la creación.
      **Caso 2 — vista dividida (AC-19)**: en `split`, `boundingBox()` de los dos paneles → mismo
      borde superior, sin solape horizontal, los dos con ancho > 0, y el ancho útil **mayor** que en
      modo `text`. jsdom devuelve ceros para cualquier caja, así que esto solo se puede afirmar aquí.
      Se aprovecha el mismo caso para el tamaño de objetivo de las pestañas y su cruz (≥ 24 × 24 px
      CSS, SC 2.5.8), con el mismo mecanismo que la `004`.
      **El presupuesto se respeta gastando menos**: las escrituras de contenido se agrupan en una
      ventana de debounce, como en `palette.spec.ts`. `throttle:documentContent:*` **no se resetea**.
      **DONE**: `pnpm --filter @one-markdown/web test:e2e tabs`
      **HECHO — 2026-07-29, por agente `frontend`, y con un bloqueo reportado a mitad.**
      RED en dos: el primero fue **un defecto de su propia consulta** —`getByRole('tab', { name:
      'Dividida' })` resolvió a **dos** elementos, porque con dos `tablist` en la página el nombre
      accesible de una pestaña de documento **lleva el título dentro** y la coincidencia de Playwright
      es por subcadena—; lo arregló con `exact: true` y **avisó de que la misma mina estaba puesta en
      `editor.spec.ts`** (tres consultas). El segundo fue la aserción de las cajas.
      **BLOQUEO, y es la parte que mejor hizo**: la «×» de cierre medía **19,73 × 20 px**, por debajo
      de los 24 × 24 de SC 2.5.8. **No debilitó la aserción** —eso habría sido neutralizar en vez de
      gastar menos— y **no tocó `DocumentTabs.tsx`**, que no estaba en su lista. Paró, explicó por qué
      no lo salva ninguna excepción del criterio (*Spacing* no aplica porque el control está
      **anidado** en la pestaña; *Equivalent* tampoco, porque el otro camino es `Supr`, un atajo y no
      un objetivo) y propuso el arreglo de una línea.
      **Autorizado y aplicado por el orchestrator** (`size-6`, 24 px), más **AC-34 nuevo** en la
      **v0.2.0**: el requisito estaba en `plan.md` §4.6 y en esta tarea, pero **sin AC**, y por ese
      hueco se coló el defecto. Verificado después: `test:e2e tabs` → **2 passed**.
      **Desviación de interpretación en AC-19, aceptada y escrita en el AC**: «el ancho útil del
      editor» se mide sobre el `role="tabpanel"`, **no** sobre el `<textarea>`; sobre el textarea el
      criterio sería **imposible por aritmética** (768 px contra ~568). El contrafáctico funciona así
      medido.
      Verificado: `test:e2e tabs` → **2 passed** · suite de navegador entera → **11 passed** (eran 9)
      · guarda de AC-30 **con el archivo nuevo dentro** de su enumeración → 5 passed · `typecheck` y
      `lint` en **0**. **El puerto 5183 funcionó**: ninguna regresión de `T-001`.
      **Presupuesto observado y afirmado, no supuesto**: `documentContent` **0 peticiones**, con
      `expect(contentSaves()).toBe(0)` en los dos casos —ninguno ensucia el borrador, así que ni el
      debounce ni el `flush` del cierre tienen nada que forzar—; `login` **2 por corrida**, que es por
      lo que los dos casos van en un solo archivo.
      **Deuda anotada**: `watchContentSaves` es ahora la **segunda** copia. La regla de la casa extrae
      **a la tercera**, así que hoy es legal y la guarda no la vigila; cuando aparezca la tercera, la
      extracción necesitará `palette.spec.ts` en la lista de artefactos.

- [x] **T-011** · `frontend` · Cierre: alcance verificado y presupuesto con sus ventanas — **hecha el 2026-07-29**
      **AC**: AC-32, AC-33
      **Depende de**: T-010, y **es la última que toca nada**
      **Artefactos**: **ninguno de código**. Solo mediciones y su registro.
      **RED**: no aplica — es verificación. Lo que aplica es que **las mediciones se toman después de
      la última tarea que toca `e2e/`**: la `004` pagó dos veces por medir antes (su `T-011` tras
      `T-010`, y otra vez con `T-012`), y una medición sobre un directorio que va a cambiar es una
      medición que hay que repetir.
      **GREEN/verificación**:
      - **AC-32**: `git status --porcelain packages apps/api` **vacío**, y `pnpm test` con `shared`
        **81** · api unit **305** · api e2e **511**, idénticos a los del cierre de la `004`.
      - **AC-33(a)**: `pnpm --filter @one-markdown/web test:e2e` con sondeo de
        `throttle:workspace:{sha256(ip)}` en Redis cada 300 ms → pico **por corrida** < **60** de 120,
        y se escribe la cifra medida.
      - **AC-33(b)**: `--retries=2 --repeat-each=3` → **sin un solo `429`**, y **ninguna cifra**:
        ahí las tres repeticiones se suman dentro de la misma ventana de 60 s y el número hablaría del
        multiplicador, no de la suite.
      - **AC-33(c)**: el ahorro de la deduplicación **se ve**. Se mide el pico de `workspace` de
        `editor.spec.ts` + `palette.spec.ts` **antes** (en T-001, antes de tocar el store) y
        **después**, y se escriben las dos. La `003` dejó documentado el tamaño del desperdicio: **8
        de 21** peticiones de `workspace` eran lecturas duplicadas del mismo documento.
      **DONE**: los cuatro comandos de arriba, con sus salidas reales pegadas en `IMPLEMENTATION.md`
      por el orchestrator
      **HECHO — 2026-07-29.**
      **AC-32**: `git status --porcelain packages apps/api` → **vacío**. `shared` **81** · api unit 21
      suites / **305** · api e2e 22 suites / **511** — **idénticos** a los del cierre de la `004`.
      **AC-33(a)**: `test:e2e` con sondeo de `throttle:workspace:*` → **pico 28 de 120 POR CORRIDA**,
      contra un criterio de < 60.
      **AC-33(b)**: `--retries=2 --repeat-each=3` → **33 passed, sin un solo `429`**. Ninguna cifra
      aquí, a propósito: las tres repeticiones se suman dentro de la misma ventana de 60 s y el número
      hablaría del multiplicador y no de la suite.
      **AC-33(c) — el ahorro de la dedup se ve, y se midió con contrafáctico en vez de con memoria**:
      **36** sin deduplicación contra **28** con ella. **Ocho peticiones de ahorro por corrida**, que
      es exactamente el desperdicio que la `003` había documentado («8 de 21 peticiones de `workspace`
      eran lecturas duplicadas»). El «antes» **no se recordó, se reprodujo**: se revirtió `open(id)` a
      la lógica de la `003`, se midió, y se restauró.
      **Y un fallo de instrumentación que casi arruina la medición, escrito porque es la lección más
      transferible de esta tarea**: la primera sonda reportó **`pico=0`**, y no porque el valor fuera
      cero sino porque **`redis-cli` no existe en esta máquina** —el `PONG` de la comprobación previa
      lo había devuelto el `docker.exe` de respaldo de un `||`—. Un cero de un instrumento
      desconectado es indistinguible de un cero real si no se contrasta. Se detectó porque
      `redis-cli DBSIZE` devolvía **cadena vacía** en vez de un número, y se rehízo la sonda **dentro
      del contenedor**, comprobando primero con una clave de prueba que sí veía lo que tenía que ver.

---

## Reparto y paralelismo

| Tarea | Agente | Depende de | Puede ir en paralelo con |
|---|---|---|---|
| T-000 | `orchestrator` | — | **T-001, T-003** (no toca código) |
| T-001 | `frontend` | — | **T-003** |
| T-002 | `frontend` | T-001 | **T-003, T-004, T-005** |
| T-003 | `frontend` | — | **T-001, T-002** |
| T-004 | `frontend` | T-003 | **T-002** (mismo archivo que T-003) |
| T-005 | `frontend` | T-004 | **T-002** (mismo archivo) |
| T-006 | `frontend` | T-005 | **T-008** |
| T-007 | `frontend` | T-006 | **T-008** |
| T-008 | `frontend` | T-005 | **T-006, T-007** |
| T-009 | `frontend` | T-007, T-008 | — |
| T-010 | `frontend` | T-002, T-009 | — |
| T-011 | `frontend` | T-010 | — |

**Hay dos oportunidades reales de paralelismo, y ninguna más.**

1. **La rama de e2e (T-001 → T-002) contra la rama del store (T-003 → T-004 → T-005).** Conjuntos de
   archivos completamente disjuntos: `apps/web/e2e/**` y `playwright.config.ts` por un lado,
   `features/editor/editor.store*` por el otro.
2. **T-006 (componente nuevo) contra T-008 (página y tipo `ViewMode`)**, y luego T-007 contra T-008.
   `DocumentTabs.tsx` no existe todavía y `DocumentEditorPage.tsx` no lo importa: la única costura es
   `editor.store.ts`, y T-008 solo le añade un valor a una unión de tipos que T-005 ya dejó cerrada.

**Dónde NO hay paralelismo, y por qué**:

- **T-003, T-004 y T-005 comparten archivo.** Lanzarlas a la vez es garantizar conflictos, igual que
  las cuatro primeras de la `004`.
- **T-009 va detrás de las dos ramas de interfaz** porque afirma propiedades de la página **con la
  tira montada y con el tercer modo puesto**: antes de las dos, la mitad de sus aserciones no tendría
  sujeto.
- **T-010 y T-011 van las últimas y solas**, y por el motivo de calendario que la `004` pagó dos
  veces: **cualquier tarea que toque `e2e/` invalida las mediciones de presupuesto**. T-011 no escribe
  código precisamente para que nada pueda invalidarla a ella.

---

## Lo que ninguna tarea puede tocar

Lista cerrada, y las tres primeras vienen con instrucciones explícitas de specs anteriores:

1. **`apps/web/src/features/editor/MarkdownPreview.tsx`** y su cadena de plugins. La vista dividida
   cambia **dónde** se pinta, no **qué**: cero plugins nuevos, así que el modelo de amenaza de
   `003/plan.md` §2 no se vuelve a medir y el corpus de XSS no se amplía.
2. **`apps/web/src/features/editor/markdown-insert.ts`, `markdown-palette.ts` y
   `MarkdownPalette.tsx`.** La paleta cambia de sitio, no de comportamiento. Su región viva y su
   `aria-label` se quedan **exactamente** como los dejó la `T-011` de la `004`.
3. **`packages/shared/**` y `apps/api/**`.** Ni una línea (AC-32).
4. **`apps/web/vite.config.ts`.** El puerto de la suite se resuelve por CLI (T-001). Ese archivo
   lleva un bloque de comentario que es contrato de la `000` y de la `002`, y nadie debería tener que
   releerlo para cambiar un puerto.
5. **`apps/web/src/features/workspace/**`.** El árbol no cambia: seleccionar un documento sigue
   navegando a `/documents/:id`, y eso ahora abre pestaña **sin que la barra lateral se entere**.
6. **`apps/web/src/shared/api/http.ts`.** La deduplicación va en el store, no en el cliente (decisión
   5 del plan): el cliente no sabe qué es un documento abierto.

Y una lista corta de lo que tampoco se toca porque no hay motivo, y tocarlo sería señal de que algo se
torció: `apps/web/src/test/workspace-fixtures.ts`, `auth-fixtures.ts`, `api-stub.ts`, `setup.ts`,
`apps/web/e2e/global-setup.ts`, `global-teardown.ts`, `support/services.ts`, `support/session.ts`, y
cualquier `package.json`.

---

## Definition of Done (todas las tareas)

1. El test se escribió primero y **falló primero** (el agente reporta la salida del RED). Y **el
   andamio vacío es parte del RED**: un `Cannot find module` demuestra que el archivo no está, no que
   el criterio no se cumple; el rojo que vale es el **de la aserción** (`004/spec.md` §9.7).
2. Cada AC de la spec tiene al menos un test automatizado, **salvo lo que §3.D declara explícitamente
   como no cubrible** (cómo locuta un lector real) — y para eso **no se escribe un test que finja que
   sí**.
3. Backend: **no aplica** — esta spec no añade ninguna entrada ni ninguna salida de API. La regla dura
   de `CLAUDE.md` se satisface por omisión, y AC-32 lo verifica.
4. Cero `any` (`@typescript-eslint/no-explicit-any` es `error` en el repo). En los tests, `unknown` +
   estrechamiento, como ya hace `DocumentEditorPage.test.tsx`.
5. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan, corridos **desde estado limpio**
   (`rm -rf packages/shared/dist` y dejar que el flujo lo reconstruya).
6. **Toda cifra de cupo lleva pegada su ventana y el comando con el que se mide.** Un número sin
   ventana no es verificable aunque parezca el dato más concreto del criterio (riesgo #12 de la
   `004`).
7. `IMPLEMENTATION.md` actualizado **por el orchestrator** con el comando de verificación y su salida
   real. Los agentes de implementación no lo editan.

Y la regla operativa que las cinco fases anteriores han pagado por aprender: **un fallo que no se
reproduce no es transitorio hasta que se explica por qué desapareció.**

---

## Nota sobre los comandos de verificación de este documento

**El filtro de archivos de Vitest 4 es una subcadena, no una expresión regular.** La v0.1.0 de esta
spec escribió tres comandos `DONE` con la forma `test "A|B"`, que **no ejecuta nada**: sale
`No test files found, exiting with code 1`. Lo destapó el agente que implementó `T-008`, y está
comprobado a mano: la forma con tubería da `No test files found` y la de dos filtros
(`test A B`) da `Test Files 2 passed`.

Es la misma familia de defecto que la `004` corrigió en su AC-33 —**un criterio escrito junto a un
comando que no puede verificarlo**— con una diferencia que le quita gravedad: este **falla ruidoso**
(exit 1) en vez de pasar en falso, así que no podía colar un GREEN inexistente. Corregido en las tres
tareas (`T-005`, `T-007`, `T-008`) por la **v0.1.3** de la spec.
