# 06 · Sistema — espaciado, radios, bordes, elevación, foco e iconos

**Documento normativo del repositorio.** Cierra lo que quedaba del sistema de diseño después de
`03-direccion.md` (la gramática), `04-color.md` (los tokens de color) y `05-tipografia.md` (la
superfamilia y las dos escalas). Como en la fase 5, **los valores se deciden aquí y se derivan de
algo**, no se copian de la escala de fábrica de ninguna herramienta.

Regla que gobierna el documento entero: **ningún valor entra por costumbre.** Cada número de las
tablas que siguen sale de la línea del cuerpo del documento (26 px, `05-tipografia.md` §7), de una
regla de `03-direccion.md`, o de una medida de `04-color.md`. Donde no sale de ninguna de las tres,
está marcado como **derivado** y dice de qué se ha extrapolado.

| Qué                                              | Dónde                                                  |
| ------------------------------------------------ | ------------------------------------------------------ |
| Tokens de este documento                         | `apps/web/src/styles/tokens-sistema.css` (§9, por crear) |
| Puente con Tailwind y borrado de las escalas     | `apps/web/src/index.css`                               |
| Tokens de color y superficies                    | `apps/web/src/styles/tokens-cromo.css`                 |
| Escala tipográfica y caras                       | `apps/web/src/styles/tipografia.css`                   |

> **Estado: decidido y medible, no aplicado.** Igual que `05-tipografia.md` §10.4: las pantallas
> todavía no usan nada de esto. Aplicarlo es el restyle, toca los 24 archivos de interfaz y entra
> por el `orchestrator` con su spec y sus `T-NNN` en TDD, según `CLAUDE.md`. Lo que hay aquí es la
> decisión con su derivación y su condición de falsación.

---

## 1 · Espaciado — la rejilla es media línea del documento

### 1.1 De dónde sale la unidad

La fase 5 fijó el cuerpo del documento en **16 px con línea de 26 px** y dejó escrito por qué el 26
es redondo a propósito: *«es la unidad vertical del documento, y todo el espaciado del preview es
múltiplo de 13 px para que la rejilla vuelva a cuadrar después de cada encabezado»*.

Entonces la unidad no se elige aquí: **ya estaba elegida y es 13 px, media línea.** Lo que hace este
documento es extenderla del preview a todo el producto.

**La comprobación que decide que esto no es una racionalización a posteriori:** `03-direccion.md` R3
fijó tres medidas de espacio —4, 12 y 40— antes de que existiera la fase 5 y sin conocer el 26.
Puestas sobre la rejilla de 13:

| R3 decía | La rejilla dice | Diferencia | Trabajo, sin cambios |
| -------- | --------------- | ---------- | -------------------- |
| 4        | 4 (sub-rejilla) | **0**      | dentro de una fila   |
| 12       | 13 (½ línea)    | **+1 px**  | dentro de un grupo   |
| 40       | 39 (3⁄2 líneas) | **−1 px**  | entre zonas          |

Los tres trabajos de R3 sobreviven enteros; los tres valores se mueven como mucho un píxel. La
escala de este documento no sustituye a R3: **la termina**, porque R3 tenía tres pasos y un producto
necesita entre seis y ocho.

Segunda confirmación, y esta no se buscó: la medida del documento que fijó la fase 5 §6,
`--medida-documento: 39rem` = **624 px**, es **48 × 13** exacto. La columna de texto ya estaba en la
rejilla antes de que la rejilla se declarara.

### 1.2 La escala — siete pasos

| Token                  | px     | Derivación         | Trabajo                                                                        |
| ---------------------- | -----: | ------------------ | ------------------------------------------------------------------------------ |
| `--spacing-nulo`       |  **0** | —                  | Contigüidad declarada: filas de una lista, celdas de la rejilla de la paleta.   |
| `--spacing-fila`       |  **4** | sub-rejilla        | Dentro de una fila. **Solo horizontal** (§1.4).                                 |
| `--spacing-grupo`      | **13** | ½ línea            | **Por defecto entre elementos de un mismo grupo.**                             |
| `--spacing-bloque`     | **26** | 1 línea            | **Por defecto entre grupos.**                                                  |
| `--spacing-zona`       | **39** | 3⁄2 líneas         | **Por defecto entre zonas.** Es el 40 de R3.                                    |
| `--spacing-marco`      | **52** | 2 líneas           | Aire sobre una zona que abre con el cuerpo de 21 px; margen de la columna.      |
| `--spacing-identidad`  | **78** | 3 líneas           | Aire sobre el cuerpo de 60 px. Único paso que puede rodear la identidad (R7).   |

Nombre semántico, nunca nombre de medida — la misma regla que `04-color.md` §1. En el código se
escribe `gap-grupo`, `p-zona`, `mt-identidad`, `px-fila`; **nunca `gap-3` ni `p-6`**, que dejan de
existir en el build (§9).

**Los tres por defecto que pedía el encargo, en una línea:** dentro de un grupo **13**; entre grupos
**26**; entre zonas **39**.

### 1.3 Por qué siete y no diez

Los pasos por encima de 39 son dos y no cuatro porque en Cromo el aire grande tiene un solo trabajo
—separar— y ya lo hace el 39. El 52 y el 78 existen solo para lo que la gramática distingue: una
zona que abre con cuerpo de 21 y la identidad de 60. Si aparece la tentación de un cuarto paso
grande, la respuesta de `03-direccion.md` §4 es literal: *«cuando dos zonas se confunden, se aumenta
el aire»* — se sube al paso siguiente, no se inventa uno intermedio.

Por debajo de 13 hay un solo valor porque el vertical no lo necesita: **la altura de un control es
un token, no un relleno** (§1.5), así que no hace falta ningún `padding` vertical pequeño.

### 1.4 La regla que protege la rejilla

> **Todo espacio vertical es múltiplo de 13. El 4 es siempre horizontal.**

