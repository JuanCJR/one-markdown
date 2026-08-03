# Dirección — Cromo

**Fase 3 · Documento de referencia.** Cromo es la dirección elegida al cierre de la fase 2. Este
documento sustituye a `02-mundo-cromo.md` como norma: aquello era una defensa, esto es la regla.
Todo lo que se diseñe a partir de hoy para One Markdown se juzga contra este texto. Pantalla de
referencia implementada: `Cromo.dc.html`.

Origen declarado: concretismo brasileño y el rediseño del *Jornal do Brasil* de Amílcar de Castro
(1959) — un rediseño hecho para leer texto denso, no para lucir. El nombre del mundo no es el de la
tradición: *cromo* es el amarillo del único primario.

Materiales fijos:

| | claro | oscuro |
|---|---|---|
| papel | `#f4f4f2` | `#131414` |
| panel (+1 escalón) | `#edede9` | `#1a1b1b` |
| hundido (+2 escalones) | `#e7e7e3` | `#202121` |
| tinta | `#17181a` | `#ecebe9` |
| tinta apagada | `#6d6f70` | `#8e908f` |
| cromo | `#e9b21b` | `#f0bc23` |

Tipografía: Chivo, pesos 400 y 900 (300 admitido solo en el cuerpo de 60 px si un nombre largo lo
exige). Sobre cromo, el texto es siempre `#17181a`, en los dos temas.

---

## 1. La gramática

Ocho reglas. Cada una está escrita para poder incumplirse: lleva la condición exacta que la rompe.
Si una revisión no puede señalar qué regla se incumplió, la revisión no ha revisado nada.

**R1 — Las zonas se separan con espacio o con un escalón de superficie, nunca con una línea.**
El escalón es de un solo paso de la escalera de tres (papel → panel → hundido).
*Se incumple* cuando aparece un `border`, un `hr`, una sombra o un radio entre dos zonas, o cuando
dos zonas contiguas saltan dos escalones a la vez.

**R2 — Existen cuatro cuerpos y ninguno intermedio: 11, 15, 21, 60.**
*Se incumple* con cualquier tamaño de letra que no sea uno de esos cuatro; incluido el «14 porque
15 no cabía». Si no cabe, se recorta el texto o se estrecha la columna, no se baja medio punto.

**R3 — Existen tres medidas de espacio: 4, 12 y 40.** 4 dentro de una fila, 12 dentro de un grupo,
40 entre zonas.
*Se incumple* con cualquier `padding`, `gap` o `margin` que no sea 4, 12, 40 o una suma exacta de
ellos por concatenación de cajas (un 24 no se escribe: se escriben dos 12 con una caja en medio).
Excepción cerrada y única: los ajustes ópticos de ±2 px dentro de un control ya construido, que
nunca crean estructura.

**R4 — Toda zona tiene un eje izquierdo y todo lo que pertenece a la zona cuelga de él.**
El borde derecho queda irregular; el irregular es la firma.
*Se incumple* con `text-align: center`, con `justify-content: center`, con texto justificado, y con
cualquier elemento sangrado respecto al eje de su zona para «indicar jerarquía» (para eso está R6).

**R5 — El primario aparece como masa, con 8 px de lado como mínimo, y como máximo una vez por
zona.** Nunca como texto, nunca como línea, nunca como borde.
*Se incumple* con cromo en un `color:`, en un `border`, en un icono, o con dos masas cromo visibles
simultáneamente dentro de la misma zona.

**R6 — La jerarquía se dice con la medida de una masa; la clase, con su altura.**
Nivel del árbol = anchura de la barra (58 px en la raíz, −7 px por nivel, mínimo 10 px, alineadas
contra un eje común). Carpeta = 14 px de alto; documento = 6 px.
*Se incumple* con sangría acumulativa, con triángulos de despliegue, con líneas de guía, y con
barras cuya anchura no derive del nivel.

**R7 — El cuerpo de 60 px identifica el documento abierto y se usa una vez por zona.**
Que aparezca dos veces en pantalla —en la cabecera y en el primer título del preview— es
intencionado: es lo que hace que las dos mitades se lean como el mismo documento.
*Se incumple* cuando el 60 se usa para una cifra, para un dato, para un mensaje de estado vacío o
para un segundo objeto dentro de la misma zona.

**R8 — La diagonal aparece exactamente una vez en la pantalla: la marca.**
La única otra diagonal admitida en el sistema es la trama de inerte de §3, que no es una figura sino
un relleno.
*Se incumple* con cualquier rotación, cursor, flecha, chevrón o forma girada añadida a la interfaz.

---

## 2. El principio semántico

Un recurso, un trabajo. Un recurso con dos trabajos produce ambigüedad; dos recursos para el mismo
trabajo producen ruido. La tabla es cerrada: si un dato nuevo no encaja en ninguna fila, no se
inventa un recurso — se resuelve con palabra.

