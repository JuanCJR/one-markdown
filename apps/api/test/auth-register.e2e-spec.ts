import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  REFRESH_COOKIE,
  refreshCookieHeader,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

const VALID_PASSWORD = 'contrasena-valida-1';

describe('POST /api/auth/register (e2e) — AC-1, AC-2, AC-3, AC-4', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];
  const userIds: string[] = [];

  /** Registra el correo para poder limpiarlo al final aunque el caso falle a mitad. */
  function email(prefix: string): string {
    const value = uniqueEmail(prefix);
    emails.push(value);
    return value;
  }

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

  describe('AC-1: alta válida', () => {
    it('responde 201 con exactamente las claves de AuthSessionResponseDto', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: email('ok'), password: VALID_PASSWORD, displayName: 'Ada' })
        .expect(201);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'accessToken',
        'expiresInSeconds',
        'tokenType',
        'user',
      ]);
      expect(response.body.tokenType).toBe('Bearer');
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(0);
      expect(typeof response.body.expiresInSeconds).toBe('number');

      userIds.push(response.body.user.id);
    });

    it('el user devuelto tiene las claves de UserResponseDto y ningún secreto', async () => {
      const address = email('user-shape');

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: address, password: VALID_PASSWORD })
        .expect(201);

      expect(Object.keys(response.body.user as object).sort()).toEqual([
        'createdAt',
        'displayName',
        'email',
        'id',
        'mfaEnabled',
      ]);
      expect(response.body.user.email).toBe(address);
      // Decisión 10 del plan: `null` explícito, no ausencia de propiedad.
      expect(response.body.user.displayName).toBeNull();
      expect(response.body.user.mfaEnabled).toBe(false);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('mfaSecret');
      expect(serialized).not.toContain(VALID_PASSWORD);

      userIds.push(response.body.user.id);
    });

    it('emite la cookie de refresh con HttpOnly, SameSite=Strict y Path=/api/auth', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: email('cookie'), password: VALID_PASSWORD })
        .expect(201);

      const cookie = refreshCookieHeader(response);

      expect(cookie).not.toBeNull();
      expect(cookie).toContain(`${REFRESH_COOKIE}=`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/auth');

      userIds.push(response.body.user.id);
    });

    it('normaliza el correo a minúsculas y sin espacios', async () => {
      const address = email('normaliza');

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: `  ${address.toUpperCase()}  `, password: VALID_PASSWORD })
        .expect(201);

      expect(response.body.user.email).toBe(address);

      userIds.push(response.body.user.id);
    });
  });

  describe('AC-4: la contraseña se guarda hasheada con bcrypt', () => {
    it('la fila tiene un hash $2b$ que valida con la contraseña enviada', async () => {
      const address = email('hash');

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: address, password: VALID_PASSWORD })
        .expect(201);

      userIds.push(response.body.user.id);

      const row = await prisma.user.findUnique({ where: { email: address } });

      expect(row).not.toBeNull();
      expect(row?.passwordHash.startsWith('$2b$')).toBe(true);
      expect(row?.passwordHash).not.toBe(VALID_PASSWORD);
      expect(await bcrypt.compare(VALID_PASSWORD, row?.passwordHash ?? '')).toBe(true);
      expect(await bcrypt.compare('otra-contrasena-9', row?.passwordHash ?? '')).toBe(false);
      expect(row?.mfaSecret).toBeNull();
      expect(row?.mfaEnabled).toBe(false);
    });
  });

  describe('AC-2: correo ya registrado', () => {
    it('responde 409 con ErrorResponseDto y deja una sola fila, aun con otra caja', async () => {
      const address = email('duplicado');

      const first = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: address, password: VALID_PASSWORD })
        .expect(201);

      userIds.push(first.body.user.id);

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: address.toUpperCase(), password: VALID_PASSWORD })
        .expect(409);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'error',
        'message',
        'path',
        'statusCode',
        'timestamp',
      ]);
      expect(response.body.statusCode).toBe(409);
      expect(await prisma.user.count({ where: { email: address } })).toBe(1);
    });
  });

  describe('AC-3: validación de entrada', () => {
    it.each([
      ['correo inválido', { email: 'no-es-un-correo', password: VALID_PASSWORD }, 'email'],
      ['contraseña de 11 caracteres', { email: 'x@example.test', password: 'abcdefghij1' }, 'password'],
      ['contraseña sin dígito', { email: 'x@example.test', password: 'sin-digitos-aqui' }, 'password'],
      ['contraseña sin letra', { email: 'x@example.test', password: '123456789012' }, 'password'],
    ])('responde 400 nombrando el campo cuando hay %s', async (_caso, body, campo) => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(body)
        .expect(400);

      expect(JSON.stringify(response.body.message)).toContain(campo);
      expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
    });

    it('responde 400 y nombra la propiedad no declarada', async () => {
      const address = email('extra');

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: address, password: VALID_PASSWORD, isAdmin: true })
        .expect(400);

      expect(JSON.stringify(response.body.message)).toContain('isAdmin');
      expect(await prisma.user.count({ where: { email: address } })).toBe(0);
    });

    it('responde 400 cuando falta la contraseña, sin crear el usuario', async () => {
      const address = email('sin-password');

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: address })
        .expect(400);

      expect(await prisma.user.count({ where: { email: address } })).toBe(0);
    });
  });
});
