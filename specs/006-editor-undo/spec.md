# Spec 006 — Pila de deshacer/rehacer propia del editor

- **Versión**: 0.1.1
- **Estado**: **approved** (2026-07-29) — **36 AC** en seis bloques y **10 tareas**
  (`T-000`…`T-009`), **ocho de `frontend`** y dos de `orchestrator` — `T-000`, que no toca código,
  y `T-009`, la de cierre, que solo edita `specs/**` e `IMPLEMENTATION.md`.
  **Las cuatro decisiones de §9.1 quedaron resueltas el 2026-07-29, las cuatro en la opción
  recomendada**, así que ningún AC cambia de redacción y ningún artefacto entra ni sale.
  **`T-000` está hecha y verificada** (la `004` queda en **v0.3.1**); **las nueve tareas de código
  siguen sin empezar**, en espera de la señal de arranque del usuario.
  **Convenio de versionado al aprobar, por consistencia con las specs `001` a `005`**: aprobar **no**
  salta a 1.0.0 y **no** sube la versión — lo que cambia es el `Estado`. La v0.1.1 sube por el
  contenido de §9.1, no por la aprobación
- **Fecha**: 2026-07-29 (v0.1.0 draft) · **v0.1.1 el 2026-07-29**: se resuelven las cuatro decisiones
  abiertas. **Es patch y no minor porque el recuento no se mueve**: siguen **36 AC** y **10 tareas**,
  ningún AC cambia de redacción y ningún artefacto entra ni sale — mismo criterio con el que la
  v0.1.1 de la `004` y la v0.1.1 de la `005` se justificaron como patch
- **Depende de**: `005-tabs-split-view` (complete, v0.2.1) · `004-markdown-palette` (complete,
  **v0.3.1**, enmendada por esta spec) · `003-editor` (complete, v0.2.0) · `002-workspace-tree` · `001-auth` · `000-foundation`

---

## 0. Alcance en una línea, y la decisión que lo fija

**Esta spec toca exclusivamente `apps/web`.** `packages/shared` y `apps/api` no reciben ni una línea,
y §8 lo razona. Depende por entero de una decisión que la `005` ya tomó por ella (§6.3 de aquella):
**el historial no se persiste ni sobrevive al cierre de una pestaña**, así que no hay tabla, ni
migración, ni DTO, ni tipo compartido. Es la tercera spec seguida sin una sola tarea de `backend`.

**Y es la primera spec del proyecto que no añade producto.** Con la `005` cerrada, las cinco
capacidades del párrafo de cabecera de `CLAUDE.md` están implementadas. Esta arregla algo que hoy
está **roto**, que el proyecto decidió a sabiendas no arreglar todavía, y que dejó escrito con
destinatario: `004/spec.md` §9.

---

## 1. Contexto y problema

### 1.1 El problema, y quién lo causa

Hoy, en el editor, `Ctrl`+`Z` deshace **lo tecleado** y hace algo impredecible con **cualquier otra
cosa**: una inserción de la paleta, un atajo `Ctrl`+`B`/`I`/`K`, o la adopción del texto del servidor
al resolver un conflicto.

**No lo causa la paleta de la `004`. Lo causa el control controlado, que existe desde la `003`.** El
`<textarea>` del editor recibe su `value` del `draft` del store
(`DocumentEditorPage.tsx`: `value={entry.draft}`). Cada vez que un cambio **no** viene de teclear —es
decir, cada vez que el programa asigna un valor distinto de `event.target.value`— React reescribe el
contenido del elemento, y esa reescritura **no entra en la pila nativa del navegador**: la invalida.
A partir de ahí la pila nativa deja de describir el historial real del documento, y `Ctrl`+`Z`
restaura un estado anterior a la inserción, deshace dos pasos, o no hace nada.

La consecuencia está **aceptada por escrito** desde el 2026-07-28 (decisión **B** de la `004`), y se
aceptó a condición de que el remedio quedara planificado en vez de convertirse en una nota al pie.
Esta spec es ese remedio.

**Un deshacer que no deshace es de los defectos que peor se toleran**: no falla de forma visible,
falla en el momento exacto en que alguien intenta recuperarse de un error, que es cuando menos margen
tiene.

### 1.2 Lo que ya está decidido y esta spec **no** vuelve a discutir

Está en `004/spec.md` §9 y en `005/spec.md` §6.3. Se resume aquí porque cada punto condiciona un AC,
no por cortesía:

1. **`document.execCommand('insertText')` no es la salida.** Deprecado; **jsdom no lo implementa**,
   así que adoptarlo obliga a mockearlo y a verificar el mock en vez del comportamiento; y la
   variante «con respaldo» es peor, porque el respaldo sería lo único que los tests ejercitan. La
   salida honesta no es recuperar la pila del navegador: es tener una propia.
2. **La pila vive dentro de `EditorEntry`, una por documento y nunca global.** Con pestañas, un
   `Ctrl`+`Z` global deshaciendo un cambio de **otra** pestaña sería un defecto grave y silencioso.
3. **La política de desalojo ya está fijada y es la cota de vida del historial** (`005` §6.3):
   cambiar de pestaña **no** desaloja —así que la pila sobrevive a los saltos, que es el gesto
   frecuente— y cerrar **sí**, así que **cerrar pierde el historial**. Aceptado con sus tres razones.
   **Consecuencia directa: esta spec no necesita expulsión por tiempo, ni serialización, ni cota de
   vida propias.** La cota de **memoria** es otra cosa y sí es suya: §2.
4. **Los dos umbrales no se comparten y no deben igualarse**: ~500 ms es granularidad de historial;
   1.500 ms es tráfico de red. Atarlos haría que un cambio de política de red cambiara en silencio
   qué significa `Ctrl`+`Z`.
5. **`Ctrl`+`W` está descartado con motivo**: es atajo reservado del navegador y una página no puede
   interceptarlo. La lista de los que **no** lo son está en §9.2, riesgo #2, con la regla que la
   genera; los que esta spec usa se comprueban en un navegador de verdad (AC-33) y no de memoria.
6. **Precedente de atajos**: `Ctrl`+`S` va en la **ventana** porque guardar es una acción de la
   página; `Ctrl`/`Cmd`+`B`/`I`/`K` van acotados al **foco dentro del `<textarea>`** porque solo
   significan algo donde se escribe. `Ctrl`+`Z` es de la segunda clase.

