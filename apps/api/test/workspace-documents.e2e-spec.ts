import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  MAX_DOCUMENT_CONTENT_CHARS,
  MAX_DOCUMENT_TITLE_LENGTH,
} from '../src/workspace/workspace.constants';
import { DOCUMENT_SELECT, DOCUMENT_SUMMARY_SELECT } from '../src/workspace/workspace.repository';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * Alta, detalle, renombrado y borrado de documentos (spec 002, AC-12…AC-16 y AC-18). El **move** de
 * documento vive en `workspace-move.e2e-spec.ts`, junto al de directorios.
 *
 * Dos usuarios y no uno: AC-15 exige que el documento de **otro** responda `404` y no `403`, y AC-13
 * lo mismo con un `directoryId` ajeno. Los dos se borran al final y la cascada de `onDelete: Cascade`
 * se lleva sus directorios y documentos (plan §8).
 *
 * Cada caso usa títulos propios dentro de su usuario, así el archivo puede correr dos veces seguidas
 * contra la misma base de desarrollo sin arrastrar estado.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/**
 * Claves **exactas** de `WorkspaceDocumentResponseDto`, ordenadas para comparar sin ambigüedad.
 *
 * `contentVersion` entra aquí por la **enmienda de la spec `002` a v0.4.0** (§6 de la spec `003`),
 * que autoriza a cambiar exactamente esta lista y la de AC-15 —las dos aserciones de claves
 * exactas— y **nada más** de esa spec. Es el detalle y el alta los que lo traen: el resumen no.
 */
const DOCUMENT_KEYS = [
  'content',
  'contentBytes',
  'contentVersion',
  'createdAt',
  'directoryId',
  'id',
  'title',
  'updatedAt',
];

/**
 * Claves **exactas** de `WorkspaceDocumentSummaryResponseDto`: las mismas **menos** `content`.
 *
 * Se escriben a mano y no como `DOCUMENT_KEYS.filter(...)` a propósito: derivar una lista de la otra
 * haría que un `content` colado en el resumen desapareciera también del filtro y el caso pasaría en
 * verde sin comprobar nada.
 */
const DOCUMENT_SUMMARY_KEYS = [
  'contentBytes',
  'createdAt',
  'directoryId',
  'id',
  'title',
  'updatedAt',
];

/**
 * Contenido con un carácter **multibyte** a propósito: en UTF-8 la `ñ` ocupa dos bytes, así que
 * `contentBytes` no puede coincidir con la longitud en caracteres. Un test con solo ASCII pasaría
 * igual si alguien implementara `content.length`, que es justo el error que se quiere impedir.
 */
const MULTIBYTE_CONTENT = '# Hola ñ';

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

interface DocumentBody {
  readonly title?: unknown;
  readonly directoryId?: unknown;
  readonly content?: unknown;
  readonly [extra: string]: unknown;
}

