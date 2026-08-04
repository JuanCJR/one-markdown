#!/usr/bin/env node
/**
 * Rasteriza el favicon y el icono de aplicación **desde los SVG del repositorio**, y saca la
 * captura de los tres tamaños sobre fondo claro y sobre fondo oscuro.
 *
 *   node tools/marca/rasterizar-marca.mjs        → pnpm marca:rasterizar
 *
 * Sale:
 *   apps/web/public/favicon-16.png        16 × 16    desde public/favicon.svg
 *   apps/web/public/favicon-32.png        32 × 32    desde public/favicon.svg
 *   apps/web/public/apple-touch-icon.png  180 × 180  desde public/marca/app-icon.svg
 *   docs/design/capturas/marca-tamanos-claro.png
 *   docs/design/capturas/marca-tamanos-oscuro.png
 *
 * **Los tres salen del SVG, no de un dibujo nuevo.** Es la única forma de que un retoque del símbolo
 * llegue a los tres tamaños: cualquier PNG dibujado aparte se queda con la versión de ayer y nadie
 * lo nota, porque un favicon de 16 px equivocado se parece mucho a uno correcto.
 *
 * **El color de los PNG.** `favicon.svg` lleva los dos temas dentro con una `prefers-color-scheme`,
 * y un PNG no puede. Los dos PNG se rasterizan en **tinta del tema claro**, que es el papel de
 * respaldo: son la alternativa para quien no admita SVG, y el `<link>` los pone después del SVG
 * precisamente para que casi nadie los use. Está escrito en `docs/design/06-marca.md` §3.
 *
 * Primero se valida el instrumento: si falta un SVG de origen, o si el navegador devuelve una imagen
 * de tamaño distinto del pedido, aborta con código 2 y no escribe nada. Un rasterizador que guarda
 * un PNG transparente no falla —entrega un icono invisible—, y eso se descubre en la pestaña.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = `${RAIZ}/apps/web`;
const PUBLICO = `${WEB}/public`;
const CAPTURAS = `${RAIZ}/docs/design/capturas`;

const aborta = (mensaje) => {
  console.error(`✗ ${mensaje}`);
  process.exit(2);
};

/**
 * Playwright vive en `apps/web`, no en la raíz, y `import` resuelve desde **este** archivo. Se
 * resuelve a mano contra el paquete que lo declara en vez de mover el script o duplicar la
 * dependencia.
 */
function cargaChromium() {
  try {
    const require = createRequire(`${WEB}/package.json`);

    // `@playwright/test` y no `playwright`: es el que declara `apps/web/package.json`, y por tanto
    // el único que pnpm enlaza en su `node_modules`. Reexporta el mismo `chromium`.
    //
    // Y `require` y no `import()`: el paquete es CommonJS, así que un `import()` dinámico entrega
    // todo bajo `default` y `chromium` llegaría como `undefined` sin que nadie proteste hasta la
    // primera llamada.
    const modulo = require('@playwright/test');

    if (typeof modulo.chromium?.launch !== 'function') {
      aborta('el módulo de Playwright no expone `chromium.launch`');
    }

    return modulo.chromium;
  } catch (causa) {
    aborta(`no se ha podido cargar Playwright desde apps/web: ${causa.message}`);
  }
}

/** Los tres rasterizados que pide la fase 6, cada uno con su SVG de origen. */
const PIEZAS = [
  { salida: 'favicon-16.png', origen: `${PUBLICO}/favicon.svg`, px: 16, tema: 'light' },
  { salida: 'favicon-32.png', origen: `${PUBLICO}/favicon.svg`, px: 32, tema: 'light' },
  {
    salida: 'apple-touch-icon.png',
    origen: `${PUBLICO}/marca/app-icon.svg`,
    px: 180,
    tema: 'light',
  },
];

/* ── 0 · Validación del instrumento ──────────────────────────────────────────── */
console.log('\n═══ 0 · Validación del instrumento ═══');

for (const pieza of PIEZAS) {
  if (!existsSync(pieza.origen)) aborta(`falta el SVG de origen: ${pieza.origen}`);
}

console.log(`  ✔ los ${String(PIEZAS.length)} SVG de origen están en su sitio`);

const chromium = cargaChromium();
const navegador = await chromium.launch();

console.log(`  ✔ Chromium ${navegador.version()}`);

/** El SVG servido como `data:` para que el navegador lo componga sin servidor de por medio. */
const comoDataUri = (ruta) =>
  `data:image/svg+xml;base64,${Buffer.from(readFileSync(ruta, 'utf8'), 'utf8').toString('base64')}`;

/* ── 1 · Los tres PNG ────────────────────────────────────────────────────────── */
console.log('\n═══ 1 · Rasterizado ═══');

mkdirSync(PUBLICO, { recursive: true });