### 1.3 Una precisión sobre el código real que §9 de la `004` no podía tener delante

`004/spec.md` §9.3 dice que el registro va «**dentro** de `setDraft` —que sigue siendo el único
camino que cambia el contenido—». **Leído contra `editor.store.ts`, eso es cierto para la interfaz y
falso para el store.** `setDraft` es el único camino por el que la **página** cambia el contenido,
pero el propio store escribe `draft` en otros tres sitios, y hay que decidir qué hace cada uno:

| Dónde | Qué le hace al `draft` | Qué le hace a la pila |
|---|---|---|
| `readDocument` (dentro de `open`) | lo **crea**, igual a lo del servidor | nace vacía; no hay nada que registrar |
| `resolveKeepMine` | escribe `draft: mine`, que es **el mismo valor** que ya tenía | **nada** (AC-22) |
| `resolveTakeServer` | lo **sustituye entero** por el del servidor | la **vacía**, `past` y `future` (AC-21) |

No es un hueco de la `004`: es lo que pasa al escribir el enfoque sin el archivo delante. Queda aquí
porque las tres filas son AC, y porque «registrar dentro de `setDraft`» sin esta tabla dejaría
`resolveTakeServer` sin decidir — que es justo el caso que §9.3 marcaba como el más peligroso.

---

## 2. La decisión que más condiciona esta spec: qué guarda una transacción

`004/spec.md` §9.3 propone guardar **el texto completo** en los dos extremos de cada transacción, y
un límite de profundidad de «p. ej. 200 transacciones». **Se rechazan las dos cosas, y por la misma
aritmética.**

### 2.1 La aritmética de las instantáneas completas

`MAX_DOCUMENT_CONTENT_CHARS` son **200.000 caracteres** (`packages/shared/src/index.ts`, espejado en
`apps/api/src/workspace/workspace.constants.ts`). Una cadena de JavaScript es UTF-16, así que una
copia son ~400 KB. Una entrada del store **ya guarda dos**: `savedContent` y `draft` — ~800 KB.

Con instantáneas, el `after` de la transacción N es el mismo objeto-cadena que el `before` de la
N+1, así que N transacciones no retienen 2N cadenas: retienen **N+1 distintas**. Sigue siendo lineal
en N:

- **200 transacciones × 400 KB = ~80 MB por documento.**
- La `005` **no pone cota al número de pestañas abiertas**, así que el total es ese número × M.
- Y el peor caso no es exótico: se llega a 200 transacciones tecleando unos segundos.

Pero el problema de fondo del límite «200 transacciones» es otro, y es el que lo descarta como
criterio: **200 transacciones de un carácter y 200 transacciones que sustituyen el documento entero
son el mismo número describiendo dos mundos que se diferencian en cuatro órdenes de magnitud.** Eso
no es una cota; es una lotería con un número escrito al lado.

### 2.2 El veredicto: **deltas**, con cota **en caracteres**

Cada transacción guarda el **reemplazo mínimo** entre el texto de antes y el de después, más la
selección en los dos extremos:

```ts
/** Un cambio de texto, como el reemplazo mínimo que lo produce. */
interface TextEdit {
  readonly at: number;        // dónde empieza lo que cambió
  readonly removed: string;   // lo que había ahí
  readonly inserted: string;  // lo que hay ahora
}
```

Consecuencias, en orden de peso:

1. **El coste pasa a ser proporcional al volumen de lo editado, no al tamaño del documento
   multiplicado por cuántas veces se tocó.** Teclear un carácter en un documento de 200.000 cuesta
   ~1 carácter de historial, no 200.000.
2. **Escribir un documento entero desde cero cuesta 200.000 caracteres de historial**, es decir
   **menos que la copia extra que la entrada ya guarda hoy**. El caso común deja de necesitar cota.
3. **La inversa es gratis y exacta**: el inverso de `{at, removed, inserted}` es
   `{at, removed: inserted, inserted: removed}`, con el mismo `at`. Deshacer y rehacer son la misma
   operación con el delta al derecho o al revés.
4. **No hace falta ninguna biblioteca de *diff***. Recortar el prefijo y el sufijo comunes de dos
   cadenas es exacto para **cualquier** par —incluida una sustitución total, que produce un delta del
   tamaño del documento, que es lo correcto— y son dos recorridos O(n).

**Sigue haciendo falta una cota, y es honesto decir por qué**: los deltas quitan el caso común, no el
patológico. Seleccionar todo y pegar cuesta `removed + inserted` = **dos veces el documento**, y cien
veces seguidas vuelven a los 80 MB. Así que:

> **La cota se expresa en caracteres, nunca en transacciones.** Con deltas, una transacción puede
> medir 1 o 400.000 caracteres: contar transacciones es contar una unidad que no tiene tamaño.

```ts
/** El historial de un documento nunca cuesta más que **una copia más** del documento más grande
 *  que se admite. Derivado y no escrito, igual que `CONTENT_COUNTER_THRESHOLD`. */
export const UNDO_HISTORY_BUDGET_CHARS = MAX_DOCUMENT_CONTENT_CHARS;
```

El coste de una transacción es `removed.length + inserted.length`, y se cuentan **`past` y `future`
juntos**. Peor caso por pestaña: **tres copias** del documento más grande, ~1,2 MB.

**Qué se tira**: los pasos **más antiguos**, por el extremo viejo de `past`.
**Qué se siente**: `Ctrl`+`Z` retrocede, y en algún punto deja de hacer nada. **Y eso tiene que
verse**, o la cota es indistinguible de una avería: el botón «Deshacer» se deshabilita (AC-28). Esta
es la razón de peso por la que la interfaz de §4.E **no es opcional**, y no la de accesibilidad, que
llega sola después.

**Una excepción, y es la que evita el peor momento posible**: la transacción **más reciente nunca se
desaloja**, aunque ella sola supere el presupuesto (AC-8). Sin ella, pegar 200.000 caracteres vaciaría
la pila incluida la propia transacción de pegar, y `Ctrl`+`Z` no desharía justo lo único que la
persona acaba de hacer.

### 2.3 La consecuencia no obvia de los deltas: cómo se funde un grupo de tecleo

