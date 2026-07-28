import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { THROTTLE_LIMITS } from '../src/common/throttle';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteLoginAttemptKeys,
  deleteUsersByEmail,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * Rate limit de la superficie de workspace (spec 002, AC-24 y decisión 15 del plan).
 *
 * Lo que se comprueba **no** es «hay un límite»: es que el límite es **el suyo**. Con throttlers
 * nombrados y `skipIf`, el riesgo real es de dos tipos y opuestos entre sí:
 *
 * 1. Que la superficie nueva herede por accidente el límite de otro throttler. El de `login` son
 *    diez por minuto, así que quince lecturas seguidas del árbol —una sesión de trabajo normal—
 *    fallarían. Por eso el primer caso hace exactamente quince y las quince tienen que ser `200`.
 * 2. Que no tenga ninguno. Por eso el segundo caso agota el cupo de `workspace` y exige el `429`.
 *
 * Y en la otra dirección: gastar el cupo del workspace no puede dejar sin servicio al login. Los
 * cinco throttlers cuentan en claves distintas de Redis (`{throttler}:{sha256(ip)}`) y eso es
 * justamente lo que hace observable el tercer caso.
 *
 * **Los contadores se ponen a cero antes y después de cada caso.** Antes, porque el límite es por
 * IP y todos los archivos e2e salen de `127.0.0.1`; después, porque este archivo agota el cupo a
 * propósito y dejarlo sucio haría fallar por acumulación a la siguiente suite que corra.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves **exactas** de `ErrorResponseDto` en un `429` del throttler: sin `code` ni `retryAfterSeconds`. */
const ERROR_KEYS = ['error', 'message', 'path', 'statusCode', 'timestamp'];

/** Claves **exactas** del cuerpo de `WorkspaceTreeResponseDto`: el `200` no puede ser cualquiera. */
const TREE_KEYS = ['directories', 'documents', 'generatedAt'];

/**
 * Lecturas seguidas del árbol del primer caso. Tiene que ser mayor que el límite de `login` para
 * que el caso signifique algo, y menor que el de `workspace` para que no lo agote; el propio test
 * lo afirma en vez de confiar en que los números sigan cuadrando.
 */
const LECTURAS_SEGUIDAS = 15;

/** Agotar 120 peticiones más las comprobaciones no cabe en los 5 s por defecto de Jest. */
const TIMEOUT_LARGO = 120_000;

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

describe('rate limit de la superficie de workspace (e2e) — AC-24', () => {
  let app: INestApplication;
  const emails: string[] = [];
  const userIds: string[] = [];

  let alice: Actor;

  beforeAll(async () => {
    app = await createAuthApp();
    alice = await register('ws-throttle');
  });

  afterAll(async () => {
    await deleteLoginAttemptKeys(app, emails);
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await resetThrottleCounters(app);
    await app.close();
  });

  beforeEach(async () => {
    await resetThrottleCounters(app);
  });

  // El cupo se agota a propósito: si se dejara gastado, la siguiente suite fallaría por herencia.
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

  /** Login de un correo que no existe: gasta cupo de `login` sin bloquear ninguna cuenta real. */
  function loginDesconocido(): request.Test {
    const email = uniqueEmail('ws-throttle-login');
    emails.push(email);

    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: VALID_PASSWORD });
  }

  function expectErrorDto(response: request.Response, statusCode: number): void {
    expect(Object.keys(response.body as object).sort()).toEqual(ERROR_KEYS);
    expect(response.body.statusCode).toBe(statusCode);
    expect(typeof response.body.message).toBe('string');
  }

  it('los números del caso son los que hacen que signifique algo', () => {
    // Si algún día `login` subiera de 15 o `workspace` bajara de 15, el primer caso dejaría de
    // distinguir «límite propio» de «límite heredado» y pasaría sin medir nada.
    expect(LECTURAS_SEGUIDAS).toBeGreaterThan(THROTTLE_LIMITS.login.limit);
    expect(LECTURAS_SEGUIDAS).toBeLessThan(THROTTLE_LIMITS.workspace.limit);
  });

  it(
    `${String(LECTURAS_SEGUIDAS)} GET /api/workspace/tree seguidos responden 200 (no hereda el límite de login)`,
    async () => {
      for (let numero = 1; numero <= LECTURAS_SEGUIDAS; numero += 1) {
        const response = await tree();

        // El número de petición va en el mensaje: si fallara en la 11.ª —el límite de `login`— el
        // informe lo dice sin tener que reproducirlo.
        expect({ numero, status: response.status }).toEqual({ numero, status: 200 });
        expect(Object.keys(response.body as object).sort()).toEqual(TREE_KEYS);
      }
    },
    TIMEOUT_LARGO,
  );

  it(
    'superado el límite de workspace responde 429 con forma ErrorResponseDto',
    async () => {
      for (let numero = 1; numero <= THROTTLE_LIMITS.workspace.limit; numero += 1) {
        const response = await tree();

        expect({ numero, status: response.status }).toEqual({ numero, status: 200 });
      }

      const bloqueada = await tree().expect(429);

      expectErrorDto(bloqueada, 429);
    },
    TIMEOUT_LARGO,
  );

  it(
    'agotar el cupo de workspace no afecta a los endpoints de auth, que conservan el suyo',
    async () => {
      for (let numero = 1; numero <= THROTTLE_LIMITS.workspace.limit; numero += 1) {
        await tree();
      }

      await tree().expect(429);

      // Mismo IP, mismo minuto: el login sigue contestando con **su** error (`401`), no con el
      // `429` del cupo del workspace. Contadores separados en Redis, no uno compartido.
      const login = await loginDesconocido().expect(401);

      expectErrorDto(login, 401);
    },
    TIMEOUT_LARGO,
  );

  it(
    'y al revés: agotar el cupo de login no frena la lectura del árbol',
    async () => {
      for (let intento = 0; intento < THROTTLE_LIMITS.login.limit; intento += 1) {
        await loginDesconocido().expect(401);
      }

      await loginDesconocido().expect(429);

      const arbol = await tree().expect(200);

      expect(Object.keys(arbol.body as object).sort()).toEqual(TREE_KEYS);
    },
    TIMEOUT_LARGO,
  );

  it(
    'la sonda de salud queda fuera de todos los throttlers aunque el cupo esté agotado',
    async () => {
      for (let numero = 1; numero <= THROTTLE_LIMITS.workspace.limit; numero += 1) {
        await tree();
      }

      await tree().expect(429);
      await request(app.getHttpServer()).get('/api/health').expect(200);
    },
    TIMEOUT_LARGO,
  );
});
