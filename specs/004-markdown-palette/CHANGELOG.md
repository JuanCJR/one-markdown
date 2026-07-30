# Changelog — Spec 004 Paleta de elementos markdown insertables

Formato: `## vX.Y.Z — YYYY-MM-DD` + motivo del cambio.

## v0.3.1 — 2026-07-29

**Patch de enmienda pedido por la `006-editor-undo`**, aplicado por su `T-000` **sin tocar una línea
de código**. Amplía el **alcance de un instrumento**, no el alcance de la spec.

- **Qué cambia**: la guarda de pureza que vive en `apps/web/src/features/editor/markdown-palette.test.ts`
  —la que lee el fuente de los módulos vigilados y falla si alguno aprende algo del navegador o del
  estado— pasa a vigilar también los **dos módulos puros que estrena la `006`**: `text-edit.ts` y
  `undo-history.ts`. Y **AC-17 se redacta para que la lista pueda crecer** sin reescribir el criterio
  cada vez: qué módulos añade cada spec lo dice **su propio AC** (la `006` lo hace en su AC-9), y el
  recuento vive en la constante `PURE_MODULES` y en **ningún literal**.
- **Por qué ahí y no en un archivo nuevo**: es **una** guarda con **una** lista de tokens. Un segundo
  archivo con el mismo detector sería una segunda copia que puede divergir — exactamente la avería
  que la `005` pagó con los **seis** ayudantes de e2e, **dos de ellos ya divergidos en firma**,
  midiendo cosas distintas mientras creían medir lo mismo. Además, **§9.6 de esta spec ya lo había
  anticipado por escrito**: «la `006` lo volverá a necesitar en cuanto tenga un módulo de historial
  puro». Lo que hacía falta era la lista, no otro detector.
- **Por qué es patch y no minor**: **el recuento no se mueve** —siguen **36 AC** y **12 tareas**—,
  ningún AC cambia de significado para los dos módulos de esta spec, y ningún artefacto entra ni
  sale. Es el criterio con el que la v0.1.1 de esta misma spec y la v0.1.1 de la `005` se
  justificaron como patch. **El argumento contrario queda escrito, porque era legítimo**: AC-17 sí
  cambia de **redacción**, y por la letra de `specs/README.md` («minor — agrega alcance nuevo») se
  podría defender un minor. Se elige patch porque lo que el AC **exige** —que el núcleo y el catálogo
  no conozcan el navegador ni el estado— es palabra por palabra lo mismo que exigía ayer; lo que
  crece es la lista de archivos a los que **otra** spec le pide lo mismo.
- **Consecuencia asumida, y es la misma que se dieron la `002` y la `003` al ser enmendadas**: desde
  hoy **la redacción de AC-17 va por delante del código**. La línea que mete los dos módulos en
  `PURE_MODULES` **no la escribe esta enmienda**: la escriben `T-001` y `T-002` de la `006`, cada una
  cuando estrena su módulo, porque hoy esos archivos **todavía no existen** — y añadirlos a la lista
  antes pondría la guarda en rojo por un archivo ausente, que es el fallo de resolución que §9.7
  enseña a no confundir con un RED.
- **§9.6 queda dada por cobrada**: la lección se escribió pensando en esta situación y la situación
  llegó. Las dos tareas que estrenan módulo llevan **la cabecera de comentario del archivo dentro de
  su lista de artefactos**, que es exactamente lo que a esta spec le faltó en `T-005`.
- **Verificación de que no se tocó código** (la guarda de la enmienda, mismo procedimiento que
  `T-000` de la `005`): `pnpm test` desde estado limpio **antes y después**, con recuentos idénticos
  —`shared` **81** · `apps/web` **21 archivos / 524** · api unit **21 suites / 305**— y el estado del
  árbol bajo `apps/**` y `packages/**` **sin una sola diferencia** respecto al de antes de empezar.

## v0.3.0 — 2026-07-29

**Versión de cierre.** Se escribe con **T-011 verde y verificada**, y deja la spec en **complete**:
**36 AC** y **12 tareas**, todas cerradas. Añade **una tarea** (`T-012`) y **ningún AC**, y corrige
**tres** redacciones que la implementación desmintió. Las tres correcciones tienen la misma forma y
conviene decirlo antes de detallarlas: **la spec afirmaba algo verificable, se fue a verificar, y no
era verdad**. Ninguna se arregla relajando la aserción del test.

### Por qué es minor y no patch

Por una sola razón, y es la que la **v0.2.1 dejó fijada al justificarse a sí misma**: «el recuento no
se mueve: siguen 36 AC y 11 tareas». Aquí **el recuento se mueve** —11 → 12 tareas—, así que no puede
ser patch aunque ningún AC cambie de exigencia. Es una regla mecánica y por eso sirve: no depende de
lo grande que le parezca el cambio a quien lo escribe. `T-012` es **una línea** de código y aun así
mueve la versión menor, y eso es correcto.

### 1. `T-012` — el último locator que distinguía las regiones vivas por contenido

