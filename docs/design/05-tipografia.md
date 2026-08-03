# 05 · Tipografía — superfamilia «Chivo / Chivo Mono»

**Documento normativo del repositorio.** A diferencia de `04-color.md`, aquí los valores **no
vienen cerrados de una sesión anterior**: se deciden en este documento y se miden en este
repositorio. Lo que se dice, se comprueba con un comando.

| Qué                                   | Dónde                                                       |
| ------------------------------------- | ----------------------------------------------------------- |
| Caras `@font-face` y tokens de escala | `apps/web/src/styles/tipografia.css`                        |
| Archivos de fuente (OFL 1.1)          | `apps/web/public/fuentes/` · licencia en `OFL.txt`          |
| Medidor sobre los binarios            | `tools/tipografia/medir-tipografia.mjs` · `pnpm tipo:medir` |
| Espécimen con conmutador de tema      | `docs/design/muestra-tipografia.html` · `pnpm tipo:muestra` |

---

## 1 · La decisión, y por qué es funcional y no estética

**Chivo Mono en el panel de texto, Chivo en el preview y en toda la interfaz.** Las dos son de
Omnibus-Type (Argentina), OFL 1.1, variables, y salen del **mismo proyecto**
(`github.com/Omnibus-Type/Chivo`).

El argumento no es que Chivo sea bonita. Es este: esta app enseña el markdown crudo y el documento
compuesto **a la vez, lado a lado, del mismo texto**, y eso solo funciona si el lector percibe un
documento en dos estados y no dos documentos. Con una mono y una proporcional que no son parientes
—lo que hacen VS Code y HackMD— el ojo tiene que reconciliar dos alturas-x, dos versales y dos ejes
distintos cada vez que cruza la medianera, y el preview deja de leerse como el mismo texto para
leerse como un resultado. Chivo y Chivo Mono **comparten la caja vertical glifo a glifo**: altura-x
511, versal 686, ascendente 720, descendente −181, versal acentuada 890, todo sobre un em de 1000, y
la misma ascendente y descendente de fuente (940 / −250).

No es «parecido»: es idéntico, y `pnpm tipo:medir` sale con código 1 el día que deje de serlo. Esa
es la diferencia entre elegir una superfamilia y decir que se ha elegido una.

De ahí sale, además, una consecuencia que ahorra un parche: **el código en línea del preview no
lleva el `0.9em` de costumbre**. Ese ajuste existe para disimular que la mono de turno tiene otra
altura-x. Aquí no la tiene, así que `code` va a `1em` y cae en la misma línea que la prosa.

---

## 2 · Por qué latinoamericana, y qué se ha descartado

La app tiene la interfaz **solo en español** (`docs/producto/01-que-es.md`) y ninguno de los 25
productos de escritura del Anexo C compone con tipografía latinoamericana. Es el argumento de
identidad más difícil de copiar que tiene este producto: no es un guiño, es que la letra la dibujó
gente que escribe en este idioma.

Lo que se ha mirado, con el diseñador verificado en los metadatos de Google Fonts y no de memoria:

| Fundición · familia                                          | Diseñador (verificado)         | Por qué no                                                     |
| ------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------- |
| **Omnibus-Type · Chivo + Chivo Mono**                        | Omnibus-Type                   | **Elegida.** Único par mono+proporcional libre y emparentado.  |
| Omnibus-Type · Archivo, Saira                                | Omnibus-Type                   | Superfamilias reales, pero **sin monoespaciada**.              |
| Huerta Tipográfica · Alegreya + A. Sans                      | Juan Pablo del Peral, HT Fonts | Serif+sans excelente para español; **sin mono**. Forzaría (b). |
| Huerta Tipográfica · Bitter, Piazzolla                       | Sol Matas · J. P. del Peral    | Íd.: sin mono.                                                 |
| Tipotype (UY), Latinotype (CL), Sudtipos (AR), Sumotype (CO) | —                              | Catálogo de retail: sin superfamilia mono+proporcional libre.  |

Sobre la última fila, y se dice en vez de fingir que se ha comprobado: **no he revisado el catálogo
comercial completo de esas cuatro fundiciones en esta sesión.** Lo que sí he verificado es que
ninguna tiene en Google Fonts una superfamilia mono+proporcional. Si alguna la tiene bajo licencia
de pago, la objeción de fondo sigue en pie igual: una licencia web facturada mete una dependencia
de renovación en el camino crítico de un producto que hoy no tiene ninguna.

