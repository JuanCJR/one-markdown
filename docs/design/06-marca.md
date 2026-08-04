# 06 · Marca y voz

**Documento normativo del repositorio.** Cierra la fase 6 por su otra mitad: `06-sistema.md` fijó el
espaciado, los radios, los bordes, la elevación, el foco y los iconos; esto fija **el símbolo, los
bloqueos y las palabras**. Es lo único del sistema que la persona lee literalmente, así que es lo
único cuyo incumplimiento no hay que deducir de una medida: se ve en la pantalla.

Regla que gobierna el documento entero, la misma de las fases 4, 5 y 6: **ningún valor y ninguna
frase entran por costumbre.** Cada geometría sale de la retícula del símbolo; cada cadena sale de una
regla de §4 y tiene su condición de falsación.

| Qué                                          | Dónde                                            |
| -------------------------------------------- | ------------------------------------------------ |
| El símbolo y los dos bloqueos, en la app      | `apps/web/src/shared/marca/Marca.tsx`            |
| Los mismos, como archivo                      | `apps/web/public/marca/`                         |
| Favicon e icono de aplicación                 | `apps/web/public/favicon.svg`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` |
| Todo el texto de interfaz                     | `apps/web/src/shared/textos/textos.ts`           |
| El título de la pestaña                       | `apps/web/src/shared/textos/useTituloDePestana.ts` |
| El guard de la voz                            | `apps/web/src/design/voz-guard.test.ts`          |
| El generador de los rasterizados y la muestra | `tools/marca/rasterizar-marca.mjs` → `pnpm marca:rasterizar` |

> **Estado: decidido y aplicado.** A diferencia de `05-tipografia.md` §10.4 y de `06-sistema.md`,
> esto **no** está esperando al restyle: los archivos están en el repositorio, las 126 cadenas están
> en el código y las 631 pruebas unitarias y las 12 de navegador pasan con ellas. Lo que queda para
> el restyle es la **escala** (el cuerpo de 60 px de R7), no la palabra.

---

## 1 · El símbolo — el corte

Un cuadrado partido por una diagonal, con un canal vacío entre las dos mitades. No hay wordmark
dentro, no hay contenedor, no hay más figura.

**De dónde sale.** De R8 de `03-direccion.md`: *«la diagonal aparece exactamente una vez en la
pantalla: la marca»*. En un sistema que prohíbe chevrones, flechas, lupas y cualquier forma girada,
la diagonal está reservada, y lo que se reserva para una sola cosa acaba siendo esa cosa. El símbolo
no ilustra un documento ni una carpeta: **es el corte**, que es lo que hace la aplicación —partir la
pantalla en texto y vista del mismo texto—.

### 1.1 La geometría

Retícula de 24. El canal es **lado / 8**, que es el mismo `1/8` de la proporción de rasgo de los
iconos de 16 y 24 px (`06-sistema.md` §8). Ni el canal ni los triángulos se eligen: se derivan.

```
viewBox 0 0 24 24        canal = 24/8 = 3
  M0 0H21.88L0 21.88Z     triángulo superior izquierdo
  M24 2.12V24H2.12Z       triángulo inferior derecho
