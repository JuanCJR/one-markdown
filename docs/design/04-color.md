# 04 · Color — sistema de tokens «Cromo»

**Documento normativo del repositorio.** Los valores vienen cerrados de una sesión de Claude Design
(proyecto `1bee376a`, `docs/design/04-color.md` de allí) y **no se rediscuten aquí**. Lo que este
documento añade es lo que en el repositorio se puede exigir: dónde viven los tokens, con qué se
miden, qué medida da cada pareja y qué falla.

| Qué                                               | Dónde                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Tokens crudos, OKLCH                              | `apps/web/src/styles/tokens-cromo.css`                                            |
| Opción «sistema» (`prefers-color-scheme`)         | `apps/web/src/styles/tokens-cromo-sistema.css` — **la app aún no lo importa**, §7 |
| Puente con Tailwind (`@theme inline`, utilidades) | `apps/web/src/index.css`                                                          |
| Medidor de contraste                              | `tools/color/medir-contraste.mjs` · `pnpm color:medir`                            |
| Guard de las prohibiciones                        | `apps/web/src/design/color-guard.test.ts`                                         |
| Muestra con conmutador de tema                    | `docs/design/muestra-color.html` · `pnpm color:muestra`                           |
| Conmutador de la app                              | `apps/web/src/shared/theme/` — implementado y testeado, **sin montar**, §7        |

## 0 · Versión de Tailwind, fijada por escrito

**Tailwind v4.** El tema se declara **en CSS con `@theme`**; en este repositorio **no existe ni
existirá `tailwind.config.js`**, y tampoco hay PostCSS: la integración es el plugin de Vite
(`@tailwindcss/vite`, declarado en `apps/web/package.json` y usado en `apps/web/vite.config.ts`).

Consecuencia práctica, que es la razón de fijarlo: cualquier comprobación sobre el color se escribe
contra `@theme` y contra `var(--*)`, nunca contra un archivo de configuración. Y las prohibiciones
se comprueban **por valor computado** (`L`, `C`, `H`), no por cadena hexadecimal: un `grep '#fff'`
no vale de nada cuando el mismo blanco se puede escribir `white`, `#ffffff`, `rgb(255,255,255)` o
`oklch(1 0 0)`.

`@theme inline` y no `@theme` a secas: `inline` hace que `bg-sup-base` compile a
`background-color: var(--sup-base)` en vez de al valor congelado, y eso es lo que permite que el
conmutador de tema cambie el color **sin duplicar ni una clase** y sin generar variantes `dark:`.
Verificado en el bundle de producción: `.bg-sup-base{background-color:var(--sup-base)}`.

## 1 · Tabla de tokens

Nombre semántico, nunca nombre de color. Cuatro superficies, cuatro tintas y tres hairlines por
tema, más el primario y su tinta.

