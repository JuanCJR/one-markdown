# El harness: cómo está hecho y cómo se lleva a otro proyecto

Todo lo de esta carpeta está versionado a propósito —agentes, skills, hooks y `settings.json`— para
que el proyecto se maneje igual con independencia de quién lo abra. Solo quedan fuera del control de
versiones la medición que se genera sola (`skill-usage.jsonl`) y los *overrides* personales
(`settings.local.json`).

## Las tres piezas

| Pieza | Qué es | Al portar |
|---|---|---|
| `skills/` de método | **El método.** Cuatro skills, escritas sin nombrar este proyecto | **Se copian tal cual** |
| `skills/` de stack | Guías de las tecnologías concretas (de terceros) | Se sustituyen por las del stack nuevo |
| `agents/` | Quién es cada agente, dónde trabaja, qué skills le tocan | §1 se sustituye |
| `hooks/` | Instrumentación: mide lo que de otro modo se cree por fe | Se copian tal cual |

## El método está en las skills, no en los agentes

Las cuatro skills de método son la **única** fuente de verdad:

| Skill | Qué posee |
|---|---|
| `spec-driven-development` | Los documentos de una feature, el versionado semántico, las reglas de redacción de criterios, y cuánta spec conviene escribir por adelantado. |
| `test-driven-development-tdd` | El ciclo, la regla del andamio, la anatomía de una tarea, el radio de un cambio y la verificación por mutación. |
| `stop-and-report` | Los seis casos en que quien ejecuta para y avisa, las comprobaciones previas a delegar, y qué hace quien recibe el reporte. |
| `verification-and-measurement` | Validar el instrumento antes que el dato, correr de uno en uno, y no citar el seguimiento sin comprobarlo. |

Antes vivía en los tres archivos de `agents/`, en tres copias casi idénticas. Ahora cada agente
declara **qué skills son obligatorias para él** y lista sus puertas por nombre; las definiciones son
de la skill. Cambiar una regla toca **un** archivo.

**La contrapartida, y cómo se cubre**: un agente que no cargue su skill perdería el método sin que
nadie se entere. Por eso los tres agentes tienen escrito que **si una skill obligatoria no está
disponible, paran y avisan antes de empezar**. Convierte un fallo silencioso en una parada visible,
que es el mecanismo que este montaje entero existe para proteger.

## Los agentes

`orchestrator` especifica, planifica, delega y verifica. `frontend` y `backend` solo ejecutan tareas
ya especificadas, en TDD, dentro de su territorio. Cada archivo tiene:

| Sección | Contenido | Al portar |
|---|---|---|
| §1 Perfil | Dominio, stack, rutas, comandos, skills de stack, reglas de la casa | **Se sustituye entero** |
| §2 en adelante | Skills de método obligatorias, puertas, rol | **No se toca** |
| Anexo | Un enlace a `docs/harness/defectos.md` | **No se toca** |

El **registro de defectos** existe porque una regla sin su historia se obedece a medias. «Comprueba que
el comando de verificación ejecute algo» suena a burocracia hasta que se lee que tres comandos reales
salían con `No test files found` y nadie lo notó.

Vive en **`docs/harness/defectos.md`**, fuera de los ficheros de agente, porque esos ficheros pasan a
ser **generados** desde `showi.yml` y un `update` se lo llevaría por delante. El registro es del
proyecto, no del método: no se genera, no se porta, y un proyecto nuevo lo empieza vacío.

## La instrumentación

Dos hooks, y los dos existen por la misma razón: **el retro anterior se equivocó dos veces creyendo
ceros de instrumentos desconectados**. Ninguno bloquea nada, y ninguno falla hacia fuera: ante una
entrada inválida salen 0 y dejan pasar la llamada. Un hook que rompe una llamada cuesta más que el
dato que recoge.

### `hooks/log-skill-usage.py` — qué skills se usan de verdad

`PostToolUse`, matcher `Skill`. Anexa a `skill-usage.jsonl`: instante, skill, agente (`main` o el
tipo de subagente) y sesión.

Existe porque se concluyó que «las skills no se usan» a partir de un contador que valía cero
**porque las skills estaban apagadas en la configuración**. Las diez con cero invocaciones eran
exactamente las diez apagadas: ese cero no medía nada.

```bash
python3 -c "import json,collections;print(collections.Counter(json.loads(l)['skill'] for l in open('.claude/skill-usage.jsonl')))"
```

### `hooks/delegation-watch.py` — quién escribe el código de producción

