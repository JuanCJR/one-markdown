# Retrospectiva de metodología — One Markdown

**Fecha**: 2026-08-01, con las **siete specs cerradas** (`000`…`006`).
**Alcance**: cómo hemos trabajado —subagentes, skills, SDD, TDD, seguimiento—, no qué hemos
construido.

Todo lo de aquí está sacado del historial del repositorio (`IMPLEMENTATION.md`, `specs/*/CHANGELOG.md`,
`.claude/`), no de impresiones. Cada punto lleva la evidencia con la que se puede volver a comprobar.

---

## 0. Las métricas, primero

### Tareas ejecutadas por subagente, por fase

| Fase | Spec | Tareas por subagente |
|---|---|---|
| 3 | `001-auth` | 19 |
| 4 | `002-workspace-tree` | 23 |
| 5 | `003-editor` | 2 |
| 6 | `004-markdown-palette` | 1 |
| 7 | `005-tabs-split-view` | 5 |
| 8 | `006-editor-undo` | **0** |

**Total: 50.** La tendencia es descendente y la última fase es cero.

> Reproducible con:
> `awk '/^## Fase/{f=$0} /agente \`(frontend|backend)\`/{c[f]++} END{for(k in c) print c[k], k}' IMPLEMENTATION.md`

### Versiones de spec por feature

| Spec | Versiones | Patches escritos **con el código delante** |
|---|---|---|
| `000-foundation` | 8 | 0 |
| `001-auth` | 5 | 0 |
| `002-workspace-tree` | 13 | 0 |
| `003-editor` | 7 | 0 |
| `004-markdown-palette` | 7 | 1 |
| `005-tabs-split-view` | 7 | 3 |
| `006-editor-undo` | 4 | 2 |

La columna de la derecha solo empieza a existir a partir de la `004`: es cuando se adopta la práctica
de **corregir la spec con la medición delante** en vez de dejar el hueco. Que crezca es señal de que
el ciclo funciona, no de que las specs empeoren.

### Configuración

- **3 agentes** definidos: `orchestrator`, `frontend`, `backend`.
- **15 skills** instaladas en `.claude/skills/`.
- **3 de ellas son inejecutables**: `zustand`, `playwright` y `testing-anti-patterns` llevan
  `user-invocable: false` **y** `disable-model-invocation: true`.

### Defectos que un agente encontró y **reportó en vez de decidir en silencio**

12 menciones registradas entre `IMPLEMENTATION.md` y las specs. Los cuatro más caros, todos de la
`005`: la «×» de cierre de **19,73 × 20 px** (por debajo de SC 2.5.8, y de ahí nació un AC nuevo) ·
**tres comandos `DONE` que no ejecutaban nada** (`test "A|B"`, y el filtro de Vitest 4 es **subcadena,
no expresión regular**) · un `return null` que **desmontaba una región viva antes de que hubiera nada
que anunciar** · **seis** ayudantes de e2e duplicados donde la spec decía cinco.

---

## 1. Puntos positivos

### 1.1 Los subagentes encontraron defectos que la revisión no encontró

Es el dato más fuerte del historial. En la `005`, de las seis tareas de código que hizo un agente
`frontend`, **cinco encontraron algo y lo reportaron**. Ninguno de esos cuatro defectos de arriba lo
habría cazado el orchestrator leyendo el resultado: tres son propiedades que solo se ven **ejecutando**
(la caja de un control, un comando que no filtra nada, un componente que se desmonta entre dos
repintados) y el cuarto es un recuento que la spec había escrito mal.

**Lo que hace que funcione no es el agente: es que pare y avise.** Un agente que hubiera «arreglado»
la aserción de 24 px para que pasara habría producido el mismo verde y ningún AC nuevo.

### 1.2 La lista de artefactos por tarea funciona porque falla ruidosamente

