# Spec 003 — Editor: vista texto/preview, guardado y sanitización del preview

- **Versión**: 0.1.5 — **patch de precisión, escrito desde la `004` el 2026-07-29 y sin tocar código
  ni AC**. La spec sigue **complete, 34/34 AC · 17/17 tareas**. Único cambio: las notas de cierre
  daban la cifra de cupo «la suite gasta **4 de 120**» **sin decir en qué ventana se mide**, y es
  **por corrida**; bajo el comando de verificación de su propio AC-34 (`--retries=2 --repeat-each=3`)
  el pico real era **12 de 120**, porque la suite dura ~23 s y las tres repeticiones caen **dentro de
  la misma ventana de 60 s** del throttler y se suman. **AC-34 no cambia y sigue siendo cierto**: no
  lleva número, afirma «sin un solo `429`», y 12 de 120 lo cumple con holgura. Se escribe porque la
  `004` heredó esa cifra dentro de un criterio que **sí** llevaba número (su AC-33) y la convirtió en
  un AC autocontradictorio, y porque la `005` va a leer estas notas para dimensionar su presupuesto.
  Detalle en el CHANGELOG, v0.1.5.
- **Versión anterior**: 0.1.4 — **patch de cierre**. **Cerró la spec entera**: `T-013`, `T-014` y `T-015`
  implementadas y verificadas, con lo que la spec pasa a **34/34 AC · 17/17 tareas**. No añade alcance ni
  cambia ningún contrato. Lo que sí hace, además de cerrar, es **corregir una afirmación de la v0.1.2 que
  la implementación desmintió**: `plan.md` §2.2.1 decía que `rehype-sanitize` era **redundante**, y al
  añadir la carga de imagen con `irc:` dejó de serlo — es la **única** defensa de los protocolos de `src`,
  demostrado quitándolo y viendo caer exactamente esa carga. Y deja escrito, en la **§8** nueva, el
  trabajo futuro **con destinatario y con su razón**: la deduplicación de `open(id)` es de la `005`, y el
  caso de conflicto de AC-33 **no se estabiliza preventivamente**. La v0.1.3 fue el
  **patch** en el que **los 34 AC siguieron siendo 34** y uno cambió de redacción, **AC-25**, que
  se amplía a los protocolos que las librerías elegidas permiten de verdad (`irc`, `ircs`, `xmpp` en
  `href`; `http`/`https` en `src`): era un **descuido de redacción** que contradecía la decisión 7, no un
  agujero — ninguna carga pasaba sin ser vista, el criterio marcaba como defecto algo permitido a
  propósito. Además: §6 gana la fila de `workspace-fixtures.ts` (**segunda** vez que la lista se queda
  corta, y con la lección escrita), la fila de swagger pasa a **cuatro** recuentos, y quedan registrados
  el séptimo campo de `EditorEntry`, dos decisiones de `T-012` que son contrato, el reparto de
  `setViewMode`, la redundancia **medida** de `rehype-sanitize` y el coste del preview en el bundle. La
  v0.1.2 fue el **patch** que registró lo que la implementación destapó entre `T-001` y `T-008` y que la
  spec no decía: (1) AC-11
  gana el **mecanismo** de verificación sobre los `select` del repositorio, porque `T-007` **midió** que
  una columna de más en `DOCUMENT_SUMMARY_SELECT` es **indetectable por HTTP**; (2) la tabla de §6 gana
  una fila —`workspace.repository.spec.ts`— y precisa que los recuentos de `swagger.e2e-spec.ts` son
  **tres** y no dos; (3) `tasks.md` corrige una **regla mal escrita** sobre los resets de contadores y
  añade **`T-016`** (17 tareas), que cierra el espejo de `MAX_DOCUMENT_CONTENT_CHARS`; (4) `plan.md` §3
  sustituye una promesa que no se pudo cumplir («reexportada») por lo que de verdad se hizo y por la
  decisión de cómo cerrarlo. La v0.1.1 fue el **patch** de aprobación: registró que
  las **cinco decisiones abiertas** de §5 (filas A…E) quedaron **resueltas el 2026-07-28**, todas en la
  opción que el plan recomendaba, y que `T-000` está hecha. Se sigue el mismo convenio que en `001` y
  `002`: **aprobar no salta a 1.0.0** — lo que cambia al aprobar es el `Estado`; la versión sube solo
  porque el contenido de §5 cambió
- **Estado**: **complete** (2026-07-28) — **34/34 AC** verificados y **17/17 tareas** cerradas, todas con su comando corrido y su salida real. Fue **approved** el mismo día **sin cambios de alcance**: las cinco decisiones se aceptaron
  tal como estaban escritas.
  **Cifras del cierre**, corridas de una vez: `shared` **81** · `apps/web` 16 archivos / **321** · api
  unit 21 suites / **305** · api e2e 22 suites / **511** (40,2 s) · `pnpm test:e2e` **8** ·
  `--retries=2 --repeat-each=3` **24 passed, sin un solo `429`** (AC-34) · `typecheck` y `lint` en **0**
  en los tres paquetes.
  **Ningún AC queda sin cobertura automática**: a diferencia de la `002`, esta spec **no tiene ninguna
  salvedad de verificación manual**. Lo que sí quedan son **dos deudas con destinatario**, escritas en la
  §8: la deduplicación de `open(id)` (para la `005`) y la ventana estrecha del caso de conflicto de
  AC-33, que **no se estabilizó a propósito**. La implementación es la Fase 5 de `IMPLEMENTATION.md`
- **Fecha**: 2026-07-28 (aprobada, implementada y cerrada el 2026-07-28)
- **Depende de**: `000-foundation` (implemented) · `001-auth` (implemented) · `002-workspace-tree`
  (**v0.4.3** — árbol, documento con `id`, `content`, `contentBytes`, `contentVersion` y `updatedAt`,
  tipos `MarkdownDocument`/`DocumentSummary` en `packages/shared`, `code` en `ErrorResponseDto`)
- **Enmienda que esta spec obliga en la `002`**: `002` pasó a **v0.4.0** (minor), ejecutada por **`T-000`
  el 2026-07-28** y detallada en §6 — `spec.md` (AC-12, AC-15, AC-26, AC-31, AC-32, encabezado y
  trazabilidad), `plan.md` (§4, §5, §7) y su entrada de CHANGELOG. **`T-000` no tocó una línea de
  código**: los cambios de test los hicieron `T-007`, `T-009` y `T-012`, cada uno junto a la
  implementación que los provocó.
  Después llegaron tres patches: **v0.4.1** (dos bytes de control que rompían `grep`), **v0.4.2**
  (`workspace.repository.spec.ts`, hallado por `T-007`) y **v0.4.3**
  (`apps/web/src/test/workspace-fixtures.ts`, hallado por `T-012`). **Los dos últimos son la misma
  lección dos veces**: la lista de §6 se quedó corta porque el radio de un cambio de contrato incluye
  **los fixtures de test de los dos paquetes**, no solo los DTO. Las dos veces el agente **paró y
  reportó**, que es lo que hace que la lista cerrada valga para algo

## 1. Contexto y problema

Después de la spec `002` un usuario tiene un árbol: crea carpetas, crea documentos, los renombra, los
mueve, los borra y los abre. Lo que **no** puede hacer es escribir en ellos.

No es una carencia de la interfaz: es una carencia del contrato. Hoy **no existe ningún endpoint que
modifique `content`**. `PATCH /api/workspace/documents/:id` acepta exactamente un campo, `title`, y
como su DTO no declara `content` ni `directoryId`, el `forbidNonWhitelisted` del `ValidationPipe`
global los rechaza con un `400` explícito. La spec `002` lo dejó así a propósito y lo escribió en su
§4 de fuera de alcance: «el bucle de guardado (debounce, estado sucio, conflicto entre dos pestañas)
es el problema central de la spec `003-editor`». La consecuencia asumida —y hoy real— es que un
documento solo tiene el texto con el que nació, y como la interfaz crea documentos mandando solo
`title` y `directoryId`, **todos los documentos que existen están vacíos y no hay forma de cambiarlo**.

La vista `/documents/:id` que entró con la `002` es, también por escrito, un andamio: pinta el
markdown dentro de un `<pre>` y no renderiza nada. Su propio código lo dice («Andamio deliberado de
la spec `003`»). Esta spec la sustituye.

Hay tres problemas de fondo, y ninguno es «poner un `<textarea>`»:

1. **Cuándo se guarda y qué pasa cuando el guardado falla.** Un editor que solo guarda al pulsar un
   botón pierde trabajo; uno que guarda en cada tecla convierte cada pulsación en una escritura en
   PostgreSQL y en una entrada del rate limit. Y cuando el guardado falla —red caída, sesión
   caducada, cuerpo demasiado grande, cupo agotado— lo único inaceptable es **descartar lo que la
   persona escribió**.
