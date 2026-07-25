import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { THROTTLE_LIMITS } from '../src/common/throttle';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteLoginAttemptKeys,
  deleteUsersByEmail,
  refreshCookieHeader,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';
import {
  currentTotpCode,
  deleteMfaChallengeKeys,
  deleteMfaSetupKeys,
  type EnrolledMfaUser,
  enrollMfaUser,
  mfaChallengeJti,
  wrongTotpCode,
} from './fixtures/mfa-e2e';

const VALID_PASSWORD = 'contrasena-valida-1';
/** Formato de recuperación válido que no existe en la base: fuerza la comparación de los ocho hashes. */
const WRONG_RECOVERY_CODE = 'ZZZZ-ZZZZ';
const ERROR_KEYS = ['error', 'message', 'path', 'statusCode', 'timestamp'];

/**
 * Rate limit por IP (AC-20).
 *
 * Cierra tres huecos que el bloqueo por cuenta no puede cerrar, porque no cuenta más que fallos de
 * contraseña de un correo concreto:
 *
 * 1. `mfa/disable` sin límite: con un access token robado se pueden probar los 10^6 TOTP.
 * 2. `mfa/verify` limita a cinco intentos **por desafío**, y los desafíos eran gratis: bastaba pedir
 *    un login nuevo cada cinco intentos.
 * 3. `RecoveryCodeService.consume` compara hasta ocho hashes bcrypt por petición (~2 s de CPU con
 *    `BCRYPT_ROUNDS=12`): un amplificador de DoS en un endpoint sin freno.
 *
 * Los contadores se ponen a cero antes de cada caso: el límite es por IP y aquí se agota a propósito.
 */
