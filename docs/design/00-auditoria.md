# Auditoría de diseño — One Markdown

**Fase 0 · Inventario.** Este documento no propone nada. Registra lo que hay hoy en
`apps/web/src`, con la ruta del archivo al lado de cada afirmación, para que la fase 8 no
descubra nada que no esté escrito aquí.

- **Rama auditada**: `main`, commit `c692332`.
- **Fuentes**: los 24 archivos de interfaz de `apps/web/src` (excluidos `*.test.tsx`),
  `apps/web/src/index.css`, y el CSS **compilado** (`dist/assets/index-*.css`, 26,1 kB) para los
  valores finales de la §3.
- **Fecha**: 2 de agosto de 2026.

## Cómo leer la columna «estado»

| Marca | Significado |
|---|---|
| **D** — diseñado | Hay decisiones visuales deliberadas y todos sus estados están tratados. |
| **R** — resuelto | Comportamiento, accesibilidad y estados correctos y probados, pero el aspecto es Tailwind por defecto sin intención visual. |
| **F** — solo funciona | Existe y no rompe, pero no tiene tratamiento: ni jerarquía, ni estados propios, ni vacío pensado. |
| **A** — ausente | El estado es alcanzable y **no** hay nada pintado para él. |

Adelanto del recuento sobre los **68 estados alcanzables** que enumera la §1, porque condiciona
todo lo demás: **0 en D**, **45 en R**, **18 en F**, **5 en A** — más **6 ausencias globales**
(modo oscuro, movimiento reducido, móvil, avisos efímeros, marca, carga inicial). Lo que existe
está bien construido por dentro (roles ARIA, foco, regiones vivas, teclado) y sin construir por
fuera.

---

# 1. Inventario de pantallas y estados

## 1.1 Mapa de rutas

Definido en `src/app/routes.tsx`. Solo hay **cinco** rutas.

| Ruta | Componente | Envoltorio | Notas |
|---|---|---|---|
| `/login` | `features/auth/LoginPage` | `AuthPageLayout` (fuera del shell) | Pública |
| `/register` | `features/auth/RegisterPage` | `AuthPageLayout` (fuera del shell) | Pública |
| `/settings/security` | `features/auth/SecurityPage` | `RequireAuth`, **fuera** del `AppShell` — layout propio | Protegida |
| `/` (index) | `app/WorkspaceEmptyState` | `RequireAuth` → `AppShell` | Protegida |
| `/documents/:id` | `features/editor/DocumentEditorPage` | `RequireAuth` → `AppShell` | Protegida |
| `/*` (splat) | `app/NotFoundPage` | `RequireAuth` → `AppShell` | Protegida — el 404 **conserva** la navegación |

No existe ruta de recuperación de contraseña, ni de perfil, ni de ajustes que no sean de
seguridad. `/settings/security` está fuera del `AppShell`: al entrar se pierden el árbol, las
pestañas y la cabecera.

## 1.2 Estados de autenticación

| # | Estado | Ruta | Componente | Estado |
|---|---|---|---|---|
| 1 | Login en reposo | `/login` | `LoginPage` + `AuthField` ×2 + `AuthSubmitButton` | R |
| 2 | Login enviando | `/login` | `AuthSubmitButton` con `disabled` + `aria-busy`; el rótulo **no cambia** (decisión explícita en `AuthPageLayout.tsx`) | R |
| 3 | Login con credenciales inválidas | `/login` | `AuthFormError` (`role="alert"`, recibe el foco) | R |
| 4 | **Cuenta bloqueada por intentos** | `/login` | El mismo `AuthFormError`. El backend responde `429` con `retryAfterSeconds` (`apps/api/src/auth/account-locked.exception.ts`) y `auth.errors.ts` lo formatea a «Demasiados intentos. Vuelve a probar en N minutos.» | **F** — indistinguible visualmente de una contraseña mal escrita; el temporizador es texto estático que no cuenta atrás |
| 5 | Login sin red | `/login` | `AuthFormError` con el mensaje de `statusCode === 0` | R |
| 6 | Límite por IP alcanzado | `/login`, `/register` | `AuthFormError` con el mensaje del throttler del backend | F |
| 7 | **Verificación MFA** (segundo paso) | `/login` | `MfaChallengeForm` — sustituye al formulario de credenciales en el mismo `AuthPageLayout` | R |
| 8 | MFA con código incorrecto | `/login` | `AuthFormError`; `pendingMfa` se conserva y el campo sigue vivo | R |
| 9 | MFA caducado | `/login` | `AuthFormError` con «La verificación caducó. Vuelve a iniciar sesión.» (`auth.store.ts`) | F |
| 10 | Registro en reposo | `/register` | `RegisterPage` + 3 `AuthField` | R |
| 11 | Registro con contraseña que no cumple | `/register` | Validación **cliente**: `AuthFormError` con la regla + `AuthField problem` con `aria-invalid` | R |
| 12 | Registro con correo ya usado | `/register` | `AuthFormError` con el mensaje del servidor | R |
| 13 | Comprobando sesión (arranque) | cualquier ruta protegida | `RequireAuth` → `<main>` centrado con `role="status"` y «Comprobando tu sesión…» | F — texto suelto sobre fondo gris, sin marca ni indicador |
| 14 | Sesión perdida a media navegación | — | `onSessionLost` en `auth.store.ts` deja el estado anónimo y `RequireAuth` redirige a `/login` con `state.from` | **A** — no hay ningún aviso de «te hemos sacado»; la persona aterriza en el login sin explicación |

## 1.3 Estados de `/settings/security`

Todo en `features/auth/SecurityPage.tsx`, gobernado por la unión `Enrollment`
(`idle` | `confirm` | `codes`) cruzada con `user.mfaEnabled`.

| # | Estado | Qué se pinta | Estado |
|---|---|---|---|
| 15 | Seguridad, MFA desactivado | h1 + `role="status"` con «Verificación en dos pasos: desactivada» + `EnrollSection` con el botón de activar | R |
| 16 | **Alta de MFA con QR** | `EnrollSection` con `setup !== null`: `<img>` del `qrCodeDataUrl` a 192×192, la clave en `<code>` con `select-all`, campo de 6 dígitos con `autoFocus` y botón «Confirmar» | R |
| 17 | **Códigos de recuperación** | `RecoveryCodes`: `role="alert"` ámbar + `<ul>` en `grid-cols-2` con los códigos en `font-mono` `select-all` | **F** — es la única vez que se ven y no hay copiar, ni descargar, ni imprimir, ni confirmación de que se han guardado |
| 18 | **Desactivar MFA** | `DisableSection`: contraseña + código, advertencia de que se cierran las otras sesiones, botón «Desactivar verificación en dos pasos» | R |
| 19 | Seguridad ocupada | Todos los botones con `disabled` + `aria-busy` | R |
| 20 | Seguridad con error | `AuthFormError` sobre la sección | R |
| 21 | Seguridad con MFA ya activo | `DisableSection` — no hay forma de **regenerar** códigos de recuperación | **A** — funcionalidad ausente, no solo diseño |

## 1.4 Estados del workspace (shell + árbol)

| # | Estado | Componente | Estado |
|---|---|---|---|
| 22 | **Workspace sin documento abierto** | `app/WorkspaceEmptyState.tsx` — un `h2` y una frase | **F** — 2 líneas de texto en un `<main>` de 100 % de alto; sin ilustración, sin llamada a la acción, sin atajo para crear |
| 23 | Barra lateral desplegada | `AppShell` `w-64` (16 rem) | R |
| 24 | Barra lateral plegada | `AppShell` `w-14` (3,5 rem) con el árbol en `hidden` | **F** — plegada solo queda un botón de texto; no hay iconos ni forma de llegar a un documento |
| 25 | Árbol cargando | `WorkspaceTreeView` → «Cargando el árbol…» | F — texto plano, sin esqueleto |
| 26 | **Árbol vacío** | `WorkspaceTreeView`, `status === 'ready' && focusOrder.length === 0` → «Todavía no hay directorios ni documentos.» | **F** — el único camino es el botón «Nuevo en la raíz» al **pie** de la barra, que el texto no menciona |
| 27 | Árbol con error de carga | `status === 'error'` → solo el `<p role="alert">` del error; **no** se pinta el vacío ni un reintento | **F** — sin botón de reintentar |
| 28 | Árbol con datos | `TreeLevel` recursivo → `TreeNodeRow` | R |
| 29 | Nodo seleccionado | `[[role=treeitem][aria-selected=true]>&]:bg-blue-100` + `font-medium` + `text-blue-900` | R |
| 30 | Nodo enfocado | Contorno azul 2 px pintado en la fila interior vía variante arbitraria | R |
| 31 | **Carpeta vacía** (expandida, sin hijos) | `TreeNodeRow` no renderiza `role="group"`: el chevron gira y **no aparece nada** | **A** — no hay «esta carpeta está vacía»; visualmente es idéntico a un fallo de carga |
| 32 | Mutación en vuelo | `busy` → todos los `RowActionButton` y «Nuevo en la raíz» con `disabled` + `opacity-40`/`opacity-50` | R |
| 33 | Error de mutación | `<p role="alert" tabIndex={-1}>` **encima** del árbol, que recibe el foco (AC‑29 de la spec 002) | R |
| 34 | Cabecera con sesión | `AppShell`: h1, correo, enlace «Seguridad», botón «Cerrar sesión» | F — el correo es texto plano; no hay menú de cuenta ni avatar |