**Color — cromo: «esto es lo activo ahora mismo».**
Nodo seleccionado, pestaña activa, elemento de la paleta recién usado, bloque del preview donde
vive el cursor, filtro de rama aplicado. No advierte, no jerarquiza, no clasifica, no decora, no
indica éxito. Cromo es un dedo señalando el presente. Si aparece en algo que no es «aquí estoy»,
es un error de implementación, no una licencia.

**Masa de tinta (fondo tinta, texto en negativo) — «estado que hay que leer».**
`Sin guardar`, `Solo lectura`, `3 conflictos`. Guardar hace desaparecer una masa negra, no un color:
por eso tinta y cromo nunca compiten. La masa de tinta no es pulsable; describe, no ofrece.

**Peso — «contiene» frente a «es contenido».**
900 en carpetas, en el nombre del documento abierto y en los títulos de nivel 1 y 2 del preview.
400 en documentos, en párrafos y en todo lo demás. El peso no marca importancia, ni actividad, ni
selección.

**Cuerpo — quién habla.**
11 px en versalitas: habla la aplicación (nombres de zona, unidades, rótulos de estado). 15 px:
habla la estructura (árbol y pestañas). 21 px: habla el documento. 60 px: la identidad del
documento abierto. Ninguna palabra escrita por la persona aparece nunca en versalitas de 11.

**Estilo de letra — cursiva: la voz del documento.**
La cursiva pertenece al texto de la persona (`*así*` y las citas) y no se usa jamás en la interfaz.
Consecuencia asumida: ningún estado del sistema puede ser cursiva.

**Posición — pertenencia.**
El eje izquierdo dice de qué zona es cada cosa; el orden vertical dice el orden del documento o de
la lista. La posición no codifica jerarquía (R6) ni estado. Corolario operativo: el orden de las
zonas en pantalla es estable entre pantallas —cabecera, ruta, identidad, pestañas, estructura a la
izquierda, trabajo a la derecha— y una pantalla nueva ocupa las mismas franjas o declara por qué no.

**Textura — trama diagonal de 4 px: «inerte».**
Lo que existe pero no se puede editar ahora: elementos en la papelera, versiones anteriores a la
actual, documentos en solo lectura, zonas deshabilitadas. Un solo ángulo (45°), un solo paso, y
siempre en tinta apagada sobre el escalón que le toque. La trama no significa selección, ni error,
ni carga.

**Movimiento — confirmar un cambio de estado que la persona provocó y podría no ver.**
Un único gesto en todo el sistema: la masa de tinta se desvanece en 120 ms al resolverse el estado
(al guardar, al restaurar, al vaciar). Nada entra deslizándose, nada rebota, nada pulsa en bucle,
nada se anima al pasar el ratón. Con `prefers-reduced-motion` el desvanecido es un corte y no se
pierde información, porque la información estaba en la palabra.

**Hover y foco de teclado — inversión.**
No son recursos semánticos: son el acuse de recibo del puntero y del teclado. Hover invierte la masa
del control. El foco de teclado es masa cromo **más** desplazamiento del eje de 4 px, porque cromo
solo ya está ocupado por «activo» y hay que distinguir «activo» de «enfocado».

---

## 3. La redundancia de accesibilidad

Regla marco: **el color nunca es el único canal.** Ordnance Survey trama sus polígonos por
daltonismo, no por gusto; aquí se hace lo mismo, y la trama no decora nada.

| Hoy lo dice el color | Segundo canal obligatorio |
|---|---|
| Nodo seleccionado (masa cromo bajo el nombre) | Superficie: la fila sube un escalón (papel → hundido). Y la ruta de la cabecera nombra el nodo. |
| Pestaña activa (barra cromo de 8 px) | Peso: 900 frente a 400, y tinta plena frente a tinta apagada. |
| Pestaña con cambios sin guardar | Palabra en masa de tinta: `sin guardar`. El color no participa. |
| Estado de guardado en la cabecera | Palabra y forma: `Sin guardar` en negativo sobre tinta, `Guardado 14:32` sin masa. |
| Elemento de la paleta recién usado | Posición estable en la rejilla + inversión de la tinta del código. |
| Bloque del preview con el cursor | La barra izquierda de 12 px pasa de 0 a 12 px de anchura: es un cambio de forma, no solo de tono. Y el editor escribe `Línea 12 · col. 4`. |
| Nivel de profundidad | No lo dice el color: lo dice la anchura de la barra (R6) y la ruta escrita. |
| Carpeta frente a documento | Altura de la barra (14 / 6 px) y peso (900 / 400). |
| Elemento inerte (papelera, versión antigua) | Trama diagonal de 4 px **y** palabra (`en papelera`, `versión anterior`). |
| Rama activa en el filtro | Masa cromo **y** el rótulo `2 de 5 ramas` en versalitas junto a la zona. |
| Conflicto o error | No tiene color. Masa de tinta con la palabra, en la franja de estado. El rojo no existe en Cromo. |

Comprobaciones que no son opcionales: contraste ≥ 4,5:1 para todo texto de 11 y 15 px en los dos
temas; cromo verificado masa a masa sobre papel, panel y hundido (el amarillo sube de valor en
oscuro y hay que medirlo, no suponerlo); foco de teclado visible en las dos mitades con el zoom del
navegador al 200 %; y una pasada completa en escala de grises antes de dar por cerrada cualquier
pantalla — si en gris deja de entenderse, la pantalla no está terminada.