for (const pieza of PIEZAS) {
  const pagina = await navegador.newPage({
    viewport: { width: pieza.px, height: pieza.px },
    deviceScaleFactor: 1,
    colorScheme: pieza.tema,
  });

  // Fondo transparente y el SVG a sangre: un favicon con papel pintado detrás deja de recortarse
  // contra la pestaña, que es donde de verdad se ve.
  await pagina.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0;background:transparent}` +
      `img{display:block;width:${String(pieza.px)}px;height:${String(pieza.px)}px}</style>` +
      `<img src="${comoDataUri(pieza.origen)}" alt="">`,
  );

  const png = await pagina.screenshot({ omitBackground: true, type: 'png' });

  await pagina.close();

  // El instrumento se vuelve a validar **con el dato en la mano**: la firma del PNG y las dos
  // dimensiones que declara su cabecera IHDR, que es lo que un PNG vacío o de otro tamaño no pasa.
  const firma = png.subarray(0, 8).toString('hex');
  const ancho = png.readUInt32BE(16);
  const alto = png.readUInt32BE(20);

  if (firma !== '89504e470d0a1a0a') aborta(`${pieza.salida} no es un PNG`);
  if (ancho !== pieza.px || alto !== pieza.px) {
    aborta(`${pieza.salida} salió ${String(ancho)}×${String(alto)} y se pidió ${String(pieza.px)}`);
  }

  writeFileSync(`${PUBLICO}/${pieza.salida}`, png);
  console.log(
    `  ✔ ${pieza.salida} · ${String(ancho)}×${String(alto)} · ${String(png.length)} B · desde ${pieza.origen.replace(RAIZ + '/', '')}`,
  );
}

/* ── 2 · La captura de los tres tamaños, en los dos temas ────────────────────── */
console.log('\n═══ 2 · Capturas ═══');

mkdirSync(CAPTURAS, { recursive: true });

/** Un PNG incrustado como `data:`, para que la captura no dependa de rutas relativas. */
const pngComoDataUri = (ruta) => `data:image/png;base64,${readFileSync(ruta).toString('base64')}`;

/**
 * La muestra enseña, para cada tamaño, **el SVG y el PNG uno al lado del otro**.
 *
 * No es adorno de la página: es la comparación que hay que poder mirar. `favicon.svg` lleva los dos
 * temas dentro y gira con el papel; el PNG no puede y va rasterizado en tinta clara. Puestos juntos
 * sobre papel oscuro la diferencia se ve en un segundo y queda registrada, que es mejor que
 * escribirla en una nota al pie y que se descubra en una pestaña.
 *
 * Cada uno va además ampliado **sin interpolar**, que es donde se comprueba lo del §8 del sistema:
 * si el canal cae en un pixel entero o se reparte entre dos filas de gris. El factor no es fijo
 * —los tres se llevan a la misma caja de 224 px—, porque con un factor unico el de 180 medía 1.440 px
 * y la página dejaba de poder compararse, que es lo único para lo que existe.
 */
function muestra(tema) {
  const papel = tema === 'dark' ? '#141411' : '#f4f4f1';
  const tinta = tema === 'dark' ? '#ecebe7' : '#191815';
  const tenue = tema === 'dark' ? '#91918c' : '#62615e';
  const hair = tema === 'dark' ? '#a09f9b' : '#575653';

  const pieza = (rotulo, src, px, factor) => `
    <div class="pieza">
      <p class="rotulo">${rotulo}</p>
      <div class="par">
        <span class="caja"><img src="${src}" width="${String(px)}" height="${String(px)}" alt=""></span>
        <img class="zoom" src="${src}" width="${String(px * factor)}" height="${String(px * factor)}" alt="">
      </div>
    </div>`;

  const fila = (px, svg, png) => {
    const factor = Math.max(1, Math.round(224 / px));

    return `
    <section class="fila">
      <h2>${String(px)} px${factor === 1 ? '' : ` &middot; &times;${String(factor)}`}</h2>
      ${pieza('SVG &middot; SIGUE AL TEMA', comoDataUri(svg), px, factor)}
      ${pieza('PNG &middot; TINTA FIJA', pngComoDataUri(png), px, factor)}
    </section>`;
  };

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}
    body{margin:0;padding:39px;background:${papel};color:${tinta};
         font-family:'Chivo','Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.3}
    h1{font-size:21px;font-weight:900;letter-spacing:-0.008em;margin:0 0 39px}
    h2{margin:0 0 13px;font-size:15px;font-weight:900}
    .fila{margin-bottom:39px;padding-bottom:26px;border-bottom:1px solid ${hair}}
    .fila:last-of-type{border-bottom:0}
    .pieza{display:flex;align-items:center;gap:26px;margin-bottom:13px}
    .rotulo{width:170px;flex:none;margin:0;font-size:11px;font-weight:700;letter-spacing:0.06em;color:${tenue}}
    .par{display:flex;align-items:center;gap:39px}
    .caja{width:180px;flex:none;display:flex;justify-content:center}
    .zoom{image-rendering:pixelated}
    .pie{margin:0 0 6px;max-width:640px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:${tenue}}
  </style></head><body>
    <h1>One Markdown &middot; favicon e icono de aplicación</h1>
    ${fila(16, `${PUBLICO}/favicon.svg`, `${PUBLICO}/favicon-16.png`)}
    ${fila(32, `${PUBLICO}/favicon.svg`, `${PUBLICO}/favicon-32.png`)}
    ${fila(180, `${PUBLICO}/marca/app-icon.svg`, `${PUBLICO}/apple-touch-icon.png`)}
    <p class="pie">TAMAÑO REAL A LA IZQUIERDA &middot; AMPLIADO A LA DERECHA &middot; TEMA ${
      tema === 'dark' ? 'OSCURO' : 'CLARO'
    }</p>
    <p class="pie">LA AMPLIACIÓN DEL SVG LA REDIBUJA EL NAVEGADOR: ENSEÑA EL TRAZADO, NO EL RASTERIZADO.
    LA DEL PNG ES EL ARCHIVO REAL SIN INTERPOLAR, Y ES DONDE SE MIRA LA RETÍCULA DE 16.</p>
  </body></html>`;
}

