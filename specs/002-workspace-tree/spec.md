# Spec 002 — Workspace tree: directorios, subdirectorios y documentos markdown

- **Versión**: 0.3.1 — la versión es de la **spec completa** (los cuatro artefactos). La v0.3.1 es un
  **patch** que **cierra la spec entera**: `T-026` y `T-027` implementadas y verificadas, con lo que
  **AC-34 y AC-35 quedan cubiertos** y la spec pasa a **35/35 AC · 27/27 tareas**. No añade alcance ni
  cambia ninguna respuesta HTTP; lo que sí hace es **corregir dos decisiones que el orchestrator había
  escrito mal** y que solo se vieron al implementarlas:
  1. **AC-35 no se cierra tocando solo `throttle:register:*`.** El reset hay que aplicarlo **también a
     `throttle:login:*`**: en el escenario del AC —todos los casos agotando `retries: 2`— el smoke gasta
     3 casos × 3 intentos = **9** entradas y el flujo de auth vuelve a entrar en cada intento (**3** más),
     o sea **12 contra un cupo de 10/min**. Ese gasto **ya existía** antes del cambio (el `signIn` viejo
     también hacía `login` tras el `409`); lo tapaba el `429` de `register`, que llegaba primero.
  2. **La cuenta compartida se crea una sola vez, en `global-setup.ts`**, un archivo que la tarea no
     nombraba. Es un efecto de segundo orden de la propia decisión «login antes de registrar»: si cada
     caso prepara la cuenta por su lado, en una base limpia **todos** los trabajadores empiezan con un
     `login` fallido contra una cuenta que aún no existe, y **5 fallos bloquean la cuenta 15 minutos**
     (`LoginAttemptService`, spec `001`). Ese bloqueo es **por cuenta, no por IP**, así que ningún reset
     de `throttle:*` lo evita.

  Y deja escrito, en §3 y en §6, **qué queda sin cobertura automática** — que es la parte que se pierde
  si solo vive en el seguimiento. La v0.3.0 fue el
  **minor** que **cerró la implementación de los 33 AC aprobados** y añadió **alcance nuevo de
  endurecimiento** salido de correr el recorrido en un navegador real: **AC-34** (la caché de
  `optimizeDeps` de Vite sirve un `@one-markdown/shared` rancio y rompe el árbol en desarrollo) y
  **AC-35** (una ejecución limpia de la suite de navegador gasta **exactamente** las 5 altas por IP que
  permite el rate limit, así que cualquier reintento en CI recibe un `429`), con las tareas `T-026` y
  `T-027`. Los dos son defectos **medidos**, no supuestos, y ninguno de los 33 AC anteriores cambia de
  significado. La misma versión corrige, a nivel de patch, la redacción de **AC-32**, que decía «el árbol
  queda vacío» cuando el recorrido que describe —mover el documento a la raíz **antes** de borrar el
  directorio— no puede dejarlo vacío; lo implementado es lo que decía `tasks.md`. La v0.2.3 fue un
  **patch** que corrigió un **error de criterio** del RED de `T-025` que escribió la v0.2.2 y cerró `T-025`
  y `T-022`: las nueve rutas que declaran `404` **no** se derivan filtrando por `{id}` en la plantilla de
  ruta (eso da **siete**), sino por complemento de `GET /tree` — los dos `POST` de creación también emiten
  `404 PARENT_NOT_FOUND` y reciben el id del padre **en el cuerpo**. La decisión de la v0.2.2 no cambia; lo
  que cambia es cómo se deriva la lista. La v0.2.2 es un
  **patch** que resuelve una contradicción interna que destapó `T-015`: **AC-26** pedía `404` en las diez
  rutas de `/api/workspace/*` y `plan.md` §4 —que enumera los errores ruta por ruta desde la v0.1.0— no lo
  lista para `GET /api/workspace/tree`. Gana `plan.md`: AC-26 se acota a las **nueve** rutas que resuelven
  un `:id`. No cambia ninguna respuesta HTTP (esa ruta nunca emitió un `404` ni va a emitirlo); cambia una
  línea del documento OpenAPI, que hoy declara una respuesta que no existe. La corrección de código va en
  la tarea nueva **`T-025`**. La v0.2.0 añadió
  alcance (**AC-33** y la tarea `T-024`) para que el `413` que `plan.md` §4 promete desde la v0.1.0 fuera
  de verdad un `413` y no el `500` que se midió al implementar `T-008`; la v0.2.1 es un **patch** que
  cierra ese AC —verificado— y deja escrita la regla de detección (rango `4xx` **cerrado**, registro por
  estado y no por origen, `code` nunca copiado de un error ajeno). Ningún AC cambia de significado,
  ningún límite cambia y ningún contrato se rompe (ver `CHANGELOG.md`)
- **Estado**: **complete** (2026-07-25) — **35/35 AC** verificados y **27/27 tareas** cerradas
  (`T-001`…`T-016`, `T-024`, `T-025` de backend; `T-017`…`T-023`, `T-026`, `T-027` de frontend), todas
  comprobadas por el orchestrator con el comando corrido y su salida real. **Ningún AC queda sin
  cobertura**, con la salvedad —escrita, no escondida— de que el rojo de **AC-34 es manual y CI no lo
  cazará nunca**: ver la nota de honestidad del propio AC-34 y §6. Fue **approved** el 2026-07-25 **sin
  cambios de alcance**: los cuatro puntos que se le señalaron al usuario (borrado definitivo sin papelera,
  reglas de nombres, edición de contenido fuera de alcance, y los cuatro límites) quedaron aceptados tal
  como están escritos. La implementación es la Fase 4 de `IMPLEMENTATION.md`.
  Los dos AC de endurecimiento que abrió la v0.3.0 (AC-34, AC-35 · `T-026`, `T-027`) **quedan cerrados en
  la v0.3.1**: no eran alcance aprobado sino defectos de entorno destapados al ejecutar AC-32 en un
  navegador real, y se cierran igual que el resto, con RED medido y `DONE` corrido.
  Cifras finales del cierre, tomadas de una vez y desde estado limpio (`rm -rf packages/shared/dist` +
  rebuild): shared **65** · web 12 archivos / **188** · api 19 suites / **264** · api e2e 20 suites /
  **455** · `pnpm test:e2e` **5** · `playwright test --retries=2 --repeat-each=3` **15** · `typecheck` y
  `lint` de raíz exit 0 · `prettier --check` limpio
- **Fecha**: 2026-07-25 (aprobada el 2026-07-25 · implementada el 2026-07-25)
- **Depende de**: `000-foundation` (implemented) · `001-auth` (implemented — guard, `@CurrentUser()`,
  `AuthenticatedUser` con `sid`, rate limit opt-in por ruta, patrón de contratos en `packages/shared`)

## 1. Contexto y problema

Hoy existe identidad y no existe contenido. Una persona puede registrarse, iniciar sesión, mantener la
sesión y protegerla con un segundo factor, pero al entrar en la aplicación se encuentra una barra lateral
que dice literalmente «El árbol de directorios llega con la spec 002» y un panel central vacío. No hay
nada que crear, nada que organizar y nada que abrir.

