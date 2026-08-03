#!/usr/bin/env node
/**
 * Sirve el espécimen tipográfico en local, sin dependencias.
 *
 *   node tools/tipografia/servir-muestra.mjs        → http://localhost:4175/docs/design/muestra-tipografia.html
 *   PORT=5000 node tools/tipografia/servir-muestra.mjs
 *
 * Servidor estático de la raíz del repositorio —como el del color— porque el espécimen carga los
 * archivos REALES de la app (`apps/web/src/styles/tipografia.css` y `tokens-cromo.css`) y no una
 * copia: una muestra con los valores copiados a mano miente al día siguiente de escribirla.
 *
 * Con un alias: `/fuentes/*` → `apps/web/public/fuentes/*`. Las `@font-face` de `tipografia.css`
 * apuntan a `/fuentes/…` porque eso es lo que Vite sirve en la app; sin el alias el espécimen
 * cargaría con las fuentes de respaldo del sistema y estaría enseñando otra cosa —justo el fallo
 * silencioso contra el que avisa `04-color.md` §2—.
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUERTO = Number(process.env['PORT'] ?? 4175);
const INICIO = '/docs/design/muestra-tipografia.html';
const ALIAS = [['/fuentes/', '/apps/web/public/fuentes/']];

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const servidor = createServer((peticion, respuesta) => {
  let ruta = decodeURIComponent(new URL(peticion.url ?? '/', 'http://localhost').pathname);
  if (ruta === '/') ruta = INICIO;
  for (const [de, a] of ALIAS) if (ruta.startsWith(de)) ruta = a + ruta.slice(de.length);

  const destino = join(RAIZ, normalize(ruta));

  // Un servidor de desarrollo también sirve rutas que le llegan de fuera: sin esto, un
  // `GET /../../.ssh/id_rsa` sale del repositorio.
  if (!destino.startsWith(RAIZ + sep)) {
    respuesta.writeHead(403).end('Fuera del repositorio');
    return;
  }

  try {
    if (!statSync(destino).isFile()) throw new Error('no es un archivo');
  } catch {
    respuesta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('No está');
    return;
  }

  respuesta.writeHead(200, {
    'content-type': TIPOS[extname(destino)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(destino).pipe(respuesta);
});

servidor.listen(PUERTO, () => {
  console.log(`Espécimen tipográfico en http://localhost:${PUERTO}${INICIO}`);
});
