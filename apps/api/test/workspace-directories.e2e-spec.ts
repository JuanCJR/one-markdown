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
 * `POST`, `PATCH` y `DELETE` de `/api/workspace/directories` (spec 002, AC-1…AC-7 y AC-11).
 *
 * Dos usuarios y no uno: AC-5 exige comprobar que el `parentId` de **otro** usuario responde `404`
 * y no `403`, y eso no se puede montar con un solo actor. Los dos se borran al final y la cascada
 * de `onDelete: Cascade` se lleva sus directorios (plan §8).
 *
 * Cada caso usa nombres propios dentro de su usuario: así el archivo puede correr dos veces
 * seguidas contra la misma base de desarrollo sin arrastrar estado.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves **exactas** de `WorkspaceDirectoryResponseDto`, ordenadas para comparar sin ambigüedad. */
const DIRECTORY_KEYS = ['createdAt', 'depth', 'id', 'name', 'parentId', 'updatedAt'];

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

interface DirectoryBody {
  readonly name?: unknown;
  readonly parentId?: unknown;
  readonly [extra: string]: unknown;
}

describe('/api/workspace/directories (e2e) — AC-1…AC-7 y AC-11', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;
  let bob: Actor;

  beforeAll(async () => {
    app = await createAuthApp();
    prisma = app.get(PrismaService);
    alice = await register('dirs-alice');
    bob = await register('dirs-bob');
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

  function post(actor: Actor, body: DirectoryBody): request.Test {
    return request(app.getHttpServer())
      .post('/api/workspace/directories')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send(body);
  }

  /** Alta que se espera que funcione; devuelve el cuerpo ya comprobado como `201`. */
  async function createOk(
    actor: Actor,
    name: string,
    parentId: string | null,
  ): Promise<Record<string, unknown>> {
    const response = await post(actor, { name, parentId }).expect(201);
    return response.body as Record<string, unknown>;
  }

  function countDirectories(actor: Actor): Promise<number> {
    return prisma.directory.count({ where: { userId: actor.userId } });
  }

  function patch(actor: Actor, id: string, body: DirectoryBody): request.Test {
    return request(app.getHttpServer())
      .patch(`/api/workspace/directories/${id}`)
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send(body);
  }

  function del(actor: Actor, id: string, query = ''): request.Test {
    return request(app.getHttpServer())
      .delete(`/api/workspace/directories/${id}${query}`)
      .set('Authorization', `Bearer ${actor.accessToken}`);
  }

  /**
   * Documento creado directamente con Prisma y no por su endpoint: los documentos son de T-008 y
   * se implementan en paralelo. AC-11 exige que un documento cuente como hijo, y eso se puede
   * comprobar sin depender de que exista ya el controlador de documentos.
   */
  async function seedDocument(actor: Actor, directoryId: string, title: string): Promise<string> {
    const row = await prisma.document.create({
      data: {
        userId: actor.userId,
        directoryId,
        parentScopeId: directoryId,
        title,
        titleKey: title.toLowerCase(),
        content: '',
        contentBytes: 0,
      },
      select: { id: true },
    });

    return row.id;
  }

  function directoryRow(id: string): Promise<{ name: string; parentId: string | null } | null> {
    return prisma.directory.findUnique({ where: { id }, select: { name: true, parentId: true } });
  }

  describe('AC-1: alta en la raíz', () => {
    it('responde 201 con las claves exactas del DTO, parentId null y depth 0', async () => {
      const body = await createOk(alice, 'Notas', null);

      expect(Object.keys(body).sort()).toEqual(DIRECTORY_KEYS);
      expect(body['name']).toBe('Notas');
      expect(body['parentId']).toBeNull();
      expect(body['depth']).toBe(0);
      expect(typeof body['id']).toBe('string');
      expect(new Date(String(body['createdAt'])).toString()).not.toBe('Invalid Date');
      expect(new Date(String(body['updatedAt'])).toString()).not.toBe('Invalid Date');
    });

    it('la fila guardada tiene parentScopeId igual al userId del token y nameKey en minúsculas', async () => {
      const body = await createOk(alice, 'Bitácora', null);

      const row = await prisma.directory.findUniqueOrThrow({
        where: { id: String(body['id']) },
        select: { userId: true, parentId: true, parentScopeId: true, name: true, nameKey: true },
      });

      expect(row.userId).toBe(alice.userId);
      expect(row.parentId).toBeNull();
      expect(row.parentScopeId).toBe(alice.userId);
      expect(row.name).toBe('Bitácora');
      expect(row.nameKey).toBe('bitácora');
    });

    it('el cuerpo no expone userId, nameKey ni parentScopeId', async () => {
      const body = await createOk(alice, 'Sin fugas', null);
      const serialized = JSON.stringify(body);

      expect(serialized).not.toContain('userId');
      expect(serialized).not.toContain('nameKey');
      expect(serialized).not.toContain('parentScopeId');
      expect(serialized).not.toContain(alice.userId);
    });

    it('responde 401 sin cabecera Authorization', async () => {
      const antes = await countDirectories(alice);

      await request(app.getHttpServer())
        .post('/api/workspace/directories')
        .send({ name: 'Sin token', parentId: null })
        .expect(401);

      expect(await countDirectories(alice)).toBe(antes);
    });
  });

  describe('AC-2: alta anidada', () => {
    it('responde 201 con depth 1 y la fila guarda parentScopeId igual al id del padre', async () => {
      const padre = await createOk(alice, 'Proyectos', null);
      const hijo = await createOk(alice, 'Interno', String(padre['id']));

      expect(hijo['parentId']).toBe(padre['id']);
      expect(hijo['depth']).toBe(1);

      const row = await prisma.directory.findUniqueOrThrow({
        where: { id: String(hijo['id']) },
        select: { parentId: true, parentScopeId: true, userId: true },
      });

      expect(row.parentId).toBe(padre['id']);
      expect(row.parentScopeId).toBe(padre['id']);
      expect(row.userId).toBe(alice.userId);
    });
  });

  describe('AC-3: unicidad entre hermanos, insensible a la caja', () => {
    it('responde 409 DIRECTORY_NAME_TAKEN y deja una sola fila con ese nameKey', async () => {
      await createOk(alice, 'Recetas', null);

      const response = await post(alice, { name: 'RECETAS', parentId: null }).expect(409);

      expect(response.body.code).toBe('DIRECTORY_NAME_TAKEN');
      expect(response.body.statusCode).toBe(409);

      const filas = await prisma.directory.count({
        where: { userId: alice.userId, parentScopeId: alice.userId, nameKey: 'recetas' },
      });

      expect(filas).toBe(1);
    });

    it('responde 409 también con el mismo nombre entre espacios', async () => {
      await createOk(alice, 'Viajes', null);

      const response = await post(alice, { name: '   viajes   ', parentId: null }).expect(409);

      expect(response.body.code).toBe('DIRECTORY_NAME_TAKEN');

      const filas = await prisma.directory.count({
        where: { userId: alice.userId, parentScopeId: alice.userId, nameKey: 'viajes' },
      });

      expect(filas).toBe(1);
    });

    it('responde 201 con el mismo nombre dentro de otro padre', async () => {
      const padre = await createOk(alice, 'Cajón', null);
      await createOk(alice, 'Comunes', null);

      const hermano = await createOk(alice, 'Comunes', String(padre['id']));

      expect(hermano['parentId']).toBe(padre['id']);
      expect(hermano['depth']).toBe(1);
    });

    it('responde 201 con el mismo nombre para otro usuario en su propia raíz', async () => {
      await createOk(alice, 'Compartido', null);

      const suyo = await createOk(bob, 'Compartido', null);

      expect(suyo['depth']).toBe(0);
      expect(suyo['parentId']).toBeNull();
    });
  });

  describe('AC-4: cuerpo inválido → 400 nombrando el campo, sin filas nuevas', () => {
    const casos: ReadonlyArray<{ caso: string; body: DirectoryBody; campo: string }> = [
      { caso: 'name vacío', body: { name: '', parentId: null }, campo: 'name' },
      { caso: 'name de solo espacios', body: { name: '     ', parentId: null }, campo: 'name' },
      { caso: 'name de 121 caracteres', body: { name: 'x'.repeat(121), parentId: null }, campo: 'name' },
      { caso: 'name con carácter de control', body: { name: 'a\u0007b', parentId: null }, campo: 'name' },
      { caso: 'name con /', body: { name: 'a/b', parentId: null }, campo: 'name' },
      { caso: 'name con \\', body: { name: 'a\\b', parentId: null }, campo: 'name' },
      { caso: 'name igual a ..', body: { name: '..', parentId: null }, campo: 'name' },
      { caso: 'name que no es cadena', body: { name: 42, parentId: null }, campo: 'name' },
      { caso: 'parentId ausente', body: { name: 'Sin padre declarado' }, campo: 'parentId' },
      { caso: 'parentId que no es uuid', body: { name: 'Padre raro', parentId: 'no-uuid' }, campo: 'parentId' },
      {
        caso: 'propiedad no declarada',
        body: { name: 'Con extra', parentId: null, color: 'rojo' },
        campo: 'color',
      },
    ];

    it.each(casos)('$caso', async ({ body, campo }) => {
      const antes = await countDirectories(alice);

      const response = await post(alice, body).expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(JSON.stringify(response.body.message)).toContain(campo);
      expect(await countDirectories(alice)).toBe(antes);
    });
  });

  describe('AC-5: padre inexistente o ajeno → 404 PARENT_NOT_FOUND, nunca 403', () => {
    it('responde 404 con un parentId de otro usuario', async () => {
      const deBob = await createOk(bob, 'Privado de Bob', null);
      const antes = await countDirectories(alice);

      const response = await post(alice, {
        name: 'Intruso',
        parentId: String(deBob['id']),
      }).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.code).toBe('PARENT_NOT_FOUND');
      expect(await countDirectories(alice)).toBe(antes);
    });

    it('responde 404 con un parentId que no existe', async () => {
      const antes = await countDirectories(alice);

      const response = await post(alice, { name: 'Huérfano', parentId: randomUUID() }).expect(404);

      expect(response.body.code).toBe('PARENT_NOT_FOUND');
      expect(await countDirectories(alice)).toBe(antes);
    });
  });

  describe('AC-6: tope de profundidad', () => {
    it('responde 409 DEPTH_LIMIT_EXCEEDED al colgar un hijo del nivel más profundo', async () => {
      // Profundidades 0…9: la cadena se construye con un bucle, no con diez llamadas a mano.
      let parentId: string | null = null;

      for (let nivel = 0; nivel < MAX_DIRECTORY_DEPTH; nivel += 1) {
        const creado = await createOk(alice, `Nivel ${String(nivel)}`, parentId);

        expect(creado['depth']).toBe(nivel);
        parentId = String(creado['id']);
      }

      const antes = await countDirectories(alice);
      const response = await post(alice, { name: 'Uno de más', parentId }).expect(409);

      expect(response.body.code).toBe('DEPTH_LIMIT_EXCEEDED');
      expect(await countDirectories(alice)).toBe(antes);
    });
  });

  describe('AC-7: PATCH /api/workspace/directories/:id (renombrar)', () => {
    it('responde 200 con el nombre nuevo, las claves exactas del DTO y un updatedAt posterior', async () => {
      const padre = await createOk(alice, 'Renombrables', null);
      const creado = await createOk(alice, 'Borrador', String(padre['id']));

      const response = await patch(alice, String(creado['id']), { name: 'Definitivo' }).expect(200);
      const body = response.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(DIRECTORY_KEYS);
      expect(body['name']).toBe('Definitivo');
      expect(body['id']).toBe(creado['id']);
      expect(body['parentId']).toBe(padre['id']);
      expect(body['depth']).toBe(1);
      expect(new Date(String(body['updatedAt'])).getTime()).toBeGreaterThan(
        new Date(String(creado['updatedAt'])).getTime(),
      );

      const row = await prisma.directory.findUniqueOrThrow({
        where: { id: String(creado['id']) },
        select: { name: true, nameKey: true },
      });

      expect(row.name).toBe('Definitivo');
      expect(row.nameKey).toBe('definitivo');
    });

    it('responde 409 DIRECTORY_NAME_TAKEN si choca con un hermano y deja el nombre sin cambiar', async () => {
      const padre = await createOk(alice, 'Choques', null);
      const ocupado = await createOk(alice, 'Ocupado', String(padre['id']));
      const sujeto = await createOk(alice, 'Sujeto', String(padre['id']));

      const response = await patch(alice, String(sujeto['id']), { name: 'OCUPADO' }).expect(409);

      expect(response.body.code).toBe('DIRECTORY_NAME_TAKEN');
      expect((await directoryRow(String(sujeto['id'])))?.name).toBe('Sujeto');
      expect((await directoryRow(String(ocupado['id'])))?.name).toBe('Ocupado');
    });

    it('responde 200 cuando el rename solo cambia la caja del propio nombre', async () => {
      const creado = await createOk(alice, 'Mayúsculas', null);

      const response = await patch(alice, String(creado['id']), { name: 'MAYÚSCULAS' }).expect(200);

      expect(response.body.name).toBe('MAYÚSCULAS');

      const row = await prisma.directory.findUniqueOrThrow({
        where: { id: String(creado['id']) },
        select: { name: true, nameKey: true },
      });

      expect(row.name).toBe('MAYÚSCULAS');
      expect(row.nameKey).toBe('mayúsculas');
    });

    it('responde 404 al renombrar un directorio de otro usuario, y nunca 403', async () => {
      const deBob = await createOk(bob, 'De Bob renombrable', null);

      const response = await patch(alice, String(deBob['id']), { name: 'Secuestrado' }).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect((await directoryRow(String(deBob['id'])))?.name).toBe('De Bob renombrable');
    });

    it('responde 404 al renombrar un id inexistente', async () => {
      await patch(alice, randomUUID(), { name: 'Fantasma' }).expect(404);
    });

    it('responde 400 con un nombre inválido, nombrando el campo, y sin tocar la fila', async () => {
      const creado = await createOk(alice, 'Intacto', null);

      const response = await patch(alice, String(creado['id']), { name: 'a/b' }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('name');
      expect((await directoryRow(String(creado['id'])))?.name).toBe('Intacto');
    });

    it('responde 400 con una propiedad no declarada', async () => {
      const creado = await createOk(alice, 'Sin extras', null);

      const response = await patch(alice, String(creado['id']), {
        name: 'Otro',
        parentId: null,
      }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('parentId');
    });

    it('responde 400 con un :id que no es uuid', async () => {
      await patch(alice, 'no-uuid', { name: 'Da igual' }).expect(400);
    });

    it('responde 401 sin cabecera Authorization', async () => {
      const creado = await createOk(alice, 'Protegido', null);

      await request(app.getHttpServer())
        .patch(`/api/workspace/directories/${String(creado['id'])}`)
        .send({ name: 'Sin token' })
        .expect(401);

      expect((await directoryRow(String(creado['id'])))?.name).toBe('Protegido');
    });
  });

  describe('AC-11: DELETE /api/workspace/directories/:id', () => {
    it('responde 204 sin cuerpo y deja la fila fuera cuando el directorio está vacío', async () => {
      const creado = await createOk(alice, 'Vacío', null);

      const response = await del(alice, String(creado['id'])).expect(204);

      expect(response.body).toEqual({});
      expect(response.text).toBe('');
      expect(await directoryRow(String(creado['id']))).toBeNull();
    });

    it('responde 409 DIRECTORY_NOT_EMPTY con un subdirectorio dentro y no borra nada', async () => {
      const padre = await createOk(alice, 'Con hijo', null);
      const hijo = await createOk(alice, 'Hijo', String(padre['id']));

      const response = await del(alice, String(padre['id'])).expect(409);

      expect(response.body.code).toBe('DIRECTORY_NOT_EMPTY');
      expect(await directoryRow(String(padre['id']))).not.toBeNull();
      expect(await directoryRow(String(hijo['id']))).not.toBeNull();
    });

    it('responde 409 DIRECTORY_NOT_EMPTY con un documento dentro y no borra nada', async () => {
      const padre = await createOk(alice, 'Con documento', null);
      const documentId = await seedDocument(alice, String(padre['id']), 'Apunte');

      const response = await del(alice, String(padre['id'])).expect(409);

      expect(response.body.code).toBe('DIRECTORY_NOT_EMPTY');
      expect(await directoryRow(String(padre['id']))).not.toBeNull();
      expect(await prisma.document.count({ where: { id: documentId } })).toBe(1);
    });

    it('responde 409 con ?recursive=false sobre un directorio con hijos', async () => {
      const padre = await createOk(alice, 'Recursive false', null);
      await createOk(alice, 'Hijo de recursive false', String(padre['id']));

      const response = await del(alice, String(padre['id']), '?recursive=false').expect(409);

      expect(response.body.code).toBe('DIRECTORY_NOT_EMPTY');
      expect(await directoryRow(String(padre['id']))).not.toBeNull();
    });

    it('responde 204 con ?recursive=true y la cascada se lleva subdirectorios y documentos', async () => {
      const abuelo = await createOk(alice, 'Cascada', null);
      const padre = await createOk(alice, 'Rama', String(abuelo['id']));
      const nieto = await createOk(alice, 'Hoja', String(padre['id']));
      const enAbuelo = await seedDocument(alice, String(abuelo['id']), 'Doc del abuelo');
      const enNieto = await seedDocument(alice, String(nieto['id']), 'Doc del nieto');

      await del(alice, String(abuelo['id']), '?recursive=true').expect(204);

      const ids = [abuelo, padre, nieto].map((nodo) => String(nodo['id']));

      expect(await prisma.directory.count({ where: { id: { in: ids } } })).toBe(0);
      expect(await prisma.document.count({ where: { id: { in: [enAbuelo, enNieto] } } })).toBe(0);
    });

    it('responde 400 con ?recursive=yes, nombrando el campo, y no borra nada', async () => {
      const creado = await createOk(alice, 'Recursive raro', null);

      const response = await del(alice, String(creado['id']), '?recursive=yes').expect(400);

      expect(JSON.stringify(response.body.message)).toContain('recursive');
      expect(await directoryRow(String(creado['id']))).not.toBeNull();
    });

    it('responde 400 con un parámetro de query no declarado', async () => {
      const creado = await createOk(alice, 'Query rara', null);

      await del(alice, String(creado['id']), '?force=true').expect(400);

      expect(await directoryRow(String(creado['id']))).not.toBeNull();
    });

    it('responde 404 al borrar un id inexistente', async () => {
      const response = await del(alice, randomUUID()).expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('responde 404 al borrar un directorio de otro usuario, y la fila de su dueño sigue ahí', async () => {
      const deBob = await createOk(bob, 'De Bob indestructible', null);

      const response = await del(alice, String(deBob['id'])).expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(await directoryRow(String(deBob['id']))).not.toBeNull();
    });

    it('responde 400 con un :id que no es uuid', async () => {
      await del(alice, 'no-uuid').expect(400);
    });

    it('responde 401 sin cabecera Authorization', async () => {
      const creado = await createOk(alice, 'Borrable con token', null);

      await request(app.getHttpServer())
        .delete(`/api/workspace/directories/${String(creado['id'])}`)
        .expect(401);

      expect(await directoryRow(String(creado['id']))).not.toBeNull();
    });
  });
});
