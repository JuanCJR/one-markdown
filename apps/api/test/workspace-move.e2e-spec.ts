import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { MAX_DIRECTORY_DEPTH } from '../src/workspace/workspace.constants';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * `POST /api/workspace/directories/:id/move` (spec 002, AC-8, AC-9 y AC-10).
 *
 * Archivo aparte del de altas y borrados porque el move es la única operación con transacción
 * `Serializable` y con reglas de grafo (ciclo y profundidad): concentrar aquí sus casos hace que se
 * pueda correr solo mientras se trabaja en ellas.
 *
 * **T-009 amplía este archivo** con el move de documentos: los helpers de arriba (`register`,
 * `createDirectory`, `containerName`, `directoryRow`) y el `app` viven en el `describe` exterior
 * para que esa tarea solo tenga que añadir un `describe` hermano al de directorios.
 *
 * Dos usuarios: AC-9 exige que un destino ajeno responda `404` y no `403`, y eso necesita dos
 * actores. Los dos se borran al final y la cascada se lleva sus árboles.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves **exactas** de `WorkspaceDirectoryResponseDto`. */
const DIRECTORY_KEYS = ['createdAt', 'depth', 'id', 'name', 'parentId', 'updatedAt'];

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

/**
 * Claves **exactas** de `WorkspaceDocumentSummaryResponseDto`: el move de un documento devuelve el
 * resumen, **sin** `content`.
 */
const DOCUMENT_SUMMARY_KEYS = [
  'contentBytes',
  'createdAt',
  'directoryId',
  'id',
  'title',
  'updatedAt',
];

/** Texto de los documentos del archivo: sirve para comprobar que el move no lo toca. */
const DOCUMENT_CONTENT = '# Contenido que no se toca';

interface MoveBody {
  readonly parentId?: unknown;
  readonly [extra: string]: unknown;
}

interface MoveDocumentBody {
  readonly directoryId?: unknown;
  readonly [extra: string]: unknown;
}

interface DirectoryNode {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly updatedAt: string;
}

interface DocumentNode {
  readonly id: string;
  readonly title: string;
  readonly directoryId: string | null;
  readonly updatedAt: string;
}