```

Los `21.88` y los `2.12` no son un ajuste a ojo: son lo que deja un canal perpendicular de 3 unidades
entre dos hipotenusas a 45°, que mide `3 · √2 ≈ 2,12` sobre cada eje.

### 1.2 Los dos dibujos, y por qué son dos

| Dibujo                | Retícula | Cuándo                        |
| --------------------- | -------- | ----------------------------- |
| `SIMBOLO_24` (maestro) | 24       | 24 px y todo lo que suba       |
| `SIMBOLO_16`          | 16       | **16 px y todo lo que baje**   |

El segundo **no es el primero escalado**, y ahí está el motivo de que existan los dos. A 16 px con
DPR 1, el canal del maestro cae entre dos filas de píxeles y se renderiza como dos grises: es
exactamente el fallo que `06-sistema.md` §8 llama *«el icono de 12 px que desaparece»*, y por el que
aquel documento puso un suelo duro de 2 px de rasgo. Con coordenadas enteras el canal ocupa un píxel
completo.

`Simbolo` elige el dibujo por el tamaño y no por un parámetro: `px <= 16` es la condición, escrita una
vez.

*Se incumple* con cualquier símbolo pintado a 16 px o menos usando la retícula de 24; con cualquier
`stroke` (los iconos de este sistema son masas: `fill: currentColor`, `stroke: none`); con cualquier
color que no herede del tema; y con una segunda diagonal en la misma pantalla.

### 1.3 Monocromo

El símbolo funciona en masa sólida de un solo color, y esa es su condición de existencia. En la
aplicación es `fill="currentColor"`, así que gira con el tema sin una sola regla condicional. En el
icono de aplicación es tinta sobre campo cromo — dos colores, ninguno de ellos gradiente.

*Se incumple* con un gradiente, con una sombra, con un radio (`rx`/`ry` en el SVG), o con cromo usado
como color de trazo en vez de como masa (R5).

---

## 2 · Los bloqueos

Dos, y ninguno más.

**Horizontal** — `viewBox 0 0 252 30`. Símbolo de 24 desplazado 3 px hacia abajo para centrarlo en la
caja de 30, separación de 12, y el wordmark en Chivo 900 a 30 px con `letter-spacing -0.75` y
`word-spacing -1.8`. Es el que va en la cabecera de la aplicación.

**Vertical** — `viewBox 0 0 360 116`. Símbolo de 40 (`scale(1.6667)` sobre la retícula de 24),
wordmark de 50 con `letter-spacing -1.25` y `word-spacing -3`, y el descriptor **TU ARCHIVO PRIVADO**
en Chivo 700 a 11 px con `letter-spacing 2.42`. Hoy no lo usa ninguna pantalla —se entra por `/login`,
que tiene su propio `h1`— y existe para una portada o una exportación.

El tracking negativo del wordmark y el positivo del descriptor son la misma regla de
`05-tipografia.md` §2 aplicada dos veces: *«el rótulo lleva tracking positivo porque va en versalitas
y las versales apiñadas necesitan aire»*, y un peso 900 grande necesita lo contrario.

### 2.1 Los bloqueos llevan `role="img"`, y el símbolo suelto no

Parece una inconsistencia y no lo es:

- **El símbolo suelto** es uno de los cinco iconos del inventario cerrado (`06-sistema.md` §8). Va
  `aria-hidden` y su control lleva el nombre en texto, porque *«ningún icono es el único portador de
  un significado»*.
- **Los bloqueos** no acompañan a nada. Son la marca, y decir cómo se llama esto es su trabajo
  entero, así que llevan `role="img"` con el nombre dentro.

Se probó la otra forma —`aria-hidden` en el SVG y un `sr-only` al lado— y **se retiró con una razón
medida**: mete «One Markdown» dos veces en el DOM, una dibujada dentro del `<text>` y otra para el
lector, y cualquier consulta por texto encuentra las dos. Lo descubrió la suite de navegador, que
falló con `strict mode violation: resolved to 2 elements`. El `role="img"` deja un solo nodo con un
solo nombre.

*Se incumple* si el bloqueo aparece sin nombre accesible, si el nombre se duplica en un texto de
apoyo, o si se compone con el símbolo y el wordmark colocados a mano en vez de con el componente.

---

## 3 · Los archivos, y qué se genera de qué

```
apps/web/public/
  favicon.svg              16, monocromo, los DOS temas en un archivo
  favicon-16.png           ← rasterizado de favicon.svg
  favicon-32.png           ← rasterizado de favicon.svg
  apple-touch-icon.png     ← rasterizado de marca/app-icon.svg
  marca/
    simbolo.svg            24, currentColor
    simbolo-16.svg         16, currentColor, coordenadas enteras
    bloque-horizontal.svg  252 × 30
    bloque-vertical.svg    360 × 116
    app-icon.svg           180, campo cromo + marca en tinta, 20 % de aire
