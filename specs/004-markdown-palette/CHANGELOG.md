# Changelog — Spec 004 Paleta de elementos markdown insertables

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.1.1 — 2026-07-28

**Patch: la spec pasa de `draft` a `approved`.** El usuario resolvió las **seis** decisiones abiertas
de §8, **las seis en la opción recomendada**. Es un patch y no un minor porque **no añade alcance**:
ningún AC cambió de redacción, ningún artefacto entró ni salió, ninguna tarea se movió. **El recuento
se mantiene en 34 AC y 10 tareas.**

| Decisión | Elegida | Efecto sobre el alcance |
|---|---|---|
| **A** — selección al insertar sin selección previa | Plantilla completa con el **marcador de posición preseleccionado** | Ninguno: AC-1…AC-15 ya estaban escritos así |
| **B** — `Ctrl`+`Z` sobre una inserción | Se **acepta** la limitación, **con el remedio planificado** (ver abajo) | Ninguno en la `004`. Crea **§9** y asigna trabajo a la `006` |
| **C** — visibilidad de la paleta | **Solo en modo texto** | Ninguno: AC-19 literal |
| **D** — atajos `Ctrl`/`Cmd`+`B`/`I`/`K` | **Los tres**, acotados al foco dentro del `<textarea>` | Ninguno: AC-28 y T-008 literales |
| **E** — tamaño de la tabla | **Fija 3 × 2** | Ninguno: AC-15 literal |
| **F** — anuncio en región viva | **Se incluye**, con el riesgo de doble locución documentado | Ninguno: AC-27 literal |

**Lo único que este patch añade de verdad, y viene por encargo explícito del usuario al resolver la
decisión B.** Se aceptó que la `004` no soporte deshacer nativo, pero **no como una limitación
suelta**: la pila de deshacer propia queda documentada como **trabajo futuro planificable**, en la
nueva **§9 de `spec.md`**, con las tres cosas que pedía el encargo.

- **Qué**: una pila de deshacer/rehacer **propia del editor**, en el store, **por documento**, que
  cubra tanto lo tecleado como lo insertado desde la paleta.
- **Por qué**: el problema no es de la paleta, es del **control controlado**. El `<textarea>` recibe
  su `value` del `draft`, así que cualquier cambio que no venga de teclear hace que React reescriba
  el contenido, y esa reescritura **no entra en la pila nativa del navegador**: la invalida. A partir
  de ahí `Ctrl`+`Z` hace algo impredecible en vez de lo que la persona pidió, y **un deshacer que no
  deshace falla justo en el momento en que alguien intenta recuperarse de un error**, que es cuando
  menos margen tiene. Y por escrito, para que nadie lo reproponga: `document.execCommand('insertText')`
  **no es la salida** —está deprecado, **jsdom no lo implementa** (así que obliga a mockear y por
  tanto a **verificar el mock en lugar del comportamiento**), la variante «con respaldo» es peor
  todavía (el respaldo sería lo único que los tests ejercitan, o sea que el camino de producción
  quedaría sin cubrir), y aun funcionando resolvería solo la mitad: no da control sobre la
  granularidad ni sobre la interacción con el guardado.
- **Cómo**: `UndoState` con `past`/`future` de transacciones **dentro de `EditorEntry`** —o sea, en el
  diccionario indexado por `id` que la `003` ya dejó montado—, guardando en cada extremo **texto y
  estado de selección** (un deshacer que restaura el texto y deja el caret al final repite el mismo
  defecto en pequeño). Granularidad: **una inserción de paleta o de atajo = una transacción**; el
  **tecleo se agrupa por ventana de inactividad de ~500 ms**; la **resolución de conflicto** es
  transacción propia que no se funde con nada. El registro va **dentro de `setDraft`**, que sigue
  siendo el único camino de cambio de contenido, así que todo llamante entra en la pila sin saberlo;
  y **deshacer es otro `setDraft`**, con lo que hereda el sucio, el debounce y la coalescencia. Los
  dos umbrales —~500 ms de historial y 1.500 ms de guardado— **no se comparten y no deben igualarse**:
  uno es granularidad de historial y el otro tráfico de red, y atarlos haría que un cambio de política
  de red cambiara en silencio qué significa `Ctrl`+`Z`.
- **Asignado a la spec `006-editor-undo`**, **dependiente de la `005`**. No va dentro de la `004`
  (es un modelo de historial, no una paleta) ni dentro de la `005` (que ya carga con la política de
  desalojo y con la dedup de `open(id)`), y va **después** de la `005` por una dependencia real: la
  pila vive dentro de `EditorEntry` y es la `005` quien decide **cuándo se desaloja una entrada**;
  desalojarla tira su historial. Diseñar la pila antes de que esa política esté fijada es diseñarla
  contra un supuesto. **Una pila por documento, nunca global**: con tabs, un `Ctrl`+`Z` que deshiciera
  un cambio de **otra** pestaña sería un defecto grave y silencioso.

**Restricción que la `005` hereda desde hoy** y que queda anotada también en `plan.md` §7 y en
`specs/README.md`: al decidir su política de desalojo, la `005` debe dejar **escrito y consciente**
que desalojar una entrada **descarta su historial de deshacer**, y decidir si eso es aceptable.

Cambios de archivo de este patch: `spec.md` (cabecera a v0.1.1/`approved`; §8 reescrita como
decisiones **resueltas** conservando el razonamiento original en §8.1; **§9 nueva**; §4 actualizada
en las dos entradas de deshacer y en la de la tabla; renumeradas Verificación → §10 y Trazabilidad →
§11) · `plan.md` (referencia de versión, decisión 6 marcada como resuelta, §7 con la restricción para
la `005`) · `tasks.md` (referencia de versión y nota de que no se mueve nada) · `specs/README.md` ·
`IMPLEMENTATION.md`. **Ni una línea de código.**

