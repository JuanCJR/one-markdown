# 2. Estado del producto — qué puede hacer una persona hoy

Corte: **2026-08-01**, siete specs cerradas (`000`…`006`). Todo lo de aquí está implementado y
verificado con tests; nada es aspiracional.

## Cuenta y sesión

| Puede | Detalle |
|---|---|
| Registrarse con correo y contraseña | Mínimo **12 caracteres** y al menos un dígito. Entra directo, sin paso de activación |
| Iniciar y cerrar sesión | Sesión sobrevive a recargas y a volver más tarde |
| Activar un segundo factor TOTP | Google Authenticator, 1Password, Aegis… con **códigos de recuperación** de un solo uso |
| Desactivar el MFA | Desde `/settings/security`, la única pantalla de cuenta que existe |

Protecciones que la persona nota: **5 contraseñas falladas bloquean la cuenta 15 minutos** (aunque la
sexta sea correcta); un correo inexistente y una contraseña mala dan **exactamente el mismo error**,
para no revelar qué cuentas existen. Sesión: acceso de **15 min** renovado con un refresco de **7
días** en cookie `HttpOnly`.

**No puede**: recuperar una contraseña olvidada, cambiarla, editar su perfil, ver sus sesiones activas,
ni entrar con Google/GitHub. Ver [`04-huecos-y-candidatos.md`](04-huecos-y-candidatos.md).

## Organizar (árbol de carpetas)

Crear carpetas y subcarpetas · crear documentos dentro de una carpeta o en la raíz · renombrar ·
mover a cualquier sitio, incluida la raíz · borrar. Todo desde la barra lateral, **completo por
teclado**, y con aviso explícito antes de borrar una carpeta que no está vacía.

**Los documentos son estrictamente privados**: cada acceso se filtra por el usuario del token, y una
cuenta ajena no puede leerlos, moverlos, borrarlos **ni averiguar que existen**.

Límites vigentes, por usuario:

| Límite | Valor |
|---|---|
| Profundidad de carpetas | **10** niveles |
| Nodos totales (carpetas + documentos) | **5.000** |
| Nombre de carpeta | 120 caracteres |
| Título de documento | 200 caracteres |
| Contenido de un documento | **200.000 caracteres** |

Dos hermanos no pueden llamarse igual (sin distinguir mayúsculas). **El borrado es definitivo: no hay
papelera ni deshacer.**

**No puede**: arrastrar y soltar para mover (se hace con un diálogo), buscar, filtrar, ordenar a mano,
ni etiquetar.

## Escribir (editor)

- **Autoguardado** 1,5 s después de dejar de escribir, más `Ctrl`/`Cmd`+`S` para forzarlo.
- **Estado del guardado siempre visible**: guardado / guardando / sin guardar / error, distinguiendo
  «el servidor lo rechazó» de «no se pudo llegar al servidor».
- Si el guardado falla, **no se pierde nada**: el texto sigue en pantalla.
- **Detección de conflicto**: si el mismo documento cambió desde otra pestaña, avisa y deja elegir
  entre quedarse con lo propio o tomar lo del servidor. No pisa trabajo en silencio.
- **Tres modos de vista**: texto · vista previa · **dividido** (texto y preview del mismo documento,
  fijo al 50/50).
- **Preview sanitizado**: HTML pegado desde fuera se muestra **como texto literal**, nunca se ejecuta.
  Un `<script>` o un enlace `javascript:` se ven, no se sufren. Soporta GFM (tablas, tachado, listas
  de tareas).
- El editor es un **`<textarea>` plano**: sin resaltado de sintaxis, sin números de línea, sin
  autocompletado.

## Insertar markdown sin saber markdown (paleta)

**16 elementos** de un clic, visibles solo en modo texto: negrita · cursiva · tachado · código en línea
· encabezados 1-3 · cita · lista con viñetas · lista numerada · lista de tareas · enlace · imagen ·
bloque de código · tabla (3 × 2 fija) · separador.

Atajos `Ctrl`/`Cmd`+`B`/`I`/`K` para negrita, cursiva y enlace. Respeta la selección de la persona, deja
el cursor donde toca y anuncia lo insertado a los lectores de pantalla.

**La imagen inserta la sintaxis, no sube el archivo**: no hay carga de imágenes en ningún sitio del
producto.

## Trabajar con varios documentos (pestañas)

Pestañas al estilo VS Code, navegables por teclado, cerrables con el botón o con `Delete`. **Cerrar
fuerza el guardado y no cierra si falla.** Sin límite de pestañas abiertas.

**No hace**: persistirlas entre recargas (al recargar queda abierta solo la de la URL), reordenarlas
arrastrando, fijarlas, ni el menú contextual de VS Code («cerrar las demás», «cerrar a la derecha»).

## Deshacer

Pila propia por documento: `Ctrl`+`Z` para deshacer, `Ctrl`+`Shift`+`Z` y `Ctrl`+`Y` para rehacer.
Agrupa lo que se teclea del tirón (ventana de 500 ms) y **cubre también las inserciones de la paleta**,
que era lo único que el proyecto había aceptado a sabiendas dejar roto.

El historial **sobrevive a saltar entre pestañas** pero **se pierde al cerrar la pestaña**, y no se
guarda en ningún sitio. Cuando se acaba, el botón de deshacer se deshabilita — esa es la única señal
que distingue «no queda historial» de «esto está roto».

## Accesibilidad

Tratada como requisito con criterios propios, no como intención: recorrido completo por teclado,
objetivos de clic **≥ 24 × 24 px** (WCAG 2.2 SC 2.5.8), nombres accesibles en todas las regiones vivas,
y nunca solo el color para transmitir información (WCAG 1.4.1).

**Tres cosas quedan declaradas como no verificables por ningún test del proyecto** y pendientes de
revisión manual: cómo locuta un lector de pantalla real, `Ctrl`+`Y` en Firefox/Windows (la suite es
solo Chromium) y un recorrido del árbol.

## Lo que no está construido en absoluto

Compartir o colaborar · búsqueda · papelera o versiones · exportar/importar · subir archivos ·
plantillas · etiquetas o metadatos · enlaces entre documentos · temas o apariencia · uso offline ·
**diseño responsive** (prácticamente no hay breakpoints: la interfaz asume escritorio) · **despliegue**
de cualquier tipo.