## 1.5 Diálogos del árbol

Los cuatro comparten `features/workspace/ModalDialog.tsx` (capa `bg-slate-900/40`, caja
`max-w-sm`, foco atrapado, `Escape`, foco devuelto al disparador).

| # | Diálogo | Componente | Estados propios | Estado |
|---|---|---|---|---|
| 35 | **Crear carpeta / documento** | `CreateNodeForm` | Reposo · ocupado (`fieldset disabled`) · tipo directorio/documento (radios) · la etiqueta del campo cambia entre «Nombre» y «Título» | R |
| 36 | **Renombrar** | `RenameNodeDialog` | Reposo (precargado con el nombre actual) · ocupado | R |
| 37 | **Mover** | `MoveNodeDialog` | Reposo · ocupado · destinos filtrados (ni él ni sus descendientes) · opción «Raíz» | R |
| 38 | **Confirmar borrado — vacío** | `ConfirmDeleteDialog` con `contentCount === 0` | Pregunta + «Esta acción no se puede deshacer.» | R |
| 39 | **Confirmar borrado — no vacío** | `ConfirmDeleteDialog` con `contentCount > 0` | Añade un párrafo `text-red-800` con el recuento y singular/plural | R |
| 40 | Error dentro de un diálogo | — | **A**: `runMutation` **cierra el diálogo pase lo que pase** y el error aparece detrás, en el árbol. No existe el estado «diálogo con error» | **A** |
| 41 | Validación del nombre en diálogo | — | **A**: solo `required` del navegador; la normalización y las colisiones las decide el servidor y vuelven como error del árbol | **A** |

## 1.6 Estados del editor

Todo en `features/editor/DocumentEditorPage.tsx`, cruce de `LoadState` (4 valores) ×
`SaveStatus` (6 valores) × `ViewMode` (3 valores).

| # | Estado | Qué se pinta | Estado |
|---|---|---|---|
| 42 | Documento cargando | `<p role="status" aria-label="Carga del documento">` «Cargando el documento…» | F |
| 43 | **Modo texto** | Breadcrumb + h2 + tablist + paleta + `<textarea>` `min-h-96` `font-mono text-sm` | R |
| 44 | **Modo vista previa** | El mismo encabezado, sin paleta ni controles de historial, `MarkdownPreview` en un `tabpanel` con `tabIndex={0}` | R |
| 45 | **Modo dividido** | `grid md:grid-cols-2` con dos `<section>` (`aria-label="Texto"` / `"Vista previa"`) y ancho de página `max-w-6xl` en vez de `max-w-3xl` | R |
| 46 | Modo dividido por debajo de 768 px | El `md:` no aplica: los paneles **se apilan** en vertical | **F** — sin declarar en la spec; el 50/50 solo existe a partir de `md` |
| 47 | Documento borrado / 404 | `<p role="alert">` «Este documento ya no existe.» + recarga del árbol | F — sin acción de vuelta |
| 48 | Error de carga del documento | El mismo `<p role="alert">` con el mensaje traducido | F |
| 49 | Guardado limpio | `SaveStatus` `role="status"` → «Guardado» | R |
| 50 | Cambios sin guardar | «Cambios sin guardar» | R |
| 51 | Guardando | «Guardando…» | R |
| 52 | **Error de guardado por servidor** (`rejected`: 400/404/413/429) | `role="status"` «Sin guardar» + `role="alert"` rojo con el mensaje del servidor | R |
| 53 | **Error de guardado por red** (`unreachable`: red caída, 5xx, cuerpo inválido) | Igual, con `UNREACHABLE_SAVE_MESSAGE` — deliberadamente distinto de cualquier mensaje del servidor | R |
| 54 | **Conflicto de guardado** | `ConflictDialog` modal: «El documento cambió mientras lo editabas», «Descartar mis cambios» / «Conservar mi versión» | R |
| 55 | Conflicto con el diálogo descartado | El `role="alert"` gana un botón enlace «Resolver el conflicto» que vuelve a abrirlo | R |
| 56 | Contador de caracteres cerca del límite | Aparece al 90 % de `MAX_DOCUMENT_CONTENT_CHARS`: «Quedan N caracteres» | R |
| 57 | Contador por encima del límite | «Te sobran N caracteres» en `text-red-700` | **F** — el color es la única diferencia entre las dos frases (el texto también cambia, así que no incumple 1.4.1, pero no hay icono ni cambio de peso) |
| 58 | Deshacer/rehacer disponibles | Dos botones `min-h-9 min-w-9` con `aria-label` que incluye el atajo | R |
| 59 | **Deshacer sin historial** | `disabled` real (no `aria-disabled`) + `border-slate-200` + `text-slate-400` | R |
| 60 | Salida con cambios pendientes | `beforeunload` registrado solo mientras `unsaved` | R |

## 1.7 Estados de la tira de pestañas

`features/editor/DocumentTabs.tsx`, montada en el `AppShell` (sobrevive al cambio de documento).

| # | Estado | Qué se pinta | Estado |
|---|---|---|---|
| 61 | Sin pestañas abiertas | La tira **no se pinta**; queda solo la región viva `sr-only` | R |
| 62 | Pestaña activa | `border-b-2 border-blue-700 bg-white text-slate-900` | R |
| 63 | Pestaña inactiva | `border-transparent text-slate-600 hover:bg-slate-200` | R |
| 64 | Pestaña con cambios sin guardar | Punto `●` azul `aria-hidden` **y** «· sin guardar» en el nombre accesible | R |
| 65 | Pestaña cuyo título el árbol aún no conoce | «Documento sin título» | R |
| 66 | Muchas pestañas | `overflow-x-auto` en la tira; cada pestaña `max-w-56` con `truncate` | **F** — barra de desplazamiento nativa, sin flechas ni indicador de desbordamiento |
| 67 | Cierre de pestaña anunciado | Región viva propia: «Cerrada: X» | R |
| 68 | Cierre bloqueado por guardado fallido | `closeTab` devuelve `closed: false`; la pestaña **se queda** | **F** — no se anuncia nada ni cambia el aspecto: desde fuera parece que el clic no hizo nada |

## 1.8 Estados globales que faltan por completo

| Estado | Situación |
|---|---|
| Modo oscuro | **A** — cero variantes `dark:` en todo `src` |
| Movimiento reducido | **A** — cero `motion-reduce:` / `prefers-reduced-motion`, con dos transiciones declaradas |
| Diseño móvil | **A** — un solo punto de ruptura (`md:`) usado **una vez**; la barra lateral es `w-64` fija a cualquier ancho |
| Sistema de avisos efímeros (toast) | **A** — todo aviso es un bloque en el flujo que empuja el contenido |
| Marca / identidad | **A** — no hay logotipo, favicon propio ni tipografía elegida (`ui-sans-serif`) |
| Pantalla de carga inicial | **A** — entre el `bootstrap()` y el primer render no hay nada |

---

# 2. Inventario de componentes

## 2.1 Reutilizables de verdad (con más de un consumidor)