## v0.1.0 — 2026-07-28

- Spec inicial (**draft**): `spec.md`, `plan.md`, `tasks.md`. **34 criterios de aceptación**,
  **10 tareas**, todas de `frontend`.

**Alcance decidido y por qué importa.** La `004` toca **exclusivamente `apps/web`**;
`packages/shared` y `apps/api` no reciben ni una línea, y AC-34 lo convierte en algo verificable en
vez de en una intención. El motivo no es que sea cómodo: el servidor guarda el contenido como texto
opaco y no interpreta markdown en ningún punto, y el catálogo es copia de interfaz sin un solo
consumidor de servidor. Poner el catálogo en `packages/shared` habría comprado, a cambio de nada, el
coste que la `002` y la `003` ya pagaron: un cambio en `shared` deja `apps/api` en rojo de
compilación hasta que aterriza la tarea de DTO —así que esas dos tareas no se paralelizan— y el radio
del cambio incluye los **fixtures de test de los dos paquetes**, que se encuentran buscando el
nombre del **tipo** y no el del endpoint. A la `002` se le quedó corta la lista dos veces por eso
(sus v0.4.2 y v0.4.3). Razonamiento completo en `spec.md` §7 y en la decisión 1 de `plan.md`.

**Lo que se hereda de la `003` con instrucciones y queda escrito para que nadie lo «mejore»**:

- La cadena de saneado **no se toca** y la `004` **no añade ningún plugin** de remark/rehype. GFM ya
  renderiza tablas, listas de tareas y tachado, así que lo que la paleta produce es un **subconjunto**
  de lo que la `003` ya renderiza y ya midió. `rehype-sanitize` no es redundante —es la única capa
  que defiende los protocolos de `src`, medido con una mutación— y las capas 1 y 2 siguen sin un rojo
  propio: **una capa no se retira porque ningún test la eche de menos**.
- El **corpus de XSS sí se amplía**, y con AC propio (AC-31): la paleta vuelve alcanzables de un clic
  tres contenedores que el corpus **no visita hoy** —dentro de una valla de código, dentro de una
  celda de tabla y dentro de un elemento de tarea—. Tres cargas nuevas producen doce casos de jsdom
  más el recorrido de Chromium **sin escribir una línea de test**. La guarda de tamaño sube de
  `>= 10` a `>= 15` **en los dos archivos que la afirman**, y `tasks.md` T-009 lo señala como el
  error concreto que esa tarea existe para no cometer.
- El **cupo de `documentContent` no se neutraliza** (la suite resetea `workspace` y `login`, nunca
  ese). Política del proyecto: **gastar menos, no neutralizar más**. Por eso el caso de navegador
  agrupa sus inserciones dentro de una sola ventana de debounce y fuerza **un** guardado (AC-33).
- La deduplicación de `GET /documents/:id` sigue asignada a la **`005`** y la `004` no la toca.

**Decisión técnica que corrige un supuesto de la `003`.** La `003` §4 daba por hecho que la paleta
usaría `setRangeText`. **No lo usa** (decisión 3 de `plan.md`): `setRangeText` muta el `value` del
DOM por fuera de React y en un `<textarea>` controlado el render siguiente lo pisa. El camino limpio
es calcular la cadena nueva → `setDraft` → restaurar la selección en un `useLayoutEffect`. Esto no es
un detalle de implementación: React documenta que un control controlado al que se le asigna un valor
distinto de `e.target.value` **manda el caret al final**, así que sin la restauración explícita cada
inserción tiraría a la persona al final del documento. De ahí que AC-21 sea un AC propio y afirme
`selectionStart`/`selectionEnd` **reales del DOM**, no lo que devolvió el núcleo.

**Arquitectura**: núcleo puro (`markdown-insert.ts`, tres familias y un despacho) separado del
adaptador de React, con guarda automática de pureza por lectura del código fuente (AC-17, mismo
patrón que `no-dangerous-html.test.ts`). El catálogo es **datos**, no código: 14 elementos, y AC-18
pone en rojo el que se añada sin cubrir.

**Accesibilidad con AC propios** (AC-24 a AC-29): `role="toolbar"` con grupos, **roving tabindex**
—una sola parada de tabulación para catorce botones—, flechas y `Home`/`End` con movimiento **real**
del foco, región viva propia que no se anida con la de guardado, orden de tabulación con la paleta
**antes** del área de texto, y tamaño de objetivo ≥ 24 × 24 px (WCAG 2.2 SC 2.5.8) medido en Chromium
porque jsdom no calcula disposición.

**Seis decisiones abiertas** en `spec.md` §8 (A-F), que el usuario debería resolver antes de aprobar:
qué queda seleccionado al insertar sin selección; aceptar que `Ctrl`+`Z` no deshaga una inserción de
la paleta; que la paleta solo se vea en modo texto; incluir los atajos `Ctrl`/`Cmd`+`B`/`I`/`K` pese
a que pisan atajos del navegador; el tamaño fijo 3 × 2 de la tabla; y el anuncio en región viva tras
insertar. Cada una con la opción recomendada y su motivo.

**Alcance devuelto a quien lo asignó**: la `003` había puesto «deshacer agrupado» en esta spec. La
`004` lo declina con motivo (`spec.md` §4 y decisión 6 de `plan.md`): la única forma de conservar la
pila nativa desde un `<textarea>` controlado es `document.execCommand('insertText')`, que está
deprecado y que **jsdom no implementa**, así que adoptarlo obligaría a mockearlo en todos los tests
de componente —verificar el mock en vez del comportamiento—. Un `execCommand` con respaldo sería
peor: el respaldo sería lo único que los tests ejercitan.