---

## 4. Lo que esta dirección prohíbe, dicho en positivo

- **La profundidad se expresa con una escalera de tres superficies** —papel, panel, hundido— y con
  un paso por vez. No hay una cuarta superficie, y no se pide prestada la sombra.
- **La separación se expresa con aire:** 40 px entre zonas, o un escalón. Cuando dos zonas se
  confunden, se aumenta el aire.
- **El énfasis se expresa con cuerpo y con masa.** Lo importante es más grande o está en negativo.
- **La agrupación se expresa compartiendo eje.** Lo que se alinea, va junto; lo que no, no.
- **La jerarquía del árbol se expresa con la medida de una masa** (R6), y se lee como una silueta.
- **El estado se expresa con una palabra en negativo,** en una franja estable de la pantalla.
- **Lo interactivo se declara invirtiéndose** al ratón y al teclado; en reposo, un control es solo
  su palabra.
- **La clasificación se expresa con posición y altura,** no con una paleta de categorías.
- **El vacío se expresa con una frase de 15 px sobre el eje de la zona** y una acción en palabra
  debajo. No hay ilustraciones, ni figuras, ni mascotas.
- **La carga se expresa sustituyendo el contenido por su propia silueta en el escalón hundido:**
  las barras de nivel ya son la forma de la lista.
- **La marca es la diagonal, una vez.**

---

## 5. Tres pantallas futuras, resueltas con esta gramática

**Búsqueda global.** No es un panel flotante ni un modal: sustituye la mitad derecha (la del
trabajo), y la estructura sigue a la izquierda, en su franja de siempre. Arriba, el término buscado
ocupa el cuerpo de 60 px —es la identidad de lo que estás mirando ahora, exactamente como el nombre
del documento abierto, R7—, con `147 coincidencias · 23 documentos` en versalitas de 11 debajo.
Cada resultado es una fila de la misma rejilla del árbol: barra de nivel a la izquierda (así se ve
de qué profundidad viene sin leer la ruta), nombre a 15 px, y la línea encontrada a 21 px en la
línea siguiente, colgando del mismo eje, con el término en masa de tinta —no en cromo: cromo está
ocupado por «lo activo», y aquí lo activo es el resultado sobre el que estás. Los grupos por rama se
separan con 40 px y un rótulo de 11 px; no hay líneas. Cero resultados: la frase de 15 px sobre el
eje y `Vaciar la búsqueda` debajo.

**Papelera.** Es la estructura habitual, con toda la zona sobre el escalón hundido y toda ella
tramada al 45° — inerte por definición, y por eso legible de un vistazo incluso en gris. Las barras
de nivel se conservan: lo borrado mantiene la forma de su profundidad de origen, que es lo que
permite entender de dónde salió. Cada fila lleva su ruta en versalitas de 11 px bajo el nombre
(`Cocina / Fermentos`) y los días que le quedan como palabra en masa de tinta: `quedan 12 días`,
`quedan 2 días` — la urgencia es una palabra, no un color; el rojo no existe aquí. La selección
sigue siendo cromo, porque seleccionar es una acción del presente sobre algo inerte, y las dos
lecturas no chocan: trama = qué es, cromo = dónde estás. Al pie de la zona, `Restaurar` y `Vaciar la
papelera` en versalitas, separados 40 px; vaciar exige teclear la palabra `vaciar` en un campo sin
borde —el campo es un escalón hundido y un eje— porque en este sistema un diálogo de confirmación
con caja no cabe.

**Historial de versiones.** La mitad derecha se parte en dos columnas de 21 px separadas por 40 px:
la versión elegida y la actual, mismo eje, mismo cuerpo, misma medida. La comparación la hace la
rejilla, no el color: lo que solo está en una de las dos aparece en masa de tinta con su palabra al
margen (`añadido`, `retirado`) en versalitas de 11; lo idéntico, en tinta apagada. La lista de
versiones ocupa la franja de la estructura, a la izquierda: cada versión es una fila con la fecha a
15 px, `1 240 palabras` en 11 px, y una barra cuya anchura es la magnitud del cambio —el mismo
recurso de R6 midiendo otra cosa, que es lo que hace que el sistema se sienta uno—. Todas las
versiones anteriores a la actual van tramadas: son inertes hasta que restaures. La versión que estás
mirando es cromo; la actual, la única sin trama, encabeza la lista. `Restaurar esta versión` en
palabra al pie, y al confirmarse, la masa `Restaurado` se desvanece en 120 ms: el único movimiento
del sistema, haciendo su único trabajo.

---

## 6. El criterio de rechazo

> **¿Se puede quitar de esta pantalla toda la línea, toda la sombra y todo el color, y sigue
> diciendo lo mismo?**

Si la respuesta es no, la pantalla no pertenece a Cromo. Si es sí, quítalos: no los necesitaba.