| Token                 | Claro (OKLCH · hex)              | Oscuro (OKLCH · hex)             | Uso permitido                                                                            | Uso prohibido                                                                          |
| --------------------- | -------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `--sup-base`          | `0.9666 0.004 100` · `#f4f4f1`   | `0.1901 0.005 100` · `#141411`   | Papel de la pantalla; zona de trabajo; pestaña activa.                                   | Como color de texto. Como fondo de una zona superpuesta.                               |
| `--sup-elevada`       | `0.9450 0.004 100` · `#ededea`   | `0.2210 0.005 100` · `#1b1b18`   | Zonas que se apoyan en el papel: estructura, vista, rejilla de elementos.                | Saltar a ella y a `hundida` a la vez entre dos zonas contiguas.                        |
| `--sup-hundida`       | `0.9268 0.004 100` · `#e7e7e4`   | `0.2467 0.005 100` · `#21211e`   | Fila seleccionada, campo sin borde, silueta de carga, papelera.                          | Fondo de una zona entera que toque el papel directamente.                              |
| `--sup-superpuesta`   | `0.9040 0.004 100` · `#e0dfdc`   | `0.2790 0.005 100` · `#292926`   | **Solo** capas superpuestas: diálogos, paleta de comandos, confirmaciones.               | Cualquier zona interior de una pantalla. Overlay oscurecido detrás.                    |
| `--tinta-principal`   | `0.2088 0.006 100` · `#191815`   | `0.9403 0.006 100` · `#ecebe7`   | Texto del documento, estructura, rótulos, masa de estado, eje de foco.                   | —                                                                                      |
| `--tinta-secundaria`  | `0.3970 0.006 100` · `#474743`   | `0.7676 0.006 100` · `#b4b4af`   | Metadatos que se leen: rutas, fechas, recuentos, código ya aplicado.                     | Texto largo del documento.                                                             |
| `--tinta-tenue`       | `0.4936 0.006 100` · `#62615e`   | `0.6544 0.006 100` · `#91918c`   | Marcas del markdown crudo (`#`, `**`, `>`), rótulos de unidad, ruta bajo el nombre.      | Colorear la sintaxis como si fuera paleta de código. Texto por debajo de 11 px.        |
| `--tinta-desactivada` | `0.5702 0.006 100` · `#787774`   | `0.5770 0.006 100` · `#7a7976`   | Controles desactivados; tinta de la trama de inerte.                                     | **Texto activo de cualquier tamaño.** No alcanza AA (3.35:1 en el peor caso).          |
| `--hair-zona`         | `0.4542 0.006 100` · `#575653`   | `0.7016 0.006 100` · `#a09f9b`   | Límite de una capa **superpuesta** contra lo que tapa.                                   | Separar dos zonas de la misma pantalla: eso es aire o escalón.                         |
| `--hair-control`      | `0.5282 0.006 100` · `#6c6b67`   | `0.6192 0.006 100` · `#878682`   | Borde de la acción secundaria fantasma; borde de campo cuando el escalón no es posible.  | Decorar cajas. Envolver una zona.                                                      |
| `--hair-fila`         | `0.5920 0.006 100` · `#7e7e7a`   | `0.5532 0.006 100` · `#73736f`   | Separador de fila en tablas de datos densas.                                             | Separar zonas. Repetirse en listas que ya tienen barras de nivel.                      |
| `--cromo`             | `0.7927 0.1574 85.3` · `#e9b21b` | `0.8197 0.1605 87.4` · `#f0bc23` | Masa de ≥ 8 px que dice «el presente», y la acción primaria. Máximo 3 por viewport (§5). | `color:`, `border:`, `stroke:`, `fill:`, iconos, gradientes, éxito, aviso, categorías. |
| `--sobre-cromo`       | `0.2088 0.006 100` · `#191815`   | `0.2088 0.006 100` · `#191815`   | Único texto admitido sobre masa cromo, en los dos temas.                                 | Invertirlo en oscuro «porque el amarillo sube»: medido, 10.07:1.                       |

Matiz de los neutros: **H = 100**, explícito y único. Matiz del primario: **H ≈ 86**, mostaza/ocre;
fuera del rango prohibido índigo-violeta-morado (265-320). Croma del primario idéntico ±0.003 en los
dos temas; lo que cambia es la luminancia (0.7927 → 0.8197).

Nombres en Tailwind (`apps/web/src/index.css`): `bg-sup-base`, `bg-sup-elevada`, `bg-sup-hundida`,
`bg-sup-superpuesta`, `text-tinta`, `text-tinta-secundaria`, `text-tinta-tenue`,
`text-tinta-desactivada`, `border-hair-zona`, `border-hair-control`, `border-hair-fila`,
`bg-cromo`, `text-sobre-cromo`, más las utilidades `inerte` y `foco-cromo`.

## 2 · Cómo se ha medido

`pnpm color:medir`. Lee el CSS real —no una copia de los valores en JS—, convierte OKLCH → sRGB con
las matrices de OKLab, aplica la fórmula de luminancia relativa de WCAG 2.2 y **sale con código 1
si alguna pareja incumple su criterio**.