```

Ninguno lleva `width` ni `height`: el tamaño lo decide quien lo coloca, y un archivo de marca con
medida dentro es un archivo que se pinta a 252 px donde caben 120. Los cinco de `marca/` llevan
`fill="currentColor"` en la raíz salvo `app-icon.svg`, que es el único con color propio porque su
campo cromo **es** el icono.

**Los tres PNG salen del SVG**, y no de un dibujo aparte. Es la única forma de que un retoque del
símbolo llegue a los tres tamaños: un PNG dibujado a mano se queda con la versión de ayer y nadie lo
nota, porque un favicon de 16 px equivocado se parece mucho a uno correcto. El generador valida el
instrumento antes y después —que los SVG de origen existan, que Chromium arranque, y que cada PNG
tenga la firma y las dos dimensiones que declara su cabecera IHDR— y aborta con código 2 en vez de
escribir un icono transparente.

### 3.1 Las dos limitaciones, dichas en vez de tapadas

**El wordmark depende de que Chivo esté cargada.** Los dos bloqueos llevan `<text font-family="Chivo">`
y no trazados contorneados. Dentro de la aplicación se cumple siempre —la cara viaja en
`public/fuentes` y la declara `styles/tipografia.css`—, pero el mismo archivo puesto en una
presentación, en un correo o en un `<img>` de otro origen compone con la sans del sistema y el
bloqueo deja de ser el bloqueo.

Se intentó contornear con `fontkit`, que ya es dependencia del repositorio, y **no se puede con lo que
hay instalado**: fontkit 2.0.4 no soporta variaciones sobre WOFF2. Comprobado — `font.getVariation({
wght: 900 })` devuelve una instancia sin `cmap`, y `getGlyph` responde `null`. Contornear exigiría un
descompresor de WOFF2, que es una dependencia nueva. Queda pendiente y escrito.

**Los dos PNG del favicon van en tinta del tema claro.** `favicon.svg` lleva los dos temas dentro con
una `prefers-color-scheme`; un PNG no puede. Sobre una pestaña oscura el PNG casi desaparece, y la
captura de `docs/design/capturas/marca-tamanos-oscuro.png` lo enseña al lado del SVG para que sea un
dato y no una sorpresa. El riesgo real es pequeño y está acotado: el `<link rel="icon">` pone el SVG
**primero**, y lo admiten todos los navegadores de los últimos años; los PNG son el respaldo de quien
no.

### 3.2 La comprobación

`pnpm marca:rasterizar` regenera los tres PNG y las dos capturas. Las capturas enseñan, para cada
tamaño, el SVG y el PNG uno al lado del otro, a tamaño real y ampliados sin interpolar. La ampliación
del SVG la redibuja el navegador —enseña el trazado—; la del PNG es el archivo real, y es donde se
mira si la retícula de 16 aguanta.

| Captura                                           | Qué prueba                                                    |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `docs/design/capturas/marca-tamanos-claro.png`    | Los tres tamaños sobre papel claro                             |
| `docs/design/capturas/marca-tamanos-oscuro.png`   | Los tres sobre papel oscuro, y que el PNG **no** gira con él   |
| `docs/design/capturas/marca-bloqueos-claro.png`   | Que los dos bloqueos componen con Chivo, no con la sans del SO |
| `docs/design/capturas/marca-bloqueos-oscuro.png`  | Lo mismo en oscuro: los dos son `currentColor`                 |

Las dos de bloqueos incrustan la cara como `data:` en un `@font-face` y esperan a `document.fonts.ready`
antes de disparar. Sin lo segundo la captura se juega a una carrera y en una máquina rápida sale con
la sans del sistema — que es exactamente el fallo que la captura existe para detectar. Y el generador
comprueba antes que los dos archivos siguen declarando `font-family="Chivo"`: si alguien los
contornea algún día, esta comprobación es la que hay que retirar a mano, y por eso está.

---

## 4 · La voz — quince reglas, todas falsables

Cada una lleva la condición exacta que la rompe, igual que la gramática de `03-direccion.md` §1. Si
una revisión no puede señalar qué regla se incumplió, la revisión no ha revisado nada.

**V1 — Se dice qué ha pasado, no que ha pasado algo.**
*Se incumple* con «Ocurrió un error», «Algo salió mal», «Ups» o cualquier frase que describa la
existencia de un problema sin describir el problema. El guard lo mata (§5).

**V2 — Cuando de verdad no se sabe qué ha pasado, se dice que no se sabe.**
El mensaje sin causa dice tres cosas y ninguna es «error»: **quién** paró, **qué pasa con el texto de
la persona**, y **qué hacer**. *Se incumple* con un mensaje sin causa que no diga las tres.

**V3 — Un aviso que interrumpe tiene que responder al miedo, no solo al hecho.**
El caso canónico es el bloqueo por intentos: quien lo ve teme dos cosas, y la segunda —que alguien
haya entrado— es la que la cadena de la fase 0 dejaba abierta. Por eso «**Nadie ha entrado.**»
*Se incumple* con un aviso de seguridad que enuncie el hecho y calle la consecuencia.

**V4 — Las cifras van escritas.** «Te faltan 4 caracteres», no «no cumple las reglas». «Dentro hay 12
elementos: 3 carpetas y 9 documentos», no «también se borrará su contenido».
*Se incumple* con un mensaje que le pida a la persona contar algo que el programa ya sabe.

**V5 — Un botón dice lo que hace, con el objeto dentro.** «Crear la carpeta», «Borrar 13 elementos»,
«Mover ahí», «Guardar el nombre».
*Se incumple* con «Aceptar», «Sí», «No», «OK», o con un verbo suelto cuyo objeto haya que buscar en el
título del diálogo.

**V6 — No hay vocabulario de sistema de ficheros ni de formato.** Carpeta, no directorio. Y el área de
escritura se llama «Texto de «Fermentos»», no «Contenido de «Fermentos» en markdown».
*Se incumple* con «directorio», «fichero», «ruta», «markdown» o «archivo» (en el sentido de *file*)
dirigidos a la persona. «Tu archivo» sí, en el sentido de *el sitio donde guardas lo tuyo*, que es lo
que el descriptor de la marca declara.

**V7 — El sistema y la interfaz usan las mismas palabras para las mismas cosas.** Los dos paneles son
**texto** y **vista**; el árbol es la **estructura**.
*Se incumple* con un segundo nombre para un objeto que el sistema ya nombra — «vista previa» junto a
«vista», «barra lateral» junto a «estructura».

**V8 — Un estado, una frase.** Seis estados de guardado, seis frases.
*Se incumple* cuando dos estados alcanzables comparten rótulo. Es lo que hacía la fase 0 con los tres
fallos bajo «Sin guardar», y su coste concreto: quien oye la región viva **no tiene el aviso de al
lado delante**, así que tres cosas distintas anunciadas igual son una sola cosa.

**V9 — No se personifica a nadie que no exista.** En este producto no hay más personas: el backend
filtra por el `userId` del token.
*Se incumple* con «alguien», «otro usuario» o cualquier tercero en un mensaje del editor o del árbol.

**V10 — Un estado vacío ofrece una salida, no describe el vacío.**
*Se incumple* con un vacío que solo diga que no hay nada, o que le explique a la persona dónde está
una zona que está viendo.

**V11 — Los detalles técnicos van al log.** Los dos incumplimientos de contrato del login dicen a la
persona la misma frase, porque desde donde ella está son el mismo hecho; el detalle se escribe con
`console.error` y con nombre (`DETALLE_TECNICO`).
*Se incumple* con un mensaje en pantalla que nombre la API, un token, un código HTTP o una clase.

**V12 — Ningún atributo `title`.** Duplican el nombre accesible en un tooltip que solo existe con
ratón, tardan medio segundo y no se leen con teclado. La fase 0 contaba veinte.
*Se incumple* con cualquier `title` en un elemento de interfaz. Hoy hay **cero** — los seis que quedan
en el código son la prop `title` de `ModalDialog` y `AuthPageLayout`, que no es el atributo HTML.

**V13 — La fricción es proporcional al daño y temporal.** Teclear una palabra para confirmar solo se
cobra donde el error es irreversible **y** grande: una carpeta con cosas dentro. Un documento no la
pide; una carpeta vacía tampoco.
*Se incumple* cobrándola en una acción reversible, o dejándola puesta el día que exista la papelera.

**V14 — Ninguna palabra escrita por la persona aparece en versalitas de 11.** Heredada literal de
`03-direccion.md` §2, y aquí sigue valiendo: es el cuerpo con el que habla la aplicación.

**V15 — El servidor no habla en pantalla; el cliente traduce.** El `401`, los dos `429` y el fallo de
transporte se mapean en `auth.errors.ts` por **código de estado** y por la presencia de
`retryAfterSeconds`.
*Se incumple* reenviando `cause.message` en una rama que el cliente sepa nombrar. Los mensajes de
**dominio** del árbol («Ya existe un directorio con ese nombre») siguen reenviándose, y es
deliberado: son los únicos que saben qué ha pasado.

---

## 5 · El guard de la voz

`apps/web/src/design/voz-guard.test.ts` hace exigibles cuatro prohibiciones del **Anexo A — lista
negra anti-slop** sobre el texto que la persona llega a leer u oír:

| Anexo | Qué prohíbe                                                                 |
| ----- | --------------------------------------------------------------------------- |
| X7    | «Ups», «Algo salió mal», «Error inesperado»                                 |
| I3    | Emoji usado como icono — aquí, en cualquier sitio                           |
| X6    | Emoji en encabezados; cubierto por lo anterior, que es más ancho            |
| I4    | `✨` como significante de «esto es IA»                                        |
| X2    | potencia · impulsa · desbloquea · sin fricción · todo en uno · al siguiente nivel · revoluciona · de última generación · robusto |

**No es un `grep`, y la diferencia importa.** El anexo propone `grep` para X2 y X7, y en este
repositorio daría falsos positivos por todas partes: se comenta mucho, y medio comentario habla de las
cadenas que se acaban de retirar. El guard recorre el **AST de TypeScript** y recoge solo literales de
cadena, plantillas y texto JSX; los comentarios quedan fuera por construcción, no por una expresión
regular que los intente borrar y se coma media línea al tropezar con `https://`.

