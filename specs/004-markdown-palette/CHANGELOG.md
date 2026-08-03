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

---

## Registro de implementación — movido desde `IMPLEMENTATION.md` (2026-08-03)

> Trasladado **literal**, sin podar. El documento de seguimiento había crecido a 3.317 líneas y había
> dejado de servir de índice; el detalle de cada feature pasa a vivir con su feature. Si algo de aquí
> repite lo que ya dice el historial de versiones de arriba, se recorta cuando se tengan los dos
> delante — no antes.


### Planificación de la spec

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


### Fase 6 — Implementación de `004-markdown-palette`


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


### Nota del índice — movida desde `specs/README.md` (2026-08-03)

El índice volvió a ser una línea por spec; esta era su fila, literal.

- **Feature**: Markdown palette — paleta de elementos markdown insertables
- **Versión**: **0.3.1**
- **Depende de**: 003

**Estado tal como estaba escrito**: **complete** (2026-07-29) — **36/36 AC** y **12/12 tareas** (T-001…**T-012**), cerradas y verificadas. **La v0.3.1 es un patch de enmienda pedido por la `006` y aplicado por su `T-000` sin tocar una línea de código**: la guarda de pureza de `markdown-palette.test.ts` pasa a vigilar también los dos módulos puros que estrena la `006` (`text-edit.ts`, `undo-history.ts`), y **AC-17 se redacta para que la lista pueda crecer** sin reescribir el criterio cada vez — qué módulos añade cada spec lo dice **su propio AC** y el recuento vive en `PURE_MODULES`, en ningún literal. **Patch y no minor** porque el recuento no se mueve (siguen 36 AC y 12 tareas) y lo que el AC exige de **sus** dos módulos es palabra por palabra lo mismo; lo que crece es el alcance de un instrumento. El argumento contrario —AC-17 sí cambia de redacción— queda escrito en su CHANGELOG porque era legítimo. Se descartó **un archivo de guarda nuevo** para la `006`: sería un segundo detector con la misma lista de tokens, la avería que la `005` pagó con seis ayudantes duplicados y dos ya divergidos — y **§9.6 de la propia `004` ya lo había anticipado por escrito**. **Consecuencia asumida**: desde el 2026-07-29 **AC-17 va por delante del código**, y la línea que mete los módulos en `PURE_MODULES` la escriben `T-001` y `T-002` de la `006`, porque hoy esos archivos no existen. Cifras del cierre: web **19 archivos / 470 passed** · `shared` **81** · api unit **305** · api e2e **511** · `--retries=2 --repeat-each=3` **27 passed sin un solo `429`** · typecheck 0 · lint 0. La **v0.3.0** es la versión de cierre y es **minor por una sola razón: el recuento de tareas se mueve** (11 → 12), que es la regla que la v0.2.1 fijó al justificarse a sí misma como patch. Añade **`T-012`** y **ningún AC**: `e2e/palette.spec.ts` —creado por `T-010`, **antes** de que existiera el nombre accesible— seguía distinguiendo las dos regiones vivas **por contenido**, y eso no era deuda estética sino un **hueco de verificación**: `filter({ hasText })` **no lee `aria-label`**, así que el test sobrevivía verde a la mutación que borra el nombre que AC-27 exige — un test incapaz de detectar la regresión del criterio que lo rodea. Verificado **por mutación** en vez de por RED (el comportamiento ya lo implementó `T-011`, así que un rojo artificial habría sido teatro): con el `aria-label` borrado, `element(s) not found`; restaurado, verde. Trae además **tres correcciones de redacción, las tres con la medición delante y ninguna relajando una aserción**: **(a)** la instrucción de **AC-36** sobre `takeRecords()` **no era implementable** —pedía contar «con `takeRecords()` y **no** con el callback» y la sonda dio **0 registros**; el motivo no es el mecanismo sino la semántica del observador, que **entrega la cola en cada punto de comprobación de microtareas** mientras `await user.click()` cruza varios, así que daría 0 con **cualquier** mecanismo—: el AC pasa a pedir acumular en el callback **y cerrar** con `takeRecords()`, que es la garantía que de verdad aporta (capturar el último lote de forma síncrona, sin `waitFor` ni relojes); **(b)** el **fallo esperado del RED 1(b) de T-011** no era el que ocurre —la spec predijo «1 registro en vez de 2» y en realidad el caso revienta **antes**, al buscar la región, porque los dos subcasos cuelgan de la **misma** precondición ausente; el «1 en vez de 2» sí aparece, pero como **mutación** sobre producción ya corregida, y la lección es que predecir el rojo de un subcaso dando por bueno que el anterior pasa es predecir mal—; **(c)** el mecanismo de reanuncio (**`U+200B`**) se **ratifica** —el espacio normal se descartó porque el whitespace es justo lo que colapsan `textContent`, jest-dom, Playwright y el cálculo de texto de un lector, y vaciar-y-reescribir porque React agrupa las dos actualizaciones en un render y exigiría `flushSync` o un temporizador— y **la aserción se ajusta al mecanismo**: el contenido final se afirma por **contención**, porque tras un número **par** de anuncios el `textContent` lleva el `U+200B` pegado y **no es literalmente igual** a la cadena del AC. Riesgos **#13** (el `aria-label` de una región viva puede locutarse **además** del contenido: aceptado, y a revisar **con lector real** en la `005`, que tendrá dos paletas — ningún test de este repositorio puede verlo) y **#14** (la suite de navegador y `pnpm dev` comparten el **5173** y no pueden coexistir; el API ya tiene puerto propio, **3011**, y al web le falta el suyo) quedan anotados con destinatario. La **v0.2.1** es un patch que **no mueve el recuento**: **AC-33 era autocontradictorio** —exigía un pico de `documentContent` **< 10 de 120** y mandaba verificarlo con `--retries=2 --repeat-each=3`, comando que **triplica el gasto dentro de la misma ventana de 60 s** del throttler porque la suite dura ~23 s—. Medido: **5 por corrida**, **15** repetido tres veces y **12 ya sin el caso nuevo**, o sea que **el criterio estaba roto antes de que la `004` existiera** y no lo introduce `T-010`. Se parte en **dos ventanas con dos comandos** (la cifra se mide con `test:e2e` sondeando Redis; con reintentos se afirma **solo** la ausencia de `429`). Descartadas **subir el número** —sería un número sobre el multiplicador y no sobre la suite, y cambiaría de significado al cambiar `--repeat-each`— y **recortar `editor.spec.ts`** —cuesta cobertura de una spec cerrada (el riesgo #10 de la `003` descarta las tres formas de bajarlo) para un presupuesto con **105 de margen**—. Precisa además **AC-32** (la parada del tabulador **ya es** «Negrita», así que el recorrido literal no exigía ninguna flecha: se hace de **ida y vuelta**) y deja la extracción de `watchConsole` como deuda de la `005`. La **v0.2.0** es el primer **minor** de esta spec y el único que ha añadido trabajo. Tres hallazgos con el código verde delante: **(1) AC-27 reescrito** — se implementó según su letra y la letra estaba mal: la región viva de la paleta entraba en el DOM **con su primer anuncio dentro**, y un lector anuncia los **cambios** de una región que ya conocía, no su aparición, así que en NVDA y JAWS podía no oírse nunca. **Verde en CI y falso para quien lo necesita**, en una spec cuyo bloque de accesibilidad tiene seis AC propios. Montar la región siempre choca con el `role="status"` **sin nombre** de `SaveStatus` y rompe **seis** aserciones de `getByRole('status')` sin desambiguar (dos de ellas de e2e, con **violación de modo estricto**): la salida es **poner nombre accesible a las dos** regiones, en la tarea **T-011** nueva —única autorizada a tocar `SaveStatus.tsx`, y solo para añadir un `aria-label`—. Se descartó documentar la limitación (deja publicado un criterio que el test confirma y el usuario no recibe) y aplazarlo (AC-27 quedaría marcado como verificado); pesó además que la **`005`** romperá esa misma consulta sola, porque con vista dividida habrá **dos** paletas. **(2) AC-36 nuevo** — insertar dos veces el mismo elemento **no reanuncia**, porque escribir el mismo texto no muta el DOM; se mide con `MutationObserver` + `takeRecords()`. **(3) AC-26 era literalmente inalcanzable** (entre el conmutador y la paleta vive el botón «Guardar» de la `003`): se corrige **la redacción, no la cabecera**, pasando a orden **relativo**. Y **(4) AC-20 no se puede medir contando peticiones**, que es lo que la spec decía: dos `setDraft` siguen dando **una** petición porque la coalescencia se lo traga — el conteo cubre «no hay un segundo camino de guardado» y la aserción del **borrador exacto** cubre «`setDraft` se llama una vez»; las dos mitades quedan escritas con su medida. Ratificadas dos desviaciones menores: `disabled?: boolean` **retirado** del plan (ningún test podía cubrirlo) y **el andamio vacío es parte del RED** (§9.7 nueva, tres veces pagado ya en esta spec). **Minor y no patch** por el mismo criterio que la v0.4.0 de la `002`: es aditivo, pero obliga a cambiar aserciones de tests verdes. La **v0.1.2** es un patch escrito **con el código delante**: corrige el recuento del catálogo (**16 elementos, no 14** — error aritmético que contradecía a la propia AC-16 y a AC-30, arreglado en diez sitios), añade **AC-35** —**ningún bloque destruye la selección de la persona**: solo `codeBlock` se la lleva dentro, tabla y separador la respetan; sin AC propio, un clic en «Separador» con un párrafo seleccionado lo borraba sin aviso y sin deshacer—, ratifica cuatro huecos más que el agente resolvió (separación de bloques, empate del borde de línea, selección parcial de una línea, líneas de solo espacios), pone `plan.md` §4.2 al día con la firma real de `selectTargetWhenWrapping` (`?: string`, no booleano) y deja escrita en **§9.6** la lección de que **la guarda de pureza no puede convivir con un comentario que la explique** (lee el fuente con `readFileSync` y no distingue código de comentario). Las **seis** decisiones abiertas de su §8 quedaron resueltas **todas en la opción recomendada**, sin mover un solo AC ni una sola tarea: marcador de posición **preseleccionado** · se **acepta** la pérdida de `Ctrl`+`Z` **con el remedio planificado** (→ `006`) · paleta **solo en modo texto** · **los tres** atajos `Ctrl`/`Cmd`+`B`/`I`/`K` acotados al `<textarea>` · tabla **fija 3 × 2** · **con** anuncio en región viva. **Primera spec del proyecto sin ninguna tarea de backend**: toca **exclusivamente `apps/web`**, y **AC-34** verifica que `packages/shared` y `apps/api` no se mueven (el servidor guarda el contenido como texto opaco y el catálogo no tiene consumidor de servidor; meterlo en `shared` habría comprado a cambio de nada el coste que la `002` pagó dos veces). **Cero dependencias y cero plugins de remark/rehype**, así que la cadena de saneado de la `003` no se toca ni hay que volver a medirla. Sí se **amplía el corpus de XSS** (AC-31) con tres contenedores que hoy no visita y que la paleta vuelve alcanzables de un clic —valla de código, celda de tabla, elemento de tarea—; la guarda de tamaño sube de `>= 10` a `>= 15` **en los dos archivos que la afirman**. Corrige un supuesto de la `003`: **no se usa `setRangeText`** (mutar el DOM por fuera de un control controlado lo pisa el render siguiente) y la restauración del caret es un AC propio. Y **devuelve** el «deshacer agrupado» que la `003` le había asignado: exigiría `execCommand`, deprecado y no implementado por jsdom. Y **§9 nueva (v0.1.1)**: la pila de deshacer propia queda planificada como trabajo futuro con destinatario —qué, por qué y cómo— y **asignada a la `006`**