Descartar Alegreya duele —es una superfamilia premiada y dibujada para literatura en español—, pero
emparejarla con una mono ajena es exactamente la estrategia (b) que este documento prohíbe.

**Y el contraste con la alternativa fuerte de fuera:** IBM Plex Sans + Plex Mono también comparten
métrica exacta (medido: x 516, versal 698, Á 949 en las dos). Es una superfamilia igual de honesta.
Pierde por dos razones concretas, no por bandera: **Plex Mono no es variable** en Google Fonts —haría
falta una cara estática por peso, y el sistema usa 400, 700 y 900—, y no aporta el argumento de
identidad. Con la métrica empatada, decide lo que las separa.

---

## 3 · Qué se carga exactamente

Las seis caras están en `apps/web/public/fuentes/`. Las dos familias son **variables en `wght`
100..900**, así que los pesos 400, 700 y 900 del sistema **no cuestan un byte adicional**.

| Archivo                       | Cara                    | Glifos |        Peso | Cuándo se descarga               |
| ----------------------------- | ----------------------- | -----: | ----------: | -------------------------------- |
| `chivomono-latin.woff2`       | Mono redonda, 100..900  |    323 | **25.7 KB** | **Siempre** · preload            |
| `chivo-latin.woff2`           | Chivo redonda, 100..900 |    300 | **32.4 KB** | **Siempre** · preload            |
| `chivo-italic-latin.woff2`    | Chivo cursiva, 100..900 |    312 |     37.1 KB | Al primer `*énfasis*` compuesto  |
| `chivo-latinext.woff2`        | Chivo redonda, Ext-A    |    390 |     24.2 KB | Solo si aparece un carácter suyo |
| `chivomono-latinext.woff2`    | Mono redonda, Ext-A     |    387 |     22.4 KB | Íd.                              |
| `chivo-italic-latinext.woff2` | Chivo cursiva, Ext-A    |    390 |     26.5 KB | Íd.                              |

**Camino crítico: 58.2 KB.** El español entero —tildes, Ñ, Ü, ¿, ¡, «», €— vive en la subdivisión
`latin`, así que en uso normal la app arranca con **dos archivos** y no toca los otros cuatro. Eso
lo hace `unicode-range`, que no es decoración: sin él serían 168.3 KB de golpe.

**Lo que deliberadamente NO se carga: la cursiva de Chivo Mono (28.9 KB).** El panel de texto
enseña markdown crudo, donde `*énfasis*` son asteriscos literales, y los bloques de código no llevan
cursiva. Una cara que nunca se pide no se declara.

**`font-display: swap`** y `<link rel="preload">` de las dos caras del camino crítico.

> **Lo que falta, y se dice:** no hay una cara de respaldo con la métrica ajustada
> (`size-adjust` / `ascent-override`) para que el `swap` no produzca reflujo. Calcularla exige medir
> las fuentes del sistema, y **en este entorno no las tengo para medirlas**; escribir un
> `size-adjust` de memoria sería justo el tipo de número inventado que este repositorio no admite.
> La mitigación en pie es el `preload`. Queda como tarea abierta, no como olvido.

---

## 4 · La escala

Dos escalas, porque son dos trabajos. **El documento va un paso por encima de la interfaz**: el
cromo no puede gritar más que el texto del usuario.

### Documento — base 16 px, línea 26 px

La línea es un número redondo de píxeles a propósito: es la **unidad vertical** del documento, y
todo el espaciado del preview es múltiplo de 13 px para que la rejilla vuelva a cuadrar después de
cada encabezado.

| Nivel  | Tamaño           | Interlineado   | Tracking | Peso · tinta         |
| ------ | ---------------- | -------------- | -------- | -------------------- |
| Cuerpo | 1rem · **16 px** | 1.625 · 26 px  | 0        | 400 · principal      |
| `h1`   | 1.67em · 26.7 px | 1.22 · 32.6 px | −0.012em | 700 · principal      |
| `h2`   | 1.34em · 21.4 px | 1.28 · 27.4 px | −0.008em | 700 · principal      |
| `h3`   | 1.15em · 18.4 px | 1.41 · 26.0 px | −0.004em | 700 · principal      |
| `h4`   | 1em · 16 px      | 1.625          | 0        | **900** · principal  |
| `h5`   | 1em · 16 px      | 1.625          | 0        | 700 · **secundaria** |
| `h6`   | 1em · 16 px      | 1.625          | 0        | 700 · **tenue**      |

