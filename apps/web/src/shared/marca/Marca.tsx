import { DESCRIPTOR_APP, NOMBRE_APP } from '../textos/textos';

/**
 * La marca, dibujada en el sitio donde se pinta y no cargada como imagen.
 *
 * **Por qué en línea y no un `<img src="/marca/simbolo.svg">`.** Una imagen externa no hereda
 * `currentColor`: el símbolo se quedaría del color con el que se guardó y dejaría de girar con el
 * tema, que es precisamente lo que la fase 6 exige que haga. Los archivos de `public/marca/` siguen
 * existiendo, pero son para consumidores de fuera de la aplicación —una exportación, un `og:image`,
 * una diapositiva—, no para estas pantallas.
 *
 * **El símbolo suelto es un icono del inventario cerrado** (`docs/design/06-sistema.md` §8): masa
 * sólida, `fill: currentColor`, `stroke: none`, y la **única diagonal** que la gramática admite por
 * pantalla (R8). Por eso va `aria-hidden`: como icono, nunca es el único portador de un significado
 * y su control lleva nombre en texto.
 *
 * **Los dos bloqueos no**, y la diferencia importa: llevan `role="img"` con el nombre dentro, porque
 * no acompañan a nada — son la marca, y decir cómo se llama esto es su trabajo entero.
 */

/** Los dos triángulos del símbolo maestro, en la retícula de 24 con el canal en 24/8 = 3. */
const SIMBOLO_24 = ['M0 0H21.88L0 21.88Z', 'M24 2.12V24H2.12Z'];

/**
 * Los mismos dos triángulos **redibujados** sobre la retícula de 16, con coordenadas enteras.
 *
 * No es el de arriba escalado, y esa es la razón de que existan los dos: a 16 px con DPR 1 el canal
 * de la versión maestra cae entre dos filas de píxeles y se renderiza como dos grises, que es el
 * icono que desaparece del §8. Con coordenadas enteras el canal ocupa un píxel completo.
 */
const SIMBOLO_16 = ['M0 0H14L0 14Z', 'M16 2V16H2Z'];

export interface SimboloProps {
  /**
   * El tamaño al que se va a pintar, en píxeles. Decide **qué dibujo** se usa, no solo su escala:
   * de 16 px para abajo entra la versión de coordenadas enteras.
   */
  readonly px: 12 | 16 | 24;
  readonly className?: string;
}

export function Simbolo({ px, className }: SimboloProps): React.JSX.Element {
  const enteros = px <= 16;
  const lado = enteros ? 16 : 24;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${String(lado)} ${String(lado)}`}
      width={px}
      height={px}
      className={className}
      fill="currentColor"
    >
      {(enteros ? SIMBOLO_16 : SIMBOLO_24).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * El bloqueo horizontal: símbolo de 24, separación de 12 y el wordmark de 30.
 *
 * El wordmark va como `<text>` y no contorneado a propósito, y tiene consecuencia: **depende de que
 * Chivo esté cargada**. Aquí lo está —viaja en `public/fuentes` y la declara `styles/tipografia.css`,
 * así que dentro de la aplicación el bloqueo es siempre el bloqueo. Fuera, el mismo archivo de
 * `public/marca/` compone con la sans del sistema. Está escrito en `docs/design/06-marca.md` §3 con
 * su salida, en vez de descubrirse en una diapositiva.
 */
export function BloqueHorizontal({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <span className={className}>
      {/*
        `role="img"` con `aria-label`, tal y como lo fija la fase 6, y **no** `aria-hidden` con un
        texto de apoyo al lado. Los dos ocultan el `<text>` de dentro, pero el segundo mete «One
        Markdown» dos veces en el DOM —una dibujada y otra para el lector—, y eso se paga: cualquier
        consulta por texto encuentra las dos y no sabe cuál quiere. Aquí el bloqueo **es** una
        imagen cuyo contenido es su nombre, que es exactamente lo que `role="img"` describe.

        No contradice la regla de los iconos de `06-sistema.md` §8 —«todo icono va `aria-hidden` y
        su control lleva nombre en texto»—: aquella habla de iconos dentro de un control, que sin
        nombre propio dejarían el control mudo. Esto no está dentro de nada y no es un icono: es la
        marca, y su trabajo entero es decir cómo se llama esto.
      */}
      <svg
        role="img"
        aria-label={NOMBRE_APP}
        focusable="false"
        viewBox="0 0 252 30"
        fill="currentColor"
        className="h-[30px] w-auto"
      >
        <g transform="translate(0 3)">
          {SIMBOLO_24.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        <text
          x="36"
          y="23"
          fontFamily="Chivo"
          fontWeight="900"
          fontSize="30"
          letterSpacing="-0.75"
          wordSpacing="-1.8"
        >
          {NOMBRE_APP}
        </text>
      </svg>
    </span>
  );
}

/**
 * El bloqueo vertical: símbolo de 40, wordmark de 50 y el descriptor de 11 en versalitas.
 *
 * Hoy no lo usa ninguna pantalla —la aplicación entra por `/login`, que tiene su propio `h1`— y
 * existe porque la fase 6 lo decidió y porque la marca no se rehace cuando haga falta. Su sitio
 * natural es una portada o una exportación.
 */
export function BloqueVertical({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <span className={className}>
      <svg
        role="img"
        aria-label={`${NOMBRE_APP}, ${DESCRIPTOR_APP.toLowerCase()}`}
        focusable="false"
        viewBox="0 0 360 116"
        fill="currentColor"
        className="h-auto w-full"
      >
        <g transform="scale(1.6667)">
          {SIMBOLO_24.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        <text
          x="0"
          y="98"
          fontFamily="Chivo"
          fontWeight="900"
          fontSize="50"
          letterSpacing="-1.25"
          wordSpacing="-3"
        >
          {NOMBRE_APP}
        </text>

        <text x="0" y="114" fontFamily="Chivo" fontWeight="700" fontSize="11" letterSpacing="2.42">
          {DESCRIPTOR_APP.toUpperCase()}
        </text>
      </svg>
    </span>
  );
}
