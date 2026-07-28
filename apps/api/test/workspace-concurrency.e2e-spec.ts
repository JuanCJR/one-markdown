import type { INestApplication } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { workspaceNameKey } from '../src/workspace/workspace-name';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * Concurrencia del workspace (spec 002, AC-25).
 *
 * Dos garantías que **no** están en el código del servicio y que por tanto solo se pueden afirmar
 * desde fuera:
 *
 * 1. El índice único `[parentScopeId, nameKey]` arbitra dos renombrados simultáneos al mismo
 *    nombre. El servicio no hace `findFirst` antes de escribir a propósito (decisión 8 del plan):
 *    entre la comprobación y la escritura cabe la otra petición, así que la única garantía real es
 *    la de la base. Aquí se comprueba que la traduce a `409` y no a `500`, y que en la base queda
 *    **una** fila.
 * 2. Un destino que desapareció no deja al sujeto colgando de un `parentId` inexistente: sale el
 *    `404 PARENT_NOT_FOUND` y el `parentId` anterior se conserva intacto.
 *
 * **Sobre el 404 y los falsos verdes.** Nest responde `404` también a una ruta mal escrita, así que
 * un caso que solo mire el número pasaría con una errata en la URL. Por eso cada error afirma el
 * juego **exacto** de claves del cuerpo y su `code`: un `404` de ruta inexistente no lleva `code`, y
 * además el caso comprueba en la misma URL que un destino vivo responde `200`.
 *
 * **Sobre «competir de verdad».** Las dos peticiones se lanzan con `Promise.all` y el caso **mide**
 * que sus intervalos se solapan (afirmación, no comentario). Eso demuestra que están las dos en
 * vuelo a la vez; que sus dos `UPDATE` colisionen literalmente dentro del índice depende de
 * microsegundos y no se puede forzar desde aquí. Lo que se afirma es el invariante —exactamente un
 * ganador, un `409` tipado para el otro y una sola fila en la base—, que es justo lo que se rompería
 * si la unicidad dejara de ser de la base.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves **exactas** de `ErrorResponseDto` cuando el error lleva `code` (decisión 13 del plan). */
const ERROR_KEYS_WITH_CODE = ['code', 'error', 'message', 'path', 'statusCode', 'timestamp'];

/** Claves **exactas** de `WorkspaceDirectoryResponseDto`. */
const DIRECTORY_KEYS = ['createdAt', 'depth', 'id', 'name', 'parentId', 'updatedAt'];

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

/** Una respuesta con la ventana de tiempo real en la que estuvo en vuelo. */
interface Timed {
  readonly response: request.Response;
  readonly startedAt: number;
  readonly settledAt: number;
}

