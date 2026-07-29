import type { INestApplication } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  JSON_BODY_LIMIT,
  MAX_DOCUMENT_CONTENT_CHARS,
} from '../src/workspace/workspace.constants';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  refreshCookieValue,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * Guardado de contenido: `PUT /api/workspace/documents/:id/content` (spec 003, T-005).
 *
 * Cubre AC-1 (guardado feliz), AC-2 (vaciar), AC-3 (validación sin efectos), AC-4 (200.000
 * caracteres), AC-5 (versión rancia), AC-6 (concurrencia), AC-7 (propiedad y credencial), AC-8
 * (idempotencia por versión), AC-9 (ortogonalidad con renombrar y mover) y AC-13 (`413`).
 *
 * **Este archivo mide concurrencia y no tolera otro escritor sobre sus documentos**: AC-6 lanza dos
 * guardados con `Promise.all` desde la misma versión y afirma que la versión avanza **exactamente
 * uno**. Hoy lo garantiza el `--runInBand` de la línea de órdenes de `apps/api/package.json`, que
 * **no** está en `test/jest-e2e.json` (`tasks.md`, §«Suites que van en serie»).
 *
 * **Cómo se evita que un `404` pase por el motivo equivocado.** Nest responde `404` también a una
 * ruta mal escrita, y en la spec `002` eso dejó una matriz de propiedad entera en verde con una URL
 * con errata. Tres defensas, y las tres tienen que seguir en pie en la matriz de propiedad:
 *
 * 1. Cada `404` afirma el `code` `DOCUMENT_NOT_FOUND`. El `404` de una ruta inexistente lo genera
 *    Nest, **no** lleva `code` y su mensaje es `Cannot PUT /api/...`.
 * 2. Cada `404` afirma el juego **exacto** de claves de `ErrorResponseDto` **con** `code`: el cuerpo
 *    de una ruta inexistente trae cinco claves y no seis.
 * 3. Un **control positivo** ejerce **la misma URL, construida por la misma función**, con el token
 *    del dueño del documento y exige `200`. Si la plantilla de ruta estuviera mal escrita, ese `200`
 *    sería imposible y el caso caería ahí en vez de dar el `404` por bueno.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves **exactas** de `WorkspaceDocumentContentResponseDto` (`plan.md` §4), ordenadas. */
const CONTENT_SAVED_KEYS = ['contentBytes', 'contentVersion', 'id', 'updatedAt'];

/** Claves exactas de un `ErrorResponseDto` **con** `code` (los `404` y el `409` de esta ruta). */
const ERROR_KEYS_WITH_CODE = ['code', 'error', 'message', 'path', 'statusCode', 'timestamp'];

/** Claves exactas de un `ErrorResponseDto` **sin** `code` (los `401` del guard, el `413`). */
const ERROR_KEYS = ['error', 'message', 'path', 'statusCode', 'timestamp'];

/**
 * Texto con un carácter multibyte: `'# Hola ñ'` mide 8 caracteres y ocupa **9** bytes en UTF-8.
 * La diferencia es lo que hace que el caso mida `contentBytes` y no `content.length`.
 */
const MULTIBYTE_CONTENT = '# Hola ñ';

/** Cuerpo por encima de `JSON_BODY_LIMIT` (2 MiB). Se genera aquí y nunca se versiona (AC-13). */
const OVERSIZED_CONTENT = 'a'.repeat(3 * 1024 * 1024);

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
  /** JWT de refresh, para comprobar que **no** vale como `Bearer` (AC-7). */
  readonly refreshToken: string;
}

/** La fila del documento tal como está en la base, con las columnas que el guardado toca. */
interface DocumentSnapshot {
  readonly content: string;
  readonly contentBytes: number;
  readonly contentVersion: number;
  readonly updatedAt: Date;
  readonly title: string;
  readonly directoryId: string | null;
}

/** Una respuesta con la ventana de tiempo real en la que estuvo en vuelo (AC-6). */
interface Timed {
  readonly response: request.Response;
  readonly startedAt: number;
  readonly settledAt: number;
}

