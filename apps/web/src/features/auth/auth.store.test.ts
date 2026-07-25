import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from './auth.store';
import { apiErrorResponse, jsonResponse, noContentResponse, stubApi } from '../../test/api-stub';
import { authSession, authUser } from '../../test/auth-fixtures';

beforeEach(() => {
  useAuthStore.setState({
    status: 'unknown',
    user: null,
    accessToken: null,
    pendingMfa: null,
    error: null,
  });
});

afterEach(() => {
  // AC-23: el access token vive solo en memoria. Si algún día alguien añade un middleware de
  // persistencia al store, este assert es lo que lo va a impedir.
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);

  vi.unstubAllGlobals();
});

describe('useAuthStore — estado inicial (AC-22)', () => {
  it('arranca en "unknown" sin usuario ni token, para no redirigir antes del refresh silencioso', () => {
    const state = useAuthStore.getState();

    expect(state.status).toBe('unknown');
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.pendingMfa).toBeNull();
  });
});

describe('useAuthStore.bootstrap — refresh silencioso al arrancar (AC-22, AC-23)', () => {
  it('con un refresh correcto queda autenticado y guarda el token en memoria', async () => {
    stubApi({
      'POST /api/auth/refresh': () =>
        jsonResponse(authSession({ accessToken: 'access-token-boot' })),
    });

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user?.email).toBe('ada@example.test');
    expect(state.accessToken).toBe('access-token-boot');
  });

  it('con un refresh fallido pasa a "anonymous" y no muestra error (nadie pidió nada)', async () => {
    stubApi({ 'POST /api/auth/refresh': () => apiErrorResponse(401, 'Sesión revocada') });

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.accessToken).toBeNull();
    expect(state.error).toBeNull();
  });

  it('varias llamadas concurrentes comparten un único refresh', async () => {
    const api = stubApi({ 'POST /api/auth/refresh': () => jsonResponse(authSession()) });

    await Promise.all([useAuthStore.getState().bootstrap(), useAuthStore.getState().bootstrap()]);

    expect(api.callsTo('POST /api/auth/refresh')).toHaveLength(1);
  });
});

describe('useAuthStore.login (AC-22, AC-23)', () => {
  it('sin MFA deja la sesión abierta', async () => {
    stubApi({
      'POST /api/auth/login': () =>
        jsonResponse({
          mfaRequired: false,
          session: authSession({ accessToken: 'access-token-login' }),
          mfaToken: null,
          mfaTokenExpiresInSeconds: null,
        }),
    });

    await useAuthStore.getState().login({ email: 'ada@example.test', password: 'contrasena-1234' });

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe('access-token-login');
    expect(state.pendingMfa).toBeNull();
  });

  it('marca "authenticating" mientras la petición está en vuelo', async () => {
    stubApi({
      'POST /api/auth/login': () =>
        jsonResponse({
          mfaRequired: false,
          session: authSession(),
          mfaToken: null,
          mfaTokenExpiresInSeconds: null,
        }),
    });

    const pending = useAuthStore
      .getState()
      .login({ email: 'ada@example.test', password: 'contrasena-1234' });

    expect(useAuthStore.getState().status).toBe('authenticating');

    await pending;
  });

  it('con mfaRequired deja pendingMfa y NO autentica', async () => {
    stubApi({
      'POST /api/auth/login': () =>
        jsonResponse({
          mfaRequired: true,
          session: null,
          mfaToken: 'mfa-token-1',
          mfaTokenExpiresInSeconds: 300,
        }),
    });

    await useAuthStore.getState().login({ email: 'ada@example.test', password: 'contrasena-1234' });

    const state = useAuthStore.getState();
    expect(state.status).not.toBe('authenticated');
    expect(state.accessToken).toBeNull();
    expect(state.pendingMfa).toEqual({ mfaToken: 'mfa-token-1' });
  });

  it('con credenciales inválidas vuelve a "anonymous" con el mensaje del servidor', async () => {
    stubApi({ 'POST /api/auth/login': () => apiErrorResponse(401, 'Credenciales inválidas') });

    await useAuthStore.getState().login({ email: 'ada@example.test', password: 'mala' });

    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.error).toBe('Credenciales inválidas');
  });

  it('con la cuenta bloqueada dice cuánto hay que esperar en vez de un error genérico', async () => {
    stubApi({
      'POST /api/auth/login': () =>
        apiErrorResponse(429, 'Demasiados intentos', { retryAfterSeconds: 900 }),
    });

    await useAuthStore.getState().login({ email: 'ada@example.test', password: 'mala' });

    expect(useAuthStore.getState().error).toMatch(/15 minutos/);
  });

  it('con la red caída explica que no se pudo contactar con el servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await useAuthStore.getState().login({ email: 'ada@example.test', password: 'contrasena-1234' });

    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.error).toMatch(/servidor/i);
  });
});