2. **Qué pasa si el documento cambió por debajo.** No hace falta colaboración en tiempo real para
   tener el problema: basta con dos pestañas del mismo navegador, o una pestaña con el editor abierto
   y otra que renombra o edita. Sin una comprobación explícita, el último guardado gana y el trabajo
   del otro desaparece **en silencio**, que es la peor forma de perderlo.
3. **El preview convierte texto del usuario en HTML, y eso es una superficie de XSS.** Es el único
   punto de todo el producto donde una cadena que escribió una persona se transforma en nodos del
   documento. Aquí no vale «sanitizamos con lo que use todo el mundo»: hay que fijar la librería, su
   versión, qué se permite, qué se recorta, y **verificarlo en un navegador de verdad**, no solo en
   jsdom.

Además, esta spec es la primera con **dependencias nuevas en el frontend** desde el andamiaje inicial:
`apps/web` no tiene hoy ninguna librería de markdown. Eso obliga a fijar versiones y a comprobar sus
API antes de escribir una línea, que es lo que en la spec `001` evitó implementar contra la API de
`otplib` 12.x cuando la instalada era la 13.x.

## 2. Historias de usuario

- **US-1** — Como usuario, quiero escribir markdown en un documento y que se guarde solo mientras
  escribo, sin tener que acordarme de pulsar nada, para no perder trabajo por cerrar una pestaña.
- **US-2** — Como usuario, quiero saber en todo momento si lo que veo está guardado, guardándose o sin
  guardar, para no tener que adivinarlo.
- **US-3** — Como usuario, quiero poder forzar el guardado con `Ctrl`/`Cmd`+`S`, porque es lo que mis
  dedos hacen solos y no quiero que el navegador me abra un diálogo de «guardar página».
- **US-4** — Como usuario, quiero ver el markdown **renderizado** para comprobar cómo queda, y volver
  al texto para seguir editando, sin perder lo que llevo escrito ni la posición.
- **US-5** — Como usuario, quiero que si el guardado falla **no se me borre nada**: que el texto siga
  en pantalla y se me diga qué pasó, distinguiendo «el servidor lo rechazó» de «no se pudo llegar al
  servidor».
- **US-6** — Como usuario con el mismo documento abierto en dos sitios, quiero que la aplicación me
  avise de que cambió por debajo y me deje elegir, en vez de pisar el trabajo de uno de los dos.
- **US-7** — Como usuario, quiero que el preview no pueda ejecutar nada: si pego un documento de otra
  parte con `<script>` o un enlace `javascript:`, quiero verlo como texto, no sufrirlo.
- **US-8** — Como desarrollador de la spec `004`, quiero un punto único y documentado por el que
  insertar texto en el documento abierto, para que la paleta no tenga que tocar ni el guardado ni el
  estado sucio.
- **US-9** — Como desarrollador de la spec `005`, quiero que el estado del editor esté indexado por
  documento y que el guardado no dependa de «el documento actual», para poder tener varios abiertos
  sin reescribir el bucle de guardado.

## 3. Criterios de aceptación

Todo AC se verifica con **al menos un test automatizado**, y cada AC dice **con qué mecanismo**. Las
constantes que aparecen (`200.000`, `120/min`, `1.500 ms`) están fijadas y justificadas en `plan.md`
§3. Ningún AC de esta spec queda sin cobertura automática; si al implementarlos apareciera uno que
solo se puede comprobar a mano, se escribe en el propio AC como hizo la `002` con su AC-34, en vez de
fingir cobertura.

### Guardado de contenido (backend)

- **AC-1** — Dado un documento propio con `contentVersion: 0`, cuando se hace
  `PUT /api/workspace/documents/:id/content` con `{ "content": "# Hola ñ", "expectedVersion": 0 }`,
  entonces responde `200` con `WorkspaceDocumentContentResponseDto` — claves **exactamente**
  `id`, `contentBytes`, `contentVersion`, `updatedAt` y **ninguna más** (ni `content`, ni `title`) —
  con `contentVersion: 1`, `contentBytes` igual a la longitud en **bytes UTF-8** (el carácter
  multibyte lo hace distinto de la longitud en caracteres) y un `updatedAt` posterior al anterior; y
  en la base la columna `content` es exactamente lo que se envió.
  _Verificado por_: e2e de API contra la base real.

- **AC-2** — Dado un documento propio con contenido, cuando se guarda `{ "content": "" }` con la
  versión correcta, entonces responde `200` con `contentBytes: 0` y `contentVersion` incrementado, y
  la columna queda vacía. Vaciar un documento es una operación legítima y **no** un `400`.
  _Verificado por_: e2e de API. Existe para clavar el fallo clásico de añadir `@IsNotEmpty()` al DTO.

- **AC-3** — Dado un cuerpo con `content` ausente, no string, o de `200.001` caracteres; o con
  `expectedVersion` ausente, no numérico, no entero, o negativo; o con una propiedad no declarada,
  cuando se hace `PUT …/content`, entonces responde `400` con `ErrorResponseDto` cuyo `message`
  nombra el campo rechazado, y en la base **ni `content` ni `contentVersion` cambian**.
  _Verificado por_: e2e de API, comprobando la fila después de cada rechazo.

- **AC-4** — Dado un documento propio, cuando se guarda un `content` de **200.000** caracteres con la
  versión correcta, entonces responde `200` (el límite de cuerpo global de 2 MiB no rechaza un
  documento legítimo antes de que el DTO lo valide).
  _Verificado por_: e2e de API.

- **AC-5** — Dado un documento cuya `contentVersion` es `3`, cuando se guarda con
  `expectedVersion: 2`, entonces responde `409` con `code` `DOCUMENT_CONTENT_CONFLICT`, y en la base
  **el `content` y la `contentVersion` quedan exactamente como estaban** (el guardado perdedor no
  escribe nada, ni siquiera `updatedAt`).
  _Verificado por_: e2e de API.

- **AC-6** — Dado un documento propio, cuando dos peticiones simultáneas guardan contenidos distintos
  con **la misma** `expectedVersion`, entonces exactamente una responde `200` y la otra `409`, la
  `contentVersion` de la base avanza **exactamente uno**, y el `content` guardado es el de la que
  respondió `200`.
  _Verificado por_: e2e de API con `Promise.all` y ordenación por código, igual que AC-25 de la `002`.
  **Este archivo mide concurrencia: no puede correr en paralelo con otro que escriba en el mismo
  documento** (ver `tasks.md`, §«Suites que van en serie»).

- **AC-7** — Dado un documento de **otro** usuario, cuando se invoca `PUT …/content` con su `id` —con
  la versión correcta **o** con una incorrecta— entonces responde `404` con `code`
  `DOCUMENT_NOT_FOUND` en **los dos casos**, nunca `403` y **nunca `409`**: un conflicto de versión
  sobre un documento ajeno confirmaría que ese documento existe. Además: un `:id` que no es uuid →
  `400`; sin cabecera `Authorization` → `401`; con un **refresh token** como `Bearer` → `401`.
  _Verificado por_: e2e de API (matriz de propiedad y credencial, en la línea de AC-22/AC-23 de `002`).

- **AC-8** — Dado un documento propio, cuando se guarda el **mismo** contenido dos veces seguidas, la
  primera con la versión vigente responde `200` y devuelve la versión nueva, y la segunda **repitiendo
  la versión vieja** responde `409`; repetida con la versión nueva responde `200` otra vez. Es decir:
  la puerta es la **versión**, no la igualdad del contenido, y la operación es idempotente respecto de
  su token pero no respecto del cuerpo.
  _Verificado por_: e2e de API. Existe porque un reintento del guardado automático es exactamente este
  caso y no puede convertirse en un conflicto falso.

- **AC-9** — Dado un documento propio, cuando se **renombra** (`PATCH /:id`) o se **mueve**
  (`POST /:id/move`), entonces su `contentVersion` **no** cambia; y cuando se guarda contenido,
  entonces su `title` y su `directoryId` **no** cambian. Las tres operaciones son ortogonales.
  _Verificado por_: e2e de API. Es la propiedad que justifica la columna dedicada frente a usar
  `updatedAt` como token (`plan.md`, decisión 2): sin ella, renombrar desde la barra lateral haría
  fallar un guardado pendiente con un conflicto que no existe.

- **AC-10** — Dado el throttler `documentContent`, cuando un usuario supera su límite de guardados por
  minuto, entonces responde `429` con `ErrorResponseDto`; y **después de agotarlo**,
  `GET /api/workspace/tree` sigue respondiendo `200` — los guardados **no** consumen el cupo de
  `workspace`, ni al revés. Además, `apps/api/src/common/throttle-coverage.spec.ts` sigue en verde con
  la ruta nueva.
  _Verificado por_: e2e de API en archivo propio. **Agota cupo a propósito: va en serie** (ver
  `tasks.md`).

