import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteLoginAttemptKeys,
  deleteUsersByEmail,
  REFRESH_COOKIE,
  refreshCookieHeader,
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
/** TTL del `mfaToken` y de su desafío (plan §3 y §6): 5 minutos. */
const MFA_TOKEN_TTL_SECONDS = 300;
/** Cinco intentos por desafío (AC-17). */
const MAX_ATTEMPTS = 5;

describe('Login con segundo factor (e2e) — AC-16, AC-17, AC-18', () => {
  let app: INestApplication;
  const emails: string[] = [];
  const userIds: string[] = [];
  const jtis: string[] = [];

  beforeAll(async () => {
    app = await createAuthApp();
  });

  afterAll(async () => {
    await deleteMfaChallengeKeys(app, jtis);
    await deleteMfaSetupKeys(app, userIds);
    await deleteLoginAttemptKeys(app, emails);
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await app.close();
  });

  async function enroll(prefix: string): Promise<EnrolledMfaUser> {
    const user = await enrollMfaUser(app, prefix, VALID_PASSWORD);
    emails.push(user.email);
    userIds.push(user.id);

    return user;
  }

  function login(email: string, password = VALID_PASSWORD): request.Test {
    return request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  }

  function verify(body: object): request.Test {
    return request(app.getHttpServer()).post('/api/auth/mfa/verify').send(body);
  }

  /** Login de un usuario con MFA: devuelve el `mfaToken` y lo apunta para limpiar su clave. */
  async function challenge(user: EnrolledMfaUser): Promise<string> {
    const response = await login(user.email).expect(200);
    const mfaToken = String(response.body.mfaToken);

    jtis.push(await mfaChallengeJti(app, mfaToken));

    return mfaToken;
  }

  describe('POST /api/auth/login con MFA activo (AC-16)', () => {
    it('responde 200 con mfaRequired, session null y mfaToken, SIN cookie de refresh', async () => {
      const user = await enroll('mfalogin-reto');

      const response = await login(user.email).expect(200);

      expect(response.body.mfaRequired).toBe(true);
      expect(response.body.session).toBeNull();
      expect(typeof response.body.mfaToken).toBe('string');
      expect(response.body.mfaTokenExpiresInSeconds).toBe(MFA_TOKEN_TTL_SECONDS);
      // Sin sesión no hay cookie: el navegador no debe quedarse con nada que sirva para refrescar.
      expect(refreshCookieHeader(response)).toBeNull();

      jtis.push(await mfaChallengeJti(app, String(response.body.mfaToken)));
    });

    it('mantiene las claves exactas de LoginResponseDto', async () => {
      const user = await enroll('mfalogin-claves');

      const response = await login(user.email).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'mfaRequired',
        'mfaToken',
        'mfaTokenExpiresInSeconds',
        'session',
      ]);
      jtis.push(await mfaChallengeJti(app, String(response.body.mfaToken)));
    });

    it('con la contraseña incorrecta responde 401 y no emite ningún mfaToken', async () => {
      const user = await enroll('mfalogin-password');

      const response = await login(user.email, 'contrasena-erronea-2').expect(401);

      expect(response.body.mfaToken).toBeUndefined();
    });

    it('el mfaToken no sirve como Bearer: no es una sesión', async () => {
      const user = await enroll('mfalogin-no-bearer');
      const mfaToken = await challenge(user);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${mfaToken}`)
        .expect(401);
    });
  });

  describe('POST /api/auth/mfa/verify con TOTP (AC-17)', () => {
    it('con el código correcto responde 200 con sesión y cookie de refresh', async () => {
      const user = await enroll('mfaverify-ok');
      const mfaToken = await challenge(user);

      const response = await verify({
        mfaToken,
        code: await currentTotpCode(app, user.secret),
      }).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'accessToken',
        'expiresInSeconds',
        'tokenType',
        'user',
      ]);
      expect(response.body.user.id).toBe(user.id);
      expect(response.body.user.mfaEnabled).toBe(true);

      const cookie = refreshCookieHeader(response);
      expect(cookie).toContain(`${REFRESH_COOKIE}=`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/auth');
    });

    it('la sesión emitida sirve de verdad: su cookie rota en /api/auth/refresh', async () => {
      const user = await enroll('mfaverify-sesion');
      const mfaToken = await challenge(user);

      const verified = await verify({
        mfaToken,
        code: await currentTotpCode(app, user.secret),
      }).expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookieHeader(verified)?.split(';')[0] ?? '')
        .expect(200);
    });

    it('con un código incorrecto responde 401 sin abrir sesión', async () => {
      const user = await enroll('mfaverify-401');
      const mfaToken = await challenge(user);

      const response = await verify({
        mfaToken,
        code: await wrongTotpCode(app, user.secret),
      }).expect(401);

      expect(refreshCookieHeader(response)).toBeNull();
    });

    it('el mfaToken se gasta al verificar: el mismo no vale dos veces', async () => {
      const user = await enroll('mfaverify-un-uso');
      const mfaToken = await challenge(user);

      await verify({ mfaToken, code: await currentTotpCode(app, user.secret) }).expect(200);
      await verify({ mfaToken, code: await currentTotpCode(app, user.secret) }).expect(401);
    });

    // AC-17: cinco fallos matan el desafío. El sexto intento es 401 aunque el código sea el bueno.
    it(`tras ${String(MAX_ATTEMPTS)} fallos, el código CORRECTO también responde 401`, async () => {
      const user = await enroll('mfaverify-agotado');
      const mfaToken = await challenge(user);
      const malo = await wrongTotpCode(app, user.secret);

      for (let intento = 0; intento < MAX_ATTEMPTS; intento += 1) {
        await verify({ mfaToken, code: malo }).expect(401);
      }

      await verify({ mfaToken, code: await currentTotpCode(app, user.secret) }).expect(401);
    });

    it('un login nuevo da un desafío limpio tras agotar el anterior', async () => {
      const user = await enroll('mfaverify-reintento');
      const agotado = await challenge(user);
      const malo = await wrongTotpCode(app, user.secret);

      for (let intento = 0; intento < MAX_ATTEMPTS; intento += 1) {
        await verify({ mfaToken: agotado, code: malo }).expect(401);
      }

      const nuevo = await challenge(user);
      await verify({ mfaToken: nuevo, code: await currentTotpCode(app, user.secret) }).expect(200);
    });

    it('un mfaToken forjado o expirado responde 401', async () => {
      const user = await enroll('mfaverify-forjado');
      const mfaToken = await challenge(user);
      const [header, payload, signature] = mfaToken.split('.');

      // Misma forma, firma alterada: el token tiene que morir en la verificación de firma.
      await verify({
        mfaToken: `${String(header)}.${String(payload)}.${(signature ?? '').slice(0, -2)}xy`,
        code: await currentTotpCode(app, user.secret),
      }).expect(401);
    });

    it('el mfaToken de OTRO usuario no abre la sesión de este', async () => {
      const uno = await enroll('mfaverify-cruzado-1');
      const otro = await enroll('mfaverify-cruzado-2');
      const tokenDeOtro = await challenge(otro);

      // El código correcto de `uno` con el desafío de `otro`: ninguna de las dos cuentas debe abrirse.
      await verify({ tokenDeOtro, code: await currentTotpCode(app, uno.secret) }).expect(400);
      await verify({
        mfaToken: tokenDeOtro,
        code: await currentTotpCode(app, uno.secret),
      }).expect(401);
    });
  });

  describe('POST /api/auth/mfa/verify con código de recuperación (AC-18)', () => {
    it('un código de recuperación válido abre la sesión', async () => {
      const user = await enroll('mfarecovery-ok');
      const mfaToken = await challenge(user);
      const code = user.recoveryCodes[0] ?? '';

      const response = await verify({ mfaToken, code }).expect(200);

      expect(response.body.user.id).toBe(user.id);
      expect(refreshCookieHeader(response)).not.toBeNull();
    });

    it('el mismo código de recuperación NO vale una segunda vez (uso único)', async () => {
      const user = await enroll('mfarecovery-un-uso');
      const code = user.recoveryCodes[0] ?? '';

      await verify({ mfaToken: await challenge(user), code }).expect(200);
      await verify({ mfaToken: await challenge(user), code }).expect(401);
    });

    it('sella usedAt en la fila del código gastado y deja los otros siete intactos', async () => {
      const user = await enroll('mfarecovery-sellado');
      const code = user.recoveryCodes[0] ?? '';

      await verify({ mfaToken: await challenge(user), code }).expect(200);

      const rows = await app
        .get(PrismaService)
        .mfaRecoveryCode.findMany({ where: { userId: user.id } });

      expect(rows.filter((row) => row.usedAt !== null)).toHaveLength(1);
      expect(rows.filter((row) => row.usedAt === null)).toHaveLength(7);
    });

    it('los otros códigos siguen sirviendo después de gastar uno', async () => {
      const user = await enroll('mfarecovery-resto');

      await verify({
        mfaToken: await challenge(user),
        code: user.recoveryCodes[0] ?? '',
      }).expect(200);
      await verify({
        mfaToken: await challenge(user),
        code: user.recoveryCodes[1] ?? '',
      }).expect(200);
    });

    it('un código de recuperación de otro usuario responde 401', async () => {
      const uno = await enroll('mfarecovery-cruzado-1');
      const otro = await enroll('mfarecovery-cruzado-2');

      await verify({
        mfaToken: await challenge(uno),
        code: otro.recoveryCodes[0] ?? '',
      }).expect(401);
    });

    it('un código con formato válido pero inexistente responde 401', async () => {
      const user = await enroll('mfarecovery-inexistente');

      await verify({ mfaToken: await challenge(user), code: 'ZZZZ-ZZZZ' }).expect(401);
    });
  });

  describe('validación de entrada de mfa/verify', () => {
    it.each([
      [{}, 'mfaToken'],
      [{ code: '123456' }, 'mfaToken'],
      [{ mfaToken: 'no-es-un-jwt', code: '123456' }, 'mfaToken'],
    ])('responde 400 nombrando el campo ante %p', async (body, campo) => {
      const response = await verify(body).expect(400);

      expect(JSON.stringify(response.body.message)).toContain(campo);
    });

    it.each(['12345', '1234567', 'abcdef', 'AAAA_AAAA', ''])(
      'responde 400 cuando el código tiene la forma %p',
      async (code) => {
        const user = await enroll('mfaverify-400');

        const response = await verify({ mfaToken: await challenge(user), code }).expect(400);

        expect(JSON.stringify(response.body.message)).toContain('code');
      },
    );

    it('responde 400 ante una propiedad no declarada', async () => {
      const user = await enroll('mfaverify-extra');

      const response = await verify({
        mfaToken: await challenge(user),
        code: '123456',
        userId: user.id,
      }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('userId');
    });
  });
});
