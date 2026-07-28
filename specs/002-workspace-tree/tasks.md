# Tareas 002 — Workspace tree

Spec: `spec.md` v0.3.1 · Plan: `plan.md`

Cada tarea es atómica, se asigna a un agente y sigue RED → GREEN → REFACTOR.
El test se escribe primero y **debe fallar antes** de implementar.

**Estado: las 27 tareas cerradas y verificadas (2026-07-25).** Las casillas se marcaron al cerrar la spec
en la v0.3.1, en una sola pasada y contra el registro de verificación de la Fase 4 de `IMPLEMENTATION.md`,
que es donde vive el comando corrido y su salida real de cada una. Hasta entonces este archivo llevaba
todas las casillas vacías mientras el seguimiento iba por otro lado: **eso era una inconsistencia**, no
una convención — la spec `001` sí las marca, y así queda también aquí.

**Tareas de tipo `setup`**: correr una migración no tiene un test que pueda fallar antes de que exista la
tabla. Se marcan `setup` y se verifican con un comando de salida observable. **Toda tarea que introduce
comportamiento es TDD estricta.** No se admite una tarea `setup` que además implemente comportamiento.

**Ninguna tarea instala dependencias** (`plan.md` §1). Si alguna parece necesitarlo, para y reporta.

---

## Bloque A — Esquema y dominio puro

- [x] **T-001** · `backend` · `setup` · Modelos `Directory` y `Document` + migración
      **AC**: — (habilita AC-1…AC-21)
      **Depende de**: —
      **QUÉ**: añadir a `apps/api/prisma/schema.prisma` los dos modelos de `plan.md` §5 **tal como están
      escritos**, con las dos relaciones nuevas en `User`, la autorrelación nombrada `"DirectoryTree"`,
      los índices únicos `[parentScopeId, nameKey]` / `[parentScopeId, titleKey]`, los índices
      `[userId, parentId]` / `[userId, directoryId]` **y** los índices sueltos `[parentId]` /
      `[directoryId]` de la cascada, y `onDelete: Cascade` en las tres claves ajenas. Migración
      `workspace_tree`. Después, `prisma generate` (con esta configuración `migrate dev` **no** regenera
      el cliente).
      **DONE**: `pnpm --filter @one-markdown/api exec prisma migrate dev --name workspace_tree` sale 0 ·
      `prisma generate` sale 0 · `prisma migrate status` → sin migraciones pendientes · verificación del
      esquema **real** con el MCP `postgres`: columnas y tipos, los dos índices únicos, los índices de FK,
      y `ON DELETE CASCADE` en las tres FK
      **NOTA**: el prefijo de fecha lo pone Prisma; el nombre exacto de la carpeta se reporta al
      orchestrator (en `001` no coincidió con la predicción del plan).

- [x] **T-002** · `backend` · Dominio puro: normalización y validación de nombres
      **AC**: AC-3, AC-4, AC-13, AC-14
      **Depende de**: —
      **RED**: `apps/api/src/workspace/workspace-name.spec.ts` — `normalizeWorkspaceName` colapsa
      espacios internos, hace `trim` y normaliza a NFC (dos formas Unicode de `á` dan la **misma**
      salida) y **conserva la caja**; `workspaceNameKey` devuelve la versión en minúsculas y hace que
      `Notas`, `NOTAS` y `  notas  ` compartan clave, mientras `Año` y `Ano` **no** la comparten;
      `assertWorkspaceName` rechaza cadena vacía, solo espacios, longitud por encima del máximo del tipo,
      carácter de control (`\u0000`, `\u007f`), `/`, `\`, `.` y `..`, y **acepta** `:`, `*`, `?`, `|` y un
      emoji. El archivo **no** importa nada de Nest ni de Prisma (se comprueba leyendo sus imports).
      **GREEN**: `workspace-name.ts` con las tres funciones y `workspace.constants.ts` con las constantes
      de `plan.md` §3. `toLowerCase()`, nunca `toLocaleLowerCase()`. Cero `any`.
      **DONE**: `pnpm --filter @one-markdown/api test workspace-name`
      **ARCHIVOS DE ESTA TAREA** (corre en paralelo con T-003: no toques nada más):
      `workspace-name.ts`, `workspace-name.spec.ts`, `workspace.constants.ts`. El error de nombre
      inválido se exporta **desde `workspace-name.ts`**, no desde `workspace.errors.ts`, que es de T-003.

- [x] **T-003** · `backend` · Dominio puro: grafo del árbol (ancestros, profundidad, altura, ciclo)
      **AC**: AC-6, AC-8, AC-10
      **Depende de**: —
      **RED**: `apps/api/src/workspace/tree-graph.spec.ts` — con un mapa de nodos `{ id, parentId }`:
      `ancestorsOf` devuelve `[]` en la raíz y la cadena completa de un nieto; `depthOf` cuenta ancestros;
      `subtreeHeightOf` devuelve `0` en una hoja y `2` en un abuelo; un mapa **con ciclo** hace que
      `ancestorsOf` **lance** (no que se cuelgue: el test tiene que terminar);
      `assertMovable` rechaza el destino que es el propio sujeto y el que es su descendiente con
      `MOVE_INTO_DESCENDANT`, rechaza con `DEPTH_LIMIT_EXCEEDED` un subárbol de altura 2 movido a un
      destino en profundidad 8, acepta el mismo movimiento a un destino en profundidad 6, y **acepta**
      mover al padre que ya se tiene. Sin Nest ni Prisma, igual que T-002.
      **GREEN**: `tree-graph.ts` con las cuatro funciones puras y los errores de dominio de
      `workspace.errors.ts` (cada uno con su `code`). **`assertMovable` recibe `maxDepth` como
      parámetro** y `tree-graph.ts` no importa **nada**: así el test elige `maxDepth: 3` en vez de
      construir cadenas de diez niveles, y esta tarea no depende de `workspace.constants.ts` (que es de
      T-002 y se escribe en paralelo).
      **DONE**: `pnpm --filter @one-markdown/api test tree-graph`
      **ARCHIVOS DE ESTA TAREA** (corre en paralelo con T-002: no toques nada más):
      `tree-graph.ts`, `tree-graph.spec.ts`, `workspace.errors.ts`.

- [x] **T-004** · `backend` · `WorkspaceRepository` y traducción de errores de Prisma
      **AC**: AC-22 (parte mecánica), AC-25 (traducción)
      **Depende de**: T-001, T-002
      **RED**: (a) `apps/api/src/workspace/prisma-error.spec.ts` — `toWorkspaceHttpException` traduce
      `P2002` → `409` con el `code` del recurso (`DIRECTORY_NAME_TAKEN` o `DOCUMENT_TITLE_TAKEN` según el
      `meta.target`), `P2003` → `404 PARENT_NOT_FOUND`, `P2025` → `404`, `P2034` →
      `409 WORKSPACE_CONFLICT`, y **cualquier otro** error se propaga sin tocar (un `500` no se disfraza
      de `409`). (b) `apps/api/src/workspace/workspace-data-access.spec.ts` — leyendo el árbol de
      archivos de `src/workspace/`, **exactamente un** archivo menciona `PrismaService`, y ese archivo es
      `workspace.repository.ts`. (c) `apps/api/src/workspace/workspace.repository.spec.ts` (contra la base
      real) — `create`/`findOne`/`update`/`delete` de directorio y de documento con un `userId` ajeno **no**
      encuentran nada; `parentScopeId` queda igual a `parentId ?? userId` en las cuatro combinaciones
      (directorio raíz, directorio anidado, documento raíz, documento anidado); y un test de consistencia
      recorre todas las filas del usuario del caso y lo comprueba en bloque.
      **GREEN**: `workspace.repository.ts` como único punto de acceso a Prisma, con `scope: { userId }`
      como **primer parámetro de todos** sus métodos y `userId` en **todos** los `where`; helper único
      `parentScopeIdFor({ userId, parentId })`; `prisma-error.ts`. `ErrorResponseDto` y `ApiErrorShape`
      ganan `code?: string` (decisión 13 de `plan.md`) — comprobar que los tests de `000`/`001` que
      verifican el juego exacto de claves de un error siguen verdes.
      **DONE**: `pnpm --filter @one-markdown/api test workspace` · `pnpm --filter @one-markdown/api test`
      (la suite unitaria completa, para ver que el `code` opcional no rompió nada) ·
      `pnpm --filter @one-markdown/shared test`
      **NOTA**: tocar `ErrorResponseDto` afecta a una spec ya implementada. Si algún test de `000`/`001`
      se pone en rojo, **parar y reportar**: no se ajusta un test de otra spec sin pasar por el
      orchestrator.

## Bloque B — Directorios

- [x] **T-005** · `backend` · `POST /api/workspace/directories`
      **AC**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
      **Depende de**: T-003, T-004
      **RED**: `apps/api/test/workspace-directories.e2e-spec.ts` — alta en raíz → `201` con las claves
      **exactas** de `WorkspaceDirectoryResponseDto`, `parentId: null`, `depth: 0`, y en la base
      `parentScopeId === userId` y `nameKey === 'notas'`; alta anidada → `201` con `depth: 1` y
      `parentScopeId` igual al `id` del padre; `NOTAS` en el mismo ámbito → `409` con
      `code: 'DIRECTORY_NAME_TAKEN'` y una sola fila; el mismo nombre en otro padre → `201`; nombre
      vacío / 121 caracteres / con `/` / igual a `..` / `parentId` ausente / `parentId` no uuid /
      propiedad no declarada → `400` nombrando el campo y sin filas nuevas; `parentId` de otro usuario y
      `parentId` inexistente → `404` con `code: 'PARENT_NOT_FOUND'`; padre a profundidad 9 → `409` con
      `code: 'DEPTH_LIMIT_EXCEEDED'`.
      **GREEN**: `WorkspaceModule`, `DirectoriesController` (con `JwtAuthGuard`, `@CurrentUser()` y
      `@Throttled('workspace')`), `DirectoriesService.createDirectory()`, `CreateDirectoryRequestDto` y
      `WorkspaceDirectoryResponseDto` construido explícitamente y con `@ApiProperty`. Nunca se devuelve la
      entidad Prisma.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-directories`

