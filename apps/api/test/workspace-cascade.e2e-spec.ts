import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * Cascada del borrado de un usuario (spec 002, AC-19).
 *
 * Lo que se afirma aquí **no** es código de la aplicación: es el esquema. Las tres claves ajenas de
 * `plan.md` §5 llevan `onDelete: Cascade`, así que borrar la fila de `users` tiene que llevarse sus
 * directorios (recursivamente, por la autorrelación) y sus documentos sin que ningún servicio
 * recorra nada. Si alguien cambiara esa cláusula en una migración futura, el `DELETE` fallaría con
 * una violación de clave ajena o dejaría filas huérfanas, y este archivo es el que lo ve.
 *
 * **Dos usuarios, y ninguno recién vaciado.** Bob tiene un árbol con los mismos nombres que el de
 * Alice y **no** se borra en el caso: una cascada que se llevara de más (o un `deleteMany` sin
 * `where`) daría `0` para Alice igual que la correcta, y solo el árbol intacto de Bob distingue las
 * dos. Además se comprueba el estado **antes** del borrado: sin esa precondición, un seed que
 * fallara en silencio haría pasar el caso con `0` de `0`.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

/** Ids de todo lo que siembra `seedWorkspace`, para poder buscarlos por `id` y no solo por dueño. */
interface SeededTree {
  readonly directoryIds: readonly string[];
  readonly documentIds: readonly string[];
}

/** Tres niveles de directorios y tres documentos: raíz, nivel 1 y nivel 2. */
const EXPECTED_DIRECTORIES = 3;
const EXPECTED_DOCUMENTS = 3;

describe('cascada del borrado de un usuario (e2e) — AC-19', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;
  let bob: Actor;
  let aliceTree: SeededTree;
  let bobTree: SeededTree;

  beforeAll(async () => {
    app = await createAuthApp();
    prisma = app.get(PrismaService);

    alice = await register('cascade-alice');
    bob = await register('cascade-bob');

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

  /**
   * Un árbol anidado con documentos en los tres niveles. Los nombres son iguales para los dos
   * actores a propósito: la unicidad es por `parentScopeId`, que incluye el `userId` en la raíz.
   */
  async function seedWorkspace(actor: Actor): Promise<SeededTree> {
    const raiz = await createDirectory(actor, 'Cascada', null);
    const hijo = await createDirectory(actor, 'Rama', raiz);
    const nieto = await createDirectory(actor, 'Hoja', hijo);

    const enRaizDelWorkspace = await createDocument(actor, 'Suelto', null);
    const enHijo = await createDocument(actor, 'En la rama', hijo);
    const enNieto = await createDocument(actor, 'En la hoja', nieto);

    return {
      directoryIds: [raiz, hijo, nieto],
      documentIds: [enRaizDelWorkspace, enHijo, enNieto],
    };
  }

  async function createDirectory(
    actor: Actor,
    name: string,
    parentId: string | null,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/workspace/directories')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ name, parentId })
      .expect(201);

    const id: string = response.body.id;

    return id;
  }

  async function createDocument(
    actor: Actor,
    title: string,
    directoryId: string | null,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/workspace/documents')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({ title, directoryId, content: '# Contenido que la cascada se lleva' })
      .expect(201);

    const id: string = response.body.id;

    return id;
  }

  async function countOwnedBy(userId: string): Promise<{ directories: number; documents: number }> {
    const [directories, documents] = await Promise.all([
      prisma.directory.count({ where: { userId } }),
      prisma.document.count({ where: { userId } }),
    ]);

    return { directories, documents };
  }

  it('el árbol sembrado existe antes del borrado (precondición: el caso no pasa por vacío)', async () => {
    await expect(countOwnedBy(alice.userId)).resolves.toEqual({
      directories: EXPECTED_DIRECTORIES,
      documents: EXPECTED_DOCUMENTS,
    });
    await expect(countOwnedBy(bob.userId)).resolves.toEqual({
      directories: EXPECTED_DIRECTORIES,
      documents: EXPECTED_DOCUMENTS,
    });
  });

  it('borrar la fila de users deja 0 directorios y 0 documentos suyos, y no toca los de otro usuario', async () => {
    // El `delete` es de una sola fila y de una sola tabla: nada aquí recorre el árbol. Que termine
    // sin error ya es media afirmación (sin `ON DELETE CASCADE` sería un `P2003`).
    await prisma.user.delete({ where: { id: alice.userId } });

    await expect(countOwnedBy(alice.userId)).resolves.toEqual({ directories: 0, documents: 0 });

    // Y no quedan huérfanos con otro dueño: se buscan por `id`, no por `userId`.
    await expect(
      prisma.directory.count({ where: { id: { in: [...aliceTree.directoryIds] } } }),
    ).resolves.toBe(0);
    await expect(
      prisma.document.count({ where: { id: { in: [...aliceTree.documentIds] } } }),
    ).resolves.toBe(0);

    // La cascada se llevó **lo suyo**, no la tabla: el árbol de Bob sigue entero.
    await expect(countOwnedBy(bob.userId)).resolves.toEqual({
      directories: EXPECTED_DIRECTORIES,
      documents: EXPECTED_DOCUMENTS,
    });
    await expect(
      prisma.directory.count({ where: { id: { in: [...bobTree.directoryIds] } } }),
    ).resolves.toBe(EXPECTED_DIRECTORIES);
    await expect(
      prisma.document.count({ where: { id: { in: [...bobTree.documentIds] } } }),
    ).resolves.toBe(EXPECTED_DOCUMENTS);
  });
});