- **AC-11** — Dado un documento, cuando se pide `GET /api/workspace/documents/:id` o se crea con
  `POST /api/workspace/documents`, entonces la respuesta incluye `contentVersion` (`0` en un documento
  recién creado, tenga o no contenido inicial) y sus claves son exactamente las de
  `WorkspaceDocumentResponseDto`; cuando se **renombra** o se **mueve**, la respuesta es el resumen y
  **no** incluye `contentVersion` ni `content`; y `GET /api/workspace/tree` sigue sin incluir ninguno
  de los dos en sus `documents`.
  _Verificado por_: e2e de API **y**, además, por una aserción del juego **exacto** de claves de los dos
  `select` exportados del repositorio (`DOCUMENT_SUMMARY_SELECT` y `DOCUMENT_SELECT`), en
  `apps/api/src/workspace/workspace.repository.spec.ts`. Este AC es el que obliga a la enmienda de la
  `002` (§6): sus AC-12 y AC-15 afirman el juego exacto de claves y por tanto cambian.

  **Por qué la verificación por HTTP no basta aquí, medido y no supuesto.** `T-007` coló un
  `content: true` en `DOCUMENT_SUMMARY_SELECT` —el `select` del árbol— y **los 76 casos HTTP siguieron en
  verde** mientras `GET /api/workspace/tree` descargaba de TOAST el texto de **todos** los documentos del
  usuario. La razón es la regla dura del proyecto trabajando en contra: los DTO se construyen **campo a
  campo** y nunca por *spread*, así que una columna de más en el `select` **no puede** aparecer en la
  respuesta, y ninguna aserción sobre el cuerpo HTTP podrá verla jamás. El defecto es de rendimiento y de
  coste de lectura, no de contrato, y es **invisible por el único canal que esta spec verificaba**. De ahí
  que AC-11 se compruebe también sobre los `select`, que es donde el defecto vive. Es el mismo tipo de
  aserción mecánica que AC-22 de la `002` (`PrismaService` en un solo archivo): mira la forma del código
  porque el comportamiento observable no la delata.

- **AC-12** — Dado el API en entorno no productivo, cuando se hace `GET /api/docs-json`, entonces
  aparece `PUT /api/workspace/documents/{id}/content` con `security` `bearer` y respuestas `400`,
  `401`, `404`, `409`, `413` y `429` documentadas; existen los schemas `SaveDocumentContentRequestDto`
  y `WorkspaceDocumentContentResponseDto`; `WorkspaceDocumentResponseDto` declara `contentVersion`;
  **ningún** schema se llama como un modelo de Prisma (la lista se lee del `schema.prisma` real); el
  documento **no** menciona `nameKey`, `titleKey`, `parentScopeId` ni `userId`; y el tag `workspace`
  tiene **once** rutas, de las que **diez** resuelven un `:id` y declaran `404`.
  _Verificado por_: e2e de Swagger (ampliación del de la `002`).

- **AC-13** — Dado un usuario autenticado, cuando envía a `PUT …/content` un cuerpo JSON por encima de
  `JSON_BODY_LIMIT` (2 MiB), entonces responde **`413`** con la forma de `ErrorResponseDto`, y **no**
  `500`.
  _Verificado por_: e2e de API. Es una guardia de regresión sobre la ruta que de verdad va a recibir
  cuerpos grandes: el arreglo del filtro es global (AC-33 de la `002`) pero se rompería igual de
  silenciosamente aquí.

### Contrato compartido

- **AC-14** — Dado `@one-markdown/shared`, cuando se le pasa a `isMarkdownDocument` un objeto sin
  `contentVersion` o con un `contentVersion` no numérico, devuelve `false`; cuando se le pasa uno
  completo, `true`. `isDocumentSummary` **sigue devolviendo `true`** para un resumen sin
  `contentVersion` (el árbol no lo trae y no debe empezar a exigirlo). Existe además
  `isDocumentContentSaved`, que exige `id`, `contentBytes`, `contentVersion` y `updatedAt` y rechaza
  un `contentVersion` ausente o no numérico.
  _Verificado por_: unit de `packages/shared`.

### Cliente HTTP y estado (frontend)

- **AC-15** — Dado `saveDocumentContent(id, content, expectedVersion)`, cuando se llama, entonces
  emite un `PUT` a `/api/workspace/documents/:id/content` con el cuerpo exacto
  `{ content, expectedVersion }` y cabecera `Authorization`; valida la respuesta con
  `isDocumentContentSaved` y falla con `ApiError` si no cumple; y ante un `409` con
  `code: 'DOCUMENT_CONTENT_CONFLICT'` produce un `ApiError` cuyo `code` es exactamente ese.
  _Verificado por_: unit del cliente HTTP con `fetch` doblado.

- **AC-16** — Dado el store del editor, cuando se hace `open(id)`, entonces pide el documento y deja
  `{ savedContent, draft: savedContent, contentVersion, status: 'clean' }`; cuando `setDraft(texto)`
  recibe un texto distinto de `savedContent` el estado pasa a `dirty`, y cuando recibe uno **igual**
  vuelve a `clean` — deshacer hasta el original no es un cambio pendiente.
  _Verificado por_: unit del store.

- **AC-17** — Dado el guardado automático, cuando se llama a `setDraft` diez veces seguidas dentro de
  la ventana de debounce, entonces se emite **exactamente una** petición al vencerla; y cuando se
  edita mientras hay un guardado en vuelo, se encola **un solo** guardado final (coalescencia), nunca
  una cola que crezca con las pulsaciones.
  _Verificado por_: unit del store con temporizadores falsos, contando llamadas al cliente.

- **AC-18** — Dado un guardado con éxito, cuando la respuesta llega, entonces el store adopta el
  `contentVersion` devuelto y fija `savedContent` al texto guardado, el estado pasa a `clean`, y **el
  siguiente guardado envía la versión nueva**.
  _Verificado por_: unit del store, comprobando el argumento de la segunda llamada.

- **AC-19** — Dado un guardado que falla, cuando llega el error, entonces `draft` **conserva
  exactamente** el texto del usuario y el estado distingue **tres** situaciones, cada una con su
  mensaje y su tratamiento: `conflict` (`409` con `DOCUMENT_CONTENT_CONFLICT`), `rejected` (el
  servidor respondió y dijo que no: `400`, `404`, `413`, `429` — se muestra el mensaje del servidor) y
  `unreachable` (no hubo respuesta utilizable: `statusCode` `0`, cualquier `5xx`, o un cuerpo que
  incumple el contrato — mensaje propio, distinto del anterior).
  _Verificado por_: unit del store, un caso por rama.
  Este AC es la respuesta, **acotada al editor**, al riesgo #15 de la spec `002`: allí el aviso
  genérico presentaba igual un fallo del cliente y uno del servidor, y eso ocultó un defecto real. La
  barra lateral **no** se toca (§4); el riesgo #15 sigue abierto para ella, ahora con un precedente
  que copiar.

- **AC-20** — Dado el estado `conflict`, cuando el usuario elige **«conservar lo mío»**, entonces la
  aplicación relee el documento del servidor para obtener su `contentVersion` actual y reenvía el
  `draft` local con ella, terminando en `clean` y con el texto local guardado; y cuando elige
  **«descartar lo mío»**, adopta el contenido del servidor como `draft` y como `savedContent` y
  termina en `clean` **sin** emitir ningún `PUT`. No hay un tercer camino que pise o pierda algo en
  silencio.
  _Verificado por_: unit del store, las dos ramas, comprobando peticiones emitidas y texto final.

- **AC-21** — Dado un `429` en el guardado, cuando llega, entonces el `draft` sobrevive, el estado es
  `rejected` con el mensaje del servidor, y **no se dispara ningún reintento automático** (se cuenta
  que no hay una segunda petición durante la ventana siguiente). El reintento lo provoca la siguiente
  edición o el guardado explícito.
  _Verificado por_: unit del store con temporizadores falsos.
  Sin este AC la reacción natural —reintentar— convierte un `429` en una tormenta contra el mismo
  cupo que acaba de agotarse.

### Interfaz del editor

- **AC-22** — Dado un documento abierto, cuando se renderiza la página, entonces hay: un `h2` con el
  título, la ruta del documento (`nav` con el breadcrumb, heredado de la `002`), un conmutador
  `role="tablist"` con dos `role="tab"` («Texto» y «Vista previa») donde exactamente uno tiene
  `aria-selected="true"` y el panel correspondiente es un `role="tabpanel"` asociado por
  `aria-labelledby`, y una región de estado de guardado con `role="status"` (educada: «Guardando…» no
  es una alerta). Los errores de guardado van en un contenedor **`role="alert"`** aparte.
  _Verificado por_: unit de componente con Testing Library.

- **AC-23** — Dado el modo texto, entonces el panel contiene **un solo** control editable, un
  `<textarea>` con nombre accesible, cuyo valor es el `draft`; escribir en él llama a `setDraft`; y el
  conmutador de modo se puede alcanzar y accionar con el teclado (`Tab` hasta el `tablist`, flechas
  para cambiar de pestaña).
  _Verificado por_: unit de componente con `user-event`.