- [x] **T-006** · `backend` · `PATCH` y `DELETE` de directorio
      **AC**: AC-7, AC-11
      **Depende de**: T-005
      **RED**: ampliar `apps/api/test/workspace-directories.e2e-spec.ts` — rename → `200` con el nombre
      nuevo y `updatedAt` posterior; rename que choca con un hermano → `409` y el nombre en base **sin
      cambiar**; rename que solo cambia la caja del propio nombre → `200`; rename de un id ajeno →
      `404`; delete de un directorio vacío → `204` sin cuerpo y fila fuera; delete de uno con un
      subdirectorio dentro → `409` con `code: 'DIRECTORY_NOT_EMPTY'` y **nada** borrado; delete de uno con
      un documento dentro → el mismo `409`; `?recursive=true` → `204` y desaparecen el directorio, sus
      subdirectorios y sus documentos (se cuenta en base); `?recursive=yes` → `400`; `?recursive=false`
      sobre un directorio con hijos → `409`; delete de un id inexistente → `404`.
      **GREEN**: `RenameDirectoryRequestDto`, `DeleteDirectoryQueryDto` (transform que acepta solo
      `'true'`/`'false'`), `DirectoriesService.renameDirectory()` y `deleteDirectory()`; el borrado
      recursivo delega en la **cascada de PostgreSQL**, no recorre el árbol en la aplicación.
      `@ApiNoContentResponse` en el `DELETE`.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-directories`

- [x] **T-007** · `backend` · `POST /api/workspace/directories/:id/move`
      **AC**: AC-8, AC-9, AC-10
      **Depende de**: T-006
      **RED**: `apps/api/test/workspace-move.e2e-spec.ts` — mover a la raíz → `200` con `parentId: null` y
      `depth: 0`; mover a otro directorio propio → `200` con el `parentId` y el `depth` nuevos; mover a
      **sí mismo** → `409` `MOVE_INTO_DESCENDANT`; mover a un **descendiente** → `409` y ni el sujeto ni
      ningún descendiente cambia de `parentId` (se comprueba en base); mover al padre que ya tiene →
      `200` sin cambios; destino de otro usuario → `404` `PARENT_NOT_FOUND` y `parentId` intacto; destino
      inexistente → `404`; subárbol de altura 2 a un destino en profundidad 8 → `409`
      `DEPTH_LIMIT_EXCEEDED` y nada cambia; mover a un destino donde ya hay un hermano con ese nombre →
      `409` `DIRECTORY_NAME_TAKEN`.
      **GREEN**: `MoveDirectoryRequestDto` y `DirectoriesService.moveDirectory()` dentro de
      `$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })`: carga de los
      directorios del usuario (`select: { id, parentId }`), `assertMovable` de `tree-graph`, y `update`
      con `parentScopeId` recalculado.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-move`

## Bloque C — Documentos

- [x] **T-008** · `backend` · `POST /api/workspace/documents` y `GET /api/workspace/documents/:id`
      **AC**: AC-12, AC-13, AC-14, AC-15
      **Depende de**: T-005
      **RED**: `apps/api/test/workspace-documents.e2e-spec.ts` — alta con contenido → `201` con las claves
      exactas de `WorkspaceDocumentResponseDto`, `content` idéntico al enviado y `contentBytes` igual a
      `Buffer.byteLength(content, 'utf8')` (el caso usa un carácter multibyte, así que **no** coincide con
      la longitud en caracteres); alta sin `content` → `content: ''` y `contentBytes: 0`; alta dentro de
      un directorio propio → `201` con ese `directoryId`; `IDEAS` cuando ya existe `Ideas` en el mismo
      ámbito → `409` `DOCUMENT_TITLE_TAKEN`; el mismo título en otro directorio → `201`; un **documento**
      llamado igual que un **directorio** hermano → `201`; título vacío / 201 caracteres / con `\` /
      `directoryId` ausente → `400`; `directoryId` ajeno → `404` `PARENT_NOT_FOUND`; `content` de 200.001
      caracteres → `400`; `content` de **200.000** caracteres → `201` (este es el caso que falla con el
      límite de cuerpo por defecto de Express); `GET` del documento → `200` con `content`; `GET` de un
      documento ajeno → `404` `DOCUMENT_NOT_FOUND`.
      **GREEN**: `DocumentsController`, `DocumentsService.createDocument()` y `getDocument()`,
      `CreateDocumentRequestDto`, `WorkspaceDocumentSummaryResponseDto` y
      `WorkspaceDocumentResponseDto`; `contentBytes` calculado y persistido al escribir; y
      `app.useBodyParser('json', { limit: '2mb' })` en `configureApp` — **no** `app.use(json(...))`, que
      se registra después del body parser interno de Nest y no lo sustituye.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-documents` ·
      `pnpm --filter @one-markdown/api test:e2e auth-register` (regresión: el límite de cuerpo es global)