for (const [tema, nombre] of [
  ['light', 'marca-tamanos-claro.png'],
  ['dark', 'marca-tamanos-oscuro.png'],
]) {
  const pagina = await navegador.newPage({
    viewport: { width: 760, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: tema,
  });

  await pagina.setContent(muestra(tema));
  await pagina.screenshot({ path: `${CAPTURAS}/${nombre}`, fullPage: true });
  await pagina.close();

  console.log(`  ✔ docs/design/capturas/${nombre}`);
}

/* ── 3 · Los dos bloqueos, compuestos con Chivo de verdad ────────────────────── */
console.log('\n═══ 3 · Bloqueos ═══');

/**
 * Los bloqueos llevan el wordmark como `<text font-family="Chivo">` y no contorneado (ver
 * `docs/design/06-marca.md` §3.1), así que **componen distinto según quién los abra**. Estas dos
 * capturas son la prueba de que con la cara cargada componen lo que tienen que componer, y el sitio
 * donde se ve si algún día el tracking o el lienzo dejan de cuadrar.
 *
 * La cara se incrusta como `data:` en un `@font-face` en vez de servirse: así la captura no depende
 * de que haya un servidor levantado, que es lo que la haría irreproducible dentro de seis meses.
 */
const CARA = `${WEB}/public/fuentes/chivo-latin.woff2`;

if (!existsSync(CARA)) aborta(`falta la cara para componer el wordmark: ${CARA}`);

const chivoIncrustada = readFileSync(CARA).toString('base64');
const bloques = ['bloque-horizontal.svg', 'bloque-vertical.svg'].map((nombre) => ({
  nombre,
  svg: readFileSync(`${PUBLICO}/marca/${nombre}`, 'utf8'),
}));

for (const bloque of bloques) {
  if (!bloque.svg.includes('font-family="Chivo"')) {
    aborta(`${bloque.nombre} ya no compone con Chivo: revisa docs/design/06-marca.md §3.1`);
  }
}

console.log(`  ✔ los ${String(bloques.length)} bloqueos declaran Chivo`);

for (const [tema, nombre] of [
  ['light', 'marca-bloqueos-claro.png'],
  ['dark', 'marca-bloqueos-oscuro.png'],
]) {
  const papel = tema === 'dark' ? '#141411' : '#f4f4f1';
  const tinta = tema === 'dark' ? '#ecebe7' : '#191815';
  const tenue = tema === 'dark' ? '#91918c' : '#62615e';

  const pagina = await navegador.newPage({
    viewport: { width: 760, height: 460 },
    deviceScaleFactor: 2,
    colorScheme: tema,
  });

  await pagina.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    @font-face{font-family:Chivo;font-weight:100 900;font-display:block;
      src:url(data:font/woff2;base64,${chivoIncrustada}) format('woff2')}
    body{margin:0;padding:39px;background:${papel};color:${tinta};font-family:Chivo,sans-serif}
    p{margin:0 0 13px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:${tenue}}
    section{margin-bottom:52px}
    .h svg{height:30px;width:auto}
    .v svg{width:360px;height:auto}
  </style></head><body>
    <section class="h"><p>BLOQUEO HORIZONTAL &middot; SÍMBOLO 24 &middot; WORDMARK 30</p>${bloques[0].svg}</section>
    <section class="v"><p>BLOQUEO VERTICAL &middot; SÍMBOLO 40 &middot; WORDMARK 50 &middot; DESCRIPTOR 11</p>${bloques[1].svg}</section>
  </body></html>`);

  // Sin esto la captura sale con la sans del sistema: `font-display: block` da un plazo de bloqueo
  // corto y la carrera se pierde en una máquina rápida. Esperar a `document.fonts.ready` es lo que
  // convierte esta captura en una medida y no en una lotería.
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.screenshot({ path: `${CAPTURAS}/${nombre}`, fullPage: true });
  await pagina.close();

  console.log(`  ✔ docs/design/capturas/${nombre}`);
}

await navegador.close();

console.log('\nHecho.\n');
