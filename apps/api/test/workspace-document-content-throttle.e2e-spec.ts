import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { THROTTLE_LIMITS } from '../src/common/throttle';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * Cupo propio del guardado de contenido (spec 003, AC-10, T-008).
 *
 * Lo que se mide **no** es «hay un límite en el guardado»: eso lo cumpliría igual de bien un
 * guardado que gastara el cupo de `workspace`. Lo que se mide es que el cupo es **suyo**, y eso solo
 * se ve en los dos caminos cruzados:
 *
 * 1. Agotar `documentContent` con `THROTTLE_LIMITS.documentContent.limit` guardados seguidos —que
 *    responden `200` y **nunca** `429`— y ver que el siguiente sí responde `429`.
 * 2. **Y que después de eso `GET /api/workspace/tree` siga respondiendo `200`.** Éste es el caso que
 *    de verdad justifica el archivo: un `@Throttled('documentContent')` mal puesto —o puesto a nivel
 *    de clase, o sustituido por `workspace`— pasaría el punto 1 sin despeinarse y caería aquí.
 * 3. El camino inverso: agotar `workspace` con lecturas del árbol **no** impide guardar.
 *
 * Sin 2 y 3 este archivo sería una comprobación de que el throttler existe, que es lo que ya hacen
 * `auth-throttle.e2e-spec.ts` y `workspace-throttle.e2e-spec.ts`.
 *
 * **Va en serie** (`tasks.md`, §«Suites e2e: qué comparte estado y qué tiene que ir en serie»): agota
 * cupo a propósito, los contadores son por IP y todas las peticiones de todos los archivos salen de
 * `127.0.0.1`. Hoy lo garantiza el `--runInBand` de la **línea de órdenes** de `apps/api/package.json`,
 * que **no** está en `test/jest-e2e.json`.
 *
 * ---
 *
 * **Por qué este archivo pone los contadores a cero, y por qué eso NO destruye lo que mide.**
 *
 * La duda es razonable y conviene contestarla aquí, porque quien lea un test de rate limit que
 * empieza borrando contadores de rate limit va a sospechar —con buen criterio— que el test se ha
 * neutralizado a sí mismo. No es el caso, y la distinción está en **dónde** se resetea:
 *
 * - **En los límites de cada caso** (aquí: al empezar y al terminar), que es lo que se hace. El caso
 *   parte de un contador limpio y **después** agota el cupo él solo, con sus 120 peticiones, y exige
 *   el `429`. El reset no le regala nada: le quita la herencia de lo que gastaron los otros dieciséis
 *   archivos e2e, que salen de la misma IP y comparten los mismos cubos. Sin él, el número de
 *   peticiones necesarias para llegar al `429` dependería de qué corrió antes, y el archivo mediría
 *   el orden de la suite en vez del throttler.
 * - **A mitad de una secuencia de agotamiento**, que es lo que NO se hace nunca. Eso sí lo
 *   destruiría: el `429` no llegaría jamás y las aserciones pasarían sin medir nada. Es la línea que
 *   no hay que cruzar al tocar este archivo.
 *
 * Es el mismo idioma que `workspace-throttle.e2e-spec.ts` (AC-24 de la `002`, que resetea en tres
 * puntos y aun así exige `429` nueve veces) y que los demás archivos con estado de la suite. La
 * prohibición heredada de la spec `001` apunta a otra cosa: al reset de
 * `apps/web/e2e/support/services.ts`, que hace que el **navegador** nunca vea un `429`, y ahí sí
 * borraría la única prueba de que los límites existen.
 *
 * Y no es una promesa, está **medido**: con estos resets puestos, cambiar el
 * `@Throttled('documentContent')` del manejador por `@Throttled('workspace')` sigue tumbando los dos
 * casos cruzados. Un test de agotamiento de cupo que nunca ha fallado es un test que nadie sabe si
 * mide; éste se ha hecho fallar a propósito, con los resets puestos.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves **exactas** de `ErrorResponseDto` en un `429` del throttler: sin `code`. */
const ERROR_KEYS = ['error', 'message', 'path', 'statusCode', 'timestamp'];

/** Claves **exactas** del cuerpo de `WorkspaceTreeResponseDto`: el `200` no puede ser cualquiera. */
const TREE_KEYS = ['directories', 'documents', 'generatedAt'];

/** Claves **exactas** de `WorkspaceDocumentContentResponseDto`: el `200` del guardado tampoco. */
const CONTENT_SAVED_KEYS = ['contentBytes', 'contentVersion', 'id', 'updatedAt'];

const LIMITE_GUARDADOS = THROTTLE_LIMITS.documentContent.limit;
const LIMITE_WORKSPACE = THROTTLE_LIMITS.workspace.limit;

/**
 * Peticiones del cupo de `workspace` que gasta el caso del guardado: el alta del documento y la
 * lectura final del árbol. Tiene que caber **de sobra** en el cupo de `workspace` para que ese `200`
 * final signifique «el cupo del árbol está intacto» y no «quedaba justo una».
 */
const WORKSPACE_GASTADO_AL_GUARDAR = 2;

/** Agotar 120 peticiones y comprobar el cruce no cabe en los 5 s por defecto de Jest. */
const TIMEOUT_LARGO = 120_000;

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