- [x] **T-009** · `backend` · `PATCH`, `DELETE` y `move` de documento
      **AC**: AC-16, AC-17, AC-18
      **Depende de**: T-008
      **RED**: (a) ampliar `apps/api/test/workspace-documents.e2e-spec.ts` — rename → `200` con
      `WorkspaceDocumentSummaryResponseDto` y **sin** `content` en el cuerpo, título cambiado en base;
      rename que choca → `409` y título intacto; delete → `204` y fila fuera; **segundo** delete del
      mismo id → `404`. (b) ampliar `apps/api/test/workspace-move.e2e-spec.ts` — mover documento a un
      directorio propio → `200` con el `directoryId` nuevo; a la raíz → `200` con `directoryId: null`; a
      un directorio **ajeno** → `404` y `directoryId` sin cambiar; a un directorio inexistente → `404`;
      a un destino donde ya hay un documento con ese título → `409`.
      **GREEN**: `RenameDocumentRequestDto`, `MoveDocumentRequestDto` y los tres métodos de
      `DocumentsService` (`renameDocument`, `deleteDocument`, `moveDocument`). El
      move de documento **no** necesita `Serializable`: un documento no tiene descendientes.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-documents` ·
      `pnpm --filter @one-markdown/api test:e2e workspace-move`

## Bloque D — Árbol y transversales

- [x] **T-010** · `backend` · `GET /api/workspace/tree`
      **AC**: AC-20
      **Depende de**: T-007, T-009
      **RED**: `apps/api/test/workspace-tree.e2e-spec.ts` — con dos usuarios que crean estructuras de
      nombres **idénticos**, cada `GET /tree` devuelve solo los nodos propios (los ids del otro no
      aparecen); el cuerpo tiene exactamente `directories`, `documents` y `generatedAt`; los dos arrays
      son planos y cada nodo trae su `parentId`/`directoryId`; el orden es determinista por `nameKey`
      (dos llamadas seguidas dan el mismo orden, y el orden no depende del orden de creación);
      **ningún** elemento de `documents` tiene la propiedad `content`; el `depth` de un nieto es `2`; y
      `generatedAt` parsea como fecha ISO.
      **GREEN**: `WorkspaceController` con `GET /tree`, `WorkspaceService.getTree()` (dos `findMany` con
      `select` explícito — el de documentos **sin** `content` — y `depth` calculado con `tree-graph`) y
      `WorkspaceTreeResponseDto`.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-tree`

- [x] **T-011** · `backend` · Tope de nodos por usuario
      **AC**: AC-21
      **Depende de**: T-010
      **RED**: (a) `apps/api/src/workspace/directories.service.spec.ts` y
      `apps/api/src/workspace/documents.service.spec.ts` — el tope afecta al alta de los **dos** tipos, así
      que cada servicio se prueba en su propio archivo: con un repositorio doblado que dice que el usuario
      tiene `MAX_WORKSPACE_NODES` nodos, `createDirectory` y `createDocument` lanzan con
      `code: 'WORKSPACE_LIMIT_REACHED'`; con uno menos, no lanzan. (b) ampliar
      `apps/api/test/workspace-tree.e2e-spec.ts` — el `409` llega al cliente con ese `code` y no se crea
      la fila (el caso e2e usa una constante inyectable o un espía del contador, **no** crea 5.000 nodos
      de verdad: un e2e que tarda minutos no se corre).
      **GREEN**: contador (`count` de directorios + documentos con `where: { userId }`) en el camino de
      alta de los dos tipos.
      **DONE**: `pnpm --filter @one-markdown/api test "directories.service|documents.service"` ·
      `pnpm --filter @one-markdown/api test:e2e workspace-tree`

- [x] **T-012** · `backend` · Matriz de propiedad y de credencial sobre los diez endpoints
      **AC**: AC-22, AC-23
      **Depende de**: T-010
      **RED**: `apps/api/test/workspace-ownership.e2e-spec.ts` — con dos usuarios (A con un directorio y
      un documento), una tabla con los **diez** endpoints: B invoca cada uno con los ids de A y
      **todas** las respuestas son `404`; **ninguna** es `403` (se comprueba explícitamente); tras la
      matriz completa, el estado de A es idéntico al inicial (nombres, `parentId`, `directoryId` y número
      de filas); un `:id` que no es uuid → `400` en los **siete** endpoints con parámetro de ruta
      (directorios: `PATCH`, `move`, `DELETE`; documentos: `GET`, `PATCH`, `move`, `DELETE` — corregido en
      la v0.2.2: decía «seis» y son siete, y el test lo ancla con
      `expect(PATH_PARAM_ENDPOINTS).toHaveLength(7)` para que la cifra no vuelva a ser un número escrito a
      mano); y la misma
      tabla **sin** cabecera `Authorization` → los diez responden `401`, y con un **refresh token** como
      `Bearer` → los diez responden `401`.
      **Cada `404` de la matriz se afirma también por su `code`** (`DIRECTORY_NOT_FOUND`,
      `PARENT_NOT_FOUND`, `DOCUMENT_NOT_FOUND`), no solo por el estado. Motivo, aprendido en el RED de
      `T-007`: **Nest ya devuelve `404` para una ruta que no existe**, así que un test que solo mira
      `expect(status).toBe(404)` pasa en verde contra un endpoint **sin implementar** y el RED sale falso
      (allí fueron `18 failed, 2 passed`, y los 2 «verdes» eran justamente los dos casos de `404`). En una
      tarea que es una matriz entera de `404` sobre diez endpoints, esa confusión no se detecta a ojo. La
      regla es la de siempre —el test debe fallar **por la razón correcta**—, aquí escrita como un
      requisito concreto del RED.
      **GREEN**: los ajustes que haga falta para que la matriz pase; si algún endpoint devuelve `403` o
      filtra sin `userId`, se corrige. La lista de endpoints vive en una constante del propio test, para
      que añadir un endpoint futuro y olvidar la matriz sea visible.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-ownership`

- [x] **T-013** · `backend` · Cascada del usuario y concurrencia
      **AC**: AC-19, AC-25
      **Depende de**: T-012
      **RED**: (a) `apps/api/test/workspace-cascade.e2e-spec.ts` — un usuario con directorios anidados y
      documentos dentro; al borrar **su** fila de `users`, quedan `0` directorios y `0` documentos suyos
      (se cuenta con Prisma). (b) `apps/api/test/workspace-concurrency.e2e-spec.ts` — dos `PATCH`
      simultáneos (`Promise.all`) que renombran dos directorios hermanos al **mismo** nombre: el conjunto
      de códigos es exactamente `{200, 409}` y en base hay una sola fila con ese `nameKey`; y mover un
      directorio a un destino que se ha borrado justo antes → `404`, con el sujeto conservando su
      `parentId` anterior (nunca uno inexistente).
      **GREEN**: lo que haga falta; el objetivo es demostrar que el índice único y la transacción hacen su
      trabajo sin código extra. Si el caso concurrente pasa por accidente (por ejemplo porque las dos
      peticiones se serializan solas), el agente lo dice en vez de dar el AC por bueno.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-cascade` ·
      `pnpm --filter @one-markdown/api test:e2e workspace-concurrency`