Agrupar el tecleo por ventana de inactividad (§1.2, punto 4) significa **fundir** la pulsación nueva
en la transacción abierta. Con instantáneas eso es trivial —se cambia el `after`—; con deltas hay que
recomponer el delta contra el texto en que **empezó el grupo**, que ya no se guarda.

**No hace falta guardarlo: se reconstruye**, y con la misma operación que ya existe para deshacer:

1. `textoDelInicioDelGrupo = aplicar(borradorActual, invertir(deltaDeArriba))`
2. `deltaNuevo = diferencia(textoDelInicioDelGrupo, borradorNuevo)`
3. se sustituye la transacción de arriba conservando su `before` y tomando el `after` nuevo.

Cuesta dos recorridos O(n) por pulsación **mientras hay un grupo abierto** —con el documento en el
límite, ~200.000 comparaciones de carácter: fracciones de milisegundo— y **no retiene ni una cadena
extra**. La alternativa (guardar el ancla del grupo abierto) retendría una copia más, transitoria; se
descarta porque una copia transitoria de 400 KB es exactamente lo que esta sección existe para no
tener, y porque el camino de reconstrucción **es el mismo código que deshacer**, así que ya está
cubierto por sus propios tests.

**Y hay un estado más, pequeño y necesario**: `openedAt`, el instante de la última pulsación del grupo
abierto, o `null` si no hay ninguno. Vive **dentro de `UndoState`**, no en un `Map` de módulo — lo que
importa por la razón de §6, punto 5. Lo pone a `null` todo lo que cierra el grupo: una inserción, un
deshacer, un rehacer y la resolución de un conflicto.

### 2.4 La forma completa del estado

```ts
interface Caret { readonly start: number; readonly end: number }

interface UndoTransaction {
  readonly edit: TextEdit;
  readonly before: Caret;   // dónde estaba el cursor antes
  readonly after: Caret;    // dónde queda después
}

interface UndoState {
  readonly past: readonly UndoTransaction[];
  readonly future: readonly UndoTransaction[];
  /** `removed.length + inserted.length` acumulado de `past` **y** `future`. Es lo que acota. */
  readonly cost: number;
  /** Instante de la última pulsación del grupo de tecleo abierto, o `null` si no hay ninguno. */
  readonly openedAt: number | null;
}
```

`kind` **no** es un campo de la transacción, al contrario de lo que proponía `004` §9.3. Solo hace
falta saber si la escritura **nueva** puede fundirse, y eso lo dice quien llama, en el momento; una
vez cerrada, a la transacción le da igual de dónde vino. Guardarlo sería guardar un dato que nadie
lee, y el primer test que lo afirmara estaría afirmando el registro y no el comportamiento.

---

## 3. Historias de usuario

- **US-1** — Como persona que escribe, quiero que `Ctrl`+`Z` deshaga **lo último que hice**, sea
  tecleado o insertado desde la paleta, y no algo que no reconozco.
- **US-2** — Como persona que escribe, quiero que deshacer me devuelva **el cursor donde estaba**, y
  no al final del documento.
- **US-3** — Como persona que escribe, quiero **rehacer** lo que acabo de deshacer, mientras no haya
  seguido escribiendo.
- **US-4** — Como persona que escribe una frase de corrido, quiero que un `Ctrl`+`Z` me quite **la
  frase** y no la última letra.
- **US-5** — Como persona que no usa teclado físico, quiero **poder deshacer**: con un control
  visible, no solo con un atajo.
- **US-6** — Como persona que trabaja con varios documentos abiertos, quiero que deshacer afecte
  **al que estoy viendo** y a ningún otro.
- **US-7** — Como responsable del producto, quiero que el historial **no abra un segundo camino de
  cambio de contenido** ni un segundo camino de guardado: deshacer es escribir, y pasa por donde ya
  se escribe.
- **US-8** — Como responsable del producto, quiero saber **cuánta memoria puede costar** el historial
  de una sesión larga con muchas pestañas, con la cuenta hecha y no con una intuición.

---

## 4. Criterios de aceptación

Todo AC es verificable por al menos un test automatizado, y cada uno dice **con qué mecanismo**. La
trazabilidad completa está en §11.

Vocabulario: **transacción** = un paso de deshacer; **grupo abierto** = la transacción de arriba de
`past` mientras admite fundirse con la pulsación siguiente; **coste** = `removed.length +
inserted.length` sumado sobre `past` y `future`.

### A. El núcleo del historial (módulo puro)

- **AC-1** — Para cualquier par de textos `a` y `b` de un corpus que incluya inserción, borrado,
  sustitución en medio, sustitución total, cadena vacía en cada extremo y textos iguales:
  `aplicar(a, diferencia(a, b)) === b` y `aplicar(b, invertir(diferencia(a, b))) === a`.
  **Mecanismo**: `it.each` sobre el corpus en `text-edit.test.ts`.
- **AC-2** — El reemplazo que devuelve `diferencia` es **mínimo**: para dos textos que solo se
  distinguen en un carácter, `removed.length + inserted.length <= 2` **sea cual sea la longitud de
  los textos**. **Mecanismo**: caso con textos de `MAX_DOCUMENT_CONTENT_CHARS` caracteres.
- **AC-3** — Dos escrituras de tecleo separadas por **menos** de la ventana de agrupación producen
  **una** transacción, cuyo `before` es el del primer tecleo y cuyo `after` es el del segundo.
  **Mecanismo**: reducer puro, con el instante pasado como argumento.
- **AC-4** — Dos escrituras de tecleo separadas por **la ventana o más** producen **dos**
  transacciones. **Mecanismo**: igual, con dos instantes.
- **AC-5** — Una escritura marcada como **inserción** nunca se funde: ni con el grupo de tecleo
  abierto aunque caiga dentro de la ventana, ni con otra inserción inmediatamente anterior. Y **cierra
  el grupo**: el tecleo que venga después empieza transacción nueva aunque caiga dentro de la ventana.
  **Mecanismo**: tres casos del reducer.
- **AC-6** — Registrar una escritura **vacía `future`**: tras deshacer y volver a escribir, no queda
  nada que rehacer. **Mecanismo**: reducer.
- **AC-7** — Cuando el coste supera `UNDO_HISTORY_BUDGET_CHARS`, se desalojan transacciones **por el
  extremo antiguo de `past`** hasta volver por debajo, y el coste declarado coincide con la suma real
  de lo que queda. **Mecanismo**: reducer con escrituras grandes y recuento independiente.
