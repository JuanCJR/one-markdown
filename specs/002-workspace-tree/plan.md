# Plan 002 — Workspace tree: directorios, subdirectorios y documentos markdown

Spec de referencia: `spec.md` v0.2.2

## 1. Dependencias y verificaciones previas

**Esta spec no añade ninguna dependencia**, ni en `apps/api`, ni en `apps/web`, ni en
`packages/shared`. Todo lo que necesita está instalado: Prisma 7.9.0 para el modelo y las migraciones,
`class-validator` 0.15.1 y `class-transformer` 0.5.1 para los DTO, `@nestjs/swagger` 11.4.6 para el
contrato, `@nestjs/throttler` 6.5.0 para el límite propio, y en la web React 19 + Zustand + React Router
+ Vitest + Playwright. No hace falta ninguna librería de árboles: el grafo se resuelve con dos funciones
puras de ~20 líneas cada una, que además son mucho más testeables que una dependencia.

Los agentes de implementación **no instalan nada**. Si alguna tarea parece necesitar un paquete nuevo,
para y reporta al orchestrator: se fija la versión contra npm y se verifica su API con `context7` antes de
escribirla aquí, como se hizo en `001` con `otplib` (donde ese paso evitó implementar contra una API que
había cambiado de major).

Verificaciones hechas con `context7` el **2026-07-25** (documentación de Prisma), porque de ellas dependen
tres decisiones del esquema:

| Qué se verificó | Resultado | Dónde se usa |
|---|---|---|
| Semántica de `NULL` en un `@@unique` | Los conectores tratan los `NULL` como **distintos**: «All fields included in a `@@unique` constraint must be mandatory because database connectors consider `null` values to be distinct». Un `@@unique([userId, parentId, nameKey])` **no** impide dos raíces con el mismo nombre | Decisión 3 → columna `parentScopeId` no nula |
| Índices parciales (`where` en `@@unique`) | Existen en el lenguaje del esquema, pero como *preview feature* (`partialIndexes`); un `db pull` los representa con `where: raw(...)` | Alternativa descartada en la decisión 3 |
| Índices por expresión (`lower(name)`) | No hay soporte declarativo | Alternativa descartada en la decisión 3 → columnas `nameKey`/`titleKey` |
| Nivel de aislamiento en transacciones interactivas | `prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait, timeout })`; un fallo de serialización sale como **`P2034`** y el reintento es responsabilidad de la aplicación | Decisión 7 (move) |
| Códigos de error de Prisma | `P2002` violación de unicidad, `P2003` violación de clave ajena, `P2025` registro no encontrado, `P2034` conflicto de escritura/deadlock. Se capturan con `e instanceof Prisma.PrismaClientKnownRequestError` | Decisión 8 (traducción a HTTP) |
| **Forma real del `meta` de un `P2002` en este stack** (corregido el 2026-07-25 con la implementación de `T-004`) | La documentación clásica describe `meta.target` con los campos de la restricción, pero **con Prisma 7.9 + `@prisma/adapter-pg` ese campo no llega**. Verificado empíricamente contra la base real: lo que emite el cliente es `meta.modelName` (p. ej. `'Directory'`) más `meta.driverAdapterError.cause`, con `originalCode: '23505'`, `originalMessage` y `constraint.fields` / `constraint.index` (el nombre del índice, p. ej. `directories_parentScopeId_nameKey_key`) | Decisión 8 (traducción a HTTP) |

Comprobado además contra el código instalado, no solo contra la documentación:

- `Prisma.TransactionIsolationLevel` y `Prisma.PrismaClientKnownRequestError` **existen** en el cliente
  generado del proyecto (`apps/api/src/generated/prisma/internal/prismaNamespace.ts`) y se importan como
  `import { Prisma } from '../generated/prisma/client'`.
- `app.useBodyParser('json', { limit })` **existe** en `@nestjs/platform-express` 11.1.28
  (`nest-express-application.interface.d.ts`). Es la única vía correcta para subir el límite: un
  `app.use(json({ limit }))` se registra **después** del body parser interno de Nest, que ya habría
  rechazado el cuerpo.
  **Precisión medida el 2026-07-25 al implementar `T-008`, porque aquí decía «rechazado con `413`» y no
  era lo que salía por el cable**: el `PayloadTooLargeError` de body-parser **no es una `HttpException`**,
  así que `AllExceptionsFilter` caía a su rama genérica y respondía **`500`**, aunque el error llevara
  `status: 413`. El rechazo ocurría, pero el código que veía el cliente era el equivocado. **Corregido
  por `T-024` / AC-33** (v0.2.1); la regla de detección está en §4, `POST /api/workspace/documents`.
- El test de OpenAPI de `T-018` de la spec `001` lee los nombres de los modelos del `schema.prisma` real
  con la regex `/^model\s+(\w+)\s*\{/gm`: **`Directory` y `Document` entran solos en esa red** en cuanto
  se añaden al esquema. Ningún DTO puede llamarse así, y por eso todos los de esta spec llevan el prefijo
  `Workspace`.