describe('guardado de contenido de un documento (e2e) — AC-1…AC-9, AC-13', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;
  let mallory: Actor;

  /** Los títulos son únicos entre hermanos: un contador hace que el archivo se pueda repetir. */
  let seq = 0;

  beforeAll(async () => {
    app = await createAuthApp();
    prisma = app.get(PrismaService);
    await resetThrottleCounters(app);
    alice = await register('content-alice');
    mallory = await register('content-mallory');
  });

  afterAll(async () => {
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await resetThrottleCounters(app);
    await app.close();
  });

  // El rate limit es por IP y todas las peticiones de todos los archivos e2e salen de 127.0.0.1.
  beforeEach(async () => {
    await resetThrottleCounters(app);
  });

  async function register(prefix: string): Promise<Actor> {
    const email = uniqueEmail(prefix);
    emails.push(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    const userId: string = response.body.user.id;
    userIds.push(userId);

    return {
      userId,
      email,
      accessToken: response.body.accessToken,
      refreshToken: refreshCookieValue(response),
    };
  }

  function nextTitle(prefix: string): string {
    seq += 1;
    return `${prefix}-${String(process.pid)}-${String(seq)}`;
  }

  async function createDocument(
    actor: Actor,
    prefix: string,
    content = '',
    directoryId: string | null = null,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/workspace/documents')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ title: nextTitle(prefix), directoryId, content })
      .expect(201);

    const id: string = response.body.id;

    return id;
  }

  async function createDirectory(actor: Actor, prefix: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/workspace/directories')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ name: nextTitle(prefix), parentId: null })
      .expect(201);

    const id: string = response.body.id;

    return id;
  }

  /**
   * **La única** función que construye la URL del guardado.
   *
   * Que la matriz de propiedad y el control positivo pasen por aquí es lo que hace que un `404` no
   * pueda venir de una errata en la ruta: la errata haría fallar también el `200` del dueño.
   */
  function contentPath(id: string): string {
    return `/api/workspace/documents/${id}/content`;
  }

  function saveRequest(
    actor: Actor | null,
    id: string,
    body: unknown,
    token?: string,
  ): request.Test {
    const test = request(app.getHttpServer()).put(contentPath(id));
    const bearer = token ?? actor?.accessToken;

    if (bearer !== undefined) {
      test.set('Authorization', `Bearer ${bearer}`);
    }

    return test.send(body as object);
  }

  async function snapshot(id: string): Promise<DocumentSnapshot> {
    const row = await prisma.document.findUnique({
      where: { id },
      select: {
        content: true,
        contentBytes: true,
        contentVersion: true,
        updatedAt: true,
        title: true,
        directoryId: true,
      },
    });

    if (row === null) {
      throw new Error(`El documento ${id} no está en la base`);
    }

    return row;
  }

  function expectErrorBody(response: request.Response, statusCode: number, code: string): void {
    expect(Object.keys(response.body as object).sort()).toEqual(ERROR_KEYS_WITH_CODE);
    expect(response.body.statusCode).toBe(statusCode);
    expect(response.body.code).toBe(code);
  }

  /** Lanza la petición midiendo cuándo empezó y cuándo terminó, para poder afirmar el solape. */
  async function timed(start: () => request.Test): Promise<Timed> {
    const startedAt = performance.now();
    const response = await start();

    return { response, startedAt, settledAt: performance.now() };
  }

  function expectOverlap(a: Timed, b: Timed): void {
    expect(Math.max(a.startedAt, b.startedAt)).toBeLessThan(Math.min(a.settledAt, b.settledAt));
  }

  // ------------------------------------------------------------------------------------------
  // AC-1 · guardado feliz
  // ------------------------------------------------------------------------------------------

  describe('AC-1 — guardado feliz', () => {
    it('responde 200 con las claves exactas, contentVersion 1 y contentBytes en bytes UTF-8', async () => {
      const id = await createDocument(alice, 'Feliz');
      const antes = await snapshot(id);

      expect(antes.contentVersion).toBe(0);

      const response = await saveRequest(alice, id, {
        content: MULTIBYTE_CONTENT,
        expectedVersion: 0,
      });

      expect(response.status).toBe(200);

      const body = response.body as Record<string, unknown>;

      // Claves **exactamente** éstas y ninguna más: ni `content`, ni `title`, ni `directoryId`.
      expect(Object.keys(body).sort()).toEqual(CONTENT_SAVED_KEYS);
      expect(body['id']).toBe(id);
      expect(body['contentVersion']).toBe(1);

      // Bytes UTF-8, no caracteres: la `ñ` ocupa dos, así que las dos cifras difieren.
      expect(body['contentBytes']).toBe(Buffer.byteLength(MULTIBYTE_CONTENT, 'utf8'));
      expect(body['contentBytes']).not.toBe(MULTIBYTE_CONTENT.length);

      expect(typeof body['updatedAt']).toBe('string');
      expect(new Date(body['updatedAt'] as string).getTime()).toBeGreaterThanOrEqual(
        antes.updatedAt.getTime(),
      );

      // Y en la base la columna es **exactamente** lo que se envió.
      const despues = await snapshot(id);

      expect(despues.content).toBe(MULTIBYTE_CONTENT);
      expect(despues.contentBytes).toBe(Buffer.byteLength(MULTIBYTE_CONTENT, 'utf8'));
      expect(despues.contentVersion).toBe(1);
    });

    it('guarda el markdown byte a byte: ni recorta espacios finales ni normaliza saltos de línea', async () => {
      // Dos espacios al final de una línea son un salto de línea en markdown: un `@Transform` que
      // hiciera `trim` los borraría y lo guardado dejaría de ser lo escrito.
      const crudo = 'una línea con dos espacios  \r\nsegunda línea\n\n  ';
      const id = await createDocument(alice, 'Crudo');

      const response = await saveRequest(alice, id, { content: crudo, expectedVersion: 0 });

      expect(response.status).toBe(200);
      expect(response.body.contentBytes).toBe(Buffer.byteLength(crudo, 'utf8'));

      const fila = await snapshot(id);

      expect(fila.content).toBe(crudo);
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-2 · vaciar un documento
  // ------------------------------------------------------------------------------------------

  describe('AC-2 — vaciar un documento es legítimo', () => {
    it('acepta content vacío con 200, contentBytes 0 y la versión incrementada', async () => {
      const id = await createDocument(alice, 'Vaciar', '# Tenía texto');
      const antes = await snapshot(id);

      expect(antes.content.length).toBeGreaterThan(0);

      const response = await saveRequest(alice, id, {
        content: '',
        expectedVersion: antes.contentVersion,
      });

      expect(response.status).toBe(200);
      expect(response.body.contentBytes).toBe(0);
      expect(response.body.contentVersion).toBe(antes.contentVersion + 1);

      const despues = await snapshot(id);

      expect(despues.content).toBe('');
      expect(despues.contentBytes).toBe(0);
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-3 · validación, sin efectos sobre la fila
  // ------------------------------------------------------------------------------------------

  describe('AC-3 — cuerpos inválidos: 400 nombrando el campo y la fila sin cambiar', () => {
    const casos: readonly { readonly nombre: string; readonly body: unknown; readonly campo: string }[] =
      [
        { nombre: 'content ausente', body: { expectedVersion: 1 }, campo: 'content' },
        { nombre: 'content no string', body: { content: 42, expectedVersion: 1 }, campo: 'content' },
        {
          nombre: 'content de 200.001 caracteres',
          body: { content: 'x'.repeat(MAX_DOCUMENT_CONTENT_CHARS + 1), expectedVersion: 1 },
          campo: 'content',
        },
        { nombre: 'expectedVersion ausente', body: { content: 'hola' }, campo: 'expectedVersion' },
        {
          nombre: 'expectedVersion no numérico',
          body: { content: 'hola', expectedVersion: 'uno' },
          campo: 'expectedVersion',
        },
        {
          nombre: 'expectedVersion no entero',
          body: { content: 'hola', expectedVersion: 1.5 },
          campo: 'expectedVersion',
        },
        {
          nombre: 'expectedVersion negativo',
          body: { content: 'hola', expectedVersion: -1 },
          campo: 'expectedVersion',
        },
        {
          nombre: 'propiedad no declarada',
          body: { content: 'hola', expectedVersion: 1, title: 'Colado por la puerta de atrás' },
          campo: 'title',
        },
      ];

    it.each(casos)('$nombre → 400 nombrando el campo y sin tocar la fila', async ({ body, campo }) => {
      const id = await createDocument(alice, 'Validacion', 'estado inicial');

      // Se deja la fila en una versión distinta de 0 para que un `400` que sí escribiera resultase
      // visible tanto en `content` como en `contentVersion`.
      await saveRequest(alice, id, { content: 'estado de partida', expectedVersion: 0 }).expect(200);

      const antes = await snapshot(id);
      const response = await saveRequest(alice, id, body);

      expect(response.status).toBe(400);
      // El mensaje nombra el campo rechazado: sin esto, un `400` por otro motivo pasaría por bueno.
      expect(JSON.stringify(response.body.message)).toContain(campo);

      // Y la fila queda **exactamente** como estaba, `updatedAt` incluido.
      await expect(snapshot(id)).resolves.toEqual(antes);
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-4 · el documento legítimo más grande
  // ------------------------------------------------------------------------------------------

  describe('AC-4 — 200.000 caracteres', () => {
    it('acepta el contenido en el límite exacto con 200', async () => {
      const id = await createDocument(alice, 'Enorme');
      const contenido = 'y'.repeat(MAX_DOCUMENT_CONTENT_CHARS);

      const response = await saveRequest(alice, id, { content: contenido, expectedVersion: 0 });

      expect(response.status).toBe(200);
      expect(response.body.contentBytes).toBe(MAX_DOCUMENT_CONTENT_CHARS);
      expect(response.body.contentVersion).toBe(1);
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-5 · versión rancia
  // ------------------------------------------------------------------------------------------

  describe('AC-5 — versión rancia', () => {
    it('responde 409 DOCUMENT_CONTENT_CONFLICT y no escribe absolutamente nada', async () => {
      const id = await createDocument(alice, 'Rancia');

      await saveRequest(alice, id, { content: 'v1', expectedVersion: 0 }).expect(200);
      await saveRequest(alice, id, { content: 'v2', expectedVersion: 1 }).expect(200);
      await saveRequest(alice, id, { content: 'v3', expectedVersion: 2 }).expect(200);

      const antes = await snapshot(id);

      expect(antes.contentVersion).toBe(3);

      const response = await saveRequest(alice, id, {
        content: 'el perdedor no debe escribir nada',
        expectedVersion: 2,
      });

      expect(response.status).toBe(409);
      expectErrorBody(response, 409, 'DOCUMENT_CONTENT_CONFLICT');

      // Ni `content`, ni `contentBytes`, ni `contentVersion`, ni `updatedAt`.
      await expect(snapshot(id)).resolves.toEqual(antes);
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-6 · concurrencia
  // ------------------------------------------------------------------------------------------

  describe('AC-6 — dos guardados simultáneos desde la misma versión', () => {
    it('devuelve {200, 409}, la versión avanza exactamente uno y gana el contenido del 200', async () => {
      const id = await createDocument(alice, 'Concurrente');
      const antes = await snapshot(id);
      const version = antes.contentVersion;

      const contenidoA = '# Contenido de la petición A';
      const contenidoB = '# Contenido de la petición B, distinto y más largo';

      const [primera, segunda] = await Promise.all([
        timed(() => saveRequest(alice, id, { content: contenidoA, expectedVersion: version })),
        timed(() => saveRequest(alice, id, { content: contenidoB, expectedVersion: version })),
      ]);

      // Las dos estuvieron en vuelo a la vez: el caso mide concurrencia de verdad.
      expectOverlap(primera, segunda);

      const codigos = [primera.response.status, segunda.response.status].sort((a, b) => a - b);

      expect(codigos).toEqual([200, 409]);

      const ganadoraEsA = primera.response.status === 200;
      const ganadora = ganadoraEsA ? primera.response : segunda.response;
      const perdedora = ganadoraEsA ? segunda.response : primera.response;
      const contenidoGanador = ganadoraEsA ? contenidoA : contenidoB;

      expect(Object.keys(ganadora.body as object).sort()).toEqual(CONTENT_SAVED_KEYS);
      expectErrorBody(perdedora, 409, 'DOCUMENT_CONTENT_CONFLICT');

      const despues = await snapshot(id);

      // La mitad que se olvida: la versión avanza **uno**, no dos.
      expect(despues.contentVersion).toBe(version + 1);
      expect(ganadora.body.contentVersion).toBe(version + 1);
      expect(despues.content).toBe(contenidoGanador);
      expect(despues.contentBytes).toBe(Buffer.byteLength(contenidoGanador, 'utf8'));
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-7 · propiedad y credencial
  // ------------------------------------------------------------------------------------------

  describe('AC-7 — propiedad y credencial', () => {
    it('un documento ajeno responde 404 DOCUMENT_NOT_FOUND con la versión correcta', async () => {
      const ajeno = await createDocument(mallory, 'DeMallory', 'texto de mallory');
      const antes = await snapshot(ajeno);

      expect(antes.contentVersion).toBe(0);

      const response = await saveRequest(alice, ajeno, {
        content: 'alice no debería poder escribir aquí',
        expectedVersion: 0,
      });

      expect(response.status).toBe(404);
      expectErrorBody(response, 404, 'DOCUMENT_NOT_FOUND');

      await expect(snapshot(ajeno)).resolves.toEqual(antes);

      // Control positivo de la URL: **la misma ruta**, construida por la misma función, con el token
      // del dueño responde `200`. Sin esto, una errata en el path haría pasar el `404` de arriba por
      // el motivo equivocado, que es exactamente lo que ocurrió en la spec 002.
      const propia = await saveRequest(mallory, ajeno, {
        content: 'mallory sí puede',
        expectedVersion: 0,
      });

      expect(propia.status).toBe(200);
      expect(Object.keys(propia.body as object).sort()).toEqual(CONTENT_SAVED_KEYS);
    });

    it('un documento ajeno responde 404 y NUNCA 409 con una versión incorrecta', async () => {
      const ajeno = await createDocument(mallory, 'DeMalloryV', 'texto de mallory');

      // Se le sube la versión con su propio dueño para que la incorrecta lo sea de verdad.
      await saveRequest(mallory, ajeno, { content: 'v1 de mallory', expectedVersion: 0 }).expect(
        200,
      );

      const antes = await snapshot(ajeno);

      expect(antes.contentVersion).toBe(1);

      const response = await saveRequest(alice, ajeno, {
        content: 'alice con una versión que no es la real',
        expectedVersion: 0,
      });

      // Un `409` aquí confirmaría que el documento existe **y** cuál es su versión.
      expect(response.status).not.toBe(409);
      expect(response.status).toBe(404);
      expectErrorBody(response, 404, 'DOCUMENT_NOT_FOUND');

      await expect(snapshot(ajeno)).resolves.toEqual(antes);

      // Control positivo de la URL, otra vez: el dueño sí obtiene su `409` cuando la versión es
      // rancia, lo que demuestra que la ruta existe y que la desambiguación funciona en los dos
      // sentidos sobre **el mismo id**.
      const suyo = await saveRequest(mallory, ajeno, {
        content: 'mallory con la versión vieja',
        expectedVersion: 0,
      });

      expect(suyo.status).toBe(409);
      expectErrorBody(suyo, 409, 'DOCUMENT_CONTENT_CONFLICT');
    });

    it('un id que no es uuid responde 400', async () => {
      const response = await saveRequest(alice, 'no-soy-un-uuid', {
        content: 'da igual',
        expectedVersion: 0,
      });

      expect(response.status).toBe(400);
    });

    it('sin cabecera Authorization responde 401', async () => {
      const id = await createDocument(alice, 'SinToken', 'intacto');
      const antes = await snapshot(id);

      const response = await request(app.getHttpServer())
        .put(contentPath(id))
        .send({ content: 'sin credencial', expectedVersion: 0 });

      expect(response.status).toBe(401);
      expect(Object.keys(response.body as object).sort()).toEqual(ERROR_KEYS);

      await expect(snapshot(id)).resolves.toEqual(antes);
    });

    it('con un refresh token como Bearer responde 401', async () => {
      const id = await createDocument(alice, 'RefreshComoBearer', 'intacto');
      const antes = await snapshot(id);

      // El refresh es un JWT válido y vigente, pero de otro tipo: si el guard solo comprobara la
      // firma, este caso pasaría con `200` y la cookie de refresh valdría como credencial de API.
      expect(alice.refreshToken).not.toBe(alice.accessToken);
      expect(alice.refreshToken.length).toBeGreaterThan(0);

      const response = await saveRequest(
        null,
        id,
        { content: 'con el refresh', expectedVersion: 0 },
        alice.refreshToken,
      );

      expect(response.status).toBe(401);
      expect(Object.keys(response.body as object).sort()).toEqual(ERROR_KEYS);

      await expect(snapshot(id)).resolves.toEqual(antes);
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-8 · idempotencia respecto de la versión, no del cuerpo
  // ------------------------------------------------------------------------------------------

  describe('AC-8 — la puerta es la versión, no la igualdad del contenido', () => {
    it('el mismo contenido con la versión vieja da 409 y con la nueva da 200', async () => {
      const id = await createDocument(alice, 'Idempotente');
      const contenido = '# El mismo texto exacto las dos veces';

      const primera = await saveRequest(alice, id, { content: contenido, expectedVersion: 0 });

      expect(primera.status).toBe(200);
      expect(primera.body.contentVersion).toBe(1);

      // Reenviar el mismo cuerpo con la versión ya consumida no puede producir un segundo cambio.
      const repetida = await saveRequest(alice, id, { content: contenido, expectedVersion: 0 });

      expect(repetida.status).toBe(409);
      expectErrorBody(repetida, 409, 'DOCUMENT_CONTENT_CONFLICT');
      await expect(snapshot(id)).resolves.toMatchObject({ contentVersion: 1, content: contenido });

      // Con la versión nueva, el mismo contenido vuelve a entrar: no hay «no ha cambiado nada».
      const conVersionNueva = await saveRequest(alice, id, {
        content: contenido,
        expectedVersion: 1,
      });

      expect(conVersionNueva.status).toBe(200);
      expect(conVersionNueva.body.contentVersion).toBe(2);
      await expect(snapshot(id)).resolves.toMatchObject({ contentVersion: 2, content: contenido });
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-9 · ortogonalidad con renombrar y mover
  // ------------------------------------------------------------------------------------------

  describe('AC-9 — guardar, renombrar y mover son ortogonales', () => {
    it('renombrar y mover no cambian contentVersion', async () => {
      const id = await createDocument(alice, 'Ortogonal', '# texto');

      await saveRequest(alice, id, { content: '# texto guardado', expectedVersion: 0 }).expect(200);

      const antesDeRenombrar = await snapshot(id);

      expect(antesDeRenombrar.contentVersion).toBe(1);

      await request(app.getHttpServer())
        .patch(`/api/workspace/documents/${id}`)
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ title: nextTitle('Renombrado') })
        .expect(200);

      await expect(snapshot(id)).resolves.toMatchObject({
        contentVersion: 1,
        content: antesDeRenombrar.content,
      });

      const destino = await createDirectory(alice, 'DestinoOrtogonal');

      await request(app.getHttpServer())
        .post(`/api/workspace/documents/${id}/move`)
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ directoryId: destino })
        .expect(200);

      await expect(snapshot(id)).resolves.toMatchObject({
        contentVersion: 1,
        content: antesDeRenombrar.content,
        directoryId: destino,
      });

      // Y el guardado sigue funcionando con la versión de siempre: renombrar y mover no la gastaron.
      const guardado = await saveRequest(alice, id, {
        content: '# después de renombrar y mover',
        expectedVersion: 1,
      });

      expect(guardado.status).toBe(200);
      expect(guardado.body.contentVersion).toBe(2);
    });

    it('guardar no cambia el title ni el directoryId', async () => {
      const carpeta = await createDirectory(alice, 'CarpetaDelGuardado');
      const id = await createDocument(alice, 'NoSeMueve', '# inicial', carpeta);
      const antes = await snapshot(id);

      const response = await saveRequest(alice, id, {
        content: '# contenido nuevo del todo',
        expectedVersion: antes.contentVersion,
      });

      expect(response.status).toBe(200);

      const despues = await snapshot(id);

      expect(despues.title).toBe(antes.title);
      expect(despues.directoryId).toBe(carpeta);
      expect(despues.content).toBe('# contenido nuevo del todo');
    });
  });

  // ------------------------------------------------------------------------------------------
  // AC-13 · cuerpo por encima de JSON_BODY_LIMIT
  // ------------------------------------------------------------------------------------------

  describe('AC-13 — cuerpo por encima de 2 MiB', () => {
    it('responde 413 con la forma de ErrorResponseDto y no 500', async () => {
      expect(JSON_BODY_LIMIT).toBe('2mb');
      expect(OVERSIZED_CONTENT.length).toBeGreaterThan(2 * 1024 * 1024);

      const id = await createDocument(alice, 'Gigante', '# cabe');
      const antes = await snapshot(id);

      const response = await saveRequest(alice, id, {
        content: OVERSIZED_CONTENT,
        expectedVersion: antes.contentVersion,
      });

      expect(response.status).toBe(413);

      const body = response.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(ERROR_KEYS);
      expect(body['statusCode']).toBe(413);
      expect(body['error']).toBe('Payload Too Large');
      expect(body['path']).toBe(contentPath(id));

      // Y la fila no se tocó: el cuerpo no llegó siquiera al DTO.
      await expect(snapshot(id)).resolves.toEqual(antes);

      // Control positivo de la URL, y no es una formalidad: el `413` lo produce el body parser
      // **antes** del enrutado, así que este caso es verde incluso contra una ruta que no existe.
      // Sin este `200` el `413` no demostraría nada sobre `PUT …/content` (medido: en el RED de
      // T-005 éste era el único caso del archivo que pasaba, con el endpoint aún sin escribir).
      const cabe = await saveRequest(alice, id, {
        content: '# esto sí cabe',
        expectedVersion: antes.contentVersion,
      });

      expect(cabe.status).toBe(200);
      expect(Object.keys(cabe.body as object).sort()).toEqual(CONTENT_SAVED_KEYS);
    });
  });
});
