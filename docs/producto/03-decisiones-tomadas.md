# 3. Decisiones de producto ya tomadas

Están cerradas por escrito, con su razón. **No hace falta volver a discutirlas para avanzar** — pero
todas son reversibles si el producto lo pide, y aquí está lo que costaría.

## Alcance y modelo

| Decisión | Por qué | Coste de revertir |
|---|---|---|
| **Un usuario, sus documentos, nadie más.** Sin equipos, sin roles, sin compartir | El brief no lo pedía y la autorización por recurso queda trivial de garantizar | **Alto.** Compartir toca modelo de datos, autorización, UI y probablemente auth |
| **La vista dividida es del MISMO documento** (texto + preview), no dos documentos | Es lo que pide el brief, precisado el 2026-07-28 | **Alto.** Dos documentos a la vez son dos guardados en vuelo, dos paletas y dos rutas en una URL |
| **Las pestañas no se persisten** entre recargas | Es lo que mantiene la feature enteramente en el frontend: persistirlas obliga a tabla, migración, endpoint y contrato compartido | **Medio.** Trabajo real de backend, pero sin decisiones difíciles |
| **El borrado es definitivo**, sin papelera ni versiones | Decidido y aceptado explícitamente al aprobar el árbol | **Medio.** Una papelera es un estado más en el modelo, más caducidad y UI |
| **Deshacer es solo del contenido de un documento** | Deshacer un renombrado o un borrado del árbol es otro modelo entero | **Medio-alto** |

## Cuenta

| Decisión | Por qué | Coste de revertir |
|---|---|---|
| **Sin OAuth / login social / SSO** (Auth.js descartado) | Decisión explícita del usuario: el backend es dueño del auth | **Medio** |
| **Sin verificación de correo ni recuperación de contraseña** | **No hay proveedor de correo en el proyecto.** Consecuencia asumida: quien olvida la contraseña y no tiene otra sesión, no entra | **Bajo-medio**, pero exige elegir y pagar un proveedor de correo. Es la decisión que desbloquea varias otras |
| **Sin revocación inmediata del token de acceso** | Se acepta una ventana de 15 minutos en vez de mantener una lista de revocación | Bajo |
| Contraseña mínima: **12 caracteres con un dígito** | Umbral por encima del habitual, coherente con la postura de seguridad del proyecto | Trivial |

## Editor

| Decisión | Por qué | Coste de revertir |
|---|---|---|
| **`<textarea>` plano**, sin editor enriquecido ni resaltado | Todo lo demás (paleta, deshacer, preview) se construyó encima de esa simplicidad | **Muy alto.** Cambiar de motor de edición reabre la paleta, el deshacer, el autoguardado y el caret |
| **La paleta solo se ve en modo texto** | Dieciséis botones deshabilitados son ruido; y hacer que un clic conmute de modo es «más listo de lo que conviene» | Trivial |
| **Pila de deshacer propia**, no la del navegador | Con un `<textarea>` controlado, la pila nativa **no queda impredecible: queda inservible** (medido) | No aplica |
| **El historial de deshacer no se persiste** | Sin ello, la feature no necesita expulsión, serialización ni caducidad propias | Medio |
| **Preview sanitizado siempre**, HTML embebido como texto literal | Regla dura del proyecto | No se debería revertir |
| Tabla de la paleta **fija 3 × 2** | Un selector de dimensiones es otra interacción | Trivial |

## Interacción

| Decisión | Por qué | Coste de revertir |
|---|---|---|
| **Mover se hace con un diálogo, no arrastrando** | Accesible por teclado desde el primer día; el drag & drop es una capa encima, no un sustituto | Bajo — es aditivo |
| **La vista dividida es fija 50/50** | Un separador arrastrable es un widget ARIA completo (`role="separator"`, teclado propio, persistencia de la proporción) | Bajo-medio |
| **Sin cota de pestañas abiertas** | La aritmética no la justificaba | Trivial |
| **`Ctrl`+`W` no se usa** para cerrar pestaña | Es atajo reservado del navegador | No aplica |
| **Sin scroll sincronizado** entre los dos paneles de la vista dividida | Quedó fuera de alcance, sin más razón que el tamaño de la spec | Bajo. **Candidato barato con retorno visible** |

