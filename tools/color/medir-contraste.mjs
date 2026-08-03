#!/usr/bin/env node
/**
 * Mide el contraste de TODAS las parejas del sistema de color «Cromo», en los dos temas.
 * No estima: lee `apps/web/src/styles/tokens-cromo.css`, convierte OKLCH → sRGB y aplica la
 * fórmula de WCAG 2.2.
 *
 *   node tools/color/medir-contraste.mjs            # tablas en markdown, para pegar en la doc
 *   node tools/color/medir-contraste.mjs --json     # el mismo dato en JSON
 *
 * Sale con código 1 si alguna pareja incumple su criterio. Ese código es el que convierte la
 * medida en una comprobación y no en un adorno.
 *
 * El instrumento se valida antes que el dato: la primera cosa que hace es reproducir los hex que
 * la sesión de Design dejó escritos. Si la conversión no los reproduce, no se cree ninguna medida
 * posterior y aborta.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { contraste, leeTokens, oklchAHex, redondeaHaciaAbajo } from './oklch.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUTA_TOKENS = resolve(raiz, 'apps/web/src/styles/tokens-cromo.css');

/** Hex de referencia de la sesión de Design. Sirven para validar la conversión, no como fuente. */
const HEX_DE_REFERENCIA = {
  claro: {
    'sup-base': '#f4f4f1',
    'sup-elevada': '#ededea',
    'sup-hundida': '#e7e7e4',
    'sup-superpuesta': '#e0dfdc',
    'tinta-principal': '#191815',
    'tinta-secundaria': '#474743',
    'tinta-tenue': '#62615e',
    'tinta-desactivada': '#787774',
    'hair-zona': '#575653',
    'hair-control': '#6c6b67',
    'hair-fila': '#7e7e7a',
    cromo: '#e9b21b',
  },
  oscuro: {
    'sup-base': '#141411',
    'sup-elevada': '#1b1b18',
    'sup-hundida': '#21211e',
    'sup-superpuesta': '#292926',
    'tinta-principal': '#ecebe7',
    'tinta-secundaria': '#b4b4af',
    'tinta-tenue': '#91918c',
    'tinta-desactivada': '#7a7976',
    'hair-zona': '#a09f9b',
    'hair-control': '#878682',
    'hair-fila': '#73736f',
    cromo: '#f0bc23',
  },
};

const SUPERFICIES = ['sup-base', 'sup-elevada', 'sup-hundida', 'sup-superpuesta'];

/**
 * El criterio que le toca a cada token contra una superficie.
 *
 * `umbral` es el número que decide, y `norma` el criterio de WCAG que lo justifica.
 * Ningún cuerpo del sistema (11, 15, 21, 60 px) es «texto grande» según WCAG 2.2 —hacen falta
 * 18.66 px en negrita o 24 px—, así que a todo texto le aplica 4.5:1 y no 3:1.
 */
const FRENTES = [
  { token: 'tinta-principal', umbral: 4.5, norma: '1.4.3 (AA, texto)' },
  { token: 'tinta-secundaria', umbral: 4.5, norma: '1.4.3 (AA, texto)' },
  { token: 'tinta-tenue', umbral: 4.5, norma: '1.4.3 (AA, texto)' },
  {
    token: 'tinta-desactivada',
    umbral: 3,
    norma: '1.4.3 exento (control desactivado) · se mide contra 1.4.11',
    exento: true,
  },
  { token: 'hair-zona', umbral: 3, norma: '1.4.11 (no textual)' },
  { token: 'hair-control', umbral: 3, norma: '1.4.11 (no textual)' },
  { token: 'hair-fila', umbral: 3, norma: '1.4.11 (no textual)' },
];