- **AC-8** — La transacción **más reciente nunca se desaloja**, aunque ella sola supere el
  presupuesto: tras registrar una escritura mayor que el presupuesto, `past` tiene exactamente **una**
  transacción y deshacer la aplica. **Mecanismo**: reducer.
- **AC-9** — Ni `text-edit.ts` ni `undo-history.ts` mencionan ninguno de los tokens prohibidos
  (`from 'react'`, `react-dom`, `zustand`, `./editor.store`, `document.`, `window.`).
  **Mecanismo**: la guarda de pureza que ya existe en `markdown-palette.test.ts`, con su lista
  ampliada (§7).
- **AC-10** — `UNDO_GROUP_MS` y `AUTOSAVE_DEBOUNCE_MS` son **constantes distintas**, y la de
  historial es **estrictamente menor**. **Mecanismo**: aserción sobre las dos constantes importadas,
  en `undo-history.test.ts` — no hay archivo de constantes propio y no se estrena uno para una sola
  aserción.
  Es lo que garantiza que un paso de deshacer sea siempre ≤ lo que se pierde en un cierre forzado.

### B. El historial en el store, por documento

- **AC-11** — Dado un documento con una inserción registrada, cuando se deshace, entonces el `draft`
  vuelve al texto anterior **y** la acción devuelve la selección que había **antes** de la inserción
  (`start` y `end`, no un cursor colapsado al final). **Mecanismo**: `editor.store.test.ts` para la
  regla, **y un caso de página** en `DocumentEditorPage.test.tsx` que inserta desde la paleta y
  deshace, afirmando `selectionStart`/`selectionEnd` del `<textarea>` — sin él, quitarle las
  selecciones a la llamada de `insertElement` no lo notaría ningún test, porque la regla del store
  seguiría verde con las selecciones que le pasa el caso.
- **AC-12** — Rehacer devuelve el texto y la selección **posteriores** a la transacción deshecha.
  **Mecanismo**: igual.
- **AC-13** — Deshacer y rehacer **no se registran a sí mismos**: tras tres escrituras, tres
  deshacer dejan el texto inicial —y no dos pasos, ni un ciclo entre dos estados—. **Mecanismo**:
  igual.
- **AC-14** — Deshacer con `past` vacío (o rehacer con `future` vacío) **no cambia el `draft`, no
  marca sucio, no programa guardado y devuelve `null`**. **Mecanismo**: igual, contando peticiones
  sobre la red sustituida.
- **AC-15** — Con dos documentos abiertos y escrituras en los dos, deshacer en el primero **no toca**
  el `draft` ni la pila del segundo. **Mecanismo**: igual. Es el AC que hace imposible la pila global.
- **AC-16** — La pila **sobrevive** a `flush(id)` (cambiar de pestaña) y **desaparece** con
  `closeTab(id)` (cerrar), junto con el resto de la entrada. **Mecanismo**: igual. Es la política de
  la `005` §6.3, afirmada aquí en vez de supuesta.
- **AC-17** — Sobre un documento de `MAX_DOCUMENT_CONTENT_CHARS` caracteres, teclear **un** carácter
  deja un historial cuyo `cost` es **menor que 100**. **Mecanismo**: `editor.store.test.ts`. Es el AC
  que hace **medible** la decisión de §2: con instantáneas el valor sería ~400.000.

### C. Guardado, conflicto y la frontera entre los dos

- **AC-18** — Deshacer **cruza la frontera del guardado**: tras un guardado correcto, deshacer deja
  el documento en `dirty` y programa un guardado nuevo, que al vencer el debounce emite **un** `PUT`
  con el texto restaurado. **Mecanismo**: `editor.store.test.ts` con temporizadores falsos y la red
  sustituida.
- **AC-19** — Deshacer hasta el **texto ya guardado** deja el documento en `clean`, cancela el
  guardado programado y **no emite ninguna petición** — que es la rama que `setDraft` ya tiene y que
  deshacer hereda por pasar por ahí. **Mecanismo**: igual.
- **AC-20** — Una **ráfaga** de deshacer (varios pasos dentro de la ventana del debounce) produce
  **una sola** petición. **Mecanismo**: igual, contando peticiones. Es la coalescencia de la `003`,
  heredada sin código nuevo.
- **AC-21** — `resolveTakeServer` deja `past` y `future` **vacíos** y el coste en cero: después de
  adoptar el texto del servidor no queda nada que deshacer. **Mecanismo**: igual.
- **AC-22** — `resolveKeepMine` **no toca la pila**: las transacciones anteriores siguen ahí y
  deshacer sigue funcionando. **Mecanismo**: igual. Es correcto porque no cambia el `draft` (§1.3).

### D. Teclado

- **AC-23** — Con el foco en el `<textarea>`, `Ctrl`+`Z` (y `Cmd`+`Z`) deshace **y llama a
  `preventDefault()`**, para que el deshacer nativo —que a partir de aquí sería el que miente— no
  ocurra además. **Mecanismo**: `DocumentEditorPage.test.tsx`, afirmando el texto resultante y
  `defaultPrevented`.
- **AC-24** — `Ctrl`/`Cmd`+`Shift`+`Z` y `Ctrl`+`Y` **rehacen**, y `Ctrl`+`Shift`+`Z` **no** deshace.
  **Mecanismo**: igual, tres casos.
- **AC-25** — **Ninguna fila del catálogo de la paleta declara una tecla de historial**: el cruce
  entre `MARKDOWN_PALETTE` y la enumeración de teclas de historial es **vacío**. **Mecanismo**: guarda
  sobre las dos enumeraciones, **sin ningún número escrito a mano**. Es lo que impide que añadir un
  elemento con `shortcut: 'z'` rompa `Ctrl`+`Z` en silencio.
- **AC-26** — Con el foco **fuera** del `<textarea>` —en la tira de pestañas, por ejemplo—, los
  atajos de historial **no hacen nada**: el `draft` no cambia. **Mecanismo**: igual. Es el precedente
  de la `004` (atajos de edición acotados al sitio donde se edita), y lo que impide que `Ctrl`+`Z`
  sobre otro control de la página edite un documento a espaldas de quien lo pulsó.

### E. Interfaz

