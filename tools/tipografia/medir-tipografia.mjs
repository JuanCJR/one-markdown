#!/usr/bin/env node
/**
 * Mide la tipografía sobre los archivos de fuente REALES de `apps/web/public/fuentes` y sale con
 * código 1 si alguna de las afirmaciones de `docs/design/05-tipografia.md` deja de ser cierta.
 *
 *   node tools/tipografia/medir-tipografia.mjs        → pnpm tipo:medir
 *
 * Es el instrumento OFFLINE. El otro es el espécimen (`docs/design/muestra-tipografia.html`), que
 * remide lo mismo en el navegador, sobre el texto ya compuesto. Dos instrumentos independientes
 * que tienen que coincidir; si uno se mueve solo, es que uno de los dos miente.
 *
 * Y como en `tools/color/medir-contraste.mjs`: PRIMERO se valida el instrumento. Si no encuentra
 * las seis caras, o si la unidad por em no es la esperada, aborta con código 2 y no mide nada.
 * Un medidor que no encuentra nada pasa siempre, y ese cero no se puede creer.
 */
import * as fontkit from 'fontkit';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = `${RAIZ}/apps/web/public/fuentes`;

const CARAS = [
  'chivo-latin',
  'chivo-latinext',
  'chivo-italic-latin',
  'chivo-italic-latinext',
  'chivomono-latin',
  'chivomono-latinext',
];

let fallos = 0;
const ok = (cond, texto, detalle) => {
  if (!cond) fallos++;
  console.log(`  ${cond ? '✔' : '✗'} ${texto}${detalle ? `  ${detalle}` : ''}`);
};

/* ── 0 · Validación del instrumento ──────────────────────────────────────────── */
console.log('\n═══ 0 · Validación del instrumento ═══');
for (const c of CARAS) {
  if (!existsSync(`${DIR}/${c}.woff2`)) {
    console.error(`  ABORTA: falta ${c}.woff2. No se mide nada.`);
    process.exit(2);
  }
}
const abrir = (n) => fontkit.create(readFileSync(`${DIR}/${n}.woff2`));
const chivo = abrir('chivo-latin');
const mono = abrir('chivomono-latin');
const chivoExt = abrir('chivo-latinext');
const monoExt = abrir('chivomono-latinext');
const chivoIt = abrir('chivo-italic-latin');

if (chivo.unitsPerEm !== 1000 || mono.unitsPerEm !== 1000) {
  console.error(`  ABORTA: unitsPerEm inesperada (${chivo.unitsPerEm}/${mono.unitsPerEm}).`);
  process.exit(2);
}
console.log(`  6/6 caras encontradas · unitsPerEm 1000 en las dos familias · instrumento válido`);

const caja = (f, ch) => {
  const g = f.glyphsForString(ch)[0];
  if (!g || g.id === 0) return null;
  return { max: g.bbox.maxY, min: g.bbox.minY, ancho: g.advanceWidth };
};

/* ── 1 · Superfamilia: métrica vertical idéntica ─────────────────────────────── */
console.log('\n═══ 1 · Superfamilia — la métrica vertical tiene que ser IDÉNTICA ═══');
const GLIFOS = ['x', 'H', 'A', 'Á', 'á', 'ñ', 'd', 'p', 'g', '0', '¿', '¡'];
let identica = true;
for (const ch of GLIFOS) {
  const a = caja(chivo, ch);
  const b = caja(mono, ch);
  if (a.max !== b.max || a.min !== b.min) identica = false;
}
ok(identica, 'Chivo y Chivo Mono comparten caja vertical glifo a glifo', `(${GLIFOS.join(' ')})`);
ok(
  chivo.ascent === mono.ascent && chivo.descent === mono.descent,
  'mismas ascendente/descendente',
  `${chivo.ascent}/${chivo.descent}`,
);
ok(
  chivo['OS/2'].capHeight === mono['OS/2'].capHeight,
  'misma altura de versal',
  String(chivo['OS/2'].capHeight),
);

