import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  REFRESH_COOKIE,
  refreshCookieHeader,
  refreshCookiePair,
  refreshCookieValue,
  uniqueEmail,
} from './fixtures/auth-e2e';

const VALID_PASSWORD = 'contrasena-valida-1';

describe('POST /api/auth/refresh y /api/auth/logout (e2e) — AC-9, AC-10, AC-11', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const emails: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    app = await createAuthApp();
  });

  afterAll(async () => {
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await app.close();
  });

  /** Registra un usuario y devuelve el par `om_refresh=<jwt>` listo para reenviar. */
  async function register(prefix: string): Promise<{ cookie: string; userId: string }> {
    const email = uniqueEmail(prefix);
    emails.push(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    userIds.push(response.body.user.id);

    return { cookie: refreshCookiePair(response), userId: response.body.user.id };
  }

  function refresh(cookie?: string): request.Test {
    const req = request(app.getHttpServer()).post('/api/auth/refresh');
    return cookie === undefined ? req : req.set('Cookie', cookie);
  }

  function logout(cookie?: string): request.Test {
    const req = request(app.getHttpServer()).post('/api/auth/logout');
    return cookie === undefined ? req : req.set('Cookie', cookie);
  }

  function jtiOf(refreshToken: string): unknown {
    return jwt.decode<Record<string, unknown>>(refreshToken)['jti'];
  }

  describe('AC-9: rotación', () => {
    it('responde 200 con AuthSessionResponseDto y una cookie de jti distinto', async () => {
      const { cookie } = await register('refresh-ok');
      const anterior = cookie.slice(REFRESH_COOKIE.length + 1);

      const response = await refresh(cookie).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'accessToken',
        'expiresInSeconds',
        'tokenType',
        'user',
      ]);
      expect(typeof response.body.accessToken).toBe('string');

      const nuevo = refreshCookieValue(response);
      expect(nuevo).not.toBe(anterior);
      expect(jtiOf(nuevo)).not.toBe(jtiOf(anterior));
      expect(refreshCookieHeader(response)).toContain('HttpOnly');
      expect(refreshCookieHeader(response)).toContain('Path=/api/auth');
    });

    it('el sid se conserva entre rotaciones: es el mismo dispositivo', async () => {
      const { cookie } = await register('refresh-sid');
      const anterior = cookie.slice(REFRESH_COOKIE.length + 1);

      const response = await refresh(cookie).expect(200);
      const nuevo = refreshCookieValue(response);

      expect(jwt.decode<Record<string, unknown>>(nuevo)['sid']).toBe(
        jwt.decode<Record<string, unknown>>(anterior)['sid'],
      );
    });

    it('la cookie ANTERIOR ya no sirve tras rotar', async () => {
      const { cookie } = await register('refresh-anterior');

      await refresh(cookie).expect(200);
      await refresh(cookie).expect(401);
    });

    it('la cookie que mantiene el agente (Path=/api/auth) sirve sin reenviarla a mano', async () => {
      const email = uniqueEmail('refresh-agente');
      emails.push(email);
      const agent = request.agent(app.getHttpServer());

      const registro = await agent
        .post('/api/auth/register')
        .send({ email, password: VALID_PASSWORD })
        .expect(201);
      userIds.push(registro.body.user.id);

      await agent.post('/api/auth/refresh').expect(200);
    });
  });

  describe('AC-9 / AC-10: refresh rechazado', () => {
    it('responde 401 sin cookie', async () => {
      const response = await refresh().expect(401);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'error',
        'message',
        'path',
        'statusCode',
        'timestamp',
      ]);
    });

    it('responde 401 con una cookie que no es un JWT', async () => {
      await refresh(`${REFRESH_COOKIE}=no-soy-un-token`).expect(401);
    });

    it('responde 401 con un access token en la cookie de refresh', async () => {
      const email = uniqueEmail('refresh-cruzado');
      emails.push(email);

      const registro = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: VALID_PASSWORD })
        .expect(201);
      userIds.push(registro.body.user.id);

      await refresh(`${REFRESH_COOKIE}=${String(registro.body.accessToken)}`).expect(401);
    });

    // AC-10: reutilizar un refresh ya rotado es la señal de que se filtró; la familia entera cae.
    it('la reutilización revoca TODA la familia: la cookie más reciente también deja de servir', async () => {
      const { cookie: primera } = await register('refresh-reuso');

      const rotada = await refresh(primera).expect(200);
      const segunda = `${REFRESH_COOKIE}=${refreshCookieValue(rotada)}`;

      await refresh(primera).expect(401);
      await refresh(segunda).expect(401);
    });

    it('responde 400 si el cuerpo del refresh no está vacío', async () => {
      const { cookie } = await register('refresh-cuerpo');

      const response = await refresh(cookie).send({ token: 'algo' }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('token');
    });
  });

  describe('AC-11: logout', () => {
    it('responde 204 sin cuerpo, borra la cookie con Max-Age=0 e invalida el refresh', async () => {
      const { cookie } = await register('logout-ok');

      const response = await logout(cookie).expect(204);

      expect(response.body).toEqual({});
      expect(response.text).toBe('');

      const borrada = refreshCookieHeader(response);
      expect(borrada).toContain(`${REFRESH_COOKIE}=`);
      expect(borrada).toContain('Max-Age=0');
      expect(borrada).toContain('Path=/api/auth');
      expect(borrada).toContain('HttpOnly');

      await refresh(cookie).expect(401);
    });

    it('es idempotente: sin cookie también responde 204', async () => {
      await logout().expect(204);
      await logout(`${REFRESH_COOKIE}=no-soy-un-token`).expect(204);
    });

    it('cerrar una sesión no cierra las demás del mismo usuario', async () => {
      const email = uniqueEmail('logout-una-sesion');
      emails.push(email);

      const primera = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: VALID_PASSWORD })
        .expect(201);
      userIds.push(primera.body.user.id);

      const segunda = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: VALID_PASSWORD })
        .expect(200);

      await logout(refreshCookiePair(primera)).expect(204);

      await refresh(refreshCookiePair(primera)).expect(401);
      await refresh(refreshCookiePair(segunda)).expect(200);
    });
  });
});