**El defecto.** `e2e/palette.spec.ts` lo creó `T-010`, **antes** de que el nombre accesible
existiera, y desambiguaba las dos regiones `role="status"` **por contenido**:

```ts
const SAVE_STATE_TEXT = /^(Guardado|Guardando…|Cambios sin guardar|Sin guardar)$/;
const saveStatus = page.getByRole('status').filter({ hasText: SAVE_STATE_TEXT });
```

Resolvía a un solo elemento y el archivo pasaba verde. Aplazarlo a la `005` como deuda era la opción
cómoda y es la que **no** se tomó, por tres razones:

1. **Contradice AC-27 literalmente.** Ese AC, reescrito en la v0.2.0, dice que las dos regiones «se
   distinguen **por nombre** y no por lo que dicen en ese momento». Este era el único punto del
   repositorio que hacía lo contrario, y estaba en la propia spec que lo prohíbe.
2. **El locator viejo es inmune a la mutación que borra el `aria-label`.** `filter({ hasText })`
   compara contra el texto renderizado y **no lee** `aria-label`. Si alguien retira el nombre
   accesible que AC-27 exige, `palette.spec.ts` **sigue verde**. Es decir: no era un test con un
   apaño feo, era un test **incapaz de detectar la regresión del criterio que lo rodea**. Esa es la
   diferencia entre deuda estética y un hueco de verificación, y es la que decidió el punto.
3. **Es un artefacto de esta spec**, no herencia de la `003`. Cerrar la `004` dejando un apaño en un
   archivo que la `004` creó, y que existe **solo** porque el nombre todavía no estaba, es
   exactamente la arqueología que las fases anteriores han pagado por evitar.

**No hay RED clásico y se dice en la tarea**: el comportamiento ya lo implementó `T-011` y el locator
nuevo pasa a la primera. Lo que sustituye al RED es una **mutación obligatoria** —que es la pregunta
que el RED contesta, hecha directamente—. **Medido**: con el `aria-label` borrado de
`SaveStatus.tsx`, el caso cae con `element(s) not found` en `await expect(saveStatus).toHaveText('Guardado')`,
la **primera** aserción sobre la región; restaurado byte a byte, verde otra vez.

_Media medida, dicha como tal_: que el locator **viejo** siguiera verde bajo esa misma mutación **no
se midió** (cada corrida gasta un `PUT` del cupo de `documentContent`, que no se resetea). Se sigue
por construcción y queda escrito como **deducción, no como medición**.

### 2. AC-36 — el `takeRecords()` que pedía no era implementable, y está medido

**El defecto, literal.** La v0.2.0 escribió que AC-36 se verifica «con un `MutationObserver` sobre la
región y su `takeRecords()` … **y no con el callback del observador**, para no depender de
microtareas ni del reloj falso». Suena a precaución técnica bien pensada, y por eso pasó la revisión.
**No se puede cumplir.**

**Medido**, con una sonda de callback vacío y recuento **solo** por `takeRecords()`:

```
registros solo con takeRecords(): 0
```

**Y el motivo no es el mecanismo de reanuncio que se eligiera.** Es la semántica del observador:
navegador y jsdom **entregan la cola de registros en cada punto de comprobación de microtareas**, y
un `await user.click()` cruza varios. Un `takeRecords()` posterior solo puede devolver lo ocurrido
**desde el último `await`**, así que habría dado 0 con **cualquier** mecanismo, incluido
vaciar-y-reescribir. La medición y la especificación del DOM dicen lo mismo, que es la mejor
situación posible para creerse un resultado.

**Lo que `takeRecords()` sí aporta**, y por eso la implementación lo conserva como **cierre** y no
como origen único de la cuenta: garantiza que el recuento no se queda corto por un **último lote aún
no entregado** al callback en el instante de afirmar, y lo recoge **de forma síncrona**, sin `await`
extra, sin `waitFor` y sin avanzar ningún reloj. Es exactamente la garantía que la v0.2.0 buscaba; lo
que estaba mal era creer que podía ser lo único.

**AC-36 pasa a pedir lo verificable**: observador que **acumula en el callback** y **cierra con
`takeRecords()`**; dos activaciones idénticas → **≥ 2** registros.

### 3. AC-36 — el mecanismo de reanuncio, ratificado, y la aserción ajustada a él

Se ratifica **alternar un `U+200B`** (espacio de ancho cero) al final del texto. Es síncrono y de un
solo render, y las dos alternativas se descartan con motivo:

- **Un espacio normal, no.** El whitespace es justo lo que colapsan `textContent`, jest-dom,
  Playwright y el propio cálculo de texto de un lector. Una diferencia hecha **solo** de whitespace es
  la más fácil de que se normalice hasta desaparecer **en el consumidor al que va dirigida** — el
  peor sitio posible para que desaparezca.
- **Vaciar y reescribir, no.** React agrupa las dos actualizaciones del mismo manejador en un solo
  render, así que el paso por vacío exige `flushSync` —un render extra forzado por un detalle de
  accesibilidad— o un temporizador, que saca el segundo cambio del alcance síncrono con el que este
  AC se verifica.

