import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  refreshCookieValue,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * Matriz de propiedad y de credencial sobre los **diez** endpoints de workspace (spec 002, AC-22 y
 * AC-23).
 *
 * El resto de archivos e2e comprueban la propiedad de pasada, dentro del caso de cada operación.
 * Éste la comprueba **en bloque y desde una sola lista**, porque el modo de fallo que persigue no es
 * «este endpoint filtra» sino «alguien añadió el endpoint número once y no se acordó de la
 * autorización». Por eso la lista de endpoints es una constante del propio test
 * (`WORKSPACE_ENDPOINTS`): un endpoint nuevo que no se añada aquí se ve, y uno que se añada mal
 * falla.
 *
 * **Cómo se evita que la matriz pase por vacío.** Un test que solo mira `expect(status).toBe(404)`
 * es verde también contra una URL mal escrita: Nest responde `404` para una ruta que no existe. En
 * una matriz entera de `404` eso convertiría cualquier errata en un falso verde (es exactamente lo
 * que pasó en el RED de `T-007`, donde los dos únicos casos «verdes» eran los dos `404`). Tres
 * defensas, y las tres tienen que seguir en pie:
 *
 * 1. Cada celda afirma el **`code`** del cuerpo (`DIRECTORY_NOT_FOUND`, `DOCUMENT_NOT_FOUND` o
 *    `PARENT_NOT_FOUND`) además del estado. El `404` de una ruta inexistente **no** lleva `code`:
 *    lo genera Nest y su mensaje es `Cannot POST /api/...`.
 * 2. Cada celda afirma el juego **exacto** de claves de `ErrorResponseDto` **con** `code`, así que
 *    un cuerpo de ruta inexistente (que trae cinco claves, sin `code`) tampoco cuela.
 * 3. Un **control positivo** al final recorre las mismas diez rutas con ids **propios** y comprueba
 *    que ninguna responde `404` y que las diez se ejercen. Si una URL de la constante estuviera mal
 *    escrita, esa ruta daría `404` para su propio dueño y el control lo delataría.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves exactas de un `ErrorResponseDto` **con** `code` (los `404` de workspace). */
const ERROR_KEYS_WITH_CODE = ['code', 'error', 'message', 'path', 'statusCode', 'timestamp'];

/** Claves exactas de un `ErrorResponseDto` **sin** `code` (los `401` del guard). */
const ERROR_KEYS = ['error', 'message', 'path', 'statusCode', 'timestamp'];

type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

/** Los ids con los que se construye una llamada: los de la víctima, o los propios. */
interface WorkspaceIds {
  readonly directoryId: string;
  readonly documentId: string;
}

interface WorkspaceEndpoint {
  /** El mismo `operationId` que declara el controlador en Swagger. */
  readonly operationId: string;
  readonly method: HttpMethod;
  /** `true` si la ruta lleva `:id`; solo ésos entran en la matriz de `400`. */
  readonly pathParam: boolean;
  readonly path: (ids: WorkspaceIds) => string;
  /** Cuerpo de la petición, o ausente si el endpoint no lleva. */
  readonly body?: (ids: WorkspaceIds) => Record<string, unknown>;
  /**
   * `code` esperado en el `404` cuando los ids son de otro usuario.
   *
   * `null` en `getWorkspaceTree`, el único endpoint **sin** ningún id: no hay id ajeno que pasarle,
   * así que no entra en la matriz de `404`. Su comprobación de propiedad es otra —dos usuarios con
   * estructuras homónimas, afirmada por ids— y tiene su propio caso más abajo.
   */
  readonly foreignNotFoundCode: string | null;
}

const DIRECTORIES = '/api/workspace/directories';
const DOCUMENTS = '/api/workspace/documents';

/**
 * **La** lista de endpoints de workspace. Fuente única de las cuatro matrices (`404`, `400`, `401`
 * sin cabecera y `401` con refresh token) y del control positivo.
 */