**Ningún salto entre dos niveles consecutivos supera 1.25×:** h1/h2 = **1.246**, h2/h3 = **1.165**,
h3/cuerpo = **1.15**. h4, h5 y h6 van al cuerpo y se separan por peso y por tinta, así que no
cuentan como salto.

> El ejemplo del encargo —h1 1.68 / h2 1.34— da **1.2537**, que se pasa de su propia regla por poco.
> Se ha bajado el h1 a **1.67em** para que el cociente caiga en 1.246 y la regla se cumpla entera.

La razón de la escala corta es el split, no el gusto: un `h1` a 2.5em rompe la ilusión porque **al
otro lado no existe nada equivalente** —al otro lado hay `#` y un espacio—. El tracking negativo
sube con el tamaño porque las prosaicas de Chivo están ajustadas para cuerpo de texto y a 26 px se
ven sueltas; es compensación óptica, y por eso es proporcional al cuerpo (`em`) y no fija.

`h4` a peso 900 y no 700 para que **no se confunda con un `**negrita**` de párrafo**, que va a 700.

### Interfaz — 21 / 15 / 11 px

Los cuerpos que ya mide `04-color.md` §2, sin inventar ninguno nuevo.

| Uso                  | Tamaño | Interlineado   | Tracking    | Peso |
| -------------------- | ------ | -------------- | ----------- | ---- |
| Título de aplicación | 21 px  | 1.25 · 26.3 px | −0.008em    | 900  |
| Cuerpo de interfaz   | 15 px  | 1.4 · 21 px    | 0           | 400  |
| Rótulo (versalitas)  | 11 px  | 1.45 · 16 px   | **+0.06em** | 700  |

El rótulo lleva tracking **positivo** porque va en versalitas por `text-transform`, y las versales
apiñadas necesitan aire; es el caso contrario al del titular. 11 px es el suelo del sistema de color
y no se baja de ahí.

---

## 5 · OpenType: lo que hay, lo que se apaga y lo que sería decoración

Features realmente presentes, leídas del binario y no del catálogo:

- **Chivo**: `ccmp dnom frac liga numr pnum tnum kern mark mkmk`
- **Chivo Mono**: las mismas **menos `kern`** (correcto en una monoespaciada)

### `liga` apagada en el panel de texto — la decisión más importante de esta sección

**Chivo Mono trae ligaduras y las trae activas, y rompen la rejilla.** Medido con fontkit y
reconfirmado en el navegador:

| Cadena       | Con `liga` | Sin `liga` | Esperado |
| ------------ | ---------: | ---------: | -------: |
| `fi`         |    9.61 px |   19.20 px | 19.22 px |
| `ffi`        |    9.61 px |   28.81 px | 28.83 px |
| `fichero`    |   57.61 px |   67.20 px | 67.27 px |
| `definición` |   86.41 px |   96.02 px | 96.09 px |
| `perfil`     |   48.02 px |   57.61 px | 57.66 px |

«fi» son dos caracteres que se componen en **un glifo de un solo avance**: la columna se descuadra, y
en español pasa todo el rato —_definición_, _fichero_, _perfil_, _confirmar_, _notificación_—, justo
donde el usuario está mirando el cursor.

Se apaga con **`font-variant-ligatures: none`** y **no** con `font-feature-settings`. La razón es
concreta: la propiedad estándar toca `liga`/`clig`/`dlig`/`hlig` y **deja en paz a `ccmp`**, que es
la que compone los acentos. Apagar de más ahí rompería `á`, `é`, `ñ` y `ü` — curarse en salud
saldría más caro que la enfermedad. El medidor lo comprueba en los dos sentidos: rejilla intacta
**y** los siete acentos siguen dando siete glifos, ninguno `.notdef`.

En el **preview** las ligaduras se quedan encendidas: ahí no hay rejilla que romper y `fi`/`fl`
mejoran la mancha.

### `tnum`: medido, es un no-op

Las diez cifras de Chivo miden **615 unidades cada una** y las de Chivo Mono **600**: ya son
tabulares por defecto. `font-feature-settings: "tnum"` da exactamente el mismo avance total
(6150 = 6150), así que **declararlo en general sería decoración**. Sí se declara
`font-variant-numeric: tabular-nums` en las columnas de cifras del preview, como red por si algún
día se cambia de fuente, y el medidor vigila que el supuesto siga siendo cierto.