- **AC-27** — Hay **dos** controles, «Deshacer» y «Rehacer», cuyo **nombre accesible incluye su
  atajo** —el precedente es la «×» de la `005`, que dice `· Supr para cerrar`—. **Mecanismo**:
  `getByRole('button', { name: … })` en `DocumentEditorPage.test.tsx`.
- **AC-28** — Cada control está **deshabilitado** exactamente cuando su lado de la pila está vacío, y
  vuelve a habilitarse cuando deja de estarlo. **Mecanismo**: `toBeDisabled()` / `toBeEnabled()` en
  cuatro estados. Es, además, **la única señal que distingue «se acabó el historial» de «esto no
  funciona»** cuando la cota de §2.2 desaloja.
- **AC-29** — Los dos controles están presentes en los modos `text` y `split` y **ausentes** en
  `preview`, igual que la paleta: deshacer es una acción de edición y en vista previa no se edita.
  **Mecanismo**: `queryByRole` en los tres modos.
- **AC-30** — Activar «Deshacer» con el ratón o con `Enter` **restaura la selección sin robar el
  foco**: el elemento activo sigue siendo el botón. Con el atajo, el foco sigue en el `<textarea>` y
  la selección queda donde dice AC-11. **Mecanismo**: `document.activeElement` en los dos casos. Sin
  este AC, la segunda pulsación de `Enter` sobre el botón escribiría un salto de línea en el
  documento.
- **AC-31** — La página del editor **no añade ninguna región viva**: el número de elementos con
  `role="status"` en modo texto es **el mismo antes y después de esta spec**, y sale de contar los que
  hay, no de un literal. **Mecanismo**: `getAllByRole('status')` comparado contra la enumeración de
  nombres esperados. §9, decisión abierta **B**, explica por qué no se añade una.
- **AC-32** — Los dos controles miden **≥ 24 × 24 px** (WCAG 2.2, SC 2.5.8), medido en el navegador
  con `boundingBox()`. **Mecanismo**: `e2e/undo.spec.ts`. Es el AC que la `005` aprendió a escribir
  a base de que se le colara un control de 19,73 px por no tenerlo.

### F. Navegador, alcance y presupuesto

- **AC-33** — En Chromium, sobre un documento real: se teclea una frase, se inserta un elemento de la
  paleta y se pulsa `Ctrl`+`Z`; el contenido del `<textarea>` queda **exactamente** en el texto
  anterior a la inserción —ni el anterior a la frase, ni sin cambios—. **Mecanismo**:
  `e2e/undo.spec.ts`. Es **el defecto que esta spec existe para arreglar**, comprobado donde vive:
  ningún test de jsdom puede ver la pila nativa del navegador, y este caso falla hoy.
- **AC-34** — `packages/shared` y `apps/api` **no se mueven**: `git status --porcelain packages
  apps/api` vacío y los recuentos de sus suites idénticos a los del cierre de la `005` (shared **81**
  · api unit **305** · api e2e **511**). **Mecanismo**: comando en la tarea de cierre.
- **AC-35** — El presupuesto de cupo se declara **con su ventana y su comando**: (a) pico de
  `workspace` **< 60 de 120 por corrida**, medido sondeando Redis **dentro del contenedor** durante
  `pnpm test:e2e`; (b) bajo `--retries=2 --repeat-each=3`, **ningún `429`**, y **sin cifra**, porque
  el multiplicador cae dentro de la misma ventana de 60 s. **Mecanismo**: tarea de cierre. La lección
  de la `005` va pegada: **se valida el instrumento contra un valor conocido antes de creerse la
  medida**, y `redis-cli` **no existe en esta máquina**.
- **AC-36** — Los ayudantes de e2e siguen sin duplicarse: `watchContentSaves` —hoy con **dos** copias,
  en `palette.spec.ts` y `tabs.spec.ts`— vive en `e2e/support/editor-e2e.ts`, y la guarda de
  `src/test/e2e-support.test.ts` lo vigila junto a los demás. **Mecanismo**: la guarda existente, con
  su inventario ampliado.

---

## 5. Fuera de alcance

- **Persistir el historial.** Ni en el servidor ni en `localStorage`/`sessionStorage`. Lo decidió la
  `005` §6.3 y §8 explica qué costaría cambiarlo.
- **Un árbol de deshacer** (ramas de historial, tipo Vim `undotree`). Rehacer se descarta al escribir
  (AC-6), como en cualquier editor que la gente ya conoce.
- **Historial compartido entre pestañas o global.** Prohibido por AC-15, no aplazado.
- **Deshacer los cambios de la barra lateral** (renombrar, mover, borrar un documento). Esta pila es
  del **contenido de un documento**; el árbol es de la `002` y tiene su propio modelo.
- **Deshacer el modo de vista, el orden de las pestañas o el cierre de una pestaña.** No son
  contenido.
- **Persistir o deshacer más allá del cierre de la pestaña.** Cerrar pierde el historial (`005` §6.3).
- **Sincronizar el desplazamiento de los dos paneles en `split`.** Sigue siendo de la `005` y sigue
  fuera (su `T-009`).
- **`document.execCommand`** en cualquiera de sus formas, incluida la de respaldo (§1.2, punto 1).

---

## 6. Lo que esta spec hereda y no puede tocar

1. **`setDraft` sigue siendo el único camino por el que la interfaz cambia el contenido.** Esta spec
   lo **envuelve**: le añade un argumento opcional y registra dentro. No crea un segundo camino, ni
   siquiera para deshacer — deshacer es **otro `setDraft`** que además pide no registrarse.
2. **El debounce de 1.500 ms, la coalescencia y el *single-flight* de guardado no se tocan.** Todo lo
   que esta spec añade al tráfico de red pasa por ellos y por eso AC-20 puede exigir una sola
   petición para una ráfaga entera.
3. **La política de desalojo de entradas es de la `005`** y no se reabre: `flush` conserva,
   `closeTab` desaloja.
4. **Las cuatro regiones vivas de la página del editor** —«Estado del guardado», «Elemento
   insertado», «Pestañas abiertas», «Carga del documento»— y los **dos** `role="tablist"` —«Modo de
   vista» y «Documentos abiertos»— ya están ahí. Cualquier consulta que esta spec escriba, **de
   producción o de test**, pide por **nombre accesible** y nunca por contenido: `filter({ hasText })`
   no lee `aria-label` y deja el test verde ante la regresión que dice vigilar (lección de la `T-012`
   de la `004`).