*Se incumple* con cualquier `margin-block`, `padding-block`, `row-gap` o `height` que no sea
múltiplo de 13 px. Excepción única, heredada de R3 y no ampliada: los ajustes ópticos de ±2 px
**dentro** de un control ya construido, que nunca crean estructura y nunca se acumulan.

### 1.5 Alturas de caja — dos, no cuatro

La fase 0 encontró **cuatro alturas mínimas de control** (32, 36, 40, 44) para el mismo gesto. Se
cierran en dos, las dos de la rejilla:

| Token             |     px | Derivación | Dónde                                                        |
| ----------------- | -----: | ---------- | ------------------------------------------------------------ |
| `--alto-fila`     | **26** | 1 línea    | Fila del árbol, fila de resultado, fila de versión, pestaña.  |
| `--alto-control`  | **39** | 3⁄2 líneas | Botón, campo, `select`, control aislado.                      |

Consecuencia buscada: cinco filas del árbol miden 130 px = cinco líneas del documento. **El árbol y
el preview laten al mismo compás**, que es el mismo argumento de la fase 5 §1 aplicado al ritmo
vertical en vez de a la caja del glifo.

**Objetivo táctil (WCAG 2.2, 2.5.8, AA — 24 × 24 px).** 26 y 39 pasan. Lo que no pasa por sí solo es
la masa de 8 px de «cerrar» (§6.4): su **masa visible es 8 px y su objetivo es 26 × 26**, con el
relleno transparente declarado en el propio control. Un objetivo por debajo de 24 px es un fallo del
guard, no una decisión de diseño.

### 1.6 Anchos fijos — dos

| Token                  | px           | Derivación                                    |
| ---------------------- | ------------ | --------------------------------------------- |
| `--medida-documento`   | 624 (39rem)  | Fase 5 §6. **48 × 13.**                       |
| `--ancho-estructura`   | **260**      | **20 × 13.** Derivado: la fase 0 medía `w-64` = 256 px; se sube 4 px para caer en la rejilla. |

La fase 0 medía **ocho** anchos de contenedor para cuatro pantallas. Las pantallas de auth y de
error pasan a la medida del documento: no hay una tarjeta centrada, hay una columna con eje
izquierdo (R4).

### 1.7 El preview: cómo vuelve a cuadrar la rejilla después de un encabezado

Este es el punto que la fase 5 dejó enunciado (*«múltiplo de 13 para que la rejilla vuelva a
cuadrar»*) sin resolver, porque **ninguna línea de encabezado es múltiplo de 13**: h1 mide 32.6 px,
h2 27.4 y h3 26.0.

Regla, y es una sola:

> **Todo encabezado ocupa un bloque de 65 px** (5 × 13): 26 px de aire arriba, su propia línea, y el
> resto abajo.

| Nivel      | Línea (fase 5) | Aire arriba | Aire abajo | Bloque |
| ---------- | -------------: | ----------: | ---------: | -----: |
| `h1`       |        32.6 px |       26 px | **6.4 px** |  65 px |
| `h2`       |        27.4 px |       26 px | **11.6 px**|  65 px |
| `h3`       |        26.0 px |       26 px | **13 px**  |  65 px |
| `h4`·`h5`·`h6` |    26.0 px |       26 px | **13 px**  |  65 px |

El aire de abajo es el único número del sistema que no es múltiplo de 13, y es exactamente por eso:
**es el resto que devuelve la rejilla.** Es un valor calculado, no un paso de la escala, y por eso
no cuenta en el presupuesto de §7.

Dos condiciones que hacen falta para que esto sea cierto en el navegador y no solo en la tabla:

1. **Sin colapso de márgenes.** El contenedor del preview lleva `display: flow-root`; si los
   márgenes colapsan, el bloque de 65 deja de medir 65 y la rejilla se pierde en silencio.
2. Párrafo → párrafo: **13 px**. La línea de 1.625 ya separa; una línea entera entre párrafos
   deshilacha la mancha justo lo que la fase 5 §7 evitó al no subir a 1.7.

*Se incumple* cuando el acumulado vertical del preview, medido desde el borde superior de la
columna hasta la línea base de cualquier párrafo, no es múltiplo de 13.

### 1.8 Lo que le pasa a R3

R3 de `03-direccion.md` se reescribe así, y es el único cambio que este documento hace a la
gramática:

> **R3 — El espacio vertical es múltiplo de 13 px, media línea del cuerpo del documento. Hay siete
> pasos: 0, 4, 13, 26, 39, 52 y 78; el 4 es solo horizontal.** 13 dentro de un grupo, 26 entre
> grupos, 39 entre zonas.
> *Se incumple* con cualquier `padding`, `gap` o `margin` que no sea uno de los siete. Excepción
> cerrada y única: los ajustes ópticos de ±2 px dentro de un control ya construido, que nunca crean
> estructura.

---

## 2 · Radios — cero, y la dirección lo pedía por escrito

**El sistema admite un solo radio: `0`.** El encargo preveía este caso («si la dirección de arte
pide radio cero, declárala y salta este punto»), y aquí no hay que interpretarla: está pedida tres
veces y de tres maneras distintas.

1. **`03-direccion.md` R1** cuenta el radio entre lo que rompe la separación de zonas: *«se incumple
   cuando aparece un `border`, un `hr`, una sombra o un radio entre dos zonas»*.
2. **`04-color.md` §9 bis** ya lo ejecutó en el mapeo del restyle: `rounded-*` · `shadow-*` →
   **se borran**, con la razón escrita: *«la profundidad es color de superficie, no luz»*.
3. **El origen declarado.** Concretismo brasileño y el rediseño del *Jornal do Brasil* de Amílcar de
   Castro. El ángulo recto no es un gusto de este sistema: es de dónde viene.

Y el criterio de rechazo de `03-direccion.md` §6 lo resuelve solo: *«¿se puede quitar de esta
pantalla toda la línea, toda la sombra y todo el color, y sigue diciendo lo mismo?»*. Un radio no
dice nada; si no dice nada, sobra.