Corolario honesto: Chivo **tampoco tiene cifras proporcionales de verdad** (`pnum` da el mismo
avance). En prosa corrida los dígitos van un pelo anchos y no hay forma de arreglarlo desde CSS.

### No hay sets estilísticos

Chivo no trae `ss01`..`ss0n`, así que **el ajuste fino a lo Raycast no está disponible por esa vía**
y no se finge que sí. Lo que este proyecto tiene en su lugar es el eje variable y el control de
ligaduras de arriba.

### Cursiva

`italicAngle −8.05°`, y hay **dibujo nuevo**, no una inclinación: la `g` pasa de doble piso a un
piso y la `f` se redibuja. No es una cursiva humanística completa —la `a` sigue siendo de doble
piso—, y se dice tal cual en vez de venderla como lo que no es.

---

## 6 · Medida de línea — y un conflicto que se registra en vez de taparse

**La verdad es el ancho en píxeles, no `ch`.** Medido: 1ch de Chivo Mono son 9.60 px y 1ch de Chivo
son 9.84 px a cuerpo 16. «Los mismos 68ch» darían dos columnas de **ancho físico distinto**, que es
exactamente lo que rompe la ilusión del split.

**Decisión: `--medida-documento: 39rem` = 624 px, idéntica en los dos paneles y centrada en cada
uno.** Son **65.0ch** del panel de texto, el suelo del rango pedido.

Por qué el suelo y no el centro:

> El carácter medio de prosa española en Chivo mide 0.479 em; 1ch de mono, 0.600 em. El cociente es
> **1.253 y es fijo: no depende del cuerpo**, porque al subir el tamaño suben las dos anchuras a la
> vez. Así que «65-72ch en el editor» **obliga** a 81-90 caracteres de prosa al otro lado, por
> encima del clásico 45-75. Para que el preview cayera en 75, el editor tendría que ir a **59.9ch**,
> fuera del rango.

Las dos restricciones no caben juntas. No es un descuido de la elección: es geometría de las dos
familias. Se ha cogido el extremo del rango que menos daño hace y **queda escrito**; el espécimen lo
marca con «▲ decisión escrita · §6» en vez de con un ✔ que sería mentira o un ✗ que sería alarmismo.
Medido a 624 px: **65.0 caracteres por línea en el editor, 81.8 en el preview, 15.1 palabras**.

Si prefieres prosa por debajo de 75 caracteres, el cambio es una línea —`--medida-documento: 36rem`
(576 px, 60ch de mono, 75.5 de prosa)— y sale del rango que fijaste. **Es tu decisión, no mía, y
hasta que la tomes no se toca.**

---

## 7 · Interlineado, fijado midiendo

Chivo tiene **altura-x alta** (0.511 em, 74.5 % de la versal) y **ascendentes cortas** (0.720 em),
que es justo el caso en que la regla dice subir. Se sube: **1.625 (26 px)**, no 1.5.

La holgura real entre el descendente de una línea y el acento de la siguiente, medida:

| Interlineado | Tilde de caja baja vs descendente | Versal acentuada vs descendente |
| ------------ | --------------------------------: | ------------------------------: |
| 1.50         |                           8.85 px |                         6.75 px |
| **1.625**    |                      **10.85 px** |                     **8.75 px** |
| 1.70         |                          12.05 px |                         9.95 px |

A 1.5 el caso corriente ya cabe, pero un `ÍNDICE ÚNICO` a línea completa se queda en 6.75 px de aire
—y en español las versales acentuadas salen en títulos constantemente—. 1.625 compra 2 px justo
donde hacen falta y deja el número redondo para la rejilla vertical. Por encima de 1.7 el párrafo
empieza a deshilacharse sin ganar nada medible.

---

## 8 · El español, comprobado antes de comprometerse

- **Latin Extended-A: 128/128** en las dos familias, entre las subdivisiones `latin` y `latin-ext`.
  (El español no lo necesita —vive entero en `latin`—, pero era requisito de cobertura y se cumple.)
- **Á É Í Ó Ú Ü Ñ:** la versal acentuada más alta llega a **890** de un em de 1000, con la caja de la
  fuente en **940**: sobran 50 unidades, y 261 contra `winAscent`. **No se recorta.**