Dos correcciones más sobre lo que propone el anexo, y las dos están medidas:

1. **El rango de emoji de I3 (`1F300-1FAFF`) se le escapa `✨`**, que es `U+2728` y es justamente el
   carácter que I4 señala. El guard usa `\p{Extended_Pictographic}`, que es la propiedad que Unicode
   define para esto y cubre también los pictogramas de un solo punto de código.
2. **Los términos de X2 se buscan por raíz**, no por la forma exacta del lema: el anexo lista
   «potencia» y el slop no se conjuga solo así. `potenci\w*` atrapa «potenciar» y «potencial»;
   `robust\w*` atrapa «robusta».

**El guard se valida a sí mismo antes de mirar**, que es la regla de `verification-and-measurement`
aplicada a un test: comprueba que ha leído más de 20 archivos y más de 300 cadenas, y que encuentra
las **tres** formas que sabe recoger —una cadena suelta, un rótulo de un objeto de datos y un texto
JSX—. Si dejara de ver cualquiera de las tres, los otros casos seguirían en verde mirando las otras
dos, y eso es el cero falso que se está evitando. Y un quinto caso le da de comer las once frases
prohibidas para comprobar que los patrones siguen mordiendo.

**Qué no cubre, dicho en vez de fingido.** El texto de dominio que llega del servidor sin pasar por
`textos.ts`. V15 cierra las ramas que el cliente sabe nombrar, pero un mensaje de dominio nuevo del
backend puede aparecer en pantalla sin cruzar este guard. Es una revisión manual declarada, y no se
escribe un test que finja lo contrario.