- [x] **T-014** · `backend` · Throttler `workspace` y cobertura de throttler en todos los controladores
      **AC**: AC-24
      **Depende de**: T-010
      **RED**: (a) `apps/api/test/workspace-throttle.e2e-spec.ts` — 15 `GET /api/workspace/tree`
      seguidos → los 15 `200` (con el límite de `login`, de 10/min, el 11.º habría fallado: es la prueba
      de que no se hereda); superado el límite de `workspace` → `429` con forma `ErrorResponseDto`; y los
      endpoints de auth siguen con **su** límite (el cupo de `workspace` no los afecta). (b)
      `apps/api/src/common/throttle-coverage.spec.ts` — recorriendo los archivos `*.controller.ts` de
      `src/**`, **todos** contienen `@Throttled(` o `SkipThrottling(`; el test falla si aparece un
      controlador nuevo sin declararlo.
      **GREEN**: `workspace` añadido a `THROTTLE_NAMES` y a `THROTTLE_LIMITS` (120 / 60 s) en
      `src/common/throttle.ts`, y `@Throttled('workspace')` en los tres controladores del módulo.
      **DONE**: `pnpm --filter @one-markdown/api test throttle-coverage` ·
      `pnpm --filter @one-markdown/api test:e2e workspace-throttle` ·
      `pnpm --filter @one-markdown/api test:e2e auth-throttle` (regresión: los throttlers de auth siguen
      igual) · `pnpm --filter @one-markdown/api test redis-throttler` (el quinto nombre no rompe el
      storage)

- [x] **T-015** · `backend` · Swagger de workspace
      **AC**: AC-26
      **Depende de**: T-011, T-014
      **RED**: ampliar `apps/api/test/swagger.e2e-spec.ts` — el documento contiene las **diez** rutas de
      `/api/workspace/*` con su método y su `operationId`; todas declaran `security` con `bearer`; todas
      documentan `401`, `404` y `429` apuntando a `ErrorResponseDto` — **el `404` de `GET /tree` queda
      revocado por la v0.2.2 y lo quita `T-025`**: esta tarea se implementó siguiendo AC-26 tal como
      estaba escrito, y fue al hacerlo cuando se vio que contradecía a `plan.md` §4; existen los schemas
      `WorkspaceTreeResponseDto`, `WorkspaceDirectoryResponseDto`,
      `WorkspaceDocumentSummaryResponseDto`, `WorkspaceDocumentResponseDto` y los siete DTO de entrada
      (la cifra no se escribe a mano: el test los deriva con `readdirSync` sobre `src/workspace/dto`, así
      que un octavo DTO sin documentar rompe la igualdad);
      **ningún** schema se llama como un modelo de Prisma (la lista sale del `schema.prisma` real, así que
      `Directory` y `Document` ya cuentan — verificar que el test los recoge de verdad, no que pase por
      vacío); y el documento serializado **no** contiene `nameKey`, `titleKey`, `parentScopeId` ni
      `userId`.
      **GREEN**: `@ApiTags('workspace')`, `@ApiBearerAuth('bearer')`, `@ApiProperty` en todos los DTO,
      respuestas de error declaradas y `@ApiQuery` del `recursive`.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e swagger`

- [x] **T-016** · `backend` · Contrato de workspace en `packages/shared`
      **AC**: AC-27 (habilita AC-28…AC-32)
      **Depende de**: T-010
      **RED**: ampliar `packages/shared/src/index.test.ts` — `isDirectoryNode`, `isDocumentSummary`,
      `isMarkdownDocument` e `isWorkspaceTree` aceptan las formas válidas y **rechazan**: `parentId` /
      `directoryId` **ausente** en vez de `null`, `depth` no numérico, `contentBytes` no numérico,
      `documents` que no es array, un elemento de `documents` inválido, y un `MarkdownDocument` sin
      `content`; `isApiErrorShape` acepta un error con `code` string y **rechaza** uno con `code`
      numérico, sin dejar de aceptar los errores **sin** `code`.
      **GREEN**: tipos `DirectoryNode`, `DocumentSummary`, `MarkdownDocument`, `WorkspaceTree` y sus
      guards (con el helper `isPresentAndNullOr` que ya existe), `code?: string` en `ApiErrorShape`, y los
      DTO del backend declarando `implements` contra ellos. Ningún tipo se llama `Document` ni `Directory`
      (riesgo #10).
      **DONE**: `pnpm --filter @one-markdown/shared test` · `pnpm typecheck` (los tres paquetes en 0,
      **borrando `packages/shared/dist` antes**)

- [x] **T-024** · `backend` · `AllExceptionsFilter` traduce el `PayloadTooLargeError` de body-parser
      **AC**: AC-33
      **Depende de**: T-008 (es la que introdujo `JSON_BODY_LIMIT`)
      **Numeración append-only**: pertenece al Bloque D y se ejecuta en la **ola 4**, pero lleva el número
      24 porque renumerar rompería las referencias de `IMPLEMENTATION.md` y de la tabla de trazabilidad.
      **RED**: (a) `apps/api/test/body-limit.e2e-spec.ts` — con sesión válida, un `POST
      /api/workspace/documents` cuyo cuerpo JSON supera `JSON_BODY_LIMIT` (2 MiB: basta un `content`
      sintético de ~3 MiB, **generado en el test**, nunca un fichero versionado) responde **`413`** con las
      cinco claves de `ErrorResponseDto` y `statusCode: 413`. Debe fallar con `expected 413, got 500`: ese
      es el estado real medido en `T-008`, así que el RED es una regresión reproducible, no una hipótesis.
      Añadir el caso simétrico: un cuerpo **por debajo** del límite sigue llegando al DTO y da `400` o
      `201` según el caso — el `413` no puede tragarse validaciones normales. (b) **ampliar**
      `apps/api/src/common/filters/all-exceptions.filter.spec.ts`, que **ya existe** desde `T-004` — su
      caso «un error que no es `HttpException` sigue saliendo como `500` sin `code`» usa un `new Error(...)`
      **sin `status`**, así que debe seguir en verde **sin tocarlo**: es la mitad negativa de esta tarea y
      cambiarlo sería exactamente lo que la regla de «no ajustar el test de otra spec» prohíbe.
      Casos nuevos: un error que no
      es `HttpException` **pero lleva un `status` entero en 400…499** sale con ese estado; un `Error`
      pelado **sigue saliendo `500`** con `message: 'Error interno del servidor'` y **sigue registrándose
      con `logger.error`**; y un error con `status: 502` o con `status: 'nope'` también sale `500` (solo se
      confía en un `4xx` entero: un `5xx` reportado por una librería no debe evitar el log, y un `status`
      de otro tipo solo puede venir de un error de programación).
      **GREEN**: en `AllExceptionsFilter`, antes de la rama genérica, un *type guard* que reconozca un
      error con `status`/`statusCode` entero en el rango `4xx` —la forma que emiten los errores de
      `http-errors`, que es de donde viene el `PayloadTooLargeError`— y lo emita con ese estado y su
      `message`. Sin `instanceof` contra ninguna clase de body-parser ni `import` de `http-errors`: es una
      dependencia transitiva de Express, no una dependencia declarada del proyecto, y la regla de cero
      dependencias nuevas (`plan.md` §1) sigue en pie.
      **Toca contrato de la spec `000`.** `all-exceptions.filter.ts` es suyo (AC-5). Reglas para esta
      tarea, las mismas que se le pusieron a `T-004`: si **cualquier** test de `000` o `001` se pone en
      rojo, se **para y se reporta** en vez de ajustarlo; y el cierre deja entrada en
      `specs/000-foundation/CHANGELOG.md` además de en el de `002`.
      **DONE**: `pnpm --filter @one-markdown/api test all-exceptions` ·
      `pnpm --filter @one-markdown/api test:e2e body-limit` ·
      `pnpm --filter @one-markdown/api test:e2e validation` (regresión: AC-5 de la spec `000`) ·
      `pnpm --filter @one-markdown/api test:e2e` (regresión completa) · `pnpm typecheck` · `pnpm lint`

## Bloque E — Frontend

- [x] **T-017** · `frontend` · Cliente HTTP: `PATCH`, `DELETE`, `204` y funciones de workspace
      **AC**: — (habilita AC-28…AC-32)
      **Depende de**: T-016
      **RED**: ampliar `apps/web/src/shared/api/http.test.ts` (con `fetch` mockeado) — una llamada
      `PATCH` manda el método y el `Content-Type` correctos; una llamada `DELETE` sin cuerpo **no** manda
      `Content-Type`; un `204` resuelve sin error y **sin** intentar parsear JSON (hoy acabaría en «la
      respuesta no cumple el contrato»); un `409` con `code` propaga un `ApiError` que conserva el `code`;
      `getWorkspaceTree` valida la respuesta con el guard y rechaza una forma inválida; todas las
      llamadas de workspace mandan `Authorization: Bearer` y `credentials: 'include'`; y un `401` sigue
      disparando **un** refresh y **un** reintento.
      **GREEN**: `JsonRequest['method']` ampliado, camino para respuestas sin cuerpo, `code` en
      `ApiError`, y las diez funciones tipadas con `@one-markdown/shared`. Cero `any`.
      **DONE**: `pnpm --filter @one-markdown/web test http`

- [x] **T-018** · `frontend` · `useWorkspaceStore`
      **AC**: — (habilita AC-28…AC-31)
      **Depende de**: T-017
      **RED**: `apps/web/src/features/workspace/workspace.store.test.ts` — arranca en `'idle'`;
      `loadTree()` pasa a `'loading'` y luego a `'ready'` con los mapas normalizados por `id` y las listas
      de hijos por padre (con `'root'` para la raíz) en el orden que devolvió el servidor; cada mutación
      llama a su endpoint **y** recarga el árbol (se cuentan las llamadas); un `ApiError` de `409` deja
      `error` con el mensaje y **no** modifica los mapas; un `404` deja el error **y** recarga el árbol;
      `toggleExpanded` y `select` no llaman a la red; y `localStorage`/`sessionStorage` siguen vacíos al
      final de cada caso.
      **GREEN**: `workspace.store.ts` según `plan.md` §7, sin middleware de persistencia.
      **DONE**: `pnpm --filter @one-markdown/web test workspace.store`

- [x] **T-019** · `frontend` · Árbol accesible en la barra lateral
      **AC**: AC-28
      **Depende de**: T-018
      **RED**: `apps/web/src/features/workspace/WorkspaceTreeView.test.tsx` — con un árbol de prueba, hay
      un `role="tree"` con nombre accesible; los nodos son `role="treeitem"` con `aria-level` correcto por
      profundidad; los directorios llevan `aria-expanded` y los documentos **no**; solo **un** nodo tiene
      `tabindex="0"` y el resto `-1`; `ArrowDown`/`ArrowUp` mueven el foco entre nodos **visibles** (un
      hijo de un directorio contraído no recibe foco); `ArrowRight` expande un directorio contraído y, si
      ya está expandido, baja al primer hijo; `ArrowLeft` lo contrae y, si ya está contraído, sube al
      padre; `Home`/`End` van al primero y al último; el nodo seleccionado tiene `aria-selected="true"`.
      **GREEN**: `WorkspaceTreeView` y `TreeNodeRow`, montados en el `#document-tree` del `AppShell` en
      lugar del texto placeholder. `WorkspaceEmptyState` pasa a decir «selecciona un documento».
      **DONE**: `pnpm --filter @one-markdown/web test WorkspaceTreeView`
      **NOTA**: el test actual de `AppShell` comprueba el texto placeholder de la barra lateral: hay que
      actualizarlo en la misma tarea y decirlo en el reporte.

