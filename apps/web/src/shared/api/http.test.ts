import type { AuthSession } from '@one-markdown/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import {
  ApiError,
  configureAuthBridge,
  getHealth,
  getMe,
  login,
  logout,
  mfaDisable,
  mfaEnable,
  mfaSetup,
  refreshSession,
  register,
  verifyMfa,
} from './http';
import { apiErrorResponse, noContentResponse, stubApi } from '../../test/api-stub';
import { authSession, authUser } from '../../test/auth-fixtures';

function mockFetch(response: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response)),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getHealth (AC-12)', () => {
  it('devuelve el Health tipado cuando la API responde 200', async () => {
    mockFetch(jsonResponse({ status: 'ok', uptimeSeconds: 7, version: '0.0.0' }));

    const health = await getHealth();

    expect(health).toEqual({ status: 'ok', uptimeSeconds: 7, version: '0.0.0' });
  });

  it('llama a /api/health', async () => {
    mockFetch(jsonResponse({ status: 'ok', uptimeSeconds: 7, version: '0.0.0' }));

    await getHealth();

    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET' }));
  });

  it('lanza ApiError cuando la respuesta no cumple el contrato Health', async () => {
    mockFetch(jsonResponse({ status: 'degraded' }));

    await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('manejo de errores del cliente HTTP', () => {
  it('traduce un ErrorResponseDto a ApiError con statusCode y message', async () => {
    mockFetch(
      jsonResponse(
        {
          statusCode: 404,
          error: 'Not Found',
          message: 'no existe',
          path: '/api/health',
          timestamp: '2026-07-24T00:00:00.000Z',
        },
        404,
      ),
    );

    const error = await getHealth().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(404);
    expect((error as ApiError).message).toContain('no existe');
  });

  it('conserva la lista de mensajes de validación', async () => {
    mockFetch(
      jsonResponse(
        {
          statusCode: 400,
          error: 'Bad Request',
          message: ['title es requerido', 'weight debe ser entero'],
          path: '/api/health',
          timestamp: '2026-07-24T00:00:00.000Z',
        },
        400,
      ),
    );

    const error = (await getHealth().catch((caught: unknown) => caught)) as ApiError;

    expect(error.messages).toEqual(['title es requerido', 'weight debe ser entero']);
  });

  it('lanza ApiError cuando el cuerpo no es JSON', async () => {
    mockFetch(new Response('<html>502</html>', { status: 502 }));

    const error = (await getHealth().catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(502);
  });

  it('lanza ApiError cuando la red falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    const error = (await getHealth().catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(0);
  });
});

describe('llamada autenticada con refresh y reintento único (AC-24)', () => {
  let accessToken: string | null;
  let sessionLost: Mock<() => void>;
  let sessionRenewed: Mock<(session: AuthSession) => void>;

  beforeEach(() => {
    accessToken = 'access-token-1';
    sessionLost = vi.fn<() => void>();
    sessionRenewed = vi.fn<(session: AuthSession) => void>();

    configureAuthBridge({
      getAccessToken: () => accessToken,
      onSessionRenewed: (session) => {
        accessToken = session.accessToken;
        sessionRenewed(session);
      },
      onSessionLost: () => {
        accessToken = null;
        sessionLost();
      },
    });
  });

  it('manda el access token como Bearer y la cookie de refresh con credentials: include', async () => {
    const api = stubApi({ 'GET /api/auth/me': () => jsonResponse(authUser()) });

    await getMe();

    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.headers['authorization']).toBe('Bearer access-token-1');
    expect(api.calls[0]?.credentials).toBe('include');
  });

  it('ante un 401 hace un solo refresh y un solo reintento (tres peticiones en total)', async () => {
    let meCalls = 0;
    const api = stubApi({
      'GET /api/auth/me': () => {
        meCalls += 1;

        return meCalls === 1
          ? apiErrorResponse(401, 'Token expirado')
          : jsonResponse(authUser({ displayName: 'Ada Lovelace' }));
      },
      'POST /api/auth/refresh': () => jsonResponse(authSession({ accessToken: 'access-token-2' })),
    });

    const user = await getMe();

    expect(user.displayName).toBe('Ada Lovelace');
    expect(api.calls).toHaveLength(3);
    expect(api.callsTo('POST /api/auth/refresh')).toHaveLength(1);
    // El reintento va con el token nuevo, no con el que acababa de caducar.
    expect(api.callsTo('GET /api/auth/me')[1]?.headers['authorization']).toBe(
      'Bearer access-token-2',
    );
  });

  it('si el refresh falla, rechaza con ApiError y avisa de la pérdida de sesión una sola vez', async () => {
    const api = stubApi({
      'GET /api/auth/me': () => apiErrorResponse(401, 'Token expirado'),
      'POST /api/auth/refresh': () => apiErrorResponse(401, 'Sesión revocada'),
    });

    const error = (await getMe().catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(401);
    expect(sessionLost).toHaveBeenCalledTimes(1);
    // Sin reintento: dos peticiones (la original y el refresh), nada más. Cero bucle.
    expect(api.calls).toHaveLength(2);
  });

  it('dos llamadas concurrentes que reciben 401 comparten un único refresh', async () => {
    let meCalls = 0;
    const api = stubApi({
      'GET /api/auth/me': () => {
        meCalls += 1;

        return meCalls <= 2 ? apiErrorResponse(401, 'Token expirado') : jsonResponse(authUser());
      },
      'POST /api/auth/refresh': () => jsonResponse(authSession({ accessToken: 'access-token-2' })),
    });

    await Promise.all([getMe(), getMe()]);

    expect(api.callsTo('POST /api/auth/refresh')).toHaveLength(1);
    expect(api.callsTo('GET /api/auth/me')).toHaveLength(4);
  });

  it('un 401 de /api/auth/login no entra en el circuito de reintento', async () => {
    const api = stubApi({
      'POST /api/auth/login': () => apiErrorResponse(401, 'Credenciales inválidas'),
    });

    const error = (await login({ email: 'ada@example.test', password: 'contrasena-larga-1' }).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error.statusCode).toBe(401);
    expect(api.calls).toHaveLength(1);
    expect(sessionLost).not.toHaveBeenCalled();
  });

  it('un 401 de /api/auth/refresh no se reintenta con otro refresh', async () => {
    const api = stubApi({
      'POST /api/auth/refresh': () => apiErrorResponse(401, 'Sesión revocada'),
    });

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);

    expect(api.calls).toHaveLength(1);
  });

  it('un 401 de /api/auth/mfa/enable NO dispara refresh: lo que está mal es el código, no el token', async () => {
    const api = stubApi({
      'POST /api/auth/mfa/enable': () => apiErrorResponse(401, 'Código incorrecto'),
    });

    const error = (await mfaEnable('000000').catch((caught: unknown) => caught)) as ApiError;

    expect(error.messages).toEqual(['Código incorrecto']);
    expect(api.calls).toHaveLength(1);
    expect(sessionLost).not.toHaveBeenCalled();
  });

  it('un 401 de /api/auth/mfa/disable tampoco: la credencial rechazada viaja en el cuerpo', async () => {
    const api = stubApi({
      'POST /api/auth/mfa/disable': () => apiErrorResponse(401, 'Contraseña incorrecta'),
    });

    const error = (await mfaDisable({ password: 'mala', code: '123456' }).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error.messages).toEqual(['Contraseña incorrecta']);
    expect(api.calls).toHaveLength(1);
    expect(sessionLost).not.toHaveBeenCalled();
  });

  it('publica la sesión renovada para que el token nuevo no se quede en el cliente HTTP', async () => {
    stubApi({
      'POST /api/auth/refresh': () => jsonResponse(authSession({ accessToken: 'access-token-2' })),
    });

    const session = await refreshSession();

    expect(session.accessToken).toBe('access-token-2');
    expect(sessionRenewed).toHaveBeenCalledTimes(1);
  });
});

describe('funciones del contrato de auth', () => {
  beforeEach(() => {
    configureAuthBridge({
      getAccessToken: () => 'access-token-1',
      onSessionRenewed: () => undefined,
      onSessionLost: () => undefined,
    });
  });

  it('register manda email, password y displayName y devuelve la sesión tipada', async () => {
    const api = stubApi({ 'POST /api/auth/register': () => jsonResponse(authSession(), 201) });

    const session = await register({
      email: 'ada@example.test',
      password: 'contrasena-larga-1',
      displayName: 'Ada',
    });

    expect(session.user.email).toBe('ada@example.test');
    expect(api.calls[0]?.body).toEqual({
      email: 'ada@example.test',
      password: 'contrasena-larga-1',
      displayName: 'Ada',
    });
  });

  it('login devuelve el LoginResult con el discriminante mfaRequired', async () => {
    stubApi({
      'POST /api/auth/login': () =>
        jsonResponse({
          mfaRequired: true,
          session: null,
          mfaToken: 'mfa-token-1',
          mfaTokenExpiresInSeconds: 300,
        }),
    });

    const result = await login({ email: 'ada@example.test', password: 'contrasena-larga-1' });

    expect(result.mfaRequired).toBe(true);
    expect(result.mfaToken).toBe('mfa-token-1');
    expect(result.session).toBeNull();
  });

  it('lanza ApiError cuando la respuesta de login no cumple el contrato', async () => {
    stubApi({ 'POST /api/auth/login': () => jsonResponse({ mfaRequired: 'sí' }) });

    await expect(login({ email: 'ada@example.test', password: 'x' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('expone retryAfterSeconds del 429 de cuenta bloqueada', async () => {
    stubApi({
      'POST /api/auth/login': () =>
        apiErrorResponse(429, 'Cuenta bloqueada temporalmente', { retryAfterSeconds: 900 }),
    });

    const error = (await login({ email: 'ada@example.test', password: 'x' }).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error.statusCode).toBe(429);
    expect(error.retryAfterSeconds).toBe(900);
  });

  it('verifyMfa canjea el mfaToken y el código por una sesión', async () => {
    const api = stubApi({ 'POST /api/auth/mfa/verify': () => jsonResponse(authSession()) });

    const session = await verifyMfa({ mfaToken: 'mfa-token-1', code: '123456' });

    expect(session.tokenType).toBe('Bearer');
    expect(api.calls[0]?.body).toEqual({ mfaToken: 'mfa-token-1', code: '123456' });
  });

  it('logout resuelve sin cuerpo ante un 204', async () => {
    const api = stubApi({ 'POST /api/auth/logout': () => noContentResponse() });

    await expect(logout()).resolves.toBeUndefined();

    expect(api.calls[0]?.credentials).toBe('include');
  });

  it('mfaSetup devuelve el secreto, el otpauthUri y el QR', async () => {
    stubApi({
      'POST /api/auth/mfa/setup': () =>
        jsonResponse({
          secret: 'JBSWY3DPEHPK3PXP',
          otpauthUri: 'otpauth://totp/One%20Markdown:ada@example.test?secret=JBSWY3DPEHPK3PXP',
          qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
          expiresInSeconds: 600,
        }),
    });

    const setup = await mfaSetup();

    expect(setup.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(setup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('mfaEnable devuelve los códigos de recuperación', async () => {
    const api = stubApi({
      'POST /api/auth/mfa/enable': () =>
        jsonResponse({
          recoveryCodes: ['AAAA-1111', 'BBBB-2222'],
          generatedAt: '2026-07-24T00:00:00.000Z',
        }),
    });

    const codes = await mfaEnable('123456');

    expect(codes.recoveryCodes).toEqual(['AAAA-1111', 'BBBB-2222']);
    expect(api.calls[0]?.body).toEqual({ code: '123456' });
  });

  it('mfaDisable devuelve el usuario con mfaEnabled en false', async () => {
    const api = stubApi({
      'POST /api/auth/mfa/disable': () => jsonResponse(authUser({ mfaEnabled: false })),
    });

    const user = await mfaDisable({ password: 'contrasena-larga-1', code: '123456' });

    expect(user.mfaEnabled).toBe(false);
    expect(api.calls[0]?.body).toEqual({ password: 'contrasena-larga-1', code: '123456' });
  });
});
