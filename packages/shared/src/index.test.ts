import { describe, expect, it } from 'vitest';

import {
  isApiErrorShape,
  isAuthSession,
  isAuthUser,
  isHealth,
  isLoginResult,
  isMfaRecoveryCodes,
  isMfaSetup,
  isReadiness,
  type AuthSession,
  type AuthUser,
  type Health,
  type LoginResult,
  type MfaRecoveryCodes,
  type MfaSetup,
} from './index';

const validHealth: Health = { status: 'ok', uptimeSeconds: 12, version: '0.0.0' };

const validUser: AuthUser = {
  id: '3f1c0a9e-8a1d-4f2b-9c7e-2b6d5a4f1e00',
  email: 'ada@example.test',
  displayName: null,
  mfaEnabled: false,
  createdAt: '2026-07-24T00:00:00.000Z',
};

const validSession: AuthSession = {
  accessToken: 'header.payload.signature',
  tokenType: 'Bearer',
  expiresInSeconds: 900,
  user: validUser,
};

describe('isHealth (AC-12)', () => {
  it('acepta la forma exacta de HealthResponseDto', () => {
    expect(isHealth(validHealth)).toBe(true);
  });

  it('rechaza un status distinto de "ok"', () => {
    expect(isHealth({ ...validHealth, status: 'down' })).toBe(false);
  });

  it('rechaza uptimeSeconds no numérico', () => {
    expect(isHealth({ ...validHealth, uptimeSeconds: '12' })).toBe(false);
  });

  it('rechaza objetos incompletos, null y primitivos', () => {
    expect(isHealth({ status: 'ok' })).toBe(false);
    expect(isHealth(null)).toBe(false);
    expect(isHealth('ok')).toBe(false);
  });
});

describe('isReadiness', () => {
  it('acepta ready con ambos checks up', () => {
    expect(isReadiness({ status: 'ready', checks: { database: 'up', redis: 'up' } })).toBe(true);
  });

  it('acepta not_ready con un check down', () => {
    expect(isReadiness({ status: 'not_ready', checks: { database: 'down', redis: 'up' } })).toBe(
      true,
    );
  });

  it('rechaza un estado de check desconocido', () => {
    expect(isReadiness({ status: 'ready', checks: { database: 'maybe', redis: 'up' } })).toBe(false);
  });

  it('rechaza checks ausentes', () => {
    expect(isReadiness({ status: 'ready' })).toBe(false);
  });
});