Se quedó corta **6 veces** (`002` ×2, `004` ×1, `005` ×1, `006` ×2) y **las 6 salieron a la luz**: unas
por `typecheck`, otras porque el agente paró. El patrón es siempre el mismo y ya está escrito: *el
radio de un cambio incluye todo lo que construye un valor del tipo*, fixtures de test incluidos.

Un radio mal calculado que se detecta cuesta una línea. El mismo error sin la lista es un defecto que
se descubre en producción.

### 1.3 Validar el instrumento antes de creerse la medida

Cazó **tres ceros falsos**:

1. `pico=0` de un `redis-cli` que **no existe en esta máquina** (cierre de la `005`).
2. «cero `429`» de una corrida que **no ejecutó un solo caso** — se había borrado `packages/shared/dist`
   en paralelo y el `--` extra llegó literal a Playwright (cierre de la `006`).
3. La afirmación de `IMPLEMENTATION.md` de que la verificación negativa de CI estaba cubierta por el
   run `30139345799`: ese run murió en **`Typecheck`** y los pasos de test quedaron **skipped**.

Los tres son el mismo defecto con tres disfraces: **un cero de un instrumento desconectado es
indistinguible de uno real**.

### 1.4 Las specs como memoria durable

La `006` se planificó **sin releer ninguna conversación**, porque la `004` §9 dejó escrito el qué, el
porqué y el cómo —incluido por qué `execCommand` no era la salida— y la `005` §6.3 resolvió por
adelantado la restricción que la condicionaba. Funcionó exactamente como estaba diseñado.

### 1.5 TDD, con la regla del andamio

«Un test que importa un módulo inexistente falla por **resolución**, y eso no demuestra nada»
(`004` §9.7) resolvió una confusión que se repitió tres veces en una sola spec. Y la práctica de
**verificar por mutación cuando no hay rojo que reportar** evitó dar por buenos cinco AC en `T-004`
de la `006`.

---

## 2. Puntos negativos

### 2.1 El uso de subagentes se ha ido a cero

23 → 19 → 2 → 1 → 5 → **0**. Detrás hay un **conflicto de configuración**: `CLAUDE.md` dice que la
implementación va a `frontend`/`backend`, pero la sesión venía configurada con «no uses el Agent tool
salvo petición explícita». Gana la configuración de sesión, en silencio.

**Consecuencia concreta**: las 10 tareas de la `006` las hizo el orchestrator, y con ello se perdió
justo el mecanismo que en la `005` encontró cinco defectos. No es una hipótesis: es el mismo tipo de
trabajo con el mecanismo desconectado.

### 2.2 Tres skills son configuración muerta

`zustand`, `playwright` y `testing-anti-patterns` no las puede invocar nadie —ni el usuario ni el
modelo—. Son, además, **las tres más pertinentes** para este repositorio. Configuración que no puede
ejecutarse es ruido que **parece** cobertura.

### 2.3 Las 15 skills no se usaron prácticamente nunca

En la fase `006` se consultó `context7` dos veces, y por CLI, no como skill. Y hay **duplicación de
fuente de verdad**: `spec-driven-development` y `test-driven-development-tdd` dicen lo mismo que
`CLAUDE.md` y las plantillas de `specs/`, que son las que de verdad se siguen.

### 2.4 La documentación creció sin cota

`IMPLEMENTATION.md` pasa de **3.000 líneas**; las filas de `specs/README.md` son párrafos de mil
palabras; la `002` acumula **13 versiones** de spec. El detalle es valioso y ha pagado varias veces,
pero **el índice dejó de ser un índice**: hoy cuesta más leer el estado que hacer el cambio.

### 2.5 La spec se escribe antes que el código y se equivoca de forma medible

`006`: **2 de 4** versiones son patches con el código delante. `005`: 3 de 7. El caso más limpio es
`plan.md` §4.2 de la `006`, que fijaba la **forma exacta** de un valor (`{at: 0, …}`) que resultó ser
irrelevante — y corregirlo obligó a decidir, con el test delante, que normalizarlo habría añadido una
rama que solo su propio test ejercitaría.

