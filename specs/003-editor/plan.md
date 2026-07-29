# Plan 003 — Editor: vista texto/preview, guardado y sanitización del preview

Spec de referencia: `spec.md` v0.1.0

## 1. Dependencias y verificaciones previas

### 1.1 Dependencias nuevas — solo en `apps/web`, solo tres, y solo una tarea las instala

`apps/api` y `packages/shared` **no añaden nada**. `apps/web` añade tres paquetes, todos a
`dependencies` (van al bundle):

| Paquete | Versión fijada | Para qué | Comprobado |
|---|---|---|---|
| `react-markdown` | **10.1.0** | Convierte markdown en **elementos de React**, sin generar nunca una cadena de HTML | `npm view` el 2026-07-28: `latest` = `10.1.0`. `peerDependencies` = `{ react: '>=18', '@types/react': '>=18' }` → **React 19.2.8 lo satisface**. `type: 'module'` (ESM puro; Vite y Vitest lo manejan de forma nativa) |
| `remark-gfm` | **4.0.1** | Tablas, listas de tareas, tachado y enlaces automáticos (spec §4: la paleta de `004` los va a ofrecer) | `npm view` el 2026-07-28: `latest` = `4.0.1`, `type: 'module'`, sin peer de React |
| `rehype-sanitize` | **6.0.0** | Lista blanca de elementos y atributos sobre el árbol ya construido | `npm view` el 2026-07-28: `latest` = `6.0.0`, depende de `hast-util-sanitize` ^5.0.0, `type: 'module'` |

**Ninguna otra tarea instala nada.** Solo `T-011` toca `apps/web/package.json`. Si alguna otra tarea
parece necesitar un paquete, **para y reporta**: se fija la versión contra npm y se verifica la API con
`context7` antes de escribirla aquí, como se hizo en `001` con `otplib` (donde ese paso evitó
implementar contra una API que había cambiado de major).

`rehype-raw` **no se instala**, y no es un olvido: instalarlo es exactamente lo que convertiría el
HTML del markdown en elementos. Ver decisión 6.

### 1.2 Lo que se verificó, y cómo

Documentación consultada con `context7` el **2026-07-28** (`/remarkjs/react-markdown` y
`/rehypejs/rehype-sanitize`):

| Qué se verificó | Resultado | Dónde se usa |
|---|---|---|
| Postura de seguridad de `react-markdown` | «By default, `react-markdown` is secure. […] To ensure maximum safety and control over allowed content, it is **highly recommended** to use `rehype-sanitize`» | Decisión 6 |
| `defaultUrlTransform` | Bloquea protocolos peligrosos y deja pasar `http`, `https`, `mailto` y las rutas relativas: `defaultUrlTransform('javascript:alert(1)')` → `''` | Capa 4 del modelo de amenaza |
| `defaultSchema` de `hast-util-sanitize` (estilo GitHub) | `protocols.href` = `['http','https','irc','ircs','mailto','xmpp']`, `protocols.src` = `['http','https']`. **No** permite `style`, `target`, `rel` ni `className` libre en `*`; sí `className` restringido en `code` (`/^language-./`) y en el `a` de nota al pie; permite `input` para las listas de tareas de GFM; `clobberPrefix: 'user-content-'` sobre `id`/`name` para evitar *DOM clobbering* | Decisión 7: se usa **sin modificar** |
| `allowedElements` / `disallowedElements` / `skipHtml` | Existen, filtran por nombre de elemento | Descartados en la decisión 6 (filtrar por nombre no cubre atributos ni protocolos) |

### 1.3 Y lo que se **midió**, porque la documentación no lo dice

Las tres librerías se instalaron en un directorio de usar y tirar fuera del repositorio, se renderizó
un corpus de cargas con `renderToStaticMarkup` y se comparó la salida con y sin `rehype-sanitize`.
Esto es lo que salió, y es lo que fija la decisión 6:

