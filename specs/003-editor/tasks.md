# Tareas 003 — Editor: vista texto/preview, guardado y sanitización del preview

Spec: `spec.md` v0.1.4 · Plan: `plan.md`

**Estado: 17/17 tareas — spec `complete` el 2026-07-28.** Todas cerradas y verificadas, cada una con su
comando corrido y su salida real; los **34 AC** quedan cubiertos y **ninguno con verificación manual**.
La spec quedó **approved** el mismo día con las cinco decisiones de §5 resueltas y **sin cambios de
alcance**. Las casillas se marcaron al cerrar, contra el registro de la Fase 5 de `IMPLEMENTATION.md`.

**Cifras del cierre**: `shared` **81** · `apps/web` 16 archivos / **321** · api unit 21 suites / **305** ·
api e2e 22 suites / **511** (40,2 s) · `pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24**, sin
un solo `429` · `typecheck` y `lint` en **0** en los tres paquetes.

**`T-016` se añadió sobre la marcha** (16 → **17** tareas): la implementación destapó que el espejo de
`MAX_DOCUMENT_CONTENT_CHARS` podía divergir sin que nada lo detectara (ver la tarea y `plan.md` §3). Los
**34 AC no cambiaron**. Vive en el **bloque G**, **fuera de la secuencia numérica**, así que contar «hasta
`T-012`» da 13 y se la salta — error ya cometido una vez.

Cada tarea es atómica, se asigna a un agente y sigue RED → GREEN → REFACTOR. El test se escribe
primero y **debe fallar antes** de implementar; el agente reporta el rojo inicial con su salida real.

**Tareas de tipo `setup`**: correr una migración no tiene un test que pueda fallar antes de que la
columna exista. Se marcan `setup` y se verifican con un comando de salida observable. **Toda tarea que
introduce comportamiento es TDD estricta.** No se admite una tarea `setup` que además implemente
comportamiento.

**Solo `T-011` instala dependencias** (`plan.md` §1.1) y solo ella toca `apps/web/package.json`. Si
otra tarea parece necesitar un paquete, **para y reporta**.

**Toda tarea lista los archivos que toca.** El reparto en paralelo se hace por conjuntos **disjuntos**:
dos agentes solo corren a la vez si sus listas no se solapan.

---

## Bloque 0 — Enmienda de la spec `002`

- [x] **T-000** · `orchestrator` · `spec` · Enmienda de la spec `002` a v0.4.0 — **hecha el 2026-07-28**
      **AC**: — (habilita AC-11, AC-12, AC-31)
      **Depende de**: la aprobación del usuario — **obtenida el 2026-07-28**, decisiones A…E resueltas
      sin cambios de alcance
      **QUÉ**: aplicar **exactamente** la tabla de `spec.md` §6 sobre `specs/002-workspace-tree/`: AC-12,
      AC-15, AC-26, AC-31 y AC-32 de su `spec.md`; §4, §5 y §7 de su `plan.md`; entrada
      `## v0.4.0 — <fecha>` en su `CHANGELOG.md`; y la fila de la `002` en `specs/README.md`. **No se
      toca ni una línea de código en esta tarea**: los cambios de test los hacen `T-007`, `T-009` y
      `T-013`, cada uno junto a la implementación que los provoca.
      **DONE**: `specs/002-workspace-tree/spec.md` declara v0.4.0 y su CHANGELOG tiene la entrada;
      `pnpm test` sigue en verde (esta tarea no toca código, así que **cualquier** rojo aquí es un
      problema previo y se reporta antes de seguir).
      **ARCHIVOS**: `specs/002-workspace-tree/spec.md`, `plan.md`, `CHANGELOG.md`,
      `specs/003-editor/*`, `specs/README.md`, `IMPLEMENTATION.md`, `CLAUDE.md`.
      **VERIFICADO (2026-07-28)**: `specs/002-workspace-tree/spec.md` declara **v0.4.0** y su
      `CHANGELOG.md` tiene la entrada `## v0.4.0 — 2026-07-28`. `pnpm test` → **exit 0**, shared
      **65**, web 12 archivos / **188**, api 19 suites / **264** — las cifras exactas del cierre de la
      `002`, corridas **antes y después** de la enmienda con idéntico resultado, que es lo que
      demuestra que no se tocó código. Cero archivos de `apps/**` o `packages/**` modificados
      (`git status`).
      **AÑADIDOS sobre el enunciado original**, los dos derivados de las respuestas del usuario:
      (a) `CLAUDE.md` fija «split view» = **texto y preview lado a lado del mismo documento**, con la
      edición mínima que quita la ambigüedad —la frase la va a heredar la `005`—;
      (b) la spec `003` sube a **v0.1.1** y pasa a **approved**, con las decisiones A…E marcadas como
      resueltas y su entrada de CHANGELOG. Se siguió el convenio de `001` y `002`: **aprobar no salta a
      1.0.0**; lo que cambia al aprobar es el `Estado`, y la versión sube solo porque el contenido de
      §5 cambió.

## Bloque A — Esquema y dominio puro (backend)