El producto que describe `CLAUDE.md` es un gestor de archivos markdown **organizados en categorías,
directorios y subdirectorios**. Ese árbol es la columna vertebral de todo lo que viene después: el editor
(`003`) necesita un documento con identidad y contenido que cargar y guardar; la paleta de markdown
(`004`) necesita un documento abierto donde insertar; los tabs y el split view (`005`) necesitan varios
documentos identificables a la vez. Ninguna de esas tres specs puede escribir un criterio verificable
mientras no exista un documento con `id`, un sitio donde vive y una forma canónica de listarlo.

El problema a resolver aquí es la **estructura y la propiedad**: que cada persona tenga su propio árbol de
directorios anidables y sus documentos markdown; que pueda crear, renombrar, mover y borrar tanto
directorios como documentos; que el cliente pueda pintar el árbol completo de una sola vez; y que **nada
de eso sea visible ni tocable por otra persona**. La regla dura del proyecto es que todo acceso a
documentos y directorios se filtra por el `userId` del token, y esta spec es la primera que la ejerce de
verdad: es aquí donde un fallo de autorización dejaría de ser teórico.

Hay además dos problemas estructurales que un árbol trae consigo y que conviene resolver ahora, no cuando
haya datos de usuarios reales: **los nombres** (¿dos carpetas hermanas pueden llamarse igual? ¿`Notas` y
`notas` son la misma?) y **los ciclos** (mover una carpeta dentro de sí misma parte el árbol en un anillo
que ninguna interfaz puede recorrer). Ambos son fáciles de dejar «para luego» y carísimos de arreglar con
datos ya guardados.

## 2. Historias de usuario

- **US-1** — Como usuario, quiero crear carpetas y subcarpetas para agrupar mis documentos por tema, y
  poder anidarlas tanto como necesite sin que la aplicación se rompa.
- **US-2** — Como usuario, quiero crear documentos markdown dentro de una carpeta o directamente en la
  raíz, para no verme obligado a inventar una carpeta antes de escribir la primera nota.
- **US-3** — Como usuario, quiero renombrar carpetas y documentos cuando cambio de idea sobre cómo llamar
  las cosas, sin perder su contenido ni su sitio.
- **US-4** — Como usuario, quiero mover una carpeta o un documento a otro sitio del árbol (incluida la
  raíz), para reorganizar sin recrear ni copiar y pegar.
- **US-5** — Como usuario, quiero borrar lo que ya no uso, y que la aplicación me avise **antes** de
  borrar una carpeta que todavía tiene cosas dentro, para no perder trabajo por un clic.
- **US-6** — Como usuario, quiero ver todo mi árbol en la barra lateral al entrar, expandir y contraer
  carpetas y llegar a cualquier documento con el teclado, sin ratón.
- **US-7** — Como usuario, quiero que mis documentos sean **solo míos**: que nadie con otra cuenta pueda
  leerlos, moverlos, borrarlos ni averiguar que existen.
- **US-8** — Como desarrollador de la spec `003`, quiero un endpoint que me dé un documento con su
  contenido y un contrato compartido que describa su forma, para escribir el editor sin inventar el
  modelo.
- **US-9** — Como desarrollador de las specs `004` y `005`, quiero un listado del árbol **sin contenidos**
  y con ids estables, para pintar la barra lateral y los tabs sin descargar todo el texto de todos los
  documentos.

## 3. Criterios de aceptación

Todo AC debe ser verificable por un test automatizado. Las constantes que aparecen aquí
(`120`, `200`, `10`, `200.000`, `5.000`, `120/min`) están fijadas y justificadas en `plan.md` §3.

### Directorios

- **AC-1** — Dado un usuario autenticado sin directorios, cuando hace
  `POST /api/workspace/directories` con `{ "name": "Notas", "parentId": null }`, entonces responde `201`
  con `WorkspaceDirectoryResponseDto` (`id`, `name`, `parentId`, `depth`, `createdAt`, `updatedAt`) y
  **sin** propiedades adicionales, con `parentId: null` y `depth: 0`; y la fila guardada tiene
  `parentScopeId` igual al `userId` del token y `nameKey` igual a `notas`.

- **AC-2** — Dado un directorio propio, cuando se crea otro con `parentId` igual a su `id`, entonces
  responde `201` con ese `parentId` y `depth: 1`, y la fila guardada tiene `parentScopeId` igual al `id`
  del padre.

- **AC-3** — Dado un directorio `Notas` en la raíz, cuando se crea otro llamado `NOTAS` (o `  notas  `)
  también en la raíz, entonces responde `409` con `ErrorResponseDto` cuyo `code` es
  `DIRECTORY_NAME_TAKEN` y la base sigue teniendo **una sola** fila con ese `nameKey` en ese ámbito; y
  cuando se crea `Notas` dentro de otro directorio, entonces responde `201` (el nombre solo es único
  entre hermanos).