**El anti-patrón F2 —un chip de 24 px y un modal de 600 px compartiendo radio— no puede darse aquí,
y no porque haya un criterio de asignación por tamaño mejor escrito que el de otros: porque con un
solo valor no hay asignación que equivocar.** Esa es toda la ventaja del cero, y es la razón de no
proponer una escala de cuatro a seis radios que después habría que defender pantalla a pantalla.

**Cómo se hace exigible.** No con una revisión: borrando el namespace, la misma técnica que ya
funcionó con el color (`--color-*: initial`, `04-color.md` §9).

```css
@theme inline {
  --radius-*: initial;   /* `rounded`, `rounded-md`, `rounded-full`… dejan de existir en el build */
}
```

*Se incumple* con cualquier `border-radius` computado distinto de `0px` en el bundle de producción,
con `rx`/`ry` en un `<svg>`, y con `border-radius` en línea.

**Los dos agujeros reales, resueltos** —los dos redondean sin que nadie escriba un radio:

| Agujero                                     | Qué pasa                                              | Resolución                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `<input type="radio">` (`CreateNodeForm`)   | El agente de usuario lo dibuja **circular**            | `appearance: none` obligatorio. La marca de selección es una **masa cuadrada de 8 px**, el mismo recurso que «el presente». |
| `<input type="checkbox">`, `<progress>`     | Íd., según agente de usuario                          | Íd. `appearance: none` y masa cuadrada.                                                                        |

No hay avatares, no hay píldoras y no hay `rounded-full`: la identidad de un documento es su nombre
a 60 px (R7), no una ficha.

---

## 3 · Bordes — un ancho, tres tokens, y las zonas no llevan ninguno

### 3.1 Una corrección de premisa, en dos líneas

`04-color.md` §1 no fijó **tres anchos** de hairline: fijó **tres tokens de color de hairline**, los
tres a 1 px, cada uno con una vecindad medida. Lo que decide este documento es el ancho, y decide
**uno solo**: si el grosor distinguiera además el trabajo, habría dos recursos haciendo la misma
faena, que es exactamente lo que prohíbe el principio semántico de `03-direccion.md` §2 («un
recurso, un trabajo»). **El canal que distingue una línea de otra es el contraste y el sitio, no el
grosor.**

| Token            | Ancho    | Qué delimita — regla de uso                                                                  | Peor caso medido (04 §5) |
| ---------------- | -------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| `--hair-zona`    | **1 px** | El **perímetro de una capa superpuesta** contra lo que tapa: diálogo, menú, paleta.           | 5.50 claro · 5.50 oscuro |
| `--hair-control` | **1 px** | El **borde de un control**: acción secundaria fantasma, y campo cuando el escalón no cabe.    | 4.00 · 4.00              |
| `--hair-fila`    | **1 px** | El **separador de fila** en una tabla de datos densa.                                          | **3.05 · 3.06**          |

### 3.2 Cuál separa zonas: ninguno

La pregunta del encargo tiene respuesta, y es que en Cromo **no existe la línea que separa dos zonas
de la misma pantalla**. R1: *«las zonas se separan con espacio o con un escalón de superficie, nunca
con una línea»*. El separador de zonas es `--spacing-zona` (39 px) o un escalón de la escalera.

`--hair-zona` se llama así porque delimita **una zona superpuesta**, que es otra cosa: ahí la línea
no separa dos zonas hermanas, marca dónde acaba una capa que está encima. Y hace falta porque el
escalón solo no puede: **medido, el escalón mide 1.06:1** (`04-color.md` §5.1) y por debajo de 3:1
no delimita nada identificable.

### 3.3 La regla de contraste, ahora en los dos lados

`04-color.md` la enunció; aquí se cierra el hueco que dejaba:

> **Toda hairline mide ≥ 3:1 (WCAG 1.4.11) contra el fondo de los DOS lados que toca**, no solo
> contra el de debajo.

Es lo que evita el caso que se cuela siempre: una línea correcta sobre `sup-elevada` que se apoya
por el otro lado en `sup-superpuesta` y ahí ya no llega. Las tres pasan en las cuatro superficies de
los dos temas, y **`--hair-fila` es el margen más justo del sistema con 3.05:1**: cualquier
movimiento de su `L` hacia la superficie lo rompe, y `pnpm color:medir` sale con código 1.

### 3.4 Lo que no es un borde, y por eso no gasta presupuesto

Tres trazos del sistema tienen ancho y **no son bordes**: son masas. La diferencia no es retórica —
un borde delimita, una masa significa (`03-direccion.md` §2), y por eso a estas no les aplica el
criterio de las hairlines sino el de la masa cromo o el de la tinta.

| Trazo                                   | Ancho    | Qué es                                     |
| --------------------------------------- | -------- | ------------------------------------------ |
| Eje de foco                             | 4 px     | Masa de tinta (§5).                        |
| Masa cromo mínima                       | 8 px     | «El presente» (R5).                        |
| Barra del bloque con el cursor          | 12 px    | Cambio de forma, no de tono (03 §3).       |
| Barra de nivel del árbol                | 58→10 px | Jerarquía (R6).                            |

*Se incumple* si alguno de los cuatro se escribe como `border` en vez de como fondo o masa: en
cuanto es `border`, el guard lo cuenta como un ancho de borde nuevo y con razón.

---

## 4 · Elevación — la escalera, mapeada a los cuatro contextos

Cromo no tiene elevación por luz: tiene **cuatro superficies** (`04-color.md` §1) y una regla de un
paso por vez. Esto es el mapeo a los cuatro contextos reales.