- [x] **T-020** · `frontend` · Crear, renombrar y borrar desde la UI
      **AC**: AC-29
      **Depende de**: T-019
      **RED**: ampliar `apps/web/src/features/workspace/WorkspaceTreeView.test.tsx` — el formulario de
      alta crea un directorio en el padre elegido y el nodo aparece tras la recarga; el alta de documento
      hace lo propio; renombrar abre un diálogo con el nombre actual precargado y `<label>` asociado;
      un `409` del servidor se muestra en un contenedor `role="alert"` que **recibe el foco** y el árbol
      **no** cambia; borrar un nodo vacío pide confirmación y al aceptar desaparece; borrar un directorio
      **con hijos** muestra una confirmación que dice que se borrará su contenido y solo entonces se
      envía `recursive=true` (se comprueba el argumento de la llamada); cancelar no llama a la red; los
      botones quedan deshabilitados mientras la petición está en vuelo.
      **GREEN**: `CreateNodeForm`, `RenameNodeDialog`, `ConfirmDeleteDialog` y su integración en
      `TreeNodeRow`. Cada diálogo con `role="dialog"`, `aria-modal`, foco atrapado y devuelto al cerrar.
      **DONE**: `pnpm --filter @one-markdown/web test WorkspaceTreeView`

- [x] **T-021** · `frontend` · Mover desde la UI
      **AC**: AC-30
      **Depende de**: T-020
      **RED**: `apps/web/src/features/workspace/MoveNodeDialog.test.tsx` — al mover un directorio con
      descendientes, el selector de destino ofrece «Raíz» y los directorios válidos, y **no** ofrece ni el
      propio directorio ni ninguno de sus descendientes; al mover un documento, ofrece todos los
      directorios y la raíz; elegir un destino llama a la acción del store con el `id` correcto (o `null`
      para la raíz); un `409` `MOVE_INTO_DESCENDANT` o un `404` del servidor se muestran en el `role=
      "alert"` y el árbol se recarga.
      **GREEN**: `MoveNodeDialog`, con el filtrado del subárbol calculado en el cliente a partir del store
      (misma regla que el servidor; el servidor sigue siendo la autoridad).
      **DONE**: `pnpm --filter @one-markdown/web test MoveNodeDialog`

- [x] **T-022** · `frontend` · Ruta `/documents/:id` con vista en crudo
      **AC**: AC-31
      **Depende de**: T-019
      **RED**: `apps/web/src/features/workspace/DocumentViewPage.test.tsx` — al activar un documento del
      árbol (clic y `Enter`) la ruta pasa a `/documents/:id`; la vista pide el detalle, muestra el título
      en un encabezado, la ruta dentro del árbol y el markdown **en crudo** dentro de un `<pre>` (el
      contenido con `# Título` aparece **literal**, no como encabezado HTML); mientras carga hay estado de
      carga; un `404` muestra «este documento ya no existe» y dispara una recarga del árbol.
      **GREEN**: `DocumentViewPage` y la ruta hija del `AppShell` en `routes.tsx`.
      **DONE**: `pnpm --filter @one-markdown/web test DocumentViewPage` ·
      `pnpm --filter @one-markdown/web test routes`