5. **`debounceTimers`, `savesInFlight` y `readsInFlight` son `Map`s de módulo en `editor.store.ts`, y
   ningún `beforeEach` los limpia** — `setState(getInitialState(), true)` no los alcanza, así que un
   caso que deja algo colgado hace fallar al **siguiente**. **Esta spec no añade ninguno**: todo su
   estado, incluido `openedAt`, vive dentro de `UndoState`, dentro de `EditorEntry`, dentro del store.
   Es una decisión, no una casualidad, y §2.3 es donde se toma.
6. **La guarda de pureza no puede convivir con un comentario que la explique** (`004` §9.6): lee el
   fuente con `readFileSync` y no distingue código de comentario. Las cabeceras de `text-edit.ts` y
   `undo-history.ts` **no pueden deletrear** `document.`, `window.`, `zustand` ni `from 'react'`, ni
   siquiera en prosa. Van escritas en castellano y sin los términos, y **el comentario de cabecera
   entra en la lista de artefactos de su tarea**.
7. **El andamio vacío es parte del RED** (`004` §9.7): un test que importa un módulo inexistente falla
   por resolución, y eso no demuestra nada. Se crea el archivo con la firma y un cuerpo que no hace
   nada, y **el rojo que se reporta es el de la aserción**.
8. **El filtro de `test` de Vitest 4 es una subcadena, no una expresión regular** (`005` v0.1.3):
   `test "A|B"` sale con `No test files found`. Los comandos `DONE` de `tasks.md` llevan **un
   patrón por comando** o varios patrones separados por espacios.