### 5.1 El rojo con el que nació

Antes de escribir una sola cadena nueva, el guard señaló tres archivos:

```
src/features/auth/auth.errors.ts:22 → «error inesperado» en "Ocurrió un error inesperado. Inténtalo de nuevo."
src/features/editor/DocumentEditorPage.tsx:676 → «error inesperado» en "Ocurrió un error inesperado. Inténtalo de nuevo."
src/features/workspace/workspace.store.ts:102 → «error inesperado» en "Ocurrió un error inesperado. Inténtalo de nuevo."
```

Tres copias literales de la misma frase en tres archivos. La fase 0 había inventariado dos (§4.6 y
§4.9); la tercera no estaba escrita en ninguna parte, y es la razón por la que el guard mira el código
y no el inventario.

---

## 6 · El diff

Formato: **antes** es lo que había en el código, tal y como lo inventarió `00-auditoria.md` §4.
**ahora** es lo que hay. «igual» significa que la original ya cumplía y no se ha tocado.

### 6.1 Shell y navegación · `AppShell.tsx`

| antes | ahora |
| --- | --- |
| `One Markdown` (h1) | **retirado.** El `h1` de cada pantalla es lo que esa pantalla contiene; el nombre vive en el bloqueo de la cabecera y en el título de la pestaña, «Fermentos · One Markdown» |
| `Árbol de documentos` (aria-label del nav) | `Estructura` |
| `Mostrar barra lateral` / `Ocultar barra lateral` | `Mostrar la estructura` / `Ocultar la estructura` |
| `Seguridad` | `Seguridad de la cuenta` |
| `Cerrar sesión` | igual |

### 6.2 Entrar · `LoginPage.tsx`

| antes | ahora |
| --- | --- |
| `Iniciar sesión` (h1) | `Entrar en tu archivo` |
| `Correo electrónico` / `Contraseña` / `Entrar` | igual |
| `¿Todavía no tienes cuenta?` + `Crear una cuenta` | `¿Todavía no tienes archivo?` + `Crear el tuyo` |

### 6.3 Código de verificación · `MfaChallengeForm.tsx`