**Consecuencia, ratificada y escrita en el AC**: tras un número **par** de anuncios el `textContent`
real es `Insertado: Negrita` **más el `U+200B`**. No se pinta y no se locuta, y `toHaveTextContent`
lo da por bueno, pero **no es literalmente igual** a la cadena que el AC escribía. Se ajusta **el
AC** —afirma por **contención**— y no el mecanismo. Pedir igualdad literal devolvería el dilema de
`flushSync`/temporizador **a cambio de nada que un lector note**, y ese es el criterio: la medida se
adapta al mecanismo bueno, no al revés.

### 4. El fallo esperado del RED 1(b) de `T-011` no era el que ocurre

**El defecto.** `tasks.md` predijo para el subcaso (b) «**1** registro en vez de 2». Lo que ocurre es
que **(b) revienta antes de llegar a su propia aserción**, en
`getByRole('status', { name: 'Elemento insertado' })`: con la región perezosa no hay nada que
encontrar. Los subcasos (a) y (b) cuelgan de la **misma** precondición ausente, así que **fallan
igual**.

El «1 en vez de 2» **sí existe**, pero como **mutación (c)** sobre producción ya corregida —devolver
el reanuncio a escribir siempre el mismo texto—, y ahí sale literalmente
`expected 1 to be greater than or equal to 2`, que es la cifra exacta que la spec predecía. Es decir:
el número era bueno y el momento era malo.

**La lección, que vale más que la corrección**: predecir el rojo de un subcaso **dando por bueno que
el anterior pasa** es predecir mal. Cuando dos aserciones dependen de la misma precondición que
falta, el RED de las dos es el de la precondición; el fallo «interesante» solo aparece **como
mutación**, sobre producción ya arreglada. Queda escrita en la propia tarea, junto al fallo
corregido.

### 5. Riesgos nuevos, los dos con destinatario en la `005`

- **#13 — el nombre accesible puede locutarse además del contenido.** `aria-label` nombra la región
  en la lista de regiones (que es lo que AC-27 busca), pero algunos lectores lo anteponen al anuncio:
  «Elemento insertado. Insertado: Negrita». La spec lo pide explícitamente y **lo asume**. Va a la
  `005` porque con vista dividida habrá **dos** paletas y por tanto **dos regiones homónimas**, y hay
  que revisarlo **con lector real**: ni jsdom ni Playwright locutan nada, así que **ningún test de
  este repositorio puede detectarlo y no se debe escribir uno que finja que sí**. Si resulta
  hablador, la salida previsible es un nombre por panel, no quitar el nombre.
- **#14 — la suite de navegador y `pnpm dev` no pueden coexistir**, y la mitad del arreglo ya estaba
  hecha. `e2e/support/dev-env.ts` le da al API un puerto propio (**3011**, con el comentario
  «distinto del 3001 de `pnpm dev`») pero deja el web en **5173**, el mismo de `pnpm dev`. Con
  `reuseExistingServer: false` —correcto y deliberado— Playwright aborta con
  `http://localhost:5173 is already used`. Le pasó al cierre de esta misma spec. Es un fallo de
  **entorno disfrazado de fallo de suite**: no hay ningún test en rojo, hay un error antes de
  empezar. Arreglo simétrico anotado para la `005`; hasta entonces, §10 lo deja como precondición
  escrita.

## v0.2.1 — 2026-07-29

**Patch escrito con `T-010` verde y verificada.** No mueve una línea de código, no añade ni quita
alcance y **el recuento se queda en 36 AC y 11 tareas**. Corrige un criterio que era **cierto por
corrida y falso bajo su propio comando de verificación**, precisa otro, y deja dos anotaciones con
destinatario. Es patch por el criterio de la casa —aclaraciones y precisión de criterios— y no minor
porque nada de esto obliga a cambiar una sola aserción de un test verde.

### 1. AC-33 era autocontradictorio, y lo era desde la `003`

**El defecto, literal**: el AC exigía que el pico de `documentContent` quedara **< 10 de 120** y
mandaba verificarlo con `pnpm --filter @one-markdown/web exec playwright test --retries=2
--repeat-each=3`. Ese comando **triplica el gasto dentro de la misma ventana de 60 s** del throttler:
la suite entera dura ~23 s, así que las tres repeticiones **se suman** en vez de sucederse. La cifra
y el comando no podían ser ciertos a la vez.

**Medido**, con sondeo de Redis cada 300 ms sobre `throttle:documentContent:{sha256(ip)}`:

| Escenario | `documentContent` |
|---|---|
| **Una** corrida, **con** el caso nuevo de la paleta | **5** (baseline de la `003` = 4; el caso nuevo añade exactamente 1) |
| `--repeat-each=3`, **sin** el caso nuevo (`--grep-invert`) | **12** |
| `--repeat-each=3`, **con** el caso nuevo | **15** |

