# One Markdown — Seguimiento de implementación

Archivo base de seguimiento. **Solo el agente `orchestrator` lo edita**, y únicamente después de verificar (comando corrido + salida real).

Leyenda: `[ ]` pendiente · `[~]` en curso o bloqueado (con motivo) · `[x]` hecho y verificado.

---

## Fase 0 — Agentes y tooling

- [x] **Discovery de skills** en skills.sh (`npx skills find`) — 2026-07-24
      Verificado: 15 skills instaladas a nivel proyecto en `.claude/skills/`, registradas en `skills-lock.json` (`ls .claude/skills` → 15 entradas).
- [x] **Agentes definidos** — 2026-07-24
      `.claude/agents/orchestrator.md`, `frontend.md`, `backend.md` con skills asignadas por rol.
- [x] **MCP integrados** — 2026-07-24
      `.mcp.json`: `context7`, `playwright`, `coderag`, `postgres`. Pendiente de handshake en el próximo arranque de sesión (ver nota abajo).
- [x] **Base de metodología** — 2026-07-24
      `specs/` con plantillas SDD (`spec.md`, `plan.md`, `tasks.md`, `CHANGELOG.md`), `CLAUDE.md` con reglas del proyecto, este archivo de seguimiento.
- [x] **Scaffolding del monorepo** — 2026-07-24
      `apps/web` (Vite 8+React 19+TS+Tailwind 4+Zustand+Router 8+Vitest 4+Playwright), `apps/api` (NestJS 11+Prisma 7+Redis+Swagger+Jest), `packages/shared`, `docker-compose.yml` (postgres+redis), CI escrito.
      Verificado: `pnpm typecheck` → 0 · `pnpm lint` → 0 · `pnpm test` → 0 · `pnpm build` → 0 · `pnpm test:e2e` → 3 passed. Detalle por tarea en Fase 2.

## Fase 1 — Planificación SDD

- [x] **spec 000-foundation** — `specs/000-foundation/` (`spec.md` v0.1.1 + `plan.md` + `tasks.md` + `CHANGELOG.md`), estado **implemented**. — 2026-07-24
      14 criterios de aceptación; 13 verificados con test automatizado, AC-14 (CI) pendiente de un run real.
      Verificado: ver Fase 2 y las notas de verificación al final.
- [x] **spec 001-auth** — `specs/001-auth/` (`spec.md` v0.1.0 + `plan.md` + `tasks.md` + `CHANGELOG.md`),
      estado **approved** (aprobada por el usuario el 2026-07-24, sin cambios de alcance). — 2026-07-24
      26 criterios de aceptación y 26 tareas TDD en 7 bloques; la implementación es la Fase 3.
      Versiones de las dependencias nuevas fijadas contra npm y APIs verificadas con `context7`
      (`otplib` 13.x cambió de API respecto de la 12.x; `@nestjs/throttler` 6.x).
- [x] **spec 002-workspace-tree** — `specs/002-workspace-tree/` (`spec.md` **v0.4.1** + `plan.md` + `tasks.md` + `CHANGELOG.md`),
      estado **complete, con la enmienda de la v0.4.0 pendiente de implementar** (2026-07-28).
      La **v0.4.1** es un patch que **solo toca `CHANGELOG.md`**: dos **bytes de control** en bruto (un
      `U+0000` y un `U+007F`) hacían que `grep` clasificara el archivo como **binario** y saliera con
      exit 1 aunque el patrón estuviera. Se detectó verificando el `DONE` de `T-000`, que es justamente un
      `grep` sobre ese archivo: la comprobación fallaba y **el archivo estaba bien**. Los bytes venían de
      la entrada de la v0.3.1 que **documentaba este mismo problema** en `tasks.md` — la frase prometía
      «sustituidos por … escapados» e incrustaba los bytes en bruto. Verificado con una comprobación que
      falla si el arreglo no funcionó: `grep -c` → exit **0** (antes 1), `grep` sin `-a` encuentra la
      línea, y un barrido de bytes de control sobre **los 21 `.md` de `specs/`** → **cero**, sin ningún
      otro archivo afectado. `git diff` nunca estuvo roto: el que se rompía era `grep`.
      La **v0.4.0** (minor) **no la pide esta spec sino la `003`**, aprobada el 2026-07-28, y la aplicó su
      `T-000`: `WorkspaceDocumentResponseDto` gana `contentVersion` (token de concurrencia optimista del
      guardado) y el recuento de rutas del tag `workspace` pasa de **diez a once**. Es aditivo —ningún
      campo desaparece ni cambia de tipo— pero obliga a cambiar aserciones de tests **verdes**, así que no
      podía ser un patch. Toca cinco AC: **AC-12**, **AC-15**, **AC-26**, **AC-31** y **AC-32**.
      **Consecuencia asumida y escrita en los tres sitios donde se lee** (el `Estado` de la spec, el aviso
      que abre su §6 de trazabilidad, y cada uno de los cinco AC): desde el 2026-07-28 **esos cinco AC van
      por delante del código**. Los implementan `T-007`, `T-009` y `T-013` de la `003`. Dejar «35/35
      verificados» a secas habría sido más cómodo y falso.
      **Lo que la v0.4.0 NO tocó**, aunque estaba cerca: `PATCH /api/workspace/documents/{id}` sigue
      aceptando solo `title` y sigue rechazando `content` con un `400` de `forbidNonWhitelisted`.
      **Y por qué la columna y no `updatedAt`**, que es lo que el riesgo #12 de esta misma spec había
      apuntado: renombrar y mover **también** mueven `updatedAt`, así que renombrar desde la barra lateral
      haría fallar un guardado pendiente del editor con un conflicto que no existe. No fue un error de la
      `002` — su riesgo #12 pedía expresamente no adelantar el mecanismo sin datos, y se decidió cuando
      hubo con qué decidirlo.
      Lo anterior, intacto: la **v0.3.1** (patch)
      cierra `T-026` y `T-027`, con lo que AC-34 y AC-35 quedan cubiertos, y **corrige dos decisiones que
      había escrito el orchestrator**: el reset de AC-35 necesitaba también `throttle:login:*`, y
      `global-setup.ts` tenía que estar en la lista de archivos de `T-027`. Ver el cierre de la Fase 4.
      _(Antes de la v0.3.1: **33/33 AC** del alcance aprobado y **25/25 tareas**.)_
      Fue approved el 2026-07-25 sin cambios de alcance: los cuatro puntos
      señalados se aceptaron tal como estaban escritos; ver el punto 6 de pendientes. — 2026-07-25
      Aprobada con **33 criterios de aceptación y 25 tareas** TDD en 5 bloques (A esquema y dominio puro ·
      B directorios · C documentos · D árbol y transversales · E frontend), más el **Bloque F** de
      endurecimiento (AC-34, AC-35 · `T-026`, `T-027`) que abrió la v0.3.0 y cerró la v0.3.1; la
      implementación es la Fase 4.
      La v0.2.2 (patch) resuelve la contradicción del `404` de `GET /api/workspace/tree` y añade `T-025`
      —la mitad de código de esa decisión—, sin tocar ningún AC de comportamiento. La **v0.2.3** (patch)
      corrige el criterio con que ese mismo RED derivaba las nueve rutas con `404` (no es «lleva `{id}`»,
      que da siete, sino «todas menos `/tree`») y cierra `T-025` y `T-022`.
      Aprobada con 32 AC y 23 tareas; la v0.2.0 añade **AC-33** y **`T-024`** (el `413` del límite de
      cuerpo, que hoy sale `500`). Es alcance nuevo, no un cambio de lo aprobado: no toca ninguno de los
      cuatro puntos que el usuario aceptó ni ningún AC anterior.
      **Cero dependencias nuevas** en los tres paquetes. Verificado con `context7` contra la doc de Prisma:
      en un `@@unique` los `NULL` se consideran **distintos**, así que `@@unique([userId, parentId, nameKey])`
      no impediría dos directorios homónimos en la raíz → columnas derivadas no nulas `nameKey`/`titleKey` y
      `parentScopeId`. Verificado además en el código instalado que `Prisma.TransactionIsolationLevel`,
      `Prisma.PrismaClientKnownRequestError` y `app.useBodyParser('json', { limit })` existen tal como
      los usa el plan.
      Decisiones de más impacto: `404` nunca `403` para lo ajeno · borrado físico con cascada real y
      `?recursive=true` explícito · árbol completo, plano y sin contenidos · renombrar y mover en endpoints
      separados · `code?: string` aditivo en `ErrorResponseDto` · quinto throttler `workspace` (cierra el
      punto que el CHANGELOG de `001` dejó para esta spec).
- [x] **spec 003-editor** — `specs/003-editor/` (`spec.md` **v0.1.1** + `plan.md` + `tasks.md` +
      `CHANGELOG.md`), estado **approved** (2026-07-28), **sin cambios de alcance**. — 2026-07-28
      **34 criterios de aceptación** (todos con al menos un test automatizado declarado, y cada AC dice
      con qué mecanismo se verifica) y **16 tareas** TDD en 7 bloques (0 enmienda de la `002` · A esquema
      y dominio puro · B repositorio y throttler · C endpoint · D cliente y renderizador · E estado e
      interfaz · F navegador). **`T-000` hecha y verificada; las 15 restantes, pendientes de despacho.**
      La implementación será la Fase 5.
      **Las cinco decisiones de `spec.md` §5 quedaron resueltas el 2026-07-28**, todas en la opción que
      el plan recomendaba: (A) `PUT /api/workspace/documents/:id/content` como **ruta nueva**, con el
      `PATCH` intacto; (B) columna **`contentVersion`** y enmienda de la `002` a v0.4.0 como minor;
      (C) `react-markdown` + `remark-gfm` + `rehypeRawAsText` + `rehype-sanitize`, con la postura de
      producto aprobada **explícitamente** —el HTML embebido se muestra como **texto literal y no se
      renderiza nunca**—; (D) **`<textarea>` plano**, sin CodeMirror ni Monaco; (E) **«split view» =
      texto y preview lado a lado del MISMO documento**, no dos documentos distintos.
      Las filas A…E de §5 se **conservan con su razonamiento íntegro** y se marcan como resueltas: el
      motivo de una decisión es lo que hace falta el día que alguien quiera revisarla.
      **Convenio de versionado al aprobar, por consistencia con `001` y `002`**: aprobar **no** salta a
      1.0.0 — lo que cambia es el `Estado`. La versión sube a **v0.1.1** solo porque el contenido de §5
      cambió.
      **Tres dependencias nuevas**, todas en `apps/web` y todas instaladas por una sola tarea (`T-011`):
      `react-markdown` **10.1.0** (peer `react >=18`, satisfecho por React 19.2.8), `remark-gfm`
      **4.0.1** y `rehype-sanitize` **6.0.0**. Versiones fijadas contra npm y API verificada con
      `context7` el 2026-07-28. `rehype-raw` **no** se instala, y eso es parte del diseño.
      La cadena del preview se decidió **midiendo**, no leyendo documentación: se instalaron las tres
      librerías fuera del repositorio y se renderizó un corpus de cargas comparando salidas
      (`plan.md` §1.3). Salieron dos cosas que no eran obvias: (1) `react-markdown` **sin** sanitizador
      ya escapa el HTML del markdown como texto, así que es seguro con esas cargas —pero solo mientras
      nadie añada un plugin—; (2) `rehype-sanitize` **a secas borra prosa del usuario**
      (`<!-- oculto -->visible` se queda en nada). De ahí el paso propio `rehypeRawAsText` de ~12 líneas:
      seguro **y** sin pérdida.
      Los dos puntos que la `002` dejó anotados sin tarea quedan resueltos por escrito: el **riesgo #15**
      entra **acotado al editor** (AC-19, tres estados de error distinguibles) y la barra lateral no se
      toca; y el **AC-34** de la `002` **no necesita análogo** —aquel agujero era específico de un paquete
      enlazado del workspace, y estas tres dependencias son de npm, así que el lockfile las cubre—, pero
      sí hacía falta otra cosa: **AC-26**, que repite el corpus de XSS en Chromium real, porque una
      afirmación de seguridad verificada solo en jsdom no es una afirmación sobre navegadores.
      **`T-000` — enmienda de la `002` a v0.4.0 — hecha el 2026-07-28.** Aplicada la tabla de
      `003/spec.md` §6 sobre `specs/002-workspace-tree/` (`spec.md`: encabezado, `Estado`, AC-12, AC-15,
      AC-26, AC-31, AC-32 y el aviso que abre su §6; `plan.md`: §4, §5, §7; `CHANGELOG.md`: entrada
      `## v0.4.0 — 2026-07-28`), más `specs/README.md`, este archivo y `CLAUDE.md`.
      **Sin tocar una línea de código**, que era la regla: los cambios de test los harán `T-007`, `T-009`
      y `T-013`, cada uno junto a la implementación que los provoca.
      Verificado: `pnpm test` → **exit 0** · shared **65** · web 12 archivos / **188** · api 19 suites /
      **264**. Son las cifras exactas del cierre de la `002`, y se corrieron **antes y después** de la
      enmienda con resultado idéntico — que es justamente lo que demuestra que no se tocó código, junto
      con un `git status` sin un solo archivo modificado en `apps/**` ni `packages/**`.
      **`CLAUDE.md`**: la frase «tabs tipo VS Code al abrir documentos y split view» era ambigua y la
      `005` se iba a apoyar en ella. Corregida con la edición mínima que quita la ambigüedad.
      **Tres dependencias nuevas**, todas en `apps/web` y todas instaladas por una sola tarea (`T-011`):
      `react-markdown` **10.1.0** (peer `react >=18`, satisfecho por React 19.2.8), `remark-gfm`
      **4.0.1** y `rehype-sanitize` **6.0.0**. Versiones fijadas contra npm y API verificada con
      `context7` el 2026-07-28. `rehype-raw` **no** se instala, y eso es parte del diseño.
      Decisiones de más impacto, con su evidencia: **`PUT /api/workspace/documents/:id/content`** como
      ruta nueva en vez de ampliar el `PATCH` (ampliarlo rompería un comportamiento verificado de la
      `002` y metería el guardado automático en el camino del `409 DOCUMENT_TITLE_TAKEN`) · columna
      **`contentVersion`** como token de concurrencia en vez de `updatedAt` (que renombrar y mover
      también mueven, lo que produciría conflictos falsos) · sexto throttler **`documentContent`**
      120/min declarado a nivel de método (verificado en `throttle.ts` que `getAllAndOverride` hace ganar
      al método sobre la clase) · preview con **cuatro capas** y nunca `dangerouslySetInnerHTML`.
      La cadena del preview se decidió **midiendo**, no leyendo documentación: se instalaron las tres
      librerías fuera del repositorio y se renderizó un corpus de cargas comparando salidas
      (`plan.md` §1.3). Salieron dos cosas que no eran obvias: (1) `react-markdown` **sin** sanitizador
      ya escapa el HTML del markdown como texto, así que es seguro con esas cargas —pero solo mientras
      nadie añada un plugin—; (2) `rehype-sanitize` **a secas borra prosa del usuario**
      (`<!-- oculto -->visible` se queda en nada). De ahí el paso propio `rehypeRawAsText` de ~12 líneas:
      seguro **y** sin pérdida.
      Los dos puntos que la `002` dejó anotados sin tarea quedan resueltos por escrito: el **riesgo #15**
      entra **acotado al editor** (AC-19, tres estados de error distinguibles) y la barra lateral no se
      toca; y el **AC-34** de la `002` **no necesita análogo** —aquel agujero era específico de un paquete
      enlazado del workspace, y estas tres dependencias son de npm, así que el lockfile las cubre—, pero
      sí hacía falta otra cosa: **AC-26**, que repite el corpus de XSS en Chromium real, porque una
      afirmación de seguridad verificada solo en jsdom no es una afirmación sobre navegadores.
      Verificado: los cuatro archivos existen en `specs/003-editor/`; `specs/README.md` actualizado.
      **Sin comandos de test que correr todavía** — no hay código de esta spec.