| Contexto              | Superficie          | Línea                       | Sombra | Segundo canal obligatorio                                                    |
| --------------------- | ------------------- | --------------------------- | ------ | ---------------------------------------------------------------------------- |
| **Panel**             | `--sup-elevada` sobre `--sup-base` | **ninguna**  | ninguna | 39 px de aire, o el escalón. Nunca las dos cosas y nunca una línea (R1).      |
| **Fila seleccionada** | `--sup-hundida`     | **ninguna**                 | ninguna | Masa cromo de 8 px **+ peso 900 + la ruta escrita en la cabecera** (03 §3).   |
| **Diálogo**           | `--sup-superpuesta` | `1px solid --hair-zona`, los 4 lados | ninguna, **y sin overlay** | Toma el eje izquierdo de la zona que tapa (R4); `role="dialog"`, foco atrapado, `Esc` cierra. |
| **Menú flotante**     | `--sup-superpuesta` | `1px solid --hair-zona`, los 4 lados | ninguna | **Cuelga del eje izquierdo de su disparador**; un solo nivel; `role="menu"`.  |

### 4.1 Qué distingue el diálogo del menú, ya que comparten superficie y línea

**El eje y la reversibilidad.** El diálogo se apropia del eje de la zona que tapa y bloquea el
fondo; el menú cuelga del eje de quien lo abrió y se va con `Esc` o con un clic fuera sin haber
bloqueado nada. Comparten materiales porque **son la misma capa**: la escalera tiene cuatro peldaños
y el cuarto es «lo superpuesto», no «lo modal».

### 4.2 Las cinco reglas de la escalera

- **E1 — No hay quinta superficie.** Consecuencia dura y buscada: **un menú flotante dentro de un
  diálogo está prohibido**, porque necesitaría un quinto peldaño para distinguirse. Se resuelve como
  lista dentro del propio diálogo.
- **E2 — Un paso por vez** entre zonas contiguas (R1). Saltar de `base` a `hundida` es una
  infracción aunque se vea bien.
- **E3 — Cero `box-shadow` que no sea el eje de foco.** El namespace se borra (§9). La sombra no
  está prohibida por gusto: está prohibida porque `04-color.md` §10.3 ya gastó la única excepción,
  y no era elevación.
- **E4 — No hay overlay oscurecido.** Es la excepción escrita de `04-color.md` §10.1: en oscuro un
  diálogo debe distinguirse sin overlay, y lo hace por superficie **y** hairline.
- **E5 — Dos capas de apilamiento y no más:** `--capa-pagina: 0` y `--capa-superpuesta: 100`. La
  fase 0 medía **1** (`z-50` suelto en `ModalDialog`) y lo leía como un eje que no existía todavía.
  Existen dos porque hay dos capas; declarar cuatro sería inventar profundidad que el sistema no
  tiene.

---

## 5 · Foco visible — el token que más se usa

Un producto que se recorre entero por teclado gasta este token más que ningún otro. La fase 0
encontró **dos sistemas de foco incompatibles** (`ring-2` en 10 sitios, `outline-2` en 11), **14
`outline-none` contra 13 `outline-solid`** —la mitad del código apagando el contorno y la otra mitad
volviéndolo a encender— y **6 controles con el foco heredado del navegador**. Aquí hay uno.

### 5.1 El token

```css
--foco-ancho: 4px;
--foco-tinta: var(--tinta-principal);
--foco-tinta-negativo: var(--sup-base);   /* cuando el elemento enfocado ES una masa de tinta */
--foco-canal: 4px;                        /* canal reservado a la izquierda de cada zona */
```

```css
@utility foco-eje {
  outline: none;
  box-shadow: calc(-1 * var(--foco-ancho)) 0 0 0 var(--foco-tinta);
}
```

Sin difuminado, sin transparencia, sin radio. Es la excepción de sombra ya escrita en
`04-color.md` §10.3 y **no es elevación**: es masa de tinta sólida.

**Por qué a la izquierda y no un anillo alrededor.** R4: toda zona tiene un eje izquierdo y todo lo
que pertenece a la zona cuelga de él. El eje de foco **cae exactamente sobre ese eje**, así que
recorrer la pantalla con el tabulador se ve como una masa bajando por la misma línea vertical, que
es la lectura que R6 ya enseñó a hacer con las barras de nivel. Un anillo alrededor tendría que
llevar radio (prohibido, §2) o esquinas vivas de 4 px por los cuatro lados, que es cuatro veces más
tinta para decir lo mismo.

### 5.2 Contraste ≥ 3:1 contra lo que rodea, en las seis vecindades

El eje se mide **contra lo que toca de verdad**, y toca dos cosas distintas según se dibuje fuera o
dentro. Cifras de `04-color.md` §3 y §5:

| Vecindad del eje                                  | Claro     | Oscuro    | Umbral 1.4.11 |     |
| ------------------------------------------------- | --------: | --------: | ------------- | --- |
| `--sup-base` (eje fuera, zona de trabajo)         | **16.11** | **15.47** | 3:1           | ✅  |
| `--sup-elevada` (eje fuera, panel)                | **15.13** | **14.47** | 3:1           | ✅  |
| `--sup-hundida` (eje fuera, fila seleccionada)    | **14.32** | **13.53** | 3:1           | ✅  |
| `--sup-superpuesta` (eje fuera, diálogo y menú)   | **13.32** | **12.22** | 3:1           | ✅  |
| Masa cromo (eje dentro, acción primaria enfocada) | **9.17**  | **10.07** | 3:1           | ✅  |
| Masa de tinta (eje dentro, **invertido**)         | **16.11** | **15.47** | 3:1           | ✅  |

**Peor caso del sistema: 9.17:1**, tres veces el umbral. Funciona sobre las cuatro superficies y en
los dos temas, que era el requisito.

### 5.3 Las siete reglas

- **F1 — El foco lo dibuja el eje, no el amarillo.** Cromo puede acompañar (`data-cromo="foco"`,
  presupuesto de `04-color.md` §8) pero **nunca sustituye** al eje: la masa cromo mide **1.45:1** en
  el peor caso del tema claro y no cumpliría 1.4.11 sola. Y hay una segunda razón, semántica: cromo
  ya está ocupado por «activo» y hay que poder distinguir «activo» de «enfocado» (03 §2).
- **F2 — `:focus-visible`, nunca `:focus`.** *Se incumple* con cualquier `:focus` sin `-visible` en
  CSS o en una clase de utilidad. Un clic de ratón no dibuja el eje.
