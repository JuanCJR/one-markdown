import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { MAX_WORKSPACE_NODES } from '../src/workspace/workspace.constants';
import { WorkspaceRepository } from '../src/workspace/workspace.repository';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * `GET /api/workspace/tree` (spec 002, AC-20).
 *
 * **Dos usuarios con estructuras de nombres idénticos.** No es decoración: el árbol es la única
 * lectura que no lleva un `:id` en la ruta, así que un `where` sin `userId` no se delata con un
 * `404` como en el resto de endpoints — devolvería los nodos de todo el mundo y la respuesta
 * seguiría siendo un `200` con forma válida. Con dos árboles homónimos, la única forma de
 * distinguir «solo los míos» de «los de todos» son los **ids**, y eso es lo que se afirma.
 *
 * El orden se comprueba contra un orden de creación **distinto** del orden esperado a propósito:
 * si la respuesta saliera en el orden en que se insertaron las filas —que es lo que devuelve
 * PostgreSQL cuando nadie pide un `ORDER BY`— el test lo ve. Un árbol que cambia de orden entre dos
 * recargas hace saltar la barra lateral del cliente sin que nada haya cambiado.
 *
 * Cada usuario se registra recién creado, así que su árbol es exactamente el que crea este archivo
 * y las afirmaciones sobre el contenido completo de los dos arrays son cerradas.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves **exactas** del cuerpo de `WorkspaceTreeResponseDto`. */
const TREE_KEYS = ['directories', 'documents', 'generatedAt'];

/** Claves **exactas** de `WorkspaceDirectoryResponseDto`. */
const DIRECTORY_KEYS = ['createdAt', 'depth', 'id', 'name', 'parentId', 'updatedAt'];

/** Claves **exactas** de `WorkspaceDocumentSummaryResponseDto`: **sin** `content`. */
const DOCUMENT_SUMMARY_KEYS = [
  'contentBytes',
  'createdAt',
  'directoryId',
  'id',
  'title',
  'updatedAt',
];

/** Columnas internas que ningún DTO puede publicar (AC-26). */
const INTERNAL_COLUMNS = ['nameKey', 'titleKey', 'parentScopeId', 'userId'];

const DOCUMENT_CONTENT = '# Texto que el árbol no debe traer';

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

interface DirectoryNode {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
}

interface DocumentNode {
  readonly id: string;
  readonly title: string;
  readonly directoryId: string | null;
}

/**
 * El árbol de un actor, tal como lo crea `seedWorkspace`.
 *
 * Nombres elegidos para que el orden alfabético **no** coincida con el de creación: se crean
 * `Zeta`, `Alfa`, `Beta`, `Gamma` y el orden esperado es `Alfa`, `Beta`, `Gamma`, `Zeta`.
 */
interface Workspace {
  readonly zeta: DirectoryNode;
  readonly alfa: DirectoryNode;
  readonly beta: DirectoryNode;
  /** Nieto: hijo de `beta`, que a su vez es hijo de `alfa`. Su `depth` tiene que ser `2`. */
  readonly gamma: DirectoryNode;
  readonly omega: DocumentNode;
  readonly delta: DocumentNode;
}

interface TreeBody {
  readonly directories: readonly DirectoryNode[];
  readonly documents: readonly DocumentNode[];
  readonly generatedAt: string;
}