| antes | ahora |
| --- | --- |
| `Tu cuenta tiene verificación en dos pasos. Escribe el código de tu app de autenticación.` | `Tu cuenta pide un código además de la contraseña. Abre tu app de autenticación y escribe el que muestra ahora.` |
| `Código de verificación` | igual |
| `6 dígitos, o uno de tus códigos de recuperación.` | igual, **centralizada**: estaba copiada en `MfaChallengeForm.tsx` y en `SecurityPage.tsx` |
| `Verificar` | igual |
| `Entrar con otra cuenta` | `Empezar con otro correo` |

### 6.4 Crear la cuenta · `RegisterPage.tsx`

| antes | ahora |
| --- | --- |
| `Crear cuenta` (h1 y botón) | `Crear tu archivo` (h1) · `Crear el archivo` (botón) |
| `Nombre (opcional)` | `Nombre (opcional, solo lo ves tú)` |
| `La contraseña debe tener al menos 12 caracteres e incluir una letra y un número.` (ayuda **y** error) | ayuda: `12 caracteres o más, con una letra y un número.` |
| `No cumple las reglas indicadas.` | **retirada.** La sustituyen tres errores concretos, uno por fallo: `Te faltan 4 caracteres.` · `Añade una letra.` · `Añade un número.` |

### 6.5 Seguridad de la cuenta · `SecurityPage.tsx`

| antes | ahora |
| --- | --- |
| `Seguridad de la cuenta` | igual |
| `Verificación en dos pasos: activada` / `: desactivada` | `Verificación en dos pasos, activada` / `desactivada` |
| `Añade un código de tu app de autenticación (…) al iniciar sesión.` | `Al entrar, tu cuenta pedirá también un código de tu app de autenticación (Google Authenticator, 1Password, Aegis).` |
| `Activar verificación en dos pasos` · `Escanea el código` | igual |
| `Código QR para añadir esta cuenta a tu app de autenticación` (alt) | `Código QR con la clave de esta cuenta` |
| `Si no puedes escanearlo, escribe esta clave en tu app:` | igual |
| `Los 6 dígitos que muestra tu app ahora mismo.` | igual |
| `Confirmar` | `Confirmar el código` |
| `Guárdalos ahora en un lugar seguro: no volverás a verlos. Cada uno sirve una sola vez para entrar si pierdes el teléfono.` | `Cópialos ahora: esta pantalla no vuelve. Cada código entra una sola vez, y sirve si pierdes el teléfono.` |
| `Se borrarán tu clave TOTP y tus códigos de recuperación, y se cerrarán tus otras sesiones.` | `Desactivarla borra tu clave y tus códigos de recuperación, y cierra las sesiones abiertas en tus otros dispositivos.` |
| `Desactivar verificación en dos pasos` | igual |
| `Volver al workspace` | `Volver a tus documentos` |

### 6.6 Errores · `auth.errors.ts`, `auth.store.ts`, `workspace.store.ts`, `DocumentEditorPage.tsx`

| antes | ahora |
| --- | --- |
| `Ocurrió un error inesperado. Inténtalo de nuevo.` | `One Markdown ha parado esta acción y no sabe por qué. Tu texto sigue donde estaba. Vuelve a intentarlo.` |
| `No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.` | `El servidor no responde. Revisa tu conexión y vuelve a intentarlo.` |
| `Demasiados intentos. Vuelve a probar en N minutos.` | `Demasiados intentos seguidos. Esta cuenta acepta el siguiente dentro de 4 minutos. Nadie ha entrado.` |
| `La API pidió segundo factor sin entregar un token.` | `El inicio de sesión se ha quedado a medias. Escribe otra vez tu correo y tu contraseña.` — el detalle, al log |
| `La API no devolvió sesión ni pidió segundo factor.` | la misma frase, y el mismo trato |
| `La verificación caducó. Vuelve a iniciar sesión.` | `El paso del código ha caducado. Empieza otra vez con tu correo y tu contraseña.` |
| `Comprobando tu sesión…` | `Comprobando tu sesión` |
| `Credenciales inválidas` (reenviada del backend) | `El correo o la contraseña no coinciden.` |
| `Demasiadas peticiones desde esta dirección. Inténtalo de nuevo en unos instantes.` (reenviada) | `Esta red ha hecho demasiadas peticiones. Vuelve a intentarlo dentro de un minuto.` |

### 6.7 Estructura · `WorkspaceTreeView.tsx`, `TreeNodeRow.tsx`

