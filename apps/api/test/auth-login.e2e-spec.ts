import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import {
  createAuthApp,
  deleteAuthKeys,
  deleteLoginAttemptKeys,
  deleteUsersByEmail,
  REFRESH_COOKIE,
  refreshCookieHeader,
  uniqueEmail,
} from './fixtures/auth-e2e';

const VALID_PASSWORD = 'contrasena-valida-1';
const WRONG_PASSWORD = 'contrasena-erronea-2';
const ACCESS_SECRET = process.env['JWT_ACCESS_SECRET'] ?? '';

describe('POST /api/auth/login (e2e) — AC-5, AC-6, AC-7', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const emails: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    app = await createAuthApp();
  });

  afterAll(async () => {
    await deleteLoginAttemptKeys(app, emails);
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await app.close();
  });

  /** Registra un usuario nuevo y devuelve su correo. Cada caso trabaja sobre su propia cuenta. */
  async function registerUser(prefix: string): Promise<string> {
    const email = uniqueEmail(prefix);
    emails.push(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    userIds.push(response.body.user.id);

    return email;
  }

  function login(email: string, password: string): request.Test {
    return request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  }

  describe('AC-5: credenciales correctas sin segundo factor', () => {
    it('responde 200 con exactamente las claves de LoginResponseDto', async () => {
      const email = await registerUser('login-ok');

      const response = await login(email, VALID_PASSWORD).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'mfaRequired',
        'mfaToken',
        'mfaTokenExpiresInSeconds',
        'session',
      ]);
      expect(response.body.mfaRequired).toBe(false);
      // Decisión 10 del plan: `null` explícito, nunca ausencia de propiedad.
      expect(response.body.mfaToken).toBeNull();
      expect(response.body.mfaTokenExpiresInSeconds).toBeNull();
      expect(Object.keys(response.body.session as object).sort()).toEqual([
        'accessToken',
        'expiresInSeconds',
        'tokenType',
        'user',
      ]);
      expect(response.body.session.user.email).toBe(email);
    });

    it('el accessToken verifica con JWT_ACCESS_SECRET y trae sub, sid y typ', async () => {
      const email = await registerUser('login-token');

      const response = await login(email, VALID_PASSWORD).expect(200);

      const payload = await jwt.verifyAsync<Record<string, unknown>>(
        response.body.session.accessToken,
        { secret: ACCESS_SECRET },
      );

      expect(payload['sub']).toBe(response.body.session.user.id);
      expect(typeof payload['sid']).toBe('string');
      expect(payload['typ']).toBe('access');
    });

    it('emite la cookie de refresh con HttpOnly, SameSite=Strict y Path=/api/auth', async () => {
      const email = await registerUser('login-cookie');

      const response = await login(email, VALID_PASSWORD).expect(200);
      const cookie = refreshCookieHeader(response);

      expect(cookie).toContain(`${REFRESH_COOKIE}=`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/auth');
    });

    it('acepta el correo en otra caja y no filtra secretos en la respuesta', async () => {
      const email = await registerUser('login-caja');

      const response = await login(email.toUpperCase(), VALID_PASSWORD).expect(200);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('mfaSecret');
      expect(serialized).not.toContain(VALID_PASSWORD);
    });
  });

  describe('AC-6: no se puede saber si la cuenta existe', () => {
    it('contraseña incorrecta y correo inexistente dan el MISMO 401', async () => {
      const email = await registerUser('login-uniforme');
      const inexistente = uniqueEmail('login-fantasma');
      emails.push(inexistente);

      const conPasswordMala = await login(email, WRONG_PASSWORD).expect(401);
      const conCorreoInexistente = await login(inexistente, VALID_PASSWORD).expect(401);

      expect(conPasswordMala.body.message).toEqual(conCorreoInexistente.body.message);
      expect(conPasswordMala.body.error).toEqual(conCorreoInexistente.body.error);
      expect(Object.keys(conPasswordMala.body as object).sort()).toEqual(
        Object.keys(conCorreoInexistente.body as object).sort(),
      );
      expect(JSON.stringify(conPasswordMala.body.message)).not.toContain(email);
    });

    it('el 401 tiene la forma de ErrorResponseDto', async () => {
      const inexistente = uniqueEmail('login-forma');
      emails.push(inexistente);

      const response = await login(inexistente, VALID_PASSWORD).expect(401);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'error',
        'message',
        'path',
        'statusCode',
        'timestamp',
      ]);
      expect(response.body.statusCode).toBe(401);
    });
  });

  describe('AC-7: bloqueo por cuenta tras cinco fallos', () => {
    it('al sexto intento responde 429 aun con la contraseña CORRECTA', async () => {
      const email = await registerUser('login-bloqueo');

      for (let intento = 0; intento < 5; intento += 1) {
        await login(email, WRONG_PASSWORD).expect(401);
      }

      const response = await login(email, VALID_PASSWORD).expect(429);

      expect(typeof response.body.retryAfterSeconds).toBe('number');
      expect(response.body.retryAfterSeconds).toBeGreaterThan(0);
      expect(response.headers['retry-after']).toBe(String(response.body.retryAfterSeconds));
    });

    it('un login correcto antes del quinto fallo pone el contador a cero', async () => {
      const email = await registerUser('login-reset');

      for (let intento = 0; intento < 4; intento += 1) {
        await login(email, WRONG_PASSWORD).expect(401);
      }

      await login(email, VALID_PASSWORD).expect(200);

      // Si el contador no se hubiera reseteado, el primero de estos cuatro fallos sería el quinto
      // y el login final saldría 429 en vez de 200.
      for (let intento = 0; intento < 4; intento += 1) {
        await login(email, WRONG_PASSWORD).expect(401);
      }

      await login(email, VALID_PASSWORD).expect(200);
    });
  });

  describe('validación de entrada', () => {
    it('responde 400 nombrando el campo cuando el correo no es válido', async () => {
      const response = await login('no-es-un-correo', VALID_PASSWORD).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('email');
    });

    it('responde 400 ante una propiedad no declarada', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ada@example.test', password: VALID_PASSWORD, admin: true })
        .expect(400);

      expect(JSON.stringify(response.body.message)).toContain('admin');
    });
  });
});