describe('GET /api/workspace/tree (e2e) — AC-20', () => {
  let app: INestApplication;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;
  let bob: Actor;
  let aliceTree: Workspace;
  let bobTree: Workspace;

  beforeAll(async () => {
    app = await createAuthApp();

    alice = await register('tree-alice');
    bob = await register('tree-bob');

    // Exactamente los mismos nombres para los dos: si el `where` perdiera el `userId`, los nombres
    // no lo delatarían y los ids sí.
    aliceTree = await seedWorkspace(alice);
    bobTree = await seedWorkspace(bob);
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

  /** Crea el mismo árbol para cualquier actor, en un orden que **no** es el orden alfabético. */
  async function seedWorkspace(actor: Actor): Promise<Workspace> {
    const zeta = await createDirectory(actor, 'Zeta', null);
    const alfa = await createDirectory(actor, 'Alfa', null);
    const beta = await createDirectory(actor, 'Beta', alfa.id);
    const gamma = await createDirectory(actor, 'Gamma', beta.id);

    const omega = await createDocument(actor, 'Omega', null);
    const delta = await createDocument(actor, 'Delta', gamma.id);

    return { zeta, alfa, beta, gamma, omega, delta };
  }

  function getTree(actor: Actor): request.Test {
    return request(app.getHttpServer())
      .get('/api/workspace/tree')
      .set('Authorization', `Bearer ${actor.accessToken}`);
  }

  async function fetchTree(actor: Actor): Promise<TreeBody> {
    const response = await getTree(actor).expect(200);

    return response.body as TreeBody;
  }

  describe('forma del cuerpo', () => {
    it('devuelve exactamente directories, documents y generatedAt', async () => {
      const response = await getTree(alice).expect(200);
      const body = response.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(TREE_KEYS);
      expect(Array.isArray(body['directories'])).toBe(true);
      expect(Array.isArray(body['documents'])).toBe(true);
    });

    it('generatedAt parsea como fecha ISO-8601', async () => {
      const { generatedAt } = await fetchTree(alice);

      expect(typeof generatedAt).toBe('string');
      expect(Number.isNaN(Date.parse(generatedAt))).toBe(false);
      // Ida y vuelta: descarta un `Date.toString()` o un epoch numérico, que `Date.parse` también
      // acepta pero que el cliente no puede tratar como ISO.
      expect(new Date(generatedAt).toISOString()).toBe(generatedAt);
    });

    it('los dos arrays son planos: cada nodo trae su padre y ninguno anida hijos', async () => {
      const { directories, documents } = await fetchTree(alice);

      for (const directory of directories) {
        expect(Object.keys(directory).sort()).toEqual(DIRECTORY_KEYS);
        expect(directory).not.toHaveProperty('children');
        // `parentId` presente **siempre**, con `null` explícito en la raíz: el cliente distingue
        // «en la raíz» de «el campo no llegó» sin adivinar.
        expect(directory).toHaveProperty('parentId');
      }

      for (const document of documents) {
        expect(Object.keys(document).sort()).toEqual(DOCUMENT_SUMMARY_KEYS);
        expect(document).not.toHaveProperty('children');
        expect(document).toHaveProperty('directoryId');
      }

      const byId = new Map(directories.map((directory) => [directory.id, directory]));

      expect(byId.get(aliceTree.alfa.id)?.parentId).toBeNull();
      expect(byId.get(aliceTree.beta.id)?.parentId).toBe(aliceTree.alfa.id);
      expect(byId.get(aliceTree.gamma.id)?.parentId).toBe(aliceTree.beta.id);
      expect(
        documents.find((document) => document.id === aliceTree.delta.id)?.directoryId,
      ).toBe(aliceTree.gamma.id);
      expect(
        documents.find((document) => document.id === aliceTree.omega.id)?.directoryId,
      ).toBeNull();
    });

    it('ningún documento del listado tiene la propiedad content', async () => {
      const { documents } = await fetchTree(alice);

      expect(documents.length).toBeGreaterThan(0);

      for (const document of documents) {
        expect(document).not.toHaveProperty('content');
      }

      // Y el texto tampoco viaja escondido en ningún otro campo: en PostgreSQL vive en TOAST y
      // traerlo convertiría cada recarga de la barra lateral en una descarga del workspace entero.
      expect(JSON.stringify(documents)).not.toContain(DOCUMENT_CONTENT);
    });

    it('no publica ninguna columna interna', async () => {
      const serialized = JSON.stringify(await fetchTree(alice));

      for (const column of INTERNAL_COLUMNS) {
        expect(serialized).not.toContain(column);
      }

      expect(serialized).not.toContain(alice.userId);
    });
  });

  describe('profundidad calculada', () => {
    it('el nieto está en depth 2, su padre en 1 y las raíces en 0', async () => {
      const { directories } = await fetchTree(alice);
      const depthById = new Map(
        directories.map((directory) => [directory.id, directory.depth]),
      );

      expect(depthById.get(aliceTree.gamma.id)).toBe(2);
      expect(depthById.get(aliceTree.beta.id)).toBe(1);
      expect(depthById.get(aliceTree.alfa.id)).toBe(0);
      expect(depthById.get(aliceTree.zeta.id)).toBe(0);
    });
  });

  describe('orden determinista', () => {
    it('ordena por nombre y no por orden de creación', async () => {
      const { directories, documents } = await fetchTree(alice);

      // Creados en el orden Zeta → Alfa → Beta → Gamma; se esperan alfabéticos.
      expect(directories.map((directory) => directory.name)).toEqual([
        'Alfa',
        'Beta',
        'Gamma',
        'Zeta',
      ]);
      // Creados en el orden Omega → Delta.
      expect(documents.map((document) => document.title)).toEqual(['Delta', 'Omega']);
    });

    it('dos llamadas seguidas devuelven exactamente el mismo orden de ids', async () => {
      const first = await fetchTree(alice);
      const second = await fetchTree(alice);

      expect(second.directories.map((directory) => directory.id)).toEqual(
        first.directories.map((directory) => directory.id),
      );
      expect(second.documents.map((document) => document.id)).toEqual(
        first.documents.map((document) => document.id),
      );
    });
  });

  describe('propiedad por recurso', () => {
    it('cada usuario recibe solo sus nodos, con estructuras de nombres idénticas', async () => {
      const deAlice = await fetchTree(alice);
      const deBob = await fetchTree(bob);

      const idsDeAlice = [
        aliceTree.zeta.id,
        aliceTree.alfa.id,
        aliceTree.beta.id,
        aliceTree.gamma.id,
      ].sort();
      const idsDeBob = [bobTree.zeta.id, bobTree.alfa.id, bobTree.beta.id, bobTree.gamma.id].sort();

      expect(deAlice.directories.map((directory) => directory.id).sort()).toEqual(idsDeAlice);
      expect(deBob.directories.map((directory) => directory.id).sort()).toEqual(idsDeBob);

      expect(deAlice.documents.map((document) => document.id).sort()).toEqual(
        [aliceTree.omega.id, aliceTree.delta.id].sort(),
      );
      expect(deBob.documents.map((document) => document.id).sort()).toEqual(
        [bobTree.omega.id, bobTree.delta.id].sort(),
      );

      // Los nombres son iguales en los dos árboles, así que la separación solo se puede afirmar
      // sobre los ids: ninguno del otro puede aparecer en el cuerpo.
      const serializadoDeAlice = JSON.stringify(deAlice);
      const serializadoDeBob = JSON.stringify(deBob);

      for (const id of [...idsDeBob, bobTree.omega.id, bobTree.delta.id]) {
        expect(serializadoDeAlice).not.toContain(id);
      }

      for (const id of [...idsDeAlice, aliceTree.omega.id, aliceTree.delta.id]) {
        expect(serializadoDeBob).not.toContain(id);
      }
    });

    it('los dos árboles tienen los mismos nombres, que es lo que hace válida la comprobación', async () => {
      const deAlice = await fetchTree(alice);
      const deBob = await fetchTree(bob);

      expect(deBob.directories.map((directory) => directory.name)).toEqual(
        deAlice.directories.map((directory) => directory.name),
      );
      expect(deBob.documents.map((document) => document.title)).toEqual(
        deAlice.documents.map((document) => document.title),
      );
    });
  });

  /**
   * Tope de nodos por usuario (AC-21), visto desde el cliente.
   *
   * **El contador se espía; no se crean 5.000 nodos.** Montar el tope de verdad serían 5.000
   * escrituras por caso: un e2e que tarda minutos deja de correrse, y un test que no se corre no
   * protege nada. Lo que este archivo tiene que demostrar no es que la base sepa contar —eso es del
   * repositorio— sino que el `409` **llega al cliente con su `code`** y que la fila **no** se crea,
   * y las dos cosas se ven igual de bien con el contador doblado en el borde.
   *
   * El espía se pone sobre la instancia real que el injector le dio a los dos servicios, así que el
   * resto del camino —guard, DTO, servicio, repositorio, filtro de excepciones— es el de producción.
   */
  describe('tope de nodos por usuario (AC-21)', () => {
    let repository: WorkspaceRepository;
    let prisma: PrismaService;
    let carol: Actor;

    beforeAll(async () => {
      repository = app.get(WorkspaceRepository);
      prisma = app.get(PrismaService);
      carol = await register('tree-tope');
    });

    /** Nodos reales del usuario en la base: directorios **más** documentos. */
    async function countRows(actor: Actor): Promise<number> {
      const [directories, documents] = await Promise.all([
        prisma.directory.count({ where: { userId: actor.userId } }),
        prisma.document.count({ where: { userId: actor.userId } }),
      ]);

      return directories + documents;
    }

    it('el alta de un directorio responde 409 WORKSPACE_LIMIT_REACHED y no crea la fila', async () => {
      const antes = await countRows(carol);
      const contador = jest
        .spyOn(repository, 'countWorkspaceNodes')
        .mockResolvedValue(MAX_WORKSPACE_NODES);

      try {
        const response = await request(app.getHttpServer())
          .post('/api/workspace/directories')
          .set('Authorization', `Bearer ${carol.accessToken}`)
          .send({ name: 'Uno de más', parentId: null })
          .expect(409);

        expect(response.body.statusCode).toBe(409);
        expect(response.body.code).toBe('WORKSPACE_LIMIT_REACHED');
        expect(Object.keys(response.body).sort()).toEqual([
          'code',
          'error',
          'message',
          'path',
          'statusCode',
          'timestamp',
        ]);
      } finally {
        contador.mockRestore();
      }

      expect(await countRows(carol)).toBe(antes);
    });

    it('el alta de un documento responde 409 WORKSPACE_LIMIT_REACHED y no crea la fila', async () => {
      const antes = await countRows(carol);
      const contador = jest
        .spyOn(repository, 'countWorkspaceNodes')
        .mockResolvedValue(MAX_WORKSPACE_NODES);

      try {
        const response = await request(app.getHttpServer())
          .post('/api/workspace/documents')
          .set('Authorization', `Bearer ${carol.accessToken}`)
          .send({ title: 'Uno de más', directoryId: null, content: '# Nada' })
          .expect(409);

        expect(response.body.statusCode).toBe(409);
        expect(response.body.code).toBe('WORKSPACE_LIMIT_REACHED');
      } finally {
        contador.mockRestore();
      }

      expect(await countRows(carol)).toBe(antes);
    });

    it('con un nodo por debajo del tope las dos altas siguen funcionando', async () => {
      // La mitad negativa: sin ella, un servicio que respondiera `409` **siempre** pasaría los dos
      // casos anteriores y el tope quedaría verificado por un endpoint roto.
      const contador = jest
        .spyOn(repository, 'countWorkspaceNodes')
        .mockResolvedValue(MAX_WORKSPACE_NODES - 1);

      try {
        await request(app.getHttpServer())
          .post('/api/workspace/directories')
          .set('Authorization', `Bearer ${carol.accessToken}`)
          .send({ name: 'Justo a tiempo', parentId: null })
          .expect(201);

        await request(app.getHttpServer())
          .post('/api/workspace/documents')
          .set('Authorization', `Bearer ${carol.accessToken}`)
          .send({ title: 'Justo a tiempo', directoryId: null, content: '# Cabe' })
          .expect(201);
      } finally {
        contador.mockRestore();
      }
    });
  });

  describe('credencial', () => {
    it('responde 401 sin cabecera Authorization', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/workspace/tree')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(Object.keys(response.body).sort()).toEqual([
        'error',
        'message',
        'path',
        'statusCode',
        'timestamp',
      ]);
    });

    it('responde 401 con un Bearer que no es un token válido', async () => {
      await request(app.getHttpServer())
        .get('/api/workspace/tree')
        .set('Authorization', 'Bearer no-es-un-token')
        .expect(401);
    });
  });
});