Dos cosas que hacen que la medida se pueda creer:

1. **El instrumento se valida antes que el dato.** Lo primero que hace el medidor es reproducir los
   24 hex que dejó escritos la sesión de Design a partir de los OKLCH del CSS. Si uno solo no
   coincide, aborta con código 2 y no mide nada más. Estado: **24/24 exactos**.
2. **Dos instrumentos independientes coinciden.** La muestra
   (`docs/design/muestra-color.html`) recalcula los mismos ratios en el navegador, sobre los tokens
   computados del documento, y da el mismo número al centésimo en los dos temas. Ninguna de las dos
   tablas de este documento está escrita a mano.

   El primer intento de medición en el navegador delegaba la conversión en
   `canvas.fillStyle`, que en Chromium **no resuelve `oklch()`**: se quedaba con el color anterior y
   devolvía ratios de 1914:1 sin lanzar ningún error. Está anotado en la muestra porque un
   instrumento que falla en silencio es peor que no medir.

Los ratios se truncan hacia abajo a dos decimales: 4.4999 no se puede presentar como «4.50».

**Umbral aplicable.** Los cuerpos del sistema son 11, 15, 21 y 60 px. Ninguno es «texto grande»
según WCAG 2.2 —hacen falta 18.66 px en negrita o 24 px—, así que a **todo** texto le toca 4.5:1
(AA, 1.4.3) y no 3:1.

## 3 · Contraste de texto medido (WCAG 1.4.3)

### Tema claro

| Pareja                                        | base  | elevada | hundida | superpuesta | Umbral | Criterio                            |     |
| --------------------------------------------- | ----- | ------- | ------- | ----------- | ------ | ----------------------------------- | --- |
| `tinta-principal`                             | 16.11 | 15.13   | 14.32   | 13.32       | 4.5:1  | AA · roza AAA (1.4.6) en las cuatro | ✅  |
| `tinta-secundaria`                            | 8.46  | 7.95    | 7.53    | 7.00        | 4.5:1  | AA · AAA en las cuatro              | ✅  |
| `tinta-tenue`                                 | 5.62  | 5.27    | 4.99    | **4.64**    | 4.5:1  | AA (1.4.3) en las cuatro            | ✅  |
| `tinta-desactivada`                           | 4.06  | 3.81    | 3.61    | **3.36**    | —      | **Exento** de 1.4.3 · §4            | ⚠️  |
| `sobre-cromo` sobre masa cromo                | 9.17  | —       | —       | —           | 4.5:1  | AAA                                 | ✅  |
| `sup-base` sobre `tinta-principal` (negativo) | 16.11 | —       | —       | —           | 4.5:1  | AAA                                 | ✅  |

### Tema oscuro

| Pareja                                        | base  | elevada | hundida | superpuesta | Umbral | Criterio                 |     |
| --------------------------------------------- | ----- | ------- | ------- | ----------- | ------ | ------------------------ | --- |
| `tinta-principal`                             | 15.47 | 14.47   | 13.53   | 12.22       | 4.5:1  | AA · AAA en las cuatro   | ✅  |
| `tinta-secundaria`                            | 8.86  | 8.29    | 7.75    | 7.00        | 4.5:1  | AA · AAA en las cuatro   | ✅  |
| `tinta-tenue`                                 | 5.82  | 5.45    | 5.09    | **4.60**    | 4.5:1  | AA (1.4.3) en las cuatro | ✅  |
| `tinta-desactivada`                           | 4.23  | 3.96    | 3.70    | **3.35**    | —      | **Exento** de 1.4.3 · §4 | ⚠️  |
| `sobre-cromo` sobre masa cromo                | 10.07 | —       | —       | —           | 4.5:1  | AAA                      | ✅  |
| `sup-base` sobre `tinta-principal` (negativo) | 15.47 | —       | —       | —           | 4.5:1  | AAA                      | ✅  |