| Componente | Archivo | Variantes | Estados cubiertos | Foco visible |
|---|---|---|---|---|
| `AuthField` | `features/auth/AuthField.tsx` | 3 tipos (`email`/`password`/`text`), con/sin `hint`, con/sin `problem`, con/sin `autoFocus` | reposo · foco · error (`aria-invalid:border-red-600`) | **Propio** — `focus:border-blue-700` + `ring-2 ring-blue-700/40`. Sin estado deshabilitado ni de carga |
| `AuthFormError` | `features/auth/AuthFormError.tsx` | 1 | visible/oculto · enfocado programáticamente | **Propio** — `focus:ring-2 ring-red-700/50` (`focus:` a propósito, el foco es programático) |
| `AuthSubmitButton` | `features/auth/AuthPageLayout.tsx` | 1 (primario, ancho completo) | reposo · hover · foco · ocupado/deshabilitado | **Propio** — `focus-visible:ring-2` + `ring-offset-2` |
| `AuthPageLayout` | `features/auth/AuthPageLayout.tsx` | con/sin `footer` | — | n/a |
| `ModalDialog` | `features/workspace/ModalDialog.tsx` | 1 | montado (foco atrapado) · `Escape` · foco devuelto | Depende de los hijos |
| `DIALOG_*_CLASS` | `ModalDialog.tsx` | **3 variantes**: `SECONDARY` (borde), `PRIMARY` (azul), `DANGER` (rojo) | reposo · hover · foco · deshabilitado (`opacity-50` + `cursor-not-allowed`) | **Propio** — `focus-visible:outline-2 outline-offset-2 outline-blue-700`. El `DANGER` usa **anillo azul**, no rojo |
| `DialogActions` | `ModalDialog.tsx` | 1 | — | n/a |
| `TreeNodeRow` | `features/workspace/TreeNodeRow.tsx` | directorio (4 botones) / documento (3 botones) | reposo · hover · seleccionado · enfocado · ocupado | **Propio** — contorno pintado en la fila interior con variante arbitraria, porque el `treeitem` lleva `outline-none` |
| `RowActionButton` | `TreeNodeRow.tsx` | 4 iconos (nuevo, renombrar, mover, borrar) | reposo · hover · foco · deshabilitado (`opacity-40`) | **Propio** — `outline-solid` obligatorio para vencer la herencia de `outline-none` |
| `SaveStatus` | `features/editor/SaveStatus.tsx` | 6 valores de estado · con/sin error · con/sin botón de conflicto | los 6 | El botón interno: **propio** (`ring-red-700/50`) |
| `MarkdownPreview` | `features/editor/MarkdownPreview.tsx` | 1 | — (no tiene estado vacío: markdown vacío = div vacío) | n/a |
| `MarkdownPalette` | `features/editor/MarkdownPalette.tsx` | 16 botones en 3 grupos | reposo · hover · foco (roving tabindex) | **Propio** — `outline-2 outline-offset-2 outline-blue-700` |
| `DocumentTabs` | `features/editor/DocumentTabs.tsx` | activa / inactiva × sucia / limpia | reposo · hover · foco · seleccionada · sucia | **Propio** — `focus-visible:-outline-offset-2` (hacia dentro, por el desbordamiento) |

## 2.2 Controles definidos en línea (sin componente que los agrupe)

Estos son botones e inputs con clases escritas a mano, no reutilizables. Cada uno es una copia
que hay que mantener.

| Control | Archivo:línea | Clases de estado | Foco visible |
|---|---|---|---|
| Botón de plegar la barra lateral | `app/AppShell.tsx:32` | solo `hover:bg-slate-200` | **Heredado del navegador** — no hay ni `focus:` ni `focus-visible:` |
| Enlace «Seguridad» | `AppShell.tsx:55` | `hover:text-blue-900` | **Propio** — `focus-visible:ring-2` |
| Botón «Cerrar sesión» | `AppShell.tsx:65` | `hover:bg-slate-100` | **Propio** — `focus-visible:ring-2` |
| Botón «Nuevo en la raíz» | `WorkspaceTreeView.tsx:356` | hover · `disabled:opacity-50` | **Propio** — `outline-2` |
| `<p role="alert">` del árbol | `WorkspaceTreeView.tsx:310` | — | **Propio** — `focus:outline-2 -outline-offset-2 outline-red-700` |
| Input de texto de los diálogos | `CreateNodeForm.tsx:91`, `RenameNodeDialog.tsx:56` | `focus:border-blue-700 focus:ring-2` | **Propio** (duplicado literal en dos archivos) |
| `<select>` de destino | `MoveNodeDialog.tsx:86` | igual que el input | **Propio** (tercera copia de la misma cadena) |
| **Radios de tipo** | `CreateNodeForm.tsx:68` | solo `size-4` | **Heredado del navegador** |
| `<textarea>` del editor | `DocumentEditorPage.tsx:433` | `resize-none` | **Propio** — `outline-2` |
| Pestañas del conmutador de vista | `DocumentEditorPage.tsx:493` | seleccionada `bg-blue-700 text-white` / inactiva `hover:bg-slate-100` | **Propio** — `outline-2` |
| Botones Deshacer / Rehacer | `DocumentEditorPage.tsx:534` | hover · `disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent` | **Propio** — `outline-2` |
| Botón «Guardar» | `DocumentEditorPage.tsx:547` | hover | **Propio** — `outline-2`. **Sin estado de carga ni deshabilitado**, a diferencia de los de historial |
| `role="tabpanel"` de la vista previa | `DocumentEditorPage.tsx:585` | — | **Propio** — `outline-2` (es enfocable para poder leerlo con teclado) |
| Botón «Entrar con otra cuenta» | `MfaChallengeForm.tsx:52` | `hover:text-slate-900` | **Propio** — `ring-2` |
| Botón «Activar verificación en dos pasos» | `SecurityPage.tsx:157` | copia literal de `AuthSubmitButton` sin el `w-full` | **Propio** — `ring-2` |
| Enlaces de pie de auth («Crear una cuenta», «Iniciar sesión») | `LoginPage.tsx:38`, `RegisterPage.tsx:65` | `hover:text-blue-900` | **Heredado del navegador** |
| Enlace «Volver al workspace» | `SecurityPage.tsx:117` | `hover:text-blue-900` | **Heredado del navegador** |
| Enlace «Volver al inicio» | `NotFoundPage.tsx:9` | `hover:text-blue-900` | **Heredado del navegador** |
| Región viva de pestañas (enfocable) | `DocumentTabs.tsx:354` | `sr-only` | **Ninguno** — recibe el foco al cerrar la última pestaña y es invisible |
| «×» de cerrar pestaña | `DocumentTabs.tsx:317` | `hover:bg-slate-300` | No enfocable (es un `<span>`; se cierra con `Supr`) |

## 2.3 Recuento de la deuda de componentes

| Métrica | Valor |
|---|---|
| Componentes reutilizables reales | **13** |
| Controles interactivos definidos en línea | **20** |
| **Sistemas de anillo de foco distintos** | **2** — `ring-2 ring-<color>/<alpha>` (10 sitios) vs `outline-2 outline-offset-2` (11 sitios) |
| Controles con foco **heredado del navegador** | **6** (plegar barra lateral, radios, 4 enlaces) |
| Variantes de botón declaradas | 3 en diálogos (`SECONDARY`/`PRIMARY`/`DANGER`) + 5 formas distintas en línea sin nombre |
| Componentes con estado de carga propio | **2** (`AuthSubmitButton`, botón de activar MFA); el botón «Guardar» del editor **no** |
| Componentes con estado deshabilitado | 8 |
| Componentes con estado de error propio | 3 (`AuthField`, `AuthFormError`, `SaveStatus`) |
| Iconos | **22 en total**, todos SVG en línea escritos a mano: 16 en `MarkdownPalette.tsx` (`ICONS`) + 6 en `TreeNodeRow.tsx` (chevron, documento y los 4 trazos de acción). **Ninguna librería, ningún componente `<Icon>`** |
| Grosores de trazo de icono | 2 sistemas: `stroke-width 1.4` + `fill: none` (paleta) vs `fill-current` sin trazo (árbol) |

---

# 3. Inventario de valores crudos

Extraído de las clases de `apps/web/src/**/*.tsx` y verificado contra el CSS compilado
(`dist/assets/index-CJdNEXA4.css`). Los hex son la conversión sRGB de los `oklch()` que Tailwind 4
emite de verdad.

## 3.1 Colores — **30 valores distintos**

### Escala neutra (`slate`) — 10 tonos