| antes | ahora |
| --- | --- |
| `Documentos` (aria-label del tree) | `Estructura` |
| `Cargando el árbol…` | `Cargando la estructura` |
| `Todavía no hay directorios ni documentos.` | `Tu archivo está vacío. El primer documento va en la raíz.` |
| `Nuevo en la raíz` · `Nuevo en «{n}»` · `Renombrar «{n}»` · `Mover «{n}»` · `Borrar «{n}»` | igual. **Se retira el `title` de las cuatro de fila** |

### 6.8 Diálogos de la estructura

| antes | ahora |
| --- | --- |
| `Tipo` · `Directorio` / `Documento` | `Tipo` · **`Carpeta`** / `Documento` |
| `Crear` | `Crear la carpeta` / `Crear el documento`, según el tipo elegido |
| `Guardar` (renombrar) | `Guardar el nombre` |
| `Mover` | `Mover ahí` |
| `Borrar «{n}»` + `¿Seguro que quieres borrar «{n}»?` + `Esta acción no se puede deshacer.` + `Borrar` (documento) | `Borrar «Fermentos»` + `Este documento se borra ahora y no vuelve.` + `Borrar el documento` |
| lo mismo + `También se borrará su contenido: 12 elementos.` (carpeta con cosas) | `Borrar «Cocina» y lo que hay dentro` + `Dentro hay 12 elementos: 3 carpetas y 9 documentos. Se borran los 13 y no vuelven.` + campo `Escribe borrar para confirmarlo.` + `Borrar 13 elementos` |
| — (carpeta vacía: no estaba en la fase 6) | `Borrar «Notas»` + `Esta carpeta está vacía y se borra ahora. No vuelve.` + `Borrar la carpeta`. **Añadido**, ver §7 |

### 6.9 Editor · `DocumentEditorPage.tsx`, `SaveStatus.tsx`, `NotFoundPage.tsx`, `WorkspaceEmptyState.tsx`

| antes | ahora |
| --- | --- |
| `Cargando el documento…` | `Cargando el documento` |
| `Este documento ya no existe.` | `Este documento ya no existe. Lo borraste en otra pestaña o en otro dispositivo.` + acción `Volver a la estructura` |
| `Ruta del documento` | igual |
| `Texto` · `Vista previa` · `Dividida` | `Texto` · **`Vista`** · `Dividida` (las tres pestañas y las dos secciones del modo dividido) |
| `Contenido de «{t}» en markdown` (aria-label del textarea) | `Texto de «{t}»` |
| `Quedan {n} caracteres` | igual |
| `Te sobran {n} caracteres` | `Te sobran 240 caracteres: el documento no se guarda hasta que quepan.` |
| `Deshacer` · `Rehacer` · `Deshacer · Ctrl+Z` · `Rehacer · Ctrl+Shift+Z` · `Guardar` · `Estado del guardado` | igual |
| `Guardado` · `Cambios sin guardar` · `Guardando…` · `Sin guardar` (4 rótulos, 6 estados) | `Guardado 14:32` · `Sin guardar` · `Guardando` · `Sin guardar: el servidor no responde` · `Sin guardar: el documento cambió fuera` · `Sin guardar: el texto pasa del límite` |
| `No se pudo contactar con el servidor. Tus cambios siguen aquí; se reintentarán cuando sigas escribiendo.` | `El servidor no responde. Tu texto sigue aquí y se guardará cuando vuelvas a escribir.` |
| `Resolver el conflicto` | igual |
| `Ningún documento abierto` + `Selecciona un documento en la barra lateral para verlo aquí.` | `Ningún documento abierto.` + acción `Abrir el último que escribiste`, o `Elegir uno en la estructura` sin historial |
| `404 — página no encontrada` + `La ruta que intentaste abrir no existe.` + `Volver al inicio` | `Esta dirección no está en tu archivo.` + `Volver a tus documentos` |

### 6.10 Conflicto · `ConflictDialog.tsx`

| antes | ahora |
| --- | --- |
| `El documento cambió mientras lo editabas` | `Este documento cambió mientras escribías` |
| `Alguien guardó una versión distinta de este documento —otra pestaña, otro dispositivo— después de que tú empezaras a escribir. Tus cambios siguen aquí; elige con cuál te quedas.` | `Lo guardaste distinto en otra pestaña o en otro dispositivo después de empezar aquí. Las dos versiones están completas: quédate con una.` |
| `Descartar mis cambios` | `Descartar lo que escribí` |
| `Conservar mi versión` | igual |

