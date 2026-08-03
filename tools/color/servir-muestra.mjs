#!/usr/bin/env node
/**
 * Sirve la muestra del sistema de color en local, sin dependencias.
 *
 *   node tools/color/servir-muestra.mjs        → http://localhost:4174/docs/design/muestra-color.html
 *   PORT=5000 node tools/color/servir-muestra.mjs
 *
 * Servidor estático de la raíz del repositorio, y no de `docs/design`, porque la muestra carga los
 * tokens del archivo real de la app (`apps/web/src/styles/tokens-cromo.css`): tiene que poder
 * subir por encima de su propio directorio o estaría mirando una copia.
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUERTO = Number(process.env['PORT'] ?? 4174);
const INICIO = '/docs/design/muestra-color.html';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const servidor = createServer((peticion, respuesta) => {
  const ruta = decodeURIComponent(new URL(peticion.url ?? '/', 'http://localhost').pathname);
  const destino = join(RAIZ, normalize(ruta === '/' ? INICIO : ruta));

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
  console.log(`Muestra del sistema de color en http://localhost:${PUERTO}${INICIO}`);
});