## Marca

Registrado al cerrar la fase 6 de diseño (`docs/design/06-marca.md`), que es cuando el nombre dejó de
ser una cadena en un `package.json` y pasó a estar dibujado.

| Decisión | Por qué | Coste de revertir |
|---|---|---|
| **El producto se llama «One Markdown»** | Es el nombre con el que nació y con el que están escritas las siete specs, el `showi.yml`, el scope de paquetes `@one-markdown` y el repositorio entero | **Bajo en diseño, medio en repositorio.** Ver abajo |
| **El símbolo no contiene ninguna letra** | Es un corte, no un monograma: no ilustra la palabra «markdown» ni lleva una «O» ni una «M» dentro | No aplica — **es la mitigación** |
| **El nombre aparece en dos sitios y ninguno es un `h1`**: el bloqueo de la cabecera y el título de la pestaña | Un `h1` fijo con el nombre del producto repetido en las cinco rutas no encabeza nada | Trivial |

### El riesgo de colisión, escrito

**«One Markdown» es un nombre descriptivo, y eso tiene consecuencias conocidas.** No se registra aquí
como una alarma sino como un dato, para que quien lo revierta algún día sepa qué estaba comprado:

1. **«Markdown» es el nombre de un formato, no una marca del proyecto.** Es el formato que John Gruber
   publicó en 2004 y su nombre se usa genéricamente en todo el sector. Un nombre construido sobre un
   término genérico del dominio es **débil como marca**: cuesta registrarlo, cuesta defenderlo, y no
   impide que otro producto se llame parecido.
2. **La colisión de búsqueda es alta y estructural.** «Markdown» compite con la documentación del
   propio formato y con decenas de editores; «one» es de los calificadores más usados que existen. No
   es un riesgo que se arregle con contenido: es aritmética del nombre.
3. **Qué NO se ha comprobado, y hace falta antes de cualquier publicación**: búsqueda en registros de
   marcas, disponibilidad de dominio, y disponibilidad del nombre en las tiendas de aplicaciones. No
   está hecho, y este documento no finge que sí.

### Por qué se acepta hoy, y qué costaría cambiarlo

Se acepta porque **el producto no está publicado** y porque el coste de renombrar está acotado y es
conocido:

| Qué habría que tocar | Coste |
|---|---|
| Los dos bloqueos (`bloque-horizontal.svg`, `bloque-vertical.svg`, `Marca.tsx`) | **Bajo.** Dos archivos y un componente. El símbolo, el favicon y el icono de aplicación **no se tocan**: no llevan letra |
| `NOMBRE_APP` en `shared/textos/textos.ts` | Trivial — una constante, y de ahí sale el título de la pestaña y el nombre accesible del bloqueo |
| La cadena de `ERRORES.desconocido`, que nombra al producto | Trivial, mismo archivo |
| El scope `@one-markdown`, el nombre del repositorio, `showi.yml`, las siete specs y sus CHANGELOG | **Medio.** Mecánico y ancho: es donde vive el coste de verdad |

**La decisión de diseño que abarata el cambio ya está tomada**: el símbolo es una figura y no una
letra. Mientras eso siga siendo cierto, renombrar es un trabajo de repositorio y no un rediseño de
identidad.

## Postura general

Tres criterios se han sostenido en las siete specs y conviene conocerlos antes de proponer nada:

1. **La accesibilidad no se negocia por velocidad.** Cuando un patrón cómodo chocaba con ella, se
   descartó el patrón (`Ctrl`+clic en las pestañas, controles anidados, botones deshabilitados sin
   explicación).
2. **No se pierde trabajo del usuario, nunca.** Guardado forzado al cerrar una pestaña, conflicto
   resuelto por la persona y no en silencio, texto que no desaparece cuando el guardado falla.
3. **Lo que se acepta roto se escribe.** Las limitaciones vivas están declaradas, no escondidas — y
   normalmente con destinatario.