**El texto tenue se resuelve contra la superficie peor, no contra el papel.** Es el hallazgo que
obligó a mover el token en la sesión de Design: la «tinta apagada» anterior (`#6d6f70`) daba 4.59:1
sobre papel y se hundía a 4.07 en cuanto el texto salía de él. `--tinta-tenue` pasa en las cuatro
superficies de los dos temas, con el peor caso en 4.64 (claro) y 4.60 (oscuro).

## 4 · El nivel desactivado, registrado y no forzado

`--tinta-desactivada` mide **3.36:1 (claro) y 3.35:1 (oscuro)** en el peor caso. No llega a 4.5:1 y
**no se sube**, porque no tiene que llegar:

> **WCAG 2.2, criterio 1.4.3 Contrast (Minimum) — excepción «Incidental»:** _«Text or images of text
> that are part of an inactive user interface component… have no contrast requirement.»_

Un control desactivado es un componente inactivo, así que la exención le aplica literalmente. Se
registra aquí en vez de forzar el valor a 4.5:1 porque subirlo tendría el efecto contrario al que se
busca: un desactivado con el mismo contraste que un activo deja de parecer desactivado.

Lo que sí se le exige, y cumple: **≥ 3:1 contra las cuatro superficies (1.4.11)**, porque la trama
de inerte es un indicador de estado y hay que poder verla. Y una regla de uso, que el guard no puede
comprobar solo: nunca se usa para texto activo.

## 5 · Contraste no textual medido (WCAG 1.4.11) — el criterio de más riesgo

Toda hairline que delimita una zona, todo borde de control y todo indicador de estado, contra las
cuatro superficies de cada tema. Umbral **≥ 3:1**.

| Token · trabajo                                | Claro (peor caso)        | Oscuro (peor caso) |          |
| ---------------------------------------------- | ------------------------ | ------------------ | -------- |
| `hair-zona` — límite de capa superpuesta       | 5.50 (sobre superpuesta) | 5.50               | ✅       |
| `hair-control` — borde de control y de campo   | 4.00                     | 4.00               | ✅       |
| `hair-fila` — separador de fila en tabla densa | **3.05**                 | **3.06**           | ✅       |
| `tinta-desactivada` — trama de inerte          | 3.36                     | 3.35               | ✅       |
| `cromo` — masa de «el presente» / primaria     | **1.45**                 | 8.28               | ❌ claro |
| Eje de foco (`tinta-principal`, 4 px)          | 13.32                    | 12.22              | ✅       |

Cuatro consecuencias que el sistema asume por escrito:

1. **El escalón de superficie no delimita nada.** Medido: 1.06, 1.05 y 1.07 en claro; 1.06, 1.06 y
   1.10 en oscuro. Muy por debajo de 3:1. El escalón separa zonas —que es pertenencia, no un
   control—; en cuanto algo se superpone, el límite lo pone `--hair-zona`. Un diálogo se distingue
   por superficie **y** por hairline, sin overlay y sin sombra.
2. **`hair-fila` es el margen más justo del sistema**: 3.05:1. Cualquier movimiento de su `L` hacia
   la superficie lo rompe. Está cubierto por el medidor, que sale con código 1.
3. **Cromo no cumple 1.4.11 en claro.** Ver §6.
4. **El foco de teclado no lo dibuja el amarillo**, sino el eje de tinta de 4 px de la utilidad
   `foco-cromo`, que mide 13.32:1. Es la única sombra del sistema y no es elevación: es masa de
   tinta sólida, sin difuminado y sin transparencia.

## 6 · Lo que falla · PARADO, no corregido

**`--cromo` como masa no alcanza 3:1 sobre ninguna superficie del tema claro.**

| Sobre  | base  | elevada | hundida | superpuesta |
| ------ | ----- | ------- | ------- | ----------- |
| Claro  | 1.75  | 1.65    | 1.56    | 1.45        |
| Oscuro | 10.47 | 9.80    | 9.16    | 8.28        |

El valor **no se ha tocado**, según la regla dura: es una decisión de Design y la corrección la
decide quien la tomó.