describe('isApiErrorShape', () => {
  it('acepta un mensaje único', () => {
    expect(
      isApiErrorShape({
        statusCode: 404,
        error: 'Not Found',
        message: 'no existe',
        path: '/api/x',
        timestamp: '2026-07-24T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('acepta una lista de mensajes de validación', () => {
    expect(
      isApiErrorShape({
        statusCode: 400,
        error: 'Bad Request',
        message: ['title es requerido', 'weight debe ser entero'],
        path: '/api/x',
        timestamp: '2026-07-24T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('rechaza un cuerpo sin statusCode', () => {
    expect(isApiErrorShape({ error: 'Bad Request', message: 'x' })).toBe(false);
  });

  it('acepta el 429 de cuenta bloqueada con retryAfterSeconds (AC-7)', () => {
    expect(
      isApiErrorShape({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Cuenta bloqueada temporalmente',
        path: '/api/auth/login',
        timestamp: '2026-07-24T00:00:00.000Z',
        retryAfterSeconds: 900,
      }),
    ).toBe(true);
  });

  it('rechaza un retryAfterSeconds presente pero no numérico', () => {
    expect(
      isApiErrorShape({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Cuenta bloqueada temporalmente',
        path: '/api/auth/login',
        timestamp: '2026-07-24T00:00:00.000Z',
        retryAfterSeconds: '900',
      }),
    ).toBe(false);
  });
});

describe('isAuthUser', () => {
  it('acepta la forma exacta de UserResponseDto con displayName null', () => {
    expect(isAuthUser(validUser)).toBe(true);
  });

  it('acepta un displayName con valor', () => {
    expect(isAuthUser({ ...validUser, displayName: 'Ada Lovelace' })).toBe(true);
  });

  it('rechaza displayName ausente en vez de null', () => {
    const { displayName: _omitted, ...withoutDisplayName } = validUser;
    expect(isAuthUser(withoutDisplayName)).toBe(false);
  });

  it('rechaza mfaEnabled no booleano y createdAt no string', () => {
    expect(isAuthUser({ ...validUser, mfaEnabled: 'false' })).toBe(false);
    expect(isAuthUser({ ...validUser, createdAt: 1_753_315_200_000 })).toBe(false);
  });

  it('rechaza null y primitivos', () => {
    expect(isAuthUser(null)).toBe(false);
    expect(isAuthUser('ada@example.test')).toBe(false);
  });
});

describe('isAuthSession', () => {
  it('acepta la forma exacta de AuthSessionResponseDto', () => {
    expect(isAuthSession(validSession)).toBe(true);
  });

  it('rechaza un tokenType distinto de "Bearer"', () => {
    expect(isAuthSession({ ...validSession, tokenType: 'bearer' })).toBe(false);
  });

  it('rechaza un user que no cumple AuthUser', () => {
    expect(isAuthSession({ ...validSession, user: { id: 'x' } })).toBe(false);
  });

  it('rechaza expiresInSeconds no numérico y el refreshToken no aparece en el contrato', () => {
    expect(isAuthSession({ ...validSession, expiresInSeconds: '900' })).toBe(false);
    expect(isAuthSession(validSession)).toBe(true);
    expect('refreshToken' in validSession).toBe(false);
  });
});

describe('isLoginResult', () => {
  const loggedIn: LoginResult = {
    mfaRequired: false,
    session: validSession,
    mfaToken: null,
    mfaTokenExpiresInSeconds: null,
  };

  const mfaChallenge: LoginResult = {
    mfaRequired: true,
    session: null,
    mfaToken: 'header.payload.signature',
    mfaTokenExpiresInSeconds: 300,
  };

  it('acepta el login completo con sesión', () => {
    expect(isLoginResult(loggedIn)).toBe(true);
  });

  it('acepta el desafío de segundo factor con session null', () => {
    expect(isLoginResult(mfaChallenge)).toBe(true);
  });

  it('rechaza session ausente en vez de null', () => {
    const { session: _omitted, ...withoutSession } = mfaChallenge;
    expect(isLoginResult(withoutSession)).toBe(false);
  });

  it('rechaza mfaToken ausente en vez de null', () => {
    const { mfaToken: _omitted, ...withoutMfaToken } = loggedIn;
    expect(isLoginResult(withoutMfaToken)).toBe(false);
  });

  it('rechaza mfaTokenExpiresInSeconds ausente en vez de null', () => {
    const { mfaTokenExpiresInSeconds: _omitted, ...withoutExpiry } = loggedIn;
    expect(isLoginResult(withoutExpiry)).toBe(false);
  });

  it('rechaza mfaRequired no booleano', () => {
    expect(isLoginResult({ ...loggedIn, mfaRequired: 'false' })).toBe(false);
    expect(isLoginResult({ ...loggedIn, mfaRequired: 0 })).toBe(false);
  });

  it('rechaza una session presente que no cumple AuthSession', () => {
    expect(isLoginResult({ ...loggedIn, session: { accessToken: 'x' } })).toBe(false);
  });
});

describe('isMfaSetup', () => {
  const validSetup: MfaSetup = {
    secret: 'JBSWY3DPEHPK3PXP',
    otpauthUri: 'otpauth://totp/One%20Markdown:ada@example.test?secret=JBSWY3DPEHPK3PXP',
    qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    expiresInSeconds: 600,
  };

  it('acepta la forma exacta de MfaSetupResponseDto', () => {
    expect(isMfaSetup(validSetup)).toBe(true);
  });

  it('rechaza campos ausentes', () => {
    const { qrCodeDataUrl: _omitted, ...withoutQr } = validSetup;
    expect(isMfaSetup(withoutQr)).toBe(false);
  });

  it('rechaza expiresInSeconds no numérico', () => {
    expect(isMfaSetup({ ...validSetup, expiresInSeconds: '600' })).toBe(false);
  });
});

describe('isMfaRecoveryCodes', () => {
  const validCodes: MfaRecoveryCodes = {
    recoveryCodes: ['A1B2-C3D4', 'E5F6-G7H8'],
    generatedAt: '2026-07-24T00:00:00.000Z',
  };

  it('acepta la forma exacta de MfaRecoveryCodesResponseDto', () => {
    expect(isMfaRecoveryCodes(validCodes)).toBe(true);
  });

  it('acepta una lista vacía de códigos', () => {
    expect(isMfaRecoveryCodes({ ...validCodes, recoveryCodes: [] })).toBe(true);
  });

  it('rechaza recoveryCodes que no sea un array', () => {
    expect(isMfaRecoveryCodes({ ...validCodes, recoveryCodes: 'A1B2-C3D4' })).toBe(false);
    expect(isMfaRecoveryCodes({ ...validCodes, recoveryCodes: null })).toBe(false);
  });

  it('rechaza recoveryCodes que no sea array de strings', () => {
    expect(isMfaRecoveryCodes({ ...validCodes, recoveryCodes: [1, 2] })).toBe(false);
    expect(isMfaRecoveryCodes({ ...validCodes, recoveryCodes: ['A1B2-C3D4', 7] })).toBe(false);
  });

  it('rechaza generatedAt ausente', () => {
    expect(isMfaRecoveryCodes({ recoveryCodes: [] })).toBe(false);
  });
});
