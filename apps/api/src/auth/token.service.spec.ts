import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AppConfig } from '../config/env.validation';
import { TokenService } from './token.service';

const ACCESS_SECRET = 'secreto-de-access-con-mas-de-32-caracteres';
const REFRESH_SECRET = 'secreto-de-refresh-con-mas-de-32-caracteres';
const ACCESS_TTL = 900;
const REFRESH_TTL = 604800;

const CONFIG: Pick<AppConfig, 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET' | 'JWT_ACCESS_TTL' | 'JWT_REFRESH_TTL'> =
  {
    JWT_ACCESS_SECRET: ACCESS_SECRET,
    JWT_REFRESH_SECRET: REFRESH_SECRET,
    JWT_ACCESS_TTL: ACCESS_TTL,
    JWT_REFRESH_TTL: REFRESH_TTL,
  };

function buildService(): TokenService {
  const config = {
    get: (key: keyof typeof CONFIG): string | number => CONFIG[key],
  } as unknown as ConfigService<AppConfig, true>;

  return new TokenService(new JwtService(), config);
}

const USER_ID = '11111111-1111-1111-1111-111111111111';
const SID = 'sesion-1';

describe('TokenService (AC-5, AC-12)', () => {
  const service = buildService();
  const jwt = new JwtService();

  function decode(token: string): Record<string, unknown> {
    return jwt.decode(token) as Record<string, unknown>;
  }

  describe('access token', () => {
    it('firma un token que se verifica y trae sub, sid y typ', async () => {
      const token = await service.signAccess({ userId: USER_ID, sid: SID });
      const payload = await service.verifyAccess(token);

      expect(payload.sub).toBe(USER_ID);
      expect(payload.sid).toBe(SID);
      expect(payload.typ).toBe('access');
    });

    it('expira a JWT_ACCESS_TTL segundos del iat', async () => {
      const claims = decode(await service.signAccess({ userId: USER_ID, sid: SID }));

      expect(Number(claims['exp']) - Number(claims['iat'])).toBe(ACCESS_TTL);
    });

    it('rechaza un token con la firma alterada', async () => {
      const token = await service.signAccess({ userId: USER_ID, sid: SID });
      const alterado = `${token.slice(0, -3)}xyz`;

      await expect(service.verifyAccess(alterado)).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza un token expirado', async () => {
      const expirado = await jwt.signAsync(
        { sub: USER_ID, sid: SID, typ: 'access' },
        { secret: ACCESS_SECRET, expiresIn: -10 },
      );

      await expect(service.verifyAccess(expirado)).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza basura que no es un JWT', async () => {
      await expect(service.verifyAccess('no-soy-un-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh token', () => {
    it('firma un token con jti propio y se verifica', async () => {
      const token = await service.signRefresh({ userId: USER_ID, sid: SID, jti: 'jti-1' });
      const payload = await service.verifyRefresh(token);

      expect(payload.sub).toBe(USER_ID);
      expect(payload.sid).toBe(SID);
      expect(payload.jti).toBe('jti-1');
      expect(payload.typ).toBe('refresh');
    });

    it('expira a JWT_REFRESH_TTL segundos del iat', async () => {
      const claims = decode(
        await service.signRefresh({ userId: USER_ID, sid: SID, jti: 'jti-1' }),
      );

      expect(Number(claims['exp']) - Number(claims['iat'])).toBe(REFRESH_TTL);
    });
  });

  // AC-12: el secreto distinto no basta como única defensa. El claim `typ` impide que un token válido
  // se use en el circuito equivocado aunque algún día los secretos se unifiquen por error.
  describe('no se aceptan tokens cruzados (AC-12)', () => {
    it('un refresh token no sirve como access token', async () => {
      const refresh = await service.signRefresh({ userId: USER_ID, sid: SID, jti: 'jti-1' });

      await expect(service.verifyAccess(refresh)).rejects.toThrow(UnauthorizedException);
    });

    it('un access token no sirve como refresh token', async () => {
      const access = await service.signAccess({ userId: USER_ID, sid: SID });

      await expect(service.verifyRefresh(access)).rejects.toThrow(UnauthorizedException);
    });

    it('un token con el secreto correcto pero typ equivocado se rechaza', async () => {
      const impostor = await jwt.signAsync(
        { sub: USER_ID, sid: SID, typ: 'refresh' },
        { secret: ACCESS_SECRET, expiresIn: 900 },
      );

      await expect(service.verifyAccess(impostor)).rejects.toThrow(UnauthorizedException);
    });

    it('un mfaToken no sirve como access token', async () => {
      const mfa = await service.signMfa({ userId: USER_ID, jti: 'desafio-1' });

      await expect(service.verifyAccess(mfa)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('mfaToken', () => {
    it('firma un token de segundo factor con typ mfa y su jti', async () => {
      const token = await service.signMfa({ userId: USER_ID, jti: 'desafio-1' });
      const payload = await service.verifyMfa(token);

      expect(payload.sub).toBe(USER_ID);
      expect(payload.jti).toBe('desafio-1');
      expect(payload.typ).toBe('mfa');
    });

    it('vive 5 minutos: acredita "la contraseña ya fue correcta", no una sesión', async () => {
      const claims = decode(await service.signMfa({ userId: USER_ID, jti: 'desafio-1' }));

      expect(Number(claims['exp']) - Number(claims['iat'])).toBe(300);
    });

    it('no lleva sid: todavía no hay sesión que identificar', async () => {
      const claims = decode(await service.signMfa({ userId: USER_ID, jti: 'desafio-1' }));

      expect(claims['sid']).toBeUndefined();
    });
  });
});