- [x] **spec 004-markdown-palette** — `specs/004-markdown-palette/` (`spec.md` **v0.2.1** + `plan.md` + `tasks.md` +
      `CHANGELOG.md`), estado **approved · en implementación** (aprobada por el usuario el 2026-07-28;
      **v0.1.2, v0.2.0 y v0.2.1 el 2026-07-29**). — 2026-07-29
      **La v0.2.1 es un patch que no mueve el recuento —siguen 36 AC y 11 tareas— y que corrige un AC
      que era cierto por corrida y falso bajo su propio comando de verificación.** **AC-33** exigía
      que el pico de `documentContent` quedara **< 10 de 120** y mandaba medirlo con
      `--retries=2 --repeat-each=3`; ese comando **triplica el gasto dentro de la misma ventana de
      60 s** del throttler, porque la suite entera dura ~23 s y las tres repeticiones **se suman** en
      vez de sucederse. Medido con sondeo de Redis cada 300 ms sobre
      `throttle:documentContent:{sha256(ip)}`: **5** por corrida (baseline de la `003` = 4, y el caso
      nuevo de la paleta añade exactamente 1), **15** con `--repeat-each=3`, y **12** con
      `--repeat-each=3` **sin** el caso nuevo. Es decir: **el criterio ya estaba roto antes de que
      la `004` existiera**; `T-010` no lo introduce, lo destapa.
      **Decisión: la cifra pasa a ser «por corrida» y el AC gana un segundo comando** — (a)
      `pnpm test:e2e` + sondeo → **< 10 de 120**; (b) `--retries=2 --repeat-each=3` → **sin un solo
      `429`**, con la suma de las repeticiones escrita al lado (15, techo teórico 9 × 5 = 45).
      **Descartada (b) subir el número**: un valor cierto bajo `--repeat-each=3` no habla de la suite
      sino del **multiplicador**, y cambiaría de significado el día que CI repita otras veces o que
      la suite pase de 60 s, sin que nadie toque el producto.
      **Descartada (c) recortar el gasto de `editor.spec.ts`**: su caso de conflicto gasta 3 de los 4
      del baseline y las tres formas de bajarlo están **explícitamente descartadas** en el riesgo #10
      de la `003` porque cambian el producto o lo que el AC demuestra. La política **gastar menos, no
      neutralizar más** es para cuando el presupuesto aprieta, y aquí hay **105 de margen**; pagar
      cobertura de una spec cerrada para hacer cierta una frase mal escrita es el orden de las cosas
      al revés. Si algún día el gasto se acercara al límite, **(c) sería la respuesta correcta**.
      **En la `003` se corrige, no solo se deja constancia** (su **v0.1.5**, patch): su **AC-34 no
      lleva número** y por eso sigue siendo cierto —afirma «sin un solo `429`», y 12 de 120 lo
      cumple—, pero la contabilidad de cierre («la suite gasta 4 de 120») es una cifra **por corrida**
      escrita junto al comando que la triplica, y la `005` va a leer esas notas para dimensionar su
      presupuesto. Queda además como **riesgo #12** de la `004` la regla que lo evita: **toda cifra de
      cupo lleva pegada su ventana y el comando con el que se mide**.
      **También precisa AC-32**: pedía «flechas hasta «Negrita»», pero la única parada de tabulación
      de la barra **ya es** «Negrita» (el roving tabindex arranca en `activeIndex = 0`), así que la
      letra del AC no exigía ninguna flecha. `T-010` lo resolvió con un viaje de **ida y vuelta**
      (`→` Cursiva, `→` Tachado, `←` `←` Negrita) y lo comentó en el caso: quedarse quieto habría
      hecho que ese paso midiera **dónde arranca el foco** en vez de la navegación. Se ajusta la
      redacción a lo que se hizo, porque el recorrido era correcto y la frase era lo que estaba mal.
      **Y deja una deuda con destinatario**: `watchConsole` está **duplicado** entre `editor.spec.ts`
      y `palette.spec.ts` —consecuencia directa de que la lista de artefactos de `T-010` fuera **un
      solo archivo**, y ampliarla habría metido la tarea en `editor.spec.ts`, prohibido en la ola 4—.
      Van dos copias y **ya divergieron en firma**; se extrae a `e2e/support/` **a la tercera**, y esa
      la escribe la `005`. Anotado en `004/spec.md` §4, en `tasks.md` `T-010` y en la fila de la `005`
      de `specs/README.md`.
      **La v0.2.0 es un minor escrito con T-001…T-009 verdes**, y es la razón de que el recuento pase
      a **36 AC** y **11 tareas**. Tres hallazgos, dos ratificaciones y una tarea nueva:
      **(1) AC-27 reescrito, el más serio.** Se implementó **según su letra** —región viva pintada
      tras la primera inserción— y la letra estaba mal: una región que entra en el DOM **con su texto
      dentro** es notoriamente poco fiable en NVDA y JAWS, porque el lector anuncia **cambios** de
      regiones que ya conocía, no apariciones. El AC estaba **verde en CI y era falso** justo para
      quien lo necesita, y la accesibilidad es un objetivo declarado de esta spec (seis AC propios),
      no un extra. Arreglarlo obliga a montar la región siempre, y eso choca con el `role="status"`
      **sin nombre accesible** de `SaveStatus`: **seis** aserciones consultan `getByRole('status')` sin
      desambiguar —cuatro de componente y **dos de e2e**, estas con **violación de modo estricto** de
      Playwright—. **Decisión: poner nombre accesible a las dos regiones** y desambiguar por nombre,
      en la tarea **T-011** nueva. Se descartaron documentar la limitación (deja publicado un
      criterio que el test confirma y el usuario no recibe) y aplazarlo a otra spec (AC-27 quedaría
      marcado como verificado). Y hay un argumento de calendario: la **`005`** añadirá interfaz a esa
      misma página —con vista dividida, **dos** paletas—, así que la consulta sin nombre se iba a
      romper igual; pagarlo aquí es más barato que heredarlo (**riesgo #11** nuevo).
      **(2) AC-36 nuevo**: insertar **dos veces el mismo elemento** no vuelve a anunciar, porque
      escribir el mismo texto no muta el DOM. Ningún AC lo cubría. Se verifica con `MutationObserver`
      + `takeRecords()` —síncrono, sin depender de microtareas ni del reloj falso—: **≥ 2** cambios.
      **(3) AC-26 era literalmente inalcanzable**: entre el conmutador y la paleta vive el botón
      **«Guardar»** de la `003`. Se corrige **la redacción, no la cabecera** —pasa a exigir el orden
      **relativo**, que es la razón que el propio AC daba—; mover un control implementado y verificado
      para hacer cierta una frase de esta spec sería el orden de las cosas al revés.
      **(4) AC-20 no se puede medir contando peticiones**, y la spec decía que sí. Medido con
      mutación: llamar a `setDraft` **dos** veces sigue dando **una** petición porque la coalescencia
      se lo traga, y el caso de las tres inserciones sigue viendo `toHaveLength(1)`. El conteo cubre
      «no hay un segundo camino de guardado»; lo que cubre «`setDraft` se llama una sola vez» es la
      aserción del **borrador exacto**. Las **dos mitades** quedan escritas en el AC con la medida de
      cada una, y corregida la fila del riesgo #2 donde vivía la afirmación equivocada.
      **(5) Dos desviaciones menores ratificadas**: `disabled?: boolean` **se retira** de `plan.md`
      §4.4 (el propio plan lo llamaba «reservado» y la decisión C dice que la paleta no se deshabilita
      nunca: ningún test podía cubrirlo); y **el andamio vacío es parte del RED** → **§9.7** nueva,
      porque ya ha pasado tres veces en esta spec (T-001, T-005, T-006). Un `Cannot find module` es
      rojo, pero solo demuestra que el archivo no está; el RED que vale es el **de la aserción**.
      **Por qué minor y no el patch que se pedía**: las correcciones (3) y (4) habrían sido patch por
      sí solas —no mueven una línea de código—, pero (1) y (2) añaden un AC, una tarea y un artefacto
      nuevo (`SaveStatus.tsx`), y **obligan a cambiar aserciones de tests verdes**. Es exactamente el
      criterio con que la **v0.4.0 de la `002`** se declaró minor siendo aditiva. Escribir «patch»
      encima de trabajo no previsto es el atajo que el versionado existe para no tomar.
      **La v0.1.2 fue un patch de corrección escrito con T-001…T-005 ya verdes**, y es la razón de que el
      recuento pase a **35 AC**. Cinco cosas: (1) el catálogo tiene **16 elementos, no 14** —error
      aritmético que contradecía a la propia AC-16 (su enumeración nombra 16) y a AC-30 (espera 16
      elementos HTML), corregido en **diez** sitios: los ocho de `spec.md`/`tasks.md` más `plan.md`
      decisión 5 y este archivo—; (2) **AC-35 nuevo**: *ningún bloque destruye la selección de la
      persona*. `table` y `divider` con una selección activa no estaban definidos, y la lectura literal
      de §3.D convertía un clic en «Separador» con un párrafo seleccionado en **borrado del párrafo**, sin
      aviso y sin deshacer. Se modela con `consumesSelection` y **solo `codeBlock`** la lleva a `true`;
      mutación **M26**; (3) cuatro huecos más ratificados con lo implementado —regla única de separación
      de bloques (AC-12+AC-13), **empate al inicio** del borde de línea más cercano, selección parcial de
      una sola línea unificada con la multilínea (AC-8), y líneas de solo espacios tratadas como vacías
      (AC-9, mutación **M19**)—; (4) `plan.md` §4.2 al día con la firma real
      `selectTargetWhenWrapping?: string` (no el booleano que decía la v0.1.1: el booleano obligaba a
      deducir el trozo de `after` analizando paréntesis); (5) **§9.6 nueva** con la lección de que **la
      guarda de pureza no puede convivir con un comentario que la explique** —lee el fuente con
      `readFileSync` y no distingue código de comentario—, y la consecuencia para las listas de
      artefactos. **Es patch y no minor** porque AC-35 no abre alcance: escribe lo que T-004 ya implementó
      y ya cubre con test.
      **Las seis decisiones abiertas de §8 quedaron resueltas el 2026-07-28, las seis en la opción que la
      spec recomendaba y sin ningún cambio de alcance**: en ese momento el recuento se mantenía en **34
      AC** y **10 tareas** (desde la v0.1.2, **35 AC** y las mismas 10 tareas), ni un solo AC cambió de
      redacción y ningún artefacto entró ni salió. Por eso la subida es
      **patch (v0.1.0 → v0.1.1)** y no minor. Las seis: **A** marcador de posición **preseleccionado** ·
      **B** se **acepta** la pérdida de `Ctrl`+`Z`, **con el remedio planificado** (ver abajo) · **C**
      paleta **solo en modo texto** · **D** **los tres** atajos `Ctrl`/`Cmd`+`B`/`I`/`K`, acotados al foco
      dentro del `<textarea>` · **E** tabla **fija 3 × 2** · **F** **con** anuncio en región viva.
      **Lo único que la aprobación añade de verdad, y viene por encargo explícito del usuario al resolver
      la B**: la limitación de deshacer se acepta **pero no queda como nota al pie**. La pila de deshacer
      propia está ahora **planificada como trabajo futuro con destinatario** en la **§9 nueva** de
      `004/spec.md`, con el qué, el porqué y el cómo. **Qué**: pila de deshacer/rehacer propia en el store,
      **por documento**, que cubra tecleo e inserciones. **Por qué**: el problema no es de la paleta sino
      del **control controlado** —el `<textarea>` recibe su `value` del `draft`, así que toda escritura
      programática hace que React reescriba el contenido y esa reescritura **no entra en la pila nativa**:
      la invalida—, y `execCommand('insertText')` **no es la salida** (deprecado; **jsdom no lo
      implementa**, o sea mockear y **verificar el mock en vez del comportamiento**; y la variante «con
      respaldo» es peor, porque el respaldo sería lo **único** que los tests ejercitan). **Cómo**:
      `UndoState` (`past`/`future`) **dentro de `EditorEntry`**, transacciones que guardan **texto y
      selección** en los dos extremos, inserción de paleta/atajo = **una** transacción y tecleo agrupado
      por ventana de **~500 ms**, registro **dentro de `setDraft`** —que sigue siendo el único camino— y
      deshacer implementado **como otro `setDraft`**, heredando sucio, debounce y coalescencia. Los dos
      umbrales (~500 ms de historial, 1.500 ms de guardado) **no se comparten ni deben igualarse**: uno es
      granularidad de historial y el otro tráfico de red.
      **Asignado a la spec `006-editor-undo`**, **dependiente de la `005`** — no dentro de la `004` (es un
      modelo de historial, no una paleta) ni dentro de la `005` (que ya carga con la política de desalojo y
      con la dedup de `open(id)`), y **después** de la `005` por una dependencia real: la pila vive dentro
      de `EditorEntry` y es la `005` quien decide cuándo se desaloja una entrada; desalojarla **tira su
      historial**. **Restricción que la `005` hereda desde hoy**: al fijar su política de desalojo debe
      dejar escrito si «cerrar una pestaña y volver a abrirla pierde el deshacer» es aceptable. Anotado
      también en `004/plan.md` §7 y en `specs/README.md` (filas de la `005` y de la `006`).
      **34 criterios de aceptación y 10 tareas TDD, todas de `frontend`** (**35 AC desde la v0.1.2**, con
      las mismas 10 tareas; **36 AC y 11 tareas desde la v0.2.0**, que es la única versión que ha
      añadido trabajo). Es la primera spec del proyecto
      **sin una sola tarea de backend**, y esa es su decisión de más impacto: la `004` toca
      **exclusivamente `apps/web`**; `packages/shared` y `apps/api` no reciben ni una línea, y **AC-34** lo
      convierte en algo verificable (`git status` + los recuentos de las suites de los otros dos paquetes,
      que tienen que salir idénticos a los del cierre de la `003`: shared **81** · api unit **305** ·
      api e2e **511**).
      El motivo del alcance no es la comodidad: el servidor guarda el contenido como **texto opaco** y no
      interpreta markdown en ningún punto, y el catálogo de la paleta es copia de interfaz en castellano
      sin **ningún** consumidor de servidor. Meterlo en `packages/shared` habría comprado, a cambio de
      nada, el coste que la `002` y la `003` ya pagaron: un cambio en `shared` deja `apps/api` en **rojo de
      compilación** hasta que aterriza la tarea de DTO —así que esas dos tareas **no se paralelizan**— y el
      radio del cambio incluye los **fixtures de test de los dos paquetes**, que no se encuentran buscando
      el nombre del endpoint sino el del **tipo**. A la `002` se le quedó corta la lista de artefactos
      **dos veces** por exactamente eso (sus v0.4.2 y v0.4.3).
      **Una afirmación de la `003` que esta spec corrige.** La `003` §4 daba por hecho que la paleta usaría
      `setRangeText`. **No lo usa** (decisión 3 de `plan.md`): `setRangeText` muta el `value` del DOM por
      fuera de React y en un `<textarea>` **controlado** el render siguiente lo pisa. El camino limpio es
      calcular la cadena nueva → `setDraft` → restaurar la selección en un `useLayoutEffect`. No es un
      detalle: verificado con `context7` contra la documentación de React, un control controlado al que se
      le asigna un valor distinto de `e.target.value` **manda el caret al final**, así que sin restauración
      explícita cada inserción tiraría a la persona al final del documento. De ahí que **AC-21** sea un AC
      propio y afirme `selectionStart`/`selectionEnd` **reales del DOM**, no lo que devolvió el núcleo.
      **Alcance devuelto a quien lo asignó**: la `003` había puesto «deshacer agrupado» aquí. La `004` lo
      **declina con motivo**: la única forma de conservar la pila nativa desde un `<textarea>` controlado es
      `document.execCommand('insertText')`, deprecado y **no implementado por jsdom**, así que adoptarlo
      obliga a mockearlo en todos los tests de componente —verificar el mock en vez del comportamiento—. Un
      `execCommand` con respaldo sería peor: el respaldo sería lo **único** que los tests ejercitan.
      Consecuencia asumida y escrita: `Ctrl`+`Z` deshace lo tecleado, no una inserción de la paleta.
      **Lo heredado de la `003` que la spec respeta punto por punto**: (1) **cero plugins** de
      remark/rehype —GFM ya renderiza tablas, tareas y tachado, así que lo que la paleta produce es un
      **subconjunto** de lo que la `003` ya midió—, y por tanto la cadena de saneado no se toca ni hay que
      volver a medirla; (2) el **corpus de XSS sí se amplía** con AC propio (**AC-31**), porque la paleta
      vuelve alcanzables de **un clic** tres contenedores que el corpus **no visita hoy** —dentro de una
      valla de código, dentro de una celda de tabla y dentro de un elemento de tarea—: tres cargas nuevas
      producen doce casos de jsdom más el recorrido de Chromium **sin escribir una línea de test**, y la
      guarda de tamaño sube de `>= 10` a `>= 15` **en los dos archivos que la afirman** (`tasks.md` T-009
      lo señala como el error concreto que esa tarea existe para no cometer); (3) el cupo de
      `documentContent` **no se neutraliza** —la política es **gastar menos, no neutralizar más**—, así que
      el caso de navegador agrupa sus inserciones dentro de una sola ventana de debounce y fuerza **un**
      guardado (**AC-33**).
      **Accesibilidad con seis AC propios** (AC-24…AC-29), porque la paleta es interfaz de inserción:
      `role="toolbar"` con grupos, **roving tabindex** (una sola parada de tabulación para dieciséis
      botones), flechas y `Home`/`End` con movimiento **real** del foco, región viva propia que no se anida
      con la de guardado, orden de tabulación con la paleta **antes** del área de texto, y tamaño de
      objetivo ≥ **24 × 24 px** (WCAG 2.2 SC 2.5.8) medido en Chromium porque jsdom no calcula disposición.
      **Seis decisiones abiertas** en `spec.md` §8 (A-F), cada una con su opción recomendada: qué queda
      seleccionado al insertar sin selección · aceptar la pérdida de `Ctrl`+`Z` · paleta solo en modo texto
      · atajos `Ctrl`/`Cmd`+`B`/`I`/`K` pese a que pisan atajos del navegador · tabla fija 3 × 2 · anuncio
      en región viva. **Ninguna bloquea la implementación**, pero las seis cambian lo que se ve.
      APIs verificadas con `context7` antes de escribirlas: React (caret de un control controlado) y
      `user-event` 14.6.1 (`initialSelectionStart`/`initialSelectionEnd`, `pointer({ target, offset })`,
      `{Control>}a{/Control}`). **Ninguna dependencia nueva** — la `003` dejó medido el coste del
      ecosistema `unified` (+255 módulos, +160,7 kB) como la vara contra la que juzgar cualquier añadido.
      Verificado: los cuatro archivos existen en `specs/004-markdown-palette/`; `specs/README.md`
      actualizado. **Sin comandos de test que correr todavía** — no hay código de esta spec.
- [ ] **spec 005-tabs-split-view** — tabs tipo VS Code y vista dividida.

_(Cada spec se escribe cuando la anterior está aprobada, para apoyarse en contratos cerrados. Índice y dependencias en `specs/README.md`.)_

## Fase 2 — Implementación de `000-foundation`

Detalle completo en `specs/000-foundation/tasks.md`. Todas las tareas se hicieron en esta sesión (2026-07-24);
cada línea lleva el comando que se corrió y su salida real.

- [x] **T-001** · backend · setup · Raíz del monorepo: tsconfig base, ESLint plano, Prettier, TS 5.9.3
      `pnpm exec tsc --version` → `Version 5.9.3` · `pnpm exec eslint --version` → `v10.8.0`
- [~] **T-002** · backend · setup · `docker-compose.yml` con PostgreSQL 17 y Redis 7 + `.env.example`
      `docker compose ps` → ambos `healthy` · `pg_isready` → `accepting connections` · `redis-cli PING` → `PONG`.
      **Pendiente**: `.env.example` no se pudo tocar (las reglas de permisos deniegan `.env.*`); lo actualiza el usuario.
      **Desvío**: PostgreSQL quedó en el puerto **5433** del host, el 5432 estaba ocupado por otro proyecto.
- [x] **T-003** · backend · setup · Scaffold `apps/api` (NestJS 11, prefijo `/api`, Jest + Supertest)
      `pnpm --filter @one-markdown/api build` → exit 0
- [x] **T-004** · backend · Configuración de entorno validada al arranque (AC-6)
      RED: `Cannot find module './env.validation'` → GREEN: `test env.validation` → **16 passed**
- [x] **T-005** · backend · `GET /api/health` con `HealthResponseDto` (AC-2)
      RED: `Cannot find module '../src/bootstrap'` → GREEN: `test:e2e health` → **2 passed**
- [x] **T-006** · backend · `GET /api/health/ready` con checks PostgreSQL/Redis (AC-3, AC-4)
      RED: `Property 'readiness' does not exist` → GREEN: `test health.service` → **6 passed** (incluye timeout con fake timers) · `test:e2e health.e2e` → **3 passed** contra los contenedores reales
- [x] **T-007** · backend · `ValidationPipe` global + `AllExceptionsFilter` con `ErrorResponseDto` (AC-5)
      RED: **7 de 8 fallando** → GREEN: `test:e2e validation` → **8 passed**
- [x] **T-008** · backend · Swagger montado fuera de producción (AC-7)
      RED: 3 fallando → GREEN: `test:e2e swagger` → **7 passed** (dos archivos, uno por entorno)
- [x] **T-009** · backend · setup · Prisma 7 (`prisma.config.ts`) y Redis conectados
      `prisma generate` → `Generated Prisma Client (7.9.0)` · `prisma migrate status` → conecta a `localhost:5433`.
      `prisma generate` **sí funciona con un schema sin modelos**: no hizo falta adelantar ningún modelo de `001-auth`.
- [x] **T-010** · backend · `packages/shared` con el contrato compartido (AC-12)
      RED: módulo inexistente → GREEN: `--filter @one-markdown/shared test` → **11 passed** · `pnpm typecheck` → 0
- [x] **T-011** · frontend · setup · Scaffold `apps/web` (Vite 8, React 19, Tailwind 4 vía plugin de Vite)
      `pnpm --filter @one-markdown/web build` → `✓ built in 149ms`
- [x] **T-012** · frontend · App shell, enrutado y 404 (AC-9, AC-10)
      RED: `./routes` inexistente → GREEN: `test` → **7 passed**
- [x] **T-013** · frontend · Cliente HTTP tipado contra el contrato compartido (AC-12)
      RED: `./http` inexistente → GREEN: `test` (web completo) → **14 passed**
- [x] **T-014** · frontend · Smoke e2e con Playwright (AC-11)
      RED: sin `playwright.config.ts` Playwright recogía los tests de Vitest y fallaba → GREEN: `pnpm test:e2e` → **3 passed**
- [x] **T-015** · backend · CI en GitHub Actions (AC-14) — verificado el 2026-07-25
      **AC-14 cerrado con runs reales, las dos mitades**: run **`30140383389` en verde** en Node 22 **y** 24
      (`verify (node 22)` 1m47s, `verify (node 24)` 1m9s), y dos runs en rojo por fallos de verdad
      (`30139345799`, el defecto del AC-1; `30143727278`, el e2e de navegador). El job falla cuando algo
      falla y pasa cuando todo pasa: es exactamente lo que pedía el criterio.
      **De paso cierra el riesgo #3 de la spec `001`**: `bcrypt` 6 (módulo nativo) compila y funciona en
      Node 22 y 24 del runner, no solo en el Node 25 de esta máquina.
      `.github/workflows/ci.yml` escrito y parseado con js-yaml (13 pasos, matriz Node 22/24, servicios postgres+redis).
      **2026-07-24, primer run real** (`30139345799`, tras el push del usuario): **rojo** en `Typecheck`, en
      las dos versiones de Node. No fue un falso positivo del CI: era un defecto real del AC-1 (ver la nota
      de verificación abajo y `specs/000-foundation/CHANGELOG.md` v0.1.2). Con eso queda cubierta la mitad
      negativa del `DONE` (el job se pone rojo cuando algo falla), y con más valor que un test roto a mano.
      **Falta**: el run verde con el arreglo pusheado.
- [x] **T-016** · backend · Regla anti-`any` verificable con fixture de lint (AC-13)
      Con la regla desactivada el fixture sale 0; con la config del proyecto sale 1 con `@typescript-eslint/no-explicit-any` × 2. `pnpm lint` sigue en 0.

## Fase 3 — Implementación de `001-auth`

Detalle completo en `specs/001-auth/tasks.md`. Spec **aprobada el 2026-07-24**: la fase está en curso.
Cada línea llevará el comando que se corrió y su salida real, igual que la Fase 2.

Base (dependencias, entorno, esquema):

- [x] **T-001** · backend · setup · Dependencias de auth — 2026-07-24
      13 paquetes en las versiones exactas del plan (`pnpm add -E`), `pnpm --filter api build` → exit 0.
      Smoke real de las tres dependencias con riesgo: **bcrypt** (nativo, riesgo #3) → hash `$2b$04$`,
      `compare` correcto/incorrecto → `true false` en Node v25.8.2 · **otplib 13** → secret base32,
      token de 6 dígitos, `verify().valid === true`, `generateURI` → `otpauth://totp/One%20Markdown:…` ·
      **qrcode** → `data:image/png;base64,…` · `@nestjs/throttler` → `seconds(60) === 60000` (ms).
      El riesgo #1 (API nueva de otplib 13) queda cerrado: se comporta como dice el plan.
      **Pendiente**: bcrypt en Node 22/24 se confirma en el próximo run de CI.
- [x] **T-002** · backend · Variables de entorno de auth validadas al arranque (AC-26) — 2026-07-24
      RED: `Property 'MFA_ENCRYPTION_KEY' does not exist on type 'AppConfig'` (+7 errores TS más) →
      GREEN: `test env.validation` → **33 passed** (antes 16).
      Verificado además en el **proceso real** (no solo en el test): sin la variable →
      `MFA_ENCRYPTION_KEY es requerida`; con una clave de 16 bytes →
      `debe decodificar a exactamente 32 bytes (tiene 16); genérala con: openssl rand -base64 32`.
      Y arrancando con el `.env` del usuario → `Nest application successfully started`, lo que **verifica
      indirectamente que sus variables nuevas son correctas** (pendiente 5 de la lista de abajo).
      `BCRYPT_ROUNDS=4` y una `MFA_ENCRYPTION_KEY` fija quedaron en `test/setup-env.ts`.
- [x] **T-003** · backend · setup · Modelos `User` y `MfaRecoveryCode` + migración — 2026-07-24
      `prisma migrate dev --name auth_user_mfa` → migración **`20260725020837_auth_user_mfa`** aplicada ·
      `prisma migrate status` → `Database schema is up to date!`
      Esquema real verificado con `psql`, no solo con el schema: `users` con sus 8 columnas,
      `users_email_key` UNIQUE, `mfa_recovery_codes` con `mfa_recovery_codes_userId_idx` y FK
      `ON DELETE CASCADE`. Probado en una transacción con `ROLLBACK`: el correo duplicado revienta con
      `duplicate key value violates unique constraint "users_email_key"` y al borrar el usuario quedan
      **0** códigos huérfanos. Sin filas residuales (`0|0`).
      **Desvío**: el prefijo de la migración lo pone Prisma (`20260725020837`, UTC), no el
      `20260724_auth_user_mfa` que anticipaba el plan.

Primitivas de sesión:

- [x] **T-004** · backend · `PasswordService` con bcrypt y hash señuelo (AC-4) — 2026-07-24
      RED: `Cannot find module './password.service'` → GREEN: `test password.service` → **10 passed**.
      Incluye la verificación del coste real de producción (`$2b$12$`) además del 4 de los tests, y que
      `compareWithDecoy` **ejecuta un bcrypt de verdad** contra un hash señuelo (decisión 9: sin eso el
      tiempo de respuesta delata qué correos existen, aunque el cuerpo del 401 sea idéntico).
      **Hallazgo**: `jest.spyOn(bcrypt, 'compare')` falla con `Cannot redefine property`; los exports de
      bcrypt no son reconfigurables. Se resolvió con `jest.mock` que **delega en `requireActual`**, así el
      test sigue ejecutando bcrypt real y además observa las llamadas.
- [x] **T-005** · backend · `TokenService`: access, refresh y `mfaToken` (AC-5, AC-12) — 2026-07-24
      RED: `Cannot find module './token.service'` → GREEN: `test token.service` → **14 passed**.
      Los cuatro casos de token cruzado están cubiertos: refresh como access, access como refresh,
      `mfaToken` como access, y un token con el **secreto correcto pero `typ` equivocado** (que es el que
      seguiría fallando si algún día los secretos se unificaran por error).
- [x] **T-006** · backend · `SessionStore` en Redis (AC-9…AC-11) — 2026-07-24
      RED: `Cannot find module './session.store'` → GREEN: `test session.store` → **12 passed** contra el
      Redis real de docker. Verificado: TTL de la clave y del índice, que el `jti` viejo muere al rotar,
      que la reutilización **vacía toda la familia**, `revokeAll` con `exceptSid`, y que de **dos
      rotaciones simultáneas con el mismo `jti` solo una gana** (la rotación es un script Lua: con
      GET+SET las dos se habrían creído válidas).
- [x] **T-007** · backend · `LoginAttemptService`: bloqueo por cuenta (AC-7) — 2026-07-24
      RED: módulos inexistentes → GREEN: `test login-attempt` → **7 passed**.
      4 fallos no bloquean, el 5.º sí (429 con `retryAfterSeconds` entre 1 y 900), `reset` levanta el
      bloqueo, las claves son `auth:login:(fail|lock):<sha256>` **sin el correo en claro**, y la
      normalización evita que `A@B.test` abra un contador aparte.

Endpoints de sesión:

- [x] **T-008** · backend · `POST /api/auth/register` (AC-1, AC-2, AC-3) — 2026-07-24 · agente `backend`
      RED: **12 failed**, todas `expected 201, got 404` → GREEN: `test:e2e auth-register` → **12 passed**.
      El `409` sale de la violación de índice único de Prisma (`P2002`) y **no** de un `findUnique` previo:
      entre la consulta y el insert cabe otro registro con el mismo correo, y el índice es el único juez atómico.
- [x] **T-009** · backend · `POST /api/auth/login` sin segundo factor (AC-5, AC-6, AC-7) — 2026-07-24 · agente `backend`
      RED: **10 failed** (404) → GREEN: `test:e2e auth-login` → **10 passed**.
      El mensaje del 401 es una **constante compartida** por los dos caminos, no un literal repetido: si cada
      rama escribiera su texto, un retoque reabriría la enumeración de cuentas sin que se note.
- [x] **T-010** · backend · `JwtAuthGuard`, `@CurrentUser()` y `GET /api/auth/me` (AC-8, AC-12) — 2026-07-24 · agente `backend`
      RED: **10 failed** (404) → GREEN: `test:e2e auth-me` → **10 passed**.
      **Contrato para la spec `002`**: `import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../auth'`.
      `AuthenticatedUser` incluye `sid` (lo necesita `mfa/disable` para preservar la sesión actual). El guard
      valida que el `sub` sea UUID antes de consultar, para que un token manipulado dé 401 y no un 500 de Postgres.
- [x] **T-011** · backend · `POST /api/auth/refresh` y `POST /api/auth/logout` (AC-9…AC-11) — 2026-07-24 · agente `backend`
      RED: **12 failed** (404) → GREEN: `test:e2e auth-session` → **12 passed**.
      `refresh` rota sobre el **mismo `sid`**: un `sid` nuevo por refresh haría crecer la familia sin límite y
      "revocar la familia" dejaría de servir. `RefreshRequestDto` es una clase vacía a propósito, para que
      `forbidNonWhitelisted` rechace con 400 cualquier cuerpo en un endpoint cuya credencial es la cookie.
      `bootstrap.ts` monta `cookie-parser` y `enableCors({ credentials: true })` (decisión 13).

MFA TOTP:

- [x] **T-012** · backend · `MfaSecretCipher` AES-256-GCM (AC-14) — 2026-07-24 · agente `backend`
      RED: `Cannot find module './mfa-secret.cipher'` → GREEN: **17 passed**.
      Verificado por el orchestrator (`test "mfa-secret.cipher|totp.service"` → **37 passed**) y revisado
      a mano: IV de 12 bytes por operación, tag GCM verificado, formato `iv.tag.ciphertext` en base64url,
      guarda de clave de 32 bytes en el constructor y **error único** en todo fallo de descifrado (no
      dice en qué byte se equivocó quien manipule la fila).
- [x] **T-013** · backend · `TotpService` sobre otplib 13 + QR (AC-13, AC-17) — 2026-07-24 · agente `backend`
      RED: `Cannot find module './totp.service'` → GREEN: **20 passed**.
      Tolerancia ±30 s comprobada empíricamente (−25 s acepta, ±90 s rechaza); `epoch` inyectable, así
      que ni los tests ni los e2e dependen del reloj de la máquina.
      **Desvío autorizado a posteriori**: el agente tuvo que tocar el bloque `jest` de
      `apps/api/package.json`. `otplib` 13 arrastra `@scure/base` y `@noble/hashes`, que son **ESM puro**,
      y el runtime CJS de Jest moría con `SyntaxError: Unexpected token 'export'`. El arreglo es aditivo
      (`allowJs` + `transformIgnorePatterns` que solo exceptúa esos dos paquetes) y no afecta a `tsc` ni
      a `nest build`. Consecuencias: (a) `test/jest-e2e.json` necesita el mismo par de claves antes de
      T-014/T-015 — se aplica en cuanto el agente del Bloque C suelte `test/**`; (b) `require('otplib')`
      exige `require(esm)`, que Node trae sin flag **desde 22.12**, así que `engines` pasa a `>=22.12`
      (la matriz de CI ya instala el último 22.x).
- [x] **T-014** · backend · `mfa/setup` y `mfa/enable` con códigos de recuperación (AC-13…AC-15) — 2026-07-24 · agente `backend`
      RED: **19 failed** (`got 404`) → GREEN: `test:e2e auth-mfa` → **19 passed**.
      El secreto pendiente vive cifrado en Redis con TTL de 10 min: tras el `setup`, `mfaEnabled` sigue
      `false` y `mfaSecret` nulo en la base (AC-13 verificado leyendo la fila, no la respuesta).
      Los códigos de recuperación evitan `I`, `O`, `0` y `1`: se copian a mano de una pantalla.
- [x] **T-015** · backend · Login con segundo factor y `mfa/verify` (AC-16…AC-18) — 2026-07-24 · agente `backend`
      RED: (a) `Cannot find module './mfa-challenge.store'` · (b) **26 failed de 27** → GREEN: `test
      mfa-challenge.store` → **9 passed** · `test:e2e auth-mfa-login` → **27 passed**.
      Dos decisiones que valen: el intento se **contabiliza antes** de verificar el código (un fallo a
      mitad no regala intentos) y el script Lua usa `KEEPTTL`, así que teclear códigos no alarga los 5
      minutos del desafío. `verifyChallenge` cruza `lookup.userId === payload.sub`: un `mfaToken` no sirve
      para completar el login de otra cuenta.
- [x] **T-016** · backend · `mfa/disable` (AC-19) — 2026-07-24 · agente `backend`
      RED: **15 failed de 34** → GREEN: `test:e2e auth-mfa` → **34 passed**.
      Comprueba la contraseña antes del código, con test dedicado a que un intento con contraseña mala
      **no queme** un código de recuperación. Revoca las demás sesiones y deja viva la actual (verificado
      con dos cookies de refresh distintas).

Transversales del backend:

- [x] **T-017** · backend · Rate limit por IP con `RedisThrottlerStorage` propio (AC-20) — 2026-07-24 · agente `backend`
      RED: (a) `Cannot find module './redis-throttler.storage'` · (b) **8 failed de 12** (`expected 429, got 401`)
      → GREEN: `test redis-throttler.storage` → **7 passed** · `test:e2e auth-throttle` → **12 passed**.
      Verificado por el orchestrator **en el proceso real**: 12 logins con correos **distintos** (para que
      salte el límite por IP y no el bloqueo por cuenta) → los 10 primeros `401`, el 11.º y 12.º `429`.
      Los dos `429` no se confunden: el del throttler trae 5 claves y la cabecera `Retry-After-login` de la
      librería; el del bloqueo por cuenta trae `retryAfterSeconds` y la cabecera `Retry-After` estándar.
      `GET /api/health` aguantó 30 peticiones seguidas → **30 × 200**: no se derramó el límite.
      Tres decisiones que sostienen esto:
      · **Opt-in por ruta.** El guard evalúa *todos* los throttlers nombrados en cada petición, así que sin
        `skipIf` + `@Throttled(name)` el más estricto (`register`, 5/15 min) habría caído sobre toda la API,
        incluida la spec `002`. Health lleva además `@SkipThrottling()` explícito: `@SkipThrottle()` a secas
        solo salta un throttler llamado `default`, que aquí no existe.
      · **`generateKey` propio** (`throttle:{throttler}:{sha256(ip)}`, sin nombre de clase ni de handler):
        los cuatro endpoints de MFA comparten **un** cupo de 10/min. Con la clave por defecto de la librería,
        un atacante habría sumado 40 intentos cambiando de endpoint.
      · **`getTracker` usa `req.ip` y `trust proxy` sigue apagado**: nunca `X-Forwarded-For`, que es
        spoofable. Un despliegue tras proxy tendrá que configurarlo, y está anotado en el código.
      **Los tres huecos del Bloque D quedan cerrados, cada uno con su test**: `mfa/disable` limitado (11.º
      intento → 429), `mfa/verify` limitado incluso pidiendo desafíos nuevos a mitad (el ataque exacto), y la
      amplificación bcrypt de los 8 hashes acotada por el mismo cupo.
      **Desvío**: hubo que tocar una línea de `beforeEach`/`afterAll` en los 6 e2e de auth. El límite es por IP
      y todos salen de `127.0.0.1` sobre el mismo Redis: sin resetear el contador fallaban por acumulación, no
      por comportamiento. Ojo con un caso que ya gasta 10 de los 10 logins permitidos.
      **Entrada que atendió**: tres huecos que la autorevisión de seguridad del Bloque D encontró y
      reportó en vez de parchear (el plan asigna `@Throttle` a esta tarea). No son opcionales:
      1. **`POST /api/auth/mfa/disable` no tiene límite de ningún tipo.** `LoginAttemptService` solo cuenta
         fallos de login. Quien robe un access token puede fuerza-brutar el TOTP de 6 dígitos (~333k
         peticiones esperadas) o la contraseña sin fricción. Es el más serio de los tres.
      2. **`mfa/verify` limita a 5 intentos por desafío, pero no el número de desafíos**: quien ya tenga la
         contraseña pide un login nuevo cada 5 intentos y sigue probando.
      3. `RecoveryCodeService.consume` compara hasta 8 hashes bcrypt por intento: con coste 12 son ~2 s de
         CPU por petición en un endpoint sin límite, o sea un amplificador de DoS barato.
- [x] **T-018** · backend · Swagger de auth: bearer, cookie y DTOs (AC-21) — 2026-07-24 · agente `backend`
      RED: **2 failed de 40** (los dos esquemas de seguridad ausentes, `Received: undefined`) → GREEN:
      `test:e2e swagger` → **43 passed**.
      Verificado por el orchestrator contra el documento servido por el proceso real:
      `securitySchemes: bearer, om_refresh` · **9** rutas `/api/auth/*` · el documento entero **no menciona**
      `passwordHash` ni `mfaSecret`.
      El test de "ningún schema se llama como un modelo de Prisma" **lee los nombres de `schema.prisma` con
      una regex** en vez de una lista fija: así no se queda viejo cuando la spec `002` añada modelos.
- [x] **T-019** · backend · Contrato de auth en `packages/shared` — 2026-07-24 · agente `backend`
      RED: `TypeError: isAuthUser is not a function` → **25 failed** → GREEN: `--filter shared test` →
      **37 passed** (antes 11). Verificado por el orchestrator, más `lint` y `typecheck` de `shared` en 0.
      Publica `AuthUser`, `AuthSession`, `LoginResult`, `MfaSetup`, `MfaRecoveryCodes` y sus guards.
      Dos detalles que valen más que el resto:
      · **`ApiErrorShape` gana `retryAfterSeconds?`** — hueco que salió al revisar el Bloque C: el backend
        ya emitía el campo en el `429` de cuenta bloqueada, pero el contrato no lo conocía y el frontend no
        habría podido decir cuánto esperar.
      · Los guards comprueban **presencia de la clave** antes del valor, así que un campo *ausente* no cuela
        como `null`. Sin eso, la regla de "`null` explícito, nunca ausente" sería solo un comentario.
      **Pendiente derivado**: falta añadir `implements LoginResult` en `login.response.dto.ts` y los
      `implements` de los DTO de MFA cuando existan (el agente no los tocó porque otro los estaba editando).

Frontend:

- [x] **T-020** · frontend · Cliente HTTP autenticado con refresh single-flight y reintento único (AC-24) — 2026-07-24 · agente `frontend`
      RED: `configureAuthBridge is not a function`, **16 failed de 23** → GREEN: `test http` → **25 passed**.
      `credentials: 'include'` se aplica **después** del spread del `init`, así que ninguna llamada puede
      desactivarlo por descuido. `login`/`register`/`refresh`/`verifyMfa`/`logout` van por un camino
      distinto y **no pueden** entrar en el circuito de reintento: ahí estaría el bucle infinito.
- [x] **T-021** · frontend · `useAuthStore` y arranque con refresh silencioso (AC-22, AC-23) — 2026-07-24 · agente `frontend`
      RED: `Failed to resolve import "./auth.store"` → GREEN: `test auth.store` → **19 passed**.
- [x] **T-022** · frontend · `/login`, `/register` y `RequireAuth` (AC-22) — 2026-07-24 · agente `frontend`
      RED: **20 failed de 23** (`Unable to find a label with the text of: /correo electrónico/i`) → GREEN:
      `test RequireAuth LoginPage RegisterPage` → **29 passed**.
      `RequireAuth` **no** redirige mientras el estado es `unknown`/`authenticating` (si lo hiciera, el
      refresh silencioso no llegaría a tiempo y el usuario vería `/login` en cada recarga), y
      `readRedirectTarget` rechaza rutas externas y `/login`/`/register`: open redirect y bucle, cerrados.
- [x] **T-023** · frontend · Paso de segundo factor en el login (AC-23) — 2026-07-24 · agente `frontend`
      RED: **6 failed de 15** → GREEN: `test LoginPage` → **15 passed**.
- [x] **T-024** · frontend · `/settings/security`: alta y baja de MFA — 2026-07-24 · agente `frontend`
      RED: **7 failed de 9** → GREEN: `test SecurityPage` → **9 passed**.
      Total web: **92 passed** (venía de 14) · `typecheck` 0 · `lint` 0, verificado por el orchestrator.
- [x] **T-025** · frontend · e2e del flujo de auth en navegador (AC-25) — 2026-07-25 · agente `frontend`
      RED: los 3 del smoke heredados en rojo + el nuevo `element(s) not found` en el `h1` de "Crear cuenta"
      → GREEN: `pnpm test:e2e` → **4 passed** (verificado por el orchestrator, dos corridas seguidas).
      **Destapó un fallo que ningún otro test podía ver: la web no arrancaba en un navegador real.**
      `packages/shared` se publica como CJS y, al ser un paquete enlazado del workspace, Vite no lo
      pre-empaqueta: el `import { isApiErrorShape }` del cliente HTTP moría con `does not provide an export
      named`. Vitest sobre jsdom y `apps/api` consumen CJS sin queja, y `vite build` lo resuelve por Rollup,
      así que el único test que abría un navegador de verdad era el smoke (AC-11)… que llevaba días en rojo
      por otro motivo. **El test que existía para atrapar esto estaba tapado por su propio fallo.**
      Mitigado en el consumidor con `optimizeDeps: { include: ['@one-markdown/shared'] }` (ver
      `specs/000-foundation/CHANGELOG.md` v0.1.4; la solución de raíz —que `shared` emita ESM— queda como
      decisión abierta, no como olvido).
      El API del e2e corre en el **3011**, nunca en el 3001, y el proxy de Vite se parametrizó: así la suite
      no habla por accidente con el proceso que el usuario tenga a mano. `reuseExistingServer: false` en
      ambos servidores, con la consecuencia de que **`pnpm test:e2e` no se puede correr con `pnpm dev`
      ocupando el 5173**.
      Del smoke de la spec `000` solo se añadió un `beforeEach` que abre sesión (desde T-022 el shell vive
      detrás de `RequireAuth`): **ninguna aserción se relajó**, siguen exigiendo `main`, `navigation`, el
      `h1`, el 404, el toggle por teclado y `consoleErrors`/`pageErrors` en `[]`.
      La única tolerancia está en el flujo nuevo y está acotada: el arranque anónimo sondea
      `POST /api/auth/refresh` a ciegas (la cookie es `HttpOnly`, el JS no puede saber si existe) y Chromium
      anota todo 4xx en consola. Fuera de ese sondeo, cero errores; y **desde que hay sesión, cero de
      cualquier tipo**. Auditado por el orchestrator leyendo las aserciones, no el informe.
      El requisito que le pasé desde T-026 quedó cubierto: `globalSetup`/`globalTeardown` borran solo sus
      cuentas (por prefijo) y los contadores `throttle:*`, con un mini cliente RESP sobre `node:net` para no
      añadir dependencias. Idempotencia entre reintentos verificada con un fallo inyectado y `--retries=1`:
      correo único por **intento**, no por archivo.

CI:

- [~] **T-026** · backend · CI con `prisma migrate deploy` y variables de auth — 2026-07-25 · agente `backend`
      Workflow escrito y verificado en todo lo que se puede verificar sin pushear:
      `Apply Prisma migrations` entra en el **paso 9**, después del typecheck (lint y typecheck son baratos y
      deben fallar primero) y antes de los pasos que tocan la base · las 9 variables del job comprobadas
      contra el `validateEnv` **real** compilado, incluidos los tres casos negativos (clave ausente, clave de
      16 bytes, secretos iguales) · `prisma migrate deploy` contra la base local → `No pending migrations to
      apply`, exit 0 · YAML parseado (14 pasos) y `prettier --check` en verde.
      **Hallazgo que no era teórico**: `actions/setup-node` con `node-version: '22'` se queda con la versión
      **ya cacheada en la imagen del runner** si satisface el rango (`check-latest` es `false` por defecto).
      Como `engines` ahora pide `>=22.12` por la cadena ESM de `otplib`, la matriz pasa a un rango semver
      explícito (`>=22.12 <23`) con `include` + `label`, para no perder el nombre estable del job
      (`verify (node 22)`), que es el que verían unos *required checks*.
      **Bloqueada en**: el `DONE` exige un run verde y `git push` sigue denegado en la sesión. Comparte
      bloqueo con `T-015` de la spec `000`. La mitad negativa ya está cubierta por el run `30139345799`.
      **Riesgo cruzado que detectó y reportó en vez de parchear**: en CI el e2e de API corre antes que el de
      navegador, sobre el mismo Redis y la misma IP, y uno de sus tests **satura a propósito** el rate limit.
      Sin limpiar los contadores entre pasos, los logins del navegador darían `429` intermitentes. El punto
      natural de limpieza es el `globalSetup` de Playwright, que es de T-025: se lo pasé como requisito al
      agente que la está implementando, junto con la idempotencia entre reintentos (`retries: 2` en CI).

## Fase 4 — Implementación de `002-workspace-tree`

Detalle completo en `specs/002-workspace-tree/tasks.md`. Spec **aprobada el 2026-07-25**, sin cambios de
alcance: **33 AC · 25 tareas** de alcance aprobado, más **AC-34** y **AC-35** (`T-026`, `T-027`) que añadió
la v0.3.0 como endurecimiento de entorno. Cada línea lleva el comando que se corrió y su salida real, igual
que las Fases 2 y 3.

**Estado al 2026-07-25: FASE CERRADA POR COMPLETO, spec `002` en estado `complete`.** Las **27 tareas**
hechas y verificadas —`T-001`…`T-016`, `T-024` y `T-025` de backend; `T-017`…`T-023`, `T-026` y `T-027` de
frontend— y los **35 AC** cubiertos. **Ningún AC sin cobertura**, con **una salvedad escrita y no
escondida**: el rojo de AC-34 es **manual** y CI no lo cazará nunca (el runner arranca siempre con
`node_modules/.vite` frío, así que allí `force: true` y su ausencia son indistinguibles). La tabla de
cifras finales y la comprobación AC a AC están en «Cierre de la Fase 4 y de la spec `002`», más abajo,
junto con los tres hallazgos del navegador que `T-023` destapó y el cierre de las dos tareas de
endurecimiento que aquéllos abrieron.

La spec va por **v0.3.1**. La **v0.3.1** (patch) cierra `T-026` y `T-027` —con lo que AC-34 y AC-35 quedan
cubiertos y la spec pasa a 35/35 AC y 27/27 tareas— y **corrige dos decisiones que había escrito el
orchestrator, no el agente**: (1) AC-35 no se cierra tocando solo `throttle:register:*`, hace falta también
`throttle:login:*`; (2) `global-setup.ts` tenía que estar en la lista de archivos de `T-027`. Las dos
correcciones están en la spec, no solo aquí. La **v0.3.0** (minor) cerró la implementación, corrigió la
redacción de
**AC-32** —decía «el árbol queda vacío» y su propio recorrido lo impide, porque el documento se muda a la
raíz **antes** del borrado recursivo— y añade **AC-34** y **AC-35** con sus tareas. La **v0.2.3** (patch) corrigió un **error de criterio del RED de `T-025`** que
había escrito la propia v0.2.2 —las nueve rutas que declaran `404` **no** son las que llevan `{id}` en la
plantilla de ruta, que son siete— y cierra `T-025` y `T-022`. Ver la nota «Las nueve rutas con `404` no son
las que llevan `{id}`» al final de este archivo. La **v0.2.2** (patch) resuelve la contradicción del `404` de
`GET /api/workspace/tree` entre AC-26 y `plan.md` §4 —gana `plan.md`, la ruta deja de declararlo—, añade
la tarea **`T-025`** con la retirada del decorador, y corrige el «seis endpoints con parámetro de ruta»
del RED de `T-012`, que son **siete**. La nota «El `404` que no puede ocurrir» al final de este archivo
tiene el razonamiento completo; el resumen está en `specs/002-workspace-tree/CHANGELOG.md` v0.2.2.
La **v0.2.0** (minor) añadió **AC-33** y la tarea **`T-024`**, salidas de un
hueco de contrato que destapó `T-008`: `plan.md` §4 promete `413` para un cuerpo por encima de
`JSON_BODY_LIMIT` y lo que salía de verdad era `500`. Se decidió **arreglar el comportamiento en vez de
reescribir el contrato**; el porqué está en la nota «El `413` que no era `413`» al final de este archivo y
en `specs/002-workspace-tree/CHANGELOG.md` v0.2.0. Esa misma versión recogió tres desviaciones de
implementación de `T-006`/`T-007`/`T-008` (`plan.md` §2 decisión 7, §4 y §6) y un endurecimiento del RED
de `T-012`. La **v0.2.1** (patch) cierra AC-33 con su verificación y **deja escrita la regla de
detección**, que es la pieza que se afloja sola; entrada gemela de cierre en
`specs/000-foundation/CHANGELOG.md` **v0.1.6**.
Antes iba por v0.1.1: un patch con tres correcciones que salieron de implementar, ninguna de alcance
—`meta.target` de Prisma no existe en este stack, `tasks.md` contradecía a `plan.md` §6 en el nombre de
los servicios, y §6 no listaba dos archivos que §4 exige de facto—.

Reglas que esta fase hereda de lo aprendido en las anteriores y que se aplican a **todas** sus tareas:

- Los comandos `DONE` se corren también **desde estado limpio** (`rm -rf packages/shared/dist` antes), por
  la lección de `000` v0.1.2: un `dist/` heredado convierte un fallo real en falso verde.
- Un fallo que no se reproduce **no** es transitorio hasta que se explica por qué desapareció
  (lección del `mfa-secret.cipher` intermitente de la Fase 3).
- **Cero dependencias nuevas** (`plan.md` §1). Si una tarea parece necesitar un paquete, se para y se
  reporta.
- `T-004` toca `ErrorResponseDto` y `ApiErrorShape`, que son contrato de la spec `000`. Si algún test de
  `000` o `001` se pone en rojo, se **para y se reporta**: no se ajusta el test de otra spec por cuenta
  propia.

Bloque A — Esquema y dominio puro:

- [x] **T-001** · backend · setup · Modelos `Directory` y `Document` + migración `workspace_tree` — 2026-07-25
      Migración **`20260725045944_workspace_tree`** aplicada · `pnpm exec prisma migrate status` →
      `Database schema is up to date!` (**2** migraciones, la de `001` y esta).
      **Verificado contra el esquema real con `psql` en `localhost:5433`**, no solo contra `schema.prisma`
      (misma exigencia que en `T-003` de la Fase 3, y por el mismo motivo: el archivo declara la intención,
      la base es la que decide):
      · unicidad — existen `directories_parentScopeId_nameKey_key` y `documents_parentScopeId_titleKey_key`,
        y son los **dos únicos** índices únicos de las tablas nuevas (si hubiera quedado además un
        `@@unique` con `parentId` nulable, la decisión 3 del plan estaría a medias y AC-3/AC-14 pasarían en
        local y fallarían con datos reales);
      · índices — `directories_userId_parentId_idx`, `directories_parentId_idx`,
        `documents_userId_directoryId_idx`, `documents_directoryId_idx`;
      · cascada — las **cuatro** claves ajenas (`directories_userId_fkey`, `directories_parentId_fkey`,
        `documents_userId_fkey`, `documents_directoryId_fkey`) con `confdeltype = 'c'`, o sea
        `ON DELETE CASCADE`. Es lo que sostiene AC-11 y AC-19, y se comprueba en `pg_constraint` porque un
        `onDelete: Cascade` mal migrado no se nota hasta que alguien borra algo.
      **Desvío previsto por el propio plan** (§5): el prefijo de la migración lo pone Prisma en UTC, así que
      el nombre real de la carpeta es `20260725045944_workspace_tree`. Igual que en `001`.
- [x] **T-002** · backend · Dominio puro: normalización y validación de nombres (AC-3, AC-4, AC-13, AC-14) — 2026-07-25
      `pnpm --filter @one-markdown/api test workspace` → **2 suites, 70 tests** verdes (medición conjunta
      con T-003, que corrió en paralelo sobre archivos disjuntos; es el estado previo a T-004).
- [x] **T-003** · backend · Dominio puro: grafo del árbol — ancestros, profundidad, altura, ciclo (AC-6, AC-8, AC-10) — 2026-07-25
      Mismo comando y misma corrida que T-002: `test workspace` → **2 suites, 70 tests**.
- [x] **T-004** · backend · `WorkspaceRepository` y traducción de errores de Prisma (AC-22 mecánico, AC-25 traducción) — 2026-07-25
      `pnpm --filter @one-markdown/api test workspace` → **5 suites / 102 tests** ·
      `pnpm --filter @one-markdown/api test` → **16 suites / 241 tests** ·
      `pnpm --filter @one-markdown/shared test` → **39 tests** (venía de 37: el `code?` de `ApiErrorShape`).
      Regresión completa por tocar contrato de la spec `000`: `pnpm --filter @one-markdown/api test:e2e` →
      **11 suites / 171 tests** verdes, más `typecheck` y `lint` en el `DONE`. **Todo desde estado limpio**
      (`rm -rf packages/shared/dist` antes), por la regla de la Fase 4.
      **Corrigió el plan, y es el hallazgo que más valor tiene de la ola**: `plan.md` describía la
      traducción del `P2002` leyendo `meta.target`, y **con Prisma 7.9 + `@prisma/adapter-pg` ese campo no
      llega**. Verificado ejecutando contra la base, no leyendo documentación: lo que emite el cliente es
      `meta.modelName` más `meta.driverAdapterError.cause` (`originalCode: '23505'`, `originalMessage`,
      `constraint.fields` / `constraint.index`). La traducción usa `modelName` como fuente principal y cae a
      `meta.target` y al nombre de la restricción del adapter, **con tests de las dos formas**, para que
      siga funcionando si el adapter entra o sale. Recogido en `specs/002-workspace-tree/CHANGELOG.md`
      v0.1.1: un `meta.target` siempre `undefined` habría mandado los cinco `409` de dominio al mismo
      mensaje genérico sin que ningún test lo delatara.

Bloque B — Directorios:

- [x] **T-005** · backend · `POST /api/workspace/directories` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6) — 2026-07-25
      `pnpm --filter @one-markdown/api test:e2e workspace-directories` → **1 suite / 23 tests** verdes.
      Regresión: `pnpm --filter @one-markdown/api test` → **241** (sin cambio) ·
      `pnpm --filter @one-markdown/api test:e2e` → **12 suites / 194 tests** (171 + 23) ·
      `typecheck` y `lint` en el `DONE`.
      Implementa **`DirectoriesService`**, no `WorkspaceService`: manda `plan.md` §6 (tres servicios), que
      `tasks.md` contradecía. Corregido en `tasks.md` — ver `CHANGELOG.md` v0.1.1, punto 2.
- [x] **T-006** · backend · `PATCH` y `DELETE` de directorio (AC-7, AC-11) — 2026-07-25 · agente `backend`
      RED: los **16** casos nuevos en rojo por ruta inexistente → GREEN:
      `pnpm --filter @one-markdown/api test:e2e workspace-directories` → **1 suite / 43 tests** verdes
      (los 27 de `T-005` más los 16 nuevos).
      Aporta dos piezas que el resto de la fase reutiliza y que por eso se subieron a `plan.md` §6:
      **`DirectoryNotEmptyError`** (el `409 DIRECTORY_NOT_EMPTY` del borrado sin `recursive`, traducido por
      el mismo `domain-error.ts` que los otros dos errores de dominio) y
      **`countDirectoryChildren(scope, id)`** en el repositorio, que suma subdirectorios **y** documentos
      con `userId` en **los dos** `where`. Lo segundo importa: sin el `userId` en el segundo `where`, un
      documento ajeno colgado del mismo id bloquearía un borrado legítimo, y AC-22 no lo vería porque no
      es una lectura.
      **`toStrictBoolean`** queda **exportado** desde `dto/delete-directory.query.dto.ts` a propósito, para
      que la próxima query booleana no escriba un `value === 'true'` que convierte `?recursive=sí` en
      `false` en silencio.
- [x] **T-007** · backend · `POST /api/workspace/directories/:id/move` (AC-8, AC-9, AC-10) — 2026-07-25 · agente `backend`
      RED: **20 de 20** en rojo (ver abajo: la primera pasada dio `18 failed, 2 passed` y **eso no valía**)
      → GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-move` → **1 suite / 20 tests** verdes.
      **La transacción `Serializable` acabó en el repositorio, no en el servicio**, expuesta como
      `inSerializableTransaction(scope, run)` con la interfaz `WorkspaceTreeTransaction`
      (`listDirectoryRefs` / `findDirectory` / `moveDirectory`, las tres con el `userId` cerrado dentro, sin
      firma por la que pasar otro). La **decisión** —ciclo, profundidad, no-op— se queda en el servicio.
      No es un capricho: era la única forma de cumplir a la vez la decisión 7 de `plan.md` §2 («el move va
      en `$transaction`») y el invariante de `workspace-data-access.spec.ts` («solo `workspace.repository.ts`
      nombra `PrismaService`»), que con el `$transaction` en el servicio se habría roto. Recogido en
      `plan.md` §2 decisión 7 y §6.
      **El no-op no escribe**: mover un directorio al padre que ya tiene devuelve la fila leída dentro de
      la transacción, **sin `update`**, y se prueba con `updatedAt` idéntico. `tasks.md` decía «200 sin
      cambios» y esta es la lectura estricta; un `update` idéntico habría movido `updatedAt` y le habría
      dicho al cliente que algo cambió. Es contrato observable —`003-editor` va a leer esas marcas—, así
      que está escrito en `plan.md` §4.
- [x] **T-008** · backend · `POST /api/workspace/documents` y `GET /api/workspace/documents/:id` (AC-12…AC-15) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-documents` → **1 suite / 31 tests**
      verdes · regresión `pnpm --filter @one-markdown/api test:e2e auth-register` → **12** verdes, que hay
      que correr **precisamente porque el límite de cuerpo es global** y esta tarea lo cambia.
      `JSON_BODY_LIMIT` vive en `workspace.constants.ts` y se aplica en `bootstrap.ts` con un *type
      predicate* (`isBodyParserCapable`) en vez de cambiar la firma `INestApplication` de `configureApp`:
      ese cambio de firma habría obligado a tocar **cinco** archivos e2e en mitad de la fase, con otros
      agentes escribiendo en `test/**`. El predicado **lanza al arrancar** si la app no fuera Express, en
      vez de saltarse el límite en silencio y dejar que AC-13 falle por un motivo ajeno al dominio.
      **Destapó un hueco de contrato real, y por eso la spec sube a v0.2.0**: `plan.md` §4 promete `413`
      para un cuerpo por encima de `JSON_BODY_LIMIT` y lo que sale es **`500`**. Ver la nota «El `413` que
      no era `413`» al final de este archivo y `specs/002-workspace-tree/CHANGELOG.md` v0.2.0.

Regresión conjunta corrida por el orchestrator tras cerrar las tres, **desde estado limpio**
(`rm -rf packages/shared/dist` antes, por la regla de la Fase 4):

| Comando | Resultado |
|---|---|
| `pnpm --filter @one-markdown/api test` | 16 suites, **241 passed** |
| `pnpm --filter @one-markdown/api test:e2e` | 14 suites, **265 passed** (venía de 12 / 194) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |

**Ningún test de `000` ni de `001` en rojo**, que era la condición explícita de la fase para `T-008`: es
la única tarea de la ola 3 que toca algo global (el límite de cuerpo de `bootstrap.ts`).

Bloque C — Documentos:

_(`T-008` está arriba, cerrada junto a `T-006` y `T-007`: se despachó en paralelo con ellas a un segundo
agente `backend`, que es justo el reparto que justifica los tres servicios de `plan.md` §6 —
`DocumentsService` frente a `DirectoriesService`, sin dos agentes en el mismo archivo.)_

- [x] **T-009** · backend · `PATCH`, `DELETE` y `move` de documento (AC-16, AC-17, AC-18) — 2026-07-25 · agente `backend`
      RED: **23 + 14** casos nuevos en rojo por ruta inexistente → GREEN:
      `pnpm --filter @one-markdown/api test:e2e workspace-documents` → **1 suite / 54 tests** ·
      `pnpm --filter @one-markdown/api test:e2e workspace-move` → **1 suite / 34 tests**.
      Regresión: `pnpm --filter @one-markdown/api test` → **16 suites / 241** (sin cambio: la tarea no
      añade unitarios) · `pnpm --filter @one-markdown/api test:e2e` → **14 suites / 302** (265 → 302,
      **+37**; el archivo de move pasa a compartirlo con `T-007`, de ahí que las suites no suban).
      **Hizo una mutación de control para demostrar que el test muerde, y eso es lo que salva el
      check-off de ser decorativo**: quitó el `parentScopeId: parentScopeIdFor(...)` del `moveDocument`
      del repositorio y `workspace-move` pasó a **`4 failed, 30 passed`**, cazando exactamente el caso
      «el ámbito de unicidad viaja con el documento» — mover un documento sin recalcular `parentScopeId`
      lo deja compitiendo por la unicidad de su carpeta **anterior**, así que el título duplicado en el
      destino colaría y el duplicado en el origen se bloquearía. Restaurado después, verde otra vez.
      Verificado por el orchestrator contra el código: `workspace.repository.ts` → `moveDocument()` sigue
      escribiendo `parentScopeId: parentScopeIdFor({ userId: scope.userId, parentId: directoryId })` junto
      al `directoryId`.
      **Esta es la práctica que se pide de aquí en adelante para toda tarea cuyo GREEN sea grande**: un
      RED por ruta inexistente prueba que el endpoint no existía, no que las aserciones discriminen. La
      mutación de control es lo único que distingue «54 tests en verde» de «54 tests que pasarían igual
      con el invariante roto».

Bloque D — Árbol y transversales:

- [x] **T-010** · backend · `GET /api/workspace/tree` (AC-20) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-tree` → **1 suite / 12 tests** verdes.
      Regresión: `pnpm --filter @one-markdown/api test` → **241** (sin cambio) ·
      `pnpm --filter @one-markdown/api test:e2e` → **15 suites / 314** (302 + 12) · `typecheck` y `lint`
      en el `DONE`.
      **Detalle del RED que vale la pena guardar: en `workspace-tree.e2e-spec.ts` ningún caso espera
      `404`, y es deliberado.** El `404` de ruta inexistente de Nest es justo el que produce el falso
      verde que destapó `T-007` (`18 failed, 2 passed`), así que aquí todos los asertos de estado son
      `200` o `401`: dos estados que el framework **no** regala mientras la ruta no existe, con lo que el
      rojo inicial no puede pasar por el motivo equivocado. Es la regla del `404` aplicada por diseño del
      archivo en vez de por endurecimiento a posteriori.
      **Nota de medición**: el archivo ya no tiene 12 casos. `T-011` (en curso) le añadió su bloque «tope
      de nodos por usuario (AC-21)» con tres casos que esperan `409`, así que a día de hoy son 15 `it`.
      El **12** es la cifra del `DONE` de esta tarea, corrida cuando esos tres casos aún no existían.
- [x] **T-011** · backend · Tope de nodos por usuario (AC-21) — 2026-07-25 · agente `backend`
      RED unitario: **`4 failed, 2 passed`** con `Expected constructor: ConflictException / Received:
      undefined` (los dos que pasaban son los casos «con un nodo menos, no lanza», que efectivamente no
      lanzaban). RED e2e **de comportamiento, no de compilación**: `expected 409, got 201` en las dos
      altas — la ruta ya existía desde `T-005`/`T-008`, así que el rojo no puede venir del `404` gratis de
      Nest, que es la trampa contra la que se escribió `workspace-tree.e2e-spec.ts` (ver `T-010`).
      GREEN: `pnpm --filter @one-markdown/api test "directories.service|documents.service"` →
      **2 suites / 6 tests** · `pnpm --filter @one-markdown/api test:e2e workspace-tree` →
      **1 suite / 15 tests**. Verificado por el orchestrator, los dos comandos, con esas mismas cifras.
      **`countWorkspaceNodes(scope)` nuevo en `workspace.repository.ts`**, y **solo frena altas**:
      renombrar, mover y borrar siguen funcionando con el workspace en el tope. No es un detalle menor —
      un límite que también bloqueara el borrado dejaría al usuario sin forma de salir de él, que es el
      único camino de vuelta que tiene.
      **El e2e espía el contador, no crea 5.000 nodos**, tal como exigía el RED escrito en `tasks.md`: un
      e2e que tarda minutos deja de correrse, y entonces el AC deja de estar verificado de hecho aunque
      siga en verde en el papel.
- [x] **T-012** · backend · Matriz de propiedad y de credencial sobre los diez endpoints (AC-22, AC-23) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-ownership` → **1 suite / 42 tests**
      verdes **a la primera**. Verificado por el orchestrator con la misma cifra.
      **Ningún agujero de autorización**: los diez endpoints devuelven `404` con los ids de otro usuario,
      ninguno `403`, ninguno `200`; sin `Authorization` y con un *refresh token* como `Bearer`, los diez
      dan `401`; y tras la matriz completa el estado del usuario A es idéntico al inicial.
      Un GREEN a la primera no prueba nada por sí solo, así que se anotan las **dos mutaciones de control**
      con las que se demostró que la matriz discrimina. Enseñan cosas distintas y por eso van las dos:
      1. **Una errata en una URL** de la constante de endpoints hizo caer 5 casos… pero el caso «ninguna
         es `403` / todas son `404`» **siguió verde**, porque el `404` de ruta inexistente de Nest también
         es `404`. Lo que caza la errata es afirmar el **`code`** y el **juego exacto de claves**: el
         cuerpo de una ruta inexistente trae cinco claves y **sin** `code`. Es la confirmación empírica de
         la regla que salió del falso RED de `T-007`, y la razón por la que el RED de esta tarea la exigía
         por escrito en vez de dejarla como buena costumbre.
      2. **Quitar el `userId` del `where` de `findDocument`** lo detectó **primero el compilador**:
         `TS6133: 'scope' is declared but its value is never read`. O sea que `noUnusedParameters` es una
         defensa de primer nivel contra el fallo de autorización más común de este diseño — un parámetro
         de ámbito que se acepta y no se usa. Forzado a compilar, la matriz cayó con
         `getDocument: expected 404, received 200`.
      **Detalle de diseño que queda escrito**: el `DELETE` de un directorio **ajeno y no vacío** responde
      `404`, no `409 DIRECTORY_NOT_EMPTY`. El servicio cuenta los hijos con el `userId` del token
      (`countDirectoryChildren`, de `T-006`), así que para B ese directorio no existe y nunca llega a
      contar nada. Importa porque el `409` sería una **filtración**: confirmaría que el id existe y que
      tiene contenido, que es exactamente lo que la decisión de «`404` nunca `403`» quiere evitar.
- [x] **T-013** · backend · Cascada del usuario y concurrencia (AC-19, AC-25) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test:e2e workspace-cascade` → **1 suite / 2 tests** ·
      `pnpm --filter @one-markdown/api test:e2e workspace-concurrency` → **1 suite / 3 tests**.
      Verificado por el orchestrator, las dos cifras.
      **Cero cambios de producción, y ése era el objetivo**: la tarea existe para demostrar que el índice
      único y la cascada de la migración de `T-001` hacen el trabajo sin código extra. Un GREEN sin
      diff es justo el resultado que se buscaba, y es también el que más fácil se cuela sin verificar, así
      que se hicieron **cuatro mutaciones de control, todas revertidas**:
      · FK sin `ON DELETE CASCADE` (aplicada dentro de `BEGIN … ROLLBACK`, sin tocar la migración) →
        `23503`, o sea que la cascada es lo que hace pasar el test y no el orden de borrado;
      · `renameDirectory` con `nameKey` único **por fila** en vez de por ámbito →
        `Expected [200, 409] / Received [200, 200]`: las dos peticiones concurrentes ganan, que es
        exactamente el defecto que AC-25 vigila;
      · errata en la URL del move → rojo **por la clave `code` ausente, no por el status**, otra vez la
        lección de `T-007`;
      · `@Throttled('login')` en `WorkspaceController` → `429` en la petición 11, que demuestra que el
        cupo de 120/min de `workspace` es real y no heredado.
- [x] **T-014** · backend · Throttler `workspace` y cobertura de throttler en todos los controladores (AC-24) — 2026-07-25 · agente `backend`
      GREEN: `pnpm --filter @one-markdown/api test throttle-coverage` → **1 suite / 9 tests** ·
      `pnpm --filter @one-markdown/api test:e2e workspace-throttle` → **1 suite / 6 tests** ·
      `pnpm --filter @one-markdown/api test:e2e auth-throttle` → **1 suite / 12 tests** (regresión: los
      throttlers de auth siguen igual) · `pnpm --filter @one-markdown/api test redis-throttler` →
      **1 suite / 7 tests** (el quinto nombre no rompe el storage). Verificado por el orchestrator, los
      cuatro comandos, con esas cifras.
      **Cero cambios de producción**: el GREEN ya estaba hecho por `T-005` y `T-010`, que añadieron
      `workspace` a `THROTTLE_NAMES`/`THROTTLE_LIMITS` (120 / 60 s) y `@Throttled('workspace')` a los tres
      controladores del módulo al crearlos. Lo que faltaba eran los dos archivos de test, y **el agente lo
      dijo en vez de inventar un rojo** — misma conducta que `T-016` y `T-024` con las partes de su
      enunciado ya cerradas. Un RED fabricado para que el guion cuadre es el falso positivo que este
      seguimiento existe para no tener.
      La pieza que sí es nueva y la que da valor duradero es `throttle-coverage.spec.ts`: recorre los
      `*.controller.ts` de `src/**` y exige que **cada uno** declare `@Throttled(` o `SkipThrottling(`.
      Con throttlers nombrados y opt-in, un controlador nuevo no se queda con un límite malo: se queda
      **sin ninguno**, que es un fallo silencioso. Este test lo convierte en un rojo.
- [x] **T-015** · backend · Swagger de workspace (AC-26) — 2026-07-25 · agente `backend`
      RED: **3 fallos reales** → GREEN: `pnpm --filter @one-markdown/api test:e2e swagger` →
      **2 suites / 105 tests** (62 casos nuevos; venía de 43 tras `T-018` de la Fase 3). Verificado por el
      orchestrator con la misma cifra.
      **Uno de los tres rojos enseña algo que merece quedar escrito**: un `@Query()` con DTO se publica
      **explotado en parámetros sueltos**, así que la clase nunca llega por sí sola a
      `components.schemas` — `DeleteDirectoryQueryDto` no aparecía aunque estuviera perfectamente
      decorada. Se resolvió con `@ApiExtraModels(DeleteDirectoryQueryDto)` en `directories.controller.ts`,
      que la registra sin cambiar cómo viaja el parámetro. Verificado en el código por el orchestrator.
      **Los siete DTO de entrada son exactamente siete, y la cifra no está escrita a mano**: el test los
      deriva con `readdirSync` sobre `src/workspace/dto/` filtrando `*.request.dto.ts` y `*.query.dto.ts`,
      así que un octavo DTO sin documentar rompe la igualdad en vez de pasar desapercibido.
      **La red de nombres de Prisma se demostró no vacía**, que es lo que le faltaba al test heredado de la
      spec `001`: igualdad **exacta** con `['Directory', 'Document', 'MfaRecoveryCode', 'User']` —si la
      regex sobre `schema.prisma` dejara de leer, la lista quedaría vacía y el test pasaría por vacuidad—
      más una mutación de control (`@ApiSchema({ name: 'Directory' })`) que hizo caer **tres** tests,
      incluido el heredado de `001`.
      **Destapó la contradicción del `404` de `/tree`**, que se resuelve en la v0.2.2 de la spec y deja la
      tarea `T-025`. Ver la nota «El `404` que no puede ocurrir» al final de este archivo. El agente
      siguió el AC —que es lo correcto— y **reportó la discrepancia en vez de elegir por su cuenta entre
      dos artefactos aprobados**; la decisión era del orchestrator.
- [x] **T-025** · backend · `GET /api/workspace/tree` deja de declarar el `404` que no puede emitir (AC-26) — 2026-07-25 · agente `backend`
      Tarea **nueva de la v0.2.2**, salida de la contradicción que midió `T-015`. Numeración append-only,
      igual que `T-024`. **No añade comportamiento**: quita `@ApiNotFoundResponse` de
      `workspace.controller.ts` y separa en `swagger.e2e-spec.ts` la aserción de `404` (nueve rutas) de la
      de `401`/`429` (las diez), con un caso **en negativo** que exige que `/api/workspace/tree` **no**
      tenga la clave `'404'`.
      **RED: un solo fallo y en negativo**, que es exactamente lo que la tarea predecía —
      `GET /api/workspace/tree no declara 404, y no por estar vacío` →
      `Expected value: not "404" / Received array: ["200","401","404","429"]`.
      El «y no por estar vacío» del título no es adorno: el array recibido **es** el juego real de claves de
      la operación resuelta, y el caso afirma antes que la operación existe, que su `operationId` es
      `getWorkspaceTree` y que declara `200`/`401`/`429`. Sin esas tres afirmaciones previas, «no tiene la
      clave `404`» sería cierto por vacuidad sobre un objeto ausente y el test seguiría verde con la ruta
      borrada. Verificado en el código por el orchestrator (`apps/api/test/swagger.e2e-spec.ts`).
      GREEN: `@ApiNotFoundResponse` y su `import` fuera de `workspace.controller.ts`, con el comentario
      invertido —esta ruta no resuelve ningún id, así que no documenta `404`—. Ningún otro controlador
      tocado.
      **Verificación corrida por el orchestrator, no reportada por el agente** (su suite de cierre no llegó
      a ejecutarse), **desde estado limpio** (`rm -rf packages/shared/dist` + rebuild antes):

      | Comando | Resultado |
      |---|---|
      | `pnpm --filter @one-markdown/api test:e2e swagger` | 2 suites, **125 passed** |
      | `pnpm --filter @one-markdown/api test` | 19 suites, **264 passed** |
      | `pnpm --filter @one-markdown/api test:e2e` (**completo, sin filtro**) | 20 suites, **455 passed** |
      | `pnpm --filter @one-markdown/api --filter @one-markdown/shared typecheck` | exit 0 |
      | `pnpm --filter @one-markdown/api --filter @one-markdown/shared lint` | exit 0 |

      **La cuenta cuadra, y por eso vale como medición**: 435 → 455 son +20, que es exactamente el
      desdoblamiento de los dos `it.each` de 10 en 10+9 y 10+9 (los de `401`/`429` y `ErrorResponseDto`
      siguen sobre las diez rutas; los de `404` pasan a nueve) **más** los 2 casos nuevos (el ancla de la
      partición y el caso en negativo). Ni un test apareció ni desapareció por otra vía.
      **`prettier --check` sobre los dos archivos tocados dio un fallo de formato real** —el agente lo
      avisó como incierto en vez de darlo por bueno—; se corrigió con `--write` y se revalidó el e2e de
      swagger en **125** verdes.
      **Con esta tarea el backend de la spec `002` queda completo**: `T-001`…`T-016`, `T-024` y `T-025`.
      **Destapó un error de criterio en el RED que había escrito el orchestrator**, corregido en la v0.2.3
      de la spec: ver la nota «Las nueve rutas con `404` no son las que llevan `{id}`» al final de este
      archivo.
- [x] **T-016** · backend · Contrato de workspace en `packages/shared` (AC-27) — 2026-07-25 · agente `backend`
      RED: **25 casos** en rojo con `TypeError: isDirectoryNode is not a function` (y lo mismo con los
      otros tres guards) → GREEN: `pnpm --filter @one-markdown/shared test` → **65 tests** (venía de 39) ·
      `pnpm typecheck` **con `packages/shared/dist` borrado antes** → los **tres** paquetes en el `DONE` ·
      `pnpm lint` en el `DONE`. Verificado por el orchestrator: `--filter shared test` → **65 passed**, y
      `DirectoryNode`, `DocumentSummary`, `MarkdownDocument` y `WorkspaceTree` con sus cuatro guards
      exportados desde `packages/shared/src/index.ts`.
      **La verificación extra que hizo, y que es la que da valor al `implements`**: alteró `depth: number`
      → `string` **en el artefacto compilado `dist/index.d.ts`** (no en el fuente) y el `typecheck` de
      `apps/api` falló **en dos archivos**. O sea que el `implements DirectoryNode` de los DTO **no es
      decorativo**: si el contrato compartido y el DTO divergen, el fallo sale en compilación y no en el
      navegador. Comprobado por el orchestrator que los cuatro DTO de respuesta del workspace declaran su
      `implements` contra el tipo compartido.
      **Y lo que no hizo, que también cuenta**: parte del enunciado —el `code?: string` de
      `ApiErrorShape`— ya estaba cerrada por `T-004`. El agente lo comprobó y lo **dijo**, en vez de
      fabricar un rojo para que el guion cuadrara.
- [x] **T-024** · backend · `AllExceptionsFilter` traduce el `PayloadTooLargeError` de body-parser (AC-33) — 2026-07-25 · agente `backend`
      **La salvedad de verificación que llevaba escrita queda LEVANTADA el 2026-07-25**: al cerrar la ola
      4 se corrió `pnpm --filter @one-markdown/api test:e2e` **completo y sin filtro** → 20 suites /
      **435 passed**. Ver la tabla «Cierre del backend de la spec `002`» más arriba.
      GREEN: `pnpm --filter @one-markdown/api test all-exceptions` → **1 suite / 12 tests** ·
      `pnpm --filter @one-markdown/api test:e2e "body-limit|validation"` → **2 suites / 11 tests** ·
      suite unitaria completa del API → **18 suites / 255 tests** · regresión dirigida
      `pnpm --filter @one-markdown/api test:e2e "auth-|health|swagger"` → **10 suites / 163 tests**,
      **ningún test de `000` ni de `001` en rojo**, que era la condición explícita de la tarea ·
      `typecheck` y `lint` en el `DONE`. Archivo e2e nuevo: `apps/api/test/body-limit.e2e-spec.ts`.
      Verificado por el orchestrator: `test all-exceptions` → **12 passed**, y el filtro leído entero.
      **Tarea nueva de la v0.2.0**, salida de lo que midió `T-008`. Lleva el número 24 porque la
      numeración es **append-only** —renumerarla dentro del Bloque D rompería las referencias ya escritas
      en este archivo y en la tabla de trazabilidad—, pero pertenece al Bloque D y va en la **ola 4**.
      Toca `apps/api/src/common/filters/all-exceptions.filter.ts`, que es contrato de la spec `000`: mismas
      reglas que `T-004`. Su cierre deja entrada en `specs/000-foundation/CHANGELOG.md` **v0.1.6** (la
      v0.1.5 anunciaba el cambio; la v0.1.6 lo cierra) y en `specs/002-workspace-tree/CHANGELOG.md`
      **v0.2.1**, con la regla también en `plan.md` §1 y §4.

      **Cómo quedó la detección** — se registra aquí porque es la parte que se erosiona con el tiempo, y
      la versión laxa parece equivalente y no lo es:
      · **Duck typing sobre `status` y `statusCode`** (`http-errors` pone las dos) con
        `Number.isInteger(value) && value >= 400 && value <= 499`: rango **cerrado**, no «tiene `status`».
        Sin `import` de `http-errors` ni `instanceof` — sigue siendo transitiva de Express y la regla de
        cero dependencias nuevas queda intacta.
      · **Un `status: 502` no entra en el rango**: cae al `500` genérico y **sigue** pasando por
        `logger.error` con traza. Lo sostiene el otro cambio de la tarea: la decisión de loguear dejó de
        depender del **origen** (`!isHttp || status >= 500`) y ahora depende del **estado**
        (`status >= 500`). Con eso el `413` deja de escribir traza —el defecto operativo que motivó
        AC-33— sin que ningún `5xx` deje de registrarse.
      · **Del error ajeno solo se publica `message`, y solo si es string**; **`code` nunca se copia**, para
        que una librería cualquiera no pueda rellenar el `code` de dominio del workspace, que es con el que
        el frontend distingue cinco `409` distintos.
      · Casos cubiertos por test: `'nope'`, `413.5`, `NaN`, `null`, `true` (no enteros) y `399`, `200`,
        `0`, `-1`, `600` (fuera de rango).

      **Salvedad de verificación (deuda ya SALDADA el 2026-07-25; se conserva el texto porque explica por
      qué se aceptó una regresión dirigida en su momento)**: `T-024` **no** corrió
      `pnpm --filter @one-markdown/api test:e2e` completo — se lo prohibió el orchestrator porque otros
      agentes estaban escribiendo e2e de workspace en `test/**` y una corrida completa habría medido un
      árbol a medias. Lo sustituyó por la regresión dirigida de **12 suites / 174 tests** (las 2 suites /
      11 de `body-limit|validation` más las 10 suites / 163 de `auth-|health|swagger`). **El e2e completo
      del backend debe correrse al cerrar la ola 4**; hasta entonces este check-off lleva la salvedad
      escrita. Ver «Deuda abierta de la ola 4» al final del archivo.
      **Parte del enunciado ya estaba cerrada**: el `code?: string` de `ApiErrorShape` lo había hecho
      `T-004`, y el agente lo reportó en vez de inventar un rojo.

### Cierre del backend de la spec `002` (ola 4) — 2026-07-25

Corrida **de una vez y sin ningún agente escribiendo en `apps/api`**, que es la condición que la propia
fase se puso para que la cifra signifique algo, y **desde estado limpio** (`rm -rf packages/shared/dist`
antes, dejando que `shared:build` lo reconstruya):

| Comando | Resultado |
|---|---|
| `pnpm --filter @one-markdown/api test` | 19 suites, **264 passed** |
| `pnpm --filter @one-markdown/api test:e2e` (**completo, sin filtro**) | 20 suites, **435 passed** |
| `pnpm --filter @one-markdown/api --filter @one-markdown/shared typecheck` | exit 0 |
| `pnpm --filter @one-markdown/api --filter @one-markdown/shared lint` | exit 0 |

`typecheck` y `lint` se corren filtrados a los dos paquetes del backend **a propósito**: el agente
`frontend` está escribiendo `apps/web` en este momento, y un `pnpm typecheck` de la raíz mediría un árbol
a medias — el mismo motivo por el que `T-024` no corrió el e2e completo en su día. La corrida de raíz se
hace al cerrar la Fase 4.

**Con esto queda saldada la deuda del e2e completo que dejó `T-024`** (punto 1 de «Deuda abierta de la
ola 4»): se corrió entero **dos veces**, `373` tras `T-014` y `435` tras `T-015`, en las dos ocasiones con
las 20 suites en verde. La salvedad escrita en la línea de `T-024` **queda levantada**.
La diferencia entre las dos corridas **cuadra exactamente**: `435 − 373 = 62`, que son los 62 casos que
`T-015` añadió a `swagger.e2e-spec.ts`. O sea que entre una y otra no apareció ni desapareció ningún test
por otra vía, que es la comprobación que convierte dos números en una medición.

Bloque E — Frontend:

- [x] **T-017** · frontend · Cliente HTTP: `PATCH`, `DELETE`, `204` y funciones de workspace — 2026-07-25 · agente `frontend`
      RED: **23 fallos** (`TypeError: getWorkspaceTree is not a function`, y lo mismo con las otras nueve)
      → GREEN: `pnpm --filter @one-markdown/web test http` → **48 tests** verdes (venía de 25 tras `T-020`
      de la Fase 3). Verificado por el orchestrator con la misma cifra, y las **diez** funciones de
      workspace leídas en `apps/web/src/shared/api/http.ts`.
      **Hubo un segundo rojo intermedio, y es el que `tasks.md` predecía**: con las diez funciones ya
      escritas pero los `DELETE` pasando todavía por el camino JSON, el test dio
      `expected "json" to not be called at all, but actually been called 1 times`. Un `204` no trae
      cuerpo, así que `response.json()` revienta o devuelve basura según el navegador; la aserción no es
      sobre el valor devuelto sino sobre **que no se intente parsear**, que es la única forma de fijar
      eso. Vale la pena registrarlo porque es un RED que llegó **después** del primer verde parcial: la
      tarea no estaba hecha cuando las funciones existían.
- [x] **T-018** · frontend · `useWorkspaceStore` — 2026-07-25 · agente `frontend`
      GREEN: `pnpm --filter @one-markdown/web test workspace.store` → **21 tests** verdes. Verificado por
      el orchestrator con la misma cifra.
- [x] **T-019** · frontend · Árbol accesible en la barra lateral (AC-28) — 2026-07-25 · agente `frontend`
      GREEN: `pnpm --filter @one-markdown/web test WorkspaceTreeView` → **19 tests** ·
      `pnpm --filter @one-markdown/web test` (completo) → **10 archivos / 156 tests**. Verificado por el
      orchestrator: los 19 de `WorkspaceTreeView`, y el completo hoy da **11 / 169** porque `T-022` ya
      añadió `DocumentViewPage.test.tsx` — el 10 / 156 es la foto del `DONE`, igual que el `12` de
      `T-010` frente a los 15 casos de hoy.
      **Hallazgo que ningún test habría cazado, y por eso se registra entero.** Los tests de la web corren
      con `css: false`, así que ninguna aserción de JSDOM ve una clase de Tailwind resuelta. El agente
      construyó con `vite build` y **grepeó el CSS generado**; ahí apareció un defecto real: el
      `treeitem` llevaba `outline-none`, que fija `--tw-outline-style: none`, la fila hija lo **hereda**,
      y `outline-2` resuelve el estilo **por esa variable** — con lo que **el anillo de foco no se habría
      pintado nunca**. Corregido con `outline-solid` explícito y verificado en el CSS de salida.
      Verificado por el orchestrator en `apps/web/src/features/workspace/TreeNodeRow.tsx`: el `treeitem`
      conserva `outline-none` y la fila lleva
      `[[role=treeitem]:focus-visible>&]:outline-solid` junto a `outline-2` y `outline-blue-700`.
      Es exactamente la clase de defecto de accesibilidad que un test de JSDOM no puede ver: la marca es
      correcta, los `role`/`aria-*` son correctos, el roving tabindex funciona… y el usuario de teclado no
      ve dónde está. **Lección aplicable a `T-020`…`T-023`**: para un criterio de foco visible, el
      artefacto a inspeccionar es el CSS construido o el navegador real (`T-023`), no el DOM de Vitest.
- [x] **T-020** · frontend · Crear, renombrar y borrar desde la UI (AC-29) — 2026-07-25 · agente `frontend`
      RED **de aserción, no de import**: `12 failed | 19 passed`, todos por comportamiento ausente
      (`Unable to find role="button" and name "Nuevo en la raíz"`, y sus hermanos). Los 19 que pasaban son
      los de `T-019`: el rojo no arrastró el árbol accesible que ya estaba cerrado.
      GREEN: `pnpm --filter @one-markdown/web test WorkspaceTreeView` → **1 archivo / 31 tests** ·
      completo → **12 archivos / 188** (venía de 11 / 169) · `typecheck`, `lint` y
      `prettier --check apps/web/src` limpios. Verificado por el orchestrator: `pnpm test` de raíz →
      web **12 / 188**, api **19 / 264**, shared **65**.
      **Cinco decisiones que se registran porque son decisiones, no detalles de implementación**:
      · **`ModalDialog.tsx`**, caparazón compartido que `tasks.md` no nombraba: `role="dialog"`,
        `aria-modal`, foco atrapado, `Escape` y devolución del foco al elemento que abrió. A mano y **sin
        librería porque `jsdom` no implementa el modo modal de `<dialog>`** — con el elemento nativo los
        tests no habrían podido comprobar nada de lo que AC-29 exige. Los cuatro diálogos lo usan.
        Verificado en el código por el orchestrator (`role="dialog"`, `aria-modal="true"`, `Escape`,
        `focusableItems`, `opener?.focus()`).
      · **`CreateNodeForm` va en un modal, no *inline* en la fila**: un `<form>` dentro del `role="tree"`
        rompería el patrón WAI-ARIA, que solo admite `treeitem`/`group` como descendientes.
      · **Dos añadidos al store, que es contrato de `T-018`** — por eso importa el porqué: `expand(id)`
        idempotente, y un `mutate` que acepta `{ reloadOnError }` **que solo pasan
        `moveDirectory`/`moveDocument`**. AC-30 exige recargar ante `409` **y** `404`; el `mutate`
        genérico recarga solo ante `404`, y AC-29 necesita ese contrato **intacto** para su caso «el `409`
        no cambia el árbol». Ampliarlo para todos habría hecho pasar AC-30 rompiendo AC-29. Ningún test de
        `T-018` se tocó y los 21 siguen verdes. Verificado en `workspace.store.ts`: `reloadOnError` solo
        aparece en las dos acciones de move.
      · **«Nuevo en la raíz» va DESPUÉS del árbol en el DOM.** Puesto antes, robaba la primera parada de
        tabulación al roving tabindex de `T-019` y rompió **10** tests de teclado. Se arregló **moviendo el
        botón, no ajustando aquellos tests** — que es lo que vale la pena registrar: el rojo estaba
        diciendo la verdad, y la salida fácil habría sido relajar diez aserciones de accesibilidad.
        Verificado en `WorkspaceTreeView.tsx`: el botón está tras el `role="tree"`, con el motivo en un
        comentario.
      · **Borrar el documento abierto saca de la ruta**: tras un borrado con éxito, si el id de
        `/documents/:id` ya no está en `documentsById` **tras la recarga**, se navega a `/`. La
        comprobación es *post-recarga* y **no** por «id borrado», así que cubre también borrar el
        **directorio** que lo contenía — el caso que la comprobación ingenua se habría dejado. Lo hace el
        árbol; `DocumentViewPage` sigue sin escuchar el store. **Con esto queda cerrada la deuda funcional
        que `T-022` dejó escrita.** Verificado en `deleteNode()` de `WorkspaceTreeView.tsx`.
      Y una consecuencia asumida, escrita para que nadie la descubra como si fuera un fallo: un error de
      mutación **cierra el diálogo** y lleva el foco al `role="alert"` que ya existía en el árbol (no a un
      tercer contenedor), así que **se pierde el texto tecleado**.
- [x] **T-021** · frontend · Mover desde la UI (AC-30) — 2026-07-25 · agente `frontend`
      RED: `7 failed (7)` — el archivo entero en rojo, que es lo correcto para un diálogo que no existía.
      GREEN: `pnpm --filter @one-markdown/web test MoveNodeDialog` → **1 archivo / 7 tests** · regresión
      completa de la web → **12 archivos / 188**. Verificado por el orchestrator con la misma cifra.
      El `{ reloadOnError: true }` del store es de esta tarea (ver `T-020`): AC-30 pide recargar el árbol
      ante `409` **y** `404`, y ése es el único punto donde el árbol de la pantalla puede haber dejado de
      ser cierto — si el servidor dice que el destino es un descendiente y aquí no lo parecía, lo que está
      viejo es el cliente.
- [x] **T-022** · frontend · Ruta `/documents/:id` con vista en crudo (AC-31) — 2026-07-25 · agente `frontend`
      RED **de aserción, no de import**: `10 failed | 1 passed`. El agente dejó un andamio
      `<p>Pendiente</p>` a propósito para que el rojo fuera de **comportamiento** — un módulo inexistente
      habría dado el mismo rojo con cualquier aserción, incluidas las que no discriminan. Los mensajes
      reales: `expected '/' to be '/documents/doc-raiz'`, `Unable to find role="heading" and name "Lunes"`,
      `Unable to find .../cargando el documento/i` y `Unable to find role="alert"`.
      GREEN: `pnpm --filter @one-markdown/web test DocumentViewPage` → **1 archivo / 12 tests** ·
      `pnpm --filter @one-markdown/web test routes` → **1 archivo / 5 tests** ·
      `pnpm --filter @one-markdown/web test` (completo) → **11 archivos / 169 tests** (venía de 10 / 156
      tras `T-019`) · `typecheck`, `lint` y `prettier --check apps/web/src` limpios.
      **Decisión de diseño que conviene tener escrita**: el **título** de la vista sale del documento que
      devuelve el `GET`, **no** de `documentsById`; la **ruta del breadcrumb** sí sale de
      `directoriesById` + `parentId`. El motivo es que entrar por URL directa a `/documents/:id` —un enlace
      pegado, un recargar— tiene que funcionar aunque el árbol todavía no haya llegado, y además el título
      del `GET` es el autoritativo: si el árbol está viejo, la vista no debe mostrar un nombre que ya no es.
      **Cambio obligado en un test ajeno, y el acoplamiento que lo causó**: enganchar `useNavigate()` en
      `activate()` de `WorkspaceTreeView.tsx` rompió las **19** pruebas de `T-019`, porque `useNavigate()`
      revienta fuera de un `<Router>`. El arreglo fue mecánico y mínimo —un helper `renderTree()` que
      envuelve el árbol en `MemoryRouter`—, y queda registrado porque es justo el tipo de acoplamiento que
      sorprende a quien toque el árbol después: desde `T-022`, **montar `WorkspaceTreeView` exige un
      router**. Verificado en el código por el orchestrator: `WorkspaceTreeView.tsx` importa `useNavigate`
      y `WorkspaceTreeView.test.tsx` monta con `{ wrapper: MemoryRouter }`.
      La navegación se hace en `activate()` y **no** con un `<Link>` dentro de la fila, también a propósito:
      el elemento enfocable del roving tabindex es el `treeitem`, y un ancla añadiría una segunda parada de
      tabulación por nodo, rompiendo el patrón *tree* que cerró `T-019`.
      **Deuda funcional que `T-022` dejó explícita y que `T-020` resolvió**: la vista de
      `/documents/:id` **no escucha el store**, así que por sí sola no se entera de que el documento abierto
      se ha borrado. `T-020` tenía que decidir si añadía la navegación de salida, y **la añadió en el árbol,
      no en la vista**: `deleteNode()` de `WorkspaceTreeView.tsx` lee el id abierto de la ruta antes de
      borrar y, si tras la recarga ese id ya no está en `documentsById`, navega a `/`. Verificado en el
      código por el orchestrator; el check-off formal va con `T-020`, que sigue en curso.
- [x] **T-023** · frontend · e2e del árbol en navegador (AC-32) — 2026-07-25 · agente `frontend` ·
      **última tarea de la spec**
      GREEN: `pnpm test:e2e` → **5 passed**, con el smoke (3) y el e2e de auth (1) verdes.
      **Verificado por el orchestrator con la suite corrida por él mismo**: `5 passed (8.8s)`, y la
      limpieza de `global-teardown` informando `cuentas de prueba borradas: 3` — que es la cuenta
      compartida del smoke más las dos que estrenan `auth` y `workspace`, o sea la confirmación de que el
      gasto de altas es el que dice AC-35.
      **No cabía un rojo natural** —la UI ya existía— y el agente lo resolvió como debía: **tres
      mutaciones de control, una por cada eje del recorrido**, todas revertidas y verificadas con `grep`.
      Un solo control habría dejado dos ejes sin demostrar:
      · forzar `recursive=false` → `Expected: 1 · Received: 3` treeitems (eje **borrado en cascada**);
      · un `console.error` al abrir un documento → el aserto de consola lo caza (eje **consola limpia**);
      · `onMove(node.parentId)` en vez del destino elegido → `aria-level` `Expected: "1" · Received: "3"`
        (eje **mover de verdad**, no repintar).
      **Corrigió la spec**: AC-32 decía «el árbol queda vacío» y su propio recorrido lo impide —el
      documento se muda a la raíz **antes** del borrado recursivo—. Se implementó lo que decía `tasks.md`
      («solo el documento movido»), que además prueba más: que el documento **sobreviva** es justo la
      prueba de que la cascada se lleva el subárbol y **solo** el subárbol. Redacción corregida en la
      v0.3.0 de la spec.
      **Tocó una línea de configuración, `playwright.config.ts`**, y sin ella la suite no es reproducible:
      `pnpm dev --force`. Es la mitigación del hallazgo 1 de más abajo; `T-026` la retira.

Bloque F — Endurecimiento del entorno (alcance de la v0.3.0, cerrado en la v0.3.1):

- [x] **T-026** · frontend · `optimizeDeps.force` en `vite.config.ts` y retirada del `--force` de
      `playwright.config.ts` (AC-34) — 2026-07-25 · agente `frontend`
      **RED de comportamiento, medido y no inferido**, que es lo que el enunciado exigía —un test que lea
      `vite.config.ts` y afirme que dice `force: true` sería una tautología—: con el `--force` retirado de
      `playwright.config.ts` y `apps/web/node_modules/.vite/deps/@one-markdown_shared.js` sembrado **sin**
      `isWorkspaceTree` (`grep -c` → **0**) y **sin tocar `_metadata.json`**, `pnpm test:e2e` →
      **`1 failed / 4 passed`**. Y el fallo es **el correcto**, no un rojo cualquiera: snapshot con
      `alert: Ocurrió un error inesperado…` **y** traza de red del mismo caso con
      `/api/workspace/tree | 200`. O sea que el servidor respondía bien y quien fallaba era el bundle
      rancio, que es exactamente el defecto que AC-34 describe.
      **La demostración en tres pasos, y se registra porque es la que descarta la explicación alternativa.**
      Ese rojo, solo, deja viva la hipótesis de que a la caché la salve después el **`configHash` nuevo**
      que introduce el propio cambio de `vite.config.ts` —un `configHash` distinto invalida la caché por su
      cuenta, y entonces el `force` sería decorativo—. El agente lo descartó envenenando **contra ese mismo
      `configHash`**:
      1. `pnpm test:e2e` ya con `force: true` → **5 passed**; la caché queda reconstruida **con el
         `configHash` nuevo**.
      2. Se envenena **esa** caché: `grep -c isWorkspaceTree` pasa de **2** a **0**, y `node --check`
         confirma que el fichero envenenado **sigue siendo JavaScript válido** — o sea que el guard llega
         `undefined` y **no** hay un error de parseo que enmascare el resultado por otro camino.
      3. `pnpm test:e2e` → **5 passed**.
      Con los dos hashes casando, lo único que puede salvar esa caché es `force`. Sin el paso 3 este
      check-off habría sido decorativo.
      **DONE**: `pnpm test:e2e` → **5 passed** · `pnpm --filter @one-markdown/web test` → 12 archivos /
      **188**, sin cambios · `typecheck` y `lint` EXIT=0 · `prettier --check` limpio.
      Verificado en el código por el orchestrator: `apps/web/vite.config.ts` lleva
      `optimizeDeps: { include: ['@one-markdown/shared'], force: true }` con el mecanismo de los dos hashes
      y la salida ESM escritos en el comentario, y `apps/web/playwright.config.ts` arranca la web con
      `command: 'pnpm dev'` **sin `--force`**, con el porqué anotado en el propio archivo. Se respetó la
      lista de archivos de la tarea: esos dos y nada más. **Ningún test de `000` cayó.**
      Entrada de cierre en `specs/000-foundation/CHANGELOG.md` **v0.1.7** (`vite.config.ts` es contrato de
      esa spec), que además **cierra la revisión que la v0.1.4 dejó apuntada**: «se revisará cuando la spec
      `002` amplíe el contrato compartido» — la amplió, y la mitigación de entonces resultó insuficiente.
- [x] **T-027** · frontend · Cupo de altas y de entradas de la suite de navegador (AC-35) — 2026-07-25 ·
      agente `frontend`
      **RED real, corrido antes de tocar nada**:
      `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` →
      **`10 failed / 5 passed`**, con `POST /api/auth/register devolvió 429`. Es el rojo que el enunciado
      había escrito por adelantado.
      **DONE, los tres comandos**: el mismo `--retries=2 --repeat-each=3` → **15 passed**, EXIT=0 ·
      `pnpm test:e2e` → **5 passed** · `pnpm --filter @one-markdown/api test:e2e` → 20 suites / **455**,
      que es lo que prueba que el rate limit de `001` **sigue** verificándose donde le toca.

      **Dos desviaciones, y las dos corrigen la decisión del orchestrator, no la del agente.** Van también
      en la spec (`spec.md` AC-35, `tasks.md` T-027, `CHANGELOG.md` v0.3.1), porque un pendiente que solo
      vive en el seguimiento es como desaparece la deuda en este proyecto:

      1. **AC-35 no se puede cerrar tocando solo `throttle:register:*`.** El reset hubo que aplicarlo
         **también a `throttle:login:*`**. La cuenta real del escenario del AC —todos los casos agotando
         `retries: 2`—: smoke 3 casos × 3 intentos = **9** entradas, más el flujo de auth, que vuelve a
         entrar en cada intento (**3**) → **12 contra un cupo de 10/min**. Ese gasto **ya existía** antes
         del cambio: el `signIn` viejo también hacía `login` después del `409`; lo que pasaba es que el
         `429` de `register` llegaba primero y lo tapaba. Medido, no supuesto: con el reset solo de
         `register`, el `DONE` seguía **rojo** con `POST /api/auth/login devolvió 429`. El agente verificó
         **antes** de neutralizarlo que el límite de `login` está cubierto en
         `apps/api/test/auth-throttle.e2e-spec.ts`, así que **la cobertura perdida es cero**.
      2. **`global-setup.ts` crea la cuenta compartida una sola vez, y ese archivo no estaba en la lista de
         `T-027`.** El motivo es un efecto de segundo orden que arrastraba la decisión «login antes de
         registrar» y que la cuenta no contemplaba: si cada caso prepara la cuenta por su lado, en una base
         limpia **todos** los trabajadores empiezan con un `login` fallido contra una cuenta que aún no
         existe, y **5 fallos bloquean la cuenta 15 minutos** (`LoginAttemptService`). Ese bloqueo es **por
         cuenta, no por IP**, así que **ningún reset de `throttle:*` lo evita**; en local Playwright levanta
         **6** trabajadores y era una moneda al aire. Hacer el alta **una vez, antes de que arranque ningún
         caso**, lo elimina **por construcción** y de paso baja el gasto del smoke de **3 altas a 0**. El
         agente verificó en el bundle de Playwright 1.62 (`runner/index.js`, `createGlobalSetupTasks`) que
         los plugins de `webServer` corren **antes** de `globalSetup`, así que el API ya responde cuando se
         prepara la cuenta; `signIn` conserva un camino de reserva por si acaso.

      **Verificado en el código por el orchestrator, no leído del informe**: `support/services.ts` exporta
      `resetRegisterThrottleCounter` y `resetLoginThrottleCounter` sobre un `resetThrottleCounter` acotado
      por tipo a `'register' | 'login'` —los contadores de `mfa`, `refresh` y `workspace` quedan intactos y
      la suite los sigue gastando de verdad— y ese reset **lanza** si Redis falla, en vez de ser
      best-effort, para que un `429` posterior no se lea como un fallo de la interfaz;
      `global-setup.ts` llama a `ensureSharedAccount()` **después** de `resetDevServices()`, que es justo
      quien borra la cuenta; y `grep -rn "throttle:" apps/api/test/` **no devuelve nada**, o sea que **no se
      aplicó ningún reset en la suite del API**.
      Entrada de cierre en `specs/001-auth/CHANGELOG.md` **v0.1.1** (el andamiaje e2e es de esa spec).

### Lo que queda sin cobertura automática, escrito sin adornar (2026-07-25)

Sale del cierre de `T-026` y `T-027`. Está también en `spec.md` (AC-34, AC-35 y §6) porque es donde
sobrevive cuando este archivo crezca:

1. **El envenenado de la caché de AC-34 es manual y CI no lo cazará nunca.** El runner arranca siempre con
   `node_modules/.vite` frío, así que allí `force: true` y su ausencia son **indistinguibles**. Lo que sí
   queda vigilando es la retirada del `--force` de `playwright.config.ts`: a partir de ahora, si alguien
   quita el `force` de `vite.config.ts`, `pnpm test:e2e` se rompe **en local** para cualquiera con caché
   previa, y **en CI no**. El defecto vive en la máquina de quien desarrolla, que es justo donde CI no mira.
2. **La suite de navegador ya no detecta los límites de `register` ni de `login`**: los neutraliza a
   propósito. Quien los verifica es `apps/api/test/auth-throttle.e2e-spec.ts` (un caso por cada uno) y
   `apps/api/test/auth-login.e2e-spec.ts` (`AC-7: bloqueo por cuenta tras cinco fallos`). **No se aplicó
   ningún reset en la suite del API**, y queda una nota en `apps/web/e2e/support/services.ts` —junto a la
   función que lo hace— diciendo que no se haga: aplicarlo allí destruiría la prueba de que el límite
   existe. Ese «no hacer» está también en la spec `002` (AC-35) y en el CHANGELOG de `001` v0.1.1, que es
   donde lo leerá quien no tenga el código delante.
3. **El bloqueo por cuenta (`LoginAttemptService`, 5 fallos) tampoco lo ejercita la suite de navegador**,
   ni antes ni ahora. Se evita **por construcción** —una sola alta en `global-setup.ts`—, no se neutraliza.

### Cierre de la Fase 4 y de la spec `002` (2026-07-25)

**Las 27 tareas cerradas y los 35 AC verificados.** Cifras finales corridas **por el orchestrator**, de una
vez, con `apps/web` ya libre de agentes escribiendo y **desde estado limpio** (`rm -rf
packages/shared/dist` + rebuild) — que es la condición que esta fase se puso desde el principio para que un
número signifique algo:

| Comando | Resultado |
|---|---|
| `pnpm --filter @one-markdown/shared test` | **65 passed** |
| `pnpm --filter @one-markdown/web test` | 12 archivos, **188 passed** |
| `pnpm --filter @one-markdown/api test` | 19 suites, **264 passed** |
| `pnpm --filter @one-markdown/api test:e2e` (completo, sin filtro) | 20 suites, **455 passed** |
| `pnpm test:e2e` (Playwright, navegador real) | **5 passed** |
| `playwright test --retries=2 --repeat-each=3` (el `DONE` de `T-027`) | **15 passed**, EXIT=0 |
| `pnpm typecheck` (**raíz**, los tres paquetes) | exit 0 |
| `pnpm lint` (**raíz**, los tres paquetes) | exit 0 |
| `prettier --check` | limpio |

Los `typecheck`/`lint` **de raíz** son la corrida que la ola 4 dejó aplazada a propósito mientras el agente
`frontend` escribía `apps/web`: **queda hecha y en verde**, y con ella se levanta la última restricción de
medición de la fase.

_(Las cifras de `shared` **65** y de web **12 / 188** se reverificaron en el check-off final corriendo los
dos comandos otra vez: `Tests 65 passed (65)` y `Test Files 12 passed (12) · Tests 188 passed (188)`.)_

**Cobertura de AC: 35 de 35.** Los **33** del alcance aprobado con test automatizado y **ninguno sin
cobertura**; **AC-35** con un comando automatizado (`--retries=2 --repeat-each=3` → 15 passed); y **AC-34**
con un rojo **manual**, demostrado en tres pasos, que es **la única salvedad de toda la spec** y está
escrita en el propio AC y en §6 de `spec.md` en vez de vivir solo aquí. Lo comprobado para los 33,
uno por uno contra el árbol de archivos real y
no contra la tabla de trazabilidad: los **24** archivos que la tabla nombra existen, y cada AC cae dentro
de un `describe` que lo nombra o que ejercita su comportamiento. Los AC que **no** aparecen escritos
literalmente dentro de un test (AC-1, AC-2, AC-6, AC-8, AC-15…AC-20, AC-23, AC-26) están todos en bloques
titulados con su número —`describe('AC-1: alta en la raíz')`, `describe('GET /api/workspace/tree (e2e) —
AC-20')`, `describe('AC-26: las diez rutas de workspace')`…—, así que la ausencia del literal en el `grep`
no era un hueco de cobertura. **No hay ningún AC del alcance aprobado sin test automatizado.**

### Tres hallazgos del navegador que JSDOM no podía ver (2026-07-25)

Los tres salen de `T-023`. Ninguno es un defecto del árbol: dos son de **entorno** y el tercero es una
asimetría entre JSDOM y un navegador real. Los dos primeros abren tarea; el tercero, no.

**1. Caché rancia de `optimizeDeps` de Vite — rompe el árbol en desarrollo. Es un defecto real.**
Recién registrado, el árbol moría con «Ocurrió un error inesperado» **pese a que
`GET /api/workspace/tree` respondía `200`**. Causa instrumentada: `TypeError: guard is not a function` en
`expectShape`, porque el navegador recibía un `@one-markdown/shared` **sin `isWorkspaceTree`**.
`packages/shared/dist` estaba al día; lo rancio era
`apps/web/node_modules/.vite/deps/@one-markdown_shared.js` (del 25/07 00:09, o sea de la spec `001`, con
`grep -c isWorkspaceTree` = **0**).

**El mecanismo exacto, verificado con `context7` y no supuesto** (`optimizer/index.ts`,
`loadCachedDepOptimizationMetadata`, y `guide/troubleshooting.md` de Vite): la caché se invalida comparando
**`lockfileHash`** y **`configHash`**, y la documentación dice literalmente *«Vite detects dependency
overrides but not `npm link` usage»*. Conviene fijar la corrección: la primera hipótesis fue «Vite hashea
la caché por el `package.json` del paquete enlazado», y **no es eso** — es que **no mira el paquete en
absoluto**. La diferencia no es académica: la hipótesis original lleva a buscar el arreglo en el
`package.json` de `shared`, donde no está.

**Consecuencia**: cualquiera con un `pnpm dev` anterior a la spec `002` ve el árbol roto hasta que borre
`node_modules/.vite` a mano. Mitigado **solo para la suite** con `pnpm dev --force` en
`playwright.config.ts`.

**Decisión (mía, y queda escrita)**: se fuerza en `apps/web/vite.config.ts` y `playwright.config.ts` vuelve
a `pnpm dev` a secas — la suite deja de compensar un defecto del producto, que es la mitad del valor.
Alternativas descartadas **con motivo**: *publicar `shared` en ESM* es el arreglo de raíz —sin CJS no haría
falta `optimizeDeps.include` y no habría caché que envejecer— pero `apps/api` es NestJS **CommonJS** sobre
el mismo `dist` y exigiría salida dual o mover el backend a ESM: es empaquetado de los tres paquetes y
pertenece a una spec propia, no a un cierre de fase (queda apuntado como la salida futura, y ese día se van
juntos el `include` y el `force`); *documentarlo como paso manual* se descarta porque el defecto se
presenta como «el árbol está roto» con un mensaje que apunta al servidor. Coste asumido y explícito:
`force: true` re-empaqueta **todas** las dependencias en cada arranque de desarrollo.
→ **AC-34 · `T-026`**, con **RED de comportamiento** (envenenar la caché y ver fallar la app): un test que
lea `vite.config.ts` y afirme que dice `force: true` sería una tautología.

**Matiz con entrada propia**: el aviso genérico de la UI es **correcto** de cara al usuario y **engañoso**
de cara a quien depura — un `TypeError` del cliente se presenta exactamente igual que un error del
servidor, y aquí la petición había ido **bien**. Queda como **riesgo #15** de la spec y **a propósito sin
tarea**: distinguir «el servidor dijo que no» de «el cliente se rompió» obliga a decidir qué se le enseña a
la persona en cada caso, y eso es producto, no corrección de un defecto. Lo hereda la spec que toque el
manejo de errores de la UI (`003` es la primera candidata), con el caso real ya documentado. Lo que sí
entra ya, por AC-34, es que la causa concreta deje de ocurrir.

**2. El `role="tree"` vacío no existe para el usuario.** Sin filas tiene caja de cero píxeles y Playwright
lo da por `hidden`, así que `toBeVisible()` sobre el árbol vacío es un **aserto imposible**: se usa
`toBeAttached()`. **No es un fallo de accesibilidad** —el mensaje «Todavía no hay directorios ni
documentos.» sí se ve, aunque viva **fuera** del árbol, y un árbol sin nodos no tiene ninguna parada de
tabulación que ofrecer— pero se sube a AC-32 porque en JSDOM no se veía: allí `toBeVisible` no calcula
*layout* y la aserción imposible habría pasado tan campante. **Sin tarea**: no hay nada que arreglar, hay
algo que dejar escrito.

**3. Riesgo de `429` en CI con `retries: 2` — y no es de `T-023`, es de presupuesto compartido.**
`register` está limitado a **5 altas por IP cada 15 min** (`THROTTLE_LIMITS`, spec `001`) y una ejecución
limpia de la suite gasta **exactamente 5**: `smoke` **3** —su `beforeEach` llama a `signIn`, que hace
`POST /register` en **cada** caso aunque le devuelvan `409`—, `auth` **1** y `workspace` **1**. Verificado
en el código (`e2e/support/session.ts`) y en la corrida real (`cuentas de prueba borradas: 3`).
**Cualquier reintento en CI pediría la sexta y recibiría un `429`**: un rojo ajeno a lo que la suite mide,
que aparecerá justo cuando algo ya haya ido mal. El agente lo **reportó en vez de arreglarlo**, que es lo
correcto: toca andamiaje de la spec `001`.

**Decisión (mía)**: **las dos medidas, porque la barata sola no basta**. Que `signIn` intente `login` antes
de registrar baja el gasto de 5 a 3, pero **no cierra el AC**: con `retries: 2` los dos casos que estrenan
cuenta piden alta nueva en **cada** intento (1+2 y 1+2 = **6**, otra vez por encima de 5). Lo que sí lo
cierra es **poner a cero el contador `throttle:register:*` antes de cada caso que registre**, por el mismo
camino RESP-sobre-TCP que ya usa `global-setup` —sin dependencias nuevas—. Se acepta a sabiendas de que la
suite de navegador deja de poder detectar ese límite: **quien lo verifica es
`apps/api/test/auth-*.e2e-spec.ts`**, que es su sitio, porque un límite por IP se prueba contra el API y no
a través de un navegador. El razonamiento va escrito **en el propio archivo**, porque el atajo de mañana es
aplicar el mismo reset en la suite del API, donde sí destruiría la prueba.
→ **AC-35 · `T-027`**, con RED reproducible hoy:
`playwright test --retries=2 --repeat-each=3` → `429` en `POST /api/auth/register`.

### Trabajo abierto que dejaba la Fase 4 — SALDADO el 2026-07-25

Se listaron aquí y no se escondieron, siguiendo el precedente de `000` (cerrada como implemented con AC-14
esperando un run de CI) y de `001` (con `T-026` igual). **No eran alcance aprobado**: eran endurecimiento
de entorno salido de ejecutar AC-32 en un navegador real, y llegaron con la spec en **v0.3.0**.
**Las dos están cerradas y verificadas**; el detalle, con RED medido y `DONE` corrido, está en el Bloque F
más arriba, y el cierre de spec en la **v0.3.1**.

- [x] **T-026** · frontend · AC-34 — `optimizeDeps.force` en `vite.config.ts` y retirada del `--force` de
      `playwright.config.ts`. Tocó `vite.config.ts`, que es de la spec `000`: **ningún test de `000` cayó**
      y el cierre dejó entrada en `specs/000-foundation/CHANGELOG.md` **v0.1.7**.
- [x] **T-027** · frontend · AC-35 — `login` antes de `register` en `signIn`, cuenta compartida creada una
      sola vez en `global-setup.ts` **y** reset de los contadores `throttle:register:*` **y
      `throttle:login:*`** por caso (el enunciado solo decía `register`, y con eso el `DONE` seguía rojo).
      Tocó `e2e/support/*` y `global-setup.ts`, andamiaje de la spec `001`: **ningún test de `001` cayó** y
      el cierre dejó entrada en `specs/001-auth/CHANGELOG.md` **v0.1.1**.

**Con esto la Fase 4 no deja trabajo abierto.** Lo único que queda vivo del ciclo `002` es la salvedad de
cobertura de AC-34 —manual, invisible para CI— y está escrita arriba y en la spec, que es donde toca.

## Fase 5 — Implementación de `003-editor`

Detalle en `specs/003-editor/tasks.md`. **17 de 17 tareas verificadas** — spec **complete** el 2026-07-28. Cada línea lleva el
comando corrido y su salida real.

**Estado: cerrada.** `shared` **81** · `apps/web` 16 archivos / **321** · API unit 21 suites / **305** ·
API e2e 22 suites / **511** (40,2 s) · `pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24**, sin
un solo `429` · `typecheck` y `lint` en **0** en los tres paquetes.

Dos cifras se movieron desde el registro parcial y conviene no arrastrar las viejas: **API unit son 305 y
no 304** (`T-016` añadió uno), y **la suite e2e del API baja de ~108 s a 40 s** por el realineamiento de
`workspace-document-content-throttle`, que sustituyó la espera del `ttl` por resets en los hooks.

_(Los tres rojos de `swagger.e2e-spec.ts` que este apartado anunciaba mientras `T-009` estaba pendiente
quedaron cerrados por esa tarea. Resultaron ser **cuatro** cambios de recuento y no tres; ver `T-009`.)_

- [x] **T-000** · `orchestrator` · Enmienda de la spec `002` a v0.4.0 — 2026-07-28
      Aplicada la tabla de `003/spec.md` §6 sobre `specs/002-workspace-tree/`, más `specs/README.md`,
      este archivo y `CLAUDE.md`. **Sin tocar una línea de código.**
      Verificado: `pnpm test` → exit 0 · shared **65** · web 12/**188** · api 19/**264**, corrido **antes
      y después** con resultado idéntico, y `git status` sin un solo archivo modificado en `apps/**` ni
      `packages/**`. Después salieron dos patches de la propia enmienda: **v0.4.1** (dos bytes de control
      que hacían que `grep` tratara el `CHANGELOG.md` como binario) y **v0.4.2** (la lista de §6 se quedó
      corta; ver `T-007`).

- [x] **T-001** · `backend` · `setup` · Columna `contentVersion` y migración — 2026-07-28
      Verificado: `prisma migrate dev --name document_content_version` → 0 · `prisma generate` → 0 ·
      `prisma migrate status` sin pendientes · columna comprobada en el esquema **real** con el MCP
      `postgres` (`integer NOT NULL`, `DEFAULT 0`).
      Nombre real de la migración: **`20260728202008_document_content_version`**. Es la primera vez en el
      proyecto que la predicción del plan **acierta** — en `001` y `002` no coincidió.

- [x] **T-002** · `backend` · Dominio puro `contentBytesOf` — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test document-content`. Cubre el multibyte (`ñ`→2,
      `🙂`→4), el vacío y el `\r\n` sin normalizar, y comprueba que el archivo no importa nada de Nest ni
      de Prisma.

- [x] **T-003** · `backend` · `WorkspaceRepository.saveDocumentContent` — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test workspace.repository` → **27**.
      `updateMany` condicional con `userId` **y** `contentVersion` en el mismo `where`; versión rancia no
      escribe nada, `updatedAt` incluido; `createDocument` pasa a usar `contentBytesOf`.

- [x] **T-004** · `backend` · Throttler `documentContent` — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test throttle` → **26** ·
      `pnpm --filter @one-markdown/api test throttle-coverage` → **9**.
      Confirmado por test lo que el plan había verificado leyendo el código: `getAllAndOverride` hace que
      el `@Throttled` de **método** gane al de **clase**, así que no hizo falta partir el controlador.

- [x] **T-005** · `backend` · `PUT /api/workspace/documents/:id/content` — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test:e2e workspace-document-content` → **23**.
      Cubre AC-1…AC-9 y AC-13: feliz, vaciado, validación con la fila intacta, 200.000 caracteres,
      conflicto de versión, concurrencia con `Promise.all`, propiedad y credencial (`404` **también** con
      versión incorrecta, nunca `409` sobre documento ajeno), idempotencia por versión, ortogonalidad con
      renombrar/mover, y `413` por encima de 2 MiB.

- [x] **T-006** · `backend` · Contrato compartido — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/shared test` → **81** (antes 65).
      **Dejó deuda, y está registrada**: `plan.md` §3 prometía que `MAX_DOCUMENT_CONTENT_CHARS` «se
      reexporta y no se duplica a mano», pero `packages/shared` **no puede importar de `apps/api`** —la
      dependencia va al revés—, así que se implementó como **valor espejo**. El `200_000` está escrito dos
      veces y el test de `shared` solo fija **su propio** literal, o sea que una divergencia no la
      detectaría nadie. Se cierra con **`T-016`**, añadida el 2026-07-28.

- [x] **T-007** · `backend` · `contentVersion` en las respuestas de documento — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test:e2e workspace-documents` → **62** ·
      `pnpm --filter @one-markdown/api test:e2e workspace-tree` → **15** · api unit → **304**.
      **Paró y reportó, que es lo que había que hacer**: cae una **tercera** aserción de claves exactas
      que §6 no autorizaba (`workspace.repository.spec.ts:334`). Antes de reportar verificó con
      `git show HEAD` que era código de la `002` y no una rotura de `T-003`. Se autorizó, se añadió a §6 y
      la `002` subió a **v0.4.2**.
      **Y midió algo que cambia la spec**: coló un `content: true` en `DOCUMENT_SUMMARY_SELECT` y **los 76
      casos HTTP siguieron verdes** mientras el árbol descargaba de TOAST el texto de todos los
      documentos. Como los DTO se construyen **campo a campo**, una columna de más en un `select` no puede
      llegar a la respuesta y **ninguna aserción HTTP la verá jamás**. Por eso AC-11 pasa a verificarse
      también sobre el juego exacto de claves de los dos `select` exportados. Es el hallazgo más valioso
      de la fase: un defecto real, de coste de lectura, invisible por el único canal que la spec miraba.

- [x] **T-008** · `backend` · Cupo propio del guardado — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test:e2e workspace-document-content-throttle` → **3**.
      Comprueba AC-10 en los dos sentidos: agotar `documentContent` no agota `workspace` ni al revés.
      **Deuda abierta, por culpa de una regla que el orchestrator escribió mal.** `tasks.md` prohibía
      llevar resets de contadores «a la suite del API», lo cual **es falso**:
      `workspace-throttle.e2e-spec.ts` ya resetea en sus tres hooks **y aun así exige `429` nueve veces**,
      y el idioma está en **17** archivos e2e con **39** puntos de llamada. La regla real es sobre el
      **momento** (en los límites sí, a mitad de una secuencia de agotamiento no), no sobre el lugar.
      `T-008` cumplió la letra de la regla equivocada y resolvió la limpieza **esperando a que venza la
      ventana del `ttl`**: funciona, pero cuesta **~60 s de espera pura por corrida** —de ~65 s totales,
      solo ~5 s son las ~248 peticiones HTTP— y usa un idioma distinto del de los otros 17 archivos. Se
      realinea en cuanto la base quede libre; no cambia ningún AC. Regla corregida en `T-015` y en el
      CHANGELOG de la `003` v0.1.2.

- [x] **T-009** · `backend` · OpenAPI de la ruta nueva — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test:e2e swagger` en verde, y con él **la suite e2e
      del API completa: 511/511 en 22 suites**.
      **Fueron cuatro recuentos, no tres.** El que faltaba en la lista de §6:
      `WorkspaceDocumentContentResponseDto` en `WORKSPACE_RESPONSE_SCHEMAS`. **No provocó rojo** porque
      esa lista no tiene `toHaveLength` —solo alimenta un `it.each`—, así que dejarla corta habría
      significado que el DTO de salida nuevo **no tenía aserción de existencia** por esa vía. Un hueco
      silencioso, que es peor que un rojo.

- [x] **T-010** · `frontend` · `saveDocumentContent` en el cliente HTTP — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/web test http` → **61**.

- [x] **T-011** · `frontend` · `MarkdownPreview`, `rehypeRawAsText` y el corpus de XSS — 2026-07-28
      Verificado: `MarkdownPreview` → **51** · `rehype-raw-as-text` → **6** · `no-dangerous-html` → **4**.
      Instaló las tres dependencias con las versiones exactas del plan; `vite.config.ts` **no necesitó
      nada** y no se tocó.
      **Tres cosas medidas que valen más que el verde**, todas ya escritas en la spec:
      1. **La mutación M3 destapó que AC-25 contradecía la decisión 7.** Las librerías permiten `irc:`,
         `ircs:` y `xmpp:` en `href` (`react-markdown/lib/index.js:124`,
         `hast-util-sanitize/lib/schema.js:143`) y el AC decía «`http`, `https`, `mailto`». Era un
         **descuido de redacción, no un agujero**: ninguna carga pasaba sin ser vista. El usuario eligió
         ampliar el AC a la lista real; `003` → v0.1.3.
      2. **`rehype-sanitize` es redundante hoy**: quitándolo, los 51 siguen verdes; quitando **además**
         `urlTransform` caen 3. Sujetan la capa 1 (no haber instalado `rehype-raw`) y la 4. **Eso es el
         objetivo, no un defecto del test**, y está escrito en `plan.md` §2.2.1 con la regla derivada —
         una capa no se retira porque ningún test la eche de menos.
      3. **Coste en el bundle: +255 módulos, +160,7 kB (+48 kB gzip)**. Hubo que importar
         `MarkdownPreview` temporalmente desde `main.tsx` para medirlo: hoy nadie lo importa y el build lo
         *tree-shakeaba*, así que la comprobación habría dado **cero**.

- [x] **T-012** · `frontend` · Store del editor — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/web test editor.store` → **28**, y `apps/web` completa en
      **290/290**.
      **Volvió a quedarse corta la lista de §6, y van dos**: `apps/web/src/test/workspace-fixtures.ts`
      —código intacto de la `002` (`168b840`)— construye un `MarkdownDocument` a mano y no ponía
      `contentVersion`. **14 tests en rojo en 5 suites** más un error de `tsc`; arreglo de una línea.
      Mismo procedimiento que `T-007`: paró, verificó, se autorizó, se registró. `002` → v0.4.3.
      **Añadió un séptimo campo a `EditorEntry` que el plan no declaraba**, `serverVersion`, y es un error
      de diseño del plan y no una licencia: con solo `serverContent`, `resolveTakeServer` deja el editor
      limpio pero con el `contentVersion` viejo, así que la primera tecla siguiente vuelve al **mismo
      `409`**.
      Dos decisiones suyas quedan como contrato en `plan.md` §7: `open(id)` **propaga** el error (si no,
      la página no puede conservar el `loading`/`missing`/`error` que AC-31 obliga a heredar), y si tras
      un `409` **falla la relectura** el estado es `unreachable` y **no** `conflict` — un conflicto que no
      puede enseñar contra qué no se puede ofrecer a resolver.

- [x] **T-016** · `backend` · El espejo de `MAX_DOCUMENT_CONTENT_CHARS` no puede divergir en silencio —
      2026-07-28
      Verificado: `pnpm --filter @one-markdown/api test document-content` → **20**.
      Tarea **nueva** del 2026-07-28, salida de la deuda de `T-006`. Cerrada con un test de acoplamiento
      en `apps/api` y **no** con una reexportación: hoy la dependencia de `apps/api` sobre
      `packages/shared` es solo de **tipos**, y reexportar pondría un límite de dominio del servidor
      detrás de `packages/shared/dist` — la clase de defecto de AC-34 de la `002`, pero saliendo como un
      `400` inexplicable en producción.

- [x] **Realineamiento de `workspace-document-content-throttle`** — 2026-07-28
      La deuda que abrió `T-008` por cumplir al pie de la letra una regla que el orchestrator había
      escrito mal. Sustituida la espera del `ttl` por `resetThrottleCounters` en los hooks de ciclo de
      vida, que es el idioma de los otros 17 archivos: **de 65 s a 6,3 s**.
      **Y se comprobó que no se cambió un test que medía por uno que no mide**: con la mutación aplicada
      vuelven a caer **los mismos dos casos**. Sin esa comprobación, «ahora tarda diez veces menos» es
      indistinguible de «ahora no comprueba nada».

- [x] **T-013** · `frontend` · `DocumentEditorPage` y retirada del andamio de la `002` — 2026-07-28
      Verificado: `apps/web` **290 → 313**.
      Se le amplió el alcance con **`setViewMode`**, que `plan.md` §7 declaraba como acción del store pero
      que no pedía el RED de `T-012` ni incluían las ARCHIVOS de `T-013`: **no era de nadie**, y es un
      fallo de reparto del orchestrator. Va **al store** y no a un `useState` local, porque con «split
      view = texto y preview del mismo documento» el modo activo es estado **por documento** y la `005`
      tiene que conservarlo al cambiar de pestaña.
      **Retiró el andamio** (`DocumentViewPage` borrado) trasladando **11 de 12** casos. Y **los tres de
      navegación no estaban en el encargo**: los portó tras comprobar que `WorkspaceTreeView.test.tsx`
      solo afirma `selectedId`/`aria-selected` y **nunca la ruta**, así que eran la **única** cobertura de
      «activar un documento abre `/documents/:id`» en todo el proyecto. Borrarlos la habría hecho
      desaparecer **sin que ningún test se pusiera rojo**: la misma clase de hueco silencioso que el
      `WORKSPACE_RESPONSE_SCHEMAS` sin `toHaveLength` de `T-009`, y encontrado por el mismo método —
      preguntarse quién más cubre esto antes de borrar.

- [x] **T-014** · `frontend` · e2e de navegador — 2026-07-28
      Verificado: `pnpm --filter @one-markdown/web exec playwright test editor` → **3 passed**.
      **Los tres casos pasaron a la primera, así que hizo cinco mutaciones de control**, que es la única
      forma de distinguir «funciona» de «no mide». Dos valen doble:
      1. El centinela `window.__xssTripped` se dispara **independientemente** del manejador de `dialog`:
         son **dos redes**, no una con dos nombres.
      2. La rama de `src` —que con el corpus real **nunca** se activa, porque el saneado vacía el atributo
         antes— **existe y etiqueta bien**, comprobado con una carga de control. Sin eso sería código
         muerto del que nadie sabría si funciona, en el test que sostiene una afirmación de seguridad.

- [x] **T-015** · `frontend` · Presupuesto de la suite de navegador — 2026-07-28
      Verificado (AC-34): `playwright test --retries=2 --repeat-each=3` → **24 passed**, **ningún `429`**.
      **RED real**, y con una lección: el caso que cayó **no fue el del editor sino el del árbol**. El cupo
      es **por IP y global de la suite**, así que lo paga quien pasa por ahí, no quien gasta — que es
      exactamente lo que la `002` aprendió con su AC-35 y lo que hace que este AC no se pueda deducir
      leyendo el archivo que más consume.
      **GREEN en dos pasos**: primero gastar menos (pico **98/120**); después, como AC-34 exige el
      escenario **con reintentos** y 22 de margen no cubren uno, resetear **`workspace` únicamente** (pico
      **20/120**). **`documentContent` NO se resetea**: la suite gasta **4 de 120**, así que neutralizarlo
      restaría cobertura a cambio de nada. Dejó entrada en el CHANGELOG de la `001` (**v0.1.2**) por tocar
      `apps/web/e2e/support/*`, y el orchestrator cerró la cabecera de versión de esa spec y su fila en
      `specs/README.md`, que son suyas.
      **Evaluó y NO tocó** el `GET …/documents/:id` duplicado por `StrictMode` (8 de 21 peticiones):
      correctamente, porque las tres salidas quedaban fuera de su alcance. Queda como deuda con
      destinatario en `003/spec.md` §8.1 → spec `005`.

**La Fase 5 cierra la spec `003` en `complete`: 34/34 AC y 17/17 tareas**, sin ninguna salvedad de
verificación manual —a diferencia de la `002`, cuyo AC-34 no lo caza CI—. Cifras finales, corridas de una
vez: `shared` **81** · `apps/web` 16 archivos / **321** · api unit 21 suites / **305** · api e2e 22 suites
/ **511** (40,2 s) · `pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24** · `typecheck` y `lint`
en **0** en los tres paquetes.

**Dos deudas quedan vivas, las dos con destinatario y razón escritos** (`003/spec.md` §8): la
deduplicación de `open(id)` es de la **`005`** —que tiene que tocar ese método de todas formas y que es
quien convierte el problema en real de producción—, y el caso de conflicto de AC-33 **no se estabiliza
preventivamente**: corrió 13 veces sin parpadear y lo que se deja escrito es **la causa**, para que un rojo
futuro no se diagnostique como un problema de cupo.

**Y dos afirmaciones de la propia spec que la implementación obligó a corregir**, que es lo que más vale
de esta fase:

1. **La lista cerrada de artefactos tocables (§6) se quedó corta dos veces** —`workspace.repository.spec.ts`
   (`T-007`) y `apps/web/src/test/workspace-fixtures.ts` (`T-012`, 14 tests en rojo)—, las dos por el mismo
   motivo: el radio de un cambio de contrato incluye **todo lo que construye un valor del tipo**, fixtures
   de test incluidos, no solo los DTO. Las dos veces el agente **paró y reportó**, que es lo único que
   hace que una lista cerrada sirva de algo.
2. **`rehype-sanitize` pasó de «redundante» a tener un agujero propio con nombre.** La v0.1.2 afirmaba,
   con medición, que quitarlo no rompía nada. Al añadir la carga de imagen con `irc:` cae **exactamente**
   esa carga: es la **única** capa que defiende los protocolos de `src`. Estaba **predicho por escrito** en
   §2.3 y se confirmó añadiendo la carga.

### Plan de despacho de la Fase 4 (2026-07-25)

Reparto por **archivos**, no solo por tarea: en la Fase 3 dos agentes coincidieron en un mismo archivo
(uno no pudo añadir `implements LoginResult` porque el otro lo tenía abierto). Cada ola indica qué archivos
son de quién.

| Ola | Tareas | Paralelismo real | Condición de entrada |
|---|---|---|---|
| 1 | `T-001` → luego `T-002` ‖ `T-003` | `T-002` y `T-003` en paralelo: archivos disjuntos (`workspace-name.*` vs. `tree-graph.*`); `workspace.constants.ts` lo crea **solo** `T-002` | `T-001` verificado (migración aplicada) |
| 2 | `T-004` | En solitario: toca `ErrorResponseDto` (spec `000`) y `packages/shared` | `T-002` y `T-003` en verde |
| 3 | `T-005` → (`T-006` → `T-007`) ‖ (`T-008` → `T-009`) | Directorios y documentos **sí** van en paralelo: `plan.md` §6 reparte la orquestación en `directories.service.ts` y `documents.service.ts` justo por esto. `workspace.module.ts` lo **crea** `T-005` (con los tres controladores) y `T-008` solo añade su servicio, ya con `T-005` cerrada: nunca a la vez | `T-004` en verde |
| 4 | `T-010` → `T-016` ‖ `T-011` ‖ `T-012` ‖ `T-013` ‖ `T-014` ‖ `T-024` | `T-016` es del backend pero solo toca `packages/shared` + los `implements` de los DTO: se despacha aparte. `T-024` también va aparte y por el mismo motivo que `T-004` en la ola 2: toca `src/common/filters/**`, que es contrato de la spec `000`, y nadie más del Bloque D entra en `common/` | `T-007` y `T-009` en verde |
| 5 | `T-017` → `T-018` → `T-019` → (`T-020` → `T-021`) ‖ `T-022` | Frontend en serie salvo `T-022`, que solo toca `DocumentViewPage` + `routes.tsx` | `T-016` en verde (contrato compartido publicado) |
| 6 | `T-015` (Swagger) y `T-023` (e2e de navegador) | En paralelo: `swagger.e2e-spec.ts` vs. `apps/web/e2e/` | `T-014` en verde para `T-015`; `T-013`, `T-021` y `T-022` para `T-023` |
| 6b | `T-025` (retirada del `404` de `/tree`) | En solitario, pero **compatible con la ola 5**: solo toca `src/workspace/workspace.controller.ts` y `test/swagger.e2e-spec.ts`, que son de `apps/api`, y el agente `frontend` está en `apps/web` | `T-015` en verde (es la que dejó la declaración puesta) |

**Estado de las olas al 2026-07-25**:

| Ola | Estado |
|---|---|
| 1 · 2 · 3 · 4 | **cerradas y verificadas** |
| 6b | **cerrada** — `T-025`. Corrió en paralelo con la ola 5 tal como preveía la tabla, sin ningún cruce de archivos |
| 5 | **cerrada** — `T-017`…`T-022`. `T-020` y `T-021` fueron en serie sobre `WorkspaceTreeView.tsx`, como preveía la tabla |
| 6 | **cerrada** — `T-015` (adelantada a la ola 4) y `T-023`, la última tarea de la spec |

**Las seis olas están cerradas y la Fase 4 con ellas.** La corrida de `typecheck` y `lint` **de raíz**, que
la ola 4 dejó aplazada mientras el agente `frontend` tenía `apps/web`, está hecha y en verde: ver la tabla
de «Cierre de la Fase 4 y de la spec `002`».

El endurecimiento que abre la v0.3.0 (`T-026`, `T-027`) **no entra en esta tabla de olas**: no es alcance
aprobado y los dos son de `frontend` sobre archivos disjuntos (`vite.config.ts` + `playwright.config.ts`
frente a `e2e/support/*`), así que pueden ir **en paralelo** cuando se despachen. Ojo con un cruce que sí
existe: `T-026` **retira** el `--force` de `playwright.config.ts` y `T-027` cambia cuántas veces se llama a
`POST /register`; si se lanzan a la vez, el que mida `pnpm test:e2e` medirá también el cambio del otro. Se
despachan en paralelo, pero **se verifican por separado**.

**Cerradas las dos el 2026-07-25**, y el cruce previsto se manejó como estaba escrito: cada una llevó su
propio RED medido y su propio `DONE`, y las cifras finales se tomaron una vez con las dos ya dentro. El
aviso valió la pena: el RED de `T-026` se midió **con el `--force` ya retirado**, que es la única forma de
que el envenenado de la caché signifique algo.

---

## Fase 6 — Implementación de `004-markdown-palette`

Detalle en `specs/004-markdown-palette/tasks.md`. **10 de 11 tareas cerradas y verificadas**
(T-001…T-010, el 2026-07-29) · **T-011 despachándose** en una sesión en paralelo. La spec está
**approved**, hoy en **v0.2.1** (**36 AC**, **11 tareas**; el patch no mueve el recuento).

**Estado: la paleta está construida, enganchada al editor, con atajos, con el corpus de XSS ampliado
y verificada en Chromium real. Queda solo la corrección de accesibilidad que abrió la v0.2.0
(T-011).** La ola 3 se cerró entera —la rama A (T-006 → T-007 → T-008) y la rama B (T-009) corrieron
en paralelo sin pisarse, que era la única oportunidad de paralelismo real de la spec— y la ola 4
cerró con un hallazgo de spec: **AC-33 era autocontradictorio y lo era desde la `003`** (ver T-010).

**Reparto por archivos**, que es la lección de la Fase 3 (dos agentes coincidieron en un mismo archivo) y
de la Fase 4 (por eso el reparto va por archivo y no por tarea):

| Ola | Tareas | Paralelismo real | Archivos de la ola |
|---|---|---|---|
| 1 | T-001 → T-002 → T-003 → T-004 | **Ninguno.** Las cuatro escriben en el **mismo** archivo; lanzarlas a la vez es garantizar conflictos | `markdown-insert.ts` · `markdown-insert.test.ts` |
| 2 | T-005 | — | `markdown-palette.ts` · `markdown-palette.test.ts` (+ el `import` de tipos en los dos de la ola 1) |
| 3 | T-006 → T-007 → T-008 **‖** T-009 | **La única oportunidad real de paralelismo de la spec**: archivos disjuntos | rama A: `MarkdownPalette.tsx/.test.tsx` · `DocumentEditorPage.tsx/.test.tsx` — rama B: `MarkdownPreview.test.tsx` · `markdown-xss-corpus.ts` · `e2e/editor.spec.ts` (una línea) |
| 4 | T-010 | — | `e2e/palette.spec.ts` **y ningún otro** |
| 5 | T-011 (v0.2.0) | **Ninguno, y va la última** | `MarkdownPalette.tsx/.test.tsx` · `SaveStatus.tsx` · `DocumentEditorPage.test.tsx` · `e2e/editor.spec.ts` |

**Por qué T-011 va después de T-010 y no en paralelo**, aunque sobre el papel los archivos sean
disjuntos (T-010 solo crea `e2e/palette.spec.ts`): T-010 corre `playwright test` sobre **todo** el
directorio de e2e para medir el presupuesto de cupo de AC-33, y T-011 edita `editor.spec.ts`. Tocar
el directorio mientras se toman esas medidas las invalida.

- [x] **T-001** · `frontend` · Núcleo de inserción: tipos, despacho y familia que envuelve — AC-1…AC-4 — 2026-07-29
- [x] **T-002** · `frontend` · Núcleo: enlace e imagen — AC-5, AC-6 — 2026-07-29
- [x] **T-003** · `frontend` · Núcleo: prefijos de línea — AC-7…AC-11 — 2026-07-29
- [x] **T-004** · `frontend` · Núcleo: bloques (código, tabla, separador) — AC-12…AC-15, **AC-35** — 2026-07-29
- [x] **T-005** · `frontend` · Catálogo de **16** elementos, guarda de pureza y de exhaustividad — AC-16…AC-18 — 2026-07-29

**Verificación de T-001…T-005, corrida por el orchestrator** (rama `feat/004-markdown-palette`, no
reportada por el agente):

| Comando | Salida real |
|---|---|
| `pnpm --filter @one-markdown/web test markdown-insert` | 1 archivo, **48 passed** |
| `pnpm --filter @one-markdown/web test markdown-palette` | 1 archivo, **43 passed** |
| `pnpm --filter @one-markdown/web test` | 18 archivos, **412 passed** (venía de 16 / 321) |
| `pnpm typecheck` | exit **0**, los tres paquetes |
| `pnpm lint` | exit **0**, los tres paquetes |

Las cinco cifras están tomadas a las **00:05-00:07 del 2026-07-29**, con el árbol conteniendo
**exactamente** los cuatro archivos nuevos de T-001…T-005 y **ningún archivo modificado**:
`markdown-insert.ts`, `markdown-insert.test.ts`, `markdown-palette.ts`, `markdown-palette.test.ts`,
los cuatro en `apps/web/src/features/editor/`. Coherente con la decisión 1 del plan y con AC-34.

**Aviso de concurrencia, y por eso la hora importa.** A partir de las **00:09** aparecieron en el
árbol cambios de **T-009** (`apps/web/src/test/markdown-xss-corpus.ts` +28 líneas,
`MarkdownPreview.test.tsx` +161, y la guarda de `e2e/editor.spec.ts` subida de `10` a `15`), hechos
por una sesión en paralelo mientras se escribía esta entrada. **No afectan a las cifras de arriba**,
que son anteriores, ni al check-off de T-001…T-005. Lo que sí implica: **el `412 passed` es la cifra
de T-001…T-005 y ya no es la del árbol**; la de T-009 se mide y se anota **en su propia entrada**,
cuando se verifique. Anotado también porque T-009 iba a despacharse en la ola 3 y conviene que conste
que arrancó antes de que estas correcciones de spec estuvieran escritas.

**RED real reportado por tarea** y **41 mutaciones adversariales, de las que 39 mataron tests** —dos
sobrevivieron—. **Las dos están identificadas y explicadas, y el punto queda cerrado el 2026-07-29**
(estuvo abierto mientras solo una venía con nombre; la otra estaba en el informe de T-001…T-005 y no
se había recogido aquí). **Ninguna es un hueco de cobertura**:

- **M38** reordena las claves de `PALETTE_GROUP_LABELS` y **sobrevive** — correcto: el orden de las
  claves de un objeto **no es contrato** y no debe serlo. El que sí lo es, el de `MARKDOWN_PALETTE`,
  lo mata **M41**. De ahí la nota de implementación obligatoria que la v0.1.2 escribió en `tasks.md`
  T-006: el orden de pintado y el recorrido de las flechas salen del **catálogo**, nunca de
  `Object.keys(...)`.
- **M5** («cerrar con `before` en vez de `after`») sobrevivió en **T-001** porque los cuatro
  elementos que envuelven tienen delimitador **simétrico** (`**`, `*`, `~~`, `` ` ``): la mutación es
  **semánticamente inerte**, no invisible — produce exactamente la misma cadena. Y no se quedó ahí:
  el agente la **repitió como M5bis** al llegar **T-002**, con `link` e `image`, que son
  **asimétricos**, y **cayó** (4 tests). Es el desenlace que convierte una superviviente sospechosa
  en una superviviente explicada.

**Cinco huecos de especificación que el agente tuvo que resolver**, todos implementados y con test, y
todos **ratificados o corregidos en la v0.1.2 de la spec** (detalle y motivo en su CHANGELOG):
`consumesSelection` (→ **AC-35**, el único que era destrucción de datos) · regla única de separación
de bloques (AC-12+AC-13) · empate al inicio del borde de línea más cercano · selección parcial de una
línea unificada con la multilínea (AC-8) · líneas de solo espacios tratadas como vacías (AC-9).

**Una desviación de artefactos, consciente y ratificada.** T-005 tuvo que reescribir el **comentario
de cabecera** de `markdown-insert.ts`, y su lista decía «solo el `import` de los tipos». Motivo real y
que merece quedar: **la guarda de pureza de AC-17 lee el código fuente con `readFileSync` y no
distingue código de comentario**, así que un archivo vigilado no puede deletrear `zustand`,
`document.` ni `window.` **ni siquiera en prosa**. Reescribir la cabecera era parte de hacer pasar la
guarda, no un extra. El agente lo reportó él mismo, el archivo era suyo desde T-001 y no hubo cambio
de comportamiento — pero **la lista de artefactos estaba mal**, y esto solo sale bien cuando el agente
para y avisa. La lección quedó escrita en `004/spec.md` **§9.6** y resumida en `plan.md` §5, que es
donde la encontrará la `006` o cualquiera que reutilice el patrón de `no-dangerous-html.test.ts`.
- [x] **T-006** · `frontend` · `MarkdownPalette`: toolbar ARIA, roving tabindex y región viva — AC-24, AC-25, AC-27 — 2026-07-29
      Las dos cosas que la v0.1.2 le pasó al agente llegaron implementadas: **16** botones (uno con
      `tabIndex=0` y **quince** con `-1`) y el orden de pintado y de las flechas derivado de
      **`MARKDOWN_PALETTE`**, no de `Object.keys(PALETTE_GROUP_LABELS)`. `markdown-palette.ts` no se
      tocó, como decía su lista de artefactos.
      **Su AC-27 lo reabre la v0.2.0 y lo cierra T-011** (ver abajo): la región viva se implementó
      **según la letra del AC**, que pedía pintarla tras la primera inserción, y esa letra estaba
      mal. La tarea hizo lo que se le pidió; el defecto es de la spec.
- [x] **T-007** · `frontend` · Enganche en el editor: modo, `setDraft`, foco y selección real — AC-19…AC-23, AC-26, AC-27 — 2026-07-29
      **Dos hallazgos suyos entraron en la v0.2.0 de la spec, y los dos son del tipo que solo aparece
      escribiendo el test**: (a) **AC-26 era literalmente inalcanzable** —entre el conmutador y la
      paleta vive el botón «Guardar» de la `003`, así que el orden real es conmutador → Guardar →
      paleta → `<textarea>`—; el agente lo interpretó como orden **relativo**, lo escribió explícito
      en el test con comentario y **la spec se corrigió, no la cabecera**; (b) **AC-20 no se puede
      medir contando peticiones**, que es lo que la spec decía: llamar a `setDraft` dos veces sigue
      dando **una** petición porque la coalescencia se lo traga. Lo que mata esa mutación es la
      aserción del **borrador exacto**, que el agente añadió al mismo caso justo por eso.
- [x] **T-008** · `frontend` · Atajos `Ctrl`/`Cmd`+`B`/`I`/`K` acotados al área de texto — AC-28 — 2026-07-29
- [x] **T-009** · `frontend` · Cada plantilla renderizada + tres cargas nuevas en el corpus de XSS — AC-30, AC-31 — 2026-07-29
      **Cerrada, incluida la verificación en navegador que la bloqueaba.** `markdown-xss-corpus.ts`
      (+28) y `MarkdownPreview.test.tsx` (+161), con la guarda del corpus subida de `>= 10` a `>= 15`
      **en los dos archivos que la afirman** —`MarkdownPreview.test.tsx` y `e2e/editor.spec.ts`—, que
      era el error concreto que la tarea existía para no cometer.
      Verificado: `pnpm --filter @one-markdown/web exec playwright test editor` → **3 passed**.
- [x] **T-010** · `frontend` · Navegador: recorrido solo con teclado, tamaño de objetivo y presupuesto — AC-29, AC-32…AC-34 — 2026-07-29
      **Cerrada y verificada por la sesión que la ejecutó**, con `apps/web/e2e/**` en exclusiva
      mientras duró. Artefacto único, como decía su lista: `apps/web/e2e/palette.spec.ts` (nuevo).
      **No he repetido yo los comandos de Playwright**, y es deliberado: T-011 se está despachando
      sobre ese mismo directorio y dos suites de navegador a la vez se pelean por los puertos de los
      servidores (`reuseExistingServer: false`, decisión de `T-025` de la `001`). Un rojo salido de
      ahí no diría nada sobre el código. Es el mismo criterio con el que se aceptó el
      `playwright test editor` de T-009. Lo que sí he verificado yo, sin tocar `apps/**`:
      `git status --short` → **ni un solo archivo fuera de `apps/web/**`, `specs/**` e
      `IMPLEMENTATION.md`** (AC-34, tercera verificación de la tarea), y que `e2e/palette.spec.ts`
      existe con el caso de teclado y `expect(contentSaves()).toBe(1)` dentro.
      **Medidas reportadas** (sondeo de Redis cada 300 ms sobre
      `throttle:documentContent:{sha256(ip)}`): **5** por corrida con el caso nuevo · **12** con
      `--repeat-each=3` **sin** el caso nuevo (`--grep-invert`) · **15** con `--repeat-each=3` y con
      él. Sin un solo `429` en toda la suite; el resto de contadores holgado: `register` 1/5 ·
      `login` 6/10 · `refresh` 39/60 · `workspace` 34/120.
      **Hallazgo de spec, y es el importante: AC-33 era autocontradictorio.** Pedía la cifra
      **< 10 de 120** y mandaba verificarla con el comando que la **triplica dentro de la misma
      ventana de 60 s**. Era **cierto por corrida y falso bajo su propio comando**, y ya lo era en 12
      **antes de que la `004` existiera**: el defecto viene de la `003` y `T-010` no lo introduce, lo
      destapa. El caso nuevo gasta el **mínimo posible** —un `PUT`, afirmado en el propio caso— y no
      se puede bajar de 1 sin dejar de verificar AC-32. **Resuelto en la v0.2.1 de la spec**
      (dos ventanas, dos comandos) y en la **v0.1.5 de la `003`** (la contabilidad de cierre). La
      tarea se da por cumplida **contra el AC corregido**.
      **Segundo hallazgo, menor pero real: AC-32 pedía «flechas hasta «Negrita»» y la parada del
      tabulador ya era «Negrita»**, así que el recorrido literal no requería ninguna flecha. Se
      resolvió con un viaje de ida y vuelta (`→` Cursiva, `→` Tachado, `←` `←` Negrita), comentado en
      el test: quedarse quieto habría hecho que ese paso midiera **dónde arranca el foco**, no la
      navegación. **La redacción se ajustó a lo que se hizo**, no al revés.
      **Deuda anotada al cerrar**: `watchConsole` queda duplicado entre `editor.spec.ts` y
      `palette.spec.ts` —porque la lista de artefactos era **un solo archivo** y ampliarla habría
      metido la tarea en `editor.spec.ts`, prohibido en esta ola—. Dos copias, **ya divergidas en
      firma**; se extrae a `e2e/support/` **a la tercera**, y esa la escribe la `005`.
      **Pendiente de re-medir cuando T-011 cierre** (no de T-010): las dos verificaciones de suite
      completa (`--retries=2 --repeat-each=3` y `pnpm test && pnpm typecheck && pnpm lint` con
      `shared` **81**, api unit **305** y api e2e **511**) se corren **otra vez al cerrar la spec**,
      porque T-011 edita `editor.spec.ts` y `DocumentEditorPage.test.tsx` y las mueve.
      → **Re-medición hecha en el cierre de la spec** (ver el bloque «Cierre de la `004`» al final de
      esta fase). Y con una corrección de calendario que esta nota no había previsto: **T-012 volvió a
      tocar `e2e/`**, así que la primera re-medición quedó obsoleta y hubo que repetirla.
- [x] **T-011** · `frontend` · Regiones vivas con nombre, montadas siempre y que reanuncian — **AC-27 (reescrito), AC-36** — 2026-07-29
      **Es trabajo nuevo que no estaba en la spec aprobada, y por eso la spec sube minor.** AC-27 se
      implementó según su letra y la letra estaba mal: la región viva de la paleta entra en el DOM
      **con su primer anuncio dentro**, y un lector de pantalla anuncia los **cambios** de una región
      que ya conocía, no su aparición. En NVDA y JAWS ese primer anuncio puede no oírse nunca: el AC
      estaba **verde en CI y era falso** justo para las personas para las que existe. La
      accesibilidad es un objetivo declarado de esta spec —seis AC propios—, no un extra.
      **Lo que cuesta**: montar la región siempre pone **dos** `role="status"` permanentes en la
      página, y `SaveStatus` no tiene nombre accesible, así que rompe **seis** aserciones que hoy
      consultan `getByRole('status')` sin desambiguar —cuatro en `DocumentEditorPage.test.tsx` y
      **dos en `e2e/editor.spec.ts`**, estas con **violación de modo estricto** de Playwright—.
      **La salida es poner nombre a las dos** (`"Elemento insertado"` y `"Estado del guardado"`) y
      desambiguar por nombre. Un `aria-label` en `SaveStatus.tsx` es lo **único** que se toca de
      producción de la `003`, y es un nombre accesible, no un cambio de comportamiento.
      Entra con ella **AC-36**: insertar **dos veces el mismo elemento** no vuelve a anunciar hoy,
      porque escribir el mismo texto no muta el DOM. Se verifica con `MutationObserver` +
      `takeRecords()` (síncrono, sin depender del reloj falso): **≥ 2** cambios de la región.
      **Argumento de calendario que inclinó la decisión**: la `005` va a añadir interfaz a esta misma
      página —con vista dividida habrá **dos** paletas—, así que `getByRole('status')` a secas se iba
      a romper igual. Pagarlo en la spec que lo descubre es más barato que heredarlo.
      **Se despacha después de T-010**, no en paralelo: los archivos son disjuntos sobre el papel,
      pero T-010 mide el presupuesto de AC-33 corriendo `playwright` sobre todo el directorio y T-011
      edita `editor.spec.ts` — tocarlo a mitad invalida esas medidas.
      **Verificado por el orchestrator el 2026-07-29**, con los comandos `DONE` corridos de nuevo:
      `test MarkdownPalette` → **11 passed** · `test DocumentEditorPage` → **44 passed** ·
      `pnpm --filter @one-markdown/web test` → **19 archivos, 470 passed** ·
      `pnpm typecheck` / `pnpm lint` → exit **0** los tres paquetes.
      El total de web sube **469 → 470** por una sustitución, no por una adición: el caso «anuncia …
      y **solo** tras insertar» era la traducción fiel del AC-27 **anterior** y se cambia por dos
      (montaje+nombre, y AC-36). **AC-34 intacto**: `shared` **81** · api unit **305** · api e2e
      **511**, ninguna de las tres movida.
      **Cinco mutaciones probadas y las cinco cayeron**, que es lo que convierte «verde» en
      «verificado»: `SaveStatus` sin `aria-label` → **5 rojos**; región de la paleta perezosa otra vez
      → **3**; reanuncio que no cambia nada → `expected 1 to be greater than or equal to 2`, **la
      cifra exacta que la spec predecía**; región sin `aria-label` → **3**; región que arranca con
      texto dentro → **2**.
      **Tres hallazgos de spec, los tres resueltos en la v0.3.0 corrigiendo la redacción y no la
      aserción** —el orden importa, y es el que esta fase lleva usando desde la `002`—:
      1. **La instrucción de AC-36 sobre `takeRecords()` no era implementable.** El AC pedía contar
         «con `takeRecords()` **y no** con el callback». Medido con una sonda de callback vacío:
         `registros solo con takeRecords(): 0`. Y no por el mecanismo elegido, sino por la semántica
         del observador: navegador y jsdom **entregan la cola en cada punto de comprobación de
         microtareas** y `await user.click()` cruza varios, así que un `takeRecords()` posterior solo
         ve lo ocurrido **desde el último `await`** — daría 0 con **cualquier** mecanismo. Lo que
         `takeRecords()` sí aporta es **el cierre**: capturar de forma síncrona un último lote aún no
         entregado, sin `waitFor` ni relojes. La implementación acumula en el callback **y** cierra
         con `takeRecords()`, y **el AC pasa a pedir eso**.
      2. **El fallo esperado del RED 1(b) no era el que ocurre.** La spec predijo «1 registro en vez
         de 2»; en realidad (b) revienta **antes**, al buscar la región, porque con la región perezosa
         no hay nada que encontrar: (a) y (b) cuelgan de la **misma** precondición ausente y fallan
         igual. El «1 en vez de 2» sí existe, pero como **mutación** sobre producción ya corregida.
         La cifra era buena; el momento, no.
      3. **El mecanismo de reanuncio (`U+200B`) se ratifica y se ajusta la aserción a él.** El espacio
         normal se descartó porque el whitespace es exactamente lo que colapsan `textContent`,
         jest-dom, Playwright y el cálculo de texto de un lector —una diferencia hecha solo de
         whitespace es la más fácil de que se normalice hasta desaparecer en el consumidor al que va
         dirigida—; y vaciar-y-reescribir, porque React agrupa las dos actualizaciones del mismo
         manejador en un render y exigiría `flushSync` o un temporizador. **Consecuencia ratificada**:
         tras un número **par** de anuncios el `textContent` es `Insertado: Negrita` + `U+200B`, que
         no se pinta ni se locuta pero **no es literalmente igual** a la cadena del AC. Se afirma por
         **contención**. La medida se adapta al mecanismo bueno, no al revés.
- [x] **T-012** · `frontend` · El último locator que distinguía las regiones vivas por contenido — **AC-27** — 2026-07-29
      **Tarea nueva de la v0.3.0**, decidida al cerrar: `e2e/palette.spec.ts` lo creó **T-010**, antes
      de que existiera el nombre accesible, y desambiguaba las dos regiones `role="status"` **por
      contenido** (`getByRole('status').filter({ hasText: /^(Guardado|…)$/ })`). Pasaba verde.
      **Por qué no se dejó como deuda de la `005`, que era la opción cómoda**: no es deuda estética.
      Ese locator es **inmune a la mutación que borra el `aria-label`** —`filter({ hasText })` compara
      contra el texto renderizado y **no lee** `aria-label`—, así que si alguien retira el nombre que
      AC-27 exige, la suite de la paleta **sigue verde y no se entera**. Era un test **incapaz de
      detectar la regresión del criterio que lo rodea**. Y el archivo es artefacto **de esta spec**,
      no herencia de la `003`: cerrar la `004` dejando dentro un apaño que existe solo porque el
      nombre aún no estaba es la arqueología que estas fases han pagado por evitar.
      **Sin RED clásico, y dicho como tal**: el comportamiento lo implementó T-011 y el locator nuevo
      pasa a la primera; un rojo artificial habría sido teatro. Lo sustituye una **mutación
      obligatoria**, que es la pregunta que el RED contesta hecha directamente.
      **Verificado**: `playwright test palette` → **1 passed** (2.2 s) · con el `aria-label` borrado
      de `SaveStatus.tsx` → **1 failed**, `element(s) not found` en
      `await expect(saveStatus).toHaveText('Guardado')`, la **primera** aserción sobre la región ·
      restaurado (hash idéntico, `git diff` idéntico byte a byte al de partida) → **1 passed** ·
      `lint` y `typecheck` de `web` limpios. Un solo archivo movido: `apps/web/e2e/palette.spec.ts`.
      **Media medida y no entera**: que el locator **viejo** siguiera verde bajo la misma mutación
      **no se midió** (cada corrida gasta un `PUT` del cupo de `documentContent`, que no se resetea).
      Se sigue por construcción y queda anotado como **deducción, no como medición**.

**Verificación de T-006, T-007, T-008 y T-009, corrida por el orchestrator** (rama
`feat/004-markdown-palette`, el 2026-07-29 a las 00:40-00:42):

| Comando | Salida real |
|---|---|
| `pnpm --filter @one-markdown/web test` | **19 archivos, 469 passed** (venía de 18 / 412 al cerrar T-005) |
| `pnpm typecheck` | exit **0**, los tres paquetes (`shared`, `api`, `web`) |
| `pnpm lint` | exit **0**, los tres paquetes |
| `pnpm --filter @one-markdown/web exec playwright test editor` | **3 passed** — la verificación en navegador que tenía bloqueada a T-009 |

**Lo que cierra el `412 passed` de la entrada anterior**: aquella cifra era la de T-001…T-005 y dejó
de ser la del árbol en cuanto T-009 empezó a escribir. La cifra del árbol es ahora **469** sobre
**19** archivos, con los dos archivos nuevos de la rama A (`MarkdownPalette.tsx` y su test) y los
crecimientos de la rama B. El aviso de concurrencia de arriba queda **resuelto**: las dos ramas de la
ola 3 corrieron en paralelo sin pisarse un archivo.

**El `playwright test editor` lo reporta la sesión que cerró T-009 y no lo he repetido**, a
propósito: T-010 está corriendo `playwright` sobre ese mismo directorio en paralelo y dos suites de
navegador a la vez se pelean por los puertos de los servidores (`reuseExistingServer: false` en los
dos, decisión de `T-025` de la `001`). Un rojo salido de ahí no diría nada sobre el código. Se
re-mide cuando T-010 cierre, que además es cuando T-011 puede entrar.

**Mutaciones adversariales**: 10 probadas sobre lo entregado en esta ola, **9 mataron tests** y
**sobrevivió exactamente una** — la que la v0.1.2 dice que **debe** sobrevivir (reordenar las claves
de `PALETTE_GROUP_LABELS`, que no son contrato de nada). Es el resultado que se pedía, no una
coincidencia: es el mismo par que la ola 2 midió con M38/M41.

**Cerrado el 2026-07-29 lo que quedaba pendiente de la ola anterior**: la **segunda mutación
superviviente de las 41 de T-001…T-005** es **M5**, y estaba identificada en el informe de
T-001…T-005 —no había que preguntarle a nadie, había que leerlo—. Sobrevivió porque los cuatro
elementos que envuelven usan delimitador **simétrico**, así que cerrar con `before` produce la misma
cadena; el agente la repitió como **M5bis** en T-002 con `link`/`image`, asimétricos, y **cayó**. Con
M38 —que **debe** sobrevivir— el par queda explicado y **no hay ningún hueco de cobertura abierto**.
Detalle en la entrada de T-001…T-005, más arriba, y en el CHANGELOG de la v0.2.1.

**Tres cosas que ninguna tarea puede tocar**, escritas aquí además de en `tasks.md` porque las tres vienen
con instrucciones explícitas de la `003` y las tres son del tipo que alguien «mejora» sin darse cuenta:

1. **`MarkdownPreview.tsx`** y su cadena de plugins. `rehype-sanitize` **no es redundante** —es la única
   capa que defiende los protocolos de `src`, medido con una mutación— y las capas 1 y 2 siguen **sin un
   rojo propio**: una capa no se retira porque ningún test la eche de menos.
2. **`editor.store.ts`.** La paleta llama a `setDraft` tal cual: es la invariante que le hace heredar el
   debounce, la coalescencia y el marcado de sucio sin una línea de código nueva.
3. **`packages/shared/**` y `apps/api/**`.** Ni una línea (AC-34).

**Una excepción, y una sola, abierta por la v0.2.0**: `SaveStatus.tsx` —producción de la `003`— lo
toca **T-011 y nadie más**, y solo para añadirle un `aria-label` a su `role="status"`. Sus textos,
sus estados y su pareja `status`/`alert` se quedan exactamente como están.

**Cifras de partida contra las que se medirá el cierre** (las del cierre de la `003`): `shared` **81** ·
`apps/web` 16 archivos / **321** · api unit 21 suites / **305** · api e2e 22 suites / **511** ·
`pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24** sin un solo `429` · `typecheck` y `lint` en
**0** en los tres paquetes. Las tres últimas columnas de `apps/api` y `packages/shared` tienen que salir
**idénticas** al cerrar la `004`; si se mueven, la decisión 1 del plan se rompió y eso es un cambio de spec.

### Cierre de la `004` (2026-07-29) — re-medición corrida por el orchestrator

La spec queda **complete** en **v0.3.0**: **36/36 AC** y **12/12 tareas**. Estas son las cifras
reales, con el comando delante.

**Suite completa del monorepo, desde estado limpio** (`rm -rf packages/shared/dist` y dejar que el
flujo lo reconstruya), corrida **después de T-012**:

| Comando | Salida real |
|---|---|
| `pnpm test` → `packages/shared` | 1 archivo, **81 passed** |
| `pnpm test` → `apps/web` | 19 archivos, **470 passed** |
| `pnpm test` → `apps/api` (unit) | 21 suites, **305 passed** |
| `pnpm typecheck` | exit **0**, los tres paquetes |
| `pnpm lint` | exit **0**, los tres paquetes |

**AC-34 se cumple**: `shared` **81**, api unit **305** y api e2e **511** salen **idénticas** a las
cifras de partida de la `003`. La única que se mueve es `apps/web`, **469 → 470**, y se mueve por una
**sustitución** (el caso del AC-27 anterior por dos casos nuevos), no por una adición.

**Navegador, `--retries=2 --repeat-each=3`**: **27 passed en 26,1 s**, **cero reintentos**, **cero
`flaky`** y **cero apariciones de `429`** en toda la salida. Sondeo de Redis cada 300 ms sobre
`throttle:*` durante la corrida: pico de `documentContent` **14**, `login` 5, `register` 1 — por
debajo del 15 que midió T-010 y **sin un solo `429`**, que es lo que AC-33(b) pide. _(El 14 frente al
15 no es una mejora: el sondeo es muestreado y cada pasada tarda, así que la cifra es una **cota
inferior**. Se anota como tal y no como reducción de gasto.)_

**Una honestidad sobre el orden, porque la regla de la casa es que una medición que no se tomó no se
reporta como tomada.** Esa corrida de `--repeat-each=3` se hizo **antes de T-012**. Al repetirla
después, **abortó sin ejecutar un solo test**:

```
Error: http://localhost:5173 is already used, make sure that nothing is running
on the port/url or set reuseExistingServer:true in config.webServer.
```

No es un rojo de la suite: es un **`pnpm dev` ajeno ocupando el puerto** —una terminal de VS Code del
usuario, PID 12197, arrancada a mitad del cierre—, y **no se mató** porque no es un proceso de esta
sesión. Lo que sí está medido después de T-012 es todo lo demás: la suite completa del monorepo (la
tabla de arriba), y el propio `playwright test palette` de T-012 con su mutación en rojo y su
restauración en verde. Lo que queda **sin re-medir tras T-012** es exclusivamente el
`--repeat-each=3` **completo**, y el delta que lo separa de la corrida verde es **un locator que
resuelve al mismo elemento** — pero eso es un argumento, no una medida, y por eso se escribe aquí en
vez de darlo por hecho. **Se cierra corriendo el comando con `pnpm dev` parado.**

**Y de ahí sale el riesgo #14 de la spec**, que es el hallazgo operativo del cierre: `dev-env.ts` le
dio al API un puerto propio para e2e (**3011**, con el comentario «distinto del 3001 de `pnpm dev`»)
pero **dejó el web en 5173**, el mismo de `pnpm dev`. Media isolación. Con
`reuseExistingServer: false` —correcto y deliberado desde `T-025` de la `001`— la suite aborta antes
de empezar, y el error **parece** un fallo de la suite. Arreglo simétrico (`E2E_WEB_PORT` propio)
anotado para la `005`, que va a correr e2e a menudo sobre esta misma página.

---

## Notas de verificación

- **2026-07-24** — Skills instaladas con `npx skills add <repo> --skill <name> -y --copy`. `.claude/skills/` y `.agents/` están en `.gitignore`; `skills-lock.json` sí se versiona y permite restaurar con `npx skills experimental_install`.
- **2026-07-24** — La skill `test-driven-development-tdd` venía con `name: Test-Driven Development (TDD)` en su frontmatter; se normalizó a kebab-case para que Claude Code la cargue.
- **2026-07-24** — Los servidores MCP declarados en `.mcp.json` se conectan al iniciar sesión en este directorio; `postgres` requiere `DATABASE_URL` y una base levantada (aún no existe), así que aparecerá desconectado hasta la Fase 0 de scaffolding.
- **2026-07-24** — Versiones del stack resueltas con `npm view <pkg> version`: TypeScript `7.0.2` es el `latest`, pero se fija **5.9.3** en el monorepo porque NestJS 11 + `class-validator` dependen de `emitDecoratorMetadata` y el soporte del port nativo no está confirmado (riesgo #1 de la spec 000). Otras: Vite `8.1.5`, React `19.2.8`, React Router `8.3.0`, Vitest `4.1.10`, Tailwind `4.3.3`, NestJS `11.1.28`, Prisma `7.9.0`, Zustand `5.0.14`, Playwright `1.62.0`.
- **2026-07-24** — Verificado con `context7`: Tailwind 4 se integra con `@tailwindcss/vite` + `@import "tailwindcss"` (sin `tailwind.config.js` ni PostCSS), y Prisma 7 lee la URL del datasource desde `prisma.config.ts`, no desde `env()` en `schema.prisma`. Ambas cosas quedaron fijadas en `specs/000-foundation/plan.md`.

### Cierre de la Fase 2 (2026-07-24)

Secuencia completa corrida de punta a punta, en este orden y con estas salidas:

| Comando | Resultado |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm exec eslint tools/lint-fixtures/explicit-any.ts` | exit 1 (esperado: es la verificación negativa del AC-13) |
| `pnpm typecheck` | exit 0 (los 3 paquetes) |
| `pnpm test` | exit 0 — api 22, web 14, shared 11 |
| `pnpm --filter @one-markdown/api test:e2e` | 4 suites, **18 passed** |
| `pnpm build` | exit 0 |
| `pnpm test:e2e` | **3 passed** (chromium) |

Además se arrancó el proceso real (`node dist/main.js`, no solo `app.init()` de los tests) y se consultó con curl:

```
GET /api/health       → {"status":"ok","uptimeSeconds":15,"version":"0.0.0"}
GET /api/health/ready → {"status":"ready","checks":{"database":"up","redis":"up"}}  [HTTP 200]
GET /api/docs         → HTTP 200 (Swagger UI)
GET /api/nada         → {"statusCode":404,"error":"Not Found","message":"Cannot GET /api/nada","path":"/api/nada","timestamp":"..."}
```

Este arranque real destapó un `EADDRINUSE` en el 3000 que ningún test habría visto: los e2e usan
`app.init()` y nunca llegan a hacer `listen`. De ahí que `PORT` pase a **3001** por defecto.

**68 tests en total.** Todos los tests de comportamiento se escribieron antes que la implementación y se
verificó su fallo inicial (ver columna RED en la Fase 2).

Hallazgos que costaron tiempo y conviene no volver a pagar:

- **`ConfigModule.forRoot()` lee el entorno al importar el módulo**, no al instanciar la app. Un test que
  cambia `NODE_ENV` en `beforeAll` no tiene efecto. Solución adoptada: un archivo de test por entorno con
  un import de efecto lateral antes de `AppModule`. `jest.resetModules()` **no** sirve: carga una segunda
  copia de `@nestjs/common` y los `instanceof HttpException` del filtro de excepciones dejan de casar,
  convirtiendo 404 en 500.
- **ioredis con `lazyConnect` + `enableOfflineQueue: false`** rechaza el primer comando antes de que la
  conexión llegue a establecerse: el readiness daba Redis `down` con Redis sano. El tope de tiempo lo pone
  el probe del health (2 s), no ioredis.
- **Dos puertos por defecto colisionaban con otros proyectos de esta máquina**: PostgreSQL (5432, ocupado
  por un `postgres:13` ajeno) y el API (3000, ocupado por una app Next.js). Quedaron en **5433** y **3001**.
  No se tocó ninguno de los dos contenedores ajenos.
- **`exactOptionalPropertyTypes`** rechaza `workers: isCI ? 1 : undefined` en la config de Playwright.
  Se resolvió con spread condicional, sin aflojar el tsconfig.
- **eslint-plugin-react-hooks v7**: `configs['recommended-latest']` es formato eslintrc; el de config plana
  es `configs.flat['recommended-latest']`.
- **`ErrorResponseDto` no aparecía en el OpenAPI** por no estar referenciado en ningún endpoint concreto;
  se registra con `extraModels` al crear el documento.

### Cierre de la Fase 3 (2026-07-25)

**25 de 26 tareas hechas y verificadas; 1 bloqueada** (`T-026`, espera un run de CI que necesita `git push`).
Los **26 criterios de aceptación** de la spec `001` tienen test automatizado en verde.

Secuencia completa corrida de punta a punta, **borrando `packages/shared/dist` antes** para no repetir el
falso verde que destapó el primer CI:

| Comando | Resultado |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 (los 3 paquetes) |
| `pnpm test` | api **135** · web **92** · shared **37** |
| `pnpm --filter @one-markdown/api test:e2e` | 11 suites, **171 passed** |
| `pnpm build` | exit 0 |
| `pnpm test:e2e` | **4 passed** (2 corridas seguidas en verde) |

**439 tests en total** (68 al cerrar la Fase 2). Postgres y Redis quedan como se encontraron: 0 usuarios,
0 claves.

Lo que más costó no fue el código de auth, sino tres cosas que ningún test veía:

1. **El AC-1 de la spec `000` estaba mal verificado** (typecheck sobre un árbol sucio). Lo encontró el
   primer run real de CI, no una revisión.
2. **La web no arrancaba en un navegador real** por el CJS de `packages/shared`, y el test que existía para
   atraparlo (AC-11) llevaba días en rojo por otro motivo: un test rojo tolerado tapa exactamente los
   fallos que ese test justifica.
3. **Un test intermitente que despaché como "transitorio"** sin explicarlo. Era real, ~1 de cada 8 corridas.

Las tres tienen la misma forma: la verificación existía, pero no verificaba. De ahí las reglas nuevas de
este archivo — correr los `DONE` desde estado limpio y no cerrar un fallo sin explicar por qué desapareció.

### Verificación del Bloque C contra el proceso real (2026-07-24)

Los 62 e2e pasan, pero además se arrancó el binario (`node dist/main.js`, puerto 3099, con el `.env` real)
y se recorrió el flujo con `curl`, que es lo que en la Fase 2 destapó el `EADDRINUSE` que ningún test veía:

| Comprobación | Resultado observado |
|---|---|
| `POST /api/auth/register` | `201` · `Set-Cookie: om_refresh=…; Max-Age=604800; Path=/api/auth; HttpOnly; SameSite=Strict` · cuerpo con `accessToken,expiresInSeconds,tokenType,user` y nada más |
| `GET /api/auth/me` con Bearer | `200`, claves exactas de `UserResponseDto`, **sin** `passwordHash` ni `mfaSecret` |
| `POST /api/auth/refresh` | `200` y cookie **distinta** de la anterior (rotación) |
| Reutilizar la cookie vieja | `401` — y la cookie **nueva** también `401`: familia revocada (AC-10 de punta a punta) |
| 5 fallos + 6.º intento **con la contraseña correcta** | `429` · cabecera `Retry-After: 900` · cuerpo con `retryAfterSeconds: 900` (AC-7) |
| Contraseña mala vs correo inexistente | `message` **idéntico** en los dos: `Credenciales inválidas` (AC-6) |
| `logout` con cookie / sin cookie | `204` y `204`; la cookie sale con `Max-Age=0` y el refresh posterior da `401` |
| `refresh` con cuerpo no vacío | `400` (el DTO vacío hace su trabajo) |
| Regresión: un `404` cualquiera | sigue con las 5 claves de siempre, **sin** `retryAfterSeconds` |

Datos de la prueba borrados después: 0 usuarios en `users`, 0 claves `auth:*` en Redis.

**Falso positivo mío, anotado para no repetirlo**: en el primer intento conté mal los fallos (el intento
contra un correo inexistente cuenta en **otra** clave) y creí ver un bloqueo que no saltaba. La
implementación estaba bien; el guion de prueba, no.

**Un error de diagnóstico mío, peor que el anterior**: cuando el agente del Bloque C reportó un fallo
unitario en `mfa-secret.cipher.spec.ts`, lo despaché como "transitorio, el otro agente estaba escribiendo a
la vez". No lo era: **el test era intermitente de verdad**, ~1 de cada 8 corridas. `alterarParte` cambiaba el
último carácter base64url de una de las tres partes, y cuando la parte no mide múltiplo de 3 bytes (el tag son
16 y el texto cifrado 32) los bits bajos de ese carácter son relleno que `Buffer.from(…, 'base64url')`
descarta: la parte "alterada" decodificaba a los **mismos** bytes y GCM la aceptaba con toda la razón. Lo
detectó y lo arregló el agente del Bloque D invirtiendo un bit de un byte real; verificado con **10 corridas
verdes de 10**. Lección: un fallo que no se reproduce no es un fallo transitorio hasta que se explica **por
qué** desapareció.

### Lo que destapó el primer run de CI (2026-07-24)

Run `30139345799` (push de `d9c2854` a `main`): **rojo en `Typecheck`**, Node 22 y Node 24, con
`TS2307: Cannot find module '@one-markdown/shared'` en los tres DTO que lo importan.

- **Causa**: `apps/api` y `apps/web` resuelven el paquete compartido por su `types: ./dist/index.d.ts`
  (decisión 2b de `specs/000-foundation/plan.md`), y en un clon limpio ese `dist/` **no existe** cuando
  corre `pnpm typecheck`. En esta máquina pasaba porque el `dist/` estaba construido de antes — incluido
  el `tsc --watch` que dejó corriendo `pnpm dev`.
- **El AC-1 de la spec `000` estaba mal verificado**: dice "clon nuevo → `pnpm install && pnpm typecheck`
  en 0" y se comprobó sobre un árbol sucio. Reproducido en local con `rm -rf packages/shared/dist`.
- **Arreglo**: script `shared:build` en la raíz, y `typecheck`, `test` y `test:e2e` lo ejecutan antes.
  En los scripts y no solo en el workflow, porque el AC-1 habla del clon nuevo, no del CI. `build` no
  necesitó cambio: `pnpm -r build` ya respeta el orden topológico.
- **Verificado borrando `packages/shared/dist` antes de cada comando**: `pnpm typecheck` → 0 ·
  `pnpm test` → 0 (api 22, web 14, shared 11) · `pnpm lint` → 0 · `pnpm build` → 0.
- **Regla que sale de aquí**: los comandos `DONE` se corren también desde estado limpio. Un `dist/`
  heredado convierte un fallo real en falso verde, que es exactamente lo que este seguimiento
  pretende evitar.

### Notas de la Fase 4 (2026-07-25) — infraestructura y hallazgos de la ola 1-3

**Infraestructura local: cómo se levantó la base, para quien retome la fase.** Docker Desktop no estaba
arrancado y **la integración WSL del CLI `docker` no está activa en esta distro**, así que `docker` a secas
no resuelve. Se arrancó Docker Desktop desde Windows y se usó **`docker.exe compose up -d`**. Con eso
PostgreSQL (**5433**) y Redis (**6379**) quedaron sanos y todo lo que toca la base (`migrate status`, los
`psql` de verificación de `T-001`, los e2e) funcionó sin más ajustes. No es un problema del proyecto ni hay
nada que arreglar en el repo: es el comando que hay que usar en esta máquina.

**Hallazgo pre-existente, no de esta spec: sin `packages/shared/dist` los e2e de `apps/api` no compilan.**
Al correr un e2e directamente desde estado limpio salta `TS2307: Cannot find module '@one-markdown/shared'`.
Se comprobó que **no es de `002`**: se reprodujo igual con el e2e de auth, que lleva días verde. La causa es
la conocida decisión 2b de la spec `000` (los paquetes resuelven el contrato por su `types:
./dist/index.d.ts`), y el flujo canónico ya la cubre: `pnpm typecheck` / `pnpm test` / `pnpm test:e2e`
ejecutan `shared:build` antes, así que reconstruyen `dist/` primero.
**Precisión que hacía falta sobre la regla de la Fase 4**, porque se estaba interpretando al revés: «correr
los `DONE` desde estado limpio» significa **borrar `dist/` y dejar que el flujo lo reconstruya**, no correr
los e2e con `dist/` ausente. Lo primero atrapa el falso verde del primer run de CI; lo segundo solo produce
un error de compilación que no informa de nada.

**Aviso menor a vigilar en CI**: en **1 de 4** corridas de la suite unitaria completa de `apps/api` apareció
`A worker process has failed to exit gracefully` de Jest. No se ha reproducido y `--detectOpenHandles` sale
limpio. Queda **anotado, no cerrado**: por la regla que salió de la Fase 3, un fallo que no se reproduce no
es transitorio hasta que se explica por qué desapareció. Si vuelve a aparecer —sobre todo en el runner, que
tiene menos CPU— el sospechoso natural es una conexión (Redis o Prisma) que sobrevive al `afterAll` de
alguna suite.

**Un RED que salió falso y cómo se detectó — patrón a repetir en todo e2e que espere `404`.** La primera
pasada del RED de `T-007` dio **`18 failed, 2 passed`**. Los dos que «pasaban» eran justamente los dos
casos que esperaban `404`… y pasaban **por el motivo equivocado**: la ruta `POST /:id/move` todavía no
existía y **Nest ya devuelve `404` para una ruta inexistente**. El agente lo vio y endureció los dos casos
con `expect(response.body.code).toBe('DIRECTORY_NOT_FOUND')`; con eso el rojo quedó completo, 20 de 20.

Es exactamente la clase de falso RED contra la que existe la regla de que **el test debe fallar por la
razón correcta**, y el `404` es su caso más traicionero: es el único estado que el framework produce
gratis, así que un test que solo mira el estado no distingue «el endpoint contesta bien» de «el endpoint
no existe». **Se aplica de aquí en adelante a todo e2e de esta fase que espere `404`**, y en particular a
`T-012`, que es una matriz entera de `404` sobre los diez endpoints, donde nadie notaría a ojo cuáles
pasan de verdad. El requisito ya está escrito en el RED de `T-012` en `tasks.md` (v0.2.0), en vez de
quedar como una regla general que hay que acordarse de aplicar.

**El `413` que no era `413`: un hueco de contrato que ningún test de esta spec podía ver.** `plan.md` §4
promete desde la v0.1.0 un **`413`** para un cuerpo por encima de `JSON_BODY_LIMIT`. Lo medido al
implementar `T-008` es un **`500`**: el `PayloadTooLargeError` de body-parser **no es una `HttpException`**,
así que `AllExceptionsFilter` cae a su rama genérica aunque el error traiga `status: 413`. Con el límite en
2 MiB y un tope de contenido de 200.000 caracteres, el caso cae **fuera del alcance de todos los tests de
la spec**, que es precisamente por lo que el contrato llevaba escrito desde el principio sin cumplirse.

**Decisión: se arregla el comportamiento, no el contrato** — AC-33 y la tarea `T-024`, en vez de reescribir
`plan.md` §4 para que diga `500`. Los tres motivos, en orden de peso:

1. **`500` es la respuesta incorrecta, y documentarla sería canonizar un defecto.** Un cuerpo demasiado
   grande es un error del cliente; el `4xx` es lo que le dice que reintentar igual no sirve. Un cliente
   escrito contra un `500` documentado lo tratará como fallo del servidor —reintento, alerta— y habrá que
   romperle el contrato el día que se arregle de verdad.
2. **No es solo cosmético.** El filtro registra `logger.error` **con traza completa** en todo lo que no es
   `HttpException`, así que hoy cualquiera con un token válido tiene un amplificador de ruido en los logs y
   un disparador de alertas de `5xx` gratis. Es un defecto operativo pequeño pero real.
3. **Un pendiente sin tarea y sin test es como desaparece la deuda en este proyecto.** La lección de la
   Fase 3 —«la verificación existía, pero no verificaba»— se repite aquí en su forma más pura: el contrato
   existía y nadie lo comprobaba. La corrección tiene que llegar con su AC y su comando, o no llega.

**Coste asumido, y por eso queda escrito**: `AllExceptionsFilter` es de la spec `000` (AC-5), así que
`T-024` toca contrato ajeno y deja entrada en `specs/000-foundation/CHANGELOG.md` — ya escrita como
**v0.1.5** — además de en la de `002`. La traducción se acota a un `status` **entero y en `4xx`**, con test
unitario de los dos sentidos, para que un `5xx` de una librería siga registrándose y un `Error` pelado siga
siendo `500`; sin `import` de `http-errors`, que es transitiva de Express y no una dependencia declarada
(la regla de cero dependencias nuevas sigue en pie).

**Cerrado el 2026-07-25 por `T-024`**, con la regla de detección tal como quedó escrita en su línea de la
Fase 4 y en los CHANGELOG de `000` (v0.1.6) y `002` (v0.2.1): rango `4xx` **cerrado** sobre `status` /
`statusCode`, registro por **estado** y no por origen, y `code` nunca copiado de un error ajeno.

### El `404` que no puede ocurrir: una contradicción de spec resuelta (2026-07-25)

**Lo que encontró `T-015`.** `spec.md` **AC-26** y el RED de `tasks.md` **T-015** piden que las **diez**
rutas de `/api/workspace/*` documenten `401`, `404` y `429`. `plan.md` §4, que enumera los errores **ruta
por ruta** desde la v0.1.0, lista los de `GET /api/workspace/tree` como «`401` · `429`», **sin `404`**. Es
la única ruta que no puede emitir un `404`: no resuelve ningún `:id`, y un workspace vacío responde `200`
con las dos listas vacías. Dos artefactos aprobados de la misma spec decían cosas distintas.

**Lo que hizo el agente, que es lo correcto**: siguió el AC —es la fuente de verdad del comportamiento— y
declaró el `404` con una descripción que dice explícitamente que forma parte del contrato de error común
del tag y que **esta ruta no lo emite hoy**, para no meter una mentira muda en el contrato público. Y lo
reportó, en vez de elegir por su cuenta entre dos artefactos aprobados. La decisión era del orchestrator.

**Decisión: gana `plan.md` §4. AC-26 se acota a las nueve rutas que sí producen `404`**, y el decorador se
retira del controlador. Spec en **v0.2.2**, tarea **`T-025`** escrita con su RED, su GREEN y su `DONE`.
Cuatro motivos, en orden de peso:

1. **La ruta no puede emitir un `404`**, y no por una decisión revisable sino por su forma: no hay entrada
   del cliente —ni `:id`, ni query— capaz de producir un «no encontrado». El único recurso que devuelve es
   el workspace del portador del token, que siempre existe.
2. **El argumento de «que el contrato de error del tag sea uno solo» describe un contrato que esta spec
   nunca tuvo.** `plan.md` §4 es per-ruta y deliberadamente desigual: no todas listan `400`, no todas
   listan `409`, y cada `404` va con su `code` (`DIRECTORY_NOT_FOUND` / `PARENT_NOT_FOUND` /
   `DOCUMENT_NOT_FOUND`). La uniformidad que justificaría declararlo no existe en ningún otro sitio.
3. **Documentar una respuesta inexistente es la misma clase de defecto que la spec ya decidió no cometer**
   en la v0.2.0, cuando eligió arreglar el `413` en vez de documentar el `500` que salía («documentarlo
   sería canonizar un defecto»). Aquí el sentido es inverso y la regla la misma: el documento describe lo
   que el API hace. Y la mitigación en prosa **no es legible por máquina** — un cliente generado del
   OpenAPI se lleva igualmente una rama de error muerta, que es precisamente el consumidor para el que se
   escribe el documento.
4. **El único `404` que puede ver un cliente de `/tree` es el de ruta inexistente de Nest, que no es una
   respuesta de la operación.** Confundir esos dos `404` ya costó caro dos veces en esta misma fase: es el
   falso RED de `T-007` (`18 failed, 2 passed`) y es lo que la mutación de control de `T-012` volvió a
   demostrar. Declarar un `404` justo en la ruta cuyo `404` solo puede venir del framework consagra esa
   confusión en el contrato público.

**Por qué es un patch y no un major, con la duda escrita.** La regla de este proyecto llama major a
«cambia el comportamiento observable ya implementado». Ninguna respuesta HTTP cambia: `/tree` nunca emitió
un `404` y no lo emitirá. Lo que cambia es una clave de un documento OpenAPI que describía algo que no
ocurre, sin consumidor —el contrato que consume la web es `packages/shared`, escrito a mano, y no declara
errores por ruta—. Lo que se corrige es la **precisión de un criterio** contra el artefacto que ya era
preciso, que es la definición literal de patch aquí. **La parte discutible se deja escrita en vez de
resolverse en silencio**: el efecto colateral es retocar un test de `T-015`, que está en verde, y por eso
el retoque va en una tarea con su propio RED —el caso en negativo «`/tree` no declara `404`»— y no como un
ajuste de paso. Si algún día `/tree` acepta un `:id` o una query que pueda no resolver, esto vuelve a ser
un cambio de alcance con su versión.

**Corrección de cuenta que iba en el mismo lote**: el RED de `T-012` en `tasks.md` decía «los **seis**
endpoints con parámetro de ruta» y son **siete** — tres de directorios (`PATCH`, `move`, `DELETE`) y
cuatro de documentos (`GET`, `PATCH`, `move`, `DELETE`). El test ya lo ancla con
`expect(PATH_PARAM_ENDPOINTS).toHaveLength(7)`, derivando la lista de la constante de los diez endpoints
en vez de escribirla aparte; corregido el texto para que coincida con lo verificado.

### Las nueve rutas con `404` no son las que llevan `{id}`: error de criterio en un RED (2026-07-25)

**Contexto**: el RED de `T-025`, escrito por el orchestrator en la v0.2.2, prescribía derivar las rutas que
declaran `404` **filtrando por `{id}` en la plantilla de ruta** sobre la constante de las diez, y anclar el
resultado con `toHaveLength(9)`.

**Ese filtro da siete.** Lo encontró el agente `backend` al implementar la tarea. `POST /api/workspace/
directories` y `POST /api/workspace/documents` **también** emiten `404` —con `code` `PARENT_NOT_FOUND`,
padre inexistente o ajeno— y **no** llevan `{id}` en la plantilla: reciben el id del recurso padre **en el
cuerpo** (`parentId` / `directoryId`). `plan.md` §4 lo lista desde la v0.1.0 en las líneas de errores de
esos dos endpoints; el criterio del RED simplemente no leía lo mismo que el plan.

**Por qué importa más de lo que parece.** El ancla `toHaveLength(9)` habría fallado con la lista en 7, o
sea **un rojo por la razón equivocada**, y precisamente en la única tarea de la spec cuyo rojo esperado es
exactamente uno y está escrito por adelantado («si además cae algún otro, se para y se reporta»). El agente
habría tenido que parar por un defecto del enunciado, no del contrato. Es el mismo mecanismo de daño que el
falso RED de `T-007`: un rojo que se lee como confirmación de la hipótesis cuando en realidad viene de otro
sitio.

**Cómo lo resolvió el agente, y por qué se acepta la lectura que hizo.** Tomó el ancla `toHaveLength(9)`
como la expresión de la **intención** —nueve = diez menos `/tree`, que es literalmente lo que dice la
decisión de la v0.2.2— y derivó por **complemento de `/tree`** en vez de por presencia de `{id}`. Las dos
listas quedan ancladas (`toHaveLength(9)` y `toHaveLength(1)`), el único elemento del complemento se afirma
por igualdad contra `/api/workspace/tree`, y no hay ninguna segunda lista escrita a mano: **ningún
`it.each` puede recorrer cero casos y pasar por vacuidad**, que era el peligro que el RED original quería
conjurar con el filtro. La restricción de fondo se respeta entera.

**Criterio correcto, escrito ya en `tasks.md`**: «todas las rutas del tag **menos** `GET /tree`», que es
«las que resuelven un id de recurso — **siete** desde la plantilla de ruta y **dos** desde el cuerpo». Y es
además el criterio más estable de los dos: «resuelve algún id de recurso» es una propiedad del **contrato**,
mientras que «lleva `{id}` en la plantilla» es una propiedad de la **sintaxis de la URL**. Coinciden hoy en
siete casos de diez y no tienen por qué seguir coincidiendo.

**Es el tercer error de cuenta de esta misma spec y del mismo género**: los «seis» endpoints con parámetro
de ruta que eran siete (v0.2.2), y los siete DTO de entrada que sí eran siete pero cuya cifra no estaba
derivada de nada (v0.2.2). La lección se repite sin variación: **una cifra escrita en prosa no vale nada;
vale la cifra derivada de una constante y anclada con un `toHaveLength`**, porque solo entonces el error de
cuenta se manifiesta como un rojo en vez de como un test que pasa midiendo otra cosa. Y el corolario, que
es el que le toca al orchestrator: cuando el enunciado de una tarea prescribe **cómo** derivar una lista, la
prescripción se verifica contra `plan.md` antes de escribirla, igual que se verifica el resultado.

Recogido en `specs/002-workspace-tree/CHANGELOG.md` **v0.2.3**.

### Deuda abierta de la ola 4 (2026-07-25) — verificación pendiente, no olvidada

**Estado al cerrar la Fase 4 (2026-07-25): los DOS puntos están SALDADOS.** El punto 1 se saldó al cerrar
la ola 4: el e2e completo del backend se corrió entero **dos veces** —`373` tras `T-014` y `435` tras
`T-015`, 20 suites en verde las dos— y la foto conjunta está en la tabla «Cierre del backend de la spec
`002`». El punto 2 queda saldado ahora: con `apps/web` libre de agentes se tomó **una sola foto de todo**
—web 12 / 188, api 19 / 264 y 20 / 455, shared 65, Playwright 5, más `typecheck` y `lint` **de raíz**— en
la tabla de «Cierre de la Fase 4 y de la spec `002`». Los 10 / 156 de `T-019` y los 11 / 169 de `T-022`
eran relojes intermedios, no regresiones, exactamente como avisaba el punto 2. El texto original de los dos
puntos se conserva íntegro abajo porque documenta **por qué** se aceptó no medir en su momento, que es lo
que hay que volver a leer la próxima vez que aparezca la misma disyuntiva.

1. **El e2e completo del backend está sin correr desde `T-009`.** `pnpm --filter @one-markdown/api
   test:e2e` completo se midió por última vez tras `T-010` (**15 suites / 314**). `T-024` **no** lo corrió:
   el orchestrator se lo prohibió porque `T-011` y `T-012` estaban escribiendo en `test/**` —
   `workspace-ownership.e2e-spec.ts` y el bloque de tope de nodos de `workspace-tree.e2e-spec.ts` son suyos
   — y una corrida completa habría medido un árbol a medias, que es peor que no medir: da un número que
   parece una regresión sin serlo, o tapa una que sí lo es. La sustituyó por una **regresión dirigida de
   12 suites / 174 tests** sobre lo que su cambio podía romper (`body-limit|validation` y
   `auth-|health|swagger`), que cubre el requisito real —ningún test de `000` ni de `001` en rojo— pero
   **no** equivale a la corrida completa.
   **Acción concreta al cerrar la ola 4**, cuando `T-011`, `T-012`, `T-013` y `T-014` estén en verde y
   nadie escriba en `test/**`: `rm -rf packages/shared/dist` y luego `pnpm --filter @one-markdown/api test`,
   `pnpm --filter @one-markdown/api test:e2e`, `pnpm typecheck` y `pnpm lint`, con las cifras anotadas en la
   tabla de cierre de la ola igual que se hizo con la ola 3. Hasta entonces el check-off de `T-024` lleva
   la salvedad escrita en su propia línea.
2. **Los contadores de la fase están medidos en momentos distintos** y no se pueden sumar entre sí: **314**
   e2e es la foto tras `T-010`, **255** unitarios es la foto tras `T-024`, y entre las dos hubo tareas en
   curso añadiendo archivos. La única cifra que vale como estado de la fase es la de la tabla de cierre de
   ola, corrida de una vez y sin agentes escribiendo. Esto no es una anomalía a arreglar, es la consecuencia
   aceptada de despachar seis tareas en paralelo; se anota para que nadie lea una regresión donde solo hay
   dos relojes distintos.

### Pendientes que dependen del usuario

1. **`.env.example`** — `.claude/settings.json` deniega leer y escribir `.env.*`, así que no se tocó.
   Estado verificado el 2026-07-24 (solo metadatos, sin leer contenido): existen `.env.example` en la raíz
   y `apps/api/.env`. **Falta confirmar** que contengan las 7 claves de `plan.md` §4:

   ```
   NODE_ENV=development
   PORT=3001
   DATABASE_URL=postgresql://one_markdown:one_markdown@localhost:5433/one_markdown
   REDIS_URL=redis://localhost:6379
   JWT_ACCESS_SECRET=<mínimo 32 caracteres>
   JWT_REFRESH_SECRET=<mínimo 32 caracteres, distinto del anterior>
   WEB_ORIGIN=http://localhost:5173
   ```
2. **~~Ejecutar el CI~~** — hecho. El usuario pusheó varias veces; tres runs hasta ahora:
   `30139345799` **rojo** por el defecto del AC-1 · `30140383389` **verde** en Node 22 y 24 (cierra AC-14
   y el riesgo #3 de `001`) · `30143727278` **rojo solo en `Web e2e tests`**, que es el fallo conocido que
   arregla `T-025` **de la Fase 3** (el e2e de auth en navegador; no confundir con la `T-025` de la Fase 4,
   que es la retirada del `404` de `/tree`). En ese último run pasaron `Apply Prisma migrations`,
   `Unit tests`, `API e2e tests` y `Build`, así que la parte nueva del workflow (T-026) ya está probada en
   el runner.
   **Falta una sola cosa**: pushear el commit de la `T-025` de la Fase 3 para que el run quede verde de
   punta a punta.
   **~~Aviso añadido al cerrar la Fase 4~~ — DESPACHADO el 2026-07-25, antes del push, que era la
   condición.** El aviso decía: el job `Web e2e tests` pasa de 4 a 5 casos con `workspace.spec.ts`, y con
   ese quinto la suite gasta **exactamente** las 5 altas por IP que permite el rate limit; con `retries: 2`
   en CI, el primer reintento se llevaría un `429` y el run se pondría rojo por algo que no es lo que la
   suite mide. Es AC-35 / `T-027`, **y está cerrada y verde**: el `DONE`
   (`--retries=2 --repeat-each=3` → **15 passed**) simula exactamente ese escenario, con **todos** los
   casos agotando los reintentos. Al medirlo apareció además que el cupo que se agotaba no era solo el de
   `register` sino también el de `login` (12 entradas contra 10), y eso también quedó cubierto. **El
   próximo push ya no debería traer ese rojo.**
3. **~~Commit~~** — la Fase 2 quedó commiteada en `d9c2854` y pusheada.
4. **~~Aprobar la spec `001-auth`~~** — aprobada el 2026-07-24. Fase 3 en curso.
5. **~~`.env.example` para `001-auth`~~** — el usuario confirma que creó las variables el 2026-07-24. No
   se pudo verificar desde la sesión (`.env.*` está denegado, y `ConfigModule` las carga en runtime, así
   que tampoco aparecen en el entorno del proceso). Se comprobará de forma indirecta al cerrar `T-002`:
   con la validación en su sitio, el API no arranca si falta `MFA_ENCRYPTION_KEY`. Claves esperadas:

   ```
   JWT_ACCESS_TTL=900
   JWT_REFRESH_TTL=604800
   BCRYPT_ROUNDS=12
   MFA_ENCRYPTION_KEY=<openssl rand -base64 32>
   MFA_ISSUER=One Markdown
   ```

   Ojo: perder `MFA_ENCRYPTION_KEY` inutiliza los secretos TOTP ya guardados (los usuarios con MFA
   tendrían que re-enrolarse con un código de recuperación).
6. **~~Aprobar la spec `002-workspace-tree`~~** — **aprobada el 2026-07-25**, sin cambios de alcance.
   Arranca la Fase 4. Se deja escrito **qué** se aprobó, no solo que se aprobó: los cuatro puntos que se le
   señalaron por condicionar el resto del producto y ser caros de cambiar con datos ya guardados quedaron
   aceptados **tal como estaban escritos**. Si alguno se revisa más adelante, es un cambio de versión de la
   spec con su entrada de CHANGELOG, no un ajuste de implementación:

   1. **El borrado es definitivo**: un directorio con contenido se borra con `?recursive=true` y arrastra
      su subárbol completo, sin papelera y sin deshacer. Los frenos son un `409` si no se pide
      explícitamente y una confirmación en la UI (riesgo #5 de la spec).
   2. **Unicidad de nombres entre hermanos, insensible a la caja y sin plegar acentos**: `Notas` y `NOTAS`
      colisionan; `Año` y `Ano` no. Un directorio y un documento **sí** pueden llamarse igual en la misma
      carpeta.
   3. **Editar el contenido de un documento queda fuera** de esta spec: es el corazón de `003-editor`.
      Hasta entonces un documento solo tiene el texto con el que nació.
   4. **Los cuatro límites tal cual**: 10 niveles de profundidad, 5.000 nodos por usuario, 200.000
      caracteres por documento y 120 peticiones/min/IP. Elegidos holgados pero sin datos de uso
      (riesgo #14). Son constantes con nombre: subirlos es una línea más una entrada de CHANGELOG.

   El orden de ejecución es el de `specs/002-workspace-tree/tasks.md` y el reparto por olas está en el
   **plan de despacho de la Fase 4**, más arriba en este archivo.
7. **`.env.example` y variables de entorno para `002`** — **nada nuevo**. Esta spec no añade ninguna
   variable de entorno: sus límites son constantes de código a propósito (`plan.md` §3), igual que los
   umbrales de seguridad de `001`. No hay nada que el usuario tenga que crear antes de la Fase 4.
8. **Commit y push de la Fase 4** — **pendiente del usuario**. `git push` sigue denegado en la sesión y
   nada de esta fase se ha commiteado. Es lo único que separa al repositorio de tener el ciclo `002`
   cerrado también en remoto, y lo que además cierra los dos pendientes de CI que quedan (el punto 2 de
   esta lista y `T-026` de la Fase 3).

---

## Qué sigue, para quien retome

**Nada de las Fases 0 a 4 queda a medias.** El estado real, en una línea por spec:

| Spec | Versión | Estado |
|---|---|---|
| `000-foundation` | 0.1.7 | implemented — 14/14 AC |
| `001-auth` | **0.1.2** | implemented — 26/26 AC (su `T-026` solo espera un run verde de CI, que necesita `git push`) |
| `002-workspace-tree` | **0.4.3** | **complete** — 35/35 AC; la enmienda de la v0.4.0 quedó **implementada** por `T-007`, `T-009` y `T-013` de la `003` |
| `003-editor` | **0.1.5** | **complete** — 34/34 AC, 17/17 tareas. La **v0.1.5** (2026-07-29) es un patch de precisión escrito **desde la `004`**: no toca código ni AC, y arregla una cifra de cupo sin ventana («la suite gasta 4 de 120» es **por corrida**; bajo `--repeat-each=3` eran **12**). Su AC-34 **no lleva número** y por eso sigue siendo cierto |
| `004-markdown-palette` | **0.3.0** | **complete** — **36/36 AC**, **12/12 tareas** (T-001…T-012), cerradas y verificadas el 2026-07-29. La **v0.3.0** es minor por una sola razón: **el recuento de tareas se mueve** (11 → 12) con `T-012`, que no añade ningún AC. Trae además tres correcciones de redacción, las tres escritas con la medición delante |
| `006-editor-undo` | — | **sin especificar, pero ya planificada** en `004/spec.md` §9 (qué, por qué y cómo). Depende de la `005` |

**La spec `004-markdown-palette` está `complete`** (`specs/004-markdown-palette/`, **v0.3.0**):
**36/36 AC** y **12/12 tareas**, **todas de `frontend`** —es la primera spec del proyecto sin una sola
tarea de backend—, cerradas y verificadas el 2026-07-29: web **19 archivos / 470 passed**, `shared`
**81**, api unit **305**, api e2e **511**, typecheck **0**, lint **0**, y el navegador con
`--retries=2 --repeat-each=3` en **27 passed sin un solo `429`**. Toca **exclusivamente `apps/web`**;
AC-34 verifica que `packages/shared` y `apps/api` no se mueven, y `git status --short` lo confirma:
ni un archivo fuera de `apps/web/**`, `specs/**` e `IMPLEMENTATION.md`. Detalle y matices —incluido
**qué no se pudo re-medir tras T-012 y por qué**— en el bloque «Cierre de la `004`» de la Fase 6.

**La v0.3.0 se escribió al cerrar, con T-011 verde, y añadió una tarea y tres correcciones.** La
tarea es **`T-012`**: `e2e/palette.spec.ts` —creado por T-010, antes de que existiera el nombre
accesible— seguía distinguiendo las dos regiones vivas **por contenido**, y eso no era deuda
estética: ese locator es **inmune a la mutación que borra el `aria-label`**, así que era un test
**incapaz de detectar la regresión del AC que lo rodea**. Las tres correcciones, todas con la
medición delante y ninguna relajando una aserción: **AC-36** pedía un `takeRecords()` **no
implementable** (medido: **0** registros, y lo sería con cualquier mecanismo, porque la cola del
observador se entrega en cada punto de comprobación de microtareas); el **fallo esperado del RED
1(b)** no era el que ocurre (los dos subcasos colgaban de la misma precondición ausente, así que
fallaban igual; el «1 en vez de 2» aparece como **mutación**); y el mecanismo de reanuncio
(**`U+200B`**) se ratifica, con la aserción del contenido final pasada a **contención** en vez de
igualdad literal.

**La v0.2.1 corrigió el único defecto de spec que quedaba vivo**, y conviene no releerlo mal: **AC-33
era cierto por corrida y falso bajo su propio comando de verificación** —pedía un pico de
`documentContent` **< 10 de 120** y mandaba medirlo con `--retries=2 --repeat-each=3`, que triplica
el gasto **dentro de la misma ventana de 60 s** del throttler—, y **ya estaba roto en 12 antes de que
esta spec existiera**. Se parte en dos ventanas con dos comandos; se descartó subir el número (sería
un número sobre el multiplicador, no sobre la suite) y recortar `editor.spec.ts` (cuesta cobertura de
una spec cerrada, con 105 de margen disponible). El mismo día se abrió la **v0.1.5 de la `003`** para
que su contabilidad de cierre no siga propagando la ambigüedad a la `005`.

**La v0.1.2 es un patch escrito con el código delante**, y salió de revisar lo entregado en vez de
darlo por bueno: el catálogo tiene **16 elementos y no 14** (error aritmético que contradecía a la
propia AC-16 y a AC-30, corregido en diez sitios); **AC-35** es nuevo y dice que *ningún bloque
destruye la selección de la persona* —`table` y `divider` con selección activa no estaban definidos, y
la lectura literal borraba el párrafo seleccionado al pulsar «Separador», sin aviso y sin deshacer—;
cuatro huecos más quedaron ratificados con lo implementado; `plan.md` §4.2 recoge ya la firma real de
`selectTargetWhenWrapping` (`?: string`, no booleano); y **§9.6** deja escrita la lección de que la
guarda de pureza no puede convivir con un comentario que la explique. Las **seis decisiones abiertas**
de su §8 se habían resuelto el 2026-07-28, las seis en la opción recomendada.

**Y hay una spec nueva en el horizonte que no existía esta mañana: la `006-editor-undo`.** No está escrita,
pero **sí planificada**, y en un sitio concreto: `004/spec.md` **§9**. Nació al resolver la decisión B de la
`004` —el usuario aceptó que la paleta no soporte `Ctrl`+`Z` **a condición de que el remedio quedara
planificable, no como nota al pie**—. Lo que hay que saber sin abrir nada: la pila **nativa** del navegador
es **inservible** en un `<textarea>` **controlado**, porque React reescribe el `value` en toda escritura
programática y esa reescritura no entra en la pila; `execCommand('insertText')` **no** es la salida
(deprecado, jsdom no lo implementa, obligaría a verificar el mock); y el enfoque previsto es una pila
**propia, por documento, dentro de `EditorEntry`**, registrada **dentro de `setDraft`** y con el deshacer
implementado **como otro `setDraft`**. Va **después de la `005`** porque es ella quien decide cuándo se
desaloja una entrada, y desalojarla **tira el historial** — lo que le deja a la `005` una restricción que
tiene que resolver conscientemente al fijar esa política.

**La spec `003-editor` está cerrada** (`specs/003-editor/`, v0.1.4, **complete**): 34/34 AC y 17/17
tareas. Detalle con comandos y salidas en la Fase 5. **No queda trabajo abierto de las cinco fases.**

Cifras del cierre: `shared` **81** · `apps/web` 16 archivos / **321** · api unit 21 suites / **305** ·
api e2e 22 suites / **511** (40,2 s) · `pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24** sin
un solo `429` · `typecheck` y `lint` en **0** en los tres paquetes.

**La spec `004-markdown-palette` está cerrada** (v0.3.0, **complete**, 36/36 AC y 12/12 tareas), así
que **lo siguiente del proyecto es la `005`**: tabs y vista dividida, que todavía **no tiene spec** y
por tanto empieza por el flujo de siempre —`spec.md` + `plan.md` + `tasks.md` + `CHANGELOG.md`— con
la lista de herencias de abajo delante. La `004` llegó con el
contrato cerrado por la `003` —el modo texto es **un solo `<textarea>`** y **todo** cambio de contenido
entra por `setDraft(id, texto)`, así que la paleta solo calcula la cadena nueva y llama; el estado sucio,
el debounce y la coalescencia reaccionan solos— y GFM ya está en el parser, así que tablas, listas de
tareas y tachado **no necesitan un plugin nuevo** y la cadena de saneado no hay que volver a medirla.

Dos matices que la planificación de la `004` añadió y que conviene leer antes de tocar código:

- **`setRangeText` no se usa**, pese a que la `003` lo daba por el camino. Muta el `value` del DOM por
  fuera de React y el render siguiente lo pisa en un control **controlado**. El camino es: calcular la
  cadena → `setDraft` → restaurar la selección en un `useLayoutEffect`. Y la restauración **no es
  opcional**: React manda el caret al final cuando se asigna un valor distinto de `e.target.value`.
- **«Deshacer agrupado», que la `003` había asignado a la `004`, se devuelve** con motivo: exige
  `document.execCommand('insertText')`, deprecado y no implementado por jsdom, o sea mockear en todos los
  tests de componente. `Ctrl`+`Z` deshará lo tecleado, no una inserción de la paleta.

**Lo que la `005` hereda con nombre y razón**, para no redescubrirlo:

- **«Split view» ya está definido** en `CLAUDE.md`: texto y preview lado a lado del **mismo** documento.
  Con esa lectura el split es un cambio de **disposición** sobre los paneles de la `003`, no un segundo
  estado: los dos leen el mismo `draft` de la misma entrada del store.
- **El estado del editor ya está indexado por documento** (`Record<string, EditorEntry>`), así que lo que
  la `005` tiene que decidir es la **política de desalojo**, no la forma.
- **`003/spec.md` §8.1 le deja una deuda con recomendación**: deduplicar el `GET …/documents/:id` en
  vuelo dentro de `open(id)`, con el mismo idiom *single-flight* que `http.ts` ya usa en
  `refreshSession()`. Hoy `StrictMode` lo duplica **solo en desarrollo**; con tabs pasa a ser un problema
  **real de producción**, y la `005` tiene que tocar `open(id)` de todas formas.
- **Una restricción nueva desde el 2026-07-28, al aprobarse la `004`**: la spec **`006-editor-undo`**
  —planificada en `004/spec.md` §9— colgará una **pila de deshacer dentro de `EditorEntry`**, es decir,
  **una por documento**. Eso convierte la política de desalojo en una decisión con una consecuencia que
  hoy no tiene: **desalojar una entrada descarta su historial de deshacer**. La `005` tiene que dejar
  **escrito y consciente** si «cerrar una pestaña y volver a abrirla pierde el deshacer» es aceptable, o
  si las entradas con historial merecen otro trato. Y el motivo de que la `006` vaya **después** y no
  antes es exactamente ese: diseñar la pila sin la política fijada es diseñarla contra un supuesto.
- **Restricción del 2026-07-29, al cerrar `T-010` de la `004`**: en la página del editor hay **dos
  regiones vivas** (`SaveStatus` y la paleta) y desde la `004` las dos llevan **`aria-label`**;
  `getByRole('status')` **sin nombre** está prohibido ahí, y en Playwright es violación de modo
  estricto. Con vista dividida habrá **dos paletas**, así que toda región viva que añada la `005`
  nace **con nombre accesible**. **Y la regla vale también para los tests**: desambiguar una región
  viva **por su contenido** (`filter({ hasText })`) parece equivalente y no lo es —es inmune a que
  alguien borre el `aria-label`, así que el test sobrevive verde a la regresión del criterio que
  dice verificar—. Le pasó a `e2e/palette.spec.ts` y lo arregló **`T-012`** de la `004`.
- **Nota de accesibilidad de la `004`, no bloqueante y con destinatario aquí** (riesgo #13 de su
  spec): poner `aria-label` a una región viva la nombra en la lista de regiones —que es lo que AC-27
  busca— pero **algunos lectores lo usan en el anuncio además del contenido**, de modo que puede
  oírse «Elemento insertado. Insertado: Negrita». La `004` lo pide explícitamente y **lo asume**. La
  `005` tendrá **dos paletas** y por tanto **dos regiones homónimas** en la misma página, así que le
  toca revisarlo **con lector real** (NVDA o VoiceOver). **Ningún test de este repositorio puede
  detectarlo**: ni jsdom ni Playwright locutan nada, y escribir uno que finja que sí sería peor que
  no tenerlo. Si con dos paletas resulta hablador, la salida previsible es **un nombre por panel**
  («Elemento insertado, panel izquierdo»), no quitar el nombre.
- **El e2e y `pnpm dev` se pelean por el `5173`, y media isolación ya está hecha** (riesgo #14 de la
  `004`). `apps/web/e2e/support/dev-env.ts` le dio al API un puerto propio —**3011**, con el
  comentario «distinto del 3001 de `pnpm dev`»— pero dejó el web en **5173**, el mismo que usa
  `pnpm dev`. Con `reuseExistingServer: false` —correcto, y decisión de `T-025` de la `001`— la suite
  **aborta antes de ejecutar un solo test** con `http://localhost:5173 is already used`, que se lee
  como un fallo de la suite y es un fallo de **entorno**. Bloqueó una re-medición del cierre de la
  `004`. La `005` va a correr e2e a menudo sobre esta misma página: darle al web su `E2E_WEB_PORT`
  es simétrico con lo que ya está escrito ahí y cuesta una constante.
- **La tercera copia de `watchConsole` la escribe la `005`, y con ella la extracción.** El ayudante
  está duplicado entre `e2e/editor.spec.ts` y `e2e/palette.spec.ts` porque la lista de artefactos de
  `T-010` era **un solo archivo**. La regla es extraer **a la tercera**, va a
  `apps/web/e2e/support/`, y **extraer es unificar**: las dos copias ya divergieron en firma (una
  acepta patrones tolerados, la otra no). `e2e/support/**` es contrato de la `001` → entrada de
  cierre en su CHANGELOG, como hicieron `T-027` de la `002` y `T-015` de la `003`.
- **Toda cifra de cupo que escriba la `005` lleva pegada su ventana y su comando.** Es la lección de
  la v0.2.1 de la `004`: un AC con un número de cupo pero sin ventana fue **cierto por corrida y
  falso bajo su propio comando de verificación** durante dos specs, porque `--repeat-each` y
  `--retries` multiplican el escenario **dentro de la misma ventana de 60 s** del throttler cuando la
  suite dura menos que eso.

**Tres cosas que costaron descubrir y que no se deducen leyendo el código:**

1. **`plan.md` §2.2.1 de la `003`** — `rehype-sanitize` **empezó siendo redundante y dejó de serlo**: es
   la única capa que defiende los protocolos de `src`, demostrado añadiendo una carga de imagen con
   `irc:` y viéndola caer al quitarlo. La regla que queda escrita sigue valiendo para las capas 1 y 2,
   que **siguen sin tener un rojo propio**: una capa no se retira porque ningún test la eche de menos.
2. **§6 de la `003`** — la lista cerrada de artefactos tocables se quedó corta **dos veces**, las dos por
   el mismo motivo: el radio de un cambio de contrato incluye **todo lo que construye un valor del
   tipo**, fixtures de test de los dos paquetes incluidos, no solo los DTO. La regla para la próxima
   spec que amplíe un tipo de `packages/shared` está escrita ahí: es un `grep` por el nombre del **tipo**,
   no por el del endpoint.
3. **La regla de los resets de contadores** (`003/tasks.md`, `T-015`) — la redacción original era
   **incorrecta** y costó ~60 s por corrida en `T-008`. Lo que importa es el **momento** (en los límites
   sí, a mitad de una secuencia de agotamiento no), **no el lugar**.

Y un riesgo conocido que conviene reconocer antes de diagnosticarlo mal: si el caso de conflicto de
**AC-33 de la `003`** (no el de la `004`, que también se llama AC-33 y va del presupuesto de cupo)
parpadea alguna vez en CI, la causa es la ventana de **decenas de milisegundos** entre el `PUT`
externo y el vencimiento del debounce de 1.500 ms — **no** el cupo del throttler, que es donde mira todo
el mundo después de `T-015`. Corrió 13 veces sin fallar y **no se estabilizó a propósito**
(`003/spec.md` §8.2).

Y una regla operativa que las cuatro fases han pagado por aprender, por si se lee esto antes de empezar:
**los comandos `DONE` se corren desde estado limpio** (`rm -rf packages/shared/dist` y dejar que el flujo lo
reconstruya) y **un fallo que no se reproduce no es transitorio hasta que se explica por qué desapareció**.