| Clase | oklch emitido | Hex | Usos |
|---|---|---|---|
| `slate-50` | `oklch(98.4% .003 247.858)` | `#f8fafc` | 2 — fondo de la barra lateral, `<th>` del preview |
| `slate-100` | `oklch(96.8% .007 247.896)` | `#f1f5f9` | 13 — fondo de páginas de auth, hover, `<code>`, píldoras de código |
| `slate-200` | `oklch(92.9% .013 255.508)` | `#e2e8f0` | 15 — el borde por defecto de todo |
| `slate-300` | `oklch(86.9% .022 252.894)` | `#cad5e2` | 12 — borde de controles, hover de iconos, filete de cita |
| `slate-400` | `oklch(70.4% .04 256.788)` | `#90a1b9` | 2 — icono de documento, fondo de botón deshabilitado |
| `slate-500` | `oklch(55.4% .046 257.417)` | `#62748e` | 10 — texto terciario, iconos de acción, breadcrumb |
| `slate-600` | `oklch(44.6% .043 257.281)` | `#45556c` | 16 — texto secundario |
| `slate-700` | `oklch(37.2% .044 257.287)` | `#314158` | 11 — texto de botón secundario |
| `slate-800` | `oklch(27.9% .041 260.031)` | `#1d293d` | 7 — etiquetas de formulario, cuerpo del preview |
| `slate-900` | `oklch(20.8% .042 265.755)` | `#0f172b` | 21 — texto principal, fondo de `<pre>`, velo del modal (`/40`) |

**Diez tonos de gris en un producto de una sola pantalla.** `slate-600`, `slate-700` y `slate-800`
conviven como «texto secundario» sin una regla que los distinga.

### Escala de acción (`blue`) — 4 tonos

| Clase | Hex | Usos |
|---|---|---|
| `blue-100` | `#dbeafe` | 1 — fondo de nodo seleccionado |
| `blue-700` | `#1447e6` | **~32** — es a la vez contorno de foco (11), texto de enlace (7), anillo de foco (9 entre `/50` y `/40`), fondo de botón primario (4) y borde de pestaña activa (5) |
| `blue-800` | `#193cb8` | 3 — hover del primario |
| `blue-900` | `#1c398e` | 6 — hover de enlace, texto de nodo seleccionado |

### Escala de error (`red`) — 6 tonos

`red-50` `#fef2f2` (4 fondos) · `red-300` `#ffa2a2` (4 bordes) · `red-600` `#e7000b`
(1, `aria-invalid`) · `red-700` `#c10007` (2 texto, 1 fondo, 1 contorno) · `red-800` `#9f0712`
(5 texto, 1 hover) · `red-900` `#82181a` (1 texto).

Seis tonos de rojo para un solo significado. `red-600` aparece **una vez** (borde de campo
inválido) y no coincide con `red-300`, que es el borde de los bloques de error.

### Escala de aviso (`amber`) — 3 tonos

`amber-50` `#fffbeb` · `amber-300` `#ffd230` · `amber-900` `#7b3306`. Los tres aparecen **una sola
vez cada uno**, en el aviso de los códigos de recuperación (`SecurityPage.tsx:220`). Es el único
amarillo del producto y no forma parte de ningún sistema.

### Palabras clave y transparencias

`white` (11 fondos, 5 textos) · `transparent` (1 borde, 2 fondos) · `currentColor` (3 rellenos de
SVG) · `slate-900/40` (velo modal) · `blue-700/50` (anillo de foco A) · `blue-700/40` (anillo de
foco de inputs) · `red-700/50` (anillo de foco de error).

> **Dos opacidades distintas —`/40` y `/50`— para el mismo anillo azul**, según si el control es un
> input (`focus:ring-blue-700/40`) o un botón (`focus-visible:ring-blue-700/50`).

## 3.2 Tipografía

**Familias — 2** (`src/index.css`):

| Token | Valor |
|---|---|
| `--font-sans` | `ui-sans-serif, system-ui, sans-serif` |
| `--font-mono` | `ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace` |

No hay ninguna tipografía elegida ni cargada: el producto se ve distinto en cada sistema
operativo.

**Tamaños — 7 distintos** (6 de escala + 1 arbitrario):

| Clase | rem | px | Usos |
|---|---|---|---|
| `text-xs` | 0.75 | 12 | 2 |
| `text-sm` | 0.875 | 14 | **47** |
| `text-base` | 1 | 16 | 7 |
| `text-lg` | 1.125 | 18 | 2 |
| `text-xl` | 1.25 | 20 | 4 |
| `text-2xl` | 1.5 | 24 | 1 |
| `text-[0.9em]` | relativo | — | 1 (`<code>` del preview) |

`text-sm` (14 px) es el tamaño de **casi toda la interfaz**, incluido el cuerpo del editor. No hay
ningún tamaño por encima de 24 px: el `h1` de la aplicación (`AppShell`) es `text-lg`, 18 px, más
pequeño que el `h1` de las páginas de auth (`text-xl`, 20 px).

Fuera de la escala CSS, los SVG llevan `fontSize="11"` y `fontSize="6"` en unidades de `viewBox`
(`MarkdownPalette.tsx`).

**Pesos — 2 declarados**: `font-medium` (500, 27 usos) y `font-semibold` (600, 9 usos). El reset
aporta `bolder` para `<strong>`/`<b>`, y los glifos de la paleta usan `fontWeight="700"` en SVG.
**No hay `font-normal` ni `font-bold` explícitos en ninguna parte.**

**Interlineados — 7 valores computados**: los 6 implícitos de la escala (`calc(1/.75)`,
`calc(1.25/.875)`, `calc(1.5/1)`, `calc(1.75/1.125)`, `calc(1.75/1.25)`, `calc(2/1.5)`) más
`leading-relaxed` (1.625), usado **una vez**, en los `<p>` del preview. El `<textarea>` del editor
no declara interlineado: hereda el de `text-sm`, 1.4286.

## 3.3 Radios — **3 valores** ✔

| Clase | Valor | Usos |
|---|---|---|
| `rounded` | `0.25rem` (4 px) | 15 |
| `rounded-md` | `0.375rem` (6 px) | 16 |
| `rounded-lg` | `0.5rem` (8 px) | 3 |

Es el **único eje sano del inventario**. La distinción entre 4 px y 6 px, sin embargo, no responde
a ninguna regla legible: `rounded` va en iconos, píldoras y el `<textarea>`; `rounded-md` en
botones e inputs; y ambos aparecen en el mismo componente (`SecurityPage`).

## 3.4 Sombras — **2 valores**

| Clase | Valor emitido | Usos |
|---|---|---|
| `shadow-sm` | `0 1px 3px 0 #0000001a, 0 1px 2px -1px #0000001a` | 2 (tarjeta de auth, tarjeta de seguridad) |
| `shadow-xl` | `0 20px 25px -5px #0000001a, 0 8px 10px -6px #0000001a` | 1 (modal) |

No hay escala intermedia: se salta de la sombra más suave a la penúltima más fuerte. Las
elevaciones de la aplicación —cabecera, barra lateral, tira de pestañas— se resuelven **solo con
bordes**, sin sombra.

## 3.5 Anchos de borde y contorno — **6 valores**

| Familia | Valores distintos | Detalle |
|---|---|---|
| `border-*` | **3** | 1 px (21 usos de `border` + 6 de lados), 2 px (`border-b-2`, pestaña activa), 4 px (`border-l-4`, cita del preview) |
| `outline-*` | **2** | `outline-0` (11 usos, con `outline-solid` 13 veces para vencer la herencia de Tailwind 4) y `outline-2` (12 usos) |
| `ring-*` | **1** | `ring-2` (11 usos) |
| Desplazamientos | **2 magnitudes, 3 formas** | `outline-offset-2` (12), `-outline-offset-2` (4, hacia dentro), `ring-offset-2` (2) |

**14 usos de `outline-none`** frente a 13 de `outline-solid`: la mitad del código existe para
apagar el contorno y la otra mitad para volver a encenderlo.

## 3.6 Espaciado — **13 pasos distintos**

Base `--spacing: 0.25rem` (4 px).

| Paso | px | Aparece en |
|---|---|---|
| `0` | 0 | `p-0` |
| `px` | 1 | `gap-px` (separación entre pestañas) |
| `0.5` | 2 | `p-0.5`, `py-0.5`, `gap-0.5` |
| `1` | 4 | `p-1`, `px-1`, `py-1` (14), `mt-1`, `mb-1`, `gap-1` (6), `pr-1`, `pl-1`, `my-1` |
| `1.5` | 6 | `py-1.5`, `gap-1.5`, `mx-1.5` |
| `2` | 8 | `p-2`, `px-2` (10), `py-2` (11), `m-2`, `mt-2`, `mb-2`, `gap-2` |
| `3` | 12 | `px-3` (15), `mb-3`, `mt-3`, `my-3` (6), `pb-3`, `gap-3` |
| `4` | 16 | `p-4`, `px-4`, `py-4`, `pt-4`, `pl-4`, `mt-4`, `mb-4` (6), `gap-4` |
| `5` | 20 | `mt-5` (1 uso) |
| `6` | 24 | `p-6`, `px-6`, `py-6`, `pl-6`, `ml-6`, `mt-6` (5), `mb-6`, `my-6` |
| `8` | 32 | `mt-8` (1 uso) |
| `10` | 40 | `py-10` (1 uso) |
| `12` | 48 | `py-12` (1 uso) |