**El diagnóstico no es «el SDD falla»**: es que las specs entran con **más detalle del que se puede
sostener sin haber escrito una línea**.

### 2.6 Lapsos de proceso del orchestrator en la fase `006`

No son de la metodología, son de quien la ejecutó, y se registran para que se puedan corregir:

- **Implementé antes de escribir el test** en `T-003` (el RED se recuperó de verdad —andamio, medición,
  restauración—, pero el orden fue el equivocado).
- **Escribí un test tautológico**: el de `Ctrl`+`Y` afirmaba que el texto vuelve a la inserción, lo cual
  es cierto también si ni deshacer ni rehacer hacen nada. **Pasaba en verde con la página sin tocar.**
- **Dos listas de artefactos cortas** (`DocumentTabs.test.tsx`, `smoke.spec.ts`).
- **Un cabo suelto**: la fila de la `001` en `specs/README.md` se quedó una versión atrás.
- **Cité una nota del seguimiento sin verificarla**, y era falsa (la del run `30139345799`).

---

## 3. Oportunidades de mejora — lista accionable

- [x] **A. Decidir de verdad si la implementación va por subagentes, y hacerlo cumplir donde manda.**
      Hoy `CLAUDE.md` lo dice y la configuración de sesión lo impide. Si la respuesta es sí, tiene que
      estar en `.claude/settings.json`, no solo en la prosa.
      **Es la de mayor retorno**: es el mecanismo con el historial más claro de encontrar defectos
      reales (§1.1), y ahora mismo está apagado sin que nadie lo decidiera.

- [x] **B. Arreglar o borrar las tres skills inejecutables.** Quitar `disable-model-invocation: true`
      de `zustand`, `playwright` y `testing-anti-patterns`, o eliminarlas del repositorio.

- [x] **C. Podar el resto de skills.** De 15, quedarse con las que aportan algo que `CLAUDE.md` no dice
      ya. `spec-driven-development` y `test-driven-development-tdd` o **sustituyen** a la prosa de
      `CLAUDE.md` o sobran; convivir con ella es tener dos fuentes de verdad para la metodología.

- [x] **D. Poner cota a la documentación de seguimiento.**
      `specs/README.md` vuelve a ser **una línea por spec** (versión, estado, dependencias) y el detalle
      vive en el `CHANGELOG` de cada una. `IMPLEMENTATION.md` se corta, por fase cerrada, a un resumen
      con enlace.

- [x] **E. Subir al `Definition of Done` de cada tarea la pregunta que hoy solo se le hace a los AC**:
      «¿qué mutación tumbaría este test?». El caso tautológico de §2.6 habría muerto al escribirse.

- [x] **F. Regla nueva: un dato del seguimiento no se cita sin comprobarlo.**
      La nota falsa sobre el run de CI llevaba meses en `IMPLEMENTATION.md` y se repitió como buena.
      Un documento de seguimiento es una fuente **secundaria**; la primaria es el comando.

- [x] **G. Calibrar cuánta spec se escribe por adelantado.**
      **Sí antes de `tasks.md`**: decisiones, cotas y alcance. La de «deltas contra instantáneas» de la
      `006` se tomó a tiempo, con la aritmética delante, y sostuvo la implementación entera sin una
      sola corrección.
      **No antes del primer test verde**: las formas exactas de los datos.

---

## 4. Lo que esta retrospectiva no cubre

- **El CI**, por decisión explícita: no hay entorno todavía y no es prioridad. Queda un pendiente
  real registrado —la verificación negativa de `T-026` de la `001`— y una nota falsa sin corregir en
  `IMPLEMENTATION.md` sobre el run `30139345799`.
- **Las tres revisiones manuales declaradas** (lector de pantalla real, `Ctrl`+`Y` en Firefox/Windows,
  y el `AC-34` de la `002`). No son deuda de código ni fallo de método: son cosas que **ningún test de
  este repositorio puede cubrir**, y están escritas como tales, sin ningún test que finja lo contrario.