`PreToolUse`, matcher `Write|Edit|NotebookEdit`. Registra en `delegation.jsonl` toda escritura bajo
los territorios delegables (`apps/web/`, `apps/api/`, `packages/shared/` — sustituir al portar) con el
agente que la hizo, y **avisa una vez por sesión** cuando quien escribe es el agente principal.

Existe porque `CLAUDE.md` manda delegar y **la configuración de sesión puede impedirlo, en silencio**.
Cuando eso pasó, una spec entera se implementó sin contrato de parada y nadie lo notó hasta el retro.
No bloquea a propósito: bloquear estorbaría en arreglos triviales, y el retro premia parar y avisar,
no impedir. Un aviso por sesión, porque un aviso repetido es ruido y el ruido se ignora.

```bash
# ratio de delegación
python3 -c "import json,collections;print(collections.Counter(json.loads(l)['agent'] for l in open('.claude/delegation.jsonl')))"
```

**La configuración que apaga los subagentes no está en el repositorio, ni en `/config`**: la
instrucción «no uses el Agent tool salvo que el usuario lo pida» viene **compilada en el CLI** y se
añade al prompt cuando la sesión se lanza en **segundo plano** (`claude --bg`, `/background`, vista de
agentes; `template: "bg"` en `~/.claude/jobs/<id>/state.json`).

Dos formas de recuperarla, y la primera cuesta una frase:

1. **Pedir la delegación explícitamente en el prompt** — la instrucción es condicional, *salvo que el
   usuario lo pida*, así que basta con pedirlo: «implementa la `007` delegando en `frontend` y
   `backend`».
2. **Hacer la implementación en una sesión normal**, no en segundo plano.

Este hook no revierte nada; solo hace visible cuál de los dos casos está ocurriendo.

## Portar a otro repositorio

1. Copia `skills/` **de método** (las cuatro) y `hooks/` tal cual; en `delegation-watch.py` ajusta la
   constante `TERRITORIOS` a las rutas del proyecto nuevo.
2. Copia los tres agentes y reescribe **§1** de cada uno: stack, rutas, comandos, reglas de la casa.
3. Sustituye las skills **de stack** por las de la tecnología nueva, y actualiza la tabla de §1.
4. **Empieza `docs/harness/defectos.md` vacío.** El enlace del Anexo de los tres agentes no se toca;
   lo que cambia es el contenido del documento, que se llena con los defectos del proyecto nuevo
   cuando ocurran.
5. Ajusta el `description` del *frontmatter* de cada agente: es lo que decide cuándo se invoca.
6. Si los territorios cambian —no hay backend, o hay tres frontends—, ajusta la tabla de agentes de
   `orchestrator.md` §1 y borra o duplica archivos.
7. Copia el bloque `hooks` de `settings.json`.

**No edites §2 en adelante de los agentes, ni el cuerpo de las skills de método.** Si te ves
haciéndolo, o algo del proyecto se coló donde no debía, o has encontrado una mejora del método — y
entonces se mejora en la skill, que es donde vive.

## Comprobación de que la capa portable sigue limpia

El método no debe nombrar el proyecto ni su stack:

```bash
for f in .claude/skills/{spec-driven-development,test-driven-development-tdd,stop-and-report,verification-and-measurement}/SKILL.md; do
  echo "== $f"
  awk 'NR>1 && /^---$/{p=1;next} p' "$f" \
    | grep -nEi 'one.markdown|apps/(web|api)|packages/shared|vitest|jest|playwright|nestjs|prisma|zustand|react|pnpm|IMPLEMENTATION' \
    || echo "  limpio"
done
```

Si sale una línea, es una fuga: el método está hablando de este proyecto y al portarlo mentirá.
Ignora el `metadata.origin` del *frontmatter*: es procedencia, no contenido.

## Lo que conviene saber y no está en ningún archivo del harness

- **Una skill o un MCP apagados en `settings*.json` no se pueden invocar** aunque un agente los
  declare obligatorios. Ese cruce hay que comprobarlo, no suponerlo: es exactamente el defecto que
  dejó tres skills muertas durante siete specs.
- **Que exista un agente no significa que se vaya a usar.** Si la configuración de sesión impide
  lanzar subagentes, el orchestrator acabará implementando él, y el contrato de parada —donde vive
  casi todo el valor de este montaje— no lo cumplirá nadie. Esa configuración **no está en el
  repositorio**: se cambia en `/config`.