describe('cupo propio del guardado de contenido (e2e) — AC-10', () => {
  let app: INestApplication;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;
  let seq = 0;

  beforeAll(async () => {
    app = await createAuthApp();
    // Antes de registrar: el alta gasta cupo de `register`, que son cinco por cuarto de hora por IP
    // y es el más escaso de todos. Sin esto, el archivo dependería de cuánto lo gastó el anterior.
    await resetThrottleCounters(app);
    alice = await register('content-throttle');
  });

  afterAll(async () => {
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await resetThrottleCounters(app);
    await app.close();
  });

  // Al empezar cada caso: parte de contadores limpios y agota el cupo él mismo (ver el porqué en la
  // cabecera del archivo). El límite es por IP y todas las peticiones de la suite salen de 127.0.0.1.
  beforeEach(async () => {
    await resetThrottleCounters(app);
  });

  // Al terminar cada caso: este archivo agota dos cupos a propósito, y dejarlos gastados haría fallar
  // por acumulación a la siguiente suite en vez de por lo que esa suite mide.
  afterEach(async () => {
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

  function tree(): request.Test {
    return request(app.getHttpServer())
      .get('/api/workspace/tree')
      .set('Authorization', `Bearer ${alice.accessToken}`);
  }

  /** Crea un documento. Gasta **una** petición del cupo de `workspace`, y los casos la cuentan. */
  async function createDocument(prefix: string): Promise<string> {
    seq += 1;

    const response = await request(app.getHttpServer())
      .post('/api/workspace/documents')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        title: `${prefix}-${String(process.pid)}-${String(seq)}`,
        directoryId: null,
        content: '',
      })
      .expect(201);

    const id: string = response.body.id;

    return id;
  }

  function save(id: string, content: string, expectedVersion: number): request.Test {
    return request(app.getHttpServer())
      .put(`/api/workspace/documents/${id}/content`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ content, expectedVersion });
  }

  function expectErrorDto(response: request.Response, statusCode: number): void {
    expect(Object.keys(response.body as object).sort()).toEqual(ERROR_KEYS);
    expect(response.body.statusCode).toBe(statusCode);
    expect(typeof response.body.message).toBe('string');
  }

  it('los números del caso son los que hacen que signifique algo', () => {
    // Agotar un cupo de uno no distinguiría «tiene cupo propio» de «no tiene ninguno».
    expect(LIMITE_GUARDADOS).toBeGreaterThan(1);
    expect(LIMITE_WORKSPACE).toBeGreaterThan(1);

    // El `200` del árbol tras agotar el guardado solo significa «cupos separados» si el caso no ha
    // estado a punto de gastar el del árbol por su cuenta.
    expect(WORKSPACE_GASTADO_AL_GUARDAR).toBeLessThan(LIMITE_WORKSPACE);
  });

  it(
    'agotar el cupo de workspace no impide guardar (los guardados no salen de ese cubo)',
    async () => {
      // El alta del documento es la **primera** petición del cupo de `workspace`; por eso el bucle
      // empieza en la segunda. Si se añadiera otra petición aquí, el `429` llegaría antes de tiempo.
      const id = await createDocument('CupoInverso');

      for (let numero = 2; numero <= LIMITE_WORKSPACE; numero += 1) {
        const response = await tree();

        expect({ numero, status: response.status }).toEqual({ numero, status: 200 });
      }

      const bloqueada = await tree();

      expect(bloqueada.status).toBe(429);
      expectErrorDto(bloqueada, 429);

      // Con `workspace` agotado, guardar sigue funcionando: es el cupo de `documentContent`, intacto.
      const guardado = await save(id, '# Escribo con el arbol agotado', 0);

      expect(guardado.status).toBe(200);
      expect(Object.keys(guardado.body as object).sort()).toEqual(CONTENT_SAVED_KEYS);
      expect(guardado.body.contentVersion).toBe(1);

      // Y el guardado no ha «desbloqueado» el árbol de rebote: los contadores siguen separados.
      await tree().expect(429);
    },
    TIMEOUT_LARGO,
  );

  it(
    `${String(LIMITE_GUARDADOS)} guardados seguidos responden 200 y el siguiente 429, y el árbol sigue en pie`,
    async () => {
      const id = await createDocument('CupoGuardado');

      let version = 0;

      for (let numero = 1; numero <= LIMITE_GUARDADOS; numero += 1) {
        const response = await save(id, `# Guardado ${String(numero)}`, version);

        // El número va en el mensaje: si cayera en el 121 sin haber pasado por aquí, o en el 15
        // —el cupo de `login`—, el informe lo dice sin tener que reproducirlo.
        expect({ numero, status: response.status }).toEqual({ numero, status: 200 });
        version = response.body.contentVersion;
      }

      // Los 120 escribieron de verdad: no fueron `409` disfrazados de «no `429`».
      expect(version).toBe(LIMITE_GUARDADOS);

      const bloqueado = await save(id, '# Uno de mas', version);

      expect(bloqueado.status).toBe(429);
      expectErrorDto(bloqueado, 429);

      // **El caso**: con el cupo de guardado agotado, el árbol sigue contestando. Si el guardado
      // gastara el cupo de `workspace`, aquí habría un `429` y el `200` de arriba no habría
      // demostrado nada sobre la separación.
      const arbol = await tree();

      expect(arbol.status).toBe(200);
      expect(Object.keys(arbol.body as object).sort()).toEqual(TREE_KEYS);

      // Y el árbol tampoco ha devuelto cupo al guardado.
      await save(id, '# Sigue bloqueado', version).expect(429);
    },
    TIMEOUT_LARGO,
  );
});
