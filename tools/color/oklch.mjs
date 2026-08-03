/**
 * Conversión OKLCH → sRGB y contraste WCAG 2.2. Sin dependencias, para poder correrse con
 * `node` pelado en cualquier máquina y en CI.
 *
 * Por qué a mano y no con una librería: el número que sale de aquí es el que decide si un token
 * del sistema de color pasa o no pasa un criterio de accesibilidad. El instrumento se valida antes
 * que el dato (`verification-and-measurement`): `medir-contraste.mjs` comprueba primero que esta
 * conversión reproduce los hex que la sesión de Design dejó escritos, y solo entonces se cree las
 * medidas nuevas.
 */

/** Matrices de Björn Ottosson (OKLab ↔ sRGB lineal). */
function oklabALinealRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Codificación gamma sRGB (IEC 61966-2-1). */
function aGamma(canalLineal) {
  return canalLineal <= 0.0031308 ? 12.92 * canalLineal : 1.055 * canalLineal ** (1 / 2.4) - 0.055;
}

/** Decodificación gamma sRGB. */
function aLineal(canalGamma) {
  return canalGamma <= 0.04045 ? canalGamma / 12.92 : ((canalGamma + 0.055) / 1.055) ** 2.4;
}

/**
 * OKLCH → tres enteros 0-255.
 *
 * El recorte a [0, 255] es deliberado y ocurre **después** de la gamma: WCAG mide lo que la
 * pantalla emite, no el color ideal. Un valor fuera de gamut se ve recortado, así que se mide
 * recortado. `fueraDeGamut` avisa de que eso ha pasado.
 */
export function oklchARgb255({ L, C, H }) {
  const radianes = (H * Math.PI) / 180;
  const lineal = oklabALinealRgb(L, C * Math.cos(radianes), C * Math.sin(radianes));
  const gamma = lineal.map(aGamma);
  const recortado = gamma.map((canal) => Math.min(1, Math.max(0, canal)));

  return {
    rgb: recortado.map((canal) => Math.round(canal * 255)),
    fueraDeGamut: gamma.some((canal) => canal < -1e-6 || canal > 1 + 1e-6),
  };
}

export function rgb255AHex(rgb) {
  return `#${rgb.map((canal) => canal.toString(16).padStart(2, '0')).join('')}`;
}

export function oklchAHex(oklch) {
  return rgb255AHex(oklchARgb255(oklch).rgb);
}

/** Luminancia relativa (WCAG 2.2, definición de «relative luminance»). */
export function luminanciaRelativa(rgb255) {
  const [r, g, b] = rgb255.map((canal) => aLineal(canal / 255));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG 2.2: (L1 + 0.05) / (L2 + 0.05), claro sobre oscuro. */
export function contraste(oklchA, oklchB) {
  const a = luminanciaRelativa(oklchARgb255(oklchA).rgb);
  const b = luminanciaRelativa(oklchARgb255(oklchB).rgb);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Trunca hacia abajo a dos decimales: 4.4999 no puede presentarse como «4.50». */
export function redondeaHaciaAbajo(ratio) {
  return Math.floor(ratio * 100) / 100;
}

/**
 * Lee los tokens de un CSS de variables. Devuelve un mapa `tema → nombre → {L, C, H}`.
 *
 * Deliberadamente parsea el archivo real en vez de repetir los valores en JS: si alguien toca un
 * token y no toca la medida, la medida cambia sola y el test lo ve.
 */
export function leeTokens(css) {
  const bloques = {
    claro: /:root\s*\{([\s\S]*?)\n\}/.exec(css),
    oscuro: /:root\[data-tema=["']oscuro["']\]\s*\{([\s\S]*?)\n\}/.exec(css),
  };
  const tokens = {};

  for (const [tema, bloque] of Object.entries(bloques)) {
    if (bloque === null) throw new Error(`No se encontró el bloque del tema «${tema}»`);

    tokens[tema] = {};

    const declaracion = /--([a-z0-9-]+):\s*oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/g;
    let coincidencia;

    while ((coincidencia = declaracion.exec(bloque[1])) !== null) {
      const [, nombre, L, C, H] = coincidencia;
      tokens[tema][nombre] = { L: Number(L), C: Number(C), H: Number(H) };
    }
  }

  // El tema oscuro solo redeclara lo que cambia; lo que no redeclara lo hereda del claro.
  tokens.oscuro = { ...tokens.claro, ...tokens.oscuro };

  return tokens;
}