const WORKSPACE_ENDPOINTS: readonly WorkspaceEndpoint[] = [
  {
    operationId: 'createDirectory',
    method: 'post',
    pathParam: false,
    path: () => DIRECTORIES,
    // El id ajeno viaja en el cuerpo: colgar un directorio propio de una carpeta de otro.
    body: (ids) => ({ name: 'Intruso', parentId: ids.directoryId }),
    foreignNotFoundCode: 'PARENT_NOT_FOUND',
  },
  {
    operationId: 'renameDirectory',
    method: 'patch',
    pathParam: true,
    path: (ids) => `${DIRECTORIES}/${ids.directoryId}`,
    body: () => ({ name: 'Renombrado por un intruso' }),
    foreignNotFoundCode: 'DIRECTORY_NOT_FOUND',
  },
  {
    operationId: 'moveDirectory',
    method: 'post',
    pathParam: true,
    path: (ids) => `${DIRECTORIES}/${ids.directoryId}/move`,
    body: () => ({ parentId: null }),
    foreignNotFoundCode: 'DIRECTORY_NOT_FOUND',
  },
  {
    operationId: 'deleteDirectory',
    method: 'delete',
    pathParam: true,
    path: (ids) => `${DIRECTORIES}/${ids.directoryId}`,
    foreignNotFoundCode: 'DIRECTORY_NOT_FOUND',
  },
  {
    operationId: 'createDocument',
    method: 'post',
    pathParam: false,
    path: () => DOCUMENTS,
    body: (ids) => ({ title: 'Intruso', directoryId: ids.directoryId, content: '# Intruso' }),
    foreignNotFoundCode: 'PARENT_NOT_FOUND',
  },
  {
    operationId: 'getDocument',
    method: 'get',
    pathParam: true,
    path: (ids) => `${DOCUMENTS}/${ids.documentId}`,
    foreignNotFoundCode: 'DOCUMENT_NOT_FOUND',
  },
  {
    operationId: 'renameDocument',
    method: 'patch',
    pathParam: true,
    path: (ids) => `${DOCUMENTS}/${ids.documentId}`,
    body: () => ({ title: 'Renombrado por un intruso' }),
    foreignNotFoundCode: 'DOCUMENT_NOT_FOUND',
  },
  {
    operationId: 'moveDocument',
    method: 'post',
    pathParam: true,
    path: (ids) => `${DOCUMENTS}/${ids.documentId}/move`,
    body: () => ({ directoryId: null }),
    foreignNotFoundCode: 'DOCUMENT_NOT_FOUND',
  },
  {
    operationId: 'deleteDocument',
    method: 'delete',
    pathParam: true,
    path: (ids) => `${DOCUMENTS}/${ids.documentId}`,
    foreignNotFoundCode: 'DOCUMENT_NOT_FOUND',
  },
  {
    operationId: 'getWorkspaceTree',
    method: 'get',
    pathParam: false,
    path: () => '/api/workspace/tree',
    foreignNotFoundCode: null,
  },
];

/** Los nueve que sí reciben un id ajeno. `getWorkspaceTree` no recibe ninguno. */
const FOREIGN_ID_ENDPOINTS = WORKSPACE_ENDPOINTS.filter(
  (endpoint) => endpoint.foreignNotFoundCode !== null,
);

/** Los que llevan `:id` en la ruta y por tanto pasan por `ParseUUIDPipe`. */
const PATH_PARAM_ENDPOINTS = WORKSPACE_ENDPOINTS.filter((endpoint) => endpoint.pathParam);

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
  /** JWT de refresh, para comprobar que **no** vale como `Bearer` (AC-23). */
  readonly refreshToken: string;
}

/** Estado observable de un usuario en la base, para comprobar que la matriz no lo tocó. */
interface WorkspaceSnapshot {
  readonly directories: readonly {
    id: string;
    name: string;
    parentId: string | null;
  }[];
  readonly documents: readonly {
    id: string;
    title: string;
    directoryId: string | null;
    content: string;
  }[];
}