- [x] **T-023** · `frontend` · e2e del árbol en navegador
      **AC**: AC-32
      **Depende de**: T-013, T-021, T-022
      **RED**: `apps/web/e2e/workspace.spec.ts` — registra un usuario con correo único, crea un
      directorio, crea un subdirectorio dentro, crea un documento en el subdirectorio, lo renombra, lo
      mueve a la raíz, lo abre y comprueba su contenido, y por último borra el directorio con la
      confirmación recursiva; al final el árbol solo tiene el documento movido; **cero errores de
      consola** en todo el recorrido. Debe fallar antes de que exista la UI.
      **«Comprueba su contenido» no es texto** (precisado en la v0.3.0, y así se implementó): un documento
      creado desde la interfaz nace **vacío** —el store manda solo `title`/`directoryId` y el `PATCH` solo
      acepta `title`; el editor es la spec `003`—. Lo que se comprueba es la URL `/documents/:uuid`, el
      `aria-selected` de su fila, el `h2` con el título, el breadcrumb **de un solo paso** (la prueba de
      que la mudanza a la raíz llegó al servidor) y la región `Markdown en crudo` **visible y vacía**.
      El árbol vacío del arranque se afirma con `toBeAttached()`, no con `toBeVisible()`: sin filas no
      ocupa un píxel y el navegador lo da por oculto. Ver AC-32, que la v0.3.0 corrigió por decir «el árbol
      queda vacío» cuando este recorrido no puede dejarlo vacío.
      **DONE**: `pnpm test:e2e` (el smoke y el e2e de auth siguen verdes)