- **F3 — `outline: none` solo se admite en la misma regla que aplica `foco-eje`.** Es lo que impide
  que vuelvan los 14 apagados sueltos de la fase 0.
- **F4 — Cero controles con el foco del navegador.** Todo elemento enfocable lleva `foco-eje`,
  incluidos enlaces, radios y el conmutador de barra lateral — los seis que la fase 0 encontró sin
  él.
- **F5 — Cada zona reserva `--foco-canal` (4 px) a su izquierda.** El eje se dibuja fuera del
  elemento; sin el canal, el primer control pegado al borde de la ventana se lo come. Cuando el
  canal es imposible (elemento a sangre), el eje se dibuja hacia dentro:
  `box-shadow: inset var(--foco-ancho) 0 0 0 var(--foco-tinta)`.
- **F6 — Sobre masa de tinta, el eje se invierte** a `--foco-tinta-negativo`. Sin esta regla, el
  foco sobre un botón de peligro o sobre una masa de estado (`Sin guardar`, `3 conflictos`, que en
  Cromo son fondo tinta con texto en negativo) sería **tinta sobre tinta: 1:1, invisible.** Es el
  agujero que este documento cierra y no estaba escrito en ninguna fase anterior.
- **F7 — El eje no lleva radio, ni difuminado, ni transparencia, ni transición.** El foco aparece y
  desaparece de golpe: el único movimiento del sistema es el desvanecido de la masa de tinta a
  120 ms (03 §2), y el foco no es ese gesto.

### 5.4 Cómo se comprueba

`03-direccion.md` §3 lo exige y no es opcional: **foco de teclado visible en las dos mitades del
split con el zoom del navegador al 200 %**, y una pasada en escala de grises. A eso se añade el
recorrido completo con tabulador por cada pantalla, comprobando que **el número de elementos
enfocables sin `foco-eje` es cero** — un cero que, según `verification-and-measurement`, hay que
demostrar que el instrumento sabe encontrar: el test se valida a sí mismo enfocando primero un
elemento que sí lo lleva.

---

## 6 · Iconos — masas, no trazos, e inventario cerrado

### 6.1 La decisión: dibujo propio, y muy pocos

**No hay familia externa.** No es purismo: es que ninguna sobrevive a la gramática. Toda familia de
trazo —Lucide, Feather, Phosphor, Heroicons— trae chevrones, flechas y formas giradas, y R8 dice que
**la diagonal aparece exactamente una vez en la pantalla: la marca**. Importar una familia para usar
el 8 % de ella y prohibir el resto por revisión es peor que dibujar cinco.

Y hay una consecuencia que se ve mejor con un ejemplo que con un argumento: **la lupa está
prohibida**. Su mango es una diagonal. En Cromo, buscar es una palabra.

**Los iconos de Cromo son masas sólidas**, `fill: currentColor` y `stroke: none`. Con esto **el
anti-patrón I1 —el stroke de fábrica en todos los tamaños— no se vigila: no se puede escribir**,
porque en el sistema no existe la propiedad `stroke`. Lo que sí queda por decidir, y es lo que pide
el encargo, es **el grosor mínimo de rasgo por tamaño**.

### 6.2 Peso por tamaño

| Tamaño   | Acompaña a          | Rasgo mínimo | Contraforma mínima | Proporción |
| -------- | ------------------- | -----------: | -----------------: | ---------- |
| **12 px** | Rótulo de 11 px    |     **2 px** |               2 px | **1⁄6**    |
| **16 px** | Cuerpo de 15 px    |     **2 px** |               3 px | **1⁄8**    |
| **24 px** | Control aislado, marca | **3 px** |               4 px | **1⁄8**    |

**La proporción no es constante, y ese es exactamente el punto.** Mantener 1⁄8 a 12 px daría un
rasgo de 1.5 px que en una pantalla de DPR 1 se reparte entre dos filas de píxeles y se renderiza
como dos grises: es el **anti-patrón I5**, el icono de 12 px que desaparece. Por eso hay un **suelo
duro de 2 px** que rompe la proporción hacia arriba en el tamaño pequeño. Lo mismo por el otro lado:
a 24 px un rasgo de 2 px se ve anémico junto a un peso 900 de Chivo, y sube a 3.

La **contraforma** (el hueco) va en la tabla porque en un sistema de masas es la mitad del problema:
un icono con rasgo correcto y hueco de 1 px se empasta y a 12 px se lee como una mancha. Regla:
**la contraforma nunca es menor que el rasgo.**

Comprobación aritmética de que el tamaño pequeño cierra: tres barras de 2 px con huecos de 2 px
suman 2+2+2+2+2 = **10 px**, dentro de la caja de 12 con 1 px de margen arriba y abajo. A 16 px:
2+3+2+3+2 = **12 px**, con 2 px de margen.

### 6.3 La prueba, incluida la de 200 %

Cuatro capturas por icono y por tamaño, en las dos superficies extremas (`sup-base` y
`sup-superpuesta`) y en los dos temas:

| Condición                  | Qué se mira                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- |
| **100 % · DPR 1**          | El caso peor. Cada rasgo es **una fila sólida de tinta**, no dos grises.      |
| **200 % · DPR 1**          | Lo exige `03-direccion.md` §3. El rasgo dobla y la contraforma no se cierra.  |
| **100 % · DPR 2**          | Que el suelo de 2 px no se vea grueso donde sobra resolución.                |
| **Escala de grises**       | 03 §3: si en gris deja de entenderse, no está terminado.                      |

El zoom al 200 % **no es el riesgo** —ahí todo crece—; el riesgo es el 100 % a DPR 1, que es donde
muere I5. Se prueban los dos porque el encargo pide el 200 % y porque el que falla es el otro.

### 6.4 Inventario cerrado — cinco dibujos

Toda la interfaz actual tiene **22 iconos SVG escritos a mano** (fase 0): 16 en `MarkdownPalette` y
6 en `TreeNodeRow`. Quedan cinco, y las bajas no son recortes: cada una la ordena una regla.