- **AC-24** — Dado el modo vista previa, entonces se renderiza el **`draft`** (no el `savedContent`:
  se previsualiza lo que se está escribiendo) y los encabezados, listas, énfasis, enlaces, imágenes y
  bloques de código aparecen como **elementos** del documento; y los elementos de GFM —tablas, listas
  de tareas, texto tachado y enlaces automáticos— también, porque la paleta de la spec `004` los va a
  ofrecer y no puede tener que añadir un plugin de parseo.
  _Verificado por_: unit de componente, un caso por familia de elemento.

- **AC-25** — Dado el corpus de cargas de XSS de `apps/web/src/test/markdown-xss-corpus.ts`, cuando se
  renderiza cada una en la vista previa, entonces: no se crea ningún `script`, `iframe`, `object`,
  `embed` ni `svg`; **ningún** nodo del subárbol tiene un atributo que empiece por `on`; todo `a[href]`
  tiene un protocolo de **`http`, `https`, `mailto`, `irc`, `ircs` o `xmpp`**, o es una ruta relativa, o
  carece del atributo; todo `img[src]` tiene un protocolo de **`http` o `https`** —la lista de `src` es
  **más estrecha** que la de `href`—, o es relativo, o carece del atributo; y **el texto que escribió la
  persona sigue apareciendo literalmente** — la sanitización no puede hacer desaparecer prosa. Además,
  de forma mecánica: la cadena `dangerouslySetInnerHTML` **no aparece en ningún archivo de
  `apps/web/src`**.

  _Ampliado el 2026-07-28 a los protocolos reales._ Hasta aquí este AC decía «`http`, `https`, `mailto`,
  o una ruta relativa», que **contradice la decisión 7** (`defaultSchema` sin modificar). Lo destapó la
  mutación **M3** de `T-011` —añadir una carga al corpus para comprobar que el mecanismo sigue vivo— y
  se verificó contra el **código instalado**, no contra documentación:

  - `react-markdown/lib/index.js:124` → `const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i`
  - `hast-util-sanitize/lib/schema.js:143` → `href: ['http','https','irc','ircs','mailto','xmpp']`, y
    en la línea 145 `src: ['http','https']`

  Las dos capas dejan pasar `irc:`, `ircs:` y `xmpp:` en un enlace, así que `[chat](irc://…)` sobrevive y
  el AC lo declaraba fallo. **Era un descuido de redacción, no un agujero**: no había ninguna carga que
  pasara sin ser vista, sino un criterio que habría marcado como defecto algo que las librerías elegidas
  permiten a propósito. `javascript:` y `data:` siguen bloqueados por las dos capas, que es lo que este
  AC existe para sostener.

  Se elige **ampliar el AC a la lista real** en vez de estrechar las librerías: mantiene intacta la
  decisión 7, no obliga a tocar `urlTransform` —que `plan.md` §2.2 señala como lo **único** que el README
  de `react-markdown` marca como forma de romper su seguridad— y es lo que GitHub lleva años permitiendo.

  **La asimetría `href`/`src` es la parte que no hay que perder**, porque es donde `rehype-sanitize`
  **no** es redundante: `urlTransform` aplica su regex de seis protocolos a **todas** las URL, incluidas
  las de imagen, y quien recorta `![x](irc://…)` a un `<img>` sin `src` es el esquema, no `urlTransform`.
  **Comprobado**: el corpus incorpora las dos cargas complementarias —`[chat](irc://…)`, que **se
  permite**, y `![logo](irc://…)`, que **se recorta**— y quitando `rehype-sanitize` cae exactamente la
  segunda. Es el único agujero con nombre propio del sanitizador (`plan.md` §2.2.1).
  _Verificado por_: unit de componente (jsdom) + una aserción que lee el árbol de archivos, en la
  línea de `workspace-data-access.spec.ts` de la `002`.

- **AC-26** — Dado **el mismo corpus** ejecutado en **Chromium real** con Playwright, con un manejador
  de `dialog` instalado y un centinela `window.__xssTripped`, cuando se pega cada carga en el editor y
  se pasa a vista previa, entonces no se abre ningún diálogo, el centinela sigue sin tocar, no hay
  errores de consola, y se repiten las aserciones de elementos y atributos de AC-25.
  _Verificado por_: e2e de navegador.
  **Por qué existe teniendo AC-25.** La seguridad del preview se apoya en un argumento —«las
  transformaciones son independientes del DOM, así que jsdom y Chromium coinciden»— y un argumento no
  es una medición. jsdom **no es un navegador**: no ejecuta `onerror` de una imagen rota, no navega
  ante un `href` `javascript:` y su parser difiere del de Blink. Un test que solo pasa en jsdom
  demuestra que el árbol es el esperado, no que el navegador no ejecute nada. Este es el AC que
  demuestra lo segundo, y es el análogo funcional de lo que la `002` aprendió con AC-32: JSDOM no
  vio ninguno de sus dos defectos de la v0.3.0.

- **AC-27** — Dado el editor con cambios sin guardar, cuando el usuario pulsa `Ctrl`+`S` (o `Cmd`+`S`
  en macOS), entonces se llama a `preventDefault` sobre el evento —el navegador no abre su diálogo de
  guardar página—, el guardado se emite **inmediatamente** sin esperar al debounce, y el debounce
  pendiente se cancela para que no haya un segundo guardado; y cuando el estado es `clean`, la misma
  pulsación **no emite ninguna petición**.
  _Verificado por_: unit de componente.

- **AC-28** — Dado el editor con cambios sin guardar, cuando se navega a otro documento o fuera de la
  aplicación, entonces el guardado pendiente se **fuerza** antes de desmontar; si tiene éxito, la
  entrada del documento se descarta del store; y si falla, la entrada **se conserva con su `draft`**,
  de modo que volver a ese documento restaura el texto sin guardar en vez de mostrar el del servidor.
  La navegación **no se bloquea** en ningún caso.
  _Verificado por_: unit del store y de componente (montar, ensuciar, desmontar, comprobar la petición
  y el estado resultante en las dos ramas).

- **AC-29** — Dado el editor sucio, entonces hay un manejador de `beforeunload` registrado que llama a
  `preventDefault` al dispararse; y en cuanto el estado vuelve a `clean`, el manejador está retirado y
  el mismo evento pasa sin tocarse.
  _Verificado por_: unit de componente, despachando el evento en las dos situaciones.

- **AC-30** — Dado un `draft` que supera `MAX_DOCUMENT_CONTENT_CHARS`, cuando se intenta guardar,
  entonces el servidor responde `400`, el estado queda en `rejected` con **el mensaje del servidor**,
  el `draft` sobrevive íntegro, y la interfaz muestra el contador de caracteres restantes (que aparece
  al acercarse al límite y no antes, para no ser ruido permanente).
  _Verificado por_: unit de componente + unit del store.

- **AC-31** — Dada la ruta `/documents/:id`, cuando se abre, entonces renderiza el editor y **ya no
  existe** la región `Markdown en crudo` de la `002`: no queda ningún `pre[aria-label="Markdown en
  crudo"]` en la aplicación, ni el archivo `DocumentViewPage.tsx`. Lo que sí sigue funcionando es lo
  que la `002` verificaba y sigue siendo cierto: el breadcrumb, el anuncio de carga, y el estado
  «este documento ya no existe» con recarga del árbol ante un `404`.
  _Verificado por_: unit de componente (los casos heredados de `DocumentViewPage.test.tsx` que siguen
  valiendo, trasladados) + una aserción negativa sobre el `aria-label` retirado.

### Recorrido en navegador y presupuesto de la suite

- **AC-32** — Dado el navegador real con web y api corriendo, cuando Playwright inicia sesión, crea un
  documento, lo abre, escribe markdown con un encabezado y una lista, espera al guardado automático y
  ve «Guardado», **recarga la página**, y comprueba que el texto sigue ahí; y después pasa a vista
  previa y ve el encabezado y la lista **como elementos**, entonces el recorrido completo pasa **sin
  errores de consola**. La recarga es la parte que importa: es lo único que demuestra que el texto
  llegó al servidor y no se quedó en el estado del cliente.
  _Verificado por_: e2e de navegador.

- **AC-33** — Dado el editor abierto con cambios locales, cuando otra petición (emitida con
  `page.request`, que comparte el tarro de cookies) guarda contenido distinto en ese mismo documento y
  después el editor intenta guardar, entonces aparece la interfaz de conflicto con sus dos opciones,
  y al elegir «conservar lo mío» el documento acaba conteniendo el texto local — comprobado releyendo
  el documento por API, no por lo que muestra la pantalla.
  _Verificado por_: e2e de navegador. Se provoca por API y no con un segundo navegador a propósito:
  dos contextos serían más lentos, más frágiles y probarían lo mismo.