- [x] **T-025** · `backend` · `GET /api/workspace/tree` deja de declarar un `404` que no puede emitir
      **AC**: AC-26 (acotado en la v0.2.2)
      **Depende de**: T-015 (es la que dejó la declaración puesta)
      **Numeración append-only**, igual que `T-024`: pertenece al Bloque D, pero renumerar rompería las
      referencias ya escritas en `IMPLEMENTATION.md` y en la tabla de trazabilidad.
      **Por qué existe**: `T-015` implementó AC-26 tal como estaba escrito —`401`, `404` y `429` en las
      **diez** rutas— y al hacerlo destapó que `plan.md` §4 nunca listó `404` para `/tree`. La v0.2.2
      resuelve la contradicción a favor de `plan.md`; esta tarea es la mitad de código de esa decisión.
      El agente de `T-015` hizo lo correcto al no callar la discrepancia: declaró el `404` con una
      descripción que dice que la ruta no lo emite, en vez de meter una mentira muda en el contrato
      público. La descripción, sin embargo, no es legible por máquina — un cliente generado sigue viendo
      una rama de error que nunca ocurre.
      **RED**: en `apps/api/test/swagger.e2e-spec.ts`, separar la aserción de `404` de la de `401`/`429`:
      · `401` y `429` siguen exigiéndose sobre las **diez** rutas de `WORKSPACE_ROUTES`;
      · `404` se exige sobre las **nueve** que resuelven un id de recurso, o sea **todas las del tag menos
        `GET /tree`**, derivadas de la constante existente por **complemento de `/tree`** y **no** con una
        segunda lista escrita a mano, que se desincronizaría. **El criterio no es «lleva `{id}` en la
        plantilla de ruta»: eso da siete, no nueve.** Las otras dos son los `POST` de creación
        (`/directories` y `/documents`), que reciben el id del padre **en el cuerpo** (`parentId` /
        `directoryId`) y emiten `404 PARENT_NOT_FOUND` — `plan.md` §4 lo lista en sus dos líneas de
        errores. `/tree` es la única ruta del tag que no resuelve ningún id, ni por ruta ni por cuerpo, así
        que el complemento es exactamente ella;
      · las **dos** listas van ancladas —`toHaveLength(9)` y `toHaveLength(1)`— y el único elemento del
        complemento se afirma por igualdad contra `/api/workspace/tree`. Sin las dos cuentas, un filtro que
        se quedara vacío dejaría un `it.each` recorriendo cero casos y pasando por vacuidad;
      · caso nuevo **en negativo**: `document.paths['/api/workspace/tree'].get.responses` **no** tiene la
        clave `'404'`. Es el que debe fallar primero (hoy la tiene), y es el que impide que la
        declaración vuelva a colarse por «uniformidad del tag». El caso afirma **antes** que la operación
        existe, que su `operationId` es `getWorkspaceTree` y que declara `200`/`401`/`429`: «no tiene la
        clave `404`» es cierto por vacuidad sobre un objeto ausente, y sin esas tres afirmaciones previas
        el test seguiría verde con la ruta borrada.
      El primer rojo esperado es exactamente uno: el caso negativo. Si además cae algún otro, se para y
      se reporta antes de tocar nada.
      **GREEN**: quitar `@ApiNotFoundResponse` (y su `import`, si queda sin uso) de
      `apps/api/src/workspace/workspace.controller.ts`, sustituyendo el comentario actual por la razón
      inversa: esta ruta no resuelve `:id`, así que no documenta `404`; ver `plan.md` §4. **No se toca
      ningún otro controlador**: los otros nueve endpoints sí lo emiten y lo siguen documentando.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e swagger` (las 2 suites en verde; hoy son 105
      casos, así que la cifra baja o sube según cómo quede el `it.each`, y lo que importa es que ninguna
      quede en rojo) · `pnpm --filter @one-markdown/api test:e2e` completo, porque la tarea toca un
      controlador y el contrato es transversal

## Bloque F — Endurecimiento del entorno (v0.3.0, después de cerrar los 33 AC)

Los dos salen de **ejecutar AC-32 en un navegador real**. No los podía ver JSDOM: el primero necesita el
servidor de desarrollo de verdad y el segundo necesita el rate limit de verdad. Ninguno cambia un endpoint,
un DTO ni una respuesta HTTP. **Los dos tocan andamiaje de otra spec** (riesgo #16), así que heredan la
regla de `T-004` y `T-024`: si un test de `000` o de `001` se pone en rojo, **se para y se reporta**.

**Las dos cerradas y verificadas el 2026-07-25 (v0.3.1).** Con ellas la spec queda en **35/35 AC ·
27/27 tareas**. Cada una lleva escrito abajo, bajo «CERRADA», el RED real medido y el `DONE` corrido — y
las **dos desviaciones que corrigen la decisión del orchestrator**, no la del agente: el reset de AC-35
necesitaba también `throttle:login:*`, y `global-setup.ts` tenía que entrar en la lista de archivos de
`T-027`.

- [x] **T-026** · `frontend` · La caché de `optimizeDeps` deja de servir un `@one-markdown/shared` rancio
      **AC**: AC-34
      **Depende de**: T-023 (es la que descubrió el defecto y la que instala el `--force` que hay que
      poder retirar)
      **Por qué existe, con el mecanismo exacto** —importa porque la explicación aproximada lleva a la
      solución equivocada—: Vite invalida `node_modules/.vite` comparando dos hashes,
      `lockfileHash` y `configHash` (`optimizer/index.ts`, `loadCachedDepOptimizationMetadata`;
      verificado con `context7` el 2026-07-25). El **contenido** de un paquete enlazado del workspace no
      entra en ninguno de los dos, y la propia documentación de Vite lo dice en
      `guide/troubleshooting.md`: *«Vite detects dependency overrides but not `npm link` usage… force
      re-optimization with `vite --force`»*. O sea que **no** es que Vite hashee el `package.json` del
      paquete enlazado: es que no mira el paquete en absoluto. Al añadir la spec `002` sus tipos y guards,
      la caché de la spec `001` seguía siendo «válida» y el navegador recibía un módulo **sin**
      `isWorkspaceTree`: el árbol moría con «Ocurrió un error inesperado» tras un `GET /tree` que había
      devuelto `200`, porque `expectShape` reventaba con `TypeError: guard is not a function`.
      **Decisión de fondo, ya tomada — no la vuelvas a abrir**: se fuerza la reoptimización en
      `apps/web/vite.config.ts` (`optimizeDeps: { include: [...], force: true }`). Las otras dos opciones
      se descartan **con motivo escrito**:
      · *Publicar `shared` en ESM* es el arreglo de raíz —sin CJS no haría falta pre-empaquetarlo, se
        serviría por el grafo de módulos y no habría caché que envejecer— pero `apps/api` es NestJS
        **CommonJS** y consume el mismo `dist`: exige salida dual o mover el backend a ESM. Es trabajo de
        empaquetado de los tres paquetes y pertenece a una spec propia, no a un cierre de fase. Queda
        registrado como la salida futura: cuando se haga, `optimizeDeps.include` y este `force` se van
        juntos.
      · *Documentarlo como paso manual* se descarta porque el defecto se presenta como «el árbol está
        roto» con un mensaje que apunta al servidor (riesgo #15), y un paso manual solo lo conoce quien ya
        lo sufrió.
      El coste asumido es explícito: `force: true` re-empaqueta **todas** las dependencias en cada arranque
      del servidor de desarrollo, no solo `shared`. A este tamaño son un par de segundos, y se prefiere un
      arranque algo más lento a un árbol roto en silencio.
      **RED — tiene que ser de comportamiento, no de configuración.** Un test que lea `vite.config.ts` y
      afirme que dice `force: true` es una tautología: comprueba que el archivo dice lo que dice y pasaría
      igual con la caché rota. El rojo válido es **envenenar la caché y ver fallar la aplicación**:
      (a) devolver `playwright.config.ts` a `command: 'pnpm dev'` **sin** `--force`; (b) sembrar
      `apps/web/node_modules/.vite/deps/` con una versión de `@one-markdown_shared.js` **sin**
      `isWorkspaceTree` y sin tocar el `_metadata.json`, que es lo que hace que Vite la dé por buena
      (reproducir el estado real: `grep -c isWorkspaceTree` sobre el archivo servido → `0`);
      (c) `pnpm test:e2e`. El fallo esperado es el medido: el árbol muestra «Ocurrió un error inesperado»
      con el `GET /tree` en `200`. **Si el rojo no es ése, para y reporta**: significa que la caché no se
      envenenó como se creía y el test no discrimina.
      **GREEN**: `force: true` en `optimizeDeps` de `apps/web/vite.config.ts`, con el comentario existente
      ampliado con el mecanismo real (los dos hashes) y con la salida ESM apuntada, para que quien lo lea
      no lo quite por parecer redundante. `playwright.config.ts` se queda **sin** `--force`: la suite deja
      de compensar el defecto, que es la mitad del valor de la tarea.
      **DONE**: con la caché envenenada, `pnpm test:e2e` → los 5 casos en verde ·
      `pnpm --filter @one-markdown/web test` sin cambios (12 archivos / 188) · `typecheck` y `lint` en 0.
      **ARCHIVOS DE ESTA TAREA**: `apps/web/vite.config.ts` y `apps/web/playwright.config.ts`. Nada más.
      `vite.config.ts` es de la spec `000`: si algún test de `000` cae, se para y se reporta, y el cierre
      deja entrada en `specs/000-foundation/CHANGELOG.md` igual que la dejó `T-024`.

      **CERRADA — 2026-07-25.** El RED salió **de comportamiento y medido**, exactamente como lo pedía el
      enunciado: con el `--force` retirado de `playwright.config.ts` y `@one-markdown_shared.js` sembrado
      sin `isWorkspaceTree` (`grep -c` → `0`) **sin tocar `_metadata.json`**, `pnpm test:e2e` →
      `1 failed / 4 passed`, y el fallo fue **el correcto**: snapshot con
      `alert: Ocurrió un error inesperado…` **y** traza de red del mismo caso con
      `/api/workspace/tree | 200`. El servidor respondía bien; quien fallaba era el bundle rancio.
      **La demostración en tres pasos, que es lo que da valor al check-off.** Ese rojo, solo, deja viva una
      explicación alternativa: que lo que salva la caché después no sea el `force` sino el `configHash`
      **nuevo** que introduce el propio cambio de `vite.config.ts` — un `configHash` distinto invalida la
      caché por su cuenta, y entonces el `force` sería decorativo. Se descartó envenenando **contra ese
      mismo `configHash`**:
      1. `pnpm test:e2e` ya con `force: true` → **5 passed**. La caché queda reconstruida **con el
         `configHash` nuevo**.
      2. Se envenena **esa** caché: `grep -c isWorkspaceTree` pasa de **2** a **0**, y `node --check`
         confirma que el fichero envenenado **sigue siendo JavaScript válido** — o sea que el guard llega
         `undefined` y no hay un error de parseo que enmascare el resultado por otro camino.
      3. `pnpm test:e2e` → **5 passed**.
      Con los dos hashes casando, lo único que puede salvar esa caché es `force`. Sin el paso 3 el
      check-off habría sido decorativo.
      **DONE corrido**: `pnpm test:e2e` → **5 passed** · `pnpm --filter @one-markdown/web test` →
      12 archivos / **188**, sin cambios · `typecheck` y `lint` EXIT=0 · `prettier --check` limpio.
      **Se respetó la lista de archivos**: solo `apps/web/vite.config.ts` y `apps/web/playwright.config.ts`.
      Ningún test de `000` cayó. El cierre deja entrada en `specs/000-foundation/CHANGELOG.md` **v0.1.7**.
      **Lo que NO queda automatizado, y va también en AC-34 y en §6 de `spec.md`**: el envenenado es
      manual y **CI no lo cazará nunca** —el runner arranca siempre con `node_modules/.vite` frío, así que
      allí `force: true` y su ausencia son indistinguibles—. Lo que queda vigilando es la retirada del
      `--force`: si alguien quita el `force` de `vite.config.ts`, `pnpm test:e2e` se rompe **en local**
      para cualquiera con caché previa, y en CI no. El defecto vive en la máquina de quien desarrolla, que
      es justo donde CI no mira.

- [x] **T-027** · `frontend` · El presupuesto de altas de la suite e2e deja de agotarse al milímetro
      **AC**: AC-35
      **Depende de**: T-023 (es la que gasta la quinta alta)
      **La cuenta de hoy, que es la que hace la tarea urgente**: `register` permite **5 por IP cada 15
      min** (`THROTTLE_LIMITS`, spec `001`) y una ejecución limpia gasta **exactamente 5** — `smoke` **3**
      (su `beforeEach` llama a `signIn`, que hace `POST /register` en **cada** caso aunque le devuelvan
      `409`), `auth` **1** y `workspace` **1**. Con `retries: 2` en CI, **el primer reintento pide la
      sexta y recibe un `429`**.
      **Decisión de fondo, ya tomada**: se aplican **las dos** medidas, porque la barata sola no basta.
      · *Barata*: `signIn` intenta `POST /login` **antes** de registrar y solo cae al `register` si el
        login falla por credenciales. Baja el gasto de 5 a 3 en una base caliente y a 3 en una fría
        (una sola alta de la cuenta compartida). **Pero no cierra AC-35**: con `retries: 2`, los dos casos
        que estrenan cuenta (`auth` y `workspace`) piden alta nueva en **cada** intento — 1+2 y 1+2 son
        6 altas, otra vez por encima de 5. Esto está calculado, no supuesto: si al implementarlo la cuenta
        sale distinta, **reporta la cuenta real antes de seguir**.
      · *La que de verdad lo cierra*: poner a cero los contadores **`throttle:register:*` y
        `throttle:login:*`** —**los dos**, ver la corrección de abajo— **antes de cada caso** que los
        gaste, con el mismo camino de Redis que ya usa `global-setup`: `support/services.ts` habla RESP
        por TCP y **no** añade ninguna dependencia (`plan.md` §1 sigue intacto). Un reintento arranca
        entonces con el cupo limpio, y el número de reintentos deja de importar.
      **CORRECCIÓN DEL ENUNCIADO (v0.3.1), y es de la decisión del orchestrator, no del agente**: este
      texto decía «el contador `throttle:register:*`» y con eso **el AC no se cierra**. El cupo de `login`
      (10 por IP y minuto) también se agota en el escenario del AC: smoke 3 casos × 3 intentos = **9**
      entradas, más el flujo de auth que vuelve a entrar en cada intento (**3**) → **12 contra 10**. Ese
      gasto **ya existía** antes del cambio —el `signIn` viejo también hacía `login` tras el `409`—; lo
      tapaba el `429` de `register`, que llegaba primero. Medido: con el reset aplicado solo a `register`,
      el `DONE` seguía rojo con `POST /api/auth/login devolvió 429`.
      **Lo que esto NO debe erosionar, y por qué se acepta igualmente**: la suite de navegador pasa a
      neutralizar a propósito los límites de **registro y de entrada**, así que **deja de poder
      detectarlos**. No se pierde cobertura: quien los verifica es
      `apps/api/test/auth-throttle.e2e-spec.ts` (AC-20 de la spec `001`), con **un caso por cada uno**, y
      el bloqueo por cuenta lo verifica `apps/api/test/auth-login.e2e-spec.ts`. Es su sitio — un límite por
      IP se prueba contra el API, no a través de un navegador. La tarea debe **escribir ese razonamiento en
      el propio archivo**, porque el atajo obvio de mañana es aplicar el reset también en la suite del API,
      y ahí sí destruiría la prueba.
      **RED**: `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` **hoy**
      falla con un `429` en `POST /api/auth/register` (3 repeticiones × las 2 cuentas nuevas = 6 altas
      contra un cupo de 5). Ése es el rojo, y hay que verlo **antes** de tocar nada; la salida real del
      `429` va en el reporte.
      **GREEN**: las dos medidas en `apps/web/e2e/support/session.ts` y `apps/web/e2e/support/services.ts`
      (más el `beforeEach` donde corresponda), sin tocar `THROTTLE_LIMITS` ni ningún límite de producción:
      son decisión de seguridad de la spec `001` y no se relajan para que pase una suite.
      **DONE**: `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` → todo
      en verde · `pnpm test:e2e` normal → 5 en verde · `pnpm --filter @one-markdown/api test:e2e` →
      20 suites / 455, para probar que el rate limit de `001` **sigue** verificándose donde toca.
      **ARCHIVOS DE ESTA TAREA**: `apps/web/e2e/support/session.ts`, `apps/web/e2e/support/services.ts`,
      **`apps/web/e2e/global-setup.ts`** y los `*.spec.ts` de `apps/web/e2e/` que necesiten el gancho. Son
      andamiaje de la spec `001`: mismas reglas que `T-026`, y el cierre deja entrada en
      `specs/001-auth/CHANGELOG.md`.
      **`global-setup.ts` no estaba en esta lista y tenía que estar (v0.3.1)**, y el motivo es un efecto de
      segundo orden que la decisión «login antes de registrar» arrastraba y que la cuenta no contemplaba:
      si cada caso prepara la cuenta compartida por su lado, en una base limpia **todos** los trabajadores
      empiezan con un `login` fallido contra una cuenta que aún no existe, y **5 fallos bloquean la cuenta
      15 minutos** (`LoginAttemptService`, spec `001`). Ese bloqueo es **por cuenta, no por IP**, así que
      ningún reset de `throttle:*` lo evita; en local Playwright levanta **6** trabajadores y era una moneda
      al aire. Crear la cuenta **una sola vez, antes de que arranque ningún caso**, lo elimina **por
      construcción** y de paso baja el gasto del smoke de **3 altas a 0**. Verificado en el bundle de
      Playwright 1.62 (`runner/index.js`, `createGlobalSetupTasks`) que los plugins de `webServer` corren
      **antes** de `globalSetup`, así que el API ya responde cuando se prepara la cuenta; `signIn` conserva
      un camino de reserva por si acaso.

      **CERRADA — 2026-07-25.** RED **real y previo a tocar nada**:
      `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` →
      `10 failed / 5 passed`, con `POST /api/auth/register devolvió 429`. Es exactamente el rojo escrito
      por adelantado.
      **DONE corrido, los tres comandos**: el mismo `--retries=2 --repeat-each=3` → **15 passed**, EXIT=0 ·
      `pnpm test:e2e` → **5 passed** · `pnpm --filter @one-markdown/api test:e2e` → 20 suites / **455**, o
      sea que el rate limit de `001` **sigue** verificándose donde le toca.
      **Verificado en el código por el orchestrator**: `support/services.ts` exporta
      `resetRegisterThrottleCounter` y `resetLoginThrottleCounter` sobre un `resetThrottleCounter` acotado
      a `'register' | 'login'` (los contadores de `mfa`, `refresh` y `workspace` quedan intactos y la suite
      los sigue gastando de verdad) · `global-setup.ts` llama a `ensureSharedAccount()` después de
      `resetDevServices()` · **`grep -rn "throttle:" apps/api/test/` no devuelve nada: no se aplicó ningún
      reset en la suite del API**, y la prohibición de llevarlo allí está escrita junto a la función que lo
      hace, en `support/services.ts`.
      Entrada de cierre en `specs/001-auth/CHANGELOG.md` **v0.1.1**.

## Definition of Done (todas las tareas)

1. El test se escribió primero y falló primero (reportado por el agente con la salida real del fallo).
   Las tareas `setup` no aplican esta regla pero sí el comando `DONE` con salida real.
2. Cada AC de la spec tiene al menos un test automatizado (ver tabla de trazabilidad en `spec.md` §6).
3. Backend: entrada y salida con DTO validado y documentado en Swagger; sin entidades Prisma crudas; sin
   `any`. Ningún DTO expone `userId`, `nameKey`, `titleKey` ni `parentScopeId`.
4. Autorización por recurso: **toda** consulta lleva `userId` del token en el `where`, y el `userId` nunca
   llega como parámetro del cliente. Un recurso ajeno responde `404`, nunca `403`.
5. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan, y los comandos `DONE` se corren también **desde
   estado limpio** (borrando `packages/shared/dist`): la lección de `000` v0.1.2 es que un `dist/`
   heredado convierte un fallo real en falso verde.
6. `IMPLEMENTATION.md` actualizado por el orchestrator con el comando de verificación y su resultado.