**Resolución vigente, y es de la propia sesión de Design:** cromo nunca es el único canal. Toda masa
cromo lleva un segundo canal declarado —superficie, peso, forma o palabra—, y el indicador de foco
lo cumple con el eje de tinta de 4 px (13.32:1). Por esa vía 1.4.11 queda satisfecho por el segundo
canal, no por el amarillo. Es defendible y es lo que está implementado.

**Si en cambio se quiere que el amarillo cumpla solo**, el ajuste mínimo es mover `L` sin tocar el
matiz ni el croma (`C = 0.1574`, `H = 85.3`):

| Objetivo                                        | L nueva             | Hex       | Mide   | Coste                                                                                                                    |
| ----------------------------------------------- | ------------------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| 3:1 contra `sup-base` únicamente                | 0.7927 → **0.6451** | `#b98300` | 3.02:1 | Deja de cumplir sobre las otras tres superficies.                                                                        |
| 3:1 contra las cuatro (peor caso `superpuesta`) | 0.7927 → **0.5976** | `#a97500` | 3.01:1 | **Rompe `--sobre-cromo`**: la tinta sobre esa masa cae por debajo de 4.5:1, y habría que invertir el texto a `sup-base`. |

O sea: el ajuste mínimo no es mínimo. Bajar cromo casi dos décimas de `L` lo saca del mostaza y lo
mete en el ocre oscuro, y arrastra la decisión de qué texto va encima. Mi recomendación es mantener
el valor y el segundo canal; pero es tu decisión, no mía, y hasta que la tomes no se toca nada.

## 7 · Conmutador de tema

**Decisión de Design, sin cambios:** `prefers-color-scheme` por defecto + override local escrito en
`data-tema` sobre `<html>` y persistido en `localStorage` (`om-tema`), con un script de arranque en
`<head>` para que no haya destello. El conmutador es una palabra en versalitas de 11 px
(`Claro` / `Oscuro` / `Sistema`) en la cabecera, no una pantalla de ajustes de apariencia.

**Backend: fuera de alcance, y se dice en vez de hacerse.** Persistir la preferencia en servidor
—tabla `user_preferences`, migración y `PATCH /api/preferences`— es alcance nuevo y necesita su
propia spec. Hasta entonces el tema **no viaja entre dispositivos**, y eso es una decisión escrita,
no un olvido.

**Estado en el repositorio: montado y en uso.** `apps/web/src/shared/theme/tema.ts` y
`TemaSwitcher.tsx` (13 tests), el script de arranque en `index.html`, el conmutador en la cabecera
de `AppShell.tsx` y `tokens-cromo-sistema.css` importado desde `index.css`.

Verificado en la app real, no solo en test: al elegir `Oscuro` el documento queda con
`data-tema="oscuro"`, `localStorage.om-tema = "oscuro"` y `--sup-base` computa `oklch(0.1901 …)`;
al volver a `Sistema` se borran las dos cosas y manda `prefers-color-scheme`.

Aviso para quien verifique esto con capturas: cambiar el tema solo cambia variables CSS, y una
captura disparada inmediatamente después puede devolver el fotograma anterior —me pasó dos veces
seguidas y parecía un tema roto—. El dato que vale es `getComputedStyle`, no la imagen.

## 8 · Presupuesto de acento — regla verificable

**Cromo tiene un solo trabajo: «el presente».** El objeto sobre el que actúa la siguiente tecla. Es
exclusivo por definición, y eso deja el presupuesto en un elemento estructural más los dos que la
interacción puede añadir.

1. Todo elemento que use `--cromo` como fondo lleva `data-cromo` con uno de estos tres valores:
   `presente` · `primaria` · `foco`.
2. Por viewport: **como máximo 3** elementos `[data-cromo]` visibles.
3. `presente`: exactamente 0 o 1. `primaria`: 0 o 1 (la acción primaria de la pantalla).
   `foco`: 0 o 1, y solo mientras el foco de teclado esté visible.