- [x] **T-001** · `backend` · `setup` · Columna `contentVersion` y migración
      **AC**: — (habilita AC-1…AC-11)
      **Depende de**: T-000
      **QUÉ**: añadir a `model Document` de `apps/api/prisma/schema.prisma` el campo
      `contentVersion Int @default(0)` **tal como está escrito en `plan.md` §5**, con su comentario.
      Sin índice. Migración `document_content_version`. Después, `prisma generate` (con esta
      configuración `migrate dev` **no** regenera el cliente).
      **DONE**: `pnpm --filter @one-markdown/api exec prisma migrate dev --name document_content_version`
      sale 0 · `prisma generate` sale 0 · `prisma migrate status` → sin migraciones pendientes ·
      verificación del esquema **real** con el MCP `postgres`: la columna existe, es `integer NOT NULL`
      y su `DEFAULT` es `0` · `pnpm --filter @one-markdown/api test:e2e workspace-documents` sigue
      verde (la columna nueva no debe aparecer en ninguna respuesta todavía).
      **ARCHIVOS**: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**` (nueva carpeta),
      `apps/api/src/generated/prisma/**` (regenerado).
      **NOTA**: el prefijo de fecha lo pone Prisma; el nombre exacto de la carpeta se reporta al
      orchestrator (ni en `001` ni en `002` coincidió con la predicción del plan).

- [x] **T-002** · `backend` · Dominio puro: `contentBytesOf`
      **AC**: AC-3 (parte de tamaño)
      **Depende de**: T-000 · **Corre en paralelo con T-001**
      **RED**: `apps/api/src/workspace/document-content.spec.ts` — `contentBytesOf('')` → `0`;
      `contentBytesOf('abc')` → `3`; `contentBytesOf('ñ')` → **`2`** y `contentBytesOf('🙂')` → **`4`**
      (los dos distintos de la longitud en caracteres, que es lo que cuenta `@MaxLength`);
      `contentBytesOf` de una cadena con `\r\n` cuenta los dos bytes (no se normalizan saltos de
      línea). El archivo **no importa nada** de Nest ni de Prisma (se comprueba leyendo sus imports,
      igual que en `workspace-name.spec.ts`).
      **GREEN**: `apps/api/src/workspace/document-content.ts` con la función y su JSDoc. Cero `any`.
      **DONE**: `pnpm --filter @one-markdown/api test document-content`
      **ARCHIVOS DE ESTA TAREA** (no toques nada más): `document-content.ts`, `document-content.spec.ts`.

## Bloque B — Repositorio y throttler (backend)

- [x] **T-003** · `backend` · `WorkspaceRepository.saveDocumentContent`
      **AC**: AC-5 (nivel de datos), AC-9 (nivel de datos)
      **Depende de**: T-001, T-002
      **RED**: ampliar `apps/api/src/workspace/workspace.repository.spec.ts` (contra la base real) —
      `saveDocumentContent(scope, id, { content, expectedVersion })` con la versión vigente devuelve el
      resumen y deja en la fila el `content` enviado, `contentBytes` recalculado con `contentBytesOf` y
      `contentVersion` **exactamente uno más**; con una versión **rancia** devuelve `null` (o el
      discriminante que se elija) y la fila **no cambia en absoluto**, `updatedAt` incluido; con el
      `userId` de **otro** usuario tampoco escribe nada aunque la versión sea correcta; y `title`,
      `directoryId` y `parentScopeId` quedan intactos en todos los casos. Además, `createDocument`
      sigue calculando `contentBytes` correctamente después de pasar a usar `contentBytesOf`.
      **GREEN**: el método nuevo con un **único** `updateMany` condicional
      (`where: { id, userId, contentVersion: expectedVersion }`,
      `data: { content, contentBytes, contentVersion: { increment: 1 } }`) más la relectura del resumen
      cuando `count === 1`; `createDocument` refactorizado a `contentBytesOf`. `scope: WorkspaceScope`
      sigue siendo el primer parámetro y `userId` va en **todos** los `where`.
      **DONE**: `pnpm --filter @one-markdown/api test workspace.repository` ·
      `pnpm --filter @one-markdown/api test workspace` (la parte unitaria del módulo, para ver que
      `workspace-data-access.spec.ts` sigue verde: `PrismaService` debe seguir en **un solo** archivo)
      **ARCHIVOS**: `apps/api/src/workspace/workspace.repository.ts`, `workspace.repository.spec.ts`,
      `apps/api/test/fixtures/workspace-db.ts` (hay que añadir `content` y `contentVersion` a
      `DocumentDbRow`, que hoy no los trae).

- [x] **T-004** · `backend` · Throttler `documentContent`
      **AC**: AC-10 (parte de configuración)
      **Depende de**: T-000 · **Corre en paralelo con T-003** (conjuntos disjuntos)
      **RED**: `apps/api/src/common/throttle.spec.ts` (archivo nuevo) — `THROTTLE_NAMES` incluye
      `'documentContent'`, `THROTTLE_LIMITS.documentContent` es `{ limit: 120, ttlSeconds: 60 }`, y
      `AUTH_THROTTLERS` tiene una entrada por cada nombre; y —lo que de verdad importa— con un
      `ExecutionContext` falso cuyo **manejador** declara `documentContent` y cuya **clase** declara
      `workspace`, el throttler que resuelve `declaredThrottler` es `documentContent`. Este último caso
      es el que hace innecesario partir el controlador (`plan.md` §1.4): si sale al revés, **para y
      reporta**, no lo arregles inventando un controlador nuevo.
      **GREEN**: `'documentContent'` en `THROTTLE_NAMES` y su límite en `THROTTLE_LIMITS`.
      **DONE**: `pnpm --filter @one-markdown/api test throttle` ·
      `pnpm --filter @one-markdown/api test:e2e auth-throttle` (regresión: los cinco throttlers de
      `001`/`002` siguen midiendo lo mismo)
      **ARCHIVOS**: `apps/api/src/common/throttle.ts`, `apps/api/src/common/throttle.spec.ts`.
      **NOTA**: `throttle.ts` es contrato de la spec `001`. Es una adición pura, pero si algún test de
      `000`/`001`/`002` se pone en rojo, **para y reporta**.

## Bloque C — Endpoint de guardado (backend)

- [x] **T-005** · `backend` · `PUT /api/workspace/documents/:id/content`
      **AC**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-13
      **Depende de**: T-003, T-004
      **RED**: `apps/api/test/workspace-document-content.e2e-spec.ts` (archivo nuevo) —
      guardado feliz → `200` con las claves **exactas** `{id, contentBytes, contentVersion, updatedAt}`
      y **ninguna más**, `contentVersion: 1`, `contentBytes` = bytes UTF-8 de un texto con un carácter
      multibyte, y el `content` de la base idéntico al enviado; `content: ''` → `200` con
      `contentBytes: 0`; `content` ausente / no string / de 200.001 caracteres / `expectedVersion`
      ausente / no entero / negativo / propiedad no declarada → `400` nombrando el campo **y la fila
      sin cambiar**; `content` de 200.000 caracteres → `200`; versión rancia → `409` con
      `code: 'DOCUMENT_CONTENT_CONFLICT'` y fila intacta; dos guardados con la **misma**
      `expectedVersion` lanzados con `Promise.all` → `{200, 409}` y la versión avanza exactamente uno;
      documento **ajeno** con la versión correcta **y** con una incorrecta → `404`
      `DOCUMENT_NOT_FOUND` en los dos casos (**nunca** `409`); `:id` no uuid → `400`; sin
      `Authorization` → `401`; con un refresh token como `Bearer` → `401`; el mismo contenido dos veces
      con la versión vieja → `409` y con la nueva → `200`; renombrar y mover **no** cambian
      `contentVersion` y guardar **no** cambia `title` ni `directoryId`; cuerpo por encima de 2 MiB →
      `413` con forma de `ErrorResponseDto` y **no** `500`.
      **GREEN**: `SaveDocumentContentRequestDto` (`@IsString` + `@MaxLength`, **sin `@IsNotEmpty`** y
      **sin `@Transform`**; `@IsInt` + `@Min(0)`), `WorkspaceDocumentContentResponseDto` construido
      **campo a campo** y con `@ApiProperty`, `DocumentsService.saveDocumentContent()` con la
      desambiguación `404`/`409` por `count({ where: { id, userId } })`, y el manejador
      `@Put(':id/content')` con `@Throttled('documentContent')` a nivel de **método** y su Swagger
      completo. Nunca se devuelve la entidad Prisma; cero `any`.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-document-content`
      **ARCHIVOS**: `apps/api/src/workspace/dto/save-document-content.request.dto.ts`,
      `dto/workspace-document-content.response.dto.ts`, `documents.service.ts`,
      `documents.controller.ts`, `apps/api/test/workspace-document-content.e2e-spec.ts`.
      **SERIE**: ver §«Suites que van en serie» — este archivo mide concurrencia.

- [x] **T-006** · `backend` · Contrato compartido: `contentVersion` y `DocumentContentSaved`
      **AC**: AC-14
      **Depende de**: T-005 (la forma de la respuesta ya está cerrada por `plan.md` §4, así que puede
      empezarse antes si hace falta desbloquear al frontend)
      **RED**: ampliar `packages/shared/src/index.test.ts` — `isMarkdownDocument` devuelve `false` con
      `contentVersion` **ausente** y con uno no numérico, y `true` con uno completo;
      `isDocumentSummary` sigue devolviendo **`true`** para un resumen **sin** `contentVersion` (el
      árbol no lo trae y no debe empezar a exigirlo); `isDocumentContentSaved` exige `id`,
      `contentBytes`, `contentVersion` y `updatedAt`, y rechaza un `contentVersion` ausente o no
      numérico.
      **GREEN**: `MarkdownDocument` gana `contentVersion: number`, tipo nuevo `DocumentContentSaved`,
      guard `isDocumentContentSaved`, y la constante `MAX_DOCUMENT_CONTENT_CHARS` reexportada
      (`plan.md` §3: el límite **no** se duplica a mano en el frontend).
      **DONE**: `pnpm --filter @one-markdown/shared test` · `pnpm shared:build`
      **ARCHIVOS**: `packages/shared/src/index.ts`, `packages/shared/src/index.test.ts`.

- [x] **T-007** · `backend` · `contentVersion` en las respuestas de documento
      **AC**: AC-11
      **Depende de**: T-006
      **RED**: ampliar `apps/api/test/workspace-documents.e2e-spec.ts` — el alta y el detalle traen
      `contentVersion` (`0` recién creado, con y sin contenido inicial) y sus claves son **exactamente**
      las de `WorkspaceDocumentResponseDto`; el renombrado y el move devuelven el resumen y **no**
      traen `contentVersion` ni `content`; y `GET /tree` sigue sin traer ninguno de los dos en sus
      `documents`.
      **GREEN**: `WorkspaceDocumentResponseDto` gana `contentVersion` con su `@ApiProperty`, y
      `DocumentProjection` el campo correspondiente; el repositorio lo añade a `DOCUMENT_SELECT` (no a
      `DOCUMENT_SUMMARY_SELECT`).
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-documents` ·
      `pnpm --filter @one-markdown/api test:e2e workspace-tree`
      **ARCHIVOS**: `apps/api/src/workspace/dto/workspace-document.response.dto.ts`,
      `workspace.repository.ts`, `apps/api/test/workspace-documents.e2e-spec.ts`.
      **REGLA DURA**: de la `002` **solo** pueden cambiar las dos aserciones de claves exactas (sus
      AC-12 y AC-15). Si cae **cualquier** otro test de `000`/`001`/`002`, **para y reporta**: no se
      ajusta el test de otra spec por cuenta propia (procedimiento de `T-024`/`T-026`/`T-027`).

- [x] **T-008** · `backend` · Cupo propio del guardado
      **AC**: AC-10
      **Depende de**: T-005
      **RED**: `apps/api/test/workspace-document-content-throttle.e2e-spec.ts` (archivo nuevo) —
      `THROTTLE_LIMITS.documentContent.limit` guardados seguidos responden `200`/`409` (nunca `429`) y
      el siguiente responde `429` con `ErrorResponseDto`; y **después de agotarlo**,
      `GET /api/workspace/tree` sigue respondiendo `200` — los guardados no consumen el cupo de
      `workspace`. Comprobar también el camino inverso: agotar `workspace` no impide guardar.
      **GREEN**: ninguno esperado si `T-004` y `T-005` están bien; si hace falta tocar código, es que
      el throttler no estaba donde debía.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e workspace-document-content-throttle` ·
      `pnpm --filter @one-markdown/api test throttle-coverage`
      **ARCHIVOS**: `apps/api/test/workspace-document-content-throttle.e2e-spec.ts`.
      **SERIE**: agota cupo a propósito. Ver §«Suites que van en serie».
      **DEUDA CONOCIDA, ABIERTA EL 2026-07-28 — pendiente de realinear.** `T-008` se escribió bajo la
      redacción **incorrecta** de la regla de resets (ver `T-015`), la cumplió al pie de la letra y por
      tanto **no** resetea contadores: para dejar la base limpia **espera a que venza la ventana del
      `ttl`**, leyendo el `PTTL` de las claves `throttle:{workspace,documentContent}:*` y durmiendo lo que
      les quede. Funciona y es correcto, pero cuesta **~60 s de espera pura por corrida** —de ~65 s
      totales, solo ~5 s son las ~248 peticiones HTTP— e introduce un **idioma distinto** del de los otros
      17 archivos e2e del API. Se realinea con el convenio (`resetThrottleCounters` en los hooks de ciclo
      de vida, como `workspace-throttle.e2e-spec.ts`) en cuanto la base quede libre. **No cambia ningún
      AC**: AC-10 se sigue verificando igual, y el reset iría en los **límites** del caso, nunca a mitad
      de la secuencia de agotamiento.

- [x] **T-009** · `backend` · OpenAPI de la ruta nueva
      **AC**: AC-12
      **Depende de**: T-005, T-007
      **RED**: ampliar `apps/api/test/swagger.e2e-spec.ts` — existe
      `PUT /api/workspace/documents/{id}/content` con `security` `bearer` y `400`/`401`/`404`/`409`/
      `413`/`429` documentadas; existen los schemas `SaveDocumentContentRequestDto` y
      `WorkspaceDocumentContentResponseDto`; `WorkspaceDocumentResponseDto` declara `contentVersion`;
      el tag `workspace` tiene **once** rutas y **diez** declaran `404` (`GET /tree` sigue siendo la
      única que no, y se afirma en negativo); ningún schema se llama como un modelo del
      `schema.prisma` real; el documento no menciona `nameKey`, `titleKey`, `parentScopeId` ni
      `userId`.
      **GREEN**: completar los decoradores de Swagger que falten en el controlador.
      **DONE**: `pnpm --filter @one-markdown/api test:e2e swagger`
      **ARCHIVOS**: `apps/api/test/swagger.e2e-spec.ts`, `apps/api/src/workspace/documents.controller.ts`.
      **REGLA DURA**: los recuentos («diez rutas» → once) son los únicos cambios permitidos sobre las
      aserciones de la `002`. Cualquier otro rojo se reporta.
      **NOTA DE DESPACHO**: toca `documents.controller.ts`, igual que `T-005`. **No corre en paralelo
      con `T-005`.**

## Bloque D — Cliente HTTP y renderizador (frontend)

- [x] **T-010** · `frontend` · `saveDocumentContent` en el cliente HTTP
      **AC**: AC-15
      **Depende de**: T-006
      **RED**: ampliar `apps/web/src/shared/api/http.test.ts` — `JsonRequest['method']` acepta `'PUT'`;
      `saveDocumentContent(id, content, expectedVersion)` emite un `PUT` a
      `/api/workspace/documents/:id/content` con el cuerpo **exacto** `{ content, expectedVersion }`,
      cabecera `Authorization` y `Content-Type: application/json`; valida la respuesta con
      `isDocumentContentSaved` y lanza `ApiError` si el cuerpo no cumple; ante un `409` con
      `code: 'DOCUMENT_CONTENT_CONFLICT'` produce un `ApiError` cuyo `code` es exactamente ese; y el
      `id` va por `encodeURIComponent`, como en el resto de rutas de documento.
      **GREEN**: la función nueva en `http.ts`, por `authorizedJson` (con el refresh-on-401 por
      defecto: aquí un `401` **sí** significa «el bearer caducó»).
      **DONE**: `pnpm --filter @one-markdown/web test http`
      **ARCHIVOS**: `apps/web/src/shared/api/http.ts`, `apps/web/src/shared/api/http.test.ts`.

- [x] **T-011** · `frontend` · `MarkdownPreview`, `rehypeRawAsText` y el corpus de XSS
      **AC**: AC-24, AC-25
      **Depende de**: T-000 · **Es la ÚNICA tarea que instala dependencias**
      **INSTALA**: `react-markdown@10.1.0`, `remark-gfm@4.0.1`, `rehype-sanitize@6.0.0` en
      `dependencies` de `apps/web`, con las versiones **exactas** de `plan.md` §1.1. **No instales
      `rehype-raw`**: instalarlo es justo lo que rompería la capa 1 del modelo de amenaza.
      **RED**: (a) `apps/web/src/features/editor/rehype-raw-as-text.test.ts` — sobre un árbol hast a
      mano, cada nodo `raw` (incluidos los anidados dentro de un `blockquote`) sale como nodo `text`
      con el mismo `value`, y ningún otro nodo se toca. (b)
      `apps/web/src/features/editor/MarkdownPreview.test.tsx` — encabezados, listas, énfasis, enlaces,
      imágenes y bloques de código salen como **elementos**; tablas, listas de tareas, tachado y
      enlaces automáticos de GFM también; y para **cada** carga de
      `apps/web/src/test/markdown-xss-corpus.ts`: no hay `script`, `iframe`, `object`, `embed` ni
      `svg`; **ningún** nodo del subárbol tiene un atributo cuyo nombre empiece por `on`; todo
      `a[href]`/`img[src]` tiene protocolo `http`/`https`/`mailto` o es relativo, o carece del
      atributo; y **el texto que escribió la persona sigue apareciendo** (la aserción que impide que
      la sanitización se coma prosa). (c)
      `apps/web/src/features/editor/no-dangerous-html.test.ts` — recorriendo el árbol de archivos de
      `apps/web/src`, la cadena `dangerouslySetInnerHTML` **no aparece en ninguno**, con dos
      autocomprobaciones del detector (que sí la encuentra en una cadena que la contiene y que no la
      confunde con `dangerously`).
      **GREEN**: `rehype-raw-as-text.ts` (~12 líneas, puro, **sin dependencias**: recorre
      `node.children` a mano, no con `unist-util-visit`, que hoy solo es una dependencia transitiva) y
      `MarkdownPreview.tsx` con `remarkPlugins={[remarkGfm]}` y
      `rehypePlugins={[rehypeRawAsText, rehypeSanitize]}` **en ese orden**, sin tocar `urlTransform` y
      sin `skipHtml`. El corpus incluye **como mínimo** las cargas medidas en `plan.md` §1.3:
      `<script>`, `<img src=x onerror>`, `<svg onload>`, `<iframe>`, `[x](javascript:…)`,
      `![x](javascript:…)`, `[x](data:text/html;base64,…)`, `<!-- c -->texto`, `<b>` en línea, y un
      `<div onclick>` con texto dentro.
      **DONE**: `pnpm --filter @one-markdown/web test MarkdownPreview` ·
      `pnpm --filter @one-markdown/web test rehype-raw-as-text` ·
      `pnpm --filter @one-markdown/web test no-dangerous-html` ·
      `pnpm --filter @one-markdown/web build` (que las tres dependencias ESM entren en el bundle sin
      configuración extra es parte del resultado)
      **ARCHIVOS**: `apps/web/package.json`, `pnpm-lock.yaml`,
      `apps/web/src/features/editor/MarkdownPreview.tsx`, `MarkdownPreview.test.tsx`,
      `rehype-raw-as-text.ts`, `rehype-raw-as-text.test.ts`, `no-dangerous-html.test.ts`,
      `apps/web/src/test/markdown-xss-corpus.ts`.
      **NOTA**: si Vitest o Vite necesitan configuración extra para estos paquetes ESM (por ejemplo en
      `optimizeDeps.include`), **reporta antes de tocar `vite.config.ts`**: ese archivo es contrato de
      la spec `000` y lleva el comentario de AC-34 de la `002`.

## Bloque E — Estado e interfaz (frontend)

- [x] **T-012** · `frontend` · Store del editor
      **AC**: AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-28 (parte de estado), AC-30 (parte de estado)
      **Depende de**: T-010
      **RED**: `apps/web/src/features/editor/editor.store.test.ts` — `open(id)` pide el documento y
      deja `{savedContent, draft, contentVersion, status:'clean'}`; `setDraft` con texto distinto →
      `dirty`, y volviendo al texto original → `clean`; diez `setDraft` dentro de la ventana →
      **una** petición al vencer el debounce (temporizadores falsos, contando llamadas); editar con un
      guardado en vuelo → **un solo** guardado encolado, nunca dos; éxito → adopta el `contentVersion`
      devuelto y el siguiente guardado envía **el nuevo**; fallo → `draft` intacto y estado
      `conflict` (`409` con `DOCUMENT_CONTENT_CONFLICT`) / `rejected` (`400`, `404`, `413`, `429` →
      mensaje del servidor) / `unreachable` (`statusCode: 0`, `5xx`, cuerpo que incumple el contrato →
      mensaje propio, **distinto** del anterior); `resolveKeepMine` relee el documento y reenvía el
      `draft` con la versión nueva → `clean` con el texto local; `resolveTakeServer` adopta el
      contenido del servidor **sin** emitir ningún `PUT`; un `429` **no** dispara reintento (se cuenta
      que no hay segunda petición en la ventana siguiente); `flush(id)` con éxito borra la entrada y
      con fallo la conserva con su `draft`.
      **GREEN**: `editor.store.ts` con la forma de `plan.md` §7 (`Record<string, EditorEntry>`) y
      `editor.constants.ts`. Nada persiste en `localStorage`/`sessionStorage`.
      **DONE**: `pnpm --filter @one-markdown/web test editor.store`
      **ARCHIVOS**: `apps/web/src/features/editor/editor.store.ts`, `editor.store.test.ts`,
      `editor.constants.ts`.
      **Corre en paralelo con T-011**: conjuntos disjuntos, salvo que T-011 esté a mitad de su
      `pnpm install` (ver `plan.md` §9).

- [x] **T-013** · `frontend` · `DocumentEditorPage` y retirada del andamio de la `002`
      **AC**: AC-22, AC-23, AC-27, AC-29, AC-30, AC-31, AC-20 (interfaz), AC-28 (interfaz)
      **Depende de**: T-011, T-012
      **RED**: `apps/web/src/features/editor/DocumentEditorPage.test.tsx` — `h2` con el título, `nav`
      con el breadcrumb, `role="tablist"` con dos `role="tab"` y `aria-selected` en exactamente uno,
      `role="tabpanel"` asociado por `aria-labelledby`, región de guardado con `role="status"` y
      errores en un `role="alert"` **aparte**; en modo texto **un solo** control editable, un
      `<textarea>` con nombre accesible cuyo valor es el `draft` y que llama a `setDraft` al escribir;
      cambio de pestaña con flechas desde el teclado; modo vista previa renderiza el **`draft`**, no el
      `savedContent`; `Ctrl`+`S` llama a `preventDefault`, guarda de inmediato y cancela el debounce
      pendiente, y **no emite petición** si el estado es `clean`; el manejador de `beforeunload` está
      registrado mientras hay cambios sin guardar y **retirado** en cuanto vuelve a `clean`; el
      contador de caracteres restantes aparece solo al pasar el umbral; el diálogo de conflicto ofrece
      las dos resoluciones con nombres accesibles explícitos («Conservar mi versión» / «Descartar mis
      cambios»), `role="dialog"` y `aria-modal`; al desmontar con cambios pendientes se fuerza el
      guardado; y **no queda** ningún `pre[aria-label="Markdown en crudo"]`. Se **trasladan** los casos
      de `DocumentViewPage.test.tsx` que siguen valiendo (breadcrumb, anuncio de carga, «este
      documento ya no existe» con recarga del árbol ante un `404`) y se borran los que ya no aplican.
      **GREEN**: `DocumentEditorPage.tsx`, `SaveStatus.tsx`, `ConflictDialog.tsx`; la ruta
      `documents/:id` de `routes.tsx` apunta al editor; se **borran**
      `features/workspace/DocumentViewPage.tsx` y `DocumentViewPage.test.tsx`.
      **DONE**: `pnpm --filter @one-markdown/web test` (la suite entera: esta tarea borra un
      componente que otros tests podían tocar) · `pnpm --filter @one-markdown/web typecheck`
      **AMPLIACIÓN AUTORIZADA EL 2026-07-28 — `setViewMode` es de esta tarea.** `plan.md` §7 lo declara
      como acción del store, pero el RED de `T-012` no lo pedía y las ARCHIVOS de esta tarea no incluían
      `editor.store.ts`: **no era de nadie**, y es un fallo de reparto del orchestrator, no de los
      agentes. Se añade **al store**, con su test, y **no** se baja a un `useState` local como proponía
      `T-012`. Motivo: con «split view = texto y preview del **mismo** documento» (decisión E), el modo
      activo es estado **por documento**; en el store va indexado por `id` y la `005` lo conserva al
      cambiar de pestaña, mientras que en estado local se perdería en cada montaje — y volver a una
      pestaña y encontrarla en otro modo del que se dejó es justo el tipo de detalle que hace que los
      tabs se sientan rotos.
      **ARCHIVOS**: `apps/web/src/features/editor/DocumentEditorPage.tsx`, `.test.tsx`,
      `SaveStatus.tsx`, `ConflictDialog.tsx`, `editor.store.ts` **y** `editor.store.test.ts` (solo para
      `setViewMode`; el resto del store es de `T-012` y está cerrado),
      `apps/web/src/app/routes.tsx`, `routes.test.tsx`,
      `apps/web/src/features/workspace/DocumentViewPage.tsx` (borrar),
      `DocumentViewPage.test.tsx` (borrar), `apps/web/e2e/workspace.spec.ts` (enmienda de la `002`).
      **REGLA DURA**: en `apps/web/e2e/workspace.spec.ts` **solo** puede cambiar la aserción sobre la
      región `Markdown en crudo` (AC-32 de la `002`, enmendado por `T-000`). Todo lo demás de ese
      recorrido —el árbol con un solo `treeitem`, el breadcrumb de un paso, la ausencia de errores de
      consola— sigue igual. Si cae otra cosa, **para y reporta**.

## Bloque F — Navegador

- [x] **T-014** · `frontend` · e2e de navegador: recorrido, conflicto y corpus de XSS
      **AC**: AC-26, AC-32, AC-33
      **Depende de**: T-013 (y del backend completo: T-005, T-007)
      **RED**: `apps/web/e2e/editor.spec.ts` (archivo nuevo) — (a) **recorrido**: iniciar sesión, crear
      un documento, abrirlo, escribir markdown con un encabezado y una lista, esperar a «Guardado»,
      **recargar la página**, y comprobar que el texto sigue ahí; después pasar a vista previa y ver el
      encabezado y la lista **como elementos**; sin errores de consola. (b) **conflicto**: con el
      editor abierto y cambios locales, emitir un `PUT …/content` con `page.request` (que comparte el
      tarro de cookies) que suba la versión, forzar el guardado, ver la interfaz de conflicto, elegir
      «Conservar mi versión», y comprobar **por API** —no por pantalla— que el documento contiene el
      texto local. (c) **corpus**: instalar un manejador de `page.on('dialog')` y un centinela
      `window.__xssTripped` mediante `addInitScript`, y para cada carga del **mismo**
      `markdown-xss-corpus.ts` que usa `T-011`, escribirla, pasar a vista previa y comprobar que no se
      abre diálogo, el centinela sigue sin tocar, no hay errores de consola, y se repiten las
      aserciones de elementos y atributos de AC-25.
      **GREEN**: lo que haga falta para que pase; si algo falla es un defecto real del editor y se
      reporta antes de tocar el test.
      **DONE**: `pnpm --filter @one-markdown/web exec playwright test editor`
      **ARCHIVOS**: `apps/web/e2e/editor.spec.ts`.
      **NOTA**: el corpus se **importa** de `apps/web/src/test/markdown-xss-corpus.ts`. Copiarlo aquí
      es la forma silenciosa de que la verificación en navegador acabe probando menos cargas que la de
      jsdom (`plan.md` §8).

- [x] **T-015** · `frontend` · Presupuesto de la suite de navegador
      **AC**: AC-34
      **Depende de**: T-014
      **RED**: `pnpm --filter @one-markdown/web exec playwright test --retries=2 --repeat-each=3` —
      **debe fallar antes de tocar nada** con al menos un `429`, o bien pasar y quedar registrado que
      el presupuesto ya cuadraba (que también es un resultado válido, y hay que reportarlo como tal en
      vez de fabricar un rojo).
      **GREEN**: gastar menos, no neutralizar más. En este orden: reutilizar la cuenta compartida de
      `global-setup.ts` en el archivo nuevo en vez de crear otra; reducir el número de guardados por
      caso a los que el AC necesita; y solo si eso no basta, resetear en la suite de **navegador** los
      contadores que haga falta (`throttle:documentContent:*`, `throttle:workspace:*`), dejando escrito
      junto a la función **qué cobertura se pierde y quién la cubre**, como hizo la `002`.
      **DONE**: el mismo comando en verde, con su recuento · `pnpm test:e2e` en verde
      **ARCHIVOS**: `apps/web/e2e/support/services.ts`, `apps/web/e2e/support/session.ts`,
      `apps/web/e2e/editor.spec.ts`.
      **REGLA SOBRE LOS RESETS DE CONTADORES.** _Reescrita el 2026-07-28: la redacción anterior era
      **incorrecta** y está más abajo, con lo que decía mal._ La regla real distingue **dónde** se
      resetea, no **si** se resetea:

      1. **En los límites de un caso, SÍ.** Un `resetThrottleCounters` en `beforeEach`/`afterEach`/
         `afterAll` no destruye nada: hace la prueba **determinista**, porque el caso parte de un
         contador limpio y **después** agota. Es el idioma establecido de la casa —**17** archivos e2e
         del API y **39** puntos de llamada—, y el ejemplo que zanja el asunto es
         `workspace-throttle.e2e-spec.ts`, que resetea en sus tres hooks de ciclo de vida **y aun así
         exige `429` nueve veces**.
      2. **A mitad de una secuencia de agotamiento, NO.** Ahí sí se destruye la prueba: reiniciar el
         contador entre la petición N y la N+1 hace que el `429` no llegue nunca y el test pase sin
         comprobar que el límite existe. **Ésta es la prohibición de verdad**, y es sobre el **momento**,
         no sobre el archivo.
      3. **En la suite de navegador, nada que impida ver un `429`.** Es lo que protegía la intención
         original: el reset de `apps/web/e2e/support/services.ts` pone a cero `throttle:register:*` y
         `throttle:login:*` para que el navegador **nunca** los vea, y por eso la `002` dejó escrito que
         quien verifica esos dos límites es `apps/api/test/auth-throttle.e2e-spec.ts`. Si aquí hace falta
         resetear `documentContent` o `workspace`, se hace **en la suite de navegador**, y se deja escrito
         junto a la función **qué cobertura se pierde y quién la cubre** — que es lo que hizo `T-027`.

      **Lo que decía la redacción anterior, y por qué estaba mal**: «no lleves ningún reset de contadores
      a la suite del API; allí destruiría la única prueba de que los límites existen», nombrando
      `auth-throttle`, `workspace-throttle` y `workspace-document-content-throttle`. Es falso en los
      hechos: **dos de los tres archivos que nombraba ya reseteaban** en sus hooks cuando se escribió, sin
      perder un solo `429`. Confundí «resetear» con «resetear en el momento equivocado» y convertí una
      regla sobre el **momento** en una prohibición sobre el **lugar**.

      Si tocas `apps/web/e2e/support/*`, que es contrato de la spec `001`, deja entrada de cierre en el
      CHANGELOG de esa spec, igual que hizo `T-027`.

## Bloque G — Deuda cerrada

- [x] **T-016** · `backend` · El espejo de `MAX_DOCUMENT_CONTENT_CHARS` no puede divergir en silencio
      **AC**: AC-14 (parte de la constante), AC-30 (el contador del cliente y el `400` del servidor tienen
      que hablar del mismo número)
      **Depende de**: T-006 · **Corre en paralelo con cualquier tarea de frontend** (conjuntos disjuntos)
      **POR QUÉ EXISTE**: `plan.md` §3 prometía que el límite «no se duplica a mano», y `T-006` no pudo
      cumplirlo —`packages/shared` no puede importar de `apps/api`, la dependencia va al revés—, así que
      implementó un **valor espejo**. Hoy el `200_000` está escrito **dos veces** y el test de `shared`
      solo fija **su propio** literal: subir el de `apps/api` a `300_000` **no rompería nada**, y el
      cliente ofrecería sitio que el servidor rechaza con un `400`. La decisión de cerrarlo con un test
      de acoplamiento —y no con una reexportación, que metería un límite del servidor detrás de
      `packages/shared/dist`— está razonada en `plan.md` §3.
      **RED**: ampliar `apps/api/src/workspace/document-content.spec.ts` — un caso que importa
      `MAX_DOCUMENT_CONTENT_CHARS` de `../workspace.constants` **y** de `@one-markdown/shared` y afirma
      que son **el mismo número**, con un mensaje que diga cuál es la fuente (`workspace.constants.ts`) y
      cuál el espejo. **El rojo se demuestra con una mutación**: cambia temporalmente uno de los dos
      valores, comprueba que el test falla, y deshaz la mutación — igual que hizo `T-023` de la `002` con
      sus tres mutaciones de control. Sin esa demostración el test podría estar comparando una constante
      consigo misma y nadie lo notaría.
      **GREEN**: ninguno esperado — los dos valores ya son `200_000`. Si el test pasa a la primera **sin**
      que la mutación lo haya puesto en rojo antes, la tarea **no** está hecha: reporta.
      **DONE**: `pnpm --filter @one-markdown/api test document-content`
      **ARCHIVOS**: `apps/api/src/workspace/document-content.spec.ts` (solo el archivo de test; **no** se
      toca ninguna de las dos constantes).

---

## Suites e2e: qué comparte estado y qué tiene que ir en serie

**Hecho verificado, y frágil**: la suite e2e del API ya corre en serie, pero por la **línea de
órdenes** — `jest --config ./test/jest-e2e.json --runInBand` en `apps/api/package.json` — y **no** por
el archivo de configuración: `test/jest-e2e.json` no fija `maxWorkers` ni `runInBand`. Quien quiera
acelerar la suite quitando ese argumento tiene que leer esta sección primero.

**Todo** lo que hay debajo comparte **una sola** base PostgreSQL (`localhost:5433`) y **un solo**
Redis (`localhost:6379`), y todos los contadores del throttler son **por IP**, con todas las
peticiones saliendo de `127.0.0.1`. Es decir: los cupos son un recurso **global de la suite**, no de
cada archivo.

### Suites del API que NO pueden correr en paralelo con nada

| Archivo | Por qué |
|---|---|
| `apps/api/test/auth-throttle.e2e-spec.ts` | **Agota cupo** de `register`, `login`, `mfa` y `refresh` a propósito (AC-20 de la `001`) |
| `apps/api/test/workspace-throttle.e2e-spec.ts` | **Agota** las 120 peticiones de `workspace` en cuatro de sus casos (AC-24 de la `002`) |
| **`apps/api/test/workspace-document-content-throttle.e2e-spec.ts`** ← nuevo (`T-008`) | **Agota** las 120 de `documentContent`, y además comprueba que agotar uno **no** agota el otro: en paralelo, otro archivo gastando cupo haría esa comprobación insignificante |
| `apps/api/test/auth-login.e2e-spec.ts` | Provoca el **bloqueo por cuenta** (5 fallos → 15 minutos). Es por cuenta y no por IP, así que ningún reset de `throttle:*` lo deshace |

### Suites del API que miden concurrencia y no toleran otro escritor

| Archivo | Por qué |
|---|---|
| `apps/api/test/workspace-concurrency.e2e-spec.ts` | Dos renombrados con `Promise.all`: afirma el conjunto `{200, 409}` (AC-25 de la `002`) |
| **`apps/api/test/workspace-document-content.e2e-spec.ts`** ← nuevo (`T-005`) | AC-6 lanza dos guardados con `Promise.all` desde la **misma** versión y afirma `{200, 409}` y que la versión avanza **exactamente uno**. Un tercer escritor sobre el mismo documento rompe la afirmación; y como los dos casos de conflicto usan su propio usuario y su propio documento, lo que hay que garantizar es que **nadie más escriba en ese documento**, cosa que hoy garantiza `--runInBand` |

### Suites del API que solo comparten la base (paralelizables entre sí si algún día se quita `--runInBand`, con un usuario propio por archivo)

`auth-me`, `auth-mfa`, `auth-mfa-login`, `auth-register`, `auth-session`, `body-limit`,
`workspace-cascade`, `workspace-directories`, `workspace-documents`, `workspace-move`,
`workspace-ownership`, `workspace-tree`. Todas crean su usuario con `uniqueEmail` y lo borran al
final; **ninguna** hace un `deleteMany` sin `where`.

### Suites que no tocan datos

`health`, `swagger`, `swagger-production`, `validation`. Arrancan el módulo pero no crean filas.

### Suite de navegador (`apps/web/e2e/`)

`playwright.config.ts` está en `fullyParallel: true`, con `workers: 1` **solo en CI**; en local
Playwright levanta varios trabajadores. Consecuencias que esta spec añade:

- `editor.spec.ts` gasta cupo de **`documentContent`** (varios guardados por caso) y de `workspace`
  (crear el documento y recargar el árbol), además de un `login` por caso.
- Con `--repeat-each=3` y `--retries=2` esos gastos se multiplican por hasta **nueve**. AC-34 y
  `T-015` existen para medirlo **antes** de dar la spec por cerrada, no para descubrirlo en el primer
  rojo de CI.
- La cuenta compartida se crea **una sola vez** en `global-setup.ts` (AC-35 de la `002`) y el archivo
  nuevo debe reutilizarla en vez de registrar otra: registrar cuesta del cupo de 5 altas por IP cada
  15 minutos, que es el más escaso de todos.

## Reparto en paralelo (conjuntos de archivos disjuntos)

| Ola | Tareas simultáneas | Se solapan en |
|---|---|---|
| 1 | `T-001` (backend) ‖ `T-002` (backend) | nada |
| 2 | `T-003` (backend) ‖ `T-004` (backend) | nada |
| 3 | `T-005` (backend) | — |
| 4 | `T-006` (backend) | — |
| 5 | `T-007` ‖ `T-008` (backend) ‖ `T-010` ‖ `T-011` (frontend) | nada. `T-007` y `T-008` tocan archivos distintos; `T-010` y `T-011` también |
| 6 | `T-009` (backend) ‖ `T-012` (frontend) | `T-009` toca `documents.controller.ts`, que también toca `T-005`: **no** puede solaparse con él, sí con `T-012` |
| 7 | `T-013` (frontend) | — |
| 8 | `T-014` (frontend) | — |
| 9 | `T-015` (frontend) | — |
| — | `T-016` (backend) — **sin ola fija**: solo depende de `T-006`, toca un único archivo de test que no toca nadie más, así que entra en cualquier hueco a partir de la ola 5 | nada |

Aviso de `plan.md` §9: mientras `T-011` esté ejecutando su `pnpm install`, **ninguna** otra tarea de
frontend debe correr. Un `pnpm install` concurrente sobre el mismo *store* deja un `node_modules` que
nadie sabe reproducir.

## Definition of Done (todas las tareas)

1. El test se escribió primero y **falló primero**, y el agente reporta el rojo con su salida real.
2. Cada AC de la spec tiene al menos un test automatizado, y el AC dice con qué mecanismo.
3. Backend: entrada y salida por DTO explícito (`*.request.dto.ts` con class-validator,
   `*.response.dto.ts` construido campo a campo), documentados con Swagger; sin entidades Prisma
   crudas; cero `any`.
4. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan.
5. Si cae un test de las specs `000`, `001` o `002` que esta spec no había declarado que iba a cambiar
   (`spec.md` §6), el agente **para y reporta**. No se ajusta el test de otra spec por cuenta propia.
6. `IMPLEMENTATION.md` lo actualiza **el orchestrator**, con el comando de verificación corrido y su
   salida real.