### 6.11 Pestañas · `DocumentTabs.tsx`

| antes | ahora |
| --- | --- |
| `Documentos abiertos` · `«{t}» · sin guardar · Supr para cerrar` · `Documento sin título` · `Pestañas abiertas` | igual |
| `Cerrada: {t}` | `Has cerrado «{t}»` |

### 6.12 Elementos del markdown · `markdown-palette.ts`, `MarkdownPalette.tsx`

| antes | ahora |
| --- | --- |
| Grupos `Formato` · `Bloques de texto` · `Insertar`; región `Elemento insertado` / `Insertado: {r}` | igual |
| Los 16 `title` (`description` del catálogo) | **retirados**, y con ellos el campo `description`, que se quedaba sin consumidor |
| `Código en línea` | `Código` |
| `Bloque de código` | `Código en bloque` |
| `Lista de tareas` | `Lista de cosas por hacer` |
| Los marcadores que acaban en el documento (`texto en negrita`, `Celda`, la plantilla de tabla) | **intocados.** Son contrato de producto con test propio |

---

## 7 · Lo que no está resuelto, dicho en vez de tapado

1. **El recuento de intentos del bloqueo no llega.** La fase 6 escribe «Has fallado la contraseña 5
   veces. Esta cuenta acepta el siguiente intento dentro de 40 segundos. Nadie ha entrado.», y el
   `429` de `AccountLockedException` trae `retryAfterSeconds` y **nada más**. Se ha implementado la
   variante que la propia fase 6 previó para ese caso. Sacar la con recuento exige un campo nuevo en
   el cuerpo del `429`, que es contrato de backend y territorio de `apps/api`: se reporta y se espera.

2. **`rejected` dice «el texto pasa del límite» y cubre más casos que ese.** En `editor.store.ts`,
   `rejected` es *«el servidor respondió y dijo que no (`400`, `404`, `413`, `429`)»*. La frase es
   correcta para el `413` y para el `400` por longitud, y **miente** en un `404` o en un `429`. Se ha
   implementado tal y como la fase 6 la escribe —gana el criterio hasta que quien escribió la spec
   decida otra cosa— y queda registrado aquí porque es un mensaje que puede decir algo falso. El daño
   está acotado: el `role="alert"` de al lado lleva el motivo real del servidor.

3. **La carpeta vacía no estaba escrita.** La fase 6 §4.8 redacta el documento y la carpeta con cosas
   dentro; la carpeta vacía es un tercer caso alcanzable que no cubre. Se ha redactado con la forma
   del caso del documento y el sustantivo que toca, sin campo de confirmación —no hay nada dentro que
   perder—. Es copy añadido, no copy citado.

4. **«El último que escribiste» es «el último abierto en esta sesión».** Nada del editor persiste
   entre recargas (`editor.store.ts`), así que no hay un «último» de ayer que ofrecer. Sin pestañas
   abiertas, el estado vacío ofrece la otra salida.

5. **El cuerpo de 60 px de R7 no está aplicado.** El `h1` de la pantalla ya **es** el nombre del
   documento abierto, que es la decisión de la fase 6; su escala llega con el restyle, junto al resto
   de `06-sistema.md`. Aquí se ha cambiado el nivel del encabezado, no el tamaño.

6. **El conmutador de tema tiene copy fuera del módulo.** `TemaSwitcher.tsx` y `tema.ts` llegaron con
   la fase 4, después del inventario de la fase 0, así que ni la auditoría ni el microcopy de la fase
   6 los recogen. Sus cadenas —`Tema`, `Claro`, `Oscuro`, `Sistema`— siguen en su sitio. Centralizarlas
   es trivial; reescribirlas sería inventar, y no toca.

7. **El wordmark contorneado** (§3.1) y **el PNG del favicon en tema oscuro** (§3.1).

---

## 8 · El nombre

La decisión sobre «One Markdown» y su riesgo de colisión está registrada en
`docs/producto/03-decisiones-tomadas.md` §Marca, que es donde viven las decisiones de producto. Este
documento no la repite: la marca **ejecuta** un nombre que ya estaba decidido.

Lo único que pertenece a esta fase y conviene tener a mano: el símbolo **no depende del nombre**. No
lleva letra dentro, no es un monograma y no ilustra la palabra «markdown». Si el nombre cambiara, el
corte sobrevive y lo que hay que rehacer son los dos bloqueos — es decir, dos archivos y un
componente, no una identidad.