4. Acción secundaria: fantasma, `1px solid var(--hair-control)`, texto `tinta-principal`, sin masa.
   Acción terciaria: solo palabra, sin masa y sin borde.
5. Cromo nunca en `color`, `border`, `stroke`, `fill` ni en ningún gradiente. Masa de ≥ 8 px de lado.
6. **Cada masa cromo declara su segundo canal** (superficie, peso, forma o palabra), porque cromo
   mide 1.45:1 en el peor caso del tema claro (§6).

Comprobación, que corre igual en la consola, en un test e2e y en la muestra —donde ya está puesta y
se ve en pantalla—:

```js
const masas = [...document.querySelectorAll('[data-cromo]')].filter(
  (e) => e.getClientRects().length,
);
const cuenta = (tipo) => masas.filter((e) => e.dataset.cromo === tipo).length;

console.assert(masas.length <= 3, 'presupuesto de acento roto: ' + masas.length);
console.assert(cuenta('presente') <= 1, 'más de un «presente»');
console.assert(cuenta('primaria') <= 1, 'más de una acción primaria');
```

## 9 · Prohibiciones exigibles

`apps/web/src/design/color-guard.test.ts` corre con `pnpm test` y falla si:

| Regla                                                                                         | Cómo se comprueba                                                                                            |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Ningún color con `L ≥ 0.99` ni `L ≤ 0.02`                                                     | Por valor: se parsean todas las declaraciones `oklch()` del código.                                          |
| Ningún `bg-white` / `bg-black` (ni `border-`, `ring-`, `outline-`, `divide-`, `from/via/to-`) | Por literal, en `.ts`, `.tsx`, `.css` e `.html`.                                                             |
| Ningún blanco ni negro puro por otra vía                                                      | Por valor de declaración CSS: `#fff`, `#ffffff`, `#000`, `white`, `black`, `rgb(255,255,255)`, `rgb(0,0,0)`. |
| Ningún acento en el rango de matiz 265-320                                                    | Por valor: acento = `C ≥ 0.03`; se mira su `H`.                                                              |

Además, el guard **se valida a sí mismo**: falla si no encuentra archivos, si no encuentra
`tokens-cromo.css` o si no encuentra al menos 24 declaraciones OKLCH. Un guard que no mira nada pasa
siempre, y un cero así no se cree.

Excepción declarada: `text-white` sigue vivo en los botones azules y rojos heredados
(`bg-blue-700 text-white`), que no son de este sistema y mueren enteros en el restyle —la primaria
pasa a masa cromo con `--sobre-cromo`, y «el rojo no existe»—. Prohibirlo hoy obligaría a inventar
el color de esos botones, que es justo lo que no toca decidir aquí. Entra en la cuenta de §7.

## 10 · Excepciones escritas

Tres, cada una con su razón.

1. **Cuarta superficie.** La dirección decía tres. `--sup-superpuesta` existe porque en oscuro un
   diálogo debe distinguirse **sin overlay** y la sombra no existe. Sigue siendo un paso por vez, y
   el token está prohibido para cualquier zona interior.
2. **Hairlines.** La prohibición de la línea entre zonas se mantiene entera: las tres hairlines
   existen para lo que esa regla no cubre —el límite de una capa superpuesta, el borde de un control
   fantasma, la fila de una tabla densa— y las tres alcanzan ≥ 3:1. Corolario medido: «un cambio de
   tono del 3 %» no puede ser el límite de nada identificable; mide 1.05:1.
3. **Una sombra, y no es elevación.** El foco de teclado se dibuja con
   `box-shadow: -4px 0 0 0 var(--tinta-principal)`: un eje de tinta sólida, sin difuminado y sin
   transparencia. Existe porque la masa cromo sola mide 1.45:1 en el peor caso claro y no cumpliría
   1.4.11 como indicador de foco. El namespace `--shadow-*` de Tailwind se borrará igualmente con el
   restyle: esto es una utilidad nombrada (`foco-cromo`), no una escala de sombras.