describe('move de nodos del workspace (e2e) — AC-8, AC-9, AC-10 y AC-17', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;
  let bob: Actor;

  /**
   * Los nombres de directorio son únicos entre hermanos, y casi todos los casos crean en la raíz:
   * un contador hace que dos casos no se pisen y que el archivo pueda correr dos veces seguidas
   * contra la misma base de desarrollo.
   */
  let seq = 0;

  beforeAll(async () => {
    app = await createAuthApp();
    prisma = app.get(PrismaService);
    alice = await register('move-alice');
    bob = await register('move-bob');
  });

  afterAll(async () => {
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await resetThrottleCounters(app);
    await app.close();
  });

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

  function uniqueName(base: string): string {
    seq += 1;
    return `${base} ${String(seq)}`;
  }

  async function createDirectory(
    actor: Actor,
    name: string,
    parentId: string | null,
  ): Promise<DirectoryNode> {
    const response = await request(app.getHttpServer())
      .post('/api/workspace/directories')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ name, parentId })
      .expect(201);

    return response.body as DirectoryNode;
  }

  /** Directorio raíz con nombre único, pensado para aislar el caso del resto del archivo. */
  function createContainer(actor: Actor, base: string): Promise<DirectoryNode> {
    return createDirectory(actor, uniqueName(base), null);
  }

  function moveDirectory(actor: Actor, id: string, body: MoveBody): request.Test {
    return request(app.getHttpServer())
      .post(`/api/workspace/directories/${id}/move`)
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send(body);
  }

  function directoryRow(
    id: string,
  ): Promise<{ parentId: string | null; parentScopeId: string; name: string } | null> {
    return prisma.directory.findUnique({
      where: { id },
      select: { parentId: true, parentScopeId: true, name: true },
    });
  }

  async function createDocument(
    actor: Actor,
    title: string,
    directoryId: string | null,
  ): Promise<DocumentNode> {
    const response = await request(app.getHttpServer())
      .post('/api/workspace/documents')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ title, directoryId, content: DOCUMENT_CONTENT })
      .expect(201);

    return response.body as DocumentNode;
  }

  function moveDocument(actor: Actor, id: string, body: MoveDocumentBody): request.Test {
    return request(app.getHttpServer())
      .post(`/api/workspace/documents/${id}/move`)
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send(body);
  }

  /** La fila cruda del documento, con las columnas internas que ningún DTO expone. */
  function documentRow(id: string): Promise<{
    directoryId: string | null;
    parentScopeId: string;
    title: string;
    content: string;
  } | null> {
    return prisma.document.findUnique({
      where: { id },
      select: { directoryId: true, parentScopeId: true, title: true, content: true },
    });
  }

  /** Cadena `profundidad 0 → 1 → … → depth`; devuelve el nodo más profundo. */
  async function createChain(actor: Actor, base: string, depth: number): Promise<DirectoryNode> {
    let node = await createContainer(actor, base);

    for (let nivel = 1; nivel <= depth; nivel += 1) {
      node = await createDirectory(actor, `${base} nivel ${String(nivel)}`, node.id);
    }

    return node;
  }

  describe('POST /api/workspace/directories/:id/move — AC-8', () => {
    it('mueve a la raíz: 200 con parentId null, depth 0 y parentScopeId igual al userId', async () => {
      const padre = await createContainer(alice, 'Origen');
      const sujeto = await createDirectory(alice, 'Emancipado', padre.id);

      const response = await moveDirectory(alice, sujeto.id, { parentId: null }).expect(200);
      const body = response.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(DIRECTORY_KEYS);
      expect(body['id']).toBe(sujeto.id);
      expect(body['parentId']).toBeNull();
      expect(body['depth']).toBe(0);
      expect(body['name']).toBe('Emancipado');

      const row = await directoryRow(sujeto.id);

      expect(row?.parentId).toBeNull();
      // La columna de unicidad se recalcula: en la raíz el ámbito es el propio usuario.
      expect(row?.parentScopeId).toBe(alice.userId);
    });

    it('mueve a otro directorio propio: 200 con el parentId y el depth nuevos', async () => {
      const origen = await createContainer(alice, 'Cajón de origen');
      const destino = await createContainer(alice, 'Cajón de destino');
      const intermedio = await createDirectory(alice, 'Intermedio', destino.id);
      const sujeto = await createDirectory(alice, 'Viajero', origen.id);

      const response = await moveDirectory(alice, sujeto.id, { parentId: intermedio.id }).expect(
        200,
      );

      expect(response.body.parentId).toBe(intermedio.id);
      expect(response.body.depth).toBe(2);

      const row = await directoryRow(sujeto.id);

      expect(row?.parentId).toBe(intermedio.id);
      expect(row?.parentScopeId).toBe(intermedio.id);
    });

    it('arrastra el subárbol: los descendientes conservan su padre y bajan de profundidad', async () => {
      const origen = await createContainer(alice, 'Con descendencia');
      const destino = await createContainer(alice, 'Nuevo hogar');
      const sujeto = await createDirectory(alice, 'Rama', origen.id);
      const nieto = await createDirectory(alice, 'Hoja', sujeto.id);

      await moveDirectory(alice, sujeto.id, { parentId: destino.id }).expect(200);

      // El move no toca a los hijos: la jerarquía es solo `parentId`, así que el subárbol viaja
      // entero sin reescribir ni una fila más (decisión 2 del plan).
      expect((await directoryRow(nieto.id))?.parentId).toBe(sujeto.id);
      expect((await directoryRow(nieto.id))?.parentScopeId).toBe(sujeto.id);
    });

    it('mover al padre que ya se tiene es un no-op: 200 y nada cambia, ni el updatedAt', async () => {
      const padre = await createContainer(alice, 'Padre estable');
      const sujeto = await createDirectory(alice, 'Quieto', padre.id);

      const response = await moveDirectory(alice, sujeto.id, { parentId: padre.id }).expect(200);

      expect(response.body.parentId).toBe(padre.id);
      expect(response.body.depth).toBe(1);
      expect(response.body.updatedAt).toBe(sujeto.updatedAt);
      expect((await directoryRow(sujeto.id))?.parentId).toBe(padre.id);
    });

    it('mover a la raíz un directorio que ya está en la raíz también es un no-op', async () => {
      const sujeto = await createContainer(alice, 'Ya en la raíz');

      const response = await moveDirectory(alice, sujeto.id, { parentId: null }).expect(200);

      expect(response.body.parentId).toBeNull();
      expect(response.body.depth).toBe(0);
      expect(response.body.updatedAt).toBe(sujeto.updatedAt);
    });

    it('responde 400 con parentId ausente, nombrando el campo', async () => {
      const sujeto = await createContainer(alice, 'Sin destino');

      const response = await moveDirectory(alice, sujeto.id, {}).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('parentId');
    });

    it('responde 400 con parentId que no es uuid', async () => {
      const sujeto = await createContainer(alice, 'Destino raro');

      const response = await moveDirectory(alice, sujeto.id, { parentId: 'no-uuid' }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('parentId');
    });

    it('responde 400 con una propiedad no declarada', async () => {
      const sujeto = await createContainer(alice, 'Con extra');

      const response = await moveDirectory(alice, sujeto.id, {
        parentId: null,
        force: true,
      }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('force');
    });

    it('responde 400 con un :id que no es uuid', async () => {
      await moveDirectory(alice, 'no-uuid', { parentId: null }).expect(400);
    });

    it('responde 401 sin cabecera Authorization', async () => {
      const padre = await createContainer(alice, 'Con guardia');
      const sujeto = await createDirectory(alice, 'Protegido', padre.id);

      await request(app.getHttpServer())
        .post(`/api/workspace/directories/${sujeto.id}/move`)
        .send({ parentId: null })
        .expect(401);

      expect((await directoryRow(sujeto.id))?.parentId).toBe(padre.id);
    });
  });

  describe('ciclos y propiedad — AC-9', () => {
    it('mover un directorio dentro de sí mismo → 409 MOVE_INTO_DESCENDANT', async () => {
      const sujeto = await createContainer(alice, 'Ouróboros');

      const response = await moveDirectory(alice, sujeto.id, { parentId: sujeto.id }).expect(409);

      expect(response.body.code).toBe('MOVE_INTO_DESCENDANT');
      expect((await directoryRow(sujeto.id))?.parentId).toBeNull();
    });

    it('mover un directorio dentro de un descendiente → 409 y ni el sujeto ni el subárbol cambian', async () => {
      const abuelo = await createContainer(alice, 'Abuelo');
      const padre = await createDirectory(alice, 'Padre', abuelo.id);
      const nieto = await createDirectory(alice, 'Nieto', padre.id);

      const response = await moveDirectory(alice, abuelo.id, { parentId: nieto.id }).expect(409);

      expect(response.body.code).toBe('MOVE_INTO_DESCENDANT');
      expect((await directoryRow(abuelo.id))?.parentId).toBeNull();
      expect((await directoryRow(padre.id))?.parentId).toBe(abuelo.id);
      expect((await directoryRow(nieto.id))?.parentId).toBe(padre.id);
    });

    it('destino de otro usuario → 404 PARENT_NOT_FOUND, nunca 403, y el parentId sigue intacto', async () => {
      const padre = await createContainer(alice, 'Origen legítimo');
      const sujeto = await createDirectory(alice, 'Codiciado', padre.id);
      const deBob = await createContainer(bob, 'Carpeta de Bob');

      const response = await moveDirectory(alice, sujeto.id, { parentId: deBob.id }).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('PARENT_NOT_FOUND');
      expect((await directoryRow(sujeto.id))?.parentId).toBe(padre.id);
    });

    it('destino inexistente → 404 PARENT_NOT_FOUND', async () => {
      const padre = await createContainer(alice, 'Origen con destino fantasma');
      const sujeto = await createDirectory(alice, 'Sin rumbo', padre.id);

      const response = await moveDirectory(alice, sujeto.id, { parentId: randomUUID() }).expect(404);

      expect(response.body.code).toBe('PARENT_NOT_FOUND');
      expect((await directoryRow(sujeto.id))?.parentId).toBe(padre.id);
    });

    it('sujeto de otro usuario → 404 y el directorio de su dueño no se mueve', async () => {
      const destino = await createContainer(alice, 'Destino de Alice');
      const padreDeBob = await createContainer(bob, 'Padre de Bob');
      const deBob = await createDirectory(bob, 'Hijo de Bob', padreDeBob.id);

      const response = await moveDirectory(alice, deBob.id, { parentId: destino.id }).expect(404);

      expect(response.body.statusCode).toBe(404);
      // El `code` se comprueba a propósito: un `404` a secas también lo devuelve Nest cuando la
      // ruta no existe, así que sin él este caso pasaría en verde antes de implementar nada.
      expect(response.body.code).toBe('DIRECTORY_NOT_FOUND');
      expect((await directoryRow(deBob.id))?.parentId).toBe(padreDeBob.id);
    });

    it('sujeto inexistente → 404 DIRECTORY_NOT_FOUND', async () => {
      const response = await moveDirectory(alice, randomUUID(), { parentId: null }).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('DIRECTORY_NOT_FOUND');
    });
  });

  describe('profundidad y unicidad en el destino — AC-10', () => {
    it('subárbol de altura 2 a un destino en profundidad 8 → 409 DEPTH_LIMIT_EXCEEDED y nada cambia', async () => {
      // Profundidades válidas: 0…MAX-1. Con el destino en MAX-2, el nieto del sujeto caería en
      // MAX, un nivel por debajo del tope.
      const destino = await createChain(alice, 'Cadena profunda', MAX_DIRECTORY_DEPTH - 2);

      const origen = await createContainer(alice, 'Origen alto');
      const sujeto = await createDirectory(alice, 'Sujeto alto', origen.id);
      const hijo = await createDirectory(alice, 'Hijo alto', sujeto.id);
      const nieto = await createDirectory(alice, 'Nieto alto', hijo.id);

      const response = await moveDirectory(alice, sujeto.id, { parentId: destino.id }).expect(409);

      expect(response.body.code).toBe('DEPTH_LIMIT_EXCEEDED');
      expect((await directoryRow(sujeto.id))?.parentId).toBe(origen.id);
      expect((await directoryRow(hijo.id))?.parentId).toBe(sujeto.id);
      expect((await directoryRow(nieto.id))?.parentId).toBe(hijo.id);
    });

    it('el mismo subárbol cabe justo si el destino está en la profundidad máxima que lo admite', async () => {
      // El nodo más profundo del sujeto queda en `destino + 1 + altura`. Con altura 2, el destino
      // más profundo que cabe es `MAX - 4`: el nieto aterriza exactamente en `MAX - 1`, el último
      // nivel válido. Este caso es el que demuestra que el rechazo anterior es por el tope y no
      // porque el move de un subárbol alto falle siempre.
      const destino = await createChain(alice, 'Cadena justa', MAX_DIRECTORY_DEPTH - 4);

      const origen = await createContainer(alice, 'Origen justo');
      const sujeto = await createDirectory(alice, 'Sujeto justo', origen.id);
      const hijo = await createDirectory(alice, 'Hijo justo', sujeto.id);
      const nieto = await createDirectory(alice, 'Nieto justo', hijo.id);

      const response = await moveDirectory(alice, sujeto.id, { parentId: destino.id }).expect(200);

      expect(response.body.depth).toBe(MAX_DIRECTORY_DEPTH - 3);
      expect((await directoryRow(sujeto.id))?.parentId).toBe(destino.id);
      expect((await directoryRow(nieto.id))?.parentId).toBe(hijo.id);
    });

    it('destino con un hermano homónimo → 409 DIRECTORY_NAME_TAKEN y el sujeto no se mueve', async () => {
      const origen = await createContainer(alice, 'Origen homónimo');
      const destino = await createContainer(alice, 'Destino homónimo');
      await createDirectory(alice, 'Duplicado', destino.id);
      const sujeto = await createDirectory(alice, 'Duplicado', origen.id);

      const response = await moveDirectory(alice, sujeto.id, { parentId: destino.id }).expect(409);

      expect(response.body.code).toBe('DIRECTORY_NAME_TAKEN');
      expect((await directoryRow(sujeto.id))?.parentId).toBe(origen.id);
      expect(
        await prisma.directory.count({
          where: { userId: alice.userId, parentScopeId: destino.id, nameKey: 'duplicado' },
        }),
      ).toBe(1);
    });

    it('mover a la raíz un nombre que ya existe en la raíz → 409 DIRECTORY_NAME_TAKEN', async () => {
      const enRaiz = await createContainer(alice, 'Nombre de raíz');
      const origen = await createContainer(alice, 'Origen de raíz');
      const sujeto = await createDirectory(alice, enRaiz.name, origen.id);

      const response = await moveDirectory(alice, sujeto.id, { parentId: null }).expect(409);

      expect(response.body.code).toBe('DIRECTORY_NAME_TAKEN');
      expect((await directoryRow(sujeto.id))?.parentId).toBe(origen.id);
    });
  });

  describe('POST /api/workspace/documents/:id/move — AC-17', () => {
    it('mueve a un directorio propio: 200 con el directoryId nuevo y sin content en el cuerpo', async () => {
      const destino = await createContainer(alice, 'Destino de documentos');
      const sujeto = await createDocument(alice, uniqueName('Viajero'), null);

      const response = await moveDocument(alice, sujeto.id, { directoryId: destino.id }).expect(200);
      const body = response.body as Record<string, unknown>;

      // El move devuelve el **resumen**: mover un documento no es motivo para descargar su texto.
      expect(Object.keys(body).sort()).toEqual(DOCUMENT_SUMMARY_KEYS);
      expect(body).not.toHaveProperty('content');
      expect(body['id']).toBe(sujeto.id);
      expect(body['directoryId']).toBe(destino.id);
      expect(JSON.stringify(body)).not.toContain(alice.userId);

      const row = await documentRow(sujeto.id);

      expect(row?.directoryId).toBe(destino.id);
      // La columna de unicidad se recalcula: si se quedara en el ámbito anterior, dos documentos
      // homónimos podrían convivir en el destino y el índice único no se enteraría.
      expect(row?.parentScopeId).toBe(destino.id);
      // Mover no toca el texto.
      expect(row?.content).toBe(DOCUMENT_CONTENT);
    });

    it('mueve a la raíz: 200 con directoryId null y parentScopeId igual al userId', async () => {
      const origen = await createContainer(alice, 'Origen de documentos');
      const sujeto = await createDocument(alice, uniqueName('Emancipado'), origen.id);

      const response = await moveDocument(alice, sujeto.id, { directoryId: null }).expect(200);

      expect(response.body.directoryId).toBeNull();

      const row = await documentRow(sujeto.id);

      expect(row?.directoryId).toBeNull();
      expect(row?.parentScopeId).toBe(alice.userId);
    });

    it('el ámbito de unicidad viaja con el documento: su título vuelve a estar libre en el origen', async () => {
      const destino = await createContainer(alice, 'Destino que libera');
      const titulo = uniqueName('Título liberado');
      const sujeto = await createDocument(alice, titulo, null);

      await moveDocument(alice, sujeto.id, { directoryId: destino.id }).expect(200);

      // Si `parentScopeId` no se hubiera recalculado, el documento movido seguiría ocupando el
      // cubo de la raíz y esta alta chocaría con un `409`.
      const nuevo = await createDocument(alice, titulo, null);

      expect(nuevo.id).not.toBe(sujeto.id);
      // Y el hueco que deja tampoco se puede volver a ocupar en el destino.
      await moveDocument(alice, nuevo.id, { directoryId: destino.id }).expect(409);
    });

    it('destino con un documento homónimo → 409 DOCUMENT_TITLE_TAKEN y el documento no se mueve', async () => {
      const origen = await createContainer(alice, 'Origen homónimo de documentos');
      const destino = await createContainer(alice, 'Destino homónimo de documentos');
      const titulo = uniqueName('Duplicado');
      await createDocument(alice, titulo, destino.id);
      const sujeto = await createDocument(alice, titulo, origen.id);

      const response = await moveDocument(alice, sujeto.id, { directoryId: destino.id }).expect(409);

      expect(response.body.statusCode).toBe(409);
      expect(response.body.code).toBe('DOCUMENT_TITLE_TAKEN');

      const row = await documentRow(sujeto.id);

      expect(row?.directoryId).toBe(origen.id);
      expect(row?.parentScopeId).toBe(origen.id);
    });

    it('un directorio hermano homónimo no estorba: espacios de nombres separados', async () => {
      const destino = await createContainer(alice, 'Destino con carpeta homónima');
      const titulo = uniqueName('Convive');
      await createDirectory(alice, titulo, destino.id);
      const sujeto = await createDocument(alice, titulo, null);

      const response = await moveDocument(alice, sujeto.id, { directoryId: destino.id }).expect(200);

      expect(response.body.directoryId).toBe(destino.id);
    });

    it('destino de otro usuario → 404 PARENT_NOT_FOUND, nunca 403, y el directoryId no cambia', async () => {
      const origen = await createContainer(alice, 'Origen legítimo de documentos');
      const sujeto = await createDocument(alice, uniqueName('Codiciado'), origen.id);
      const deBob = await createContainer(bob, 'Carpeta de documentos de Bob');

      const response = await moveDocument(alice, sujeto.id, { directoryId: deBob.id }).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('PARENT_NOT_FOUND');
      expect((await documentRow(sujeto.id))?.directoryId).toBe(origen.id);
    });

    it('destino inexistente → 404 PARENT_NOT_FOUND y el directoryId no cambia', async () => {
      const origen = await createContainer(alice, 'Origen con destino fantasma de documentos');
      const sujeto = await createDocument(alice, uniqueName('Sin rumbo'), origen.id);

      const response = await moveDocument(alice, sujeto.id, { directoryId: randomUUID() }).expect(
        404,
      );

      expect(response.body.code).toBe('PARENT_NOT_FOUND');
      expect((await documentRow(sujeto.id))?.directoryId).toBe(origen.id);
    });

    it('documento de otro usuario → 404 DOCUMENT_NOT_FOUND y el suyo no se mueve', async () => {
      const destino = await createContainer(alice, 'Destino para lo ajeno');
      const origenDeBob = await createContainer(bob, 'Origen de Bob');
      const deBob = await createDocument(bob, uniqueName('Documento de Bob'), origenDeBob.id);

      const response = await moveDocument(alice, deBob.id, { directoryId: destino.id }).expect(404);

      expect(response.body.statusCode).toBe(404);
      // El `code` se comprueba a propósito: un `404` a secas también lo devuelve Nest cuando la
      // ruta no existe, así que sin él este caso pasaría en verde antes de implementar nada.
      expect(response.body.code).toBe('DOCUMENT_NOT_FOUND');
      expect((await documentRow(deBob.id))?.directoryId).toBe(origenDeBob.id);
    });

    it('documento inexistente → 404 DOCUMENT_NOT_FOUND', async () => {
      const response = await moveDocument(alice, randomUUID(), { directoryId: null }).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('responde 400 con directoryId ausente, nombrando el campo', async () => {
      const sujeto = await createDocument(alice, uniqueName('Sin destino'), null);

      const response = await moveDocument(alice, sujeto.id, {}).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('directoryId');
      expect((await documentRow(sujeto.id))?.directoryId).toBeNull();
    });

    it('responde 400 con directoryId que no es uuid', async () => {
      const sujeto = await createDocument(alice, uniqueName('Destino raro'), null);

      const response = await moveDocument(alice, sujeto.id, { directoryId: 'no-uuid' }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('directoryId');
    });

    it('responde 400 con una propiedad no declarada', async () => {
      const sujeto = await createDocument(alice, uniqueName('Con extra'), null);

      const response = await moveDocument(alice, sujeto.id, {
        directoryId: null,
        title: 'Colado',
      }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('title');
    });

    it('responde 400 con un :id que no es uuid', async () => {
      await moveDocument(alice, 'no-uuid', { directoryId: null }).expect(400);
    });

    it('responde 401 sin cabecera Authorization y el documento no se mueve', async () => {
      const origen = await createContainer(alice, 'Origen con guardia');
      const sujeto = await createDocument(alice, uniqueName('Protegido'), origen.id);

      await request(app.getHttpServer())
        .post(`/api/workspace/documents/${sujeto.id}/move`)
        .send({ directoryId: null })
        .expect(401);

      expect((await documentRow(sujeto.id))?.directoryId).toBe(origen.id);
    });
  });
});