9. **Un rojo ancho puede ser hambre de máquina** (`005`, riesgo #10): `pnpm test` lanza los tres
   paquetes a la vez, y bajo presión de memoria un test con `testTimeout` de 5 s revienta y arrastra
   a los de al lado. Se reconoce por la **duración**. Se corre el paquete **solo** antes de
   diagnosticar, y **no** se sube el `testTimeout`.

---

## 7. Enmienda que esta spec obliga en una spec cerrada

### 7.1 Spec `004-markdown-palette` → **v0.3.1 (patch)** — la guarda de pureza amplía su lista

**Qué cambia**: `apps/web/src/features/editor/markdown-palette.test.ts` contiene la guarda que lee el
fuente de los módulos puros y falla si alguno aprende algo del navegador o del estado. Su lista
`PURE_MODULES` tiene hoy dos entradas (`markdown-insert.ts`, `markdown-palette.ts`); esta spec le
añade **`text-edit.ts` y `undo-history.ts`**, y el `describe` deja de citar un solo AC (`AC-17` de la
`004`) para citar también el de aquí (**AC-9**).

**Por qué ahí y no en un archivo nuevo**: es **una** guarda con **una** lista de tokens. Un segundo
archivo con el mismo detector sería una segunda copia que puede divergir, que es exactamente la
avería que la `005` pagó con los seis ayudantes de e2e. La lección de la `004` §9.6 ya anticipaba que
«la `006` lo volverá a necesitar en cuanto tenga un módulo de historial puro»: lo que hace falta es
la lista, no otro detector.

**Por qué es patch y no minor**: **no mueve el recuento** de la `004` —siguen 36 AC y 12 tareas—,
ninguno de sus AC cambia de redacción y su AC-17 sigue significando exactamente lo mismo para sus dos
módulos. Lo único que cambia es el **alcance de un instrumento**, hacia arriba. Es el criterio con el
que la v0.1.1 de la `004` y la v0.1.1 de la `005` se justificaron como patch.

Lo aplica **`T-000`**, que **no toca una línea de código**: la línea de la lista la escribe `T-001`,
en su RED, porque el módulo todavía no existe cuando `T-000` corre.

### 7.2 Spec `001-auth` — entrada de cierre en su `CHANGELOG`

`apps/web/e2e/support/**` es contrato de la `001` (su v0.1.3). `T-007` mete ahí `watchContentSaves`,
así que la `001` recibe **entrada de cierre en su CHANGELOG y nada más**: ningún AC suyo cambia,
ningún límite de producción se toca. Mismo procedimiento que `T-027` de la `002`, `T-015` de la `003`
y `T-002` de la `005`.

---

## 8. Por qué la `006` es solo `apps/web`

La pregunta no es retórica: la `004` y la `005` fueron 100 % frontend y las dos salieron bien, pero
si esta spec necesitara **persistir historial**, eso sí sería backend y cambiaría el reparto entero.
Se decide **antes** de escribir `tasks.md`, como hizo la `005` con su decisión **D**.

**No lo necesita, y no por comodidad**: la `005` §6.3 ya decidió que **el historial muere con la
entrada**, con sus tres razones —cerrar es un gesto explícito; el contenido no se pierde porque
cerrar fuerza el guardado y no cierra si falla; y conservar el historial de documentos cerrados es
una caché sin cota cuyo peor caso es reabrir un documento y que `Ctrl`+`Z` deshaga algo de hace tres
horas—. Con esa política, el historial **no sale nunca de la memoria del cliente**.

Lo que costaría lo contrario, para que la comparación esté hecha y no supuesta: tabla y migración
Prisma, `*.request.dto.ts` y `*.response.dto.ts` con Swagger y `class-validator`, endpoint con
autorización por `userId`, tipo en `packages/shared`, y la **secuencia forzada** entre paquetes que la
`004` describe en su §7 — más el radio de los **fixtures de test de los dos paquetes**, que es donde
a la `002` se le quedó corta la lista **dos veces** y a la `004` una. Todo eso para persistir un dato
que la `005` ya decidió que no debe sobrevivir al gesto de cerrar.

**Tampoco toca `packages/shared`**. La tentación sería poner ahí `TextEdit` o el presupuesto. No hay
consumidor de servidor: el backend guarda el contenido como texto opaco y no sabe nada de pasos de
edición. Meterlo en `shared` compraría, a cambio de nada, el coste que la `002` pagó dos veces.
`UNDO_HISTORY_BUDGET_CHARS` **sí** deriva de `MAX_DOCUMENT_CONTENT_CHARS`, que ya está en `shared`,
y por eso se **importa** en vez de escribirse (§2.2).

**AC-34 lo verifica**, con los mismos recuentos con los que lo verificaron la `004` y la `005`.

---

## 9. Riesgos y decisiones abiertas

### 9.1 Decisiones — resueltas el 2026-07-29

**Las cuatro se resolvieron en la opción recomendada, y ninguna mueve nada**: siguen 36 AC y 10
tareas, ningún AC cambia de redacción y ningún artefacto entra ni sale. La **B** era la única que
podía haber reescrito `tasks.md`, y cayó del lado que ya estaba escrito.

| # | Decisión | Opciones | Resolución |
|---|---|---|---|
| **A** | ¿`setDraft` gana un tercer argumento **opcional** o **obligatorio**? | (a) opcional, con regla de respaldo escrita: sin selección se derivan del delta, colapsadas (`at + removed.length` y `at + inserted.length`), que es **exacto para el tecleo** y solo aproximado para una inserción que envuelve texto; (b) obligatorio | **(a) — resuelta.** Obligatorio significa tocar **todas** las llamadas de `editor.store.test.ts` —una spec cerrada— para no ganar comportamiento; y el respaldo no es un agujero silencioso porque **AC-11 lo hace rompible**: quitar el argumento en la llamada de la paleta devuelve un cursor colapsado donde debía haber una selección, y el test cae. El riesgo real de (a) es que una escritura programática futura lo omita sin querer; se acota con el comentario de la firma y con AC-11 |
| **B** | ¿Deshacer se **anuncia** en una región viva? | (a) no se añade ninguna; (b) una quinta región `role="status"` que diga «Deshecho»/«Rehecho» | **(a) — resuelta el 2026-07-29: no se añade ninguna región viva.** Era la única de las cuatro que movía el recuento, y se decidió con el argumento en contra delante y no por omisión. A favor de (a): la página ya tiene **cuatro** regiones vivas, y la `004` dejó anotado (su riesgo #13) que algunos lectores locutan el `aria-label` **además** del contenido; una quinta que se dispara en cada `Ctrl`+`Z` de una ráfaga es la clase de aviso que enseña a ignorar los avisos. En contra de (a): quien usa lector de pantalla pulsa `Ctrl`+`Z` y **no recibe confirmación explícita**; queda a merced de cómo su lector locute el cambio del `<textarea>`, que **ningún test de este repositorio puede comprobar** (§9.3). La variante intermedia —anunciar **solo el final del historial** («No queda nada que deshacer») en vez de cada paso— se ofreció y **también se descartó**: queda escrita aquí porque es la salida por la que habría que empezar si algún día la revisión con lector real (§9.3) dice que la falta de confirmación pesa más de lo previsto |
| **C** | El nombre accesible de los botones dice `Ctrl`+`Z`, **sin rama por plataforma** | (a) literal `Ctrl`, aunque en macOS el atajo que funciona sea `Cmd` (el manejador acepta los dos); (b) detectar la plataforma | **(a) — resuelta.** (b) exige leer `navigator` para elegir un rótulo, y la suite corre **solo en Chromium sobre Linux**: la rama de macOS no la ejercitaría ningún test, que es la forma conocida de tener código que solo falla donde nadie mira. Es el mismo trato que la `005` le dio a `· Supr para cerrar`. Queda como imprecisión conocida |
| **D** | ¿La ventana de agrupación son **500 ms**? | (a) 500 ms, como recomendaba `004` §9.3; (b) otro valor | **(a) — resuelta.** No hay medida que lo respalde —es una convención— y lo que sí está atado es la **relación**: AC-10 exige que sea estrictamente menor que los 1.500 ms del debounce. Si alguna vez se cambia, se cambia el número, no la relación |

### 9.2 Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 1 | Reconstruir el texto del inicio del grupo en cada pulsación (§2.3) cuesta dos recorridos O(n) **por tecla** mientras hay grupo abierto | Con el documento en el límite, ~200.000 comparaciones por tecla. En el peor caso medible, fracciones de ms; en una máquina lenta, perceptible | Solo ocurre **con grupo abierto**, es decir, mientras se teclea de corrido. Si apareciera, la salida es guardar el ancla del grupo (una cadena transitoria más), que §2.3 describe y descarta por memoria: el intercambio está escrito |
| 2 | `Ctrl`+`Y` es **redo** en Firefox/Windows pero la suite corre **solo en Chromium** (`playwright.config.ts`, un único *project*) | Un atajo publicado que nadie prueba en el navegador donde importa | Se declara: AC-24 comprueba que **nuestro manejador** responde a `Ctrl`+`Y`, no que Firefox lo entregue. La lista de atajos **no interceptables** es la de gestión de ventanas y pestañas (`Ctrl`+`W`/`T`/`N`, `Ctrl`+`Shift`+`N`/`T`/`W`, `Ctrl`+`Tab`, `Ctrl`+`1`…`9`, `Alt`+`F4`); los de **edición** —`Z`, `Shift`+`Z`, `Y`— sí se entregan y `preventDefault()` los suprime, y **AC-33 lo demuestra en un navegador de verdad** en vez de afirmarlo de memoria |
| 3 | `preventDefault()` sobre `Ctrl`+`Z` desactiva el deshacer **nativo** del `<textarea>` para siempre en esa página | Si nuestra pila tuviera un hueco, la persona se queda sin la red de seguridad que tenía | Es **deliberado y es la corrección**: la pila nativa ya está invalidada por el control controlado (§1.1), así que la red de seguridad que se quita **ya mentía**. AC-33 es el caso que lo demuestra |
| 4 | La cota de §2.2 desaloja en silencio y `Ctrl`+`Z` deja de hacer algo sin explicación | Se lee como una avería | AC-28: el botón se deshabilita. Es la razón de peso de que la interfaz no sea opcional |
| 5 | Cómo locuta un lector real el cambio del `<textarea>` tras deshacer | Desconocido | **Ningún test de este repositorio puede cubrirlo**: ni jsdom ni Playwright locutan nada. Queda como **revisión manual declarada** (§9.3), y **no se escribe un test que finja que sí** — misma regla que el riesgo #13 de la `004` y §3.D de la `005` |
| 6 | `AC-33` teclea, inserta y deshace contra el API real, así que gasta cupo de `documentContent`, que **no se resetea nunca** (política de `003/tasks.md` `T-015`) | Un `429` que se leería como fallo de la suite | El pico medido en el cierre de la `005` fue **28 de 120 por corrida** para `workspace`; `undo.spec.ts` añade **una** suite. AC-35 lo mide con su ventana, y `watchContentSaves` da el número exacto de `PUT` del caso en vez de estimarlo |
| 7 | `watchContentSaves` pasa a ser la **tercera** copia y toca extraerlo (regla de la casa), lo que mete `palette.spec.ts` y `tabs.spec.ts` en el radio de `T-007` | Dos archivos de specs cerradas modificados | Está previsto y enumerado: `T-007` los lleva en su lista de artefactos, junto con la guarda de `src/test/e2e-support.test.ts` y la entrada de cierre en el CHANGELOG de la `001` (§7.2). **Extraer es unificar**: se comprueba que las dos copias son idénticas antes de quedarse con una |

### 9.3 Lo que ningún test de este repositorio puede comprobar, dicho sin adornar

- **Cómo locuta un lector de pantalla real** (NVDA, JAWS, VoiceOver) el cambio del `<textarea>` tras
  un deshacer, y si el `aria-label` de los botones se lee como esperamos. Es revisión **manual**.
- **Si Firefox sobre Windows entrega `Ctrl`+`Y` a la página** antes de hacer lo suyo. La suite es
  Chromium-only.
- **Cuánta memoria ocupa de verdad el historial** en el montón de V8. AC-17 mide el **coste
  declarado en caracteres**, que es el que la cota usa; no mide bytes reservados. La cuenta de §2.1 es
  aritmética sobre el modelo, no una medición de `heapUsed`.

Ninguna de las tres tiene un test que finja lo contrario, y esa es la parte que importa.

---

## 10. Verificación

```bash
pnpm --filter @one-markdown/web test text-edit undo-history   # el núcleo puro
pnpm --filter @one-markdown/web test editor.store             # el historial en el store
pnpm --filter @one-markdown/web test DocumentEditorPage       # atajos e interfaz
pnpm --filter @one-markdown/web test e2e-support              # la guarda de los ayudantes
pnpm --filter @one-markdown/web test:e2e undo                 # el defecto, en un navegador
pnpm typecheck && pnpm lint && pnpm test
```

Antes de declarar cualquier cifra: `rm -rf packages/shared/dist` y dejar que el flujo lo reconstruya
(regla operativa de las fases anteriores). Y si algo sale rojo en `pnpm test`, **correr el paquete
solo antes de diagnosticar** (§6, punto 9).

---

## 11. Trazabilidad

| AC | Cubierto por | Tarea |
|----|--------------|-------|
| AC-1 | `text-edit.test.ts` — corpus de ida y vuelta | T-001 |
| AC-2 | `text-edit.test.ts` — minimalidad con textos al límite | T-001 |
| AC-3 | `undo-history.test.ts` — fusión dentro de la ventana | T-002 |
| AC-4 | `undo-history.test.ts` — dos transacciones fuera de la ventana | T-002 |
| AC-5 | `undo-history.test.ts` — la inserción no se funde y cierra el grupo | T-002 |
| AC-6 | `undo-history.test.ts` — escribir vacía `future` | T-002 |
| AC-7 | `undo-history.test.ts` — desalojo por coste | T-002 |
| AC-8 | `undo-history.test.ts` — la más reciente no se desaloja | T-002 |
| AC-9 | `markdown-palette.test.ts` — guarda de pureza, lista ampliada | T-001 (lista) · T-002 (módulo) |
| AC-10 | `undo-history.test.ts` — relación entre las dos constantes | T-002 |
| AC-11 | `editor.store.test.ts` — deshacer devuelve texto y selección · `DocumentEditorPage.test.tsx` — insertar y deshacer devuelve la selección en el `<textarea>` | T-003 (regla) · T-005 (cableado) |
| AC-12 | `editor.store.test.ts` — rehacer devuelve texto y selección | T-003 |
| AC-13 | `editor.store.test.ts` — tres deshacer, tres pasos | T-003 |
| AC-14 | `editor.store.test.ts` — pila vacía, sin efectos | T-003 |
| AC-15 | `editor.store.test.ts` — dos documentos, dos pilas | T-003 |
| AC-16 | `editor.store.test.ts` — `flush` conserva, `closeTab` desaloja | T-003 |
| AC-17 | `editor.store.test.ts` — coste O(cambio) con documento al límite | T-003 |
| AC-18 | `editor.store.test.ts` — deshacer tras guardar emite un `PUT` | T-004 |
| AC-19 | `editor.store.test.ts` — deshacer hasta lo guardado deja limpio | T-004 |
| AC-20 | `editor.store.test.ts` — ráfaga = una petición | T-004 |
| AC-21 | `editor.store.test.ts` — `resolveTakeServer` vacía la pila | T-004 |
| AC-22 | `editor.store.test.ts` — `resolveKeepMine` no la toca | T-004 |
| AC-23 | `DocumentEditorPage.test.tsx` — `Ctrl`+`Z` y `defaultPrevented` | T-005 |
| AC-24 | `DocumentEditorPage.test.tsx` — `Shift`+`Z` e `Y` rehacen | T-005 |
| AC-25 | `DocumentEditorPage.test.tsx` — cruce vacío con el catálogo | T-005 |
| AC-26 | `DocumentEditorPage.test.tsx` — fuera del área no hacen nada | T-005 |
| AC-27 | `DocumentEditorPage.test.tsx` — nombres accesibles con su atajo | T-006 |
| AC-28 | `DocumentEditorPage.test.tsx` — deshabilitado por lado vacío | T-006 |
| AC-29 | `DocumentEditorPage.test.tsx` — presentes en `text` y `split` | T-006 |
| AC-30 | `DocumentEditorPage.test.tsx` — el botón no roba el foco | T-006 |
| AC-31 | `DocumentEditorPage.test.tsx` — el recuento de regiones no cambia | T-006 |
| AC-32 | `e2e/undo.spec.ts` — `boundingBox()` ≥ 24 × 24 | T-008 |
| AC-33 | `e2e/undo.spec.ts` — teclear, insertar, `Ctrl`+`Z` | T-008 |
| AC-34 | comando de cierre — `git status` y recuentos | T-009 |
| AC-35 | comando de cierre — sonda de Redis dentro del contenedor | T-009 |
| AC-36 | `src/test/e2e-support.test.ts` — inventario ampliado | T-007 |