- **AC-4** — Dado un cuerpo con `name` vacío, de solo espacios, de 121 caracteres, con un carácter de
  control, con `/` o `\`, igual a `.` o `..`, o con `parentId` ausente, no uuid, o con una propiedad no
  declarada, cuando se hace `POST /api/workspace/directories`, entonces responde `400` con
  `ErrorResponseDto` cuyo `message` nombra el campo rechazado, y no se crea ninguna fila.

- **AC-5** — Dado un `parentId` que no existe o que pertenece a **otro** usuario, cuando se crea un
  directorio con él, entonces responde `404` con `code` `PARENT_NOT_FOUND`, nunca `403`, y no se crea
  ninguna fila.

- **AC-6** — Dada una cadena de 10 directorios anidados (profundidades `0`…`9`), cuando se intenta crear
  un hijo del más profundo, entonces responde `409` con `code` `DEPTH_LIMIT_EXCEEDED` y no se crea
  ninguna fila.

- **AC-7** — Dado un directorio propio, cuando se hace `PATCH /api/workspace/directories/:id` con un
  nombre nuevo, entonces responde `200` con el nombre nuevo y un `updatedAt` posterior al anterior;
  cuando el nombre nuevo choca con un hermano (en cualquier caja) responde `409`
  (`DIRECTORY_NAME_TAKEN`) y el nombre en la base **no** cambia; y cuando se renombra al mismo nombre
  cambiando solo la caja (`notas` → `Notas`) responde `200` (no es una colisión consigo mismo).

- **AC-8** — Dado un directorio propio, cuando se hace `POST /api/workspace/directories/:id/move` con
  `{ "parentId": null }` responde `200` con `parentId: null`, y con el `id` de otro directorio propio
  responde `200` con ese `parentId`; cuando el destino es **el propio directorio** o **uno de sus
  descendientes**, responde `409` con `code` `MOVE_INTO_DESCENDANT` y ni el `parentId` del sujeto ni el de
  ningún descendiente cambia; y cuando el destino es el padre que ya tiene, responde `200` sin cambios
  (idempotente).

- **AC-9** — Dado un directorio propio y un directorio de **otro** usuario, cuando se intenta mover el
  propio dentro del ajeno, entonces responde `404` (`PARENT_NOT_FOUND`), nunca `403`, y el `parentId` del
  directorio movido sigue siendo el que era; ídem con un `parentId` inexistente.

- **AC-10** — Dado un subárbol propio de 3 niveles de alto y un directorio destino a profundidad `8`,
  cuando se mueve el subárbol dentro del destino (lo que dejaría hojas a profundidad `11`), entonces
  responde `409` con `code` `DEPTH_LIMIT_EXCEEDED` y nada cambia en la base.

- **AC-11** — Dado un directorio vacío, cuando se hace `DELETE /api/workspace/directories/:id`, entonces
  responde `204` sin cuerpo y la fila desaparece; dado un directorio con hijos (directorios o
  documentos), la misma llamada responde `409` con `code` `DIRECTORY_NOT_EMPTY` y **nada** se borra;
  con `?recursive=true` responde `204` y desaparecen el directorio, todos sus subdirectorios y todos los
  documentos que contenían; y con `?recursive=yes` (cualquier valor que no sea `true` ni `false`)
  responde `400`.

### Documentos

- **AC-12** — Dado un usuario autenticado, cuando hace `POST /api/workspace/documents` con
  `{ "title": "Ideas", "directoryId": null, "content": "# Hola ñ" }`, entonces responde `201` con
  `WorkspaceDocumentResponseDto` (`id`, `title`, `directoryId`, `contentBytes`, `createdAt`,
  `updatedAt`, `content`) sin propiedades adicionales, con el `content` exactamente como se envió y
  `contentBytes` igual a la longitud en **bytes UTF-8** (el carácter multibyte lo hace distinto de la
  longitud en caracteres); y cuando se crea **sin** `content`, entonces `content` es `""` y
  `contentBytes` es `0`.

- **AC-13** — Dado un cuerpo con `title` vacío, de 201 caracteres o con caracteres prohibidos (los
  mismos que en AC-4), o con `directoryId` ausente, cuando se hace `POST /api/workspace/documents`,
  entonces responde `400` nombrando el campo y no se crea nada; con un `content` de 200.001 caracteres
  responde `400`; y con un `content` de 200.000 caracteres responde `201` (el límite de cuerpo del
  servidor no rechaza un documento legítimo antes de que el DTO lo valide).

- **AC-14** — Dado un documento `Ideas` en la raíz, cuando se crea otro llamado `IDEAS` en la raíz,
  entonces responde `409` con `code` `DOCUMENT_TITLE_TAKEN` y hay una sola fila; el mismo título dentro
  de un directorio responde `201`; y un **directorio** llamado `Ideas` y un **documento** llamado `Ideas`
  en el mismo ámbito conviven: el segundo responde `201`.

- **AC-15** — Dado un documento propio, cuando se hace `GET /api/workspace/documents/:id`, entonces
  responde `200` con `content` incluido; y con el `id` de un documento de otro usuario responde `404`.

- **AC-16** — Dado un documento propio, cuando se hace `PATCH /api/workspace/documents/:id` con un título
  nuevo, entonces responde `200` con `WorkspaceDocumentSummaryResponseDto` — que **no** incluye
  `content` — y el título en la base cambia; y cuando el título choca con un hermano responde `409` y el
  título no cambia.

- **AC-17** — Dado un documento propio, cuando se hace `POST /api/workspace/documents/:id/move` con
  `{ "directoryId": null }` o con el `id` de un directorio propio, entonces responde `200` con el
  `directoryId` nuevo; y cuando el destino es un directorio de otro usuario o inexistente, responde
  `404` y el `directoryId` del documento **no** cambia.

- **AC-18** — Dado un documento propio, cuando se hace `DELETE /api/workspace/documents/:id`, entonces
  responde `204` y la fila desaparece; y un segundo `DELETE` sobre el mismo `id` responde `404` (el
  borrado **no** es idempotente aquí, a diferencia del `logout` de la spec `001`).

- **AC-19** — Dado un usuario con directorios anidados y documentos dentro, cuando se borra su fila de
  `users`, entonces no queda ninguna fila suya en `directories` ni en `documents` (la cascada la hace la
  base, no la aplicación).

### Lectura del árbol

- **AC-20** — Dados dos usuarios con estructuras de nombres idénticos, cuando cada uno hace
  `GET /api/workspace/tree`, entonces cada respuesta es un `WorkspaceTreeResponseDto` con
  `directories`, `documents` y `generatedAt` (ISO-8601) que contiene **solo** los nodos propios; los dos
  arrays son **planos** (cada nodo lleva su `parentId`/`directoryId`), vienen ordenados de forma
  determinista por `nameKey` y **ningún** elemento de `documents` incluye `content`; el `depth` de cada
  directorio coincide con su número de ancestros.

- **AC-21** — Dado un usuario que ya tiene el máximo de nodos permitido (directorios + documentos),
  cuando intenta crear uno más — de cualquiera de los dos tipos — entonces responde `409` con `code`
  `WORKSPACE_LIMIT_REACHED` y no se crea nada.

### Autorización, credencial y protección

- **AC-22** — Dados dos usuarios, cada uno con un directorio y un documento, cuando el usuario B invoca
  **cada uno** de los diez endpoints de workspace con los ids de A, entonces **todas** las respuestas son
  `404` (ninguna es `403`), el estado de A no cambia en absoluto, y un `id` que no es un uuid responde
  `400`; además, `PrismaService` se inyecta en **un solo** archivo de `src/workspace/**` (todo acceso a
  datos pasa por el repositorio que exige `userId`).

- **AC-23** — Dados los diez endpoints de workspace, cuando se invocan sin cabecera `Authorization`,
  entonces todos responden `401` con `ErrorResponseDto`; y cuando se invocan con un **refresh token** como
  `Bearer`, también responden `401`.

- **AC-24** — Dado un usuario autenticado, cuando hace 15 lecturas seguidas de `GET /api/workspace/tree`,
  entonces las 15 responden `200` (los endpoints de workspace **no** heredan el límite de `login`, que es
  de 10 por minuto); cuando supera el límite propio de `workspace`, responde `429` con
  `ErrorResponseDto`; y **todo** controlador de `src/**` declara explícitamente su throttler
  (`@Throttled(...)`) o su exención (`SkipThrottling()`).

- **AC-25** — Dado un directorio propio, cuando dos peticiones simultáneas intentan renombrarlo con
  nombres que colisionan entre sí, entonces exactamente una responde `200` y la otra `409`, y en la base
  queda una sola fila con ese `nameKey`; y cuando se mueve un directorio a un destino que se acaba de
  borrar, responde `404` y el sujeto no queda huérfano ni con un `parentId` inexistente.

- **AC-26** — Dado el API en entorno no productivo, cuando se hace `GET /api/docs-json`, entonces el
  documento incluye las **diez** rutas de `/api/workspace/*` con su método, todas declaran `security` con
  `bearer` y documentan `401` y `429`, y las **nueve** que resuelven un `:id` documentan además `404`;
  `GET /api/workspace/tree` **no** declara `404` y se comprueba explícitamente que no lo declara, porque
  es la única ruta que no puede emitirlo —no resuelve ningún `:id` y un workspace vacío responde `200`
  con las dos listas vacías (`plan.md` §4, que ya lo enumeraba así)—; incluye los schemas
  `WorkspaceTreeResponseDto`,
  `WorkspaceDirectoryResponseDto`, `WorkspaceDocumentSummaryResponseDto`,
  `WorkspaceDocumentResponseDto` y los DTO de entrada; **ningún** schema se llama como un modelo de
  Prisma (la lista se lee del `schema.prisma` real, así que `Directory` y `Document` entran solos en esa
  red); y el documento **no** menciona `nameKey`, `titleKey`, `parentScopeId` ni `userId`.

### Contrato compartido

- **AC-27** — Dados los tipos y guards de workspace en `@one-markdown/shared`, cuando se les pasa una
  forma válida devuelven `true`, y cuando se les pasa `parentId`/`directoryId` **ausente** en vez de
  `null`, un `depth` no numérico, un `documents` que no es array o un `code` de error que no es string,
  devuelven `false`.

### Frontend

- **AC-28** — Dada la sesión iniciada y un árbol con directorios y documentos, cuando se renderiza la
  barra lateral, entonces existe un `role="tree"` con nombre accesible cuyos nodos son `role="treeitem"`
  con `aria-level` correcto, `aria-expanded` en los directorios y `aria-selected` en el seleccionado;
  solo **un** nodo es tabulable (roving tabindex); y las flechas arriba/abajo mueven el foco entre nodos
  visibles, la derecha expande o entra al primer hijo y la izquierda contrae o sube al padre.

- **AC-29** — Dada la barra lateral, cuando el usuario crea un directorio, renombra un documento o borra
  un nodo, entonces la aplicación llama al endpoint correspondiente y el árbol refleja el cambio; cuando
  el servidor responde `409`, el mensaje aparece en un contenedor `role="alert"` y el árbol **no** cambia;
  y borrar un directorio con hijos exige una confirmación explícita antes de enviar `recursive=true`.

- **AC-30** — Dado un directorio con descendientes, cuando el usuario abre el diálogo de mover, entonces
  el selector de destino ofrece la raíz y los directorios válidos pero **excluye** el propio directorio y
  todos sus descendientes; y si el servidor responde `409` o `404`, el error se muestra y el árbol se
  vuelve a cargar.

- **AC-31** — Dado un documento en el árbol, cuando el usuario lo activa (clic o `Enter`), entonces la
  aplicación navega a `/documents/:id` y muestra su título, su ruta dentro del árbol y su markdown **en
  crudo**; y si el servidor responde `404`, muestra un estado de «este documento ya no existe» y recarga
  el árbol.

- **AC-32** — Dado el navegador real con web y api corriendo, cuando Playwright registra un usuario, crea
  un directorio, crea un subdirectorio dentro, crea un documento en el subdirectorio, lo renombra, lo
  mueve **a la raíz**, lo abre, y por último borra el directorio de forma recursiva, entonces **el árbol
  queda con un solo `treeitem`, el del documento movido** —el subdirectorio cae con su padre y el
  documento sobrevive porque ya no colgaba de él—, el documento abierto sigue a la vista y en su ruta, y
  el recorrido completo pasa **sin errores de consola**.

  _Corregido en la v0.3.0._ Hasta la v0.2.3 este AC decía «el árbol queda vacío», que **contradice su
  propio recorrido**: el documento se muda a la raíz **antes** del borrado recursivo, así que el borrado
  no puede llevárselo. `tasks.md` T-023 lo describía bien desde el principio y es lo que se implementó;
  lo que estaba mal era esta frase. Un árbol vacío al final exigiría otro recorrido (borrar el documento
  también, o moverlo *dentro* del directorio antes de borrarlo), y ese recorrido probaría menos: que el
  documento **sobreviva** es justo la prueba de que la cascada del servidor borra el subárbol y **solo**
  el subárbol.

  Dos precisiones sobre **cómo** se comprueba, que no son detalle de implementación sino condición para
  que el criterio sea verificable:

  - **«Abrirlo y comprobar su contenido» no puede significar texto.** Un documento creado desde la
    interfaz nace **sin contenido**: el store manda solo `title`/`directoryId` al crear, y el `PATCH` de
    esta spec solo acepta `title` —escribir contenido es la spec `003`, ver §4—. Lo que se comprueba al
    abrirlo es, por tanto: la URL `/documents/:uuid`, el `aria-selected` de su fila en el árbol, el `h2`
    con su título, el breadcrumb **de un solo paso** (que es la prueba de que la mudanza a la raíz llegó
    al servidor y no solo al estado del cliente) y la región `Markdown en crudo` **visible y vacía**. La
    región tiene que existir y verse: un hueco ausente y un contenido vacío se distinguen, y solo el
    primero sería un defecto.
  - **El `role="tree"` vacío se comprueba con `toBeAttached()`, no con `toBeVisible()`.** Sin filas, el
    contenedor no ocupa un solo píxel y un navegador real lo da por oculto; quien cuenta que no hay nada
    es el texto «Todavía no hay directorios ni documentos.», que vive **fuera** del árbol y sí es
    visible. No es un fallo de accesibilidad —un árbol sin nodos no tiene ninguna parada de tabulación
    que ofrecer— pero sí una asimetría con JSDOM, donde `toBeVisible` no calcula *layout* y la aserción
    imposible habría pasado.

### Límite de cuerpo HTTP

_(AC-33 se añade en la v0.2.0 y va al final por **numeración append-only**: renumerarlo para meterlo
junto a AC-13 rompería las referencias de `tasks.md`, de la tabla de trazabilidad y de las tres fases ya
escritas en `IMPLEMENTATION.md`. Temáticamente pertenece al bloque de «Autorización, credencial y
protección».)_

- **AC-33** — Dado un usuario autenticado, cuando envía a `POST /api/workspace/documents` un cuerpo JSON
  **por encima de `JSON_BODY_LIMIT`** (2 MiB), entonces la respuesta es **`413`** con la forma de
  `ErrorResponseDto` (`statusCode: 413`, `error`, `message`, `path`, `timestamp`) y **no** `500`; y un
  error interno de verdad —uno que no lleva ningún estado HTTP— sigue respondiendo `500`, para que la
  traducción no se coma los fallos que sí deben ser `5xx`.

### Entorno de desarrollo y presupuesto de la suite de navegador

_(AC-34 y AC-35 se añaden en la v0.3.0, también por **numeración append-only**. Los dos salen de correr
AC-32 en un navegador real: son defectos **medidos**, no supuestos, y ninguno lo podía ver JSDOM. No
cambian ningún endpoint, ningún DTO ni ninguna respuesta HTTP — viven en `vite.config.ts` y en el
andamiaje de la suite e2e.)_

- **AC-34** — Dado `apps/web/node_modules/.vite` con una caché de `optimizeDeps` **anterior** al contrato
  actual de `@one-markdown/shared` (una del tiempo de la spec `001`, sin `isWorkspaceTree`), cuando se
  arranca el servidor de desarrollo **sin `--force`** y se carga la aplicación con sesión iniciada,
  entonces el navegador recibe un `@one-markdown/shared` con **todas** sus exportaciones actuales y el
  árbol se pinta; y el árbol **no** muestra «Ocurrió un error inesperado» pese a que
  `GET /api/workspace/tree` respondió `200`.

  **Por qué existe**: Vite invalida la caché de dependencias por el **hash del lockfile** y el **hash de
  la configuración** (verificado con `context7` el 2026-07-25 contra `optimizer/index.ts` y
  `guide/troubleshooting.md` de Vite: *«Vite detects dependency overrides but not `npm link` usage»*).
  El **contenido** de un paquete enlazado del workspace no entra en ninguno de los dos hashes, así que
  añadir tipos y guards a `packages/shared` **no** invalida nada. Consecuencia medida: quien tuviera un
  `pnpm dev` anterior a la spec `002` veía el árbol roto con un `TypeError: guard is not a function`
  hasta borrar `node_modules/.vite` a mano, **con `packages/shared/dist` perfectamente al día**. La suite
  e2e lo esquiva hoy con un `pnpm dev --force` en `playwright.config.ts`; este AC exige que esa línea
  pueda volver a ser `pnpm dev` a secas, o sea que la suite deje de compensar un defecto del producto.

  **Honestidad sobre qué queda automatizado, porque este AC no encaja del todo en la regla de §3.** El
  envenenado de la caché es un **paso manual** y el rojo que produce se demuestra **una vez**, igual que
  las tres mutaciones de control con las que `T-023` demostró que su recorrido discrimina. Lo que queda
  vigilando después es la retirada del `--force`: a partir de ahí, si alguien quita el `force` de
  `vite.config.ts`, `pnpm test:e2e` se rompe **en local** para cualquiera con caché previa. **En CI no lo
  cazaría** —el runner siempre arranca con `node_modules/.vite` frío, así que allí `force: true` y su
  ausencia son **indistinguibles**— y eso se acepta a sabiendas: el defecto vive en la máquina de quien
  desarrolla, que es justo donde CI no mira.

  **Cómo se verificó (v0.3.1), y por qué la demostración necesita tres pasos.** El rojo se midió con el
  `--force` ya retirado de `playwright.config.ts` y `@one-markdown_shared.js` sembrado sin
  `isWorkspaceTree` (`grep -c` → `0`) **sin tocar `_metadata.json`**: `pnpm test:e2e` → `1 failed /
  4 passed`, y el fallo fue **el correcto** —snapshot con `alert: Ocurrió un error inesperado…` **y** traza
  de red del mismo caso con `/api/workspace/tree | 200`—, o sea que el servidor respondía bien y quien
  fallaba era el bundle rancio. Ese rojo por sí solo **no basta**: deja viva la explicación alternativa de
  que lo que salva la caché después es el `configHash` nuevo que introduce el propio cambio de
  `vite.config.ts`, y no el `force`. Se descarta envenenando **contra el mismo `configHash`**:
  (1) `pnpm test:e2e` ya con `force: true` → **5 passed**, con lo que la caché se reconstruye con el
  `configHash` nuevo; (2) se envenena **esa** caché (`grep -c` 2 → 0, y `node --check` confirma que el
  fichero envenenado **sigue siendo JS válido**, es decir que el guard llega `undefined` y no hay error de
  parseo que enmascare nada); (3) `pnpm test:e2e` → **5 passed**. Con los hashes casando, lo único que
  puede salvar esa caché es `force`.

- **AC-35** — Dada la suite de navegador ejecutada con reintentos (`retries: 2`, que es la configuración
  de CI) y **todos** sus casos agotándolos, cuando termina la ejecución, entonces **ninguna** llamada a
  `POST /api/auth/register` **ni a `POST /api/auth/login`** ha recibido un `429` y la suite pasa entera.

  **Por qué existe**: el registro está limitado a **5 altas por IP cada 15 minutos** y la entrada a
  **10 por IP y minuto** (`THROTTLE_LIMITS`, spec `001`). Una ejecución **limpia** de la suite gasta
  **exactamente 5** altas — `smoke` 3, porque su `beforeEach` llama a `signIn`, que hace un
  `POST /register` en cada caso aunque le devuelvan `409`; `auth` 1 y `workspace` 1, cada una con cuenta
  nueva. El presupuesto está agotado al milímetro, así que **el primer reintento de CI pide la sexta alta
  y recibe un `429`**: un rojo que no tiene nada que ver con lo que la suite mide y que aparecerá justo
  cuando algo ya haya ido mal. No es alcance de `T-023` —el gasto es compartido con la suite de `001`— y
  por eso el agente lo reportó en vez de arreglarlo por su cuenta, que es lo correcto.

  **Corrección de la v0.3.1: el cupo de `login` también se agota, y la redacción original solo hablaba de
  `register`.** La cuenta real del escenario del AC —todos los casos agotando `retries: 2`— es: smoke
  3 casos × 3 intentos = **9** entradas, más el flujo de auth, que vuelve a entrar en cada intento (**3**)
  → **12 contra un cupo de 10/min**. Ese gasto **ya existía antes del cambio** (el `signIn` viejo también
  hacía `login` después del `409`); lo que pasaba es que el `429` de `register` llegaba primero y lo
  tapaba. Medido: con el reset aplicado solo a `register`, el `DONE` seguía rojo con
  `POST /api/auth/login devolvió 429`. Por eso el reset se aplica a **`throttle:register:*` y
  `throttle:login:*`**.

  **Y una consecuencia de segundo orden que la decisión original no contemplaba: el bloqueo por cuenta.**
  «`login` antes de registrar» hace que, en una base limpia, **todos** los trabajadores empiecen con un
  `login` fallido contra una cuenta que aún no existe — y **5 fallos bloquean la cuenta 15 minutos**
  (`LoginAttemptService`, spec `001`). Ese bloqueo es **por cuenta, no por IP**, así que ningún reset de
  `throttle:*` lo evita; con los 6 trabajadores que Playwright levanta en local era una moneda al aire.
  Se elimina **por construcción**: la cuenta compartida se crea **una sola vez**, en `global-setup.ts`,
  antes de que arranque ningún caso — lo que además baja el gasto del smoke de 3 altas a **0**. Verificado
  en el bundle de Playwright 1.62 (`runner/index.js`, `createGlobalSetupTasks`) que los plugins de
  `webServer` corren **antes** de `globalSetup`, así que el API ya responde cuando se prepara la cuenta;
  `signIn` conserva un camino de reserva por si acaso.

  **Lo que este AC cuesta en cobertura, escrito aquí porque es donde sobrevive.** Al poner a cero esos dos
  contadores, **la suite de navegador deja de poder detectar los límites de `register` y de `login`**: los
  neutraliza a propósito. **No se pierde cobertura**: quien los verifica es
  `apps/api/test/auth-throttle.e2e-spec.ts`, con un caso por cada uno, y el bloqueo por cuenta lo verifica
  `apps/api/test/auth-login.e2e-spec.ts` (`AC-7: bloqueo por cuenta tras cinco fallos`). Es su sitio: un
  límite **por IP** se prueba contra el API, no a través de un navegador.
  **No lleves este reset a la suite del API.** Es el atajo obvio el día que aquella suite moleste por
  acumulación, y allí destruiría la única prueba de que los límites existen. **No se aplicó ninguno**, y
  la prohibición queda escrita también en `apps/web/e2e/support/services.ts`, junto a la función que lo
  hace.
  El **bloqueo por cuenta** tampoco lo ejercita la suite de navegador, ni antes ni ahora: se evita **por
  construcción** (una sola alta en `global-setup`), no se neutraliza.

## 4. Fuera de alcance

- **Editar el contenido de un documento.** Esta spec crea documentos (con contenido inicial opcional),
  los renombra, los mueve, los borra y los lee; **no** expone ningún endpoint para modificar `content`.
  El bucle de guardado (debounce, estado sucio, conflicto entre dos pestañas) es el problema central de
  la spec `003-editor` y va con sus propios criterios. Consecuencia asumida: hasta que `003` exista, un
  documento solo tiene el texto con el que nació.
- **Preview y sanitización del markdown**: spec `003`. La vista de `/documents/:id` que entra aquí
  muestra el markdown **en crudo**, dentro de un `<pre>`, y es explícitamente un andamio para que `003`
  lo sustituya. No se renderiza HTML, así que no hay nada que sanitizar todavía.
- **Paleta de elementos markdown** (`004`), **tabs y split view** (`005`).
- **Arrastrar y soltar** para mover nodos. Mover se hace con un diálogo y un selector de destino, que es
  accesible por teclado desde el primer día. El *drag and drop* es una capa encima y entra con `005` o
  con una spec propia de interacción.
- **Papelera, deshacer y versiones.** El borrado es definitivo (decisión 6 de `plan.md`). Una papelera con
  restauración es una feature de producto con su propio modelo y su propia spec.
- **Búsqueda, filtro y ordenación configurable del árbol.** El orden es alfabético por nombre
  normalizado y no se puede cambiar.
- **Compartir, colaborar, permisos y enlaces públicos.** La propiedad es de un solo usuario, igual que en
  `001` (sin roles, sin equipos).
- **Adjuntos, imágenes y ficheros que no sean markdown.** Un documento es texto.
- **Importar y exportar** (subir un `.md`, bajar un `.zip` del árbol). Cuando entre, tendrá que sanitizar
  nombres para el sistema de ficheros de destino; ver riesgo #4.
- **Mover o copiar en lote, multiselección, duplicar.** Una operación afecta a un nodo.
- **Etiquetas, favoritos, colores, iconos por carpeta.**
- **Paginación o carga por niveles del árbol.** Se sirve completo (decisión 4 de `plan.md`); el tope de
  nodos es lo que lo hace sostenible.
- **Caché HTTP del árbol (`ETag`, `If-None-Match`).** Cada mutación provoca una recarga completa del
  árbol; a este tamaño es más barato que gestionar invalidación.
- **Diseño visual definitivo.** El árbol es funcional y accesible, no una propuesta de UI final.

## 5. Riesgos y decisiones abiertas

| # | Riesgo / duda | Impacto | Mitigación / quién decide |
|---|---------------|---------|---------------------------|
| 1 | **Prisma no puede expresar la unicidad que este modelo necesita.** Verificado con `context7` el 2026-07-25 contra la documentación de Prisma 7: en un `@@unique` los `NULL` se consideran **distintos**, así que `@@unique([userId, parentId, nameKey])` **no** impediría dos directorios llamados igual en la raíz (`parentId` nulo); los índices parciales existen ya (`where` en `@@unique`) pero como *preview feature*, y no hay soporte de índices por expresión (`lower(name)`) | **Alto**: sin esto la unicidad de nombres sería un adorno y AC-3/AC-14 pasarían en local y fallarían con concurrencia real | Se añaden dos columnas derivadas y **no nulas**: `nameKey`/`titleKey` (nombre normalizado) y `parentScopeId` (`parentId ?? userId`), y el índice único va sobre ellas (`plan.md` §5, decisión 3). Todo declarativo, sin *preview features* y sin SQL a mano en la migración. Si el `where` de `@@unique` llega a estable, quitar `parentScopeId` es un cambio **minor** de esta spec |
| 2 | `parentScopeId` es estado **derivado**: un camino de escritura que se olvide de recalcularlo rompe la unicidad en silencio y para siempre | Medio–alto | Una sola clase (`WorkspaceRepository`) escribe en estas tablas, y `parentScopeId` se calcula en **una** función usada por create y move. Se verifica con un test que recorre todas las filas y comprueba `parentScopeId === parentId ?? userId` (AC-1, AC-2 lo comprueban en el camino feliz; el test de consistencia lo comprueba en bloque). El AC-22 exige además que `PrismaService` se inyecte en un único archivo del módulo |
| 3 | La unicidad **insensible a la caja** se calcula en Node con `toLowerCase()`, no en SQL con `lower()`. Para Unicode exótico (la `i` sin punto del turco, `ß` → `ss`) los dos algoritmos difieren | Bajo | La clave se calcula **solo** en Node y se guarda; la base nunca la deriva, así que no hay dos algoritmos que puedan discrepar. Se usa `toLowerCase()` y **no** `toLocaleLowerCase()` a propósito: el primero es independiente del locale del proceso y por tanto determinista entre máquinas y CI. Documentado en `plan.md` §3 |
| 4 | Se **permiten** caracteres que un sistema de ficheros odia (`:`, `*`, `?`, `"`, `<`, `>`, `|`) y solo se prohíben los separadores de ruta y los nombres `.` y `..` | Bajo hoy, medio cuando entre exportar | El almacenamiento es una base de datos, no un directorio: sanitizar para un `.zip` es problema del exportador, que además necesitará resolver colisiones de nombres al aplanar. Se registra aquí para que la spec de import/export lo asuma explícitamente y no lo descubra tarde |
| 5 | **El borrado es real y en cascada**: `DELETE` de un directorio con `recursive=true` destruye su subárbol completo, sin papelera y sin deshacer | **Alto** (pérdida de datos del usuario) | Dos frenos: el endpoint responde `409 DIRECTORY_NOT_EMPTY` si el directorio tiene hijos y no se pidió `recursive`, y la UI exige una confirmación explícita que nombra lo que se va a perder (AC-11, AC-29). Se descarta el borrado lógico por la razón de la decisión 6 de `plan.md`: un `deletedAt` obliga a **todas** las specs siguientes a acordarse de filtrarlo, y un solo olvido resucita datos borrados |
| 6 | El árbol se sirve **completo** en una sola respuesta: un usuario con muchísimos nodos convierte cada recarga en una descarga grande | Medio | Tope de **5.000 nodos** por usuario (AC-21), payload plano y sin contenidos (unos ~150 bytes por nodo → ~750 KB en el peor caso teórico, frente a decenas de KB en el uso real). La salida es `GET /api/workspace/tree?parentId=…` por niveles, que es aditiva y no rompe el contrato actual |
| 7 | El límite de cuerpo de Express es de **100 kB** por defecto, así que un documento legítimo de 200.000 caracteres se rechazaría **antes** de que el DTO lo viera | Medio: AC-13 falla por un motivo que no tiene nada que ver con el dominio | Se sube el límite de JSON a **2 MiB** en `configureApp` con `app.useBodyParser('json', { limit })` (verificado que existe en `@nestjs/platform-express` 11.1.28), y AC-13 comprueba las dos orillas: 200.000 pasa, 200.001 da `400`. Ojo: el límite es global, así que también aplica a los endpoints de auth — inofensivo, porque sus DTO acotan cada campo. **Corregido el 2026-07-25 (v0.2.0)**: esta fila decía «se rechazaría con `413`» y lo medido al implementar `T-008` es un **`500`** — el `PayloadTooLargeError` de body-parser no es una `HttpException` y `AllExceptionsFilter` no lo reconoce, aunque el error traiga `status: 413`. El rechazo por encima del límite pasa a ser AC-33, con su tarea `T-024`, en vez de quedar como suposición no verificada |
| 8 | La transacción del **move** corre en `Serializable`; bajo concurrencia Prisma puede devolver `P2034` (fallo de serialización) | Bajo | Se traduce a `409` con `code` `WORKSPACE_CONFLICT` y **no** se reintenta en el servidor: un move es una acción del usuario, y un `409` honesto que la UI muestra es mejor que un reintento silencioso que puede aplicar el cambio dos veces. La traducción se prueba en unit; el camino concurrente se prueba con renames simultáneos (AC-25), que es reproducible |
| 9 | Los endpoints de workspace **no heredan** ningún límite del rate limit de `001` (es opt-in por ruta, `T-017`), así que un endpoint nuevo que se olvide de declararlo queda sin freno. El CHANGELOG de `001` dejó esta decisión explícitamente para esta spec | Medio | Se añade un quinto throttler nombrado, `workspace` (120/min/IP), declarado a nivel de controlador; **no** se añade un throttler `default` global, para no convertir el modelo opt-in en opt-out a medias. El olvido se hace mecánico: AC-24 exige un test que compruebe que **todo** controlador declara su throttler o su exención. Se hereda el riesgo del NAT compartido ya aceptado en `001` |
| 10 | `Document` como nombre de tipo **choca con el `Document` del DOM** en el bundle del navegador: un `import type { Document }` que se resuelva mal no falla, se resuelve al tipo global y tipa cualquier cosa | Medio (silencioso) | En `packages/shared` los tipos se llaman `DirectoryNode`, `DocumentSummary` y `MarkdownDocument`; el modelo de Prisma sí se llama `Document`, pero vive solo en el servidor. Ningún tipo compartido se llama `Document` ni `Directory` |
| 11 | Esta spec necesita un `code` legible por máquina en los errores para distinguir cinco `409` distintos, y `ErrorResponseDto`/`ApiErrorShape` son contrato de la spec `000` | Bajo, pero toca una spec ya implementada | El campo es **opcional y aditivo** (`code?: string`), como ya lo es `retryAfterSeconds`: ningún error existente lo emite y los tests de `000` que comprueban el juego exacto de claves siguen verdes. Al implementarse, `specs/000-foundation/CHANGELOG.md` recibe una entrada de patch. La alternativa (que el frontend distinga los `409` por el texto del mensaje) es exactamente la clase de acoplamiento que rompe en cuanto alguien traduzca un mensaje |
| 12 | La spec `003` necesitará escribir contenido y detectar conflictos, y podría verse obligada a cambiar DTOs de esta spec | Bajo | `WorkspaceDocumentResponseDto` ya lleva `updatedAt`, que es lo que `003` necesita para una comprobación optimista (`If-Unmodified-Since` o un `expectedUpdatedAt` en el cuerpo). Añadir `PATCH /api/workspace/documents/:id/content` es aditivo. **No** se añade una columna `version` por adelantado: sería especular sobre un mecanismo que `003` todavía no ha decidido |
| 13 | El frontend recarga el árbol completo tras **cada** mutación en vez de actualizarlo de forma optimista | Bajo | Decisión consciente (decisión 12 de `plan.md`): a este tamaño una recarga es una petición barata, y el estado optimista es la fuente clásica de árboles que muestran algo que el servidor no tiene. Si el parpadeo molesta, la mejora es local al store y no cambia ningún contrato |
| 14 | La profundidad máxima (10 niveles) y el tope de nodos (5.000) son decisiones de producto tomadas sin datos de uso | Bajo | Son constantes del código con nombre propio (no variables de entorno, igual que los umbrales de seguridad de `001`), así que subirlas es un cambio de una línea más una entrada en el CHANGELOG. Se eligen holgadas: 10 niveles es más de lo que cualquier jerarquía de notas sostiene legiblemente, y 5.000 documentos es una vida de notas |
| 15 | **El aviso genérico del árbol oculta los fallos del cliente.** «Ocurrió un error inesperado» es lo que se le enseña a la persona tanto si el servidor devolvió un `5xx` como si el código del navegador reventó por su cuenta. Es exactamente lo que pasó con la caché rancia de AC-34: la petición había ido **bien** (`200`) y el que se rompió fue un guard del cliente, y el mensaje decía lo mismo que si el backend estuviera caído. Añadido en la v0.3.0 | Medio, y **silencioso**: el mensaje es correcto de cara al usuario y engañoso de cara a quien depura. Costó una sesión de instrumentación descubrir que el `200` y el error convivían | **Registrado, y a propósito sin tarea.** Distinguir «el servidor dijo que no» de «el cliente se rompió» no es un arreglo mecánico: obliga a decidir qué se le enseña a la persona en cada caso —¿un texto distinto?, ¿un identificador de incidencia?, ¿nada y solo un `console.error` con más contexto?— y eso es producto, no corrección de un defecto. Se deja escrito para que la spec que toque el manejo de errores de la UI (`003` es la primera candidata) lo herede con el caso real ya documentado, en vez de redescubrirlo. Lo que **sí** entra ya, por AC-34, es que la causa concreta deje de ocurrir |
| 16 | La caché de `optimizeDeps` y el presupuesto de altas de la suite e2e son **infraestructura compartida entre specs**: la primera vive en `vite.config.ts` (spec `000`) y el segundo en `apps/web/e2e/support/session.ts` (spec `001`). Arreglarlos desde esta spec toca andamiaje que no es suyo. Añadido en la v0.3.0 | Bajo, pero es el patrón que ya obligó a `T-004` y `T-024` a pararse | Mismas reglas que `T-004` y `T-024`, que ya tocaron contrato de la spec `000`: la tarea lo declara por adelantado, y **si algún test de `000` o de `001` se pone en rojo se para y se reporta**, no se ajusta el test de otra spec por cuenta propia. Las dos tareas (`T-026`, `T-027`) dejan entrada de cierre en el CHANGELOG de la spec dueña del archivo, igual que `T-024` la dejó en `000` v0.1.6. **Cerrado en la v0.3.1 y salió bien**: ningún test de `000` ni de `001` cayó, y las entradas están escritas — `000` **v0.1.7** (`vite.config.ts`) y `001` **v0.1.1** (andamiaje e2e). El riesgo era real y el procedimiento lo contuvo: `T-027` **sí** tuvo que ampliar lo que tocaba (el reset de `login` y `global-setup.ts`), y lo reportó en vez de resolverlo en silencio |

## 6. Trazabilidad

**Cobertura al cerrar la v0.3.1: 35/35 AC, ninguno sin verificación.** Los 33 del alcance aprobado, con
test automatizado; AC-34 y AC-35 con lo que se describe abajo — AC-35 con un comando automatizado
(`--retries=2 --repeat-each=3` → 15 passed) y AC-34 con un rojo **manual** demostrado en tres pasos, que
es la única salvedad de toda la spec y está escrita en el propio AC. Comprobado el
2026-07-25 uno por uno contra el árbol de archivos real, no contra esta tabla: los **24** archivos que
aparecen en la columna «Cubierto por» existen, y cada AC tiene al menos un `describe`/`it` que lo nombra o
que ejercita su comportamiento (los `describe` de los e2e de backend llevan el número de AC en el título;
AC-1, AC-2, AC-6, AC-8, AC-15…AC-20, AC-23 y AC-26 están dentro de bloques titulados con su AC). Los dos
AC de la v0.3.0 —**AC-34** y **AC-35**— quedan **cerrados en la v0.3.1**: ninguna fila de esta tabla tiene
ya la tarea abierta.

**Lo que NO queda con cobertura automática, en un sitio donde se lea sin buscar** (el detalle y el porqué
están en AC-34 y AC-35):

1. **El envenenado de la caché de AC-34 es manual y CI no lo cazará nunca.** El runner arranca siempre con
   `node_modules/.vite` frío, así que allí `force: true` y su ausencia son indistinguibles. Lo que sí queda
   vigilando es la retirada del `--force` de `playwright.config.ts`: si alguien quita el `force` de
   `vite.config.ts`, `pnpm test:e2e` se rompe **en local** para cualquiera con caché previa, y **en CI no**.
   El defecto vive en la máquina de quien desarrolla, que es justo donde CI no mira.
2. **La suite de navegador ya no detecta los límites de `register` ni de `login`** — los neutraliza a
   propósito (AC-35). Quien los verifica es `apps/api/test/auth-throttle.e2e-spec.ts`, un caso por cada
   uno, y `apps/api/test/auth-login.e2e-spec.ts` para el bloqueo por cuenta. **No se aplicó ningún reset en
   la suite del API**, y no debe aplicarse: allí destruiría la prueba de que el límite existe.
3. **El bloqueo por cuenta (`LoginAttemptService`, 5 fallos) tampoco lo ejercita la suite de navegador**,
   ni antes ni ahora. Se evita **por construcción** —una sola alta en `global-setup.ts`—, no se neutraliza.

| AC | Cubierto por | Tarea |
|----|--------------|-------|
| AC-1 | `apps/api/test/workspace-directories.e2e-spec.ts` (alta en raíz + fila en base) | T-005 |
| AC-2 | `apps/api/test/workspace-directories.e2e-spec.ts` (alta anidada) | T-005 |
| AC-3 | `apps/api/test/workspace-directories.e2e-spec.ts` + `src/workspace/workspace-name.spec.ts` | T-002, T-005 |
| AC-4 | `apps/api/test/workspace-directories.e2e-spec.ts` (validación) + `src/workspace/workspace-name.spec.ts` | T-002, T-005 |
| AC-5 | `apps/api/test/workspace-directories.e2e-spec.ts` (padre ajeno / inexistente) | T-005 |
| AC-6 | `apps/api/src/workspace/tree-graph.spec.ts` + `test/workspace-directories.e2e-spec.ts` | T-003, T-005 |
| AC-7 | `apps/api/test/workspace-directories.e2e-spec.ts` (rename) | T-006 |
| AC-8 | `apps/api/src/workspace/tree-graph.spec.ts` (ciclo) + `test/workspace-move.e2e-spec.ts` | T-003, T-007 |
| AC-9 | `apps/api/test/workspace-move.e2e-spec.ts` (destino ajeno) | T-007 |
| AC-10 | `apps/api/src/workspace/tree-graph.spec.ts` (altura + profundidad) + `test/workspace-move.e2e-spec.ts` | T-003, T-007 |
| AC-11 | `apps/api/test/workspace-directories.e2e-spec.ts` (delete vacío / con hijos / recursivo / query inválida) | T-006 |
| AC-12 | `apps/api/test/workspace-documents.e2e-spec.ts` (alta con y sin contenido) | T-008 |
| AC-13 | `apps/api/test/workspace-documents.e2e-spec.ts` (validación y límites de tamaño) | T-008 |
| AC-14 | `apps/api/test/workspace-documents.e2e-spec.ts` (títulos duplicados y convivencia con directorio) | T-008 |
| AC-15 | `apps/api/test/workspace-documents.e2e-spec.ts` (detalle) | T-008 |
| AC-16 | `apps/api/test/workspace-documents.e2e-spec.ts` (rename sin `content`) | T-009 |
| AC-17 | `apps/api/test/workspace-move.e2e-spec.ts` (mover documento) | T-009 |
| AC-18 | `apps/api/test/workspace-documents.e2e-spec.ts` (delete y segundo delete) | T-009 |
| AC-19 | `apps/api/test/workspace-cascade.e2e-spec.ts` | T-013 |
| AC-20 | `apps/api/test/workspace-tree.e2e-spec.ts` | T-010 |
| AC-21 | `apps/api/src/workspace/directories.service.spec.ts` + `documents.service.spec.ts` + `test/workspace-tree.e2e-spec.ts` | T-011 |
| AC-22 | `apps/api/test/workspace-ownership.e2e-spec.ts` + `src/workspace/workspace-data-access.spec.ts` | T-004, T-012 |
| AC-23 | `apps/api/test/workspace-ownership.e2e-spec.ts` (matriz sin Bearer) | T-012 |
| AC-24 | `apps/api/test/workspace-throttle.e2e-spec.ts` + `src/common/throttle-coverage.spec.ts` | T-014 |
| AC-25 | `apps/api/test/workspace-concurrency.e2e-spec.ts` + `src/workspace/prisma-error.spec.ts` | T-004, T-013 |
| AC-26 | `apps/api/test/swagger.e2e-spec.ts` (ampliado) | T-015, T-025 |
| AC-27 | `packages/shared/src/index.test.ts` (ampliado) | T-016 |
| AC-28 | `apps/web/src/features/workspace/WorkspaceTreeView.test.tsx` | T-019 |
| AC-29 | `apps/web/src/features/workspace/WorkspaceTreeView.test.tsx` (crear/renombrar/borrar) | T-020 |
| AC-30 | `apps/web/src/features/workspace/MoveNodeDialog.test.tsx` | T-021 |
| AC-31 | `apps/web/src/features/workspace/DocumentViewPage.test.tsx` + `apps/web/src/app/routes.test.tsx` (la ruta hija) | T-022 |
| AC-32 | `apps/web/e2e/workspace.spec.ts` | T-023 |
| AC-33 | `apps/api/test/body-limit.e2e-spec.ts` + `src/common/filters/all-exceptions.filter.spec.ts` (ampliado) | T-024 |
| AC-34 | `apps/web/e2e/workspace.spec.ts` con la caché envenenada y `pnpm dev` **sin** `--force` — **paso manual, demostrado en tres pasos** (ver AC-34); lo que queda vigilando en continuo es que `playwright.config.ts` ya **no** lleva `--force` | T-026 |
| AC-35 | la suite de `apps/web/e2e/` completa bajo `--retries=2 --repeat-each=3` → **15 passed** | T-027 |