describe('concurrencia del workspace (e2e) — AC-25', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;

  /** Los nombres son únicos entre hermanos: un contador hace que el archivo se pueda repetir. */
  let seq = 0;

  beforeAll(async () => {
    app = await createAuthApp();
    prisma = app.get(PrismaService);
    alice = await register('concurrency-alice');
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

  function nextName(prefix: string): string {
    seq += 1;
    return `${prefix}-${String(process.pid)}-${String(seq)}`;
  }

  async function createDirectory(name: string, parentId: string | null): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/workspace/directories')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name, parentId })
      .expect(201);

    const id: string = response.body.id;

    return id;
  }

  function renameRequest(id: string, name: string): request.Test {
    return request(app.getHttpServer())
      .patch(`/api/workspace/directories/${id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name });
  }

  function moveRequest(id: string, parentId: string | null): request.Test {
    return request(app.getHttpServer())
      .post(`/api/workspace/directories/${id}/move`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ parentId });
  }

  function deleteRequest(id: string): request.Test {
    return request(app.getHttpServer())
      .delete(`/api/workspace/directories/${id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
  }

  /** Lanza la petición midiendo cuándo empezó y cuándo terminó, para poder afirmar el solape. */
  async function timed(start: () => request.Test): Promise<Timed> {
    const startedAt = performance.now();
    const response = await start();

    return { response, startedAt, settledAt: performance.now() };
  }

  /**
   * Afirma que las dos peticiones estuvieron en vuelo **a la vez**. Si el runtime las serializara
   * (la segunda empezando después de que la primera terminara) el caso dejaría de medir
   * concurrencia, y esto es lo que lo delata en vez de dejarlo pasar en silencio.
   */
  function expectOverlap(a: Timed, b: Timed): void {
    expect(Math.max(a.startedAt, b.startedAt)).toBeLessThan(Math.min(a.settledAt, b.settledAt));
  }

  function expectErrorBody(response: request.Response, statusCode: number, code: string): void {
    expect(Object.keys(response.body as object).sort()).toEqual(ERROR_KEYS_WITH_CODE);
    expect(response.body.statusCode).toBe(statusCode);
    expect(response.body.code).toBe(code);
  }

  async function directoryRow(
    id: string,
  ): Promise<{ parentId: string | null; name: string; nameKey: string } | null> {
    return prisma.directory.findUnique({
      where: { id },
      select: { parentId: true, name: true, nameKey: true },
    });
  }

  describe('dos renombrados simultáneos al mismo nombre', () => {
    it('devuelve exactamente {200, 409} y deja una sola fila con ese nameKey', async () => {
      const uno = await createDirectory(nextName('Uno'), null);
      const dos = await createDirectory(nextName('Dos'), null);
      const objetivo = nextName('Colision');

      const [primera, segunda] = await Promise.all([
        timed(() => renameRequest(uno, objetivo)),
        timed(() => renameRequest(dos, objetivo)),
      ]);

      // Las dos peticiones estuvieron en vuelo a la vez: el caso mide concurrencia de verdad.
      expectOverlap(primera, segunda);

      const codigos = [primera.response.status, segunda.response.status].sort((a, b) => a - b);
      expect(codigos).toEqual([200, 409]);

      const ganadora = primera.response.status === 200 ? primera.response : segunda.response;
      const perdedora = primera.response.status === 200 ? segunda.response : primera.response;

      expect(Object.keys(ganadora.body as object).sort()).toEqual(DIRECTORY_KEYS);
      expect(ganadora.body.name).toBe(objetivo);

      // El perdedor no recibe un `500` ni un error genérico: recibe el `409` tipado del contrato.
      expectErrorBody(perdedora, 409, 'DIRECTORY_NAME_TAKEN');

      // Y en la base hay **una** fila con ese nombre en el ámbito del usuario. Se cuenta por las dos
      // vías —clave de unicidad y nombre visible— para que la afirmación no dependa de que el
      // `nameKey` se calcule como se espera.
      await expect(
        prisma.directory.count({
          where: { parentScopeId: alice.userId, nameKey: workspaceNameKey(objetivo) },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.directory.count({ where: { parentScopeId: alice.userId, name: objetivo } }),
      ).resolves.toBe(1);

      // El perdedor conserva su nombre anterior: el `409` no dejó una escritura a medias.
      const ganadorId: string = ganadora.body.id;
      const perdedorId = ganadorId === uno ? dos : uno;

      await expect(directoryRow(ganadorId)).resolves.toMatchObject({ name: objetivo });
      const perdedorRow = await directoryRow(perdedorId);
      expect(perdedorRow).not.toBeNull();
      expect(perdedorRow?.name).not.toBe(objetivo);
    });
  });

  describe('mover a un destino que acaba de desaparecer', () => {
    it('responde 404 PARENT_NOT_FOUND y el sujeto conserva su parentId anterior', async () => {
      const origen = await createDirectory(nextName('Origen'), null);
      const sujeto = await createDirectory(nextName('Sujeto'), origen);
      const destino = await createDirectory(nextName('Destino'), null);

      await deleteRequest(destino).expect(204);

      const respuesta = await moveRequest(sujeto, destino).expect(404);

      // `code` presente y exacto: un `404` de ruta inexistente no lo lleva, así que este cuerpo solo
      // lo puede haber escrito el handler del move.
      expectErrorBody(respuesta, 404, 'PARENT_NOT_FOUND');

      // El sujeto sigue donde estaba, nunca colgando de un id que ya no existe.
      await expect(directoryRow(sujeto)).resolves.toMatchObject({ parentId: origen });

      // Control positivo de la URL: la **misma** ruta, con un destino vivo, responde `200`. Sin
      // esto, una errata en el path haría pasar el `404` de arriba por el motivo equivocado.
      const vivo = await createDirectory(nextName('Vivo'), null);
      const movida = await moveRequest(sujeto, vivo).expect(200);

      expect(Object.keys(movida.body as object).sort()).toEqual(DIRECTORY_KEYS);
      expect(movida.body.parentId).toBe(vivo);
      await expect(directoryRow(sujeto)).resolves.toMatchObject({ parentId: vivo });
    });

    /**
     * Variante **realmente** simultánea (añadido sobre `tasks.md`, que solo pide el caso
     * secuencial): borrar el destino y mover hacia él a la vez. Aquí no hay un resultado único —el
     * ganador depende de la carrera—, así que lo que se afirma es el invariante que ninguna de las
     * dos ordenaciones puede romper: el sujeto o desaparece con la cascada, o queda colgando de un
     * padre que **existe**. Nunca de un id fantasma.
     */
    it('borrar el destino mientras se mueve hacia él nunca deja un parentId inexistente', async () => {
      const origen = await createDirectory(nextName('CarreraOrigen'), null);
      const sujeto = await createDirectory(nextName('CarreraSujeto'), origen);
      const destino = await createDirectory(nextName('CarreraDestino'), null);

      const [borrado, movimiento] = await Promise.all([
        timed(() => deleteRequest(destino)),
        timed(() => moveRequest(sujeto, destino)),
      ]);

      expectOverlap(borrado, movimiento);

      expect([204, 409]).toContain(borrado.response.status);
      expect([200, 404, 409]).toContain(movimiento.response.status);

      if (movimiento.response.status !== 200) {
        expectErrorBody(
          movimiento.response,
          movimiento.response.status,
          movimiento.response.status === 404 ? 'PARENT_NOT_FOUND' : 'WORKSPACE_CONFLICT',
        );
      }

      const fila = await directoryRow(sujeto);

      if (fila !== null && fila.parentId !== null) {
        // El padre al que apunta tiene que existir de verdad.
        await expect(
          prisma.directory.count({ where: { id: fila.parentId, userId: alice.userId } }),
        ).resolves.toBe(1);
        expect([origen, destino]).toContain(fila.parentId);
      }
    });
  });
});