- **AC-34** — Dada la suite de navegador ejecutada con `--retries=2 --repeat-each=3` (la configuración
  de reintentos de CI, con todos los casos agotándolos), cuando termina, entonces **pasa entera** y
  **ninguna** llamada a `POST /api/auth/register`, `POST /api/auth/login`, `PUT …/content` ni al resto
  de `/api/workspace/*` ha recibido un `429`.
  _Verificado por_: el comando completo, cuya salida es la verificación.

  **Precisión de la v0.1.5 (2026-07-29), que no cambia el criterio sino la contabilidad que lo
  acompaña.** Este AC **no lleva número y hace bien en no llevarlo**: afirma la ausencia de `429`
  bajo el comando con reintentos, y eso es cierto y sigue siéndolo. Lo que estaba mal escrito es la
  cifra de las notas de cierre —«la suite gasta 4 de 120»—, que es **por corrida**: bajo
  `--retries=2 --repeat-each=3` la suite entera (~23 s) repite **dentro de la misma ventana de 60 s**
  del throttler, así que los gastos **se suman** y el pico real era **12 de 120**. La regla que sale
  de aquí, y que la `004` escribió como riesgo #12 de su spec: **toda cifra de cupo lleva pegada su
  ventana y el comando con el que se mide**. Sin ventana, un número de cupo no es verificable aunque
  parezca el dato más concreto del criterio.

  **Por qué existe, y por qué es distinto del AC-34 de la `002`.** La `002` cerró su AC-35 con el
  presupuesto **agotado al milímetro**: 5 altas por IP cada 15 minutos y 10 entradas por minuto, y su
  arreglo dejó el gasto justo dentro. Esta spec añade **al menos un archivo e2e más**, cada uno con su
  `signIn`, y además consume un cupo que antes no existía (`documentContent`), con varios guardados
  por caso. Multiplicado por `--repeat-each=3` y `--retries=2`, volver a quedarse corto es lo
  esperable, no lo raro. El AC obliga a medirlo antes de dar la spec por cerrada.

  **La prohibición que se hereda, literal**: el reset de contadores que hace
  `apps/web/e2e/support/services.ts` **no se lleva a la suite del API**. Allí destruiría la única
  prueba de que los límites existen (`apps/api/test/auth-throttle.e2e-spec.ts` y
  `workspace-throttle.e2e-spec.ts`). Si el presupuesto no cuadra, se arregla gastando menos —una sola
  sesión compartida, menos guardados por caso— o reseteando **solo** en la suite de navegador.

  **Lo que NO necesita esta spec, y por qué se escribe aquí en vez de dejarlo por supuesto.** El
  AC-34 de la `002` (caché rancia de `optimizeDeps`) **no tiene análogo aquí**, aunque esta spec
  añada tres dependencias nuevas al frontend. Aquel defecto era específico de un paquete **enlazado
  del workspace**: Vite invalida su caché de dependencias por el hash del **lockfile** y por el de la
  **configuración**, y el *contenido* de `packages/shared` no entra en ninguno de los dos. Las tres
  dependencias de esta spec son paquetes de npm de verdad: instalarlas cambia `pnpm-lock.yaml`, el
  hash cambia y Vite reoptimiza sola. Y, con independencia de eso, `optimizeDeps.force: true` sigue
  puesto en `vite.config.ts` desde la `002`, lo que hace la pregunta discutible en este repositorio.
  Un AC de caché aquí sería teatro. Lo que sí hacía falta era otra cosa —una afirmación de seguridad
  verificada solo en jsdom— y esa es AC-26.

## 4. Fuera de alcance

- **Paleta de elementos markdown** (spec `004`). Lo que esta spec **sí** deja cerrado para ella, para
  que no tenga que suponerlo: (a) el modo texto es **un solo `<textarea>`** con nombre accesible, así
  que `selectionStart`/`selectionEnd` y `setRangeText` están disponibles sin API de terceros;
  (b) **todo** cambio de contenido entra por una única acción del store, `setDraft(texto)`, y el
  estado sucio y el guardado automático reaccionan a ella **sea quien sea quien la llame**; (c) por
  tanto la paleta solo tiene que calcular la cadena nueva y llamar a `setDraft`, sin tocar el
  guardado. Lo que **no** entra aquí es la propia API de inserción (`insertAtCursor`, deshacer
  agrupado, atajos por elemento): es alcance de `004`.
- **Tabs y split view** (spec `005`). Lo que esta spec deja cerrado: el estado del editor vive
  **indexado por `id` de documento** (`Record<string, EditorEntry>`), no en un singleton «documento
  actual», y el bucle de guardado recibe siempre el `id` como argumento. `005` cambiará la **política
  de desalojo** de ese diccionario (hoy: como mucho una entrada, la del documento abierto), no su
  forma. En `003` se abre **un documento a la vez**.
- **Ver texto y vista previa a la vez.** El conmutador de AC-22 es de **dos modos excluyentes**. La
  disposición lado a lado es alcance de `005`. Lo que `003` garantiza es que añadir un modo `'split'` es
  un cambio de **disposición**, no de estado de guardado.
  _Resuelto el 2026-07-28 (decisión E de §5, y fijado en `CLAUDE.md`)_: «split view» significa **texto y
  preview lado a lado del mismo documento**, no dos documentos distintos. Con eso, el split de `005` es
  literalmente esta misma pareja de paneles colocada de otra forma: los dos leen el **mismo** `draft` de
  la **misma** entrada del store, así que no hay un segundo estado que sincronizar ni un segundo bucle de
  guardado. Es el reparto más barato posible entre las dos specs, y es el que ya estaba implícito aquí.
- **Editar el título desde el editor.** Renombrar ya existe (`PATCH /:id`, spec `002`) y se hace desde
  el árbol. Meter un segundo camino obligaría a resolver el `409 DOCUMENT_TITLE_TAKEN` dentro del
  editor y a decidir si el título participa del guardado automático — dos problemas que no aportan
  nada a esta spec.
- **Colaboración en tiempo real, CRDT, cursores compartidos, presencia.** El mecanismo de esta spec es
  **concurrencia optimista con detección**, no fusión. Cuando hay conflicto se pregunta; no se mezcla.
- **Historial de versiones, deshacer entre sesiones, autoguardado local (`localStorage`).** El
  `draft` vive en memoria, igual que la sesión (spec `001`) y que el árbol (spec `002`). Guardar
  borradores en el navegador es una decisión de producto con su propio modelo de caducidad y de
  privacidad.
- **Resaltado de sintaxis** en el modo texto, y resaltado de bloques de código en la vista previa
  (`highlight.js`, `shiki`, `rehype-highlight`). Se deja el `class="language-x"` que produce el
  parseo —y que el sanitizador conserva, medido en `plan.md` §1— para que añadirlo después sea un
  plugin y no un rediseño.
- **Un editor de código** (CodeMirror, Monaco). Ver decisión 8 de `plan.md` y la decisión abierta D
  de §5.
- **Matemáticas (`remark-math`/KaTeX), diagramas (Mermaid), notas al pie más allá de las de GFM,
  emoji por `:atajo:`, front-matter YAML.** Cada uno es un plugin y una ampliación del modelo de
  amenaza del sanitizador.
- **HTML embebido en el markdown.** Se decide **no soportarlo** (decisión 6 de `plan.md`): se muestra
  como texto literal. No es una limitación temporal, es la postura.
- **Imágenes subidas.** Un `![](https://…)` remoto se renderiza; adjuntar archivos sigue fuera de
  alcance como en la `002`.
- **Caché HTTP del documento (`ETag`, `If-None-Match`), y `If-Match` como token de concurrencia.**
  Ver decisión 2 de `plan.md`, que explica por qué el token va en el cuerpo y no en una cabecera.