describe('documentos del workspace (e2e) — AC-12…AC-16 y AC-18', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;
  let bob: Actor;

  /** Contador de nombres únicos; ver `uniqueTitle`. */
  let seq = 0;

  beforeAll(async () => {
    app = await createAuthApp();
    prisma = app.get(PrismaService);
    await resetThrottleCounters(app);
    alice = await register('docs-alice');
    bob = await register('docs-bob');
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

    return { userId, email, accessToken: response.body.accessToken };
  }

  function post(actor: Actor, body: DocumentBody): request.Test {
    return request(app.getHttpServer())
      .post('/api/workspace/documents')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send(body);
  }

  function get(actor: Actor, id: string): request.Test {
    return request(app.getHttpServer())
      .get(`/api/workspace/documents/${id}`)
      .set('Authorization', `Bearer ${actor.accessToken}`);
  }

  /**
   * Títulos únicos para los casos que crean varios documentos en la raíz de Alice: el contador hace
   * que dos casos no se pisen entre sí ni entre corridas del archivo contra la misma base.
   */
  function uniqueTitle(base: string): string {
    seq += 1;
    return `${base} ${String(seq)}`;
  }

  function patch(actor: Actor, id: string, body: DocumentBody): request.Test {
    return request(app.getHttpServer())
      .patch(`/api/workspace/documents/${id}`)
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send(body);
  }

  function remove(actor: Actor, id: string): request.Test {
    return request(app.getHttpServer())
      .delete(`/api/workspace/documents/${id}`)
      .set('Authorization', `Bearer ${actor.accessToken}`);
  }

  /** Move de documento (spec 002, AC-17). Aquí solo interesa **la forma** de su respuesta. */
  function move(actor: Actor, id: string, directoryId: string | null): request.Test {
    return request(app.getHttpServer())
      .post(`/api/workspace/documents/${id}/move`)
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ directoryId });
  }

  /** Los `documents` del árbol del actor, tal cual salen por HTTP. */
  async function fetchTreeDocuments(actor: Actor): Promise<Array<Record<string, unknown>>> {
    const response = await request(app.getHttpServer())
      .get('/api/workspace/tree')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .expect(200);

    return (response.body as { documents: Array<Record<string, unknown>> }).documents;
  }

  /** La fila cruda, con las columnas internas que ningún DTO expone. `null` si ya no existe. */
  function documentRow(id: string): Promise<{
    title: string;
    titleKey: string;
    content: string;
    contentBytes: number;
    directoryId: string | null;
    parentScopeId: string;
  } | null> {
    return prisma.document.findUnique({
      where: { id },
      select: {
        title: true,
        titleKey: true,
        content: true,
        contentBytes: true,
        directoryId: true,
        parentScopeId: true,
      },
    });
  }

  /** Alta que se espera que funcione; devuelve el cuerpo ya comprobado como `201`. */
  async function createOk(actor: Actor, body: DocumentBody): Promise<Record<string, unknown>> {
    const response = await post(actor, body).expect(201);
    return response.body as Record<string, unknown>;
  }

  /** Directorio propio del actor, creado por el endpoint de directorios (T-005). */
  async function createDirectory(actor: Actor, name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/workspace/directories')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ name, parentId: null })
      .expect(201);

    return String((response.body as Record<string, unknown>)['id']);
  }

  function countDocuments(actor: Actor): Promise<number> {
    return prisma.document.count({ where: { userId: actor.userId } });
  }

  describe('AC-12: alta con y sin contenido', () => {
    it('responde 201 con las claves exactas del DTO y contentBytes en bytes UTF-8', async () => {
      const body = await createOk(alice, {
        title: 'Ideas',
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      expect(Object.keys(body).sort()).toEqual(DOCUMENT_KEYS);
      expect(body['title']).toBe('Ideas');
      expect(body['directoryId']).toBeNull();
      expect(body['content']).toBe(MULTIBYTE_CONTENT);
      expect(body['contentBytes']).toBe(Buffer.byteLength(MULTIBYTE_CONTENT, 'utf8'));
      // El caso solo mide lo que dice medir si las dos magnitudes difieren.
      expect(body['contentBytes']).not.toBe(MULTIBYTE_CONTENT.length);
      expect(typeof body['id']).toBe('string');
      expect(new Date(String(body['createdAt'])).toString()).not.toBe('Invalid Date');
      expect(new Date(String(body['updatedAt'])).toString()).not.toBe('Invalid Date');
    });

    it('la fila guardada tiene parentScopeId igual al userId del token, titleKey en minúsculas y contentBytes persistido', async () => {
      const body = await createOk(alice, {
        title: 'Bitácora Diaria',
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      const row = await prisma.document.findUniqueOrThrow({
        where: { id: String(body['id']) },
        select: {
          userId: true,
          directoryId: true,
          parentScopeId: true,
          title: true,
          titleKey: true,
          content: true,
          contentBytes: true,
        },
      });

      expect(row.userId).toBe(alice.userId);
      expect(row.directoryId).toBeNull();
      expect(row.parentScopeId).toBe(alice.userId);
      expect(row.title).toBe('Bitácora Diaria');
      expect(row.titleKey).toBe('bitácora diaria');
      expect(row.content).toBe(MULTIBYTE_CONTENT);
      expect(row.contentBytes).toBe(Buffer.byteLength(MULTIBYTE_CONTENT, 'utf8'));
    });

    it('sin content responde 201 con content "" y contentBytes 0', async () => {
      const body = await createOk(alice, { title: 'Vacío', directoryId: null });

      expect(body['content']).toBe('');
      expect(body['contentBytes']).toBe(0);

      const row = await prisma.document.findUniqueOrThrow({
        where: { id: String(body['id']) },
        select: { content: true, contentBytes: true },
      });

      expect(row.content).toBe('');
      expect(row.contentBytes).toBe(0);
    });

    it('dentro de un directorio propio responde 201 con ese directoryId y parentScopeId igual al directorio', async () => {
      const directoryId = await createDirectory(alice, 'Cuaderno');
      const body = await createOk(alice, { title: 'Anidado', directoryId, content: 'x' });

      expect(body['directoryId']).toBe(directoryId);

      const row = await prisma.document.findUniqueOrThrow({
        where: { id: String(body['id']) },
        select: { directoryId: true, parentScopeId: true, userId: true },
      });

      expect(row.directoryId).toBe(directoryId);
      expect(row.parentScopeId).toBe(directoryId);
      expect(row.userId).toBe(alice.userId);
    });

    it('el cuerpo no expone userId, titleKey ni parentScopeId', async () => {
      const body = await createOk(alice, { title: 'Sin fugas', directoryId: null });
      const serialized = JSON.stringify(body);

      expect(serialized).not.toContain('userId');
      expect(serialized).not.toContain('titleKey');
      expect(serialized).not.toContain('parentScopeId');
      expect(serialized).not.toContain(alice.userId);
    });

    it('responde 401 sin cabecera Authorization y no crea nada', async () => {
      const antes = await countDocuments(alice);

      await request(app.getHttpServer())
        .post('/api/workspace/documents')
        .send({ title: 'Sin token', directoryId: null })
        .expect(401);

      expect(await countDocuments(alice)).toBe(antes);
    });
  });

  describe('AC-13: cuerpo inválido → 400 nombrando el campo, sin filas nuevas', () => {
    const casos: ReadonlyArray<{ caso: string; body: DocumentBody; campo: string }> = [
      { caso: 'title vacío', body: { title: '', directoryId: null }, campo: 'title' },
      { caso: 'title de solo espacios', body: { title: '   ', directoryId: null }, campo: 'title' },
      {
        caso: 'title de 201 caracteres',
        body: { title: 'x'.repeat(MAX_DOCUMENT_TITLE_LENGTH + 1), directoryId: null },
        campo: 'title',
      },
      {
        caso: 'title con carácter de control',
        body: { title: 'a\u0007b', directoryId: null },
        campo: 'title',
      },
      { caso: 'title con /', body: { title: 'a/b', directoryId: null }, campo: 'title' },
      { caso: 'title con \\', body: { title: 'a\\b', directoryId: null }, campo: 'title' },
      { caso: 'title igual a ..', body: { title: '..', directoryId: null }, campo: 'title' },
      { caso: 'title que no es cadena', body: { title: 42, directoryId: null }, campo: 'title' },
      { caso: 'directoryId ausente', body: { title: 'Sin carpeta declarada' }, campo: 'directoryId' },
      {
        caso: 'directoryId que no es uuid',
        body: { title: 'Carpeta rara', directoryId: 'no-uuid' },
        campo: 'directoryId',
      },
      {
        caso: 'content que no es cadena',
        body: { title: 'Contenido raro', directoryId: null, content: 42 },
        campo: 'content',
      },
      {
        caso: 'propiedad no declarada',
        body: { title: 'Con extra', directoryId: null, color: 'rojo' },
        campo: 'color',
      },
    ];

    it.each(casos)('$caso', async ({ body, campo }) => {
      const antes = await countDocuments(alice);

      const response = await post(alice, body).expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(JSON.stringify(response.body.message)).toContain(campo);
      expect(await countDocuments(alice)).toBe(antes);
    });

    it('content de 200.001 caracteres responde 400 nombrando content y no crea nada', async () => {
      const antes = await countDocuments(alice);

      const response = await post(alice, {
        title: 'Demasiado largo',
        directoryId: null,
        content: 'a'.repeat(MAX_DOCUMENT_CONTENT_CHARS + 1),
      }).expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(JSON.stringify(response.body.message)).toContain('content');
      expect(await countDocuments(alice)).toBe(antes);
    });

    it('content de 200.000 caracteres responde 201: el límite de cuerpo no rechaza un documento legítimo', async () => {
      const content = 'a'.repeat(MAX_DOCUMENT_CONTENT_CHARS);

      const body = await createOk(alice, { title: 'En el límite', directoryId: null, content });

      expect(String(body['content'])).toHaveLength(MAX_DOCUMENT_CONTENT_CHARS);
      expect(body['contentBytes']).toBe(MAX_DOCUMENT_CONTENT_CHARS);
    });
  });

  describe('AC-13: directoryId inexistente o ajeno → 404 PARENT_NOT_FOUND, nunca 403', () => {
    it('responde 404 con un directoryId de otro usuario', async () => {
      const deBob = await createDirectory(bob, 'Privado de Bob');
      const antes = await countDocuments(alice);

      const response = await post(alice, { title: 'Intruso', directoryId: deBob }).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('PARENT_NOT_FOUND');
      expect(await countDocuments(alice)).toBe(antes);
    });

    it('responde 404 con un directoryId que no existe', async () => {
      const antes = await countDocuments(alice);

      const response = await post(alice, {
        title: 'Huérfano',
        directoryId: randomUUID(),
      }).expect(404);

      expect(response.body.code).toBe('PARENT_NOT_FOUND');
      expect(await countDocuments(alice)).toBe(antes);
    });
  });

  describe('AC-14: unicidad de títulos entre hermanos y convivencia con directorios', () => {
    it('responde 409 DOCUMENT_TITLE_TAKEN con el mismo título en otra caja y deja una sola fila', async () => {
      await createOk(alice, { title: 'Recetas', directoryId: null });

      const response = await post(alice, { title: 'RECETAS', directoryId: null }).expect(409);

      expect(response.body.statusCode).toBe(409);
      expect(response.body.code).toBe('DOCUMENT_TITLE_TAKEN');

      const filas = await prisma.document.count({
        where: { userId: alice.userId, parentScopeId: alice.userId, titleKey: 'recetas' },
      });

      expect(filas).toBe(1);
    });

    it('responde 201 con el mismo título dentro de un directorio', async () => {
      const directoryId = await createDirectory(alice, 'Archivo');
      await createOk(alice, { title: 'Comunes', directoryId: null });

      const body = await createOk(alice, { title: 'Comunes', directoryId });

      expect(body['directoryId']).toBe(directoryId);
    });

    it('responde 201 con el mismo título para otro usuario en su propia raíz', async () => {
      await createOk(alice, { title: 'Compartido', directoryId: null });

      const body = await createOk(bob, { title: 'Compartido', directoryId: null });

      expect(body['directoryId']).toBeNull();
    });

    it('un documento y un directorio hermanos pueden llamarse igual (espacios de nombres separados)', async () => {
      await createDirectory(alice, 'Convive');

      const body = await createOk(alice, { title: 'Convive', directoryId: null });

      expect(body['title']).toBe('Convive');
      expect(body['directoryId']).toBeNull();
    });
  });

  describe('AC-15: detalle del documento', () => {
    it('responde 200 con el content completo y las claves exactas del DTO', async () => {
      const creado = await createOk(alice, {
        title: 'Para leer',
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      const response = await get(alice, String(creado['id'])).expect(200);
      const body = response.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(DOCUMENT_KEYS);
      expect(body['id']).toBe(creado['id']);
      expect(body['title']).toBe('Para leer');
      expect(body['content']).toBe(MULTIBYTE_CONTENT);
      expect(body['contentBytes']).toBe(Buffer.byteLength(MULTIBYTE_CONTENT, 'utf8'));
      expect(JSON.stringify(body)).not.toContain(alice.userId);
    });

    it('responde 404 DOCUMENT_NOT_FOUND con el id de un documento de otro usuario', async () => {
      const deBob = await createOk(bob, { title: 'Diario de Bob', directoryId: null });

      const response = await get(alice, String(deBob['id'])).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('responde 404 DOCUMENT_NOT_FOUND con un id que no existe', async () => {
      const response = await get(alice, randomUUID()).expect(404);

      expect(response.body.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('responde 400 con un id que no es uuid', async () => {
      const response = await get(alice, 'no-uuid').expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('responde 401 sin cabecera Authorization', async () => {
      const creado = await createOk(alice, { title: 'Protegido', directoryId: null });

      await request(app.getHttpServer())
        .get(`/api/workspace/documents/${String(creado['id'])}`)
        .expect(401);
    });
  });

  /**
   * AC-11 de la spec `003`. Dos mitades, y la segunda es la que se olvida:
   *
   * 1. `contentVersion` viaja en el **alta** y en el **detalle**, que son las dos respuestas que
   *    llevan el texto, y vale `0` en un documento recién creado tenga o no contenido inicial.
   * 2. **No** viaja en el resumen —renombrado, move y árbol—, porque un resumen sin texto no tiene
   *    nada que versionar. Enviarlo ahí haría que la barra lateral arrastrase un token de
   *    concurrencia que nunca puede usar, y arrastrar campos del documento hacia el resumen es
   *    exactamente el camino por el que `content` acabaría en el árbol: en PostgreSQL ese texto vive
   *    en TOAST y el árbol se convertiría en una descarga del workspace entero en cada recarga.
   */
  describe('AC-11 (spec 003): contentVersion solo donde viaja el contenido', () => {
    it('el alta con contenido inicial responde contentVersion 0 y las claves exactas del DTO', async () => {
      const body = await createOk(alice, {
        title: uniqueTitle('Versión al nacer'),
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      expect(Object.keys(body).sort()).toEqual(DOCUMENT_KEYS);
      expect(body['contentVersion']).toBe(0);
    });

    it('el alta SIN contenido responde contentVersion 0: la columna arranca igual con texto y sin él', async () => {
      const body = await createOk(alice, {
        title: uniqueTitle('Versión al nacer vacío'),
        directoryId: null,
      });

      expect(Object.keys(body).sort()).toEqual(DOCUMENT_KEYS);
      expect(body['content']).toBe('');
      expect(body['contentVersion']).toBe(0);
    });

    it('el detalle responde contentVersion 0 y las claves exactas del DTO', async () => {
      const creado = await createOk(alice, {
        title: uniqueTitle('Detalle versionado'),
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      const response = await get(alice, String(creado['id'])).expect(200);
      const body = response.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(DOCUMENT_KEYS);
      expect(body['contentVersion']).toBe(0);
      expect(body['contentVersion']).toBe(creado['contentVersion']);
    });

    it('el renombrado devuelve el resumen: ni contentVersion ni content', async () => {
      const creado = await createOk(alice, {
        title: uniqueTitle('Renombrable versionado'),
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      const response = await patch(alice, String(creado['id']), {
        title: uniqueTitle('Renombrado versionado'),
      }).expect(200);
      const body = response.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(DOCUMENT_SUMMARY_KEYS);
      expect(body).not.toHaveProperty('contentVersion');
      expect(body).not.toHaveProperty('content');
    });

    it('el move devuelve el resumen: ni contentVersion ni content', async () => {
      const directoryId = await createDirectory(alice, uniqueTitle('Destino versionado'));
      const creado = await createOk(alice, {
        title: uniqueTitle('Movible versionado'),
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      const response = await move(alice, String(creado['id']), directoryId).expect(200);
      const body = response.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(DOCUMENT_SUMMARY_KEYS);
      expect(body).not.toHaveProperty('contentVersion');
      expect(body).not.toHaveProperty('content');
      expect(body['directoryId']).toBe(directoryId);
    });

    it('GET /tree sigue sin traer contentVersion ni content en sus documents', async () => {
      await createOk(alice, {
        title: uniqueTitle('En el árbol versionado'),
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      const documents = await fetchTreeDocuments(alice);

      // Sin esto el bucle podría no iterar y el caso pasaría sin comprobar nada.
      expect(documents.length).toBeGreaterThan(0);

      for (const document of documents) {
        expect(Object.keys(document).sort()).toEqual(DOCUMENT_SUMMARY_KEYS);
        expect(document).not.toHaveProperty('contentVersion');
        expect(document).not.toHaveProperty('content');
      }
    });

    /**
     * La mitad del AC que **no se puede observar por HTTP**, y por eso se afirma aquí sobre las
     * constantes del repositorio.
     *
     * Los DTO se construyen campo a campo, así que una columna de más en el `select` del resumen no
     * asomaría por ninguna respuesta: se pagaría en cada lectura del árbol, en silencio y para
     * siempre. Es el mismo tipo de regla que `workspace-data-access.spec.ts` comprueba sobre el
     * árbol de archivos —invisible al comportamiento, rota por el paso del tiempo—, así que se
     * verifica donde vive: en el contrato de columnas.
     *
     * Se afirma el juego **exacto** y no solo la ausencia de `contentVersion`: es lo que impide que
     * mañana se cuele `content` en el resumen, que es el mismo error con una factura mucho mayor.
     */
    describe('contrato de columnas del repositorio', () => {
      it('DOCUMENT_SELECT selecciona exactamente las claves que publica el DTO completo', () => {
        expect(Object.keys(DOCUMENT_SELECT).sort()).toEqual(DOCUMENT_KEYS);
        expect(DOCUMENT_SELECT).toHaveProperty('contentVersion', true);
      });

      it('DOCUMENT_SUMMARY_SELECT selecciona exactamente las del resumen: ni contentVersion ni content', () => {
        expect(Object.keys(DOCUMENT_SUMMARY_SELECT).sort()).toEqual(DOCUMENT_SUMMARY_KEYS);
        expect(DOCUMENT_SUMMARY_SELECT).not.toHaveProperty('contentVersion');
        expect(DOCUMENT_SUMMARY_SELECT).not.toHaveProperty('content');
      });
    });
  });

  describe('AC-16: renombrado', () => {
    it('responde 200 con las claves del resumen, sin content, y el título cambia en la base', async () => {
      const creado = await createOk(alice, {
        title: 'Título viejo',
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      const response = await patch(alice, String(creado['id']), {
        title: 'Título nuevo',
      }).expect(200);
      const body = response.body as Record<string, unknown>;

      // El renombrado **no** devuelve el texto: sería descargar el documento entero para cambiarle
      // el nombre, y en PostgreSQL ese texto vive en TOAST.
      expect(Object.keys(body).sort()).toEqual(DOCUMENT_SUMMARY_KEYS);
      expect(body).not.toHaveProperty('content');
      expect(body['id']).toBe(creado['id']);
      expect(body['title']).toBe('Título nuevo');
      expect(body['directoryId']).toBeNull();
      expect(body['contentBytes']).toBe(Buffer.byteLength(MULTIBYTE_CONTENT, 'utf8'));
      expect(JSON.stringify(body)).not.toContain(alice.userId);

      const row = await documentRow(String(creado['id']));

      expect(row?.title).toBe('Título nuevo');
      expect(row?.titleKey).toBe('título nuevo');
      // Renombrar no toca el texto ni su tamaño.
      expect(row?.content).toBe(MULTIBYTE_CONTENT);
      expect(row?.contentBytes).toBe(Buffer.byteLength(MULTIBYTE_CONTENT, 'utf8'));
    });

    it('responde 409 DOCUMENT_TITLE_TAKEN cuando choca con un hermano y el título no cambia', async () => {
      await createOk(alice, { title: 'Ocupado', directoryId: null });
      const creado = await createOk(alice, { title: 'Aspirante', directoryId: null });

      const response = await patch(alice, String(creado['id']), { title: 'OCUPADO' }).expect(409);

      expect(response.body.statusCode).toBe(409);
      expect(response.body.code).toBe('DOCUMENT_TITLE_TAKEN');
      expect((await documentRow(String(creado['id'])))?.title).toBe('Aspirante');
    });

    it('cambiar solo la caja del propio título no es colisión: 200', async () => {
      const creado = await createOk(alice, { title: 'Mayúsculas propias', directoryId: null });

      const response = await patch(alice, String(creado['id']), {
        title: 'MAYÚSCULAS PROPIAS',
      }).expect(200);

      expect(response.body.title).toBe('MAYÚSCULAS PROPIAS');
      expect((await documentRow(String(creado['id'])))?.title).toBe('MAYÚSCULAS PROPIAS');
    });

    it('el mismo título puede convivir en directorios distintos', async () => {
      const directoryId = await createDirectory(alice, 'Carpeta de renombrados');
      await createOk(alice, { title: 'Homónimo', directoryId: null });
      const creado = await createOk(alice, { title: 'Provisional', directoryId });

      const response = await patch(alice, String(creado['id']), { title: 'Homónimo' }).expect(200);

      expect(response.body.title).toBe('Homónimo');
      expect(response.body.directoryId).toBe(directoryId);
    });

    const casosInvalidos: ReadonlyArray<{ caso: string; body: DocumentBody; campo: string }> = [
      { caso: 'title vacío', body: { title: '' }, campo: 'title' },
      { caso: 'title de solo espacios', body: { title: '   ' }, campo: 'title' },
      {
        caso: 'title de 201 caracteres',
        body: { title: 'x'.repeat(MAX_DOCUMENT_TITLE_LENGTH + 1) },
        campo: 'title',
      },
      { caso: 'title con /', body: { title: 'a/b' }, campo: 'title' },
      { caso: 'title que no es cadena', body: { title: 42 }, campo: 'title' },
      { caso: 'title ausente', body: {}, campo: 'title' },
      // `directoryId` no se declara en el DTO de renombrado: renombrar y mover son endpoints
      // separados, y colarlo aquí tiene que ser un `400` explícito y no un move silencioso.
      { caso: 'directoryId colado', body: { title: 'Con sitio', directoryId: null }, campo: 'directoryId' },
      { caso: 'content colado', body: { title: 'Con texto', content: 'x' }, campo: 'content' },
    ];

    it.each(casosInvalidos)('$caso → 400 y el título no cambia', async ({ body, campo }) => {
      const creado = await createOk(alice, {
        title: uniqueTitle('Intacto'),
        directoryId: null,
      });
      const antes = await documentRow(String(creado['id']));

      const response = await patch(alice, String(creado['id']), body).expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(JSON.stringify(response.body.message)).toContain(campo);
      expect((await documentRow(String(creado['id'])))?.title).toBe(antes?.title);
    });

    it('responde 400 con un :id que no es uuid', async () => {
      await patch(alice, 'no-uuid', { title: 'Da igual' }).expect(400);
    });

    it('responde 404 DOCUMENT_NOT_FOUND con un documento de otro usuario, y el suyo no cambia', async () => {
      const deBob = await createOk(bob, { title: 'Ajeno intocable', directoryId: null });

      const response = await patch(alice, String(deBob['id']), { title: 'Secuestrado' }).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('DOCUMENT_NOT_FOUND');
      expect((await documentRow(String(deBob['id'])))?.title).toBe('Ajeno intocable');
    });

    it('responde 401 sin cabecera Authorization y el título no cambia', async () => {
      const creado = await createOk(alice, { title: 'Renombrado sin token', directoryId: null });

      await request(app.getHttpServer())
        .patch(`/api/workspace/documents/${String(creado['id'])}`)
        .send({ title: 'Colado' })
        .expect(401);

      expect((await documentRow(String(creado['id'])))?.title).toBe('Renombrado sin token');
    });
  });

  describe('AC-18: borrado', () => {
    it('responde 204 sin cuerpo y la fila desaparece', async () => {
      const creado = await createOk(alice, {
        title: 'Efímero',
        directoryId: null,
        content: MULTIBYTE_CONTENT,
      });

      const response = await remove(alice, String(creado['id'])).expect(204);

      expect(response.body).toEqual({});
      expect(response.text).toBe('');
      expect(await documentRow(String(creado['id']))).toBeNull();
    });

    it('el segundo DELETE del mismo id responde 404 DOCUMENT_NOT_FOUND: no es idempotente', async () => {
      const creado = await createOk(alice, { title: 'Se borra una vez', directoryId: null });

      await remove(alice, String(creado['id'])).expect(204);

      const response = await remove(alice, String(creado['id'])).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('borrar un documento libera su título en el mismo ámbito', async () => {
      const creado = await createOk(alice, { title: 'Reutilizable', directoryId: null });

      await remove(alice, String(creado['id'])).expect(204);

      const nuevo = await createOk(alice, { title: 'Reutilizable', directoryId: null });

      expect(nuevo['id']).not.toBe(creado['id']);
    });

    it('borrar un documento no toca el directorio que lo contenía', async () => {
      const directoryId = await createDirectory(alice, 'Sobrevive al borrado');
      const creado = await createOk(alice, { title: 'Dentro', directoryId });

      await remove(alice, String(creado['id'])).expect(204);

      expect(await prisma.directory.count({ where: { id: directoryId } })).toBe(1);
    });

    it('responde 404 con un id que no existe', async () => {
      const response = await remove(alice, randomUUID()).expect(404);

      expect(response.body.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('responde 404 con el documento de otro usuario y la fila sigue ahí', async () => {
      const deBob = await createOk(bob, { title: 'No se borra', directoryId: null });

      const response = await remove(alice, String(deBob['id'])).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('DOCUMENT_NOT_FOUND');
      expect(await documentRow(String(deBob['id']))).not.toBeNull();
    });

    it('responde 400 con un :id que no es uuid', async () => {
      await remove(alice, 'no-uuid').expect(400);
    });

    it('responde 401 sin cabecera Authorization y la fila sigue ahí', async () => {
      const creado = await createOk(alice, { title: 'Borrado sin token', directoryId: null });

      await request(app.getHttpServer())
        .delete(`/api/workspace/documents/${String(creado['id'])}`)
        .expect(401);

      expect(await documentRow(String(creado['id']))).not.toBeNull();
    });
  });
});