Trece pasos para una escala de la que **cuatro se usan una sola vez** (5, 8, 10, 12). Los pares
`py-1`/`py-1.5`/`py-2` conviven en controles del mismo rango sin criterio.

Hay además **un cálculo de espaciado en línea, fuera de Tailwind**: la sangría del árbol,
`paddingInlineStart: ${0.25 + (node.level - 1) * 0.75}rem` (`TreeNodeRow.tsx:57`) — 4 px de base
más 12 px por nivel.

## 3.7 Tamaños de caja

**Alturas mínimas de control — 4 valores distintos**, sin regla:

| Clase | px | Dónde |
|---|---|---|
| `min-h-8` | 32 | Pestañas del conmutador de vista, «Nuevo en la raíz», fila del árbol |
| `min-h-9` | 36 | «Cerrar sesión», Deshacer/Rehacer, «Guardar», botones de diálogo |
| `min-h-10` | 40 | Inputs y `<select>` de los diálogos |
| `min-h-11` | 44 | `AuthField`, `AuthSubmitButton`, botones de MFA |

El mismo gesto —«pulsar un botón»— mide 32, 36 o 44 px según en qué pantalla esté.

**Tamaños cuadrados (iconos y objetivos) — 4**: `size-3.5` (14 px, trazos de icono),
`size-4` (16 px, radios y glifos), `size-6` (24 px, botones de acción del árbol y «×» de pestaña),
`size-8` (32 px, botones de la paleta).

**Anchos máximos — 8**: `max-w-sm` (24 rem), `max-w-xl` (36 rem), `max-w-3xl` (48 rem),
`max-w-6xl` (72 rem), `max-w-56` (14 rem), `max-w-prose` (65ch), `max-w-full`, `max-w-none`.
Cuatro anchos de contenedor distintos para cuatro pantallas.

**Anchos fijos — 2**: `w-64` (16 rem, barra lateral) y `w-14` (3,5 rem, barra plegada).

**Alturas mínimas de layout**: `min-h-0` (8 usos, para que funcione el `flex`),
`min-h-screen` (4), `min-h-96` (24 rem, el `<textarea>`).

## 3.8 Movimiento — **1 duración, 1 curva**

| Valor | Origen |
|---|---|
| Duración | `0.15s` — `--default-transition-duration`, nunca sobrescrita |
| Curva | `cubic-bezier(.4, 0, .2, 1)` — `--default-transition-timing-function`, nunca sobrescrita |

Solo **dos** transiciones declaradas en todo el producto:
`transition-[width]` (la barra lateral al plegarse, `AppShell.tsx:23`) y `transition-transform`
(el chevron del árbol al girar, `TreeNodeRow.tsx:171`).

**Cero animaciones** (`animate-*`), **cero retardos** (`delay-*`), **cero respeto a
`prefers-reduced-motion`**.

## 3.9 z-index — **1 valor**

`z-50`, en la capa de `ModalDialog`. Nada más apila. No hay contexto de apilamiento declarado en
ninguna otra parte, así que la tira de pestañas, la cabecera y la barra lateral dependen del orden
del documento.

## 3.10 Puntos de ruptura — **1**

`md:` (768 px), usado **una sola vez**: `md:grid-cols-2` en la vista dividida
(`DocumentEditorPage.tsx:596`). El resto del producto no tiene diseño adaptativo.

## 3.11 Resumen de la deuda

| Eje | Distintos | Un sistema sano |
|---|---|---|
| Colores | **30** | 12–16 |
| Tonos de gris | **10** | 5–7 |
| Tamaños de fuente | **7** | 6–8 ✔ |
| Familias tipográficas | **2** | 2 ✔ |
| Pesos | **2** (+2 heredados) | 3–4 |
| Interlineados | **7** | 3–4 |
| **Radios** | **3** | 4–6 ✔ |
| Sombras | **2** | 3–5 |
| Anchos de borde/contorno | **6** | 2–3 |
| Pasos de espaciado | **13** | 8–10 |
| Alturas de control | **4** | 2–3 |
| Anchos de contenedor | **8** | 3–4 |
| Duraciones | **1** | 3–4 |
| Curvas | **1** | 2–3 |
| z-index | **1** | 4–6 |
| Puntos de ruptura | **1** | 3–4 |
| **Sistemas de foco** | **2** | 1 |

La deuda no está donde se esperaría. **Los radios están bien**; lo que está mal es el color (30
valores, 10 grises), el espaciado (13 pasos), la altura de los controles (4 valores para el mismo
gesto) y el foco (dos sistemas incompatibles). Y hay ejes con la deuda **contraria**: una sola
duración, una sola curva, un solo z-index y un solo punto de ruptura no son señal de disciplina
sino de que el eje **no existe todavía**.

---

# 4. Inventario de microcopy

Todo el texto de interfaz del producto, en un solo sitio. La UI es **solo en español**; no hay
ninguna infraestructura de internacionalización: cada cadena está incrustada en su componente.

## 4.1 Shell y navegación

| Texto | Tipo | Archivo |
|---|---|---|
| `One Markdown` | h1 | `AppShell.tsx:48` |
| `Árbol de documentos` | aria-label (`<nav>`) | `AppShell.tsx:22` |
| `Mostrar barra lateral` / `Ocultar barra lateral` | botón (alterna) | `AppShell.tsx:34` |
| `Seguridad` | enlace | `AppShell.tsx:58` |
| `Cerrar sesión` | botón | `AppShell.tsx:67` |

## 4.2 Login

| Texto | Tipo |
|---|---|
| `Iniciar sesión` | h1 |
| `Correo electrónico` | etiqueta |
| `Contraseña` | etiqueta |
| `Entrar` | botón |
| `¿Todavía no tienes cuenta?` | pie |
| `Crear una cuenta` | enlace |

## 4.3 Verificación en dos pasos (login)

| Texto | Tipo |
|---|---|
| `Tu cuenta tiene verificación en dos pasos. Escribe el código de tu app de autenticación.` | ayuda |
| `Código de verificación` | etiqueta |
| `6 dígitos, o uno de tus códigos de recuperación.` | ayuda del campo |
| `Verificar` | botón |
| `Entrar con otra cuenta` | botón secundario |

## 4.4 Registro

| Texto | Tipo |
|---|---|
| `Crear cuenta` | h1 y botón |
| `Correo electrónico` / `Contraseña` / `Nombre (opcional)` | etiquetas |
| `La contraseña debe tener al menos 12 caracteres e incluir una letra y un número.` | ayuda **y** error |
| `No cumple las reglas indicadas.` | error del campo |
| `¿Ya tienes cuenta?` + `Iniciar sesión` | pie + enlace |

## 4.5 Seguridad de la cuenta

| Texto | Tipo |
|---|---|
| `Seguridad de la cuenta` | h1 |
| `Verificación en dos pasos: activada` / `: desactivada` | `role="status"` |
| `Verificación en dos pasos` | h2 |
| `Añade un código de tu app de autenticación (Google Authenticator, 1Password, Aegis) al iniciar sesión.` | ayuda |
| `Activar verificación en dos pasos` | botón |
| `Escanea el código` | h2 |
| `Código QR para añadir esta cuenta a tu app de autenticación` | **alt de imagen** |
| `Si no puedes escanearlo, escribe esta clave en tu app:` | ayuda |
| `Los 6 dígitos que muestra tu app ahora mismo.` | ayuda del campo |
| `Confirmar` | botón |
| `Códigos de recuperación` | h2 |
| `Guárdalos ahora en un lugar seguro: **no volverás a verlos**. Cada uno sirve una sola vez para entrar si pierdes el teléfono.` | `role="alert"` |
| `Desactivar la verificación` | h2 |
| `Se borrarán tu clave TOTP y tus códigos de recuperación, y se cerrarán tus otras sesiones.` | ayuda |
| `Desactivar verificación en dos pasos` | botón |
| `Volver al workspace` | enlace |

## 4.6 Errores de autenticación

Producidos por `features/auth/auth.errors.ts` y `auth.store.ts`.