describe('useAuthStore.verifyMfa (AC-23)', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', pendingMfa: { mfaToken: 'mfa-token-1' } });
  });

  it('completa la sesión y limpia pendingMfa', async () => {
    const api = stubApi({
      'POST /api/auth/mfa/verify': () =>
        jsonResponse(authSession({ accessToken: 'access-token-mfa' })),
    });

    await useAuthStore.getState().verifyMfa('123456');

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe('access-token-mfa');
    expect(state.pendingMfa).toBeNull();
    expect(api.calls[0]?.body).toEqual({ mfaToken: 'mfa-token-1', code: '123456' });
  });

  it('con un código incorrecto conserva el pendingMfa para poder reintentar', async () => {
    stubApi({ 'POST /api/auth/mfa/verify': () => apiErrorResponse(401, 'Código inválido') });

    await useAuthStore.getState().verifyMfa('000000');

    const state = useAuthStore.getState();
    expect(state.status).not.toBe('authenticated');
    expect(state.pendingMfa).toEqual({ mfaToken: 'mfa-token-1' });
    expect(state.error).toBe('Código inválido');
  });
});

describe('useAuthStore.register (AC-22)', () => {
  it('deja la sesión abierta sin paso extra de activación', async () => {
    const api = stubApi({
      'POST /api/auth/register': () =>
        jsonResponse(authSession({ accessToken: 'access-token-nuevo' }), 201),
    });

    await useAuthStore.getState().register({
      email: 'nueva@example.test',
      password: 'contrasena-1234',
      displayName: 'Nueva',
    });

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe('access-token-nuevo');
    expect(api.calls[0]?.body).toEqual({
      email: 'nueva@example.test',
      password: 'contrasena-1234',
      displayName: 'Nueva',
    });
  });

  it('con un correo ya registrado deja el mensaje del servidor y no autentica', async () => {
    stubApi({
      'POST /api/auth/register': () => apiErrorResponse(409, 'El correo ya está registrado'),
    });

    await useAuthStore
      .getState()
      .register({ email: 'ada@example.test', password: 'contrasena-1234' });

    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.error).toBe('El correo ya está registrado');
  });
});

describe('useAuthStore.logout (AC-22)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser(),
      accessToken: 'access-token-1',
    });
  });

  it('vuelve a "anonymous" y borra el token de memoria', async () => {
    stubApi({ 'POST /api/auth/logout': () => noContentResponse() });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('borra la sesión local aunque el servidor falle: quedarse dentro es peor', async () => {
    stubApi({ 'POST /api/auth/logout': () => apiErrorResponse(500, 'Redis no responde') });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.accessToken).toBeNull();
  });
});

describe('useAuthStore ante la pérdida de sesión del cliente HTTP (AC-24)', () => {
  it('un 401 cuyo refresh también falla deja el estado anónimo', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser(),
      accessToken: 'access-token-caducado',
    });

    stubApi({
      'GET /api/auth/me': () => apiErrorResponse(401, 'Token expirado'),
      'POST /api/auth/refresh': () => apiErrorResponse(401, 'Sesión revocada'),
    });

    await expect(useAuthStore.getState().loadCurrentUser()).resolves.toBeUndefined();

    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.accessToken).toBeNull();
  });

  it('un 401 recuperable renueva el token sin que el usuario note nada', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser(),
      accessToken: 'access-token-caducado',
    });

    let meCalls = 0;
    stubApi({
      'GET /api/auth/me': () => {
        meCalls += 1;

        return meCalls === 1
          ? apiErrorResponse(401, 'Token expirado')
          : jsonResponse(authUser({ displayName: 'Ada Lovelace' }));
      },
      'POST /api/auth/refresh': () =>
        jsonResponse(authSession({ accessToken: 'access-token-renovado' })),
    });

    await useAuthStore.getState().loadCurrentUser();

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe('access-token-renovado');
    expect(state.user?.displayName).toBe('Ada Lovelace');
  });
});

describe('useAuthStore.applyUser', () => {
  it('actualiza el usuario en memoria sin tocar el token (alta/baja de MFA)', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: authUser({ mfaEnabled: false }),
      accessToken: 'access-token-1',
    });

    useAuthStore.getState().applyUser(authUser({ mfaEnabled: true }));

    const state = useAuthStore.getState();
    expect(state.user?.mfaEnabled).toBe(true);
    expect(state.accessToken).toBe('access-token-1');
  });
});