---

## 5. Qué se aplicó, el 2026-08-03 — y dónde se equivocaba este documento

Las siete quedan **aplicadas**; no todas quedan **verificadas** (ver el cierre de esta sección). Dos
de ellas **no se aplicaron como estaban escritas**, porque al ir a hacerlo aparecieron datos que este
documento no tenía. Se registran así, y no reescritas, porque el diagnóstico equivocado es parte de
lo que hay que recordar.

### A · Subagentes

La restricción **no estaba donde §3.A suponía**, ni donde se dijo en un primer momento al aplicarla
(«se cambia en `/config`»): en `/config` **no existe ninguna fila** que gobierne el `Agent tool`.

**Dónde está de verdad**: la frase «*Do not call the AgentTool unless the user requested it*» viene
**compilada en el binario del CLI** (offsets `228975344` y `228975424` de la versión 2.1.220) y se
añade al prompt según **el template con el que se lanza la sesión**. Las sesiones de segundo plano
—`claude --bg`, `/background`, la vista de agentes— usan el template `bg`, que la incluye.

La evidencia está en `~/.claude/jobs/*/state.json` y encaja con las cifras de §0:

| Job | Template | Ventana | Tareas por subagente en esa ventana |
|---|---|---|---|
| — (sesión normal) | — | 07-24 → 07-25 | fases 3 y 4: **19** y **23** |
| `4b94cd2e` «spec-006» | `bg` | **2026-07-25 → 2026-08-01** | fases 5 a 8: **2 · 1 · 5 · 0** |

El desplome no fue una deriva de criterio: coincide **exactamente** con el momento en que el trabajo
se mudó a un job de segundo plano.

**Consecuencia práctica, y es buena**: la instrucción es condicional —*unless the user requested it*—.
Basta con pedir la delegación en el propio prompt («implementa la `007` delegando en `frontend` y
`backend`») para que un job de segundo plano vuelva a usarlos. La alternativa es hacer el trabajo de
implementación en una sesión normal, no en `--bg`.

Y lo que el repositorio sí puede hacer es **medirlo**: `.claude/hooks/delegation-watch.py` registra
toda escritura en territorio de subagente con el agente que la hizo, y avisa una vez por sesión
cuando la hace el principal. No bloquea, a propósito. Verificado en vivo: el aviso llega y la línea
se registra.

### B · Las tres skills inejecutables

El diagnóstico se quedaba corto. Además del `disable-model-invocation: true` del *frontmatter*,
las tres estaban **apagadas por `skillOverrides` en `settings.local.json`**, junto con otras siete.
Arreglar solo el *frontmatter* no habría encendido ninguna. Ahora las 15 están disponibles, y
`zustand` y `playwright` llevan además disparadores en su `description`: describían la librería pero
no decían **cuándo** invocarla.

### C · La poda — **no se hizo, y §2.3 no se sostiene**

§2.3 concluye que «las 15 skills no se usaron prácticamente nunca». El contador dice otra cosa: las
**diez** skills con cero invocaciones son **exactamente las diez apagadas** en la configuración, y
las cinco encendidas se usaron todas. Ese cero es el mismo defecto que §1.3 persigue —**un cero de un
instrumento desconectado es indistinguible de uno real**—, esta vez dentro del propio retro.

Podar sobre esa base habría sido borrar diez skills, todas de este stack, por un dato que no medía
nada. En su lugar: se encendieron las 15 y se instrumentó la medición
(`.claude/hooks/log-skill-usage.py` → `.claude/skill-usage.jsonl`), que registra skill, agente y
sesión. La poda se decide en la próxima retrospectiva, con datos de este repositorio.