describe('Propiedad y credencial en los diez endpoints de workspace (e2e) — AC-22, AC-23', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];
  const userIds: string[] = [];

  /** La víctima: un directorio y un documento **dentro** de él. */
  let alice: Actor;
  let aliceIds: WorkspaceIds;
  /** El intruso, con sus propios nodos (que el control positivo usa al final). */
  let bob: Actor;

  beforeAll(async () => {
    app = await createAuthApp();
    prisma = app.get(PrismaService);

    await resetThrottleCounters(app);

    alice = await register('own-alice');
    bob = await register('own-bob');

    const directory = await createDirectory(alice, 'Privado', null);
    const document = await createDocument(alice, 'Secreto', directory.id);

    aliceIds = { directoryId: directory.id, documentId: document.id };
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

    return {
      userId,
      email,
      accessToken: response.body.accessToken,
      refreshToken: refreshCookieValue(response),
    };
  }

  async function createDirectory(
    actor: Actor,
    name: string,
    parentId: string | null,
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post(DIRECTORIES)
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ name, parentId })
      .expect(201);

    return response.body as { id: string };
  }

  async function createDocument(
    actor: Actor,
    title: string,
    directoryId: string | null,
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post(DOCUMENTS)
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ title, directoryId, content: '# Contenido privado' })
      .expect(201);

    return response.body as { id: string };
  }

  /**
   * Lanza una llamada de la matriz. `token` a `null` significa **sin** cabecera `Authorization`.
   *
   * El método sale del descriptor, no de un `if` por endpoint: así una entrada nueva en la
   * constante se ejerce sola.
   */
  function call(
    endpoint: WorkspaceEndpoint,
    ids: WorkspaceIds,
    token: string | null,
  ): request.Test {
    const url = endpoint.path(ids);
    const test =
      endpoint.method === 'get'
        ? request(app.getHttpServer()).get(url)
        : endpoint.method === 'post'
          ? request(app.getHttpServer()).post(url)
          : endpoint.method === 'patch'
            ? request(app.getHttpServer()).patch(url)
            : request(app.getHttpServer()).delete(url);

    if (token !== null) {
      test.set('Authorization', `Bearer ${token}`);
    }

    const body = endpoint.body?.(ids);

    return body === undefined ? test : test.send(body);
  }

  /** Estado de un usuario leído de la base, ordenado para poder compararlo tal cual. */
  async function snapshotOf(actor: Actor): Promise<WorkspaceSnapshot> {
    const [directories, documents] = await Promise.all([
      prisma.directory.findMany({
        where: { userId: actor.userId },
        select: { id: true, name: true, parentId: true },
        orderBy: { id: 'asc' },
      }),
      prisma.document.findMany({
        where: { userId: actor.userId },
        select: { id: true, title: true, directoryId: true, content: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    return { directories, documents };
  }

  describe('la lista de endpoints es la de la spec', () => {
    it('son diez, con operationId único, y nueve reciben un id ajeno', () => {
      expect(WORKSPACE_ENDPOINTS).toHaveLength(10);
      expect(new Set(WORKSPACE_ENDPOINTS.map((endpoint) => endpoint.operationId)).size).toBe(10);

      // `getWorkspaceTree` es el único sin id: no entra en la matriz de `404` por id ajeno.
      expect(FOREIGN_ID_ENDPOINTS).toHaveLength(9);
      // Siete llevan `:id` en la ruta: tres de directorios (`PATCH`, `move`, `DELETE`) y cuatro de
      // documentos (`GET`, `PATCH`, `move`, `DELETE`).
      expect(PATH_PARAM_ENDPOINTS).toHaveLength(7);
    });
  });

  describe('matriz de propiedad: B con los ids de A (AC-22)', () => {
    it.each(FOREIGN_ID_ENDPOINTS)(
      '$method $operationId responde 404 con code $foreignNotFoundCode',
      async (endpoint) => {
        const response = await call(endpoint, aliceIds, bob.accessToken);

        expect(response.status).toBe(404);
        // El `code` es lo que distingue este `404` del que Nest devuelve para una ruta inexistente,
        // que no lo lleva: sin esta línea, una errata en la URL pasaría por verde.
        expect(response.body.code).toBe(endpoint.foreignNotFoundCode);
        expect(response.body.statusCode).toBe(404);
        expect(Object.keys(response.body).sort()).toEqual(ERROR_KEYS_WITH_CODE);
      },
    );

    it('ninguna respuesta de la matriz es 403: todas son 404', async () => {
      const statuses = new Map<string, number>();

      for (const endpoint of FOREIGN_ID_ENDPOINTS) {
        const response = await call(endpoint, aliceIds, bob.accessToken);
        statuses.set(endpoint.operationId, response.status);
      }

      const observed = [...statuses.values()];

      // Un `403` confirmaría que el id existe y convertiría la API en un oráculo de qué documentos
      // hay en la instalación (decisión 9 del plan).
      expect(observed).not.toContain(403);
      expect(new Set(observed)).toEqual(new Set([404]));
    });

    it('tras la matriz completa, el estado de A es idéntico al inicial', async () => {
      const antes = await snapshotOf(alice);

      for (const endpoint of FOREIGN_ID_ENDPOINTS) {
        await call(endpoint, aliceIds, bob.accessToken);
      }

      const despues = await snapshotOf(alice);

      // Nombres, `parentId`, `directoryId`, contenido y número de filas: nada de lo que la matriz
      // intenta cambiar (renombrar, mover a la raíz, borrar) ha cambiado.
      expect(despues).toEqual(antes);
      expect(despues.directories).toHaveLength(1);
      expect(despues.documents).toHaveLength(1);
      expect(despues.documents[0]?.directoryId).toBe(aliceIds.directoryId);
    });

    it('el árbol de B no contiene ningún id de A (getWorkspaceTree)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/workspace/tree')
        .set('Authorization', `Bearer ${bob.accessToken}`)
        .expect(200);

      // Afirmado por **ids** y no por nombres: el árbol no lleva `:id` en la ruta, así que un
      // `where` sin `userId` no se delataría con un `404`, solo con ids ajenos en el cuerpo.
      const serialized = JSON.stringify(response.body);

      expect(serialized).not.toContain(aliceIds.directoryId);
      expect(serialized).not.toContain(aliceIds.documentId);
      expect(serialized).not.toContain(alice.userId);
    });
  });

  describe('un :id que no es uuid responde 400 (AC-22)', () => {
    const NOT_A_UUID = 'no-es-un-uuid';

    it.each(PATH_PARAM_ENDPOINTS)('$method $operationId responde 400', async (endpoint) => {
      const response = await call(
        endpoint,
        { directoryId: NOT_A_UUID, documentId: NOT_A_UUID },
        bob.accessToken,
      );

      expect(response.status).toBe(400);
      // Que el `400` venga del `:id` y no de otra cosa: el cuerpo que manda cada descriptor es
      // válido, y el mensaje del `ParseUUIDPipe` nombra el formato que esperaba.
      expect(JSON.stringify(response.body.message)).toContain('uuid');
      expect(Object.keys(response.body).sort()).toEqual(ERROR_KEYS);
    });
  });

  describe('credencial (AC-23)', () => {
    it.each(WORKSPACE_ENDPOINTS)(
      '$method $operationId responde 401 sin cabecera Authorization',
      async (endpoint) => {
        const response = await call(endpoint, aliceIds, null);

        expect(response.status).toBe(401);
        expect(response.body.statusCode).toBe(401);
        expect(Object.keys(response.body).sort()).toEqual(ERROR_KEYS);
      },
    );

    it.each(WORKSPACE_ENDPOINTS)(
      '$method $operationId responde 401 con un refresh token como Bearer',
      async (endpoint) => {
        const response = await call(endpoint, aliceIds, alice.refreshToken);

        // El refresh es un JWT válido y vigente, pero de otro tipo: si el guard solo comprobara la
        // firma, este caso pasaría y un token de vida larga valdría como acceso.
        expect(response.status).toBe(401);
        expect(Object.keys(response.body).sort()).toEqual(ERROR_KEYS);
      },
    );

    it('los dos tokens no son el mismo, que es lo que hace válido el caso anterior', () => {
      expect(alice.refreshToken).not.toBe(alice.accessToken);
      expect(alice.refreshToken.length).toBeGreaterThan(0);
    });
  });

  /**
   * Control positivo. Sin él, la matriz entera de `404` sería verde contra diez URLs mal escritas.
   *
   * Va el último porque borra lo que crea: recorre las diez operaciones con ids **propios** de B, en
   * un orden que respeta las dependencias (crear → leer → renombrar → mover → borrar), comprueba que
   * **ninguna** responde `404` y, al final, que las diez de la constante se han ejercido.
   */
  describe('control positivo: las diez rutas existen y responden a su dueño', () => {
    it('ninguna de las diez responde 404 con ids propios, y las diez se ejercen', async () => {
      const exercised = new Map<string, number>();

      const record = (operationId: string, status: number): void => {
        expect(status).not.toBe(404);
        exercised.set(operationId, status);
      };

      const directory = await createDirectory(bob, 'Propio', null);
      record('createDirectory', 201);

      const document = await createDocument(bob, 'Propio', directory.id);
      record('createDocument', 201);

      const ids: WorkspaceIds = { directoryId: directory.id, documentId: document.id };

      for (const operationId of [
        'getDocument',
        'renameDirectory',
        'renameDocument',
        'moveDocument',
        'moveDirectory',
        'getWorkspaceTree',
        'deleteDocument',
        'deleteDirectory',
      ]) {
        const endpoint = WORKSPACE_ENDPOINTS.find(
          (candidate) => candidate.operationId === operationId,
        );

        if (endpoint === undefined) {
          throw new Error(`El endpoint ${operationId} no está en WORKSPACE_ENDPOINTS`);
        }

        const response = await call(endpoint, ids, bob.accessToken);
        record(operationId, response.status);
      }

      expect([...exercised.keys()].sort()).toEqual(
        WORKSPACE_ENDPOINTS.map((endpoint) => endpoint.operationId).sort(),
      );

      // Y ninguna falló por otro motivo: las diez respondieron con su estado de éxito.
      expect([...exercised.values()].every((status) => status < 300)).toBe(true);
    });
  });
});
