# Registro de defectos de One Markdown

Cada regla del método salió de un defecto real. Este documento los conserva con la forma exacta que
tomaron **aquí**, porque una regla sin su historia se obedece a medias: «comprueba que el comando de
verificación ejecute algo» suena a burocracia hasta que se lee que tres comandos reales salían con
`No test files found` y nadie lo notó durante dos specs.

**Por qué vive aquí y no dentro de los ficheros de agente.** Los agentes pasan a ser **generados**
desde `showi.yml` y las plantillas del repositorio del método. Este registro es del proyecto, no del
método: no se genera nunca, no se porta, y sobrevive a cualquier `showi update`. Un proyecto nuevo
empieza este documento vacío y lo llena con lo suyo.

Léelo antes de la primera tarea de una sesión. Sirve para reconocer un defecto rápido, no para
memorizarlo.

---

## 1 · Los seis casos del contrato de parada

Los seis casos los define la skill `stop-and-report`. Esto es cómo se manifestaron en este
repositorio, por territorio cuando difieren.

### Caso 1 · La lista de artefactos se queda corta

Ocurrió **6 veces** (specs `002` ×2, `004`, `005`, `006` ×2), y siempre por lo mismo: olvidar lo que
**construye un valor del tipo**, no lo que lo consume.

- **Compartido**: en la `002`, dos veces seguidas, por olvidar los *fixtures* de test **de los dos
  paquetes** al ampliar un tipo compartido.
- **Frontend**: la última, un *fixture* de test construía un `EditorEntry`, así que añadir un campo al
  tipo lo rompía.

### Caso 2 · El comando de verificación no ejecuta nada

**Tres** comandos `DONE` de la spec `005` con la forma `test "A|B"`. El filtro de Vitest 4 es
**subcadena, no expresión regular**: los tres salían con `No test files found` y en verde.

### Caso 3 · Un criterio inalcanzable, o cierto por corrida y falso bajo su propio comando

- **Frontend**: `AC-26` de la `004` era literalmente inalcanzable — entre los dos elementos que
  mandaba ordenar había un tercero.
- **Backend**: `AC-33` de la `004` exigía una cifra de cupo y mandaba medirla con un comando que
  **triplicaba el gasto dentro de la misma ventana** del limitador. Fue cierto por corrida y falso
  bajo su propio comando de verificación durante dos specs.

> **Regla de este proyecto que salió de aquí**: el reset de un contador de *rate limit* se hace en los
> **límites** de un caso, nunca a mitad de una secuencia de agotamiento — y **jamás en la suite del
> API**, donde destruiría la única prueba de que los límites existen.

### Caso 4 · Un requisito que vive fuera de todo criterio

«Todo objetivo interactivo ≥ 24 × 24 px» estaba en `plan.md` y en la tarea, **pero sin AC**. Por ese
hueco se coló un control de **19,73 × 20 px**.

### Caso 5 · El RED predicho no es el que ocurre

El RED predicho para `T-011` de la `004` no era el real: los dos subcasos colgaban de la misma
precondición ausente, así que fallaban juntos y por una razón distinta de la que la tarea anunciaba.

### Caso 6 · Una aserción que pasa con el artefacto sin tocar

En la `006`, un caso de deshacer/rehacer afirmaba que el texto volvía a la inserción — cierto también
si ninguna de las dos operaciones hacía nada. **Pasaba en verde con la página sin tocar.**

---

## 2 · Las once reglas del método, y de dónde salió cada una

| Regla | De dónde salió |
|---|---|
| Ningún requisito vive solo en el plan | «Objetivos ≥ 24 × 24 px» estaba en `plan.md` y en la tarea pero **sin AC**; por ese hueco se coló un control de **19,73 × 20 px** (spec `005`). |
| Ningún número escrito a mano | `AC-30` de la `005` decía «cinco» al lado de una enumeración de **seis**. La `004` contó **14** elementos donde había **16**. |
| Toda cifra con su ventana | `AC-33` de la `004` fue **cierto por corrida y falso bajo su propio comando** de verificación durante dos specs. |
| Artefactos completos | La lista se quedó corta **6 veces** (`002` ×2, `004`, `005`, `006` ×2), siempre por olvidar lo que **construye un valor del tipo**. |
| Córrelo antes de escribirlo | **Tres** comandos `DONE` de la `005` con `test "A\|B"`: el filtro de Vitest 4 es **subcadena, no regex**, y salían con `No test files found`. |
| Valida el instrumento | Un `pico=0` que venía de un `redis-cli` **inexistente** · un «cero 429» de una suite que **no ejecutó ni un caso** · una nota de seguimiento que afirmaba una verificación que **nunca ocurrió**. |
| De uno en uno | Se borró la carpeta de compilación de un paquete **en paralelo** con la suite que la usaba, y la medición salió limpia y falsa. |
| Rojo ancho por hambre de máquina | Un caso declaró **7.085 ms** y murió con «timeout de 5.000 ms» corriendo tres paquetes a la vez; solo, el paquete pasaba en 10 s. |
| Decidir antes de `tasks.md` | La elección entre guardar el texto entero o solo el cambio (spec `006`) se cerró con la aritmética delante **antes** de escribir tareas, y sostuvo la implementación entera sin una corrección. |
| Las formas exactas, después | `plan.md` de la `006` fijó la forma de un valor que resultó irrelevante, y corregirlo obligó a razonar que normalizarlo habría añadido una rama que **solo su propio test ejercitaría**. |
| Si te ves implementando, dilo | En la spec `006` el orchestrator implementó **las 10 tareas** porque la configuración impedía usar subagentes. Salió bien, y aun así se perdió el mecanismo que en la `005` encontró **cinco** defectos. |

---

## 3 · Defectos del propio harness

No solo el producto tiene defectos. Estos son los del montaje que vigila al producto, y son los que
más caro salen porque desactivan la vigilancia sin avisar.

| Defecto | Cómo se manifestó |
|---|---|
| Un cero que no medía nada | Se concluyó que «las skills no se usan» a partir de un contador que valía cero **porque las skills estaban apagadas en la configuración**. Las diez con cero invocaciones eran exactamente las diez apagadas. De aquí salió `hooks/log-skill-usage.py`. |
| Delegación impedida en silencio | `CLAUDE.md` manda delegar, pero la instrucción «no uses el Agent tool salvo que el usuario lo pida» viene **compilada en el CLI** y se inyecta en sesiones de segundo plano. Una spec entera se implementó sin contrato de parada y no se notó hasta la retrospectiva. De aquí salió `hooks/delegation-watch.py`. |
| El método equivocado fuera de Claude Code | `.agents/skills/` —que leen Cursor, Copilot, opencode y Codex— contenía las versiones **de terceros y en inglés** de `spec-driven-development` y `test-driven-development-tdd`, y **no contenía** `stop-and-report` ni `verification-and-measurement`. El script de limpieza de `.claude/README.md` no lo veía porque solo miraba `.claude/`. Es lo que motivó extraer el harness a un repositorio propio con una sola fuente para las seis herramientas. |
| Un lock que miente | `skills-lock.json` registraba 15 skills cuando había 17, y dos entradas apuntaban a los orígenes de terceros que el método propio ya había reemplazado. |