Aritmética consistente y comprobada de forma independiente: 4 × 3 = 12 y 5 × 3 = 15. De donde sale lo
importante: **el criterio ya estaba roto en 12 antes de que la `004` existiera**. No lo introduce
`T-010`, y el caso nuevo no es reducible —gasta **un** `PUT`, afirmado con
`expect(contentSaves()).toBe(1)`, y bajar de 1 es dejar de verificar AC-32—. El resto de contadores
quedó holgado y **no hubo un solo `429`**: `register` 1/5 · `login` 6/10 · `refresh` 39/60 ·
`workspace` 34/120.

**Decisión: (a) — la cifra pasa a ser «por corrida» y el AC gana un segundo comando.** AC-33 queda
partido en dos mitades con **su ventana y su comando cada una**: **(a)** por corrida
(`pnpm test:e2e` + sondeo de Redis) el pico es **< 10 de 120**, medido **5**; **(b)** bajo
`--retries=2 --repeat-each=3` lo que se afirma es **la ausencia de `429`**, con la suma de las tres
repeticiones (**15**, techo teórico 9 × 5 = **45**) escrita al lado para que nadie la vuelva a
confundir con la cifra de la mitad (a).

**Por qué (a) y no (b) —subir el número a uno cierto bajo `--repeat-each=3`—.** Porque un número que
solo es cierto bajo ese comando **no habla de la suite, habla del multiplicador**: mezcla cuánto
gasta el conjunto de casos (propiedad del producto y de sus tests, que es lo que el AC quiere vigilar)
con cuántas veces hemos decidido repetirlo (propiedad de la línea de órdenes). El día que CI pase a
`--repeat-each=5`, o que la suite crezca hasta durar más de 60 s y las repeticiones dejen de sumarse,
el número cambiaría de significado sin que nadie tocara una línea de producto. Y no habría forma
honesta de elegir la constante: cualquier valor ≥ 15 se justifica contra un multiplicador que no es
el sujeto del criterio.

**Por qué (a) y no (c) —recortar el gasto de `editor.spec.ts`—.** Porque **cuesta cobertura y no
compra nada**. Los 4 del baseline los gasta casi enteros (3 de 4) el caso de conflicto de AC-33 de la
`003`, y las tres únicas formas de bajarlo —subir el debounce, esperar a un estado intermedio
observable, o forzar el guardado en vez de esperarlo— están **explícitamente descartadas** en el
riesgo #10 de `003/spec.md`, porque cambian o el producto o lo que el AC demuestra. La política del
proyecto —**gastar menos, no neutralizar más**— es una regla para cuando el presupuesto aprieta, y
aquí no aprieta: **5 de 120 por corrida, 15 bajo el comando, 105 de margen**. Aplicarla en este caso
sería pagar con la cobertura de una spec cerrada para hacer cierta una frase mal escrita, que es el
orden de las cosas al revés. Si algún día el gasto se acercara de verdad al límite, **(c) sería la
respuesta correcta** y esta entrada no debe leerse como que se descartó por difícil.

**Qué se ha hecho con la `003`.** Su **AC-34 no lleva número** —dice «pasa entera y ninguna llamada
ha recibido un `429`»—, así que **es cierto y no se toca**: 12 de 120 lo cumple. Lo que sí estaba
mal escrito allí es la **contabilidad de cierre** («la suite gasta 4 de 120», en su CHANGELOG
v0.1.4), que es una cifra **por corrida** anotada junto a un comando que la multiplica por tres. Se
corrige con un **patch propio de la `003` (v0.1.5)** en vez de dejar solo constancia aquí, porque la
`005` va a leer esas notas de cierre para dimensionar su propio presupuesto y heredaría la misma
ambigüedad. Y queda como **riesgo #12** de esta spec la regla que lo evita: **toda cifra de cupo
lleva pegada su ventana y el comando con el que se mide**.

### 2. AC-32: la parada del tabulador ya es «Negrita»

La redacción decía «`Tab` hasta la paleta, **flechas hasta «Negrita»**», y el roving tabindex de
AC-25 arranca en `activeIndex = 0`, que **es** «Negrita»: cumplir la letra del AC era **no pulsar
ninguna flecha**. `T-010` lo resolvió con un viaje de **ida y vuelta** (`→` Cursiva, `→` Tachado,
`←` `←` Negrita), lo comentó en el caso, y tenía razón: quedarse quieto habría hecho que ese paso
midiera **dónde arranca el foco** en vez de la navegación, que es lo que el AC existe para demostrar.
La spec se ajusta a lo que se hizo —el recorrido es correcto, la frase era la que estaba mal— y de
paso el viaje cruza el borde entre grupos, que es la parte no trivial del recorrido.

### 3. `watchConsole` duplicado: deuda con destinatario en la `005`