| Icono            | Tamaños  | Qué es                                                              |
| ---------------- | -------- | ------------------------------------------------------------------- |
| `marca`          | 24       | **La diagonal.** Una por pantalla, R8. El único dibujo girado.       |
| `vista-texto`    | 16       | Una masa vertical: el plano del panel de texto.                      |
| `vista-doble`    | 16       | Dos masas verticales separadas por el canal: el plano del split.     |
| `vista-preview`  | 16       | Tres barras horizontales de anchura decreciente: la silueta de un párrafo. |
| `cerrar`         | 12       | Masa cuadrada de 8 px en caja de 12, objetivo 26 × 26.               |

Los tres de vista se quedan siendo dibujo y no palabra por una razón concreta: **no son iconos de un
concepto, son el plano de la pantalla que producen.** Enseñan la disposición, que es lo que el
usuario elige. Un icono de «carpeta» representa; este muestra.

**Y las bajas, con su regla:**

| Baja                                     | Cuántos | Regla que la ordena                                                                          |
| ---------------------------------------- | ------: | -------------------------------------------------------------------------------------------- |
| Glifos de `MarkdownPalette`              |  **16** | Son `#`, `**`, `>`, `-`… **Se escriben en Chivo Mono, no se dibujan.** Dibujar un icono de un carácter es tener dos recursos para el mismo trabajo (03 §2). |
| Chevrón de despliegue del árbol          |   **1** | R8 (forma girada) y R6 (*«se incumple con triángulos de despliegue»*).                        |
| Icono de documento del árbol             |   **1** | R6: carpeta frente a documento es **altura de la barra** (14 / 6 px) y peso, no un icono.     |
| 4 trazos de acción de fila               |   **4** | *«En reposo, un control es solo su palabra»* (03 §4). Pasan a versalitas de 11 px visibles al hover o al foco de la fila, invirtiéndose. |
| «×» de cerrar pestaña                    |   **1** | **Son dos diagonales**, R8. Pasa a masa cuadrada — y de paso deja de ser un `<span>` no enfocable, que la fase 0 registró como defecto. |
| Lupa de buscar                           |   **0** | No existía; se declara prohibida antes de que alguien la dibuje (§6.1).                       |

### 6.5 Las tres reglas de icono

- **I-1 — `fill: currentColor`, `stroke: none`.** Un icono hereda la tinta de su fila y no elige
  color. **Cromo nunca**: R5 lo prohíbe expresamente en iconos, y `04-color.md` §1 lo repite en la
  columna de uso prohibido.
- **I-2 — El inventario es cerrado.** Un icono nuevo entra con la baja de otro o con una excepción
  escrita en este documento. Antes de dibujarlo hay que responder por qué no es una palabra.
- **I-3 — Todo icono va con `aria-hidden="true"` y `focusable="false"`**, y su control lleva nombre
  accesible en texto. Ya es criterio C-25 de la fase 0; aquí se hace regla del sistema. Corolario:
  **ningún icono es el único portador de un significado** — es la regla marco de 03 §3 aplicada al
  dibujo.

---

## 7 · Presupuesto — cuántos valores admite el sistema

Este es el número que la fase 13 compara contra el conteo de la fase 0. **Es un techo, no un
objetivo**: gastar menos está bien, gastar más es un fallo del guard.

| Eje                        | Cromo admite               | Fase 0 medía         | «Sano», fase 0 §3.11 |     |
| -------------------------- | -------------------------- | -------------------- | -------------------- | --- |
| **Pasos de espaciado**     | **7**                      | 13                   | 8–10                 | ✅  |
| **Radios**                 | **1** (cero)               | 3                    | 4–6                  | ✅  |
| **Anchos de borde**        | **1** (1 px)               | 6                    | 2–3                  | ✅  |
| Tokens de hairline         | 3                          | —                    | —                    | —   |
| **Sombras**                | **1**, y no es elevación   | 2                    | 3–5                  | ✅  |
| Superficies                | 4                          | —                    | —                    | —   |
| **Iconos (dibujos)**       | **5**                      | 22                   | —                    | ✅  |
| Tamaños de icono           | 3                          | 4                    | —                    | ✅  |
| Grosores de rasgo          | 2 (2 px, 3 px)             | 2 sistemas en conflicto | 1 sistema         | ✅  |
| **Duraciones**             | **1** (120 ms)             | 1                    | 3–4                  | ✅  |
| **Curvas**                 | **1** (`linear`)           | 1                    | 2–3                  | ✅  |
| Colores (tokens por tema)  | 13                         | 30                   | 12–16                | ✅  |
| Tonos neutros              | 8 (4 superficies + 4 tintas) | 10                 | 5–7                  | ⚠️  |
| Cuerpos tipográficos       | 8 (4 interfaz + 4 documento) | 7                  | 6–8                  | ✅  |
| Familias                   | 2 (Chivo · Chivo Mono)     | 2                    | 2                    | ✅  |
| Pesos                      | 3 (400·700·900) + 1 excepción escrita | 2 (+2 heredados) | 3–4          | ✅  |
| Interlineados              | 6                          | 7                    | 3–4                  | ⚠️  |
| **Alturas de control**     | **2** (26, 39)             | 4                    | 2–3                  | ✅  |
| **Anchos de contenedor**   | **2** (624, 260)           | 8                    | 3–4                  | ✅  |
| **z-index**                | **2** (0, 100)             | 1                    | 4–6                  | ✅  |
| **Sistemas de foco**       | **1**                      | 2                    | 1                    | ✅  |
| Opacidades                 | **0**                      | —                    | —                    | ✅  |
| Tramas                     | 1 (45°, paso 4 px)         | 0                    | —                    | —   |
| Puntos de ruptura          | **abierto** (§10)          | 1                    | 3–4                  | ⚠️  |

### 7.1 Las cuatro casillas que no son un ✅ limpio, dichas antes de que las encuentre nadie