| Texto | Cuándo |
|---|---|
| `Ocurrió un error inesperado. Inténtalo de nuevo.` | Cualquier fallo que no sea `ApiError` |
| `No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.` | `statusCode === 0` |
| `Demasiados intentos. Vuelve a probar en N segundos.` / `en 1 minuto.` / `en N minutos.` | `429` con `retryAfterSeconds` |
| `La API pidió segundo factor sin entregar un token.` | Contrato roto |
| `La API no devolvió sesión ni pidió segundo factor.` | Contrato roto |
| `La verificación caducó. Vuelve a iniciar sesión.` | `verifyMfa` sin `pendingMfa` |
| `Comprobando tu sesión…` | `RequireAuth` mientras `status` es `unknown`/`authenticating` |

**Reenviados tal cual desde el backend** (no se traducen en el cliente):
`Credenciales inválidas` · `Demasiados intentos fallidos. Vuelve a intentarlo más tarde.` ·
`Demasiadas peticiones desde esta dirección. Inténtalo de nuevo en unos instantes.`

## 4.7 Árbol de documentos

| Texto | Tipo |
|---|---|
| `Documentos` | aria-label del `role="tree"` |
| `Cargando el árbol…` | estado de carga |
| `Todavía no hay directorios ni documentos.` | **estado vacío** |
| `Nuevo en la raíz` | botón |
| `Nuevo en «{nombre}»` | aria-label + title del botón de fila |
| `Renombrar «{nombre}»` | aria-label + title |
| `Mover «{nombre}»` | aria-label + title |
| `Borrar «{nombre}»` | aria-label + title |

## 4.8 Diálogos del árbol

| Diálogo | Título | Cuerpo | Acciones |
|---|---|---|---|
| Crear | `Nuevo en la raíz` / `Nuevo en «{padre}»` | legend `Tipo`; radios `Directorio` / `Documento`; etiqueta `Nombre` (directorio) o `Título` (documento) | `Cancelar` · `Crear` |
| Renombrar | `Renombrar «{nombre}»` | etiqueta `Nombre` / `Título` | `Cancelar` · `Guardar` |
| Mover | `Mover «{nombre}»` | etiqueta `Destino`; opción `Raíz` | `Cancelar` · `Mover` |
| Borrar | `Borrar «{nombre}»` | `¿Seguro que quieres borrar «{nombre}»?` · `También se borrará su contenido: {n} elemento` / `elementos.` · `Esta acción no se puede deshacer.` | `Cancelar` · `Borrar` |

## 4.9 Editor

| Texto | Tipo |
|---|---|
| `Cargando el documento…` | `role="status"`, aria-label `Carga del documento` |
| `Este documento ya no existe.` | `role="alert"` |
| `Ruta del documento` | aria-label del breadcrumb |
| `Modo de vista` | aria-label del `role="tablist"` |
| `Texto` · `Vista previa` · `Dividida` | rótulos de las tres pestañas |
| `Contenido de «{título}» en markdown` | **aria-label del `<textarea>`** |
| `Texto` / `Vista previa` | aria-label de las dos `<section>` en modo dividido |
| `Quedan {n} caracteres` / `Te sobran {n} caracteres` | contador (a partir del 90 % del límite) |
| `Deshacer` / `Rehacer` | rótulo visible |
| `Deshacer · Ctrl+Z` / `Rehacer · Ctrl+Shift+Z` | **aria-label** — el atajo va en el nombre accesible |
| `Guardar` | botón |
| `Estado del guardado` | aria-label de la región viva |
| `Guardado` · `Cambios sin guardar` · `Guardando…` · `Sin guardar` | los 4 rótulos de los 6 estados (los tres fallos comparten «Sin guardar») |
| `No se pudo contactar con el servidor. Tus cambios siguen aquí; se reintentarán cuando sigas escribiendo.` | `UNREACHABLE_SAVE_MESSAGE` |
| `Resolver el conflicto` | botón dentro del `role="alert"` |
| `Ningún documento abierto` + `Selecciona un documento en la barra lateral para verlo aquí.` | estado vacío del workspace |
| `404 — página no encontrada` + `La ruta que intentaste abrir no existe.` + `Volver al inicio` | 404 |

## 4.10 Diálogo de conflicto

| Texto | Tipo |
|---|---|
| `El documento cambió mientras lo editabas` | título |
| `Alguien guardó una versión distinta de este documento —otra pestaña, otro dispositivo— después de que tú empezaras a escribir. Tus cambios siguen aquí; elige con cuál te quedas.` | cuerpo |
| `Descartar mis cambios` | acción secundaria |
| `Conservar mi versión` | acción primaria (`data-autofocus`) |

Los botones se nombran por **lo que hacen**, nunca «Sí»/«No» — decisión declarada en
`ConflictDialog.tsx`.

## 4.11 Pestañas

| Texto | Tipo |
|---|---|
| `Documentos abiertos` | aria-label del `role="tablist"` |
| `«{título}» · sin guardar · Supr para cerrar` | **aria-label de cada pestaña** — el estado y el atajo van en palabras, no solo en el punto azul |
| `Documento sin título` | título de una pestaña cuyo documento el árbol aún no conoce |
| `Pestañas abiertas` | aria-label de la región viva |
| `Cerrada: {título}` | anuncio en la región viva |

## 4.12 Paleta de markdown

Región viva: aria-label `Elemento insertado`, contenido `Insertado: {rótulo}`.

Grupos (`aria-label` de cada `role="group"`): `Formato` · `Bloques de texto` · `Insertar`.

Los 16 elementos, con su rótulo (aria-label del botón) y su descripción (`title`):

| # | Rótulo | Descripción | Atajo |
|---|---|---|---|
| 1 | Negrita | Resalta el texto en negrita | Ctrl+B |
| 2 | Cursiva | Pone el texto en cursiva | Ctrl+I |
| 3 | Tachado | Tacha el texto | — |
| 4 | Código en línea | Marca un fragmento como código | — |
| 5 | Encabezado 1 | Título de primer nivel | — |
| 6 | Encabezado 2 | Título de segundo nivel | — |
| 7 | Encabezado 3 | Título de tercer nivel | — |
| 8 | Cita | Convierte la línea en una cita | — |
| 9 | Lista con viñetas | Convierte las líneas en una lista con viñetas | — |
| 10 | Lista numerada | Convierte las líneas en una lista numerada | — |
| 11 | Lista de tareas | Convierte las líneas en tareas por hacer | — |
| 12 | Enlace | Inserta un enlace | Ctrl+K |
| 13 | Imagen | Inserta una imagen | — |
| 14 | Bloque de código | Inserta un bloque de código | — |
| 15 | Tabla | Inserta una tabla de 3 columnas | — |
| 16 | Separador | Inserta una línea separadora | — |

**Microcopy que acaba dentro del documento de la persona** (marcadores de posición del catálogo,
`markdown-palette.ts`): `texto en negrita` · `texto en cursiva` · `texto tachado` · `código` ·
`Encabezado 1` / `2` / `3` · `Cita` · `Elemento de la lista` (viñetas y numerada) ·
`Tarea pendiente` · `texto del enlace` · `https://ejemplo.com` · `texto alternativo` ·
`https://ejemplo.com/imagen.png` · plantilla de tabla `| Encabezado 1 | Encabezado 2 | Encabezado 3 |`
con celdas `Celda`.

## 4.13 Textos de accesibilidad — recuento

| Tipo | Cantidad | Dónde |
|---|---|---|
| `aria-label` de región/landmark | 6 | «Árbol de documentos», «Documentos», «Modo de vista», «Documentos abiertos», «Elementos de markdown», «Ruta del documento» |
| `aria-label` de sección | 2 | «Texto» y «Vista previa», solo en modo dividido |
| `aria-label` de región viva | 4 | «Carga del documento», «Estado del guardado», «Elemento insertado», «Pestañas abiertas» |
| `aria-label` de control | 23 fijos + 1 por pestaña abierta | 16 de paleta + 4 de fila del árbol (plantillas con el nombre del nodo) + 2 de historial + el `<textarea>` |
| `alt` de imagen | 1 | El QR de MFA |
| `sr-only` | 1 | La región viva de `DocumentTabs` |
| `title` (tooltip nativo) | 20 | 16 de paleta + 4 de fila del árbol — **duplican el `aria-label`** |

**Cuatro regiones vivas** conviven en la página del editor en modo texto o dividido: carga,
guardado, paleta y pestañas. Todas llevan `aria-label` propio precisamente para poder
distinguirse.

## 4.14 Observaciones sobre el microcopy