El ayudante está copiado en `e2e/editor.spec.ts` y `e2e/palette.spec.ts`, y la causa es correcta, no
un descuido: la lista de artefactos de `T-010` era **un solo archivo**, y ampliarla habría metido a
la tarea en `editor.spec.ts`, que la ola 4 tenía prohibido tocar. Van **dos** copias y la regla de la
casa es extraer **a la tercera**; la escribe la `005`, que añade suites de navegador. Queda anotado
en §4 con los dos avisos que hacen falta: las copias **ya divergieron en firma** (una acepta patrones
tolerados y la otra no), así que extraer es **unificar**; y `apps/web/e2e/support/**` es contrato de
la spec `001`, con entrada de cierre obligatoria en su CHANGELOG.

### 4. La segunda mutación superviviente queda identificada y cerrada

Estaba anotado como pendiente de cierre de spec: de las **41** mutaciones de `T-001`…`T-005`
sobrevivieron **dos** y solo una venía con nombre. Las dos son **M5** y **M38**, y **ninguna es un
hueco de cobertura**:

- **M5** («cerrar con `before` en vez de `after`») sobrevivió en `T-001` porque los cuatro elementos
  que envuelven tienen delimitador **simétrico** (`**`, `*`, `~~`, `` ` ``): la mutación es
  **semánticamente inerte**, no invisible. El propio agente la repitió como **M5bis** al llegar
  `T-002`, con `link` e `image`, que son **asimétricos**, y **cayó** (4 tests).
- **M38** (reordenar las claves de `PALETTE_GROUP_LABELS`) sobrevive **como debe**: el orden de las
  claves de un objeto no es contrato. El orden que sí lo es, el de `MARKDOWN_PALETTE`, lo mata
  **M41**.

## v0.2.0 — 2026-07-29

**Minor escrito con T-001…T-009 verdes y verificadas** (`pnpm --filter @one-markdown/web test` → 19
archivos, **469 passed** · `typecheck` y `lint` en **0** · `playwright test editor` → **3 passed**).
Sube a minor porque **añade alcance**: un AC nuevo (**AC-36**), una tarea nueva (**T-011**), un
artefacto nuevo en el radio de la spec (`SaveStatus.tsx`, producción de la `003`) y una reescritura
de **AC-27** que cambia comportamiento ya implementado y verde. **El recuento pasa de 35 a 36 AC y de
10 a 11 tareas.**

**Por qué minor y no patch, con el precedente delante.** Las dos correcciones de redacción que trae
esta versión (AC-26 y AC-20) habrían sido patch por sí solas: no mueven una línea de código ni un
test. Lo que fuerza el minor es AC-27 + AC-36 + T-011, y el criterio es el mismo que se aplicó en la
**v0.4.0 de la `002`**: es **aditivo** —ningún AC desaparece, ningún contrato se rompe— pero **obliga
a cambiar aserciones de tests verdes**, así que no puede ser un patch. Tampoco es major: nada de lo
que la `003` o la `004` prometieron deja de ser cierto, y `SaveStatus` conserva íntegros sus textos,
sus estados y su pareja `status`/`alert`.

**Por qué no se subió a v0.1.3, que era lo que la petición sugería.** Porque escribir «patch» encima
de una tarea nueva y un AC nuevo es exactamente el atajo que el versionado existe para no tomar: el
día que alguien mire el historial buscando cuándo entró trabajo no previsto, un patch se lo esconde.

### 1. AC-27 reescrito — la región viva se monta antes de tener nada que decir

**El hallazgo, y por qué es el más serio de los tres.** AC-27 se implementó **según su letra** y la
letra estaba mal. La región viva de la paleta se pinta **solo tras la primera inserción**, es decir,
entra en el DOM **con su primer anuncio ya dentro**. Un lector de pantalla registra las regiones
vivas que encuentra y anuncia sus **cambios posteriores**; una región que aparece con su texto dentro
es notoriamente poco fiable en NVDA y JAWS, porque no hubo cambio que observar sino una aparición.
Resultado: **el AC estaba verde en CI y era falso en la práctica**, justo para las personas para las
que existe. La accesibilidad es un objetivo declarado de esta spec —seis AC propios, AC-24…AC-29—, no
un extra, así que documentar la limitación y seguir no era una opción defendible.

**Lo que costaba arreglarlo, y por eso hacía falta una decisión y no un parche.** `SaveStatus` pinta
un `role="status"` **sin nombre accesible** desde la `003`. Con la región de la paleta montada
siempre hay **dos** regiones `status` permanentes en la página, y eso rompe **seis** aserciones que
hoy consultan `getByRole('status')` sin desambiguar: cuatro en `DocumentEditorPage.test.tsx` y **dos
en `apps/web/e2e/editor.spec.ts`**, estas con **violación de modo estricto** de Playwright.

**Opción elegida: poner nombre accesible a las dos regiones** (`"Elemento insertado"` y
`"Estado del guardado"`) y desambiguar por nombre en las seis aserciones. Lo ejecuta **T-011**, única
tarea autorizada a tocar `SaveStatus.tsx`, y lo toca **solo** para añadir un atributo.

Las alternativas y por qué no:

- **Aceptarlo y documentar la limitación** deja publicado un criterio de accesibilidad que el test
  confirma y el usuario no recibe. Es el patrón que esta spec persigue en el resto del proyecto.
- **Darle a la paleta una ARIA que las consultas actuales no vean** (por ejemplo `aria-live` sin
  `role="status"`) evita tocar los seis sitios, pero adapta la accesibilidad de producción a la forma
  de las consultas de test y deja la trampa armada para el siguiente que escriba `role="status"`.
- **Mandarlo a una spec posterior** es lo peor de los tres: AC-27 quedaría marcado como verificado.

Y hay un motivo de calendario que inclina más la balanza: la **`005`** va a añadir interfaz a esta
misma página —con vista dividida habrá **dos** paletas—, así que `getByRole('status')` a secas se iba
a romper igual. Pagarlo en la spec que lo descubre es más barato que heredarlo. Queda anotado como
**riesgo #11** en `spec.md` §8.

### 2. AC-36 nuevo — insertar dos veces el mismo elemento vuelve a anunciar

Problema hermano del anterior que **ningún AC cubría**: `setInserted(label)` con la misma etiqueta no
cambia el texto de la región, no muta el DOM y por tanto **no se anuncia**. Quien inserte «Negrita»
dos veces seguidas oye un anuncio y no dos, aunque el documento haya cambiado las dos veces.

Se verifica con `MutationObserver` + `takeRecords()` —síncrono, sin depender de microtareas ni del
reloj falso— comprobando **≥ 2** cambios de contenido. La aserción es sobre **el hecho de que la
región cambió**, no sobre el mecanismo: el estado final de dos inserciones iguales es idéntico al de
una, y ese es precisamente el motivo de que el AC haga falta.

### 3. AC-26 — reescrito para decir lo que de verdad se puede verificar

Decía «conmutador de vista → **paleta** → `<textarea>`» como si fuera una secuencia literal, y así
**es inalcanzable**: entre el `tablist` y la paleta vive el botón **«Guardar»** de la `003`, en la
misma fila y el mismo contenedor que el contador de caracteres y `SaveStatus`. El recorrido real es
conmutador → Guardar → paleta → `<textarea>`, y así lo escribió T-007 en su test, explícito y con
comentario.

**Se corrige la redacción, no la cabecera.** El AC pasa a exigir el orden **relativo** —conmutador
antes que paleta, paleta antes que área de escritura— que es la razón que el propio AC daba. Mover un
control de la `003` que está implementado, verificado y en su lugar natural, para hacer cierta una
frase de esta spec, sería el orden de las cosas al revés.

### 4. AC-20 — sus dos mitades, cada una con la medida que le corresponde

El hallazgo más agudo de los tres, y el que más falta hacía dejar por escrito. La spec presentaba
«tres inserciones → una petición» como **la** medida de AC-20 entero. **No lo es**, y está medido con
mutación: llamando a `setDraft` **dos** veces sigue saliendo **una** petición —la coalescencia se lo
traga— y el caso de las tres inserciones sigue viendo `toHaveLength(1)`.

Lo que mata esa mutación es la aserción del **borrador exacto**, que el agente añadió al mismo caso
justo por eso. Así queda escrito en el AC:

1. **«No hay un segundo camino de guardado»** → se mide **contando peticiones**.
2. **«`setDraft` se llama una sola vez, con la cadena del núcleo»** → se mide con el **borrador
   exacto** (`entry().draft` y el `content` enviado). El conteo **no** lo ve.

Corregida también la fila del **riesgo #2** de §8, que era donde vivía la afirmación equivocada. Sin
esto, quien retire la aserción del borrador por «redundante» deja el AC medio verificado con el
conteo en verde.

### 5. Dos desviaciones menores, ratificadas

- **`disabled?: boolean` de `plan.md` §4.4 se retira.** El propio plan lo llamaba «reservado, hoy no
  se usa» y la decisión C dice que la paleta **no se deshabilita nunca**: ningún test podía cubrirlo
  porque no había comportamiento que afirmar. T-006 lo implementó sin él, que era lo correcto. Un
  `prop` opcional que nadie pasa y ningún test defiende invita a que alguien lo use creyendo que está
  especificado; si algún día hace falta deshabilitar la paleta, eso es un AC.
- **El andamio vacío es parte del RED** → `spec.md` **§9.7** nueva, y una línea en `plan.md` §5. El
  RED de T-006 necesitó un módulo que existiera y no hiciera nada para fallar **por aserción** en vez
  de por resolución de módulo; es el mismo patrón que ya pasó en T-001 y T-005, tres veces en una
  sola spec. Un fallo `Cannot find module` es rojo, pero solo demuestra que el archivo no está, que
  ya lo sabíamos. Crear el andamio no es una trampa: es lo que hace que el RED demuestre algo.

### Archivos tocados

`spec.md` (encabezado, AC-20, AC-26, AC-27, AC-36 nuevo, §8 decisión F, §8 riesgo #2, §8 riesgo #11
nuevo, §8 recuento, §9.7 nueva, §11 trazabilidad) · `plan.md` (encabezado, §4.4, §4.6, §5) ·
`tasks.md` (encabezado, T-006…T-009 a `[x]`, **T-011** nueva, reparto, lista de intocables) ·
`CHANGELOG.md` · `IMPLEMENTATION.md` · `specs/README.md`. **Ni una línea de `apps/**` ni de
`packages/**`**: el código de T-011 lo escribe el agente `frontend` cuando se despache.

## v0.1.2 — 2026-07-29

**Patch de corrección, escrito con T-001…T-005 ya implementadas, verdes y verificadas.** No añade
alcance ni trabajo: corrige un error aritmético, ratifica cinco decisiones que el agente tuvo que
tomar porque la spec no las definía, y actualiza el plan para que describa la firma que de verdad se
implementó. **El recuento pasa de 34 a 35 AC** —AC-35, nuevo— **y sigue en 10 tareas**; ninguna tarea
se movió de sitio, cambió de dependencia ni cambió de agente.

**Por qué es patch y no minor pese a añadir un AC.** AC-35 no abre alcance: describe comportamiento
que **T-004 ya implementó y ya cubre con test** (matado por la mutación **M26**). Es «precisión de
criterios» en el sentido literal de la regla de versionado del proyecto: el hueco estaba en la spec,
no en el código. Lo que sí habría sido minor es lo contrario —descubrir el hueco y dejarlo abierto—.

### 1. El catálogo tiene **16 elementos**, no 14 — error aritmético, corregido en ocho sitios

`spec.md` §6 enumera **4 + 7 + 5**: «Formato» 4 (`bold`, `italic`, `strikethrough`, `inlineCode`) ·
«Bloques de texto» 7 (`heading1`, `heading2`, `heading3`, `quote`, `bulletList`, `numberedList`,
`taskList`) · «Insertar» 5 (`link`, `image`, `codeBlock`, `table`, `divider`). La propia enumeración
de **AC-16** nombra 16 y **AC-30** espera 16 elementos HTML distintos: el «14» era el número
equivocado desde la v0.1.0, y contradecía a la propia spec en dos sitios.

Corregidos los **ocho** sitios señalados —`spec.md` AC-16, §6, §8.1 fila C, §8 riesgo 6 · `tasks.md`
T-005 (título y RED) y T-006 (RED, dos veces)— **y dos más que el barrido encontró**: `plan.md`
decisión 5 («Catorce `<button>` sueltos… Catorce paradas de tabulación») e `IMPLEMENTATION.md`
(«una sola parada de tabulación para catorce botones»). Donde el número aparecía deletreado:
**dieciséis** botones, **quince** con `tabIndex=-1`, **dieciséis** paradas de tabulación potenciales.

Las entradas **v0.1.0 y v0.1.1 de este mismo CHANGELOG conservan el «14» a propósito**: un historial
que se reescribe deja de ser historial. El error existió y esta entrada es donde consta que existió.

### 2. **AC-35 (nuevo)** — ningún bloque destruye la selección de la persona

El caso «bloque con selección activa» no estaba definido para `table` ni para `divider`. Leído a lo
bruto, «el bloque sustituye la selección» significa que un clic en «Separador» con un párrafo
seleccionado **borra el párrafo** —sin aviso y sin deshacer, porque la `004` no tiene deshacer (§4)—.
Eso no es una molestia de interfaz: es **pérdida de trabajo de la persona**, y por eso lleva AC propio
en vez de una nota al pie.

La decisión implementada, que se ratifica: la marca de catálogo **`consumesSelection`**, y **solo
`codeBlock` la lleva a `true`** —es el único de los tres cuyo contenido es el texto de la persona
(AC-14)—. Tabla y separador respetan la selección y se abren **detrás** de ella. Cubierto por
`markdown-insert.test.ts` y matado por la mutación **M26**. Es dato del catálogo y no una rama por
`id` para que el elemento que alguien añada mañana **tenga que declararlo**, en vez de caer en la
rama por defecto sin que nadie lo decida.

### 3. Cuatro huecos más que el agente resolvió, ratificados como precisiones

Los cuatro estaban ya implementados y con test; la v0.1.2 escribe la regla:

| Hueco | Regla ratificada | Dónde |
|---|---|---|
| **AC-12 vs AC-13** se rozaban y «abajo» no estaba definido al final del documento | El bloque **siempre cierra su línea con `\n`**, y la línea en blanco entera solo aparece **del lado donde hay texto**. Una sola regla satisface los dos AC sin caso especial | `spec.md` AC-13 · `plan.md` §4.2 |
| **«el borde de línea más cercano al cursor»** (`plan.md` §4.2) no lo cubría ningún AC y **no definía el empate**, que ocurre cada vez que el cursor está en mitad de la línea | Distancia al inicio frente a distancia al final, **empate al inicio**. Implementado literal y con test propio. Si algún día se prefiere «siempre el final de la línea», es un cambio de una línea y de un test — pero hay que **decidirlo**, no dejarlo al azar de un `<=` | `plan.md` §4.2 · `tasks.md` T-004 |
| **AC-8/AC-9** hablaban de selección multilínea; la **selección parcial de una sola línea** no estaba definida | Unificado: **cualquier selección no vacía** prefija el bloque de líneas entero. Un prefijo es una operación sobre líneas, así que «media línea» no es un caso distinto | `spec.md` AC-8 |
| **AC-9** decía «líneas vacías» y no decía nada de las de solo espacios | Cuentan como vacías (**superconjunto estricto**, no contradice ningún caso anterior): un `-    ` colgado rompe la lista igual que el `- ` sobre la línea vacía de verdad, y a simple vista no se distinguen. Mutación **M19** | `spec.md` AC-9 |

### 4. `plan.md` §4.2 se pone al día con la firma real de `selectTargetWhenWrapping`

Se escribió `selectTargetWhenWrapping: true` (booleano) y se implementó `?: string` con el fragmento
literal de `after` que queda seleccionado. **Desviación consciente y ratificada**: mismo nombre, dato
explícito. Con el booleano el núcleo tiene que **deducir** qué trozo de `after` seleccionar analizando
los paréntesis de `](https://ejemplo.com)` —un miniparser de plantillas dentro de una función de
cadenas, para recuperar algo que el catálogo ya sabe—. Con la cadena es `after.indexOf(target)`, cero
magia, y hay una invariante que **el booleano no permitía afirmar**: el valor declarado es siempre un
fragmento de `after`, y hay test que lo comprueba.

### 5. Nota de implementación para T-006, ya medida con mutación

El **orden de pintado y el recorrido de las flechas salen del orden de `MARKDOWN_PALETTE`**, no de
`Object.keys(PALETTE_GROUP_LABELS)`. El primero es contrato afirmado con test (**M41**, que reordena
el catálogo, mata tests); el segundo **no es contrato de nada** (**M38**, que reordena las claves del
objeto de rótulos, **sobrevive — y debe sobrevivir**). Queda escrito en `tasks.md` T-006 y en
`plan.md` §4.4 antes de despachar la tarea.

Y con ello se resuelve el bloqueo de T-006: **AC-24 exige `aria-label` en cada `role="group"`** y la
lista de artefactos de T-006 no incluía `markdown-palette.ts`, donde el agente de T-005 ya había
puesto `PALETTE_GROUP_LABELS`. **Se bendice el catálogo como su sitio** —son copia de interfaz en
castellano, del mismo tipo que las etiquetas de los botones que ya viven ahí, con un solo dueño y un
solo test— y T-006 los **consume**. Su lista de artefactos se queda como estaba, ahora diciendo
explícitamente que `markdown-palette.ts` se importa y no se toca.

### 6. Lección operativa: la guarda de pureza no puede convivir con un comentario que la explique

Escrita en **`spec.md` §9.6** y resumida en `plan.md` §5, que es donde la encontrará la `006` o
cualquiera que reutilice el patrón de `no-dangerous-html.test.ts`.

La guarda lee el **código fuente** con `readFileSync` y **no distingue código de comentario ni de
cadena de texto**: en un archivo vigilado no se puede deletrear `zustand`, `document.`, `window.` ni
`from 'react'` **ni siquiera en prosa**. Un comentario tan razonable como «esta función no conoce
`window`» pone el archivo en rojo, y el rojo es **correcto**: la guarda hace lo que dice hacer. La
salida es escribir esos comentarios en castellano sin los términos literales —«no sabe nada de la
interfaz, del estado de la aplicación ni del navegador»—, que además se lee mejor; hacer la guarda
«lista» sería peor, porque convierte cuatro líneas sin falsos negativos en un analizador que hay que
probar aparte.

**Consecuencia para las listas de artefactos**: la tarea que crea un módulo vigilado debe incluir **el
comentario de cabecera del archivo** entre sus artefactos. En la `004` no estaba previsto y T-005 tuvo
que reescribir la cabecera de `markdown-insert.ts` con una lista que decía «solo el `import` de los
tipos». **Ratificado**: el agente lo reportó él mismo, el archivo era suyo desde T-001 y no hubo
cambio de comportamiento — pero la lista estaba mal, y esto solo sale bien cuando el agente para y
avisa. `tasks.md` T-005 ya lo recoge.

### Estado verificado al escribir este patch

`pnpm --filter @one-markdown/web test markdown-insert` → **48 passed** ·
`… test markdown-palette` → **43 passed** · `pnpm --filter @one-markdown/web test` → **18 archivos /
412 passed** · `pnpm typecheck` → **0** · `pnpm lint` → **0**. Corridos por el orchestrator, no
reportados por el agente. **T-001…T-005 cerradas**; T-006 desbloqueada.

Archivos de este patch: `spec.md` · `plan.md` · `tasks.md` · `CHANGELOG.md` · `specs/README.md` ·
`IMPLEMENTATION.md`. **Ni una línea de código de `apps/web`.**

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