1. **Tonos neutros: 8 contra un «sano» de 5–7.** Son 4 superficies y 4 tintas, y las ocho están
   medidas y asignadas en `04-color.md`. La cuarta superficie tiene excepción escrita (§10.1 de
   aquel documento) y `--tinta-desactivada` tiene la suya (§4). Se pasa por uno, con las dos razones
   por escrito.
2. **Interlineados: 6 contra un «sano» de 3–4**, casi lo mismo que los 7 de la fase 0. La cifra
   engaña: los 7 de entonces eran los implícitos de una escala de fábrica más un `leading-relaxed`
   usado una vez; estos 6 son {16, 21, 26, 27.4, 32.6, 65} y cada uno tiene un cuerpo asignado. **Lo
   que se arregla no es el número, es que ahora cada valor tiene dueño.** Se registra en vez de
   maquillarlo bajando uno a la fuerza.
3. **Duraciones y curvas siguen en 1, por debajo del «sano».** No es deuda: `03-direccion.md` §2
   fija **un único gesto en todo el sistema**. El eje existe, tiene exactamente el tamaño que la
   dirección le da, y `prefers-reduced-motion` lo lleva a 0 ms.
4. **Puntos de ruptura: abierto.** La fase 0 medía 1 (`md:`, usado una vez). Este documento **no lo
   cierra** porque el diseño adaptativo del split —dos columnas de 624 px no caben en un móvil— es
   una decisión de producto que no está tomada, y fijar tres puntos de ruptura aquí sería inventarla.
   Va a §10.

### 7.2 Cómo se cuenta, para que el número no dependa de quién mira

Igual que el color: **por valor computado en el bundle de producción, no por clase en el código
fuente**. Un `grep 'rounded'` no vale cuando el mismo radio puede llegar por `rounded`, por
`border-radius` en línea o por el agente de usuario en un `<input type="radio">`.

El contador de la fase 13 parsea el CSS emitido y cuenta valores distintos por propiedad
(`border-radius`, `box-shadow`, `border-width`, `transition-duration`, `transition-timing-function`,
`gap`, `padding-*`, `margin-*`, `z-index`), más un pase por el DOM en Playwright para lo que solo
existe en tiempo de ejecución. **Y se valida a sí mismo antes de contar**: si no encuentra el
bundle, o encuentra menos de N declaraciones, aborta con código 2 en vez de dar un cero — que es la
regla de `verification-and-measurement` y la que ya aplican `pnpm color:medir` y `pnpm tipo:medir`.

---

## 8 · Movimiento y textura, cerrados de paso

No los pedía el encargo, pero el presupuesto los cuenta y quedarían sin token.

| Token         | Valor      | Origen                                                                 |
| ------------- | ---------- | ---------------------------------------------------------------------- |
| `--duracion`  | **120 ms** | 03 §2, literal.                                                        |
| `--curva`     | **`linear`** | **Derivado.** Un desvanecido de opacidad no tiene cuerpo; cualquier curva le atribuye una inercia que el sistema no tiene. |
| `--trama-inerte` | 45°, paso 4 px | 03 §2. Ya existe en `index.css` con `background-size: 5.66px` = 4 × √2, que es el paso perpendicular correcto. |

Con `prefers-reduced-motion: reduce`, `--duracion` pasa a **0 ms** y no se pierde información,
*«porque la información estaba en la palabra»* (03 §2). La fase 0 registró **cero respeto a
`prefers-reduced-motion`** en todo el producto; esto lo cierra.

**Opacidades: cero valores.** El único uso de opacidad es el 0→1 del desvanecido. Ninguna
transparencia estructural: `opacity-40` y `opacity-50` de la fase 0 (estados deshabilitados) pasan a
`inerte` + `--tinta-desactivada`, que es lo que ya mandaba `04-color.md` §9 bis.

---

## 9 · Los tokens, y cómo se hacen exigibles

`apps/web/src/styles/tokens-sistema.css`:

```css
:root {
  /* Rejilla vertical: media línea del cuerpo del documento (26 px, 05-tipografia.md §7). */
  --linea: 26px;
  --rejilla: 13px;

  --spacing-nulo: 0;
  --spacing-fila: 4px;        /* solo horizontal */
  --spacing-grupo: 13px;      /* por defecto dentro de un grupo */
  --spacing-bloque: 26px;     /* por defecto entre grupos */
  --spacing-zona: 39px;       /* por defecto entre zonas */
  --spacing-marco: 52px;
  --spacing-identidad: 78px;

  --radio: 0;
  --hair: 1px;

  --foco-ancho: 4px;
  --foco-tinta: var(--tinta-principal);
  --foco-tinta-negativo: var(--sup-base);
  --foco-canal: 4px;

  --icono-rotulo: 12px;   --rasgo-rotulo: 2px;
  --icono-cuerpo: 16px;   --rasgo-cuerpo: 2px;
  --icono-aislado: 24px;  --rasgo-aislado: 3px;

  --duracion: 120ms;
  --curva: linear;

  --alto-fila: 26px;
  --alto-control: 39px;
  --medida-documento: 39rem;   /* 624 px = 48 × 13 */
  --ancho-estructura: 260px;   /* 20 × 13 */

  --capa-pagina: 0;
  --capa-superpuesta: 100;
}

@media (prefers-reduced-motion: reduce) {
  :root { --duracion: 0ms; }
}
```

Y en `index.css`, **el borrado de las escalas de fábrica**, exactamente la técnica que ya funcionó
con `--color-*` (`04-color.md` §9): la prohibición deja de ser una revisión y pasa a ser una clase
que no existe.

```css
@theme inline {
  --spacing: initial;        /* mata el multiplicador: `p-4`, `gap-6`, `mt-8` dejan de existir */
  --spacing-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --inset-shadow-*: initial;
  --drop-shadow-*: initial;
  --text-shadow-*: initial;
  --blur-*: initial;
  --ease-*: initial;
  --animate-*: initial;

  --spacing-nulo: var(--spacing-nulo);
  --spacing-fila: var(--spacing-fila);
  --spacing-grupo: var(--spacing-grupo);
  --spacing-bloque: var(--spacing-bloque);
  --spacing-zona: var(--spacing-zona);
  --spacing-marco: var(--spacing-marco);
  --spacing-identidad: var(--spacing-identidad);
  --ease-cromo: var(--curva);
}
```