Lo que sí se resolvió es la **duplicación** que §2.3 señalaba bien: el método vivía en `CLAUDE.md`,
en las skills genéricas y en tres copias casi idénticas dentro de los agentes. Ahora vive en cuatro
skills propias —`spec-driven-development`, `test-driven-development-tdd`, `stop-and-report`,
`verification-and-measurement`—, los agentes conservan perfil, puertas y anexo, y `CLAUDE.md` apunta.
Cambiar una regla toca **un** archivo. Y como el método está en skills y `.claude/` pasó a estar
versionado, el montaje viaja con el repositorio.

### D · La cota a la documentación

`IMPLEMENTATION.md`: **3.317 → 94 líneas**. `specs/README.md`: **37 KB → 4 KB**, una línea por spec.
Las 3.030 líneas de detalle se movieron **literales** al `CHANGELOG` de cada spec, con su
procedencia; el recuento total de líneas se conserva. No se podó nada al moverlo: lo que resulte
duplicado se recorta cuando se tengan los dos textos delante, que es la regla de §2.5.

### E, F, G · Ya estaban en los agentes, ahora están en las skills

La pregunta de la mutación (E) es un campo de la anatomía de una tarea en
`test-driven-development-tdd`. La regla de la fuente secundaria (F) y el calibrado de cuánta spec se
escribe por adelantado (G) están en `verification-and-measurement` y `spec-driven-development`.

### Y lo que la regla F cazó en cuanto se aplicó

§4 daba por «pendiente real» la verificación negativa de CI de `T-026` de la `001` y por «nota falsa
sin corregir» la del run `30139345799`. Comprobado contra `gh run view`, que es la fuente primaria:

- La nota **era falsa**, confirmado: ese run murió en `Typecheck` y dejó los pasos de test en
  `skipped`. No demuestra nada sobre ellos.
- Pero el **pendiente ya no existía**: el run `30711094472` (2026-08-01, `main`) está verde de punta a
  punta, con `Apply Prisma migrations`, `Unit tests`, `API e2e tests`, `Build` y `Web e2e tests` en
  verde. `T-026` pasa a `[x]`. Llevaba desde el 25 de julio marcada como bloqueada.
- Y la mitad negativa está **mejor cubierta de lo que decía**: el run `30143727278` falló exactamente
  en `Web e2e tests`. Lo único que ningún run ha mostrado todavía es un `Unit tests` o un
  `API e2e tests` en rojo.

Tres datos de seguimiento citados durante meses, tres corregidos con un comando.

### Lo que aún no puede darse por verificado

Aplicar no es verificar. Esto es lo que queda, y por qué ningún comando de hoy puede cerrarlo:

- **A · Que los subagentes vuelvan a ejecutar.** La parte del repositorio está hecha y probada, pero
  el interruptor vive en `/config` y lo acciona el usuario. **La prueba es la primera tarea de la
  próxima spec**: si `delegation.jsonl` registra `frontend`/`backend` y no `main`, el mecanismo está
  de vuelta; si registra `main`, sigue apagado y ahora se ve.
- **C · La poda de skills.** Deliberadamente aplazada: no se poda sobre un cero de instrumento
  desconectado. Se decide en la próxima retrospectiva con `skill-usage.jsonl` delante. Hasta entonces
  esta oportunidad está **convertida en una medición**, no resuelta.
- **E, F y G · Las reglas nuevas.** Están escritas en las skills, pero **ninguna spec se ha
  planificado ni ejecutado todavía bajo ellas**. Que un agente cargue su skill obligatoria y pare
  cuando no esté disponible es, hoy, una afirmación sin corrida que la respalde.
- **La instrumentación misma.** Se ha demostrado que **dispara**; no ha producido todavía ni un solo
  dato de trabajo real. Las dos primeras líneas útiles de cada log llegarán con la próxima feature.

Lo honesto es dejarlo así: cinco de las siete oportunidades tienen evidencia hoy; las otras dos y las
tres reglas nuevas la tendrán —o no— cuando se implemente la `007`. **Se declara lo que ningún
comando de este repositorio puede cubrir hoy, en vez de escribir una comprobación que finja lo
contrario.**