/* ── 2 · El acento español no se recorta ─────────────────────────────────────── */
console.log('\n═══ 2 · El acento español, que es un problema de MÉTRICA ═══');
const VERSALES = ['Á', 'É', 'Í', 'Ó', 'Ú', 'Ü', 'Ñ'];
const BAJAS = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'];
const altaVersal = Math.max(...VERSALES.map((c) => caja(chivo, c).max));
const altaBaja = Math.max(...BAJAS.map((c) => caja(chivo, c).max));
const hondo = Math.min(...['g', 'j', 'p', 'q', 'y', '¿', '¡'].map((c) => caja(chivo, c).min));

console.log(
  `  versal acentuada más alta ${altaVersal} u (${altaVersal / 10}% em) · ascendente 'd' ${caja(chivo, 'd').max} u`,
);
console.log(`  tilde de caja baja más alta ${altaBaja} u · descendente más hondo ${hondo} u`);
ok(
  chivo.ascent >= altaVersal,
  'la versal acentuada cabe bajo la ascendente de la fuente',
  `holgura ${chivo.ascent - altaVersal} u`,
);
ok(
  chivo['OS/2'].winAscent >= altaVersal,
  'y bajo winAscent (el recorte de Windows)',
  `holgura ${chivo['OS/2'].winAscent - altaVersal} u`,
);
ok(
  altaVersal > caja(chivo, 'd').max,
  'el acento NO está aplastado contra la versal: sube por encima de la ascendente',
  `+${altaVersal - caja(chivo, 'd').max} u`,
);
for (const c of ['¿', '¡']) {
  const b = caja(chivo, c);
  ok(
    b.min >= chivo.descent,
    `«${c}» no se recorta por abajo`,
    `minY ${b.min} vs descent ${chivo.descent}`,
  );
}

/* ── 3 · Interlineado: holgura real a la línea elegida ───────────────────────── */
console.log('\n═══ 3 · Interlineado 1.625 (26 px sobre cuerpo 16) ═══');
const L = 1.625;
const holguraBaja = L * 1000 - altaBaja + hondo;
const holguraVersal = L * 1000 - altaVersal + hondo;
console.log(
  `  tilde de caja baja contra descendente de la línea anterior: ${Math.round(holguraBaja)} u = ${((holguraBaja / 1000) * 16).toFixed(2)} px`,
);
console.log(
  `  versal acentuada contra descendente:                        ${Math.round(holguraVersal)} u = ${((holguraVersal / 1000) * 16).toFixed(2)} px`,
);
ok(
  holguraVersal > 0,
  'ni siquiera una versal acentuada toca la línea de arriba',
  `${Math.round(holguraVersal)} u`,
);
ok(
  (holguraBaja / 1000) * 16 >= 8,
  'la holgura del caso corriente llega a 8 px',
  `${((holguraBaja / 1000) * 16).toFixed(2)} px`,
);

/* ── 4 · La rejilla del monoespaciado ────────────────────────────────────────── */
console.log('\n═══ 4 · La rejilla del mono, que `liga` rompe si no se apaga ═══');
const av = caja(mono, 'i').ancho;
const rompen = [];
for (const t of ['fi', 'fl', 'ff', 'ffi', 'definición', 'fichero', 'perfil']) {
  const run = mono.layout(t);
  const suma = run.positions.reduce((a, p) => a + p.xAdvance, 0);
  if (suma !== [...t].length * av) rompen.push(t);
}
console.log(
  `  con las features por defecto, rompen la columna: ${rompen.length ? rompen.join(', ') : 'ninguna'}`,
);
ok(
  rompen.length > 0,
  'queda comprobado que `liga` SÍ rompe la rejilla → `font-variant-ligatures: none` es obligatorio, no decorativo',
);