describe('Rate limit por IP con storage en Redis (e2e) — AC-20', () => {
  let app: INestApplication;
  /** Segunda instancia de la app sobre el mismo Redis: es lo que un store en memoria no compartiría. */
  let otraInstancia: INestApplication;
  let enrolled: EnrolledMfaUser;
  const emails: string[] = [];
  const userIds: string[] = [];
  const jtis: string[] = [];

  beforeAll(async () => {
    app = await createAuthApp();
    otraInstancia = await createAuthApp();

    enrolled = await enrollMfaUser(app, 'throttle-mfa', VALID_PASSWORD);
    emails.push(enrolled.email);
    userIds.push(enrolled.id);
  });

  afterAll(async () => {
    await deleteMfaChallengeKeys(app, jtis);
    await deleteMfaSetupKeys(app, userIds);
    await deleteLoginAttemptKeys(app, emails);
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await resetThrottleCounters(app);
    await otraInstancia.close();
    await app.close();
  });

  beforeEach(async () => {
    await resetThrottleCounters(app);
  });

  /** Login de un correo que no existe: cuenta para el límite por IP sin bloquear ninguna cuenta. */
  function loginDesconocido(instancia: INestApplication = app): request.Test {
    const email = uniqueEmail('throttle-login');
    emails.push(email);

    return request(instancia.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: VALID_PASSWORD });
  }

  function esperarErrorDto(response: request.Response, statusCode: number): void {
    expect(Object.keys(response.body as object).sort()).toEqual(ERROR_KEYS);
    expect(response.body.statusCode).toBe(statusCode);
  }

  describe(`POST /api/auth/login (login: ${String(THROTTLE_LIMITS.login.limit)} por minuto)`, () => {
    it('al superar el límite responde 429 con forma ErrorResponseDto', async () => {
      for (let intento = 0; intento < THROTTLE_LIMITS.login.limit; intento += 1) {
        await loginDesconocido().expect(401);
      }

      const bloqueada = await loginDesconocido().expect(429);

      esperarErrorDto(bloqueada, 429);
      expect(typeof bloqueada.body.message).toBe('string');
    });

    // El 429 del throttler y el del bloqueo por cuenta (AC-7) son distintos: solo el segundo sabe
    // cuánto dura el castigo, y solo el segundo lleva `Retry-After` y `retryAfterSeconds`.
    it('el 429 del límite por IP no se confunde con el del bloqueo por cuenta', async () => {
      for (let intento = 0; intento < THROTTLE_LIMITS.login.limit; intento += 1) {
        await loginDesconocido().expect(401);
      }

      const bloqueada = await loginDesconocido().expect(429);

      expect(bloqueada.body.retryAfterSeconds).toBeUndefined();
      expect(bloqueada.headers['retry-after']).toBeUndefined();
    });

    it('no emite cookie de refresh en el 429', async () => {
      for (let intento = 0; intento < THROTTLE_LIMITS.login.limit; intento += 1) {
        await loginDesconocido().expect(401);
      }

      const bloqueada = await loginDesconocido().expect(429);

      expect(refreshCookieHeader(bloqueada)).toBeNull();
    });

    // El corazón de AC-20: el contador vive en Redis, no en el proceso.
    it('dos instancias del API sobre el mismo Redis comparten el contador', async () => {
      const mitad = Math.floor(THROTTLE_LIMITS.login.limit / 2);

      for (let intento = 0; intento < mitad; intento += 1) {
        await loginDesconocido(app).expect(401);
      }
      for (let intento = mitad; intento < THROTTLE_LIMITS.login.limit; intento += 1) {
        await loginDesconocido(otraInstancia).expect(401);
      }

      // Con un store en memoria cada instancia llevaría su propia cuenta y ésta seguiría siendo 401.
      await loginDesconocido(otraInstancia).expect(429);
    });
  });

  describe(`POST /api/auth/register (register: ${String(THROTTLE_LIMITS.register.limit)} por ventana)`, () => {
    /** Cuerpo inválido: el límite tiene que contar la petición antes de validarla. */
    function registroInvalido(): request.Test {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'no-es-un-correo', password: 'corta' });
    }

    it('cuenta también las peticiones que la validación rechaza y acaba en 429', async () => {
      for (let intento = 0; intento < THROTTLE_LIMITS.register.limit; intento += 1) {
        await registroInvalido().expect(400);
      }

      const bloqueada = await registroInvalido().expect(429);

      esperarErrorDto(bloqueada, 429);
      // El guard corre antes del `ValidationPipe`: el mensaje ya no habla de campos inválidos.
      expect(JSON.stringify(bloqueada.body.message)).not.toContain('email');
    });
  });

  describe(`MFA (mfa: ${String(THROTTLE_LIMITS.mfa.limit)} por minuto para setup, enable, verify y disable)`, () => {
    function disable(code: string): request.Test {
      return request(app.getHttpServer())
        .post('/api/auth/mfa/disable')
        .set('Authorization', `Bearer ${enrolled.accessToken}`)
        .send({ password: VALID_PASSWORD, code });
    }

    function verify(mfaToken: string, code: string): request.Test {
      return request(app.getHttpServer()).post('/api/auth/mfa/verify').send({ mfaToken, code });
    }

    /** Abre un desafío nuevo (login con MFA activo) y devuelve su `mfaToken`. */
    async function nuevoDesafio(): Promise<string> {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: enrolled.email, password: VALID_PASSWORD })
        .expect(200);

      const mfaToken = String(response.body.mfaToken);
      jtis.push(await mfaChallengeJti(app, mfaToken));

      return mfaToken;
    }

    // Hueco 1 (y 3): `disable` no tenía límite de ninguna clase. `LoginAttemptService` solo cuenta
    // fallos de login, así que con un access token robado el TOTP y la contraseña se podían probar sin
    // fricción, y cada intento con formato de recuperación quemaba ocho comparaciones bcrypt.
    it('mfa/disable deja de aceptar intentos al superar el límite', async () => {
      for (let intento = 0; intento < THROTTLE_LIMITS.mfa.limit; intento += 1) {
        await disable(WRONG_RECOVERY_CODE).expect(401);
      }

      const bloqueada = await disable(WRONG_RECOVERY_CODE).expect(429);

      esperarErrorDto(bloqueada, 429);
    });

    // Hueco 2: cinco intentos por desafío no limitan nada si los desafíos son gratis. Aquí se pide un
    // desafío nuevo a mitad de camino, exactamente como lo haría el atacante.
    it('mfa/verify no da intentos infinitos aunque se pidan desafíos nuevos', async () => {
      const mitad = Math.floor(THROTTLE_LIMITS.mfa.limit / 2);
      const malo = await wrongTotpCode(app, enrolled.secret);
      let mfaToken = await nuevoDesafio();

      for (let intento = 0; intento < THROTTLE_LIMITS.mfa.limit; intento += 1) {
        if (intento === mitad) {
          mfaToken = await nuevoDesafio();
        }

        await verify(mfaToken, malo).expect(401);
      }

      const bloqueada = await verify(await nuevoDesafio(), malo).expect(429);

      esperarErrorDto(bloqueada, 429);
    });

    it('los cuatro endpoints de MFA comparten un único cupo por IP', async () => {
      const mitad = Math.floor(THROTTLE_LIMITS.mfa.limit / 2);
      const malo = await wrongTotpCode(app, enrolled.secret);
      const mfaToken = await nuevoDesafio();

      for (let intento = 0; intento < mitad; intento += 1) {
        await verify(mfaToken, malo).expect(401);
      }
      for (let intento = mitad; intento < THROTTLE_LIMITS.mfa.limit; intento += 1) {
        await disable(WRONG_RECOVERY_CODE).expect(401);
      }

      // Si cada endpoint tuviera su propio contador, éste seguiría teniendo cupo de sobra.
      await request(app.getHttpServer())
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${enrolled.accessToken}`)
        .expect(429);
    });

    it('el segundo factor sigue funcionando por debajo del límite', async () => {
      const mfaToken = await nuevoDesafio();

      await verify(mfaToken, await currentTotpCode(app, enrolled.secret)).expect(200);
    });
  });

  describe('el readiness no puede tener rate limit (@SkipThrottle)', () => {
    it('GET /api/health responde 200 muchas más veces que el límite más bajo', async () => {
      const peticiones = THROTTLE_LIMITS.register.limit * 4;

      for (let intento = 0; intento < peticiones; intento += 1) {
        await request(app.getHttpServer()).get('/api/health').expect(200);
      }
    });

    it('GET /api/health no expone cabeceras de rate limit', async () => {
      const response = await request(app.getHttpServer()).get('/api/health').expect(200);

      const cabeceras = Object.keys(response.headers).filter((name) =>
        name.toLowerCase().startsWith('x-ratelimit'),
      );

      expect(cabeceras).toEqual([]);
    });

    it('GET /api/health/ready tampoco se limita', async () => {
      const peticiones = THROTTLE_LIMITS.register.limit + 2;

      for (let intento = 0; intento < peticiones; intento += 1) {
        await request(app.getHttpServer()).get('/api/health/ready').expect(200);
      }
    });
  });
});
