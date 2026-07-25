import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

const VALID_PASSWORD = 'contrasena-valida-1';
const ACCESS_SECRET = process.env['JWT_ACCESS_SECRET'] ?? '';
const REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] ?? '';

interface Registered {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

describe('GET /api/auth/me (e2e) — AC-8, AC-12', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const jwt = new JwtService();
  const emails: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    app = await createAuthApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await resetThrottleCounters(app);
    await app.close();
  });

  // El rate limit por IP (AC-20) es estado compartido: todas las peticiones de todos los archivos e2e
  // salen de la misma IP. Sin este reset, un caso heredaría el cupo gastado por el anterior.
  beforeEach(async () => {
    await resetThrottleCounters(app);
  });

  async function register(prefix: string): Promise<Registered> {
    const email = uniqueEmail(prefix);
    emails.push(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: VALID_PASSWORD, displayName: 'Ada' })
      .expect(201);

    userIds.push(response.body.user.id);

    return {
      userId: response.body.user.id,
      email,
      accessToken: response.body.accessToken,
      refreshToken: refreshCookieValue(response),
    };
  }

  function me(token?: string): request.Test {
    const req = request(app.getHttpServer()).get('/api/auth/me');
    return token === undefined ? req : req.set('Authorization', `Bearer ${token}`);
  }

  describe('AC-8: token válido', () => {
    it('responde 200 con exactamente las claves de UserResponseDto', async () => {
      const user = await register('me-ok');

      const response = await me(user.accessToken).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'createdAt',
        'displayName',
        'email',
        'id',
        'mfaEnabled',
      ]);
      expect(response.body.id).toBe(user.userId);
      expect(response.body.email).toBe(user.email);
      expect(response.body.displayName).toBe('Ada');
      expect(response.body.mfaEnabled).toBe(false);
      expect(new Date(response.body.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('el cuerpo no contiene passwordHash ni mfaSecret', async () => {
      const user = await register('me-secretos');

      const response = await me(user.accessToken).expect(200);
      const serialized = JSON.stringify(response.body);

      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('mfaSecret');
      expect(serialized).not.toContain('$2b$');
    });
  });

  describe('AC-8: token ausente, alterado o expirado', () => {
    it('responde 401 sin cabecera Authorization', async () => {
      const response = await me().expect(401);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'error',
        'message',
        'path',
        'statusCode',
        'timestamp',
      ]);
      expect(response.body.statusCode).toBe(401);
    });

    it('responde 401 con la firma alterada', async () => {
      const user = await register('me-firma');
      const [header, payload, signature] = user.accessToken.split('.');
      const alterado = `${String(header)}.${String(payload)}.${String(signature).slice(0, -4)}xxxx`;

      await me(alterado).expect(401);
    });

    it('responde 401 con un token expirado', async () => {
      const user = await register('me-expirado');
      const expirado = await jwt.signAsync(
        { sub: user.userId, sid: 'cualquiera', typ: 'access' },
        { secret: ACCESS_SECRET, expiresIn: -10 },
      );

      await me(expirado).expect(401);
    });

    it('responde 401 con un Bearer que no es un JWT', async () => {
      await me('no-soy-un-token').expect(401);
    });
  });

  describe('AC-12: los tokens no son intercambiables', () => {
    it('responde 401 con el refresh token usado como Bearer', async () => {
      const user = await register('me-refresh');

      await me(user.refreshToken).expect(401);
    });

    it('responde 401 con un token firmado con JWT_REFRESH_SECRET', async () => {
      const user = await register('me-secreto-cruzado');
      const cruzado = await jwt.signAsync(
        { sub: user.userId, sid: 'cualquiera', typ: 'access' },
        { secret: REFRESH_SECRET, expiresIn: 900 },
      );

      await me(cruzado).expect(401);
    });

    it('responde 401 cuando el claim typ no es access', async () => {
      const user = await register('me-typ');

      for (const typ of ['refresh', 'mfa', undefined]) {
        const token = await jwt.signAsync(
          { sub: user.userId, sid: 'cualquiera', ...(typ === undefined ? {} : { typ }) },
          { secret: ACCESS_SECRET, expiresIn: 900 },
        );

        await me(token).expect(401);
      }
    });
  });

  describe('decisión 12: el usuario se resuelve en la base en cada petición', () => {
    it('responde 401 con un token válido de un usuario ya borrado', async () => {
      const user = await register('me-borrado');

      await me(user.accessToken).expect(200);
      await prisma.user.delete({ where: { id: user.userId } });

      await me(user.accessToken).expect(401);
    });
  });
});