// `{ liga: false }` es el equivalente en fontkit de `font-variant-ligatures: none` en CSS: apaga
// las ligaduras y deja `ccmp` encendida. Esa distinción es el fondo del asunto — `ccmp` es la que
// compone los acentos, y apagarla de más rompería «á», «é», «ñ» y «ü», que es exactamente lo que
// pasaría con un `font-feature-settings` escrito a lo bruto.
const SIN_LIGADURAS = { liga: false, clig: false, dlig: false, hlig: false };
const sinLiga = [];
for (const t of ['fi', 'fl', 'ff', 'ffi', 'definición', 'fichero', 'perfil', 'áéíóúüñ', '¿¡']) {
  const run = mono.layout(t, SIN_LIGADURAS);
  const suma = run.positions.reduce((a, p) => a + p.xAdvance, 0);
  if (suma !== [...t].length * av) sinLiga.push(`${t} (${suma} ≠ ${[...t].length * av})`);
}
ok(
  sinLiga.length === 0,
  'sin `liga`, la rejilla aguanta incluso con acentos y signos de apertura',
  sinLiga.join(' '),
);

// Y la comprobación que evita curarse en salud apagando de más: los acentos siguen componiendo.
const acentos = mono.layout('áéíóúüñ', SIN_LIGADURAS);
ok(
  acentos.glyphs.every((g) => g.id !== 0) && acentos.glyphs.length === 7,
  'con las ligaduras apagadas, `ccmp` sigue componiendo los acentos: 7 caracteres → 7 glifos, ninguno .notdef',
  `${acentos.glyphs.length} glifos`,
);
ok(
  new Set([...'aiwmMW@#áñ¿'].map((c) => caja(mono, c).ancho)).size === 1,
  'todos los avances del mono son iguales',
  `${av} u`,
);

/* ── 5 · Cifras ─────────────────────────────────────────────────────────────── */
console.log('\n═══ 5 · Cifras ═══');
for (const [n, f] of [
  ['Chivo', chivo],
  ['Chivo Mono', mono],
]) {
  const anchos = [...'0123456789'].map((d) => caja(f, d).ancho);
  ok(
    new Set(anchos).size === 1,
    `${n}: las diez cifras ya son tabulares por defecto`,
    `${anchos[0]} u`,
  );
}
const porDefecto = chivo.layout('0123456789').advanceWidth;
const conTnum = chivo.layout('0123456789', ['tnum']).advanceWidth;
ok(
  porDefecto === conTnum,
  '`tnum` es un no-op medido: declararlo sería decoración',
  `${porDefecto} = ${conTnum}`,
);

/* ── 6 · Cobertura ──────────────────────────────────────────────────────────── */
console.log('\n═══ 6 · Cobertura Latin Extended-A (U+0100–U+017F) ═══');
for (const [n, base, ext] of [
  ['Chivo', chivo, chivoExt],
  ['Chivo Mono', mono, monoExt],
]) {
  const faltan = [];
  for (let cp = 0x0100; cp <= 0x017f; cp++) {
    if (!base.hasGlyphForCodePoint(cp) && !ext.hasGlyphForCodePoint(cp))
      faltan.push('U+' + cp.toString(16).toUpperCase());
  }
  ok(faltan.length === 0, `${n}: 128/128 entre las dos subdivisiones`, faltan.join(' '));
}
const ESP = 'áéíóúüñÁÉÍÓÚÜÑ¿¡«»—…€';
for (const [n, f] of [
  ['Chivo', chivo],
  ['Chivo Mono', mono],
]) {
  const faltan = [...ESP].filter((c) => !f.hasGlyphForCodePoint(c.codePointAt(0)));
  ok(
    faltan.length === 0,
    `${n}: el español entero está en la subdivisión «latin»`,
    faltan.join(''),
  );
}

/* ── 7 · Medida de línea: el ancho físico, no `ch` ───────────────────────────── */
console.log('\n═══ 7 · Medida de línea — por qué «los mismos ch» sería un error ═══');
const chMono = caja(mono, '0').ancho / 1000;
const chProp = caja(chivo, '0').ancho / 1000;
console.log(
  `  1ch Chivo Mono ${(chMono * 16).toFixed(2)} px · 1ch Chivo ${(chProp * 16).toFixed(2)} px  (cuerpo 16)`,
);
ok(chMono !== chProp, '1ch NO mide lo mismo en las dos familias: la medida se fija en píxeles');
const MEDIDA = 624;
console.log(
  `  medida elegida ${MEDIDA} px → ${(MEDIDA / (chMono * 16)).toFixed(1)}ch de mono · ${(MEDIDA / (chProp * 16)).toFixed(1)}ch de proporcional`,
);
const chs = MEDIDA / (chMono * 16);
ok(chs >= 65 && chs <= 72, 'el panel de texto cae dentro de 65-72ch', `${chs.toFixed(1)}ch`);