## 2. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|----------|--------------------------|--------|
| 1 | **Dos tablas, `directories` y `documents`**, con `parentId`/`directoryId` nulos para la raíz | Una única tabla polimórfica `workspace_nodes` con un discriminador `kind`; una tabla `nodes` para la jerarquía más una `documents` para el contenido | Un documento y un directorio no comparten ni un solo atributo relevante (`content`, `contentBytes` no tienen sentido en un directorio) y la tabla única los volvería nulos y opcionales, que es como se pierde el tipado estricto. El esquema actual ya anuncia estos dos modelos (`schema.prisma`, comentario de cabecera). Coste asumido: la unicidad de nombres no puede ser transversal a los dos tipos (decisión 5) |
| 2 | **La jerarquía se modela con `parentId` autorreferencial y nada más**: ni `path` materializado, ni `depth` persistido, ni `ltree` | Ruta materializada (`/uuid/uuid/`) con índice `LIKE`; columna `depth` mantenida a mano; extensión `ltree` de PostgreSQL | Una ruta materializada obliga a reescribir el subárbol completo en cada move y añade un invariante que puede desincronizarse (el mismo problema del riesgo #2, pero multiplicado por el número de descendientes). `depth` se **calcula** al leer, desde el conjunto de directorios del usuario que ya se carga (una consulta, acotada por el tope de 5.000 nodos). `ltree` es una extensión que ataría el proyecto a PostgreSQL y que Prisma no modela |
| 3 | **Dos columnas derivadas, no nulas, para que la unicidad la garantice la base**: `nameKey`/`titleKey` (nombre normalizado) y `parentScopeId` (`parentId ?? userId`), con `@@unique([parentScopeId, nameKey])` | `@@unique([userId, parentId, nameKey])`; índice único parcial (`where`, *preview feature*); índice por expresión `lower(name)`; comprobar la unicidad solo en la aplicación dentro de una transacción `Serializable`; una fila «directorio raíz» por usuario | Verificado con `context7` (§1): con `parentId` nulo la unicidad **no aplicaría** en la raíz, que es justo donde más se crean carpetas. Las dos alternativas de índice exigen *preview features* o SQL a mano que deja el esquema en *drift* permanente. La comprobación solo en aplicación funciona en `Serializable`, pero deja la garantía en manos de que nadie escriba nunca por otra vía. La fila raíz virtual es la opción más limpia conceptualmente y la más invasiva: obligaría a tocar el registro de `001` para crear la raíz de cada usuario, a impedir su borrado y su renombrado, y a que la UI trate un nodo sintético |
| 4 | **El árbol se sirve completo y plano** en `GET /api/workspace/tree`: dos arrays (`directories`, `documents`), cada nodo con su padre, sin anidar y **sin contenidos** | Respuesta anidada (`children: []` recursivo); carga por niveles (`?parentId=`); incluir `content` en el listado | El cliente necesita de todas formas un mapa normalizado por `id` (para la selección, y mañana para los tabs de `005`): una respuesta anidada le obligaría a aplanarla al recibirla. Además, un DTO recursivo en OpenAPI es un `$ref` a sí mismo, más difícil de generar y de validar con un type guard. La carga por niveles multiplica las peticiones al expandir carpetas y complica el estado sin beneficio a este tamaño. Incluir `content` convertiría el listado en la descarga de todo el texto del usuario |
| 5 | **Directorios y documentos tienen espacios de nombres separados**: en la misma carpeta puede haber un directorio `Ideas` y un documento `Ideas`, pero no dos directorios `Ideas` | Namespace común entre los dos tipos | Un namespace común exige una restricción entre dos tablas, que PostgreSQL solo puede dar con un *trigger* o con la tabla única de la decisión 1. Y la ambigüedad real es baja: en la interfaz un directorio y un documento se distinguen por icono y por comportamiento. La unicidad **entre hermanos del mismo tipo** es la que evita el caso confuso de verdad (dos carpetas idénticas en la misma lista) |
| 6 | **Borrado físico con cascada real en la base** (`onDelete: Cascade` en la autorrelación y en `Document.directory`), sin `deletedAt` ni papelera. Un directorio con hijos solo se borra si la petición lo pide explícitamente (`?recursive=true`) | Borrado lógico (`deletedAt`); borrado recursivo en la aplicación; reasignar los hijos al abuelo | Un `deletedAt` obliga a **todos** los caminos de lectura de **todas** las specs futuras a acordarse de filtrarlo: un solo olvido y el documento borrado reaparece. El borrado recursivo en la aplicación puede quedarse a medias si el proceso muere; la cascada de PostgreSQL sobre la autorrelación es recursiva y atómica. Reasignar los hijos al abuelo sorprende (borras una carpeta y su contenido aparece en otro sitio). El freno contra el accidente es la confirmación explícita, no la reversibilidad |
| 7 | **El *move* es la única operación con transacción `Serializable`**: dentro de ella se cargan los directorios del usuario, se comprueban propiedad, ciclo y profundidad, y se escribe | Comprobar y escribir sin transacción; `SELECT … FOR UPDATE` a mano; disparador en la base que detecte ciclos | El resto de operaciones no necesitan nada especial: la unicidad la impone el índice y la propiedad la impone el `where`. El move sí, porque decide en función de una **foto del árbol completo** y dos moves simultáneos en ramas distintas podrían crear un ciclo que ninguno de los dos ve por separado. `Serializable` lo convierte en un `P2034` (→ `409`) en vez de en una corrupción silenciosa. Un disparador en la base tendría que recorrer el árbol en PL/pgSQL: la misma lógica, sin tests unitarios y sin tipos. **Dónde vive la transacción, precisado el 2026-07-25 con `T-007`**: la abre el **repositorio**, no el servicio, expuesta como `inSerializableTransaction(scope, run)` con la interfaz `WorkspaceTreeTransaction` (`listDirectoryRefs` / `findDirectory` / `moveDirectory`, las tres con el `userId` del `scope` cerrado dentro, sin firma por la que pasar otro). La **decisión** —propiedad, ciclo, profundidad, no-op— se queda en `directories.service.ts`. Es la única forma de cumplir a la vez esta decisión y el invariante de la decisión 14, que `workspace-data-access.spec.ts` comprueba de forma mecánica: si el servicio abriera el `$transaction`, tendría que ver el cliente de Prisma y `PrismaService` dejaría de aparecer en un solo archivo |
| 8 | **Los errores de Prisma se traducen a HTTP en una sola función** (`toWorkspaceHttpException`): `P2002` → `409` con el `code` del recurso, `P2003` → `404 PARENT_NOT_FOUND`, `P2025` → `404`, `P2034` → `409 WORKSPACE_CONFLICT`. **Qué recurso es lo dice `meta.modelName`** (`'Directory'` → `DIRECTORY_NAME_TAKEN`, `'Document'` → `DOCUMENT_TITLE_TAKEN`), con dos respaldos: `meta.target` (forma clásica, sin driver adapter) y el nombre de la restricción que trae el adapter (`meta.driverAdapterError.cause.constraint.index` / `.fields`) | Capturar `P2002` en cada método; comprobar antes de escribir con un `findFirst` («*check-then-act*»); leer **solo** `meta.target` | Comprobar antes de escribir no es atómico: entre el `findFirst` y el `create` cabe otra petición, así que el índice único acaba disparando de todas formas y hay que traducirlo. Se traduce en un sitio y se prueba en un sitio. `P2003` como `404` no es un atajo: si la clave ajena falla es porque el directorio padre dejó de existir entre la comprobación y la escritura, y para el cliente eso **es** «el padre no existe». Y leer solo `meta.target` **no funciona en este stack**: con `@prisma/adapter-pg` ese campo no llega (§1). La cadena `modelName` → `target` → restricción del adapter tiene test para **las dos formas**, de modo que la traducción sobrevive a que el adapter entre o salga del proyecto |
| 9 | **`404` para todo lo que no es del usuario del token; nunca `403`** | `403` cuando el recurso existe pero es de otro; `404` solo cuando no existe | Un `403` confirma que el `id` existe: quien tenga una sesión válida podría barrer ids y descubrir qué documentos hay en la instalación. Y hay una razón más fuerte, de diseño: al filtrar **siempre** por `userId` en el `where`, «no existe» y «no es tuyo» son literalmente la misma rama de código. El comportamiento seguro es el que sale por defecto, no un `if` extra que alguien puede olvidar |
| 10 | **Renombrar y mover son endpoints separados** (`PATCH /:id` para el nombre, `POST /:id/move` para el sitio) | Un solo `PATCH` con `name?` y `parentId?` opcionales | Con `exactOptionalPropertyTypes` activo y `@IsOptional()` de class-validator (que trata `null` **igual** que ausente), un `PATCH` combinado no puede distinguir «mueve a la raíz» (`parentId: null`) de «no toques el sitio» (`parentId` ausente) sin recurrir a `Object.hasOwn` sobre la instancia validada. Además las dos operaciones fallan por motivos distintos (`409` de nombre vs. `409` de ciclo/profundidad) y solo una necesita transacción `Serializable` |
| 11 | **Los opcionales del cliente se expresan con `null` explícito y presencia obligatoria**, también en las **entradas**: `parentId`/`directoryId` son obligatorios y aceptan `null`, con el idiom `@ValidateIf((dto) => dto.parentId !== null) @IsUUID()` | `@IsOptional()` con `parentId` ausente = raíz | Continúa la regla de `001` (decisión 10 de su plan). `@IsOptional()` salta la validación también con `null`, así que un `parentId` ausente colaría sin validarse y «raíz» y «campo que no llegó» serían indistinguibles. Con `@ValidateIf` el `null` es válido y el ausente da `400` |
| 12 | **El frontend no hace actualizaciones optimistas**: tras cada mutación recarga `GET /tree` | Actualizar el store con la respuesta de la mutación; actualización optimista con rollback | La recarga es una petición barata (payload plano, sin contenidos) y elimina de un plumazo la clase de bugs en la que la barra lateral muestra un árbol que el servidor no tiene — que en un árbol con reglas de unicidad, profundidad y ciclos es fácil de provocar. Si el parpadeo molesta, se optimiza dentro del store sin tocar contratos |
| 13 | **`ErrorResponseDto` gana un `code?: string` opcional**, que solo emiten los errores de dominio de workspace | Que el frontend distinga los `409` por el texto del `message`; un DTO de error propio para workspace | Hay cinco `409` distintos y la UI tiene que decir cosas distintas en cada uno. Emparejar por texto se rompe en cuanto alguien traduce o matiza un mensaje. El campo es aditivo y opcional (igual que `retryAfterSeconds`), así que los tests de la spec `000` que comprueban el juego exacto de claves de un error siguen verdes. Un DTO de error paralelo rompería la promesa de «una sola forma de error en toda la API» |
| 14 | **Módulo `WorkspaceModule` plano** (`controller` → `service` → `repository` + dos módulos puros de dominio), sin capas `domain/application/infrastructure` | Estructura hexagonal completa con puertos y adaptadores | La propia guía de `clean-ddd-hexagonal` dice cuándo **no** aplicarla: CRUD con pocas reglas, equipo pequeño, infraestructura fija. Lo que sí se respeta es la regla que importa: el dominio (nombres y grafo) es **puro**, sin Nest ni Prisma ni HTTP, y por tanto testeable sin infraestructura; el repositorio es el único que conoce Prisma; el servicio es la frontera de transacción; el controlador solo valida protocolo. Y se mantiene la coherencia con `src/auth/`, que ya es plano |
| 15 | **Un quinto throttler nombrado, `workspace` (120/min/IP)**, declarado en los controladores; no se añade un throttler `default` global | Dejar workspace sin límite (estado actual del opt-in); throttler `default` global de red de seguridad | El CHANGELOG de `001` dejó esta decisión explícitamente para esta spec. Un `default` global convertiría el modelo opt-in en un híbrido confuso; en su lugar el olvido se hace **mecánico**: un test comprueba que todo controlador declara `@Throttled(...)` o `SkipThrottling()`. 120/min es muy por encima del uso interactivo (una mutación + una recarga del árbol son 2 peticiones; 60 acciones por minuto no las hace una persona) y muy por debajo de lo que hace un script |

## 3. Reglas de dominio y constantes

Van como constantes con nombre en el código (`src/workspace/workspace.constants.ts`), **no** como
variables de entorno: son decisiones de producto de esta spec, igual que los umbrales de seguridad de
`001` viven en su servicio.

| Constante | Valor | Motivo |
|---|---|---|
| `MAX_DIRECTORY_NAME_LENGTH` | `120` | Cabe en la barra lateral con una sangría razonable y en un `breadcrumb`; por encima, el nombre es una descripción |
| `MAX_DOCUMENT_TITLE_LENGTH` | `200` | Un título de documento admite una frase; sigue siendo una sola línea |
| `MAX_DIRECTORY_DEPTH` | `10` | Profundidades válidas `0`…`9` (`depth` = número de ancestros). Acota el recorrido de ancestros, la sangría de la UI y el coste de cualquier comprobación estructural. Más de 10 niveles de carpetas no es organización, es un laberinto |
| `MAX_DOCUMENT_CONTENT_CHARS` | `200_000` | Unas 60.000 palabras: diez veces el documento markdown más largo que alguien edita a mano. Se mide en **caracteres** porque es lo que `@MaxLength` cuenta y lo que el cliente puede comprobar igual |
| `MAX_WORKSPACE_NODES` | `5_000` | Directorios + documentos por usuario. Es lo que hace sostenible servir el árbol completo (decisión 4) |
| `JSON_BODY_LIMIT` | `'2mb'` | Techo del cuerpo HTTP: >4× el contenido máximo, para dejar sitio a multibyte y al escapado de JSON. Global (riesgo #7) |
| Throttler `workspace` | `120` / `60 s` / IP | Decisión 15 |

**Normalización del nombre** (`normalizeWorkspaceName`), en este orden:

1. `normalize('NFC')` — dos formas Unicode del mismo texto («á» compuesta vs. descompuesta) no deben
   producir dos carpetas que se ven idénticas.
2. `trim()` y colapso de las secuencias internas de espacios en blanco a un solo espacio ` `.
3. El resultado es el **`name` visible** que se guarda y se devuelve: conserva la caja que eligió el
   usuario.

**Clave de unicidad** (`workspaceNameKey`): la normalización anterior más `toLowerCase()`.

- Se usa `toLowerCase()` y **no** `toLocaleLowerCase()`: el primero aplica la conversión por defecto de
  Unicode, independiente del locale del proceso, así que la clave es la misma en esta máquina, en el CI y
  en producción. Con `toLocaleLowerCase()` una máquina con locale turco convertiría `I` en `ı` y
  produciría claves distintas para los mismos nombres (riesgo #3).
- **No** hay plegado de diacríticos: `Año` y `Ano` son nombres distintos, y deben serlo.
- La clave se calcula **solo en Node** y se persiste; la base nunca la deriva con `lower()`, así que no
  hay dos algoritmos que puedan discrepar.

**Nombre rechazado** (`400`) si, **después** de normalizar:

- mide `0` caracteres o más que el máximo de su tipo;
- contiene un carácter de control (`U+0000`–`U+001F`, `U+007F`);
- contiene `/` o `\` — separadores de ruta: los nombres acabarán en `breadcrumbs` y, si algún día hay
  exportación, en nombres de fichero;
- es exactamente `.` o `..` — reservados en cualquier jerarquía.

Se **permiten** `:`, `*`, `?`, `"`, `<`, `>`, `|` y los emoji: el almacenamiento es una base de datos, no
un sistema de ficheros (riesgo #4).

**Reglas del grafo** (`tree-graph.ts`, funciones puras sobre un `Map<string, { id, parentId }>`):

- `ancestorsOf(id)` — sube por `parentId` hasta la raíz. Si vuelve a visitar un nodo ya visto, **lanza**:
  un árbol con un ciclo es corrupción, y tiene que fallar ruidosamente en vez de colgar el proceso.
- `depthOf(id)` = `ancestorsOf(id).length`.
- `subtreeHeightOf(id)` — niveles por debajo del nodo (una hoja mide `0`).
- `assertMovable({ subjectId, targetId })` — rechaza en este orden: `targetId === subjectId` o
  `subjectId ∈ ancestorsOf(targetId)` → `MOVE_INTO_DESCENDANT`;
  `depthOf(target) + 1 + subtreeHeightOf(subject) > MAX_DIRECTORY_DEPTH - 1` →
  `DEPTH_LIMIT_EXCEEDED`. Mover al padre que ya se tiene **no** es error: es un no-op.

**Códigos de error de dominio** (campo `code` del `ErrorResponseDto`, decisión 13):

| `code` | HTTP | Cuándo |
|---|---|---|
| `DIRECTORY_NAME_TAKEN` | `409` | Ya hay un directorio hermano con ese `nameKey` |
| `DOCUMENT_TITLE_TAKEN` | `409` | Ya hay un documento hermano con ese `titleKey` |
| `DIRECTORY_NOT_EMPTY` | `409` | `DELETE` de un directorio con hijos y sin `recursive=true` |
| `MOVE_INTO_DESCENDANT` | `409` | El destino es el propio directorio o uno de sus descendientes |
| `DEPTH_LIMIT_EXCEEDED` | `409` | La operación dejaría un nodo por debajo de `MAX_DIRECTORY_DEPTH` |
| `WORKSPACE_LIMIT_REACHED` | `409` | El usuario alcanzó `MAX_WORKSPACE_NODES` |
| `WORKSPACE_CONFLICT` | `409` | `P2034`: otra transacción tocó el mismo árbol a la vez |
| `DIRECTORY_NOT_FOUND` | `404` | El directorio no existe **o no es del usuario del token** |
| `DOCUMENT_NOT_FOUND` | `404` | Ídem para documentos |
| `PARENT_NOT_FOUND` | `404` | El `parentId`/`directoryId` de destino no existe o no es suyo |

## 4. Contrato de API

Prefijo global `/api`. Base del módulo: `/api/workspace`. **Toda entrada y toda salida tiene DTO**; los
`204` se documentan con `@ApiNoContentResponse` y no llevan cuerpo. Todos los errores salen como
`ErrorResponseDto` (filtro global de la spec `000`).

**Autorización, en todos los endpoints sin excepción**: `@UseGuards(JwtAuthGuard)` +
`@CurrentUser() user: AuthenticatedUser` (contrato cerrado por `T-010` de `001`:
`import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../auth'`). El `userId` sale
**siempre** del token; ninguna ruta lo acepta como parámetro. `@Throttled('workspace')` se declara a
nivel de controlador.

**Parámetros de ruta**: los `:id` se validan con `ParseUUIDPipe` (→ `400` si no es un uuid). La regla dura
de «toda entrada por DTO» se aplica a cuerpos y *query strings*; un único parámetro escalar de ruta se
valida con el pipe, que es el mecanismo idiomático de Nest y produce el mismo `ErrorResponseDto`. Los
*query strings* **sí** llevan DTO.

DTOs de respuesta compartidos por varios endpoints:

- `WorkspaceDirectoryResponseDto` — `id: string` (uuid) · `name: string` · `parentId: string | null` ·
  `depth: number` · `createdAt: string` (ISO-8601) · `updatedAt: string` (ISO-8601)
- `WorkspaceDocumentSummaryResponseDto` — `id: string` · `title: string` ·
  `directoryId: string | null` · `contentBytes: number` · `createdAt: string` · `updatedAt: string`
- `WorkspaceDocumentResponseDto` **extends** `WorkspaceDocumentSummaryResponseDto` — `+ content: string`

Ninguno expone `userId`, `nameKey`, `titleKey` ni `parentScopeId` (AC-26).

### `GET /api/workspace/tree`

- **Auth**: Bearer · **Propiedad**: solo nodos con `userId` = `user.id`
- **Request DTO**: — (sin parámetros; la carga por niveles está fuera de alcance)
- **Response DTO**: `WorkspaceTreeResponseDto` (`200`)
  - `directories: WorkspaceDirectoryResponseDto[]` — plano, ordenado por `nameKey` y luego `id`
  - `documents: WorkspaceDocumentSummaryResponseDto[]` — plano, **sin** `content`
  - `generatedAt: string` (ISO-8601)
- **Errores**: `401` · `429`. **Sin `404`, y es deliberado** (fijado en la v0.2.2 de la spec, tras la
  contradicción que destapó `T-015`): es la única de las diez rutas que no resuelve ningún `:id`, así que
  no tiene recurso que no encontrar — un workspace vacío responde `200` con las dos listas vacías. El
  documento OpenAPI **no** declara `404` aquí, y el e2e de Swagger lo afirma en negativo para que la
  declaración no vuelva a colarse. Declararlo «por uniformidad del tag» sería documentar una respuesta
  inexistente: el único `404` que puede ver un cliente de esta ruta es el de **ruta inexistente** de Nest,
  que no es una respuesta de la operación — y confundir esos dos `404` es justo lo que produjo el falso
  RED de `T-007` y lo que la matriz de `T-012` tiene que distinguir por `code`
- **Implementación**: dos `findMany` con `where: { userId }` y `select` explícito (el `select` de
  `documents` **no** incluye `content`: en PostgreSQL ese campo puede estar en TOAST y traerlo sería leer
  todo el texto del usuario). `depth` se calcula en memoria con `tree-graph`

### `POST /api/workspace/directories`

- **Auth**: Bearer
- **Request DTO**: `CreateDirectoryRequestDto`
  - `name: string` — `@IsString`, `@MaxLength(120)`, `@Transform` con `normalizeWorkspaceName`, y
    validador propio `@IsWorkspaceName()` (no vacío tras normalizar, sin caracteres de control, sin `/`
    ni `\`, distinto de `.` y `..`)
  - `parentId: string | null` — obligatorio; `@ValidateIf((dto) => dto.parentId !== null) @IsUUID()`
- **Response DTO**: `WorkspaceDirectoryResponseDto` (`201`)
- **Errores**: `400` validación · `401` · `404` `PARENT_NOT_FOUND` (padre inexistente o ajeno) ·
  `409` `DIRECTORY_NAME_TAKEN` / `DEPTH_LIMIT_EXCEEDED` / `WORKSPACE_LIMIT_REACHED` · `429`

### `PATCH /api/workspace/directories/:id`

- **Auth**: Bearer · **Propiedad**: `where: { id, userId }`
- **Request DTO**: `RenameDirectoryRequestDto` — `name: string` (mismas reglas que en el alta)
- **Response DTO**: `WorkspaceDirectoryResponseDto` (`200`)
- **Errores**: `400` · `401` · `404` `DIRECTORY_NOT_FOUND` · `409` `DIRECTORY_NAME_TAKEN` · `429`
- **Comportamiento**: cambiar solo la caja del propio nombre **no** es colisión (el índice se compara con
  la fila que se está actualizando, no con sí misma)

### `POST /api/workspace/directories/:id/move`

- **Auth**: Bearer · **Propiedad**: sujeto **y** destino se buscan con `userId` del token
- **Request DTO**: `MoveDirectoryRequestDto` — `parentId: string | null` (obligatorio, `null` = raíz)
- **Response DTO**: `WorkspaceDirectoryResponseDto` (`200`) con el `parentId` y el `depth` nuevos
- **Errores**: `400` · `401` · `404` `DIRECTORY_NOT_FOUND` (sujeto) / `PARENT_NOT_FOUND` (destino ajeno o
  inexistente) · `409` `MOVE_INTO_DESCENDANT` / `DEPTH_LIMIT_EXCEEDED` / `DIRECTORY_NAME_TAKEN` (ya hay
  un hermano con ese nombre en el destino) / `WORKSPACE_CONFLICT` · `429`
- **Comportamiento**: `$transaction` con `isolationLevel: Serializable` —abierta por el repositorio con
  `inSerializableTransaction`, ver decisión 7—; dentro, un `findMany` de los directorios del usuario
  (`select: { id, parentId }`), `assertMovable`, y el `update` con `parentScopeId` recalculado. Mover al
  padre actual es un no-op que responde `200`
- **El no-op no escribe** (precisado el 2026-07-25 con `T-007`; es contrato observable, no detalle de
  implementación): cuando `parentId` ya es el destino se devuelve la fila **leída** dentro de la
  transacción, sin `update`, y por tanto con el `updatedAt` intacto. Un `update` idéntico habría sido más
  corto de escribir y habría movido `updatedAt`, es decir le habría dicho al cliente que el directorio
  cambió cuando no ha cambiado nada — y `003-editor` va a mirar esas marcas de tiempo. Se verifica
  comparando el `updatedAt` de antes y el de después

### `DELETE /api/workspace/directories/:id`

- **Auth**: Bearer · **Propiedad**: `where: { id, userId }`
- **Query DTO**: `DeleteDirectoryQueryDto` — `recursive?: boolean`, con `@Transform` que acepta
  **solo** `'true'` y `'false'` (cualquier otro valor → `400`; sin el parámetro → `false`)
- **Response**: `204` sin cuerpo
- **Errores**: `400` query inválida · `401` · `404` `DIRECTORY_NOT_FOUND` ·
  `409` `DIRECTORY_NOT_EMPTY` · `429`
- **Comportamiento**: sin `recursive`, se cuenta hijos (directorios + documentos) y se rechaza si hay
  alguno; con `recursive=true`, un `deleteMany({ where: { id, userId } })` y la **cascada de PostgreSQL**
  se encarga del subárbol. Si `count` es `0`, `404`

### `POST /api/workspace/documents`

- **Auth**: Bearer
- **Request DTO**: `CreateDocumentRequestDto`
  - `title: string` — `@MaxLength(200)` + las mismas reglas de nombre
  - `directoryId: string | null` — obligatorio, mismo idiom que `parentId`
  - `content?: string` — `@IsOptional`, `@IsString`, `@MaxLength(200_000)`. Ausente o `null` → `''`
- **Response DTO**: `WorkspaceDocumentResponseDto` (`201`, **con** `content`: el cliente recibe
  exactamente lo que se guardó y `003` podrá abrirlo en un tab sin un `GET` extra)
- **Errores**: `400` (incluido `content` demasiado largo) · `401` · `404` `PARENT_NOT_FOUND` ·
  `409` `DOCUMENT_TITLE_TAKEN` / `WORKSPACE_LIMIT_REACHED` · `413` cuerpo por encima de `JSON_BODY_LIMIT` ·
  `429`
- **Comportamiento**: `contentBytes` = `Buffer.byteLength(content, 'utf8')`, calculado y **persistido** al
  escribir, para que el listado del árbol no tenga que leer `content`
- **El `413` del contrato ya se cumple** — lo cerró `T-024` con AC-33 (v0.2.1), después de que `T-008`
  midiera un **`500`** el 2026-07-25: el `PayloadTooLargeError` de body-parser no es una `HttpException`,
  así que `AllExceptionsFilter` (spec `000`) caía a su rama genérica pese a que el error trae
  `status: 413`. Con el límite en 2 MiB y un tope de contenido de 200.000 caracteres el caso quedaba
  **fuera del alcance de los demás tests de esta spec**, que es por lo que estuvo roto sin que nadie lo
  viera. Se arregló el comportamiento y no el contrato. **La regla, porque es la parte que se afloja
  sola**: se leen `status` y `statusCode` y solo pasa un valor que cumpla
  `Number.isInteger(value) && value >= 400 && value <= 499` — rango **cerrado**, no «trae un `status`»—,
  reconocido por forma y **sin `import` de `http-errors`**. Un `502` de una librería no entra, cae al
  `500` genérico y **sigue** registrándose con traza, porque el `logger.error` pasó a depender del
  **estado** (`status >= 500`) y no del **origen**. Del error ajeno solo se publica `message` si es
  texto, y **`code` nunca se copia**: ese campo es de los errores de dominio de esta spec y una librería
  cualquiera no puede rellenarlo. Verificado en `apps/api/test/body-limit.e2e-spec.ts` y en
  `apps/api/src/common/filters/all-exceptions.filter.spec.ts`

### `GET /api/workspace/documents/:id`

- **Auth**: Bearer · **Propiedad**: `where: { id, userId }`
- **Request DTO**: — · **Response DTO**: `WorkspaceDocumentResponseDto` (`200`, con `content`)
- **Errores**: `401` · `404` `DOCUMENT_NOT_FOUND` · `429`

### `PATCH /api/workspace/documents/:id`

- **Auth**: Bearer · **Request DTO**: `RenameDocumentRequestDto` — `title: string`
- **Response DTO**: `WorkspaceDocumentSummaryResponseDto` (`200`, **sin** `content`: un renombrado no
  tiene por qué devolver el texto completo)
- **Errores**: `400` · `401` · `404` `DOCUMENT_NOT_FOUND` · `409` `DOCUMENT_TITLE_TAKEN` · `429`

### `POST /api/workspace/documents/:id/move`

- **Auth**: Bearer · **Propiedad**: documento **y** directorio destino con `userId` del token
- **Request DTO**: `MoveDocumentRequestDto` — `directoryId: string | null` (obligatorio)
- **Response DTO**: `WorkspaceDocumentSummaryResponseDto` (`200`)
- **Errores**: `400` · `401` · `404` `DOCUMENT_NOT_FOUND` / `PARENT_NOT_FOUND` ·
  `409` `DOCUMENT_TITLE_TAKEN` · `429`
- **Comportamiento**: no necesita `Serializable` — un documento no tiene descendientes, así que no hay
  ciclo posible; basta con verificar el destino y recalcular `parentScopeId`

### `DELETE /api/workspace/documents/:id`

- **Auth**: Bearer · **Request DTO**: — · **Response**: `204` sin cuerpo
- **Errores**: `401` · `404` `DOCUMENT_NOT_FOUND` (también en el segundo borrado: **no** es idempotente,
  a diferencia del `logout` de `001`, cuyo objetivo es «asegurar que no hay sesión»; aquí un `404` le dice
  al cliente que su árbol está desactualizado) · `429`

### Resumen: diez rutas

| Ruta | Método |
|---|---|
| `/api/workspace/tree` | `GET` |
| `/api/workspace/directories` | `POST` |
| `/api/workspace/directories/{id}` | `PATCH`, `DELETE` |
| `/api/workspace/directories/{id}/move` | `POST` |
| `/api/workspace/documents` | `POST` |
| `/api/workspace/documents/{id}` | `GET`, `PATCH`, `DELETE` |
| `/api/workspace/documents/{id}/move` | `POST` |

## 5. Esquema / migración Prisma

Se añaden dos modelos y dos relaciones en `User`. La relación autorreferencial de `Directory` necesita
nombre explícito (`"DirectoryTree"`), porque Prisma no puede inferir los dos lados de una relación de un
modelo consigo mismo.

```prisma
model User {
  // … campos de la spec 001 sin cambios …
  recoveryCodes MfaRecoveryCode[]
  directories   Directory[]
  documents     Document[]
}

model Directory {
  id String @id @default(uuid()) @db.Uuid

  userId   String  @db.Uuid
  parentId String? @db.Uuid

  /// Derivado y **no nulo**: `parentId ?? userId`. Existe solo para que la unicidad de nombres entre
  /// hermanos la pueda garantizar un índice: con `parentId` nulo (raíz) PostgreSQL considera los NULL
  /// distintos entre sí y `@@unique([userId, parentId, nameKey])` no impediría dos raíces homónimas.
  /// Lo calcula un único helper del repositorio, y un test recorre las filas para comprobarlo.
  parentScopeId String @db.Uuid

  /// Nombre visible, con la caja que eligió el usuario (normalizado NFC + trim + espacios colapsados).
  name String
  /// `name` en minúsculas por `toLowerCase()` (nunca `toLocaleLowerCase()`, que depende del locale).
  /// Es la clave de unicidad: la calcula Node y la base nunca la deriva.
  nameKey String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent   Directory?  @relation("DirectoryTree", fields: [parentId], references: [id], onDelete: Cascade)
  children Directory[] @relation("DirectoryTree")

  documents Document[]

  @@unique([parentScopeId, nameKey])
  @@index([userId, parentId])
  /// La cascada busca hijos por `parentId`: PostgreSQL **no** indexa las claves ajenas por su cuenta,
  /// y sin este índice un borrado recursivo hace un seq scan por nivel.
  @@index([parentId])
  @@map("directories")
}

model Document {
  id String @id @default(uuid()) @db.Uuid

  userId String @db.Uuid
  /// Nulo = documento en la raíz del workspace.
  directoryId String? @db.Uuid

  /// Mismo papel que en `Directory`: `directoryId ?? userId`.
  parentScopeId String @db.Uuid

  title    String
  titleKey String

  /// Markdown en crudo. Editarlo es alcance de la spec 003; aquí solo se fija al crear.
  content String @db.Text @default("")
  /// Longitud en bytes UTF-8, persistida para que el listado del árbol no tenga que leer `content`
  /// (en PostgreSQL ese texto puede vivir en TOAST y traerlo sería descargar todo el documento).
  contentBytes Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  directory Directory? @relation(fields: [directoryId], references: [id], onDelete: Cascade)

  @@unique([parentScopeId, titleKey])
  @@index([userId, directoryId])
  @@index([directoryId])
  @@map("documents")
}
```

- **Unicidad**: `@@unique([parentScopeId, nameKey])` y `@@unique([parentScopeId, titleKey])`, en tablas
  distintas → espacios de nombres separados (decisión 5).
- **`userId` denormalizado también en documentos anidados**: es lo que permite que **toda** consulta
  lleve `userId` en el `where` sin un `join`, que es la forma de que la autorización por recurso sea
  barata y difícil de olvidar. El invariante «un documento pertenece al dueño de su directorio» se cumple
  por construcción: no hay forma de crear ni mover un documento a un directorio ajeno (responde `404`).
- **`onDelete: Cascade`** en las tres claves ajenas: borrar un usuario limpia su workspace completo
  (AC-19), y borrar un directorio arrastra su subárbol recursivamente y sus documentos (AC-11).
- **Colisión teórica de `parentScopeId`**: la columna mezcla ids de usuario y de directorio. Dos uuid v4
  iguales tienen probabilidad despreciable, y el peor efecto posible sería compartir un cubo de unicidad;
  nunca una fuga de datos, porque las **lecturas** filtran por `userId` y no por `parentScopeId`.
- **Nombre de la migración**: `workspace_tree` (Prisma le pone el prefijo de fecha en UTC; el nombre
  final será algo como `20260725xxxxxx_workspace_tree`. En `001` el prefijo previsto en el plan no
  coincidió con el real: es una predicción, no un requisito).
- Tras `prisma migrate dev` hay que correr **`prisma generate`** aparte: con esta configuración
  `migrate dev` no regenera el cliente (CHANGELOG de `000`, v0.1.3).

## 6. Estructura del módulo (límites)

```
apps/api/src/workspace/
  workspace.module.ts
  workspace.controller.ts          # /api/workspace/tree
  directories.controller.ts        # /api/workspace/directories*
  documents.controller.ts          # /api/workspace/documents*
  workspace.service.ts             # lectura del árbol + tope de nodos
  directories.service.ts           # alta, renombrado, move y borrado de directorios
  documents.service.ts             # alta, lectura, renombrado, move y borrado de documentos
  workspace.repository.ts          # ÚNICO archivo del módulo que inyecta PrismaService
  workspace.constants.ts
  workspace-name.ts                # dominio puro: normalización y validación de nombres
  tree-graph.ts                    # dominio puro: ancestros, profundidad, altura, ciclo
  workspace.errors.ts              # excepciones de dominio con su `code`
  prisma-error.ts                  # traducción P2002/P2003/P2025/P2034 → HttpException
  domain-error.ts                  # traducción WorkspaceDomainError → HttpException
  dto/
    is-workspace-name.validator.ts # decorador @IsWorkspaceName() sobre workspace-name.ts
    create-directory.request.dto.ts
    rename-directory.request.dto.ts
    move-directory.request.dto.ts
    delete-directory.query.dto.ts
    create-document.request.dto.ts
    rename-document.request.dto.ts
    move-document.request.dto.ts
    workspace-directory.response.dto.ts
    workspace-document-summary.response.dto.ts
    workspace-document.response.dto.ts
    workspace-tree.response.dto.ts
```

Reglas de dependencia dentro del módulo (decisión 14):

- `workspace-name.ts` y `tree-graph.ts` **no importan nada** de Nest, Prisma ni HTTP. Son funciones puras
  y sus tests no montan nada.
- `workspace.repository.ts` es el único que importa `PrismaService`; **todos** sus métodos reciben el
  `userId` como primer argumento (`scope: { userId: string }`) y lo ponen en el `where`. Es lo que AC-22
  verifica de forma mecánica. Entre sus métodos está **`listDirectoryRefs(scope)`** (`select: { id,
  parentId }`), que es el que alimenta a `tree-graph`: el `depth` no se persiste (decisión 2), así que
  calcularlo —tanto al crear como al mover como al leer el árbol— necesita la foto de la jerarquía del
  usuario, y solo esas dos columnas.
- Los servicios orquestan: validan reglas de dominio, abren la transacción del move, traducen errores. No
  conocen `Request` ni `Response`.
- Los controladores solo hacen protocolo: guard, DTO, `ParseUUIDPipe`, código de estado, Swagger.

Dos archivos que §6 no listaba en la versión inicial y que §4 exige de facto (añadidos el 2026-07-25, ya
existentes en el módulo):

- **`dto/is-workspace-name.validator.ts`** — el decorador `@IsWorkspaceName()` que §4 pide en los cuatro
  DTO con nombre o título. Vive en un archivo propio para que las reglas de nombre (§3) se apliquen
  llamando a `workspace-name.ts` y no reimplementándolas con una regex distinta en cada DTO, que es como
  AC-3 y AC-14 acabarían divergiendo entre endpoints.
- **`domain-error.ts`** — `toWorkspaceDomainHttpException`, simétrico de `prisma-error.ts`: convierte un
  `WorkspaceDomainError` en `409 { message, code }` y **deja propagar sin tocar** cualquier otra cosa. El
  reparto es claro: `prisma-error.ts` traduce lo que viene de la base, `domain-error.ts` lo que viene de
  las reglas del dominio puro; ninguno de los dos captura de más.

Piezas nuevas que dejaron `T-006`, `T-007` y `T-008`, anotadas aquí porque **son reutilizables por las
tareas que faltan** y sin esta lista se reimplementarían con otro nombre (añadidas el 2026-07-25, ya
existentes en el módulo):

- **`DirectoryNotEmptyError`** en `workspace.errors.ts` — el `409 DIRECTORY_NOT_EMPTY` del borrado sin
  `recursive`, hermano de `MoveIntoDescendantError` y `DepthLimitExceededError` y traducido por el mismo
  `domain-error.ts`. `T-009` no necesita equivalente (un documento no tiene hijos), pero `T-012` sí tiene
  que contarlo entre los `409` de la matriz.
- **`countDirectoryChildren(scope, id)`** en `workspace.repository.ts` — suma subdirectorios **y**
  documentos con `userId` en **los dos** `where`. Sin el `userId` en el segundo, un documento ajeno
  colgado del mismo id bloquearía un borrado legítimo, y AC-22 no lo vería porque no es una lectura.
- **`inSerializableTransaction(scope, run)` + `WorkspaceTreeTransaction`** — ver decisión 7. `T-009`
  (move de documento) **no** la necesita: un documento no tiene descendientes.
- **`toStrictBoolean`** exportado desde `dto/delete-directory.query.dto.ts` — el `@Transform` que acepta
  solo `'true'` y `'false'`. Está exportado a propósito: cualquier query booleana futura lo reutiliza en
  vez de escribir un `value === 'true'` que convierte `?recursive=sí` en `false` silencioso.
- **`JSON_BODY_LIMIT`** en `workspace.constants.ts`, aplicado en `bootstrap.ts`. El límite se fija con un
  *type predicate* (`isBodyParserCapable(app): app is INestApplication & Pick<NestExpressApplication,
  'useBodyParser'>`) en lugar de cambiar la firma de `configureApp` a `NestExpressApplication`: ese
  cambio de firma habría obligado a tocar los cinco archivos e2e que ya la llaman, en mitad de la fase y
  con otros agentes escribiendo en `test/**`. El predicado **lanza al arrancar** si la app no fuera
  Express, en vez de saltarse el límite en silencio; una app sin `useBodyParser` seguiría en los 100 kB
  por defecto y AC-13 fallaría por un motivo que no tiene nada que ver con el dominio (riesgo #7).

**Tres servicios y no uno, por una razón de despacho además de una de cohesión**: directorios y documentos
se implementan en tareas distintas (`T-005`…`T-007` frente a `T-008`…`T-009`) y con un servicio único los
dos agentes editarían el mismo archivo a la vez. En la Fase 3 eso ya costó una tarea bloqueada. El único
archivo que ambos tocan es `workspace.module.ts`, y el reparto lo hace secuencial: lo **crea** `T-005` con
sus tres controladores declarados y `T-008` solo añade su servicio, ya con `T-005` verificada y cerrada.

## 7. Frontend

Límite de alcance (spec §4): entra el **árbol navegable y sus mutaciones**, y una vista de documento
deliberadamente cruda. **No** entra editor, preview, paleta, tabs, split view ni *drag and drop*.

- **Rutas** (`apps/web/src/app/routes.tsx`): se añade `documents/:id` como hija del `AppShell` (dentro de
  `RequireAuth`), con `DocumentViewPage`. `WorkspaceEmptyState` sigue siendo el `index`, con el texto
  actualizado a «selecciona un documento».
- **Store Zustand** `src/features/workspace/workspace.store.ts`:
  - Estado: `status: 'idle' | 'loading' | 'ready' | 'error'` · `directoriesById: Record<string,
    DirectoryNode>` · `documentsById: Record<string, DocumentSummary>` ·
    `childDirectoryIds: Record<string, string[]>` y `childDocumentIds: Record<string, string[]>` (clave
    `'root'` para la raíz, derivados al recibir el árbol) · `expandedIds: Set<string>` ·
    `selectedId: string | null` · `error: string | null` · `pendingAction: string | null`.
  - Acciones: `loadTree()`, `createDirectory(name, parentId)`, `createDocument(title, directoryId)`,
    `renameDirectory(id, name)`, `renameDocument(id, title)`, `moveDirectory(id, parentId)`,
    `moveDocument(id, directoryId)`, `deleteDirectory(id, recursive)`, `deleteDocument(id)`,
    `toggleExpanded(id)`, `select(id)`.
  - Cada mutación recarga el árbol al terminar (decisión 12). Un `ApiError` deja `error` con el mensaje y
    **no** toca el árbol; un `404` fuerza además una recarga (el árbol estaba desactualizado).
  - Nada persiste en `localStorage`/`sessionStorage`, igual que el store de auth.
- **Cliente HTTP** (`src/shared/api/http.ts`, ampliación):
  - `JsonRequest['method']` pasa a `'GET' | 'POST' | 'PATCH' | 'DELETE'`.
  - Camino nuevo para respuestas **sin cuerpo**: hoy `toJson` siempre intenta parsear, así que un `204`
    acabaría en «la respuesta no cumple el contrato». Se añade una variante que comprueba `response.ok`
    y devuelve `void` cuando el estado es `204`.
  - Funciones tipadas contra `@one-markdown/shared`: `getWorkspaceTree`, `createDirectory`,
    `renameDirectory`, `moveDirectory`, `deleteDirectory`, `createDocument`, `getDocument`,
    `renameDocument`, `moveDocument`, `deleteDocument`. Todas por `authorizedJson` (con el
    refresh-on-401 por defecto: aquí un `401` **sí** significa «el bearer caducó», no «tu credencial del
    cuerpo es incorrecta», así que no aplica el opt-out de `mfa/enable`).
- **Componentes** (`src/features/workspace/`):
  - `WorkspaceTreeView` — reemplaza el texto placeholder del `#document-tree` del `AppShell`. Patrón
    WAI-ARIA *tree*: contenedor `role="tree"` con `aria-label`, `role="group"` para los hijos,
    `role="treeitem"` con `aria-level`, `aria-expanded` (solo directorios) y `aria-selected`, **un solo**
    nodo tabulable (roving tabindex).
  - `TreeNodeRow` — fila de un nodo, con su menú de acciones (nuevo, renombrar, mover, borrar).
  - `CreateNodeForm` — alta de directorio o documento en un padre dado.
  - `RenameNodeDialog`, `MoveNodeDialog` (selector de destino que **excluye** el sujeto y sus
    descendientes, calculado con las mismas reglas que el servidor), `ConfirmDeleteDialog` (nombra
    cuántos nodos se van a borrar y es lo que habilita `recursive=true`).
  - `DocumentViewPage` — título, ruta (`breadcrumb` derivado del store) y el markdown en un `<pre>`
    con `white-space: pre-wrap`. **Andamio explícito** de `003`: no renderiza HTML, así que no hay nada
    que sanitizar.
- **Tipos compartidos** (`packages/shared`): `DirectoryNode`, `DocumentSummary`, `MarkdownDocument`,
  `WorkspaceTree` y sus guards (`isDirectoryNode`, `isDocumentSummary`, `isMarkdownDocument`,
  `isWorkspaceTree`). Ninguno se llama `Document` ni `Directory` (riesgo #10). `ApiErrorShape` gana
  `code?: string` (decisión 13). Los DTO del backend declaran `implements` contra estos tipos, para que
  una divergencia rompa el `typecheck` y no el navegador.
- **Accesibilidad**: teclado completo en el árbol (flechas, `Home`/`End`, `Enter` para activar); cada
  diálogo con `role="dialog"`, `aria-modal`, foco atrapado y devuelto al disparador al cerrar; errores en
  un contenedor `role="alert"` que recibe el foco; los botones de acción con nombre accesible que incluye
  el nombre del nodo (`Renombrar «Notas»`), no solo un icono.

## 8. Estrategia de tests

| Nivel | Qué cubre | Dónde |
|-------|-----------|-------|
| unit (api, sin infraestructura) | normalización y rechazo de nombres (AC-4, AC-13) · claves de unicidad (AC-3, AC-14) · ancestros, profundidad, altura y detección de ciclo (AC-6, AC-8, AC-10) · traducción de errores de Prisma (AC-25) · tope de nodos (AC-21) · un solo archivo con `PrismaService` (AC-22) · cobertura de throttler en todos los controladores (AC-24) | `apps/api/src/workspace/**/*.spec.ts`, `apps/api/src/common/throttle-coverage.spec.ts` |
| e2e (api) | alta, renombrado y borrado de directorios (AC-1…AC-7, AC-11) · move de directorios (AC-8…AC-10) · documentos (AC-12…AC-18) · árbol (AC-20, AC-21) · propiedad y credencial en los diez endpoints (AC-22, AC-23) · límite propio (AC-24) · concurrencia y cascada (AC-19, AC-25) · OpenAPI (AC-26) | `apps/api/test/workspace-*.e2e-spec.ts`, `apps/api/test/swagger.e2e-spec.ts` |
| unit (shared) | tipos y guards del workspace, incluido el rechazo de `null` ausente (AC-27) | `packages/shared/src/index.test.ts` |
| unit/componente (web) | cliente HTTP con `PATCH`/`DELETE` y `204` · store (carga, mutación, recarga, error) · árbol con ARIA y teclado (AC-28) · crear/renombrar/borrar (AC-29) · diálogo de mover (AC-30) · vista de documento (AC-31) | `apps/web/src/**/*.test.ts(x)` |
| e2e (web) | recorrido completo en navegador real (AC-32) | `apps/web/e2e/workspace.spec.ts` |

Convenciones de los e2e de esta spec (heredan las de `001` y añaden lo propio del árbol):

- **Un usuario nuevo por archivo e2e**, creado con el helper de `test/fixtures/auth-e2e.ts`
  (`uniqueEmail`), y **borrado al final**: la cascada limpia su workspace entero, así que no hace falta
  borrar nodos uno a uno. Los tests **nunca** hacen `deleteMany` sin `where`: la base es la de desarrollo
  del usuario.
- `resetThrottleCounters` en el `beforeEach`, como en los e2e de auth: el límite es por IP y todas las
  peticiones salen de `127.0.0.1`. El e2e de AC-24 es el único que agota el cupo a propósito.
- **Nombres únicos por caso** dentro del usuario del archivo, para que un archivo pueda correr dos veces
  sin arrastrar estado.
- El e2e de la cascada (AC-19) borra **su propio** usuario y comprueba con Prisma que no quedan filas
  suyas; no toca ningún otro usuario.
- El e2e de profundidad crea la cadena de 10 niveles con un bucle, no con diez llamadas escritas a mano.
- El e2e de concurrencia (AC-25) lanza las dos peticiones con `Promise.all` sobre el mismo `agent` y
  ordena los resultados por código antes de comprobarlos: el orden de llegada no es determinista, pero el
  **conjunto** `{200, 409}` sí.

## 9. Orden de ejecución

Esquema/migración → dominio puro → repositorio → endpoints de directorios → endpoints de documentos →
árbol y transversales → contrato compartido → frontend → e2e de navegador.

Detalle y dependencias exactas en `tasks.md`. Dos notas de paralelismo:

- `T-002` (nombres) y `T-003` (grafo) son independientes entre sí y no dependen de la migración: pueden
  hacerse en paralelo y son los primeros tests que fallan en rojo de verdad.
- `T-016` (contrato en `packages/shared`) se puede escribir en cuanto `T-010` cierra la forma del árbol;
  desde ahí el `frontend` avanza en paralelo con las transversales del `backend` (`T-011`…`T-015`),
  porque el contrato ya está fijado por escrito en §4.
