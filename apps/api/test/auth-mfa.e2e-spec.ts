import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { MfaSecretCipher } from '../src/auth/mfa/mfa-secret.cipher';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteLoginAttemptKeys,
  deleteUsersByEmail,
  refreshCookieHeader,
  refreshCookiePair,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';
import {
  currentTotpCode,
  deleteMfaChallengeKeys,
  deleteMfaSetupKeys,
  mfaChallengeJti,
  wrongTotpCode,
} from './fixtures/mfa-e2e';

const VALID_PASSWORD = 'contrasena-valida-1';
/** TTL del enrolamiento pendiente en Redis (plan §6): 10 minutos. */
const SETUP_TTL_SECONDS = 600;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

interface RegisteredUser {
  readonly id: string;
  readonly email: string;
  readonly accessToken: string;
}

describe('MFA alta (e2e) — AC-13, AC-14, AC-15', () => {
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
    await resetThrottleCounters(app);
    await app.close();
  });

  // El rate limit por IP (AC-20) es estado compartido: todas las peticiones de todos los archivos e2e
  // salen de la misma IP. Sin este reset, un caso heredaría el cupo gastado por el anterior.
  beforeEach(async () => {
    await resetThrottleCounters(app);
  });

  /** Cada caso trabaja sobre su propia cuenta: los archivos e2e comparten base y no se trunca. */
  async function registerUser(prefix: string): Promise<RegisteredUser> {
    const email = uniqueEmail(prefix);
    emails.push(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    const id = String(response.body.user.id);
    userIds.push(id);

    return { id, email, accessToken: String(response.body.accessToken) };
  }

  function setup(accessToken: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/mfa/setup')
      .set('Authorization', `Bearer ${accessToken}`);
  }

  function enable(accessToken: string, body: object): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
  }

  async function userRow(id: string): Promise<{ mfaEnabled: boolean; mfaSecret: string | null }> {
    const row = await app.get(PrismaService).user.findUniqueOrThrow({ where: { id } });

    return { mfaEnabled: row.mfaEnabled, mfaSecret: row.mfaSecret };
  }

  /** Deja a un usuario con MFA activo y devuelve su secreto y sus códigos de recuperación. */
  async function enrollUser(prefix: string): Promise<{
    user: RegisteredUser;
    secret: string;
    recoveryCodes: string[];
  }> {
    const user = await registerUser(prefix);
    const setupResponse = await setup(user.accessToken).expect(200);
    const secret = String(setupResponse.body.secret);

    const enableResponse = await enable(user.accessToken, {
      code: await currentTotpCode(app, secret),
    }).expect(200);

    return { user, secret, recoveryCodes: enableResponse.body.recoveryCodes as string[] };
  }

  describe('POST /api/auth/mfa/setup (AC-13)', () => {
    it('responde 200 con exactamente las claves de MfaSetupResponseDto', async () => {
      const user = await registerUser('mfa-setup');

      const response = await setup(user.accessToken).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'expiresInSeconds',
        'otpauthUri',
        'qrCodeDataUrl',
        'secret',
      ]);
      expect(response.body.expiresInSeconds).toBe(SETUP_TTL_SECONDS);
    });

    it('el secret es base32 y el otpauthUri lleva el issuer y el correo', async () => {
      const user = await registerUser('mfa-setup-uri');

      const response = await setup(user.accessToken).expect(200);
      const legible = decodeURIComponent(String(response.body.otpauthUri));

      expect(response.body.secret).toMatch(/^[A-Z2-7]+$/);
      expect(String(response.body.otpauthUri).startsWith('otpauth://totp/')).toBe(true);
      expect(legible).toContain('One Markdown');
      expect(legible).toContain(user.email);
      expect(String(response.body.qrCodeDataUrl).startsWith('data:image/png;base64,')).toBe(true);
    });

    it('no toca la base: mfaEnabled sigue false y mfaSecret sigue nulo', async () => {
      const user = await registerUser('mfa-setup-sin-base');

      await setup(user.accessToken).expect(200);

      // El corazón de AC-13: un enrolamiento sin confirmar no deja rastro en la fila, solo en Redis.
      expect(await userRow(user.id)).toEqual({ mfaEnabled: false, mfaSecret: null });
    });

    it('dos setup seguidos emiten secretos distintos y el último es el que vale', async () => {
      const user = await registerUser('mfa-setup-dos');

      const primero = await setup(user.accessToken).expect(200);
      const segundo = await setup(user.accessToken).expect(200);

      expect(segundo.body.secret).not.toBe(primero.body.secret);

      // El secreto viejo ya no sirve: si sirviera, un enrolamiento abandonado quedaría vivo.
      await enable(user.accessToken, {
        code: await currentTotpCode(app, String(primero.body.secret)),
      }).expect(401);
      await enable(user.accessToken, {
        code: await currentTotpCode(app, String(segundo.body.secret)),
      }).expect(200);
    });

    it('sin Bearer responde 401', async () => {
      await request(app.getHttpServer()).post('/api/auth/mfa/setup').expect(401);
    });

    it('con MFA ya activo responde 409', async () => {
      const { user } = await enrollUser('mfa-setup-409');

      const response = await setup(user.accessToken).expect(409);

      expect(response.body.statusCode).toBe(409);
    });
  });

  describe('POST /api/auth/mfa/enable (AC-14, AC-15)', () => {
    it('con el código correcto responde 200 con 8 códigos distintos XXXX-XXXX', async () => {
      const user = await registerUser('mfa-enable');
      const secret = String((await setup(user.accessToken).expect(200)).body.secret);

      const response = await enable(user.accessToken, {
        code: await currentTotpCode(app, secret),
      }).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'generatedAt',
        'recoveryCodes',
      ]);

      const codes = response.body.recoveryCodes as string[];
      expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
      expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);

      for (const code of codes) {
        expect(code).toMatch(RECOVERY_CODE_PATTERN);
      }

      expect(Number.isNaN(Date.parse(String(response.body.generatedAt)))).toBe(false);
      // El secreto no vuelve a salir en la confirmación: ya se entregó en el `setup`.
      expect(JSON.stringify(response.body)).not.toContain(secret);
    });

    it('guarda mfaEnabled y el secreto CIFRADO, que descifra al base32 original (AC-14)', async () => {
      const user = await registerUser('mfa-enable-cifrado');
      const secret = String((await setup(user.accessToken).expect(200)).body.secret);

      await enable(user.accessToken, { code: await currentTotpCode(app, secret) }).expect(200);

      const row = await userRow(user.id);
      expect(row.mfaEnabled).toBe(true);
      expect(row.mfaSecret).not.toBeNull();
      expect(row.mfaSecret).not.toBe(secret);
      expect(row.mfaSecret).not.toContain(secret);
      expect(app.get(MfaSecretCipher).decrypt(String(row.mfaSecret))).toBe(secret);
    });

    it('guarda 8 códigos hasheados: ninguno en claro en la base', async () => {
      const { user, recoveryCodes } = await enrollUser('mfa-enable-hash');

      const rows = await app
        .get(PrismaService)
        .mfaRecoveryCode.findMany({ where: { userId: user.id } });

      expect(rows).toHaveLength(RECOVERY_CODE_COUNT);

      for (const row of rows) {
        expect(row.usedAt).toBeNull();
        expect(row.codeHash.startsWith('$2b$')).toBe(true);
        expect(recoveryCodes).not.toContain(row.codeHash);
      }
    });

    it('con un código incorrecto responde 401 y MFA sigue apagado (AC-15)', async () => {
      const user = await registerUser('mfa-enable-401');
      const secret = String((await setup(user.accessToken).expect(200)).body.secret);

      await enable(user.accessToken, { code: await wrongTotpCode(app, secret) }).expect(401);

      expect(await userRow(user.id)).toEqual({ mfaEnabled: false, mfaSecret: null });
      expect(
        await app.get(PrismaService).mfaRecoveryCode.count({ where: { userId: user.id } }),
      ).toBe(0);
    });

    it('un código incorrecto no invalida el enrolamiento: el correcto sigue funcionando', async () => {
      const user = await registerUser('mfa-enable-reintento');
      const secret = String((await setup(user.accessToken).expect(200)).body.secret);

      await enable(user.accessToken, { code: await wrongTotpCode(app, secret) }).expect(401);
      await enable(user.accessToken, { code: await currentTotpCode(app, secret) }).expect(200);
    });

    it('sin setup previo responde 409', async () => {
      const user = await registerUser('mfa-enable-409');

      const response = await enable(user.accessToken, { code: '123456' }).expect(409);

      expect(response.body.statusCode).toBe(409);
    });

    it('con MFA ya activo responde 409', async () => {
      const { user, secret } = await enrollUser('mfa-enable-doble');

      await enable(user.accessToken, { code: await currentTotpCode(app, secret) }).expect(409);
    });

    it('sin Bearer responde 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/mfa/enable')
        .send({ code: '123456' })
        .expect(401);
    });

    it.each([{}, { code: '12345' }, { code: 'abcdef' }, { code: '1234567' }])(
      'responde 400 nombrando el campo ante el cuerpo %p',
      async (body) => {
        const user = await registerUser('mfa-enable-400');

        const response = await enable(user.accessToken, body).expect(400);

        expect(JSON.stringify(response.body.message)).toContain('code');
      },
    );

    it('responde 400 ante una propiedad no declarada', async () => {
      const user = await registerUser('mfa-enable-extra');

      const response = await enable(user.accessToken, { code: '123456', secret: 'x' }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('secret');
    });
  });

  describe('POST /api/auth/mfa/disable (AC-19)', () => {
    function disable(accessToken: string, body: object): request.Test {
      return request(app.getHttpServer())
        .post('/api/auth/mfa/disable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(body);
    }

    /**
     * Abre una sesión completa de un usuario ya enrolado: login → `mfa/verify`.
     *
     * Devuelve el `accessToken` y el par de cookie de refresh, que es lo que permite comprobar
     * después qué sesiones sobrevivieron a la baja del segundo factor.
     */
    async function openSession(
      user: RegisteredUser,
      secret: string,
    ): Promise<{ accessToken: string; refreshCookie: string }> {
      const challenged = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: VALID_PASSWORD })
        .expect(200);

      const mfaToken = String(challenged.body.mfaToken);
      jtis.push(await mfaChallengeJti(app, mfaToken));

      const verified = await request(app.getHttpServer())
        .post('/api/auth/mfa/verify')
        .send({ mfaToken, code: await currentTotpCode(app, secret) })
        .expect(200);

      return {
        accessToken: String(verified.body.accessToken),
        refreshCookie: refreshCookiePair(verified),
      };
    }

    function refreshWith(cookie: string): request.Test {
      return request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', cookie);
    }

    it('con contraseña y código correctos responde 200 con mfaEnabled false', async () => {
      const { user, secret } = await enrollUser('mfa-disable-ok');

      const response = await disable(user.accessToken, {
        password: VALID_PASSWORD,
        code: await currentTotpCode(app, secret),
      }).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'createdAt',
        'displayName',
        'email',
        'id',
        'mfaEnabled',
      ]);
      expect(response.body.mfaEnabled).toBe(false);
      expect(response.body.id).toBe(user.id);
      expect(JSON.stringify(response.body)).not.toContain('mfaSecret');
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('borra el secreto y TODOS los códigos de recuperación del usuario', async () => {
      const { user, secret } = await enrollUser('mfa-disable-base');

      await disable(user.accessToken, {
        password: VALID_PASSWORD,
        code: await currentTotpCode(app, secret),
      }).expect(200);

      expect(await userRow(user.id)).toEqual({ mfaEnabled: false, mfaSecret: null });
      expect(
        await app.get(PrismaService).mfaRecoveryCode.count({ where: { userId: user.id } }),
      ).toBe(0);
    });

    it('tras la baja, el login vuelve a abrir sesión sin segundo factor', async () => {
      const { user, secret } = await enrollUser('mfa-disable-login');

      await disable(user.accessToken, {
        password: VALID_PASSWORD,
        code: await currentTotpCode(app, secret),
      }).expect(200);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: VALID_PASSWORD })
        .expect(200);

      expect(response.body.mfaRequired).toBe(false);
      expect(response.body.session).not.toBeNull();
      expect(refreshCookieHeader(response)).not.toBeNull();
    });

    it('acepta también un código de recuperación', async () => {
      const { user, recoveryCodes } = await enrollUser('mfa-disable-recovery');

      await disable(user.accessToken, {
        password: VALID_PASSWORD,
        code: recoveryCodes[0] ?? '',
      }).expect(200);

      expect((await userRow(user.id)).mfaEnabled).toBe(false);
    });

    it('con la contraseña incorrecta responde 401 y MFA sigue activo', async () => {
      const { user, secret } = await enrollUser('mfa-disable-password');

      await disable(user.accessToken, {
        password: 'contrasena-erronea-2',
        code: await currentTotpCode(app, secret),
      }).expect(401);

      expect((await userRow(user.id)).mfaEnabled).toBe(true);
    });

    // La contraseña se comprueba primero: si no, un intento con la contraseña equivocada quemaría el
    // código de recuperación que el usuario tecleó.
    it('con la contraseña incorrecta no gasta el código de recuperación', async () => {
      const { user, recoveryCodes } = await enrollUser('mfa-disable-no-quema');
      const code = recoveryCodes[0] ?? '';

      await disable(user.accessToken, { password: 'contrasena-erronea-2', code }).expect(401);

      await disable(user.accessToken, { password: VALID_PASSWORD, code }).expect(200);
    });

    it('con el código incorrecto responde 401 y MFA sigue activo', async () => {
      const { user, secret } = await enrollUser('mfa-disable-code');

      await disable(user.accessToken, {
        password: VALID_PASSWORD,
        code: await wrongTotpCode(app, secret),
      }).expect(401);

      expect((await userRow(user.id)).mfaEnabled).toBe(true);
      expect(
        await app.get(PrismaService).mfaRecoveryCode.count({ where: { userId: user.id } }),
      ).toBe(RECOVERY_CODE_COUNT);
    });

    it('con MFA no habilitado responde 409', async () => {
      const user = await registerUser('mfa-disable-409');

      const response = await disable(user.accessToken, {
        password: VALID_PASSWORD,
        code: '123456',
      }).expect(409);

      expect(response.body.statusCode).toBe(409);
    });

    // Bajar el segundo factor es un cambio de postura de seguridad: los demás dispositivos se cierran,
    // pero echar al usuario de la sesión desde la que lo está haciendo sería absurdo.
    it('revoca las otras sesiones y deja viva la actual', async () => {
      const { user, secret } = await enrollUser('mfa-disable-sesiones');
      const otra = await openSession(user, secret);
      const actual = await openSession(user, secret);

      expect(otra.refreshCookie).not.toBe(actual.refreshCookie);

      await disable(actual.accessToken, {
        password: VALID_PASSWORD,
        code: await currentTotpCode(app, secret),
      }).expect(200);

      await refreshWith(otra.refreshCookie).expect(401);
      await refreshWith(actual.refreshCookie).expect(200);
    });

    it('sin Bearer responde 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/mfa/disable')
        .send({ password: VALID_PASSWORD, code: '123456' })
        .expect(401);
    });

    it.each([
      [{ code: '123456' }, 'password'],
      [{ password: VALID_PASSWORD }, 'code'],
      [{ password: VALID_PASSWORD, code: '12345' }, 'code'],
      [{ password: VALID_PASSWORD, code: 'AAAA_AAAA' }, 'code'],
    ])('responde 400 nombrando el campo ante %p', async (body, campo) => {
      const user = await registerUser('mfa-disable-400');

      const response = await disable(user.accessToken, body).expect(400);

      expect(JSON.stringify(response.body.message)).toContain(campo);
    });

    it('responde 400 ante una propiedad no declarada', async () => {
      const user = await registerUser('mfa-disable-extra');

      const response = await disable(user.accessToken, {
        password: VALID_PASSWORD,
        code: '123456',
        userId: user.id,
      }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('userId');
    });
  });
});