Se escribe `gap-grupo`, `p-zona`, `mt-identidad`, `px-fila`.

> **Esto hay que verificarlo en el bundle, no creérselo.** `04-color.md` §0 comprobó en el CSS de
> producción que `bg-sup-base` compilaba a `background-color: var(--sup-base)` y que el borrado de
> la paleta bajaba el CSS de 28.4 KB a 22.5 KB. Aquí toca lo mismo y **está sin hacer**: comprobar
> que `p-4`, `rounded-md` y `shadow-sm` **no aparecen** en el bundle, y que `gap-grupo` sí. Que
> `--spacing: initial` desactive el multiplicador dinámico es lo esperado según la documentación de
> Tailwind v4, **no algo que este documento haya medido todavía.**

### 9.1 Lo que el guard tiene que fallar

`apps/web/src/design/sistema-guard.test.ts`, junto al de color y con la misma regla de validarse a
sí mismo (si no encuentra archivos o encuentra menos declaraciones de las esperadas, falla en vez de
pasar):

| Regla                                                                     | Cómo se comprueba                              |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| Ningún `border-radius` computado distinto de `0px`; ningún `rx`/`ry` en SVG | Por valor, en el CSS emitido y en los `.tsx`   |
| Ningún `box-shadow` que no sea el eje de foco                             | Por valor                                      |
| Ningún `stroke` ni `stroke-width` en ningún `<svg>`                       | Por literal                                    |
| Ningún espacio vertical que no sea múltiplo de 13 (salvo el resto de §1.7) | Por valor, sobre `margin-block`/`padding-block`/`row-gap`/`height` |
| Ningún `:focus` sin `-visible`                                            | Por literal, en `.css`, `.ts` y `.tsx`         |
| Ningún `outline: none` fuera de la regla que aplica `foco-eje`            | Por contexto                                   |
| Ningún elemento enfocable sin `foco-eje`                                  | Playwright, recorrido con tabulador por pantalla |
| Ningún objetivo táctil por debajo de 24 × 24 px                           | Playwright, `getBoundingClientRect`            |
| Ningún `transition` con duración distinta de `--duracion`                 | Por valor                                      |

---

## 10 · Lo que queda abierto

1. **Puntos de ruptura.** Sin decidir, y a propósito (§7.1.4). Dos columnas de 624 px piden 1288 px
   de viewport; qué hace el split por debajo de eso es producto, no estilo.
2. **La verificación en el bundle de §9 está sin correr.** Es lo único de este documento que afirma
   un comportamiento de herramienta sin haberlo medido en este repositorio.
3. **El aire de abajo de `h1` y `h2` (6.4 y 11.6 px) es subpíxel.** Cuadra en la aritmética y hay
   que confirmar en el navegador que el acumulado de una página larga no deriva por redondeo. Se
   mide con el mismo instrumento del espécimen (`getBoundingClientRect` sobre la línea base), no a
   ojo.
4. **`--ancho-estructura` sube de 256 a 260 px.** Es una derivación de este documento (caer en la
   rejilla), no una decisión de una fase anterior. Cuesta 4 px de árbol y se puede revertir.
5. **La línea del cuerpo de 21 px pasa de 26.3 a 26 px** para caer en el compás de la fila. Son
   0.3 px y no cambia ninguna medida de la fase 5, pero **toca su tabla** y por eso se dice aquí en
   vez de cambiarla en silencio.
6. **El cuerpo de 60 px no estaba tabulado en la fase 5** §4, que solo listó 21/15/11. Se completa
   en §11 con dos valores derivados —línea 65 px y tracking −0.02em— y el tracking hay que
   confirmarlo ópticamente en el espécimen: está extrapolado de la serie (0 → −0.008 → −0.012), no
   medido.

---

## 11 · Anexo — el cuerpo de 60 px, completado

| Uso                     | Tamaño | Interlineado         | Tracking      | Peso |
| ----------------------- | ------ | -------------------- | ------------- | ---- |
| Identidad del documento | 60 px  | **65 px** (1.083)    | **−0.02em**   | 900  |

**65 px es 5 × 13**: la identidad ocupa exactamente el mismo bloque que un encabezado del preview
(§1.7), que es lo que hace que el nombre en la cabecera y el primer título del preview se lean como
el mismo objeto — el efecto que R7 declara intencionado.

**Y el aviso, porque el margen es de 0.2 px.** La caja de fuente de Chivo mide 1.19 em (940 + 250,
fase 5 §1); a 60 px son **71.4 px**, más que la caja de línea de 65. El medio interlineado es
negativo, **−3.2 px por lado**. La versal acentuada llega a 890 de 1000, o sea **3 px por debajo del
borde de la caja de fuente**, así que su punta queda **0.2 px por encima del borde de la caja de
línea**.

No se recorta —los glifos se pintan fuera de su caja de línea sin problema— pero **`overflow: hidden`
sobre esa línea sí la recortaría**, y en español un `Í` o un `Ñ` en el nombre de un documento no es
un caso raro. Regla: **la línea de identidad no lleva `overflow: hidden`**; si hay que truncar un
nombre largo, se trunca por caracteres, no por caja.

---

## 12 · Cierre — el sistema en una pregunta

La de `03-direccion.md` §6 sigue siendo la única que hace falta:

> **¿Se puede quitar de esta pantalla toda la línea, toda la sombra y todo el color, y sigue
> diciendo lo mismo?**

Este documento la hace casi trivial de responder, y esa era la intención: hay **un** ancho de línea
y solo delimita capas superpuestas; hay **una** sombra y no es elevación; hay **un** radio y es
cero. Lo que queda diciendo las cosas es lo que la dirección quería que las dijera desde el
principio — el aire, el escalón, el cuerpo, el peso, la masa y la palabra.