const PARRAFO =
  'La tipografía de un editor de markdown no es una decisión estética: es la mancha de texto que el usuario mira durante horas mientras escribe en español, con sus tildes y sus eñes.';
for (const [n, f] of [
  ['Chivo', chivo],
  ['Chivo Mono', mono],
]) {
  const em = f.layout(PARRAFO).advanceWidth / 1000;
  const px = em * 16;
  console.log(
    `  ${n.padEnd(11)} el mismo párrafo (${[...PARRAFO].length} car) mide ${px.toFixed(0)} px → ≈${(([...PARRAFO].length * MEDIDA) / px).toFixed(0)} caracteres por línea a ${MEDIDA} px`,
  );
}

// El cociente que hace incompatibles las dos restricciones (05-tipografia.md §6). Es fijo: no
// depende del cuerpo, porque al subir el cuerpo suben las dos anchuras a la vez. Por eso no se
// arregla «poniendo la letra más grande», que es la salida que uno buscaría primero.
const carMedioProsa = chivo.layout(PARRAFO).advanceWidth / 1000 / [...PARRAFO].length;
const cociente = chMono / carMedioProsa;
console.log(
  `\n  carácter medio de prosa en Chivo ${carMedioProsa.toFixed(4)} em · 1ch de mono ${chMono.toFixed(4)} em`,
);
console.log(
  `  cociente FIJO ${cociente.toFixed(3)} → «${chs.toFixed(0)}ch de mono» equivale a ${(chs * cociente).toFixed(0)} caracteres de prosa al otro lado`,
);
console.log(
  `  para que el preview cayera en 75 caracteres, el editor tendría que ir a ${(75 / cociente).toFixed(1)}ch — fuera del rango 65-72`,
);
ok(
  chs * cociente > 75,
  'queda registrado que el preview se pasa del clásico 45-75: es consecuencia del rango pedido, no un descuido',
  `${(chs * cociente).toFixed(0)} caracteres`,
);

/* ── 8 · Cursiva ────────────────────────────────────────────────────────────── */
console.log('\n═══ 8 · Cursiva de Chivo ═══');
console.log(`  ángulo de inclinación: ${chivoIt.italicAngle.toFixed(2)}°`);
const gR = chivo.glyphsForString('g')[0].path.commands.filter((c) => c.command === 'moveTo').length;
const gI = chivoIt
  .glyphsForString('g')[0]
  .path.commands.filter((c) => c.command === 'moveTo').length;
console.log(
  `  la «g» pasa de ${gR} contornos (doble piso) a ${gI} (un piso) → hay dibujo nuevo, no solo inclinación`,
);
ok(chivoIt.italicAngle < 0, 'la cursiva existe como cara propia y no se sintetiza');

/* ── 9 · Features disponibles ───────────────────────────────────────────────── */
console.log('\n═══ 9 · Features realmente disponibles (no las que uno querría) ═══');
console.log(`  Chivo      : ${chivo.availableFeatures.join(' ')}`);
console.log(`  Chivo Mono : ${mono.availableFeatures.join(' ')}`);
ok(
  !chivo.availableFeatures.includes('ss01'),
  'no hay sets estilísticos: el ajuste fino no puede venir por ahí',
);
ok(chivo.availableFeatures.includes('kern'), 'Chivo trae kerning');
ok(
  !mono.availableFeatures.includes('kern'),
  'Chivo Mono no trae kerning, que es lo correcto en un mono',
);

/* ── Cierre ─────────────────────────────────────────────────────────────────── */
console.log(`\n${'─'.repeat(78)}`);
if (fallos) {
  console.error(
    `✗ ${fallos} comprobación(es) fallan. La tipografía ya no es lo que dice 05-tipografia.md.`,
  );
  process.exit(1);
}
console.log(
  '✔ Todas las comprobaciones pasan sobre los archivos reales de apps/web/public/fuentes.\n',
);