| Entrada markdown | Sin `rehype-sanitize` | Con `rehype-sanitize` |
|---|---|---|
| `<script>alert(1)</script>` | `&lt;script&gt;alert(1)&lt;/script&gt;` (texto escapado) | **`""` — desaparece** |
| `texto <b>negrita</b> fin` | `<p>texto &lt;b&gt;negrita&lt;/b&gt; fin</p>` | `<p>texto negrita fin</p>` |
| `<!-- oculto -->visible` | `&lt;!-- oculto --&gt;visible` | **`""` — «visible» desaparece también** |
| `<svg onload="alert(1)"></svg>` | `<p>&lt;svg onload=…&gt;&lt;/svg&gt;</p>` | `<p></p>` |
| `[pincha](javascript:alert(1))` | `<p><a href="">pincha</a></p>` | `<p><a>pincha</a></p>` |
| `![alt](javascript:alert(1))` | `<p><img alt="alt"/></p>` | igual |
| tabla, lista de tareas, tachado, enlace automático de GFM | intactos | **intactos** |
| ` ```js ` | `<pre><code class="language-js">` | **igual** — la clase sobrevive |

**Dos conclusiones que no eran obvias y que cambian el diseño:**

1. **Sin `rehype-sanitize`, `react-markdown` ya es seguro con estas cargas**: el HTML del markdown no
   se convierte en elementos, se **escapa como texto**. No hay `<script>`, no hay `onerror`, y el
   `urlTransform` por defecto ya vacía el `href` de un `javascript:`.
2. **Con `rehype-sanitize` y nada más, el preview borra texto que la persona escribió.**
   `<!-- oculto -->visible` se queda en **nada**: markdown trata la línea entera como un bloque HTML,
   `hast-util-sanitize` descarta los nodos `raw`, y con ellos se va la palabra «visible». Para un
   editor, que el preview se coma prosa es un defecto, no una medida de seguridad.

De ahí sale el paso propio `rehypeRawAsText` (decisión 6), que se midió también: con él en la cadena
**antes** de `rehype-sanitize`, `<script>alert(1)</script>` vuelve a verse como texto literal,
`<!-- oculto -->visible` conserva «visible», `<b>` se ve escrito, y **todo lo de GFM sigue intacto**.
Es decir: seguro **y** sin pérdida.

### 1.4 Comprobado contra el código instalado, no solo contra la documentación

- **`@Throttled` a nivel de método gana al de clase.** `declaredThrottler` en
  `apps/api/src/common/throttle.ts` usa
  `reflector.getAllAndOverride(THROTTLE_METADATA, [context.getHandler(), context.getClass()])`, y en
  `getAllAndOverride` **el primer elemento del array gana**. Por tanto un
  `@Throttled('documentContent')` sobre el manejador anula el `@Throttled('workspace')` de la clase.
  Esto se verificó leyendo el archivo, no suponiéndolo: era la única incógnita que podía obligar a
  crear un controlador aparte.
- **`throttle-coverage.spec.ts` se satisface con la presencia literal** de la cadena `'@Throttled('`
  o `'@SkipThrottling('` en cada `*.controller.ts`, y su lista `KNOWN_CONTROLLERS` es un **suelo**, no
  una lista blanca: una ruta nueva en un controlador existente no exige tocarlo.
- **La suite e2e del API ya corre en serie**, pero por la **línea de órdenes**
  (`jest --config ./test/jest-e2e.json --runInBand` en `apps/api/package.json`), **no** por el
  archivo de configuración. `test/jest-e2e.json` no fija `maxWorkers` ni `runInBand`. Es un detalle
  frágil y por eso `tasks.md` lleva una sección propia sobre qué depende de él.
- **`Buffer.byteLength(content, 'utf8')` hoy solo se calcula en `createDocument`** del repositorio.
  El guardado tiene que recalcularlo, y si se copia la expresión los dos caminos pueden divergir: por
  eso se extrae a una función pura con test propio (decisión 4).
- **`updateDocument` del repositorio devuelve un resumen sin `content`** y su `UpdateDocumentData`
  solo tiene `title`/`titleKey`. El guardado necesita un método nuevo; no es una ampliación de este.
- **`AllExceptionsFilter` solo copia `code` cuando es un string no vacío** de una `HttpException`, y
  **nunca** de un error ajeno. `code` se omite del JSON cuando no lo hay (no viaja como `null`), que es
  de lo que dependen las aserciones de claves exactas.

## 2. Modelo de amenaza del preview

Esta sección es normativa: fija **qué se permite y qué se recorta**, y por qué. La afirmación que se
defiende es concreta: **ninguna cadena que un usuario pueda guardar como contenido de un documento
puede ejecutar código, navegar a un esquema peligroso ni cargar un recurso activo cuando se
previsualiza.**

### 2.1 Superficie

El contenido de un documento es texto arbitrario de hasta 200.000 caracteres controlado por su dueño.
Hoy los documentos no se comparten (spec `002` §4: sin compartir, sin enlaces públicos), así que el
atacante y la víctima coinciden. Eso **no** hace el problema teórico, por tres razones:

1. **Pegar es la vía de entrada real.** Copiar un README de un repositorio ajeno, un correo o una
   página web mete markdown de terceros en el documento de la víctima sin que ella lo escriba.
2. **La importación llegará** (spec `002` §4 la deja fuera de alcance pero no la descarta), y ese día
   el contenido pasa a ser de origen ajeno sin que el preview cambie.
3. **Compartir llegará.** El día que un documento se pueda enseñar a otra persona, el preview pasa a
   ser un vector de XSS almacenado clásico. Construir la defensa después es cambiar la clase de
   defecto de «no existe» a «existía y no se acordó nadie».

### 2.2 Las cinco capas, en orden y con lo que aporta cada una

| # | Capa | Qué impide | Qué pasa si se cae sola |
|---|---|---|---|
| 1 | **No se instala `rehype-raw`** | El HTML escrito en el markdown nunca se convierte en elementos: llega al árbol como nodos `raw` | Es la capa principal. Si alguien la quita para «soportar HTML», la 3 sigue en pie |
| 2 | **`rehypeRawAsText`** (propio, ~12 líneas, puro, sin dependencias) | Convierte cada nodo `raw` en un nodo `text`. Un nodo de texto **no puede** ser un elemento: React lo escapa al renderizar | Sin él, la capa 3 borra esos nodos y con ellos prosa del usuario (§1.3). No es una capa de seguridad: es la que hace que la 3 no cueste datos |
| 3 | **`rehype-sanitize` con `defaultSchema` sin modificar** | Lista blanca de elementos, atributos y protocolos sobre el árbol **final**, sea cual sea el plugin que lo haya producido | Es la capa que sobrevive a que alguien añada `rehype-raw`, un plugin de terceros o un `components` a medida en las specs `004`/`005` |
| 4 | **`urlTransform` por defecto de `react-markdown`** (no se sobrescribe) | `javascript:`, `data:` y compañía en `href`/`src` se vacían **antes** de llegar al árbol | Redundante con la 3, y a propósito: es la única que el README de la librería señala como la forma de romper su seguridad si se toca |
| 5 | **Nunca `dangerouslySetInnerHTML`** | En ningún punto existe una cadena de HTML que un parser pueda interpretar | AC-25 lo comprueba **mecánicamente** sobre todo `apps/web/src`, no por revisión |

### 2.2.1 Qué capa sujeta hoy, medido — y por qué la redundancia es el objetivo

`T-011` no se conformó con que el corpus pasara: fue quitando capas para ver **cuál** sujeta. Resultado
del 2026-07-28:

**Primera medición (con el corpus de 12 cargas):**

| Configuración | Casos en rojo |
|---|---|
| Las cinco capas | 0 de 51 |
| **Sin `rehype-sanitize`** | **0 de 51** |
| Sin `rehype-sanitize` **y** con `urlTransform` anulado | **3** (`javascript:` en enlace, `data:` en enlace, `javascript:` en imagen) |

Con ese corpus la defensa la sujetaban la capa **1** (no haber instalado `rehype-raw`) y la **4**
(`defaultUrlTransform`), y `rehype-sanitize` salía **redundante**. La conclusión que se escribió entonces
—que la redundancia era el objetivo y que una capa no se retira porque ningún test la eche de menos—
sigue siendo válida, pero **ya no hace falta apoyarse en ella**, porque la medición cambió.

**Segunda medición (2026-07-28, con la carga de imagen `irc:` añadida al corpus):
`rehype-sanitize` tiene un agujero propio con nombre y deja de ser redundante.**

Quitándolo, cae **exactamente** la carga `![logo](irc://…)`. La razón está en §2.3: `urlTransform` aplica
su regex de **seis** protocolos a **todas** las URL, imágenes incluidas, mientras que el esquema permite
solo `http`/`https` en `src`. Es decir, para los protocolos de `src` **`rehype-sanitize` es la única capa
que actúa**; ninguna otra lo cubre.

Esto se predijo al escribir la §2.3 de esta misma sección —«añadir esa carga convertiría la redundancia
en no-redundancia sin cambiar una línea de código»— y se confirmó añadiéndola. El corpus pasa de 12 a
**13** cargas, y las dos de `irc:` son deliberadamente complementarias: la de **enlace** documenta que el
protocolo **se permite** (AC-25 ampliado), la de **imagen** que **se recorta**, y juntas fijan la
asimetría `href`/`src` en el sitio donde se puede romper sin que nadie lo note.

**La regla sigue escrita, porque el razonamiento contrario llega solo**: una capa **no** se retira porque
ningún test la eche de menos; se retira cuando el escenario del que protege ha dejado de existir. Aquí ya
no hay que invocarla —hay un test que cae—, pero vale para las capas 1 y 2, que siguen sin tener un rojo
propio y siguen siendo las que de verdad sujetan el caso general.

### 2.3 Qué se permite

Lo que produce markdown estándar más GFM, tal como lo deja `defaultSchema`: encabezados, párrafos,
énfasis, listas (incluidas las de tareas, con su `input[type=checkbox][disabled]`), citas, líneas
horizontales, tablas, código en línea y en bloque (**con** su `class="language-…"`, para que el
resaltado sea un plugin futuro y no un rediseño), rutas relativas, y notas al pie de GFM con sus `id`
prefijados `user-content-`.

**Protocolos, corregidos el 2026-07-28 contra el código instalado** (aquí decía «`http`, `https` o
`mailto`», que era menos de lo que las librerías elegidas permiten):

| Atributo | Protocolos permitidos | Dónde está escrito |
|---|---|---|
| `a[href]` | `http`, `https`, `mailto`, **`irc`**, **`ircs`**, **`xmpp`** | `hast-util-sanitize/lib/schema.js:143` |
| `img[src]` | `http`, `https` — **más estrecho** | `hast-util-sanitize/lib/schema.js:145` |
| cualquier URL, antes del esquema | `/^(https?|ircs?|mailto|xmpp)$/i` | `react-markdown/lib/index.js:124` (`defaultUrlTransform`) |

La lista es la de GitHub y se acepta **tal cual**, que es lo que dice la decisión 7. Estrecharla exigiría
un esquema propio (descartado en la decisión 7) o sobrescribir `urlTransform`, que es justo lo que §2.2
marca como la única palanca que el README de `react-markdown` señala como forma de romper su seguridad.

**La asimetría entre `href` y `src` importa**: `urlTransform` aplica su regex de seis protocolos a
**todas** las URL, imágenes incluidas, así que quien recorta un `![x](irc://…)` a un `<img>` sin `src` es
**el esquema**, no `urlTransform`. Es el caso concreto donde `rehype-sanitize` hace algo que ninguna otra
capa hace.

### 2.4 Qué se recorta

- **Todo elemento fuera de la lista**: `script`, `iframe`, `object`, `embed`, `svg`, `math`, `form`,
  `style`, `link`, `meta`, `base`.
- **Todo atributo de evento** (`onclick`, `onerror`, `onload`, …): no está en la lista, y AC-25
  comprueba en negativo que no queda ninguno que empiece por `on`.
- **`style`**: fuera de la lista. Cierra la clase de ataques de exfiltración por CSS y el
  *clickjacking* por posicionamiento absoluto.
- **`target` y `rel`**: fuera de la lista, así que no hay `target="_blank"` y por tanto no hay
  `window.opener` que envenenar.
- **Protocolos que no sean los de §2.3**: `javascript:`, `data:`, `vbscript:`, `file:`.
- **Comentarios de HTML**: se ven como texto (capa 2), no se ocultan.

### 2.5 Lo que este modelo **no** cubre, escrito para que nadie lo dé por cubierto

- **Contenido remoto.** Un `![](https://tercero.test/pixel.png)` se carga y filtra la IP y el
  `User-Agent` de quien previsualiza. Bloquearlo es una `Content-Security-Policy` con `img-src`, que
  es una decisión de despliegue y **no** entra en esta spec.
- **La cadena de suministro.** El modelo asume que las tres librerías hacen lo que dicen. Las
  versiones están **fijadas exactas** aquí, y actualizarlas es un cambio de spec.
- **El texto en el modo de edición.** No hay nada que sanitizar: es un `<textarea>`, y su valor nunca
  se interpreta.

## 3. Constantes de dominio

Backend, en `apps/api/src/workspace/workspace.constants.ts` (junto a las de la `002`):

| Constante | Valor | Motivo |
|---|---|---|
| `MAX_DOCUMENT_CONTENT_CHARS` | `200_000` | **Ya existe** (spec `002`); el guardado lo reutiliza sin cambiarlo |
| `JSON_BODY_LIMIT` | `'2mb'` | **Ya existe**; sigue dando >4× de holgura sobre el contenido máximo en UTF-8 |
| Throttler `documentContent` | `120` / `60 s` / IP | Cupo **propio**, en `src/common/throttle.ts`. Con la coalescencia de AC-17 un editor no pasa de ~30 guardados/min, así que 120 da sitio a cuatro editores simultáneos tras el mismo NAT sin tocar el cupo de `workspace` |

Frontend, en `apps/web/src/features/editor/editor.constants.ts`:

| Constante | Valor | Motivo |
|---|---|---|
| `AUTOSAVE_DEBOUNCE_MS` | `1_500` | Suficientemente largo para que una frase escrita de corrido sea **un** guardado; suficientemente corto para que lo que se pierde en un cierre forzado sea despreciable (riesgo #7 de la spec). Con el debounce y la coalescencia, el techo de un editor son ~30 peticiones/min contra un cupo de 120 |
| `CONTENT_COUNTER_THRESHOLD` | `0,9 × MAX_DOCUMENT_CONTENT_CHARS` | El contador de caracteres restantes aparece **solo** al acercarse al límite (AC-30): permanente sería ruido en el 99,9 % de los documentos |

El límite de caracteres **no** se duplica a mano en el frontend: se importa de `@one-markdown/shared`,
que gana una constante `MAX_DOCUMENT_CONTENT_CHARS` del mismo valor.

**Precisión del 2026-07-28, porque la frase anterior decía «reexportada» y eso no es lo que se pudo
hacer.** `packages/shared` **no puede importar de `apps/api`**: la dependencia va al revés y el paquete
compartido es, a propósito, un paquete sin dependencias que viaja al navegador. Así que `T-006` no
reexportó nada: implementó un **valor espejo**. Hoy el `200_000` está escrito **dos veces**, en
`packages/shared/src/index.ts` y en `apps/api/src/workspace/workspace.constants.ts`, y el test de
`shared` solo fija **su propio** literal — o sea que si alguien sube el de `apps/api` a `300_000`, **la
divergencia no la detecta nadie** y el cliente ofrecería sitio que el servidor rechaza con un `400`.

**Decisión: se cierra en esta spec, con una tarea propia (`T-016`), y se cierra con un test de
acoplamiento en `apps/api`, no con una reexportación.**

La alternativa —que `workspace.constants.ts` haga
`export { MAX_DOCUMENT_CONTENT_CHARS } from '@one-markdown/shared'`— es más fuerte sobre el papel
(imposible divergir, en vez de divergencia detectada) y aun así se descarta, por una razón concreta:
**hoy la dependencia de `apps/api` sobre `packages/shared` es exclusivamente de tipos**. Los DTO hacen
`import type { … }`, que desaparece al compilar. Una reexportación sería la **primera** dependencia de
**runtime** del backend sobre el artefacto construido de `shared`, y pondría un límite de dominio del
servidor detrás de `packages/shared/dist`. Un `dist` rancio sirviendo un límite equivocado es
exactamente la clase de defecto que documentó AC-34 de la `002` —y que allí costó una sesión de
instrumentación—, con el agravante de que aquí el síntoma sería un `400` inexplicable en producción en
vez de una pantalla rota en desarrollo.

Un test que afirme la igualdad cuesta tres líneas, detecta la divergencia en el instante en que aparece
y **mantiene la dependencia en tipos**. Es menos elegante y más barato de sostener.

**Y deja escrita la dirección de la verdad, que es lo que se estaba erosionando**: la fuente es
`apps/api/src/workspace/workspace.constants.ts`, donde vive el razonamiento de por qué son 200.000 y
junto al `JSON_BODY_LIMIT` que hay que revisar si se toca. `packages/shared` lo **espeja** para el
navegador, igual que espeja los DTO como tipos. Nunca al revés.

## 4. Contrato de API

Prefijo global `/api`. Sigue en pie todo lo de la `002`: `@UseGuards(JwtAuthGuard)`,
`@CurrentUser() user: AuthenticatedUser`, `ParseUUIDPipe` en los `:id`, `ErrorResponseDto` como forma
única de error, y **toda entrada y toda salida por DTO explícito**.

### `PUT /api/workspace/documents/:id/content` — **ruta nueva**

- **Auth**: Bearer · **Propiedad**: `where: { id, userId }` — el `userId` sale del token, nunca de la
  petición
- **Throttler**: `@Throttled('documentContent')` **a nivel de método**, que anula el
  `@Throttled('workspace')` de la clase (§1.4)
- **Request DTO**: `SaveDocumentContentRequestDto`
  - `content: string` — `@IsString()`, `@MaxLength(MAX_DOCUMENT_CONTENT_CHARS)`. **Sin
    `@IsNotEmpty()`** y **sin `@Transform`**: vaciar un documento es legítimo (AC-2) y el markdown se
    guarda **byte a byte** como se escribió — recortar espacios finales aquí rompería el markdown
    (dos espacios al final de línea son un salto de línea) y haría que lo guardado no fuese lo escrito
  - `expectedVersion: number` — `@IsInt()`, `@Min(0)`. **Obligatorio**: sin él no hay concurrencia
    optimista, solo «el último gana»
- **Response DTO**: `WorkspaceDocumentContentResponseDto` (`200`) — `id: string` (uuid) ·
  `contentBytes: number` · `contentVersion: number` · `updatedAt: string` (ISO-8601). **No** devuelve
  `content` (sería duplicar hasta 800 kB en cada guardado automático) ni `title`/`directoryId` (esta
  operación no los toca, AC-9)
- **Errores**:
  - `400` — validación, o `:id` que no es uuid
  - `401` — sin bearer, o con un refresh token como bearer
  - `404` `DOCUMENT_NOT_FOUND` — no existe **o no es tuyo**, con la versión correcta o incorrecta
    (AC-7)
  - `409` `DOCUMENT_CONTENT_CONFLICT` — la `contentVersion` real no es la esperada
  - `413` — cuerpo por encima de `JSON_BODY_LIMIT`
  - `429` — cupo de `documentContent` agotado
- **Comportamiento**: un solo `updateMany` condicional
  `where: { id, userId, contentVersion: expectedVersion }`,
  `data: { content, contentBytes, contentVersion: { increment: 1 } }`. Si `count === 1`, se relee el
  resumen y se responde. Si `count === 0`, un `count({ where: { id, userId } })` desambigua: `0` →
  `404`, `≥1` → `409`. **No hay lectura previa**: comprobar antes de escribir dejaría una ventana
  entre la comprobación y la escritura, que es justo lo que este mecanismo existe para cerrar
- **Por qué `PUT` y no `PATCH`**: el cuerpo **reemplaza por completo** el subrecurso, y la operación
  es **idempotente respecto de su token**: reenviar el mismo cuerpo con la misma versión ya consumida
  da `409` y no un segundo cambio (AC-8). Un guardado automático reintenta, y esa es la propiedad que
  hace que un reintento no pueda duplicar nada

### Rutas de la `002` que cambian de **respuesta** (no de comportamiento)

| Ruta | Cambio |
|---|---|
| `POST /api/workspace/documents` | `WorkspaceDocumentResponseDto` gana `contentVersion` (`0` al crear) |
| `GET /api/workspace/documents/{id}` | Idem |
| `PATCH /api/workspace/documents/{id}` | **Sin cambios** — sigue devolviendo el resumen, **sin** `contentVersion` |
| `POST /api/workspace/documents/{id}/move` | **Sin cambios** |
| `GET /api/workspace/tree` | **Sin cambios** — los `documents` siguen sin `content` ni `contentVersion` |

Esto es lo que obliga a la enmienda de la `002` a v0.4.0 (`spec.md` §6). El resumen **no** gana
`contentVersion` a propósito: el árbol no lleva contenido, así que no tiene nada que versionar, y
añadírselo engordaría la única respuesta de la que la `002` se preocupó por el tamaño.

### Resumen: once rutas de workspace

| Ruta | Método |
|---|---|
| `/api/workspace/tree` | `GET` |
| `/api/workspace/directories` | `POST` |
| `/api/workspace/directories/{id}` | `PATCH`, `DELETE` |
| `/api/workspace/directories/{id}/move` | `POST` |
| `/api/workspace/documents` | `POST` |
| `/api/workspace/documents/{id}` | `GET`, `PATCH`, `DELETE` |
| `/api/workspace/documents/{id}/move` | `POST` |
| **`/api/workspace/documents/{id}/content`** | **`PUT`** ← nueva |

Diez de las once resuelven un `:id` y declaran `404`; `GET /tree` sigue siendo la única que no
(AC-12, y la decisión que la `002` fijó en su v0.2.2).

### Código de error de dominio nuevo

| `code` | HTTP | Cuándo |
|---|---|---|
| `DOCUMENT_CONTENT_CONFLICT` | `409` | La `contentVersion` real del documento no es la que envió el cliente |

## 5. Esquema / migración Prisma

Un solo campo, en un solo modelo:

```prisma
model Document {
  // … todo lo de la spec 002 sin cambios …

  /// Contador monótono que **solo** incrementa el guardado de contenido
  /// (`PUT /api/workspace/documents/:id/content`). Es el token de concurrencia optimista de la
  /// spec 003: el cliente devuelve el que leyó y el `where` del update lo exige, así que dos
  /// guardados desde la misma versión no pueden pisarse en silencio.
  ///
  /// **No** lo tocan renombrar ni mover, y ese es justo el motivo de que sea una columna propia y
  /// no `updatedAt`: renombrar desde la barra lateral movería `updatedAt` y haría fallar un
  /// guardado pendiente con un conflicto que no existe (spec 003, AC-9).
  contentVersion Int @default(0)
}
```

- **Sin índice.** Siempre se consulta junto a la clave primaria (`where: { id, userId,
  contentVersion }`), así que el índice de `id` ya resuelve la fila y el resto es un filtro sobre una
  sola tupla.
- **`@default(0)`** — los documentos que ya existen quedan en `0`, que es exactamente lo que
  `WorkspaceDocumentResponseDto` va a devolver de ellos. La migración no necesita relleno.
- **Nombre de la migración**: `document_content_version`. El prefijo de fecha lo pone Prisma, así que
  el nombre final será algo como `20260728xxxxxx_document_content_version` — es una predicción, no un
  requisito (en `001` y en `002` la predicción no coincidió).
- Tras `prisma migrate dev` hay que correr **`prisma generate`** aparte: con esta configuración
  `migrate dev` no regenera el cliente (CHANGELOG de `000`, v0.1.3).

**Alternativas descartadas** (ver decisión 2): una columna `contentUpdatedAt`, un hash del contenido,
y no tener columna y usar `updatedAt`.

## 6. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|---|---|---|
| 1 | **Endpoint nuevo `PUT /api/workspace/documents/:id/content`**, no una ampliación del `PATCH /:id` | Ampliar `RenameDocumentRequestDto` con `content?`; un `PATCH /:id` con `title?` y `content?`; `POST /:id/save` | Es la misma razón por la que la `002` separó renombrar de mover (su decisión 10), y aquí es más fuerte: (a) **modos de fallo distintos** — renombrar puede dar `409 DOCUMENT_TITLE_TAKEN` y guardar solo puede dar `409` de versión, y un DTO combinado haría que un guardado automático cada 1,5 s reenviara el título y pudiera chocar con un hermano **sin que el usuario haya tocado el título**; (b) **frecuencias incomparables** (decenas por minuto frente a una vez al mes), lo que además justifica un throttler propio, imposible de dar a la mitad de un endpoint; (c) **formas distintas** — guardar necesita `expectedVersion` y no debe devolver el texto, renombrar no necesita ninguna de las dos cosas; (d) ampliar el `PATCH` **rompería un comportamiento verificado** de la `002` (su DTO rechaza `content` con `400` por `forbidNonWhitelisted`) en vez de añadir una ruta, lo que convertiría la enmienda de la `002` en un **major** |
| 2 | **Concurrencia optimista con una columna `contentVersion Int`** que **solo** incrementa el guardado de contenido | `updatedAt` como token en el cuerpo; `If-Unmodified-Since`; `ETag` + `If-Match`; un hash del contenido; bloqueo pesimista; sin comprobación («el último gana») | `updatedAt` **lo mueven también renombrar y mover**, así que renombrar desde la barra lateral haría fallar el guardado pendiente con un conflicto falso — AC-9 existe para clavar la ortogonalidad, y con `updatedAt` sería imposible de cumplir. Además es `timestamp(3)`: dos guardados en el mismo milisegundo son indistinguibles. `If-Unmodified-Since` es aún peor: la fecha HTTP tiene resolución de **segundos**, así que la comprobación pasaría en silencio dentro del mismo segundo. `ETag`/`If-Match` es el mecanismo canónico de HTTP y se descarta por **tres razones concretas, no por gusto**: la regla dura del proyecto es que toda entrada y salida va por un DTO explícito y una cabecera no lo es; los guards de `packages/shared` validan **cuerpos**, así que el token quedaría fuera del único mecanismo que comprueba el contrato; y `expectShape` de `http.ts` solo ve el cuerpo, así que habría que abrirle un camino nuevo. Un hash del contenido no distingue «volví al texto anterior» de «no ha cambiado nada». El bloqueo pesimista exige liberar el bloqueo cuando el cliente desaparece, que es un problema mayor que el que resuelve. La `002` dejó esta decisión abierta a propósito en su riesgo #12 («no se añade una columna `version` por adelantado: sería especular sobre un mecanismo que `003` todavía no ha decidido»); esta spec la decide |
| 3 | **Un solo `updateMany` condicional**, sin lectura previa; la desambiguación `404`/`409` se hace **después** y solo si falló | `findFirst` y luego `update` (*check-then-act*); transacción `Serializable` | Comprobar y después escribir deja una ventana entre las dos operaciones, que es exactamente lo que este mecanismo existe para cerrar; y en la `002` ya se rechazó el mismo patrón para la unicidad de nombres (su decisión 8). `Serializable` no hace falta: la decisión depende de **una sola fila**, no de una foto del árbol, y la condición viaja dentro del `where`, así que PostgreSQL la resuelve de forma atómica en `READ COMMITTED`. Es también lo que hace `count: 0` ambiguo entre tres causas, y por eso la desambiguación es un `count` acotado por `{ id, userId }` que **nunca** puede llevar a un `409` sobre un documento ajeno (riesgo #3 de la spec) |
| 4 | **`contentBytesOf(content)` es una función pura en `src/workspace/document-content.ts`**, con test propio y sin infraestructura | Repetir `Buffer.byteLength(content, 'utf8')` en el guardado; dejarlo dentro del repositorio | Hoy el cálculo vive **solo** en `createDocument`. Con dos caminos escribiendo la misma columna derivada, el riesgo es el #2 de la `002`: un camino que se olvide de recalcularla rompe el invariante en silencio y para siempre. Una función con nombre y un test que ejercita el multibyte cierra eso, y sigue el precedente de `workspace-name.ts` y `tree-graph.ts`: el dominio puro no importa nada de Nest ni de Prisma |
| 5 | **Throttler nombrado propio, `documentContent` (120/min/IP), declarado a nivel de método** en el controlador existente | Dejar el guardado en el cupo de `workspace`; subir el límite de `workspace`; un controlador aparte | Mezclar un guardado automático de alta frecuencia con las lecturas del árbol hace que agotar uno agote el otro: el usuario perdería la barra lateral por escribir. Subir `workspace` cambiaría una constante de la `002` para un problema que no es suyo. Un controlador aparte era la salida si el decorador de método no ganase al de clase — **se verificó que sí gana** (§1.4), así que no hace falta partir el controlador. Y sigue la decisión 15 de la `002`: throttlers **nombrados y opt-in**, sin un `default` global |
| 6 | **`react-markdown` + `remark-gfm` + `rehypeRawAsText` (propio) + `rehype-sanitize`, y nunca `dangerouslySetInnerHTML`** | `marked` + `dompurify`; `markdown-it` + `dompurify`; `react-markdown` a secas; `react-markdown` + `rehype-sanitize` sin el paso propio; `skipHtml`; `allowedElements` | `marked`/`markdown-it` producen una **cadena de HTML** que hay que inyectar con `dangerouslySetInnerHTML`, así que la seguridad de la aplicación pasa a depender de configurar DOMPurify bien **en cada punto de uso**, para siempre. Además DOMPurify depende de la implementación del **DOM**: un test que pasa en jsdom no dice nada sobre Blink, y aquí la afirmación que hay que defender es sobre navegadores. `react-markdown` construye **elementos de React** desde un AST: no existe cadena de HTML en ningún momento, y sus transformaciones son independientes del DOM. `react-markdown` a secas ya es seguro con las cargas medidas (§1.3), pero esa seguridad es una propiedad de **la configuración de plugins de hoy**: el día que `004` o `005` añadan uno, se evapora sin avisar — `rehype-sanitize` es la capa que sobrevive a ese cambio, y es lo que el propio README de la librería recomienda. Y `rehype-sanitize` **solo** borra prosa del usuario (§1.3), de ahí el paso propio de ~12 líneas que convierte los nodos `raw` en nodos de **texto** antes de sanear: no puede introducir un elemento (un nodo de texto es estrictamente menos poderoso) y evita la pérdida. `skipHtml` y `allowedElements` filtran por **nombre de elemento** y no cubren atributos ni protocolos |
| 7 | **`defaultSchema` de `hast-util-sanitize` sin modificar** | Un esquema propio; ampliar el schema con `className` libre o con `target`/`rel` | Es el esquema de GitHub, revisado durante años y con las decisiones difíciles ya tomadas: `clobberPrefix` sobre `id`/`name`, `input` permitido solo para las listas de tareas, `className` restringido a `/^language-./` en `code`. Se midió que **no** rompe nada de lo que produce `remark-gfm` (§1.3). Un esquema propio sería una lista blanca sin auditar mantenida por este proyecto. Ampliarlo se decide **una ampliación cada vez**, con su AC |
| 8 | **El modo texto es un `<textarea>` plano** | CodeMirror 6; Monaco; un `contenteditable` propio | Un `contenteditable` propio es la peor opción posible (hay que reimplementar deshacer, IME, pegado y accesibilidad). Monaco y CodeMirror traen resaltado, pero: ~10 paquetes y un bundle mucho mayor; su accesibilidad y su deshacer hay que configurarlos, mientras que los del `<textarea>` son los del navegador; y sobre todo la paleta de la spec `004` necesita **insertar en la posición del cursor**, que en un `<textarea>` es `setRangeText`/`selectionStart` —API del DOM, estable, sin versión— y en CodeMirror es una API de transacciones que habría que especificar contra su versión concreta. Cambiar de opinión más tarde es una spec propia y **no rompe ningún contrato de servidor** |
| 9 | **El estado del editor vive indexado por `id` de documento** (`Record<string, EditorEntry>`) y todas las acciones reciben el `id` | Un singleton «documento actual» con `content`, `version`, `status` | El coste hoy es una clave de más en un diccionario; el coste de no hacerlo es que la spec `005` (tabs) tendría que reescribir el bucle de guardado entero. En `003` el diccionario tiene **como mucho una entrada**: al navegar fuera se fuerza el guardado y, si tiene éxito, la entrada se descarta (AC-28). Lo que `005` cambiará es la **política de desalojo**, no la forma |
| 10 | **`setDraft(id, texto)` es el único camino por el que cambia el contenido**, venga de donde venga | Que la vista escriba el estado y notifique al store; que la paleta de `004` tenga su propia acción | Es lo que hace que la spec `004` no tenga que tocar el guardado: calcula la cadena nueva, llama a `setDraft`, y el estado sucio, el debounce y la coalescencia reaccionan solos. Si hubiera dos caminos, uno de ellos acabaría sin marcar el documento como sucio, y eso es pérdida de datos |
| 11 | **El editor no recarga el árbol al guardar** | Recargar `GET /tree` tras cada guardado, como hace la `002` con sus mutaciones | Un guardado de contenido **no** es una mutación del árbol: no cambia `title` ni `directoryId` (AC-9). Lo único que queda obsoleto es el `contentBytes` del resumen, que la barra lateral no muestra. Recargar duplicaría el tráfico del editor y volvería a meter los guardados en el cupo de `workspace` por la puerta de atrás |
| 12 | **Tres estados de error distinguibles en el guardado** (`conflict`, `rejected`, `unreachable`) | El mensaje genérico único que usa la barra lateral | Es el riesgo #15 de la `002`, acotado a donde hay datos que perder. Los tres piden acciones distintas de la persona: elegir una versión, arreglar lo que el servidor rechazó, o esperar. Un mensaje único los presenta igual, que es justo lo que en la `002` ocultó un defecto real durante una sesión entera. **La barra lateral no se toca**: cambiarla es producto, y el riesgo #15 sigue abierto para ella |

## 7. Estructura de los módulos

### Backend — dentro del `WorkspaceModule` que ya existe

```
apps/api/src/workspace/
  document-content.ts                       # NUEVO · dominio puro: contentBytesOf
  document-content.spec.ts                  # NUEVO
  workspace.repository.ts                   # + saveDocumentContent; createDocument usa contentBytesOf
  documents.service.ts                      # + saveDocumentContent
  documents.controller.ts                   # + PUT :id/content, con @Throttled('documentContent')
  workspace.constants.ts                    # sin cambios
  dto/
    save-document-content.request.dto.ts    # NUEVO
    workspace-document-content.response.dto.ts  # NUEVO
    workspace-document.response.dto.ts      # + contentVersion
apps/api/src/common/
  throttle.ts                               # + 'documentContent' en THROTTLE_NAMES y THROTTLE_LIMITS
```

Se mantienen las reglas de la `002`: `document-content.ts` **no importa nada** de Nest, Prisma ni
HTTP; `workspace.repository.ts` sigue siendo el **único** archivo del módulo que menciona
`PrismaService` (lo comprueba `workspace-data-access.spec.ts`, que no hay que tocar); el servicio
orquesta y traduce errores; el controlador solo hace protocolo.

### Frontend — carpeta de feature nueva

```
apps/web/src/features/editor/
  DocumentEditorPage.tsx        # sustituye a features/workspace/DocumentViewPage.tsx
  MarkdownPreview.tsx           # el renderizador sanitizado, aislado para que 004 y 005 lo reutilicen
  rehype-raw-as-text.ts         # el paso propio, puro, sin dependencias
  editor.store.ts               # Zustand, indexado por id de documento
  editor.constants.ts
  SaveStatus.tsx                # role="status" / role="alert" según el estado
  ConflictDialog.tsx            # las dos resoluciones de AC-20
apps/web/src/test/
  markdown-xss-corpus.ts        # el corpus, compartido por el test de jsdom y el de Playwright
```

Carpeta aparte de `features/workspace/` a propósito: mantiene los conjuntos de archivos **disjuntos**
entre el agente que toca el árbol y el que toca el editor, que es lo que permite paralelizar
(`tasks.md`).

### Estado del editor

```ts
type SaveStatus =
  | 'clean' | 'dirty' | 'saving'
  | 'conflict' | 'rejected' | 'unreachable';

interface EditorEntry {
  readonly savedContent: string;   // lo último que el servidor confirmó
  readonly draft: string;          // lo que ve la persona; NUNCA se descarta ante un error
  readonly contentVersion: number; // token de concurrencia
  readonly status: SaveStatus;
  readonly error: string | null;
  readonly serverContent: string | null; // solo en 'conflict': lo que hay en el servidor
  readonly serverVersion: number | null; // solo en 'conflict': la versión que acompaña a serverContent
}
```

**`serverVersion` se añade el 2026-07-28, con `T-012`; este plan declaraba seis campos y hacían falta
siete.** Es un error de diseño de esta sección, no una licencia del agente: con solo `serverContent`,
`resolveTakeServer` deja el editor limpio **pero con el `contentVersion` viejo**, así que la primera tecla
siguiente dispara un guardado que vuelve al **mismo `409`**. El usuario resolvería un conflicto para caer
inmediatamente en él otra vez. Lo fija el caso «tras descartar mis cambios, el guardado siguiente ya no
vuelve a chocar», y es la clase de agujero que solo aparece al escribir el segundo paso del flujo.

Acciones: `open(id)` · `close(id)` · `setDraft(id, texto)` · `saveNow(id)` (explícito, cancela el
debounce pendiente) · `flush(id)` (al desmontar, AC-28) · `resolveKeepMine(id)` ·
`resolveTakeServer(id)` · `setViewMode(id, 'text' | 'preview')`.

Nada persiste en `localStorage`/`sessionStorage`, igual que el store de auth (`001`) y el del árbol
(`002`).

**Dos decisiones de `T-012` que son contrato y no detalle de implementación** (2026-07-28):

- **`open(id)` propaga el error en vez de tragárselo.** El store deja la entrada sin crear y deja que
  falle quien llamó. Es lo que permite que `DocumentEditorPage` conserve el tratamiento
  `loading`/`missing`/`error` que **AC-31 obliga a heredar** de la vista de la `002` —incluido el `404`
  que muestra «este documento ya no existe» y recarga el árbol—. Un store que se comiera el error dejaría
  a la página sin forma de distinguir esos tres estados, y la única salida sería un mensaje genérico:
  exactamente el riesgo #15 de la `002` reproducido en la pantalla nueva.
- **Si tras un `409` falla la relectura del documento, el estado es `unreachable`, no `conflict`.** Un
  conflicto que no puede enseñar el texto del servidor no se puede ofrecer a resolver: las dos opciones de
  AC-20 («conservar lo mío» / «descartar lo mío») necesitan las dos que `serverContent` exista.
  Anunciar un conflicto sin poder mostrar contra qué sería el aviso genérico que AC-19 existe para
  evitar, con el agravante de ofrecer botones que no pueden funcionar.

### Accesibilidad

- Conmutador de modo con el patrón WAI-ARIA *tabs*: `role="tablist"` con dos `role="tab"`,
  `aria-selected`, `aria-controls`, flechas izquierda/derecha para cambiar, y `role="tabpanel"`
  asociado por `aria-labelledby`.
- El `<textarea>` con nombre accesible que incluye el título del documento.
- El estado de guardado en `role="status"` (`aria-live="polite"`): «Guardando…» y «Guardado» **no**
  son alertas y no deben interrumpir a un lector de pantalla.
- Los errores de guardado en `role="alert"` aparte, que recibe el foco, igual que en la `002`.
- El diálogo de conflicto con `role="dialog"`, `aria-modal`, foco atrapado y devuelto al cerrar, y sus
  dos botones con nombre accesible explícito («Conservar mi versión», «Descartar mis cambios»), nunca
  «Sí»/«No».
- `Ctrl`/`Cmd`+`S` es un **atajo añadido**, no la única vía: hay un botón de guardar visible.

## 8. Estrategia de tests

| Nivel | Qué cubre | Dónde |
|-------|-----------|-------|
| unit (api, sin infraestructura) | `contentBytesOf` con multibyte y vacío (AC-3) · precedencia del throttler de método sobre el de clase (AC-10) | `apps/api/src/workspace/document-content.spec.ts`, `apps/api/src/common/throttle.spec.ts` |
| integración (api, base real) | `saveDocumentContent` del repositorio: `where` con `userId` **y** versión, `count: 0` con versión rancia, `contentBytes` recalculado, `title`/`directoryId`/`parentScopeId` intactos (AC-5, AC-9) | `apps/api/src/workspace/workspace.repository.spec.ts` (+ `test/fixtures/workspace-db.ts` ampliado con `content` y `contentVersion`) |
| e2e (api) | el endpoint entero: feliz, vacío, validación, límites, conflicto, concurrencia, propiedad y credencial, idempotencia por versión, ortogonalidad, `413` (AC-1…AC-9, AC-13) · cupo propio (AC-10) · `contentVersion` en las respuestas de documento (AC-11) · OpenAPI (AC-12) | `apps/api/test/workspace-document-content.e2e-spec.ts`, `workspace-document-content-throttle.e2e-spec.ts`, `workspace-documents.e2e-spec.ts`, `swagger.e2e-spec.ts` |
| unit (shared) | `contentVersion` en `isMarkdownDocument`, `isDocumentContentSaved`, y que `isDocumentSummary` **no** lo exija (AC-14) | `packages/shared/src/index.test.ts` |
| unit/componente (web) | cliente HTTP (AC-15) · store: apertura, sucio, debounce, coalescencia, adopción de versión, tres errores, dos resoluciones, `429` sin reintento, desmontaje (AC-16…AC-21, AC-28, AC-30) · preview: elementos, GFM y **corpus de XSS** (AC-24, AC-25) · página: roles, textarea, `Ctrl`+`S`, `beforeunload`, contador, casos heredados (AC-22, AC-23, AC-27, AC-29, AC-31) | `apps/web/src/features/editor/**/*.test.ts(x)`, `apps/web/src/shared/api/http.test.ts` |
| e2e (web) | recorrido con recarga (AC-32) · conflicto provocado por API (AC-33) · **corpus de XSS en Chromium real** (AC-26) · presupuesto de la suite (AC-34) | `apps/web/e2e/editor.spec.ts` |

Convenciones que se heredan de la `002` y siguen valiendo:

- **Un usuario nuevo por archivo e2e** (`uniqueEmail` de `test/fixtures/auth-e2e.ts`), borrado al
  final; la cascada limpia su workspace. **Nunca** un `deleteMany` sin `where`: la base es la de
  desarrollo del usuario.
- `resetThrottleCounters` en el `beforeEach` de los e2e del API, salvo en el archivo que agota cupo a
  propósito.
- Nombres únicos por caso dentro del usuario del archivo.
- El caso de concurrencia lanza las dos peticiones con `Promise.all` sobre el mismo `agent` y ordena
  los resultados por código antes de comprobarlos: el orden de llegada no es determinista, el
  **conjunto** `{200, 409}` sí.

Y una convención nueva, propia de esta spec:

- **El corpus de cargas de XSS vive en un único archivo** (`apps/web/src/test/markdown-xss-corpus.ts`)
  que importan tanto el test de jsdom como el de Playwright. Si vivieran en dos sitios, la
  verificación en navegador acabaría probando un corpus distinto —más corto— que la de jsdom, que es
  la forma silenciosa de perder la cobertura que más importa.

## 9. Orden de ejecución

Enmienda de la `002` → migración y dominio puro → repositorio → throttler → endpoint → contrato
compartido y respuestas → OpenAPI → cliente HTTP → preview → store → interfaz → e2e de navegador →
presupuesto de la suite.

Detalle, dependencias exactas y reparto por conjuntos de archivos disjuntos en `tasks.md`. Tres notas
de paralelismo:

- `T-002` (dominio puro) no depende de la migración y puede ir en paralelo con `T-001`.
- `T-010` (cliente HTTP) y `T-011` (preview) son independientes entre sí y del backend en cuanto
  `T-006` cierra el contrato compartido: el preview no toca la red y el cliente no toca el DOM.
- `T-011` es la **única** tarea que instala dependencias y la única que toca
  `apps/web/package.json`. Ninguna otra tarea de frontend debe empezar mientras esa instalación esté
  a medias, porque un `pnpm install` concurrente sobre el mismo *store* es la forma más rápida de
  dejar el `node_modules` en un estado que nadie sabe reproducir.