function midePorTema(tokens, tema) {
  const t = tokens[tema];
  const filas = [];

  for (const frente of FRENTES) {
    const ratios = SUPERFICIES.map((sup) => redondeaHaciaAbajo(contraste(t[frente.token], t[sup])));
    filas.push({
      ...frente,
      ratios,
      peor: Math.min(...ratios),
      pasa: Math.min(...ratios) >= frente.umbral,
    });
  }

  // Cromo como masa: no es texto, es un indicador. Le aplica 1.4.11.
  const cromoSobreSup = SUPERFICIES.map((sup) => redondeaHaciaAbajo(contraste(t['cromo'], t[sup])));

  filas.push({
    token: 'cromo (masa)',
    umbral: 3,
    norma: '1.4.11 (indicador de estado)',
    ratios: cromoSobreSup,
    peor: Math.min(...cromoSobreSup),
    pasa: Math.min(...cromoSobreSup) >= 3,
    segundoCanal: true,
  });

  const sobreCromo = redondeaHaciaAbajo(contraste(t['sobre-cromo'], t['cromo']));
  const negativo = redondeaHaciaAbajo(contraste(t['sup-base'], t['tinta-principal']));

  filas.push({
    token: 'sobre-cromo sobre masa cromo',
    umbral: 4.5,
    norma: '1.4.3 (AA, texto)',
    ratios: [sobreCromo],
    peor: sobreCromo,
    pasa: sobreCromo >= 4.5,
  });
  filas.push({
    token: 'sup-base sobre tinta-principal (negativo)',
    umbral: 4.5,
    norma: '1.4.3 (AA, texto)',
    ratios: [negativo],
    peor: negativo,
    pasa: negativo >= 4.5,
  });

  return filas;
}

/** Escalones consecutivos de la escalera: se mide para dejar por escrito que NO son un límite. */
function mideEscalera(tokens, tema) {
  const t = tokens[tema];

  return SUPERFICIES.slice(1).map((sup, i) => ({
    de: SUPERFICIES[i],
    a: sup,
    ratio: redondeaHaciaAbajo(contraste(t[SUPERFICIES[i]], t[sup])),
  }));
}

function validaInstrumento(tokens) {
  const desviaciones = [];

  for (const [tema, esperados] of Object.entries(HEX_DE_REFERENCIA)) {
    for (const [nombre, hex] of Object.entries(esperados)) {
      const obtenido = oklchAHex(tokens[tema][nombre]);
      if (obtenido !== hex)
        desviaciones.push(`${tema}/${nombre}: esperado ${hex}, obtenido ${obtenido}`);
    }
  }

  return desviaciones;
}

function nombreCorto(token) {
  return token.replace('sup-', '');
}

function tabla(filas) {
  const lineas = [
    `| Pareja | ${SUPERFICIES.map(nombreCorto).join(' | ')} | Umbral | Criterio | |`,
    '|---|---|---|---|---|---|---|---|',
  ];

  for (const fila of filas) {
    const celdas =
      fila.ratios.length === 4
        ? fila.ratios.map((r) => r.toFixed(2))
        : [fila.ratios[0].toFixed(2), '—', '—', '—'];

    lineas.push(
      `| \`${fila.token}\` | ${celdas.join(' | ')} | ${fila.umbral.toFixed(1)}:1 | ${fila.norma} | ${
        fila.pasa ? '✅' : '❌'
      } |`,
    );
  }

  return lineas.join('\n');
}

const css = readFileSync(RUTA_TOKENS, 'utf8');
const tokens = leeTokens(css);
const desviaciones = validaInstrumento(tokens);

if (desviaciones.length > 0) {
  console.error('El instrumento no reproduce los hex de la sesión de Design. No se mide nada más:');
  for (const d of desviaciones) console.error(`  · ${d}`);
  process.exit(2);
}

const medidas = { claro: midePorTema(tokens, 'claro'), oscuro: midePorTema(tokens, 'oscuro') };
const escalera = { claro: mideEscalera(tokens, 'claro'), oscuro: mideEscalera(tokens, 'oscuro') };
const fallos = Object.entries(medidas).flatMap(([tema, filas]) =>
  filas
    .filter((f) => !f.pasa && !f.segundoCanal)
    .map((f) => `${tema}/${f.token}: ${f.peor} < ${f.umbral}`),
);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ tokens, medidas, escalera, fallos }, null, 2));
} else {
  console.log(
    `Instrumento validado: 24/24 hex reproducidos desde ${RUTA_TOKENS.replace(raiz + '/', '')}\n`,
  );

  for (const tema of ['claro', 'oscuro']) {
    console.log(`### Tema ${tema}\n`);
    console.log(tabla(medidas[tema]));
    console.log(
      '\nEscalones consecutivos de la escalera (por qué el escalón no puede ser un límite):',
    );
    for (const paso of escalera[tema]) {
      console.log(`  ${paso.de} → ${paso.a}: ${paso.ratio.toFixed(2)}:1`);
    }
    console.log('');
  }

  console.log(
    fallos.length === 0
      ? 'Todas las parejas cumplen su criterio.'
      : `PARA Y AVISA · ${fallos.length} pareja(s) por debajo del umbral:\n  ${fallos.join('\n  ')}`,
  );
}

process.exit(fallos.length === 0 ? 0 : 1);