- **No hay ninguna cadena centralizada.** Los rótulos viven repartidos por 26 archivos. Las
  excepciones son el catálogo de la paleta (`markdown-palette.ts`, declarado «contrato de
  producto» y con test que lo afirma entero) y los estados de guardado (`SaveStatus.tsx`).
- **Tres frases están duplicadas literalmente**: «No se pudo contactar con el servidor. Revisa tu
  conexión e inténtalo de nuevo.» aparece en `auth.errors.ts`, `workspace.store.ts` y
  `DocumentEditorPage.tsx`; «Ocurrió un error inesperado. Inténtalo de nuevo.» en los mismos tres;
  «6 dígitos, o uno de tus códigos de recuperación.» en `MfaChallengeForm.tsx` y `SecurityPage.tsx`.
- **El tuteo es consistente** en todo el producto («tu cuenta», «inténtalo», «elige»).
- **Los mensajes de dominio del backend se reenvían sin traducir**, por decisión declarada: ya
  vienen redactados en español.
- Los `title` nativos duplican 20 `aria-label`: un lector de pantalla no los lee dos veces, pero el
  tooltip aparece con retardo del sistema y no es alcanzable con teclado.

---

# 5. Contratos que el diseño no puede romper

Cada línea de esta sección está **especificada y testeada**. Un rediseño que la incumpla rompe
tests que hoy están verdes.

## 5.1 Estructura del editor

| # | Contrato | Origen | Test |
|---|---|---|---|
| C‑1 | **El editor es un `<textarea>` plano.** El modo texto contiene **un solo** control editable, sin `contenteditable`, sin editor enriquecido, sin resaltado de sintaxis | spec 003 AC‑23 | `DocumentEditorPage.test.tsx` |
| C‑2 | **La paleta solo se ve en modo texto y dividido.** Ausente en vista previa, y **una sola vez** en modo dividido (no una por columna) | spec 004 AC‑19, spec 005 AC‑18 | `DocumentEditorPage.test.tsx` |
| C‑3 | **La paleta va antes del panel en el DOM**, no dentro de la columna de texto: quien tabula la encuentra antes de entrar a escribir | spec 004 AC‑26 | `DocumentEditorPage.test.tsx` |
| C‑4 | **La vista dividida es del mismo documento**, con `<textarea>` y preview simultáneos, y el preview refleja el **borrador** (no lo guardado) | `CLAUDE.md`, spec 005 AC‑15/AC‑16, spec 003 AC‑24 | `DocumentEditorPage.test.tsx` |
| C‑5 | **La vista dividida es 50/50 lado a lado** (`grid-cols-2`, dos columnas iguales), verificado en Chromium real | spec 005 AC‑19 | `e2e/tabs.spec.ts` |
| C‑6 | **Un solo `role="tabpanel"`** también en modo dividido; dentro van dos `<section>` con nombre | spec 005, `plan.md` decisión 10 | `DocumentEditorPage.test.tsx` |
| C‑7 | El modo de vista es **por documento**, no por página: dos pestañas pueden estar en modos distintos y cada una lo conserva | spec 005 AC‑17 | `editor.store.test.ts` |
| C‑8 | El ancho de la página **es función del modo**: `max-w-3xl` en texto/preview, `max-w-6xl` en dividido | spec 005, `plan.md` decisión 9 | `e2e/tabs.spec.ts` |

## 5.2 Seguridad del preview

| # | Contrato | Origen | Test |
|---|---|---|---|
| C‑9 | **El preview va siempre sanitizado**, con cinco capas: `rehype-raw` **no instalado** · `rehypeRawAsText` antes del sanitizador · `rehype-sanitize` con el `defaultSchema` sin modificar · el `urlTransform` por defecto de `react-markdown` **sin sobrescribir** · **nunca** inyección de HTML en crudo | spec 003 AC‑25/AC‑26, spec 004 AC‑31 | `MarkdownPreview.test.tsx`, `no-dangerous-html.test.ts`, `e2e/editor.spec.ts` |
| C‑10 | El nombre completo del atributo de inyección de HTML de React **no se escribe en ninguna parte de `src/`**, ni en comentarios: el detector es una coincidencia literal | spec 003 | `no-dangerous-html.test.ts` |
| C‑11 | El estilo del preview se aplica con **variantes de descendiente** (`[&_h1]:…`), no con un `components` a medida ni un plugin de tipografía: cambiar eso amplía la superficie que hay que sanear | `MarkdownPreview.tsx` | — |

## 5.3 Accesibilidad

| # | Contrato | Origen | Test |
|---|---|---|---|
| C‑12 | **Objetivos de clic ≥ 24 × 24 px CSS** (WCAG 2.2 SC 2.5.8), medidos en Chromium real: botones de la paleta (32 px), pestañas y su «×» (24 px), Deshacer/Rehacer | spec 004 AC‑29, spec 005 AC‑34, spec 006 AC‑32 | `e2e/palette.spec.ts`, `e2e/tabs.spec.ts`, `e2e/undo.spec.ts` |
| C‑13 | **Recorrido completo por teclado**, sin un solo clic: abrir documento, recorrer la paleta con flechas (envolviendo por los dos extremos), insertar, cambiar de modo, recorrer y cerrar pestañas con `Supr` | spec 004 AC‑32, spec 005 AC‑21/AC‑22 | `e2e/palette.spec.ts`, `e2e/tabs.spec.ts` |
| C‑14 | **Nunca solo el color** para transmitir información: el estado «sin guardar» de una pestaña va en el nombre accesible («· sin guardar»), no solo en el punto azul | spec 005 AC‑24 | `DocumentTabs.test.tsx` |
| C‑15 | **Roving tabindex** en los tres patrones de navegación: el árbol, la paleta (16 botones = 1 parada) y la tira de pestañas (N pestañas = 1 parada) | spec 002 AC‑28, spec 004 AC‑25, spec 005 AC‑20 | `WorkspaceTreeView.test.tsx`, `MarkdownPalette.test.tsx`, `DocumentTabs.test.tsx` |
| C‑16 | **Orden de tabulación relativo** en la página del editor: cabecera → tira de pestañas → conmutador → Guardar → paleta → `<textarea>` | spec 004 AC‑26, spec 005 AC‑27 | `DocumentEditorPage.test.tsx` |
| C‑17 | **El foco vuelve al `<textarea>` tras insertar** desde la paleta, con la selección exacta; **no vuelve** al usar los botones de historial (`focus: false`), para que un segundo `Enter` no escriba un salto de línea | spec 004 AC‑21/AC‑22, spec 006 AC‑30 | `DocumentEditorPage.test.tsx` |
| C‑18 | **Cuatro regiones vivas con `aria-label` propio** en la página del editor; ninguna entra en el DOM con su texto ya dentro (se montan vacías) | spec 004 AC‑27/AC‑36, spec 005 AC‑26, spec 006 AC‑31 | `MarkdownPalette.test.tsx`, `DocumentTabs.test.tsx` |
| C‑19 | La re-emisión de un anuncio idéntico usa `U+200B` alternado, **no** whitespace: un lector debe volver a anunciar «Insertado: Negrita» dos veces seguidas | spec 004 AC‑36, spec 005 AC‑28 | `MarkdownPalette.test.tsx` (con `MutationObserver`) |
| C‑20 | **Foco atrapado en los modales**, con foco inicial en `[data-autofocus]` o el primer enfocable, `Escape` para cerrar y foco devuelto al disparador | spec 002 AC‑29 | `WorkspaceTreeView.test.tsx` |
| C‑21 | El foco va al `role="alert"` cuando una mutación del árbol falla | spec 002 AC‑29 | `WorkspaceTreeView.test.tsx` |
| C‑22 | El `role="tabpanel"` de la vista previa es enfocable (`tabIndex={0}`) porque puede no tener nada enfocable dentro y hay que poder desplazarlo con teclado (WCAG 2.1.1) | `DocumentEditorPage.tsx` | — |
| C‑23 | Ningún contenedor con `overflow` propio en la vista dividida: se desplaza el `<main>` del shell | `DocumentEditorPage.tsx` | — |
| C‑24 | El nombre accesible del botón de envío **no cambia** mientras la petición está en vuelo (nada de «Entrando…»); el estado se comunica con `disabled` + `aria-busy` | `AuthPageLayout.tsx` | `LoginPage.test.tsx` |
| C‑25 | Los `<svg>` de icono llevan siempre `aria-hidden="true"` y `focusable="false"` | spec 004 AC‑24 | `MarkdownPalette.test.tsx` |
| C‑26 | La tira de pestañas **no es una trampa de teclado**: `Tab` y `Enter` siguen siendo del navegador (SC 2.1.2). Igual en la paleta y en el árbol | spec 005 | `DocumentTabs.test.tsx` |