- Y lo que importa más que no recortarse: **el acento no está aplastado**. Sube 170 unidades por
  encima de la ascendente (720) en vez de comprimirse para caber debajo, que es el defecto típico de
  las geométricas. Es una propiedad de la métrica de Chivo, no algo que se arregle con interlineado.
- **¿ y ¡:** bajan a −186 y −175 contra un descendente de caja de −250. Enteros, y alineados con la
  altura-x por arriba (511), que es donde deben estar.
- **Verificado en pantalla**, no solo en el binario: el espécimen §1 pone las tres filas con
  `line-height: 1` —sin nada de aire— precisamente para que un recorte se vea si lo hubiera.

---

## 9 · Cómo se ha medido

**Dos instrumentos independientes, y tienen que coincidir.**

1. **`pnpm tipo:medir`** — lee los `.woff2` reales de `apps/web/public/fuentes` con fontkit, sin
   navegador. Valida primero el instrumento: si no encuentra las seis caras o si la unidad por em no
   es 1000, **aborta con código 2 y no mide nada**. Sale con **código 1** si alguna afirmación de
   este documento deja de ser cierta.
2. **El espécimen** (`pnpm tipo:muestra`) — remide lo mismo en el navegador sobre el texto ya
   compuesto, con `TextMetrics` y `getBoundingClientRect`.

Coinciden: a cuerpo 1000 px el navegador da **exactamente 615 px** para el `0` de Chivo y **600** para
el de Chivo Mono, que son las mismas 615 y 600 unidades que lee fontkit. Antes de creerse cualquier
número, el espécimen comprueba que las caras están **cargadas de verdad** —una página que ha caído a
la fuente de respaldo del sistema enseña otra cosa y no avisa—.

**Donde no coinciden del todo, y por qué.** Chromium cuantiza el avance a cuerpos pequeños: mide 1ch
de mono como 9.6094 px en vez de los 9.60 px justos de la métrica, y por eso lee 64.94ch donde la
métrica dice 65.0. No es un error de la medida, es la resolución del instrumento. La comprobación se
hace contra la métrica, que es la que manda, y **el espécimen enseña las dos cifras** en vez de
quedarse con la que le conviene.

---

## 10 · Lo que queda abierto

1. **Cara de respaldo con métrica ajustada** para el periodo de `swap` (§3). No se ha escrito porque
   no se ha podido medir. Es lo único de este documento que está sin resolver.
2. **La medida de línea del preview se pasa del clásico 45-75** (§6). Es consecuencia del rango que
   fija el encargo para el panel de texto, está medido y la salida está escrita. Decisión tuya.
3. **La cursiva no es humanística completa** (§5). Se registra; no cambia la elección, porque las
   citas del preview van sin cursiva de todas formas.
4. **La app todavía no usa nada de esto, y es a propósito.** `tipografia.css` existe, mide y se
   demuestra en el espécimen, pero **no está importado desde `index.css`**, y `@theme` sigue con
   `--font-sans: ui-sans-serif` y `--font-mono: ui-monospace`. Cambiar la letra de las pantallas es
   el restyle: toca los 24 archivos de interfaz, y según `CLAUDE.md` eso entra por el `orchestrator`
   con su spec y sus tareas `T-NNN` en TDD. Lo que hay aquí es la **decisión medida y verificable**;
   aplicarla es el paso siguiente, no este.

---

## 11 · Capturas

En `docs/design/capturas/`, sacadas del espécimen servido en local:

| Archivo                      | Qué demuestra                                                           |
| ---------------------------- | ----------------------------------------------------------------------- |
| `acentos-titular-claro.png`  | Á É Í Ó Ú Ü Ñ ¿ ¡ a 60 px con `line-height: 1`, sin recorte, tema claro |
| `acentos-titular-oscuro.png` | Lo mismo en tema oscuro                                                 |
| `split-crudo-render.png`     | El mismo texto en crudo y compuesto, 624 px a los dos lados             |

---

## 12 · Preferencia escrita: las citas del preview, sin cursiva

`blockquote` va en **redonda**. No es una norma tipográfica del español: es preferencia de este
proyecto. El bloque de cita ya se distingue por **barra, sangría y tinta secundaria** —tres canales—
y la cursiva larga en pantalla cansa sin añadir un cuarto que aporte nada. Está en el espécimen §3
para poder discutirlo mirándolo.