- **Diferenciar el aviso genérico de la barra lateral** (riesgo #15 de la `002`). AC-19 lo resuelve
  **dentro del editor**, donde hay datos que perder. La barra lateral no se toca y el riesgo sigue
  abierto para ella.
- **Diseño visual definitivo.** El editor es funcional y accesible.

## 5. Riesgos y decisiones abiertas

Las cinco primeras filas eran **decisiones abiertas**. **Quedaron resueltas el 2026-07-28**, las cinco en
la opción que el plan recomendaba y sin cambios de alcance; se conservan aquí —con su razonamiento
íntegro— porque el motivo de una decisión es lo que hace falta el día que alguien quiera revisarla, y
borrarlo dejaría solo el resultado. El resto de filas son riesgos ya mitigados por el plan.

| Decisión | Resuelta el | Opción elegida |
|---|---|---|
| **A** — endpoint de guardado | 2026-07-28 | **`PUT /api/workspace/documents/:id/content`**, ruta nueva. El `PATCH /:id` queda intacto y su `400` de `forbidNonWhitelisted` sigue siendo comportamiento verificado |
| **B** — token de concurrencia y enmienda de la `002` | 2026-07-28 | Columna **`contentVersion`**; enmienda de la `002` a **v0.4.0** aprobada como **minor**. Aplicada por `T-000` |
| **C** — sanitizador | 2026-07-28 | `react-markdown` + `remark-gfm` + `rehypeRawAsText` + `rehype-sanitize`. Y la postura de producto, aprobada **explícitamente**: **el HTML embebido se muestra como texto literal y no se renderiza nunca** |
| **D** — editor | 2026-07-28 | **`<textarea>` plano**, sin CodeMirror ni Monaco |
| **E** — «split view» | 2026-07-28 | **Texto y preview lado a lado del MISMO documento**, no dos documentos distintos. Fijado también en `CLAUDE.md`, que era donde estaba la ambigüedad |

**Lo que la resolución de E cambia, y lo que no.** Confirma el reparto que §4 ya proponía: el conmutador
de dos modos excluyentes de la `003` y el modo `'split'` de la `005` son **la misma pareja de paneles con
otra disposición**, así que `005` es un cambio de *layout* y no de estado de guardado — que es
exactamente lo que la decisión 9 de `plan.md` (estado indexado por documento) fue diseñada para
sostener. Lo que **descarta** es la otra lectura, «dos documentos distintos lado a lado», que habría
exigido dos entradas vivas del store a la vez y por tanto una política de desalojo distinta de la de
`003`. `005` seguirá necesitando esa política para los **tabs** (varios documentos abiertos), pero ya no
para el split.

| # | Riesgo / duda | Impacto | Mitigación / quién decide |
|---|---------------|---------|---------------------------|
| A | **¿Endpoint nuevo o ampliación del `PATCH` existente?** Se elige **`PUT /api/workspace/documents/:id/content`**, endpoint nuevo | Alto: es el contrato que `004` y `005` heredan | **RESUELTA el 2026-07-28 — ruta nueva, la opción recomendada.** Razones en `plan.md` decisión 1, resumidas: (1) es la misma razón por la que la `002` separó renombrar de mover (su decisión 10); (2) los modos de fallo son distintos —renombrar puede dar `409 DOCUMENT_TITLE_TAKEN`, guardar solo puede dar `409` de versión—, y un `PATCH` combinado haría que un guardado automático cada dos segundos reenviara el título y pudiera chocar con un hermano **sin que el usuario haya tocado el título**; (3) las frecuencias son incomparables (decenas por minuto frente a una vez al mes); (4) ampliar el `PATCH` rompería un comportamiento **verificado** de la `002` (su DTO rechaza `content` con `400` por `forbidNonWhitelisted`) en vez de añadir una ruta |
| B | **El token de concurrencia obliga a enmendar la spec `002`.** Se elige una columna `contentVersion Int`, expuesta en `WorkspaceDocumentResponseDto`, lo que cambia el juego **exacto** de claves que afirman AC-12 y AC-15 de la `002` | Medio–alto: toca una spec **complete**, con 35 AC verificados | **RESUELTA el 2026-07-28 — columna `contentVersion`, y la enmienda de la `002` aprobada como minor; la aplicó `T-000` el mismo día.** La alternativa sin enmienda (`updatedAt` como token) tiene un defecto medido de diseño: renombrar o mover **también** mueve `updatedAt`, así que renombrar desde la barra lateral haría fallar el guardado pendiente con un conflicto falso (AC-9 existe justo para clavar lo contrario). El alcance exacto de la enmienda está en §6 y en `T-000`; la regla es la de `T-024`/`T-026`/`T-027` de la `002`: **solo** se tocan las aserciones enumeradas, y si cae cualquier otro test de `000`/`001`/`002` **se para y se reporta** |
| C | **Sanitizador y modelo de amenaza.** Se eligen `react-markdown` 10.1.0 + `remark-gfm` 4.0.1 + `rehype-sanitize` 6.0.0 con `defaultSchema` sin modificar, más un paso propio de ~12 líneas (`rehypeRawAsText`), y **nunca** `dangerouslySetInnerHTML` | **Alto**: es el único punto del producto donde texto de usuario se convierte en nodos del documento | **RESUELTA el 2026-07-28 — la cadena propuesta, y la postura de producto aprobada de forma explícita: el HTML embebido se muestra como texto literal y no se renderiza nunca.** Modelo de amenaza completo, con las salidas **medidas** de cada carga, en `plan.md` §2. Esa postura era lo que había que aprobar por separado, porque es una decisión de producto y no una limitación técnica: `rehype-raw` existe y habría bastado instalarlo |
| D | **El modo texto es un `<textarea>` plano, no un editor de código.** Sin resaltado de sintaxis, sin números de línea | Medio: es lo primero que se nota al usarlo | **RESUELTA el 2026-07-28 — `<textarea>` plano.** A favor del `<textarea>`: ninguna dependencia pesada más (CodeMirror 6 son ~10 paquetes y ~200 kB), accesibilidad y deshacer nativos del navegador **gratis**, y —lo que más pesa— la paleta de la spec `004` necesita insertar en la posición del cursor, que en un `<textarea>` es `setRangeText` y en CodeMirror es una API de transacciones que habría que especificar contra su versión. En contra: la experiencia es más pobre. Cambiar de opinión después es una spec propia y no rompe ningún contrato de servidor |
| E | **¿Qué es «split view» en `CLAUDE.md`?** ¿Texto y vista previa lado a lado, o dos documentos distintos lado a lado? | Medio: cambia lo que `005` puede dar por hecho | **RESUELTA el 2026-07-28 — texto y preview lado a lado del MISMO documento**, y la frase ambigua de `CLAUDE.md` corregida en `T-000`. No bloqueaba a la `003` —aquí entran dos modos excluyentes y el estado queda indexado por documento, que es lo que hacía posibles las dos lecturas— pero fijarlo ahora evita que `005` descubra a mitad que necesita otro modelo de estado. Con la lectura elegida **no lo necesita para el split**: los dos paneles leen el mismo `draft` de la misma entrada del store. Seguirá necesitando una política de desalojo distinta para los **tabs**, que es otro problema suyo |
| 1 | **Cuerpos grandes en un endpoint de alta frecuencia.** Un documento de 200.000 caracteres son hasta ~800 kB en UTF-8, y el guardado automático puede emitirlos cada pocos segundos | Medio: ancho de banda y escrituras en PostgreSQL | Tres frenos que se multiplican: debounce de 1.500 ms, **coalescencia** (nunca más de un guardado en vuelo, y como mucho uno encolado — AC-17), y throttler propio `documentContent` de 120/min/IP. Con coalescencia el techo de un editor es ~30 guardados/min. **No** se manda un diff: enviar el documento entero es lo que hace que el guardado sea idempotente respecto de su versión (AC-8), y un protocolo de parches necesitaría su propio modelo de conflicto |
| 2 | **`contentVersion` es un invariante que solo puede escribir un camino.** Si alguna otra escritura lo incrementa —o se olvida de incrementarlo— la detección de conflictos se vuelve ruido o silencio | Medio–alto y **silencioso** | Mismo patrón que `parentScopeId` en la `002` (su riesgo #2): la columna la toca **un solo método** del repositorio (`saveDocumentContent`), y AC-9 comprueba en bloque que renombrar y mover **no** la mueven. El incremento va en el mismo `updateMany` condicional que la comprobación, así que no hay ventana entre comprobar y escribir |
| 3 | **Distinguir `404` de `409` filtra información si se hace mal.** Un conflicto de versión sobre un documento ajeno confirmaría que ese documento existe | Medio (fuga) | El `updateMany` lleva `userId` **y** `contentVersion` en el mismo `where`, así que `count: 0` significa las tres cosas a la vez. Para desambiguar se hace **después** un `count` acotado por `{ id, userId }`: si es `0` → `404`, si no → `409`. Un documento ajeno nunca llega a la rama del `409`, y AC-7 lo comprueba con la versión correcta **y** con una incorrecta |
| 4 | **jsdom no es un navegador y la afirmación de seguridad es sobre navegadores.** Un preview que pasa en jsdom puede ejecutar algo en Blink | **Alto** si se acepta jsdom como prueba suficiente | AC-26 repite el corpus entero en Chromium real con centinela y manejador de diálogos. El corpus vive en **un único archivo** compartido por el test de jsdom y el de Playwright, para que no puedan divergir. Además el diseño ayuda: al no existir nunca una cadena de HTML (se construyen elementos de React), no hay nada que un parser distinto pueda interpretar distinto |
| 5 | **Tres dependencias nuevas en `apps/web`, y una de ellas arrastra el ecosistema `unified`** (~30 paquetes transitivos entre `remark-*`, `micromark-*` y `hast-*`) | Medio: superficie de suministro y tamaño de bundle | Es el coste de no usar `dangerouslySetInnerHTML`. La alternativa (`marked` + `dompurify`, 2 paquetes) exige inyectar HTML y hace que la seguridad dependa de configurar bien DOMPurify en **cada** punto de uso, además de depender de la implementación del DOM. Las tres versiones se fijan en `plan.md` §1 y se verificaron con `context7` y contra npm el 2026-07-28; **ninguna otra tarea instala nada**. **Coste medido por `T-011` el 2026-07-28: +255 módulos y +160,7 kB (+48 kB gzip)**; `vite.config.ts` **no necesitó nada** y no se tocó. La medición tiene un detalle que conviene conocer: hoy **nadie importa `MarkdownPreview`**, así que el build lo *tree-shakeaba* y la comprobación habría dado **cero** — `T-011` tuvo que importarlo temporalmente desde `main.tsx` para que el coste apareciera. Cuando `T-013` lo enganche a la página ese coste pasa a ser real y permanente, y es el número contra el que hay que juzgar cualquier plugin que añadan la `004` o la `005` |
| 6 | **El guardado automático puede pelearse con la recarga del árbol.** La `002` recarga `GET /tree` tras **cada** mutación (su decisión 12) | Bajo | Un guardado de contenido **no** es una mutación del árbol: no cambia `title` ni `directoryId`, así que el editor **no** recarga el árbol al guardar. Lo único que se queda obsoleto es el `contentBytes` del resumen, que la barra lateral no muestra. Escrito aquí para que nadie «arregle» la inconsistencia añadiendo una recarga por guardado, que multiplicaría por dos el tráfico del editor |
| 7 | **El `beforeunload` de AC-29 no es una garantía**: el navegador puede ignorarlo, y en un cierre forzado el `draft` se pierde | Bajo, pero conviene no prometer de más | Es una red de seguridad, no el mecanismo. El mecanismo es el guardado automático con debounce corto: en el peor caso se pierden 1,5 segundos de escritura. Se escribe aquí para que la interfaz no diga «tus cambios están a salvo» apoyándose en el `beforeunload` |
| 8 | **El presupuesto de la suite de navegador vuelve a quedarse corto** al añadir archivos y un cupo nuevo | Medio: rojos que no tienen que ver con lo que se mide | AC-34, con el comando como verificación y la prohibición heredada de la `002` escrita en el propio AC |
| 9 | **La suite de API gana dos archivos que agotan cupo o miden concurrencia**, y hoy toda ella corre con `--runInBand` | Bajo hoy, alto el día que alguien quite `--runInBand` para acelerarla | `tasks.md` lleva una sección explícita de **qué debe ir en serie y por qué**, con los archivos nombrados. El `--runInBand` está en el script de `apps/api/package.json` y **no** en `test/jest-e2e.json`: es un argumento de línea de órdenes, o sea lo más fácil de perder de vista |
| 10 | **El caso de conflicto de AC-33 tiene una ventana temporal estrecha y NO se estabilizó.** Añadido al cerrar, el 2026-07-28 | Bajo en frecuencia, **alto en diagnóstico**: si parpadea en CI, el síntoma no se parece a su causa | El caso provoca el conflicto emitiendo un `PUT` externo con `page.request` y dejando después que venza el **debounce de 1.500 ms**. `T-014` midió que el margen entre las dos cosas son **decenas de milisegundos**. Corrió **13 veces sin parpadear** (3 de `playwright test editor` + 10 entre `pnpm test:e2e` y `--repeat-each=3`), lo que basta para cerrarlo pero **no** para llamarlo estable. **Se deja escrito en vez de estabilizarlo** porque las salidas —subir el debounce, esperar a un estado intermedio observable, o forzar el guardado en vez de esperarlo— cambian o el producto o lo que el AC demuestra, y ninguna se justifica con un fallo que todavía no se ha visto. **Lo que sí hay que evitar es el diagnóstico equivocado**: si un día se pone rojo, la causa es esta carrera y **no** el cupo del throttler, que es donde mira todo el mundo después de `T-015` |
| 11 | **`GET /api/workspace/documents/:id` se emite dos veces por montaje en desarrollo** (`StrictMode` invoca los efectos dos veces). Son **8 de las 21** peticiones de `workspace` de una corrida de navegador. Añadido al cerrar, el 2026-07-28 | Bajo: **no afecta a producción** —`StrictMode` solo duplica en desarrollo— y ningún AC lo pide | **Registrado como deuda con destinatario, no arreglado en esta spec** (ver §8). `T-015` lo evaluó y **no lo tocó, correctamente**: las tres salidas quedaban fuera de su alcance. La recomendación es la tercera —**deduplicar la petición en vuelo dentro de `open(id)`**—, y su valor real no es el gasto de la suite sino la `005`: con tabs, abrir y cerrar pestañas deprisa multiplica el problema **también en producción**, donde `StrictMode` ya no interviene y la causa pasa a ser el usuario |

## 6. Enmienda que esta spec obliga en la spec `002` (v0.3.1 → v0.4.0)

Es un **minor**: añade alcance a un contrato ya implementado sin romper a ningún consumidor (todos los
campos son nuevos, ninguno desaparece ni cambia de tipo), pero **sí** obliga a cambiar aserciones de
tests verdes, así que no puede ser un patch. La ejecuta `T-000` y **solo** puede tocar esto:

| Artefacto de la `002` | Cambio | Motivo |
|---|---|---|
| `spec.md` AC-12, AC-15 | El juego exacto de claves de `WorkspaceDocumentResponseDto` incluye `contentVersion` | AC-11 de esta spec |
| `spec.md` AC-26 | «diez rutas» → **once**; «las nueve que resuelven un `:id`» → **diez** | La ruta nueva |
| `spec.md` AC-31, AC-32 | La región `Markdown en crudo` deja de existir; lo que se comprueba al abrir un documento pasa a ser el editor | El andamio que la propia `002` declaró como tal |
| `plan.md` §4 | La tabla de rutas y la lista de DTO de respuesta | Idem |
| `plan.md` §5 | El modelo `Document` gana `contentVersion` | `T-001` |
| `plan.md` §7 | `DocumentViewPage` deja de describirse como la vista de documento | `T-013` |
| `CHANGELOG.md` | Entrada `## v0.4.0 — <fecha>` con este motivo | Regla de versionado |
| `apps/api/test/workspace-documents.e2e-spec.ts` | **Solo** las dos aserciones de claves exactas de AC-12 y AC-15 | `T-007` |
| `apps/api/src/workspace/workspace.repository.spec.ts` | **Solo** la aserción de claves exactas de «no deja salir del repositorio las columnas internas de un documento» (línea ~334): la lista esperada gana `contentVersion` | `T-007` |
| `apps/api/test/swagger.e2e-spec.ts` | **Cuatro** recuentos, no dos: (1) rutas del tag `workspace` (diez → **once**), (2) rutas que declaran `404` (nueve → **diez**), (3) **DTO de entrada** — `WORKSPACE_REQUEST_SCHEMAS`, `toHaveLength(7)` → **`8`** más su comparación contra los nombres de DTO **en disco**—, y (4) **DTO de salida** — `WorkspaceDocumentContentResponseDto` en `WORKSPACE_RESPONSE_SCHEMAS` | `T-009` |
| `apps/web/src/test/workspace-fixtures.ts` | **Solo** añadir `contentVersion: 0` al fixture de `MarkdownDocument`, que pasó a exigirlo | `T-012` |
| `apps/web/e2e/workspace.spec.ts` | La aserción sobre `Markdown en crudo` | `T-013` |
| `packages/shared/src/index.test.ts` | Casos nuevos; ninguno existente cambia de expectativa | `T-006` |

**Regla dura, heredada de `T-024`/`T-026`/`T-027`**: si al aplicar esto cae **cualquier** otro test de
las specs `000`, `001` o `002`, el agente **para y reporta**. No se ajusta el test de otra spec por
cuenta propia.

**Y funcionó: esta tabla se amplió una vez, el 2026-07-28, porque la regla se cumplió.** `T-007` encontró
una **tercera** aserción de claves exactas que esta lista no autorizaba
—`workspace.repository.spec.ts:334`—, **paró**, y comprobó con `git show HEAD` que era código de la `002`
y no algo que hubiera roto `T-003`. El cambio era inevitable y correcto: AC-11 obliga a que
`createDocument` devuelva `contentVersion`, así que la lista de claves que ese test afirma tenía que
crecer. Se autorizó y se añadió a esta tabla **antes** de aplicarlo.

Merece quedar escrito porque es la única evidencia de que el procedimiento sirve para algo: una lista
cerrada de artefactos tocables solo tiene valor si, cuando se queda corta, alguien se para en vez de
ampliarla por su cuenta. Aquí la lista **estaba** corta —la escribí yo— y el mecanismo lo detectó.

**Y volvió a quedarse corta, por el mismo motivo: van dos.** `T-012` encontró que
`apps/web/src/test/workspace-fixtures.ts` —código intacto de la `002`, commit `168b840`— no ponía
`contentVersion`, que `MarkdownDocument` pasó a exigir. Coste medido: **14 tests en rojo en 5 suites** más
un error de `tsc`. Arreglo: una línea. Mismo procedimiento —parar, verificar que era código de la `002`,
autorizar, registrar aquí— y mismo resultado.

**La lección, que es lo que evita una tercera vez.** Las dos veces fallé por el mismo sitio: al escribir
§6 pensé el radio de un cambio de contrato como «los DTO y los tests que afirman respuestas HTTP», y el
radio real es **todo lo que construye un valor de ese tipo**, incluidos los **fixtures y helpers de test
de los dos paquetes**. Un tipo compartido con un campo requerido nuevo es un *tripwire* que alcanza a
cualquier archivo que fabrique uno a mano, y esos archivos no aparecen buscando el nombre del endpoint.

Regla para la próxima spec que amplíe un tipo de `packages/shared`: antes de cerrar la lista, buscar
**quién construye literales de ese tipo** (`test/fixtures/**`, `src/test/**`, `*-fixtures.ts`) además de
quién lo consume. Es un `grep` por el nombre del tipo, no una revisión.

## 7. Trazabilidad

**34 AC, todos con al menos un test automatizado.** Ninguno queda con verificación manual; si al
implementar apareciera uno que sí, se escribe en el propio AC (como AC-34 de la `002`) en lugar de
dejarlo implícito.

| AC | Cubierto por | Tarea |
|----|--------------|-------|
| AC-1 | `apps/api/test/workspace-document-content.e2e-spec.ts` (guardado feliz + fila en base) | T-005 |
| AC-2 | `apps/api/test/workspace-document-content.e2e-spec.ts` (vaciar) | T-005 |
| AC-3 | `apps/api/test/workspace-document-content.e2e-spec.ts` (validación) + `src/workspace/document-content.spec.ts` | T-002, T-005 |
| AC-4 | `apps/api/test/workspace-document-content.e2e-spec.ts` (200.000 caracteres) | T-005 |
| AC-5 | `apps/api/test/workspace-document-content.e2e-spec.ts` (versión rancia) + `src/workspace/workspace.repository.spec.ts` | T-003, T-005 |
| AC-6 | `apps/api/test/workspace-document-content.e2e-spec.ts` (`Promise.all`) | T-005 |
| AC-7 | `apps/api/test/workspace-document-content.e2e-spec.ts` (propiedad y credencial) | T-005 |
| AC-8 | `apps/api/test/workspace-document-content.e2e-spec.ts` (idempotencia por versión) | T-005 |
| AC-9 | `apps/api/test/workspace-document-content.e2e-spec.ts` (ortogonalidad) | T-005 |
| AC-10 | `apps/api/test/workspace-document-content-throttle.e2e-spec.ts` + `src/common/throttle.spec.ts` | T-004, T-008 |
| AC-11 | `apps/api/test/workspace-documents.e2e-spec.ts` (enmendado) | T-007 |
| AC-12 | `apps/api/test/swagger.e2e-spec.ts` (ampliado) | T-009 |
| AC-13 | `apps/api/test/workspace-document-content.e2e-spec.ts` (cuerpo > 2 MiB) | T-005 |
| AC-14 | `packages/shared/src/index.test.ts` (ampliado) | T-006 |
| AC-15 | `apps/web/src/shared/api/http.test.ts` (ampliado) | T-010 |
| AC-16 | `apps/web/src/features/editor/editor.store.test.ts` | T-012 |
| AC-17 | `apps/web/src/features/editor/editor.store.test.ts` (debounce y coalescencia) | T-012 |
| AC-18 | `apps/web/src/features/editor/editor.store.test.ts` (adopción de versión) | T-012 |
| AC-19 | `apps/web/src/features/editor/editor.store.test.ts` (tres ramas de error) | T-012 |
| AC-20 | `apps/web/src/features/editor/editor.store.test.ts` (dos resoluciones) + `DocumentEditorPage.test.tsx` (el diálogo que las ofrece) | T-012, T-013 |
| AC-21 | `apps/web/src/features/editor/editor.store.test.ts` (`429` sin reintento) | T-012 |
| AC-22 | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` | T-013 |
| AC-23 | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` (textarea y teclado) | T-013 |
| AC-24 | `apps/web/src/features/editor/MarkdownPreview.test.tsx` (elementos y GFM) | T-011 |
| AC-25 | `apps/web/src/features/editor/MarkdownPreview.test.tsx` (corpus) + `apps/web/src/features/editor/no-dangerous-html.test.ts` | T-011 |
| AC-26 | `apps/web/e2e/editor.spec.ts` (corpus en Chromium) | T-014 |
| AC-27 | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` (`Ctrl`+`S`) | T-013 |
| AC-28 | `apps/web/src/features/editor/editor.store.test.ts` + `DocumentEditorPage.test.tsx` (desmontaje) | T-012, T-013 |
| AC-29 | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` (`beforeunload`) | T-013 |
| AC-30 | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` + `editor.store.test.ts` | T-012, T-013 |
| AC-31 | `apps/web/src/features/editor/DocumentEditorPage.test.tsx` (casos heredados + aserción negativa) | T-013 |
| AC-32 | `apps/web/e2e/editor.spec.ts` (recorrido con recarga) | T-014 |
| AC-33 | `apps/web/e2e/editor.spec.ts` (conflicto provocado por API) | T-014 |
| AC-34 | la suite de `apps/web/e2e/` bajo `--retries=2 --repeat-each=3` | T-015 |

## 8. Trabajo futuro que esta spec deja con destinatario

Nada de esto bloquea el cierre. Se escribe aquí, y no solo en el seguimiento, porque son decisiones que
la spec que las herede necesita **con su razón**, no como una línea suelta en un `TODO`.

### 8.1 Deduplicar `GET /api/workspace/documents/:id` en vuelo — **para la spec `005`**

**Qué pasa.** `open(id)` del store del editor no protege contra dos llamadas simultáneas para el mismo
documento. En desarrollo, `StrictMode` invoca los efectos dos veces por montaje, así que cada apertura
emite **dos** peticiones idénticas: **8 de las 21** peticiones de `workspace` de una corrida de la suite
de navegador.

**Por qué no entra en la `003`.** Se evaluaron las tres salidas y las tres quedaban fuera del alcance de
`T-015`, que fue quien lo encontró: tocar `playwright.config.ts` o `vite.config.ts` (contrato de la
spec `000`), quitar `StrictMode` (que existe para destapar justo esta clase de efectos, así que
silenciarlo sería matar al mensajero), o deduplicar en `editor.store.ts` (cerrado por `T-012`/`T-013`).
Ninguna urgía: tras `T-015` el pico de la suite quedó en **20 de 120**, así que no hay presión de cupo, y
**en producción el síntoma no existe** porque `StrictMode` solo duplica en desarrollo.

**Por qué es de la `005` y no de la `004`.** Porque la `005` va a **tener que tocar `open(id)` de todas
formas** —la política de desalojo del diccionario indexado por documento es suya (decisión 9 de
`plan.md`)— y porque es ella la que convierte esto en un problema **real de producción**: con tabs, abrir
y cerrar pestañas deprisa produce aperturas solapadas del mismo documento sin ninguna ayuda de
`StrictMode`. Hacerlo ahora obligaría a la `005` a volver sobre el mismo método dos veces.

**Recomendación concreta**, para que no haya que redescubrirla: guardar la promesa en vuelo por `id`
dentro del store y devolverla si ya existe, que es el mismo idiom *single-flight* que
`apps/web/src/shared/api/http.ts` ya usa en `refreshSession()` — hay precedente en el repositorio y no
hace falta inventar nada.

### 8.2 Estabilizar el caso de conflicto de AC-33 — **solo si llega a parpadear**

Ver el riesgo #10. La recomendación explícita es **no tocarlo preventivamente**: corrió 13 veces sin
fallar, y las tres formas de estabilizarlo cambian o el producto o lo que el AC demuestra. Lo que esta
spec deja escrito es la **causa**, para que quien lo vea rojo en CI no lo diagnostique como un problema de
cupo del throttler — que es donde mirará todo el mundo, porque es lo que acaba de arreglar `T-015`.

### 8.3 Lo que NO es trabajo futuro, aunque lo parezca

- **`rehype-sanitize` no es una capa sobrante.** Dejó de ser redundante al añadir la carga de imagen con
  `irc:` (`plan.md` §2.2.1): es la **única** defensa de los protocolos de `src`.
- **El reset de `throttle:workspace:*` de la suite de navegador no es un atajo que haya que revertir.** Es
  la decisión de `T-015`, con su cobertura documentada: quien verifica ese límite es
  `apps/api/test/workspace-throttle.e2e-spec.ts`. **`documentContent` no se resetea** —la suite gasta 4 de
  120— y no debe empezar a resetearse «por simetría».