## 5.4 Historial y guardado

| # | Contrato | Origen | Test |
|---|---|---|---|
| C‑27 | **Deshacer se deshabilita cuando no queda historial**, con `disabled` real y no `aria-disabled`: es la única señal que distingue «se acabó el historial» de «esto está roto» | spec 006 AC‑28 | `DocumentEditorPage.test.tsx` |
| C‑28 | Los controles de historial existen en `text` y `split` y **están ausentes** en `preview` | spec 006 AC‑29 | `DocumentEditorPage.test.tsx` |
| C‑29 | El atajo va **en el nombre accesible** del control («Deshacer · Ctrl+Z»), igual que la «×» dice «Supr para cerrar» | spec 006 AC‑27, spec 005 AC‑23 | `DocumentEditorPage.test.tsx`, `DocumentTabs.test.tsx` |
| C‑30 | **Ningún elemento del catálogo de la paleta puede reclamar `z` ni `y`** como atajo: el cruce entre `HISTORY_SHORTCUT_KEYS` y el catálogo debe salir vacío | spec 006 AC‑25 | `markdown-palette.test.ts` |
| C‑31 | `Ctrl`/`Cmd`+`B`/`I`/`K` van **en el `<textarea>`**, no en la ventana; `Ctrl`/`Cmd`+`S` va **en la ventana** | spec 004 AC‑28, spec 003 AC‑27 | `DocumentEditorPage.test.tsx` |
| C‑32 | El único camino que cambia el contenido es `setDraft`: la paleta, el teclado y el historial pasan todos por ahí y heredan debounce y coalescencia | spec 003, `plan.md` decisión 10 | `editor.store.test.ts` |
| C‑33 | El borrador **nunca se descarta ante un error** de guardado | spec 003 AC‑19 | `editor.store.test.ts` |
| C‑34 | Cerrar una pestaña **guarda primero**; si el guardado falla, **no cierra** | spec 005 AC‑6/AC‑7 | `editor.store.test.ts` |
| C‑35 | La pestaña activa **no tiene representación en el store**: es el `:id` de la ruta | spec 005 AC‑3 | `editor.store.test.ts` |
| C‑36 | Los tres fallos de guardado dicen lo mismo en la región educada («Sin guardar»); el qué y el qué hacer viven en el `role="alert"`, con dos urgencias ARIA distintas (`status` vs `alert`) | spec 003 AC‑19/AC‑22 | `DocumentEditorPage.test.tsx` |
| C‑37 | El mensaje de red caída debe ser **distinto de cualquiera que mande el servidor** | spec 003 AC‑19 | `editor.store.test.ts` |
| C‑38 | El contador de caracteres aparece a partir del **90 %** del límite, y el límite se **deriva** de `@one-markdown/shared`, nunca se reescribe | spec 003 AC‑30 | `DocumentEditorPage.test.tsx` |

## 5.5 Árbol y navegación

| # | Contrato | Origen | Test |
|---|---|---|---|
| C‑39 | El árbol sigue el patrón *tree* de WAI‑ARIA: `role="tree"` con nombre, `treeitem` con `aria-level`, `aria-expanded` (solo directorios) y `aria-selected` | spec 002 AC‑28 | `WorkspaceTreeView.test.tsx` |
| C‑40 | **La navegación se hace en el manejador, no con un `<Link>` dentro de la fila**: un ancla añadiría una segunda parada de tabulación por nodo y rompería el patrón | spec 002 | `WorkspaceTreeView.test.tsx` |
| C‑41 | Las pestañas son **botones y no enlaces**: expresan selección entre N (`aria-selected`), no navegación. Se acepta perder `Ctrl`+clic | spec 005, decisión A | `DocumentTabs.test.tsx` |
| C‑42 | La «×» de la pestaña es un `<span>`, no un `<button>`: un botón dentro de un botón es HTML inválido | spec 005, decisión B | `DocumentTabs.test.tsx` |
| C‑43 | El botón «Nuevo en la raíz» va **después** del árbol en el DOM, no encima: tabular hacia la barra lateral debe aterrizar en el nodo activo | spec 002 | `WorkspaceTreeView.test.tsx` |
| C‑44 | El nombre accesible de una fila se ata con `aria-labelledby` a su etiqueta, no se deduce del contenido (si no sería «Notas Renombrar Notas Borrar Notas») | spec 002 | `WorkspaceTreeView.test.tsx` |
| C‑45 | El 404 se renderiza **dentro del shell**: perder la navegación desorienta | spec 000 AC‑10 | `routes.test.tsx`, `e2e/smoke.spec.ts` |
| C‑46 | El toggle de la barra lateral responde al teclado y lleva `aria-expanded` + `aria-controls` | spec 000 | `AppShell.test.tsx`, `e2e/smoke.spec.ts` |

## 5.6 Sesión

| # | Contrato | Origen | Test |
|---|---|---|---|
| C‑47 | **Nada de la sesión se persiste** en `localStorage` ni `sessionStorage`: token en memoria, refresh en cookie `HttpOnly` | spec 001 AC‑23 | `LoginPage.test.tsx` |
| C‑48 | Mientras el estado es `unknown` o hay autenticación en vuelo, las rutas protegidas **esperan y no redirigen** | spec 001 AC‑22 | `RequireAuth.test.tsx` |
| C‑49 | Los mensajes de `401` del login son **idénticos** para contraseña incorrecta y correo inexistente: distinguirlos reabriría la enumeración de cuentas | spec 001 AC‑6 | `auth-login.e2e-spec.ts` (API) |
| C‑50 | Los borradores viven **solo en memoria**: nada de `localStorage` en el editor tampoco | spec 003 | `editor.store.test.ts` |

## 5.7 Restricciones de proceso que afectan al rediseño

| # | Contrato |
|---|---|
| C‑51 | **Toda la UI va en español.** No hay capa de i18n; el idioma no es una variable |
| C‑52 | **TypeScript estricto** y `any` explícito prohibido por lint en todos los paquetes |
| C‑53 | Cualquier cambio entra por una **spec en `specs/NNN-slug/`** con `spec.md` + `plan.md` + `tasks.md` + `CHANGELOG.md`, y se implementa en **TDD** (RED → GREEN → REFACTOR) |
| C‑54 | Cada criterio de aceptación tiene **al menos un test automatizado**; `IMPLEMENTATION.md` solo se marca tras correr el comando y ver la salida |
| C‑55 | La suite de navegador tiene un **presupuesto de cupo declarado** contra los throttlers del API: añadir recorridos de e2e consume cupo real |
| C‑56 | **Sin dependencias nuevas de UI.** Es la postura declarada en `plan.md` §1 de la spec 002 y repetida en la 004: los diálogos están escritos a mano en vez de usar `<dialog showModal()>` —jsdom no implementa el modo modal y la mitad del comportamiento no se podría probar— y no entra ninguna librería de foco atrapado |

---

# 6. Cierre del inventario

Lo que hay que llevarse a la fase siguiente, en orden de peso:

1. **El producto está construido, no diseñado.** De 68 estados alcanzables, **cero** tienen
   tratamiento visual deliberado; 45 están correctamente resueltos por dentro (roles, foco,
   regiones vivas, teclado) y sin nada por fuera; 18 solo funcionan.
2. **La deuda de valores no está en los radios** (3, sano) sino en el color (30 valores, 10
   grises), el espaciado (13 pasos, 4 de un solo uso), la altura de los controles (4 valores para
   el mismo gesto) y **dos sistemas de anillo de foco incompatibles** con dos opacidades distintas.
3. **Cuatro ejes no existen todavía**: movimiento (1 duración, 1 curva, sin
   `prefers-reduced-motion`), elevación (2 sombras, todo lo demás con bordes), apilamiento (1
   z-index) y adaptabilidad (1 punto de ruptura usado una vez).
4. **Cinco estados alcanzables no tienen nada pintado**: carpeta vacía, error dentro de un
   diálogo, sesión expulsada, cierre de pestaña bloqueado, regenerar códigos de recuperación.
5. **Seis controles heredan el foco del navegador**, incluido el toggle de la barra lateral, que
   además es el único control de la barra plegada.
6. **56 contratos** entre accesibilidad, seguridad y comportamiento están especificados y testeados.
   Ninguno es negociable sin cambiar su spec y su test primero.
