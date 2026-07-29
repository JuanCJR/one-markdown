import type { AuthSession, DocumentContentSaved } from '@one-markdown/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import {
  ApiError,
  configureAuthBridge,
  createDirectory,
  createDocument,
  deleteDirectory,
  deleteDocument,
  getDocument,
  getHealth,
  getMe,
  getWorkspaceTree,
  login,
  logout,
  mfaDisable,
  mfaEnable,
  mfaSetup,
  moveDirectory,
  moveDocument,
  refreshSession,
  register,
  renameDirectory,
  renameDocument,
  saveDocumentContent,
  verifyMfa,
} from './http';
import { apiErrorResponse, noContentResponse, stubApi } from '../../test/api-stub';
import { authSession, authUser } from '../../test/auth-fixtures';
import {
  directoryNode,
  documentSummary,
  markdownDocument,
  workspaceTree,
} from '../../test/workspace-fixtures';

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

describe('cliente de workspace (T-017: habilita AC-28…AC-32)', () => {
  let accessToken: string | null;

  beforeEach(() => {
    accessToken = 'access-token-1';

    configureAuthBridge({
      getAccessToken: () => accessToken,
      onSessionRenewed: (session) => {
        accessToken = session.accessToken;
      },
      onSessionLost: () => {
        accessToken = null;
      },
    });
  });

  describe('GET /api/workspace/tree', () => {
    it('devuelve el árbol tipado con sus dos listas y la marca de tiempo', async () => {
      const tree = workspaceTree({
        directories: [directoryNode()],
        documents: [documentSummary({ directoryId: 'dir-notas' })],
      });
      stubApi({ 'GET /api/workspace/tree': () => jsonResponse(tree) });

      const received = await getWorkspaceTree();

      expect(received.directories[0]?.name).toBe('Notas');
      expect(received.documents[0]?.directoryId).toBe('dir-notas');
      expect(received.generatedAt).toBe('2026-07-25T12:00:00.000Z');
    });

    it('rechaza con ApiError una respuesta que no cumple el contrato', async () => {
      stubApi({
        'GET /api/workspace/tree': () =>
          jsonResponse({ directories: [], generatedAt: '2026-07-25T12:00:00.000Z' }),
      });

      await expect(getWorkspaceTree()).rejects.toBeInstanceOf(ApiError);
    });

    it('un solo directorio roto invalida la respuesta entera: no se filtran elementos', async () => {
      const { parentId: _ignored, ...sinParentId } = directoryNode({ id: 'dir-roto' });
      stubApi({
        'GET /api/workspace/tree': () =>
          jsonResponse({
            directories: [directoryNode(), sinParentId],
            documents: [],
            generatedAt: '2026-07-25T12:00:00.000Z',
          }),
      });

      await expect(getWorkspaceTree()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('directorios', () => {
    it('createDirectory manda POST con el nombre y el parentId null explícito', async () => {
      const api = stubApi({
        'POST /api/workspace/directories': () => jsonResponse(directoryNode(), 201),
      });

      const created = await createDirectory({ name: 'Notas', parentId: null });

      expect(created.id).toBe('dir-notas');
      expect(api.calls[0]?.method).toBe('POST');
      expect(api.calls[0]?.body).toEqual({ name: 'Notas', parentId: null });
    });

    it('renameDirectory manda el método PATCH y el Content-Type de JSON', async () => {
      const api = stubApi({
        'PATCH /api/workspace/directories/dir-notas': () =>
          jsonResponse(directoryNode({ name: 'Apuntes' })),
      });

      const renamed = await renameDirectory('dir-notas', 'Apuntes');

      expect(renamed.name).toBe('Apuntes');
      expect(api.calls[0]?.method).toBe('PATCH');
      expect(api.calls[0]?.headers['content-type']).toBe('application/json');
      expect(api.calls[0]?.body).toEqual({ name: 'Apuntes' });
    });

    it('moveDirectory manda POST a /:id/move con el destino', async () => {
      const api = stubApi({
        'POST /api/workspace/directories/dir-notas/move': () =>
          jsonResponse(directoryNode({ parentId: 'dir-archivo', depth: 1 })),
      });

      const moved = await moveDirectory('dir-notas', 'dir-archivo');

      expect(moved.parentId).toBe('dir-archivo');
      expect(api.calls[0]?.body).toEqual({ parentId: 'dir-archivo' });
    });

    it('deleteDirectory pide el borrado recursivo en la query cuando se le pide', async () => {
      const api = stubApi({
        'DELETE /api/workspace/directories/dir-notas?recursive=true': () => noContentResponse(),
      });

      await deleteDirectory('dir-notas', true);

      expect(api.calls[0]?.method).toBe('DELETE');
    });

    it('deleteDirectory manda recursive=false cuando el borrado no es recursivo', async () => {
      const api = stubApi({
        'DELETE /api/workspace/directories/dir-notas?recursive=false': () => noContentResponse(),
      });

      await deleteDirectory('dir-notas', false);

      expect(api.calls).toHaveLength(1);
    });
  });

  describe('respuestas sin cuerpo', () => {
    it('un DELETE sin cuerpo no manda Content-Type', async () => {
      const api = stubApi({
        'DELETE /api/workspace/documents/doc-diario': () => noContentResponse(),
      });

      await deleteDocument('doc-diario');

      expect(api.calls[0]?.headers['content-type']).toBeUndefined();
    });

    it('un 204 resuelve sin error', async () => {
      stubApi({ 'DELETE /api/workspace/documents/doc-diario': () => noContentResponse() });

      await expect(deleteDocument('doc-diario')).resolves.toBeUndefined();
    });

    it('un 204 ni siquiera intenta parsear el cuerpo', async () => {
      const response = noContentResponse();
      const parseBody = vi.spyOn(response, 'json');
      stubApi({ 'DELETE /api/workspace/documents/doc-diario': () => response });

      await deleteDocument('doc-diario');

      expect(parseBody).not.toHaveBeenCalled();
    });

    it('un error en un endpoint sin cuerpo sigue llegando como ApiError', async () => {
      stubApi({
        'DELETE /api/workspace/directories/dir-notas?recursive=false': () =>
          apiErrorResponse(409, 'El directorio no está vacío', { code: 'DIRECTORY_NOT_EMPTY' }),
      });

      const error = (await deleteDirectory('dir-notas', false).catch(
        (caught: unknown) => caught,
      )) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.code).toBe('DIRECTORY_NOT_EMPTY');
    });
  });

  describe('documentos', () => {
    it('createDocument devuelve el documento con su contenido', async () => {
      const api = stubApi({
        'POST /api/workspace/documents': () =>
          jsonResponse(markdownDocument({ content: '# Hola\n' }), 201),
      });

      const created = await createDocument({
        title: 'Diario',
        directoryId: 'dir-notas',
        content: '# Hola\n',
      });

      expect(created.content).toBe('# Hola\n');
      expect(api.calls[0]?.body).toEqual({
        title: 'Diario',
        directoryId: 'dir-notas',
        content: '# Hola\n',
      });
    });

    it('createDocument sin contenido no manda la propiedad content', async () => {
      const api = stubApi({
        'POST /api/workspace/documents': () => jsonResponse(markdownDocument({ content: '' }), 201),
      });

      await createDocument({ title: 'Diario', directoryId: null });

      expect(api.calls[0]?.body).toEqual({ title: 'Diario', directoryId: null });
    });

    it('getDocument devuelve el detalle con el markdown en crudo', async () => {
      stubApi({
        'GET /api/workspace/documents/doc-diario': () =>
          jsonResponse(markdownDocument({ content: '# Diario\n\ntexto' })),
      });

      const detail = await getDocument('doc-diario');

      expect(detail.content).toBe('# Diario\n\ntexto');
    });

    it('getDocument rechaza un resumen sin content: el detalle exige el texto', async () => {
      stubApi({
        'GET /api/workspace/documents/doc-diario': () => jsonResponse(documentSummary()),
      });

      await expect(getDocument('doc-diario')).rejects.toBeInstanceOf(ApiError);
    });

    it('renameDocument manda PATCH y devuelve el resumen, sin content', async () => {
      const api = stubApi({
        'PATCH /api/workspace/documents/doc-diario': () =>
          jsonResponse(documentSummary({ title: 'Bitácora' })),
      });

      const renamed = await renameDocument('doc-diario', 'Bitácora');

      expect(renamed.title).toBe('Bitácora');
      expect(api.calls[0]?.method).toBe('PATCH');
      expect(api.calls[0]?.body).toEqual({ title: 'Bitácora' });
    });

    it('moveDocument manda el directorio destino y acepta null para la raíz', async () => {
      const api = stubApi({
        'POST /api/workspace/documents/doc-diario/move': () =>
          jsonResponse(documentSummary({ directoryId: null })),
      });

      const moved = await moveDocument('doc-diario', null);

      expect(moved.directoryId).toBeNull();
      expect(api.calls[0]?.body).toEqual({ directoryId: null });
    });
  });

  describe('credencial, errores y reintento', () => {
    it('las diez llamadas de workspace mandan Authorization: Bearer y credentials: include', async () => {
      const api = stubApi({
        'GET /api/workspace/tree': () => jsonResponse(workspaceTree()),
        'POST /api/workspace/directories': () => jsonResponse(directoryNode(), 201),
        'PATCH /api/workspace/directories/dir-notas': () => jsonResponse(directoryNode()),
        'POST /api/workspace/directories/dir-notas/move': () => jsonResponse(directoryNode()),
        'DELETE /api/workspace/directories/dir-notas?recursive=false': () => noContentResponse(),
        'POST /api/workspace/documents': () => jsonResponse(markdownDocument(), 201),
        'GET /api/workspace/documents/doc-diario': () => jsonResponse(markdownDocument()),
        'PATCH /api/workspace/documents/doc-diario': () => jsonResponse(documentSummary()),
        'POST /api/workspace/documents/doc-diario/move': () => jsonResponse(documentSummary()),
        'DELETE /api/workspace/documents/doc-diario': () => noContentResponse(),
      });

      await getWorkspaceTree();
      await createDirectory({ name: 'Notas', parentId: null });
      await renameDirectory('dir-notas', 'Apuntes');
      await moveDirectory('dir-notas', null);
      await deleteDirectory('dir-notas', false);
      await createDocument({ title: 'Diario', directoryId: null });
      await getDocument('doc-diario');
      await renameDocument('doc-diario', 'Bitácora');
      await moveDocument('doc-diario', null);
      await deleteDocument('doc-diario');

      expect(api.calls).toHaveLength(10);
      for (const call of api.calls) {
        expect(call.headers['authorization']).toBe('Bearer access-token-1');
        expect(call.credentials).toBe('include');
      }
    });

    it('un 409 con code propaga un ApiError que conserva el code', async () => {
      stubApi({
        'POST /api/workspace/directories': () =>
          apiErrorResponse(409, 'Ya existe un directorio con ese nombre', {
            code: 'DIRECTORY_NAME_TAKEN',
          }),
      });

      const error = (await createDirectory({ name: 'Notas', parentId: null }).catch(
        (caught: unknown) => caught,
      )) as ApiError;

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('DIRECTORY_NAME_TAKEN');
      expect(error.message).toContain('Ya existe un directorio con ese nombre');
    });

    it('un error sin code deja el code en null', async () => {
      stubApi({
        'GET /api/workspace/tree': () => apiErrorResponse(500, 'Error interno del servidor'),
      });

      const error = (await getWorkspaceTree().catch((caught: unknown) => caught)) as ApiError;

      expect(error.code).toBeNull();
    });

    it('un 401 dispara un solo refresh y un solo reintento', async () => {
      let treeCalls = 0;
      const api = stubApi({
        'GET /api/workspace/tree': () => {
          treeCalls += 1;

          return treeCalls === 1
            ? apiErrorResponse(401, 'Token expirado')
            : jsonResponse(workspaceTree({ directories: [directoryNode()] }));
        },
        'POST /api/auth/refresh': () =>
          jsonResponse(authSession({ accessToken: 'access-token-2' })),
      });

      const tree = await getWorkspaceTree();

      expect(tree.directories).toHaveLength(1);
      expect(api.calls).toHaveLength(3);
      expect(api.callsTo('POST /api/auth/refresh')).toHaveLength(1);
      expect(api.callsTo('GET /api/workspace/tree')[1]?.headers['authorization']).toBe(
        'Bearer access-token-2',
      );
    });

    it('un 404 de borrado no se reintenta ni cierra la sesión', async () => {
      const api = stubApi({
        'DELETE /api/workspace/documents/doc-diario': () =>
          apiErrorResponse(404, 'El documento no existe', { code: 'DOCUMENT_NOT_FOUND' }),
      });

      const error = (await deleteDocument('doc-diario').catch(
        (caught: unknown) => caught,
      )) as ApiError;

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('DOCUMENT_NOT_FOUND');
      expect(api.calls).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// T-010 · AC-15: PUT /api/workspace/documents/:id/content
// ---------------------------------------------------------------------------------------------

/**
 * Espejo de `WorkspaceDocumentContentResponseDto`: las **cuatro** claves del `200` del guardado.
 *
 * Vive aquí y no en `test/workspace-fixtures.ts` porque `T-010` solo puede tocar `http.ts` y
 * `http.test.ts` (`tasks.md`, §ARCHIVOS).
 */
function documentContentSaved(overrides: Partial<DocumentContentSaved> = {}): DocumentContentSaved {
  return {
    id: 'doc-diario',
    contentBytes: 9,
    contentVersion: 1,
    updatedAt: '2026-07-25T00:10:00.000Z',
    ...overrides,
  };
}

/**
 * `id` que **de verdad** mide `encodeURIComponent`: con el espacio y la barra, la forma codificada
 * (`doc%20a%2Fb`) no se parece a la cruda. Un `id` que fuese igual codificado y sin codificar dejaría
 * pasar la ausencia de la codificación sin que ningún caso lo notara.
 */
const AWKWARD_ID = 'doc a/b';
const AWKWARD_ID_ENCODED = 'doc%20a%2Fb';

describe('saveDocumentContent (AC-15, T-010)', () => {
  let accessToken: string | null;

  beforeEach(() => {
    accessToken = 'access-token-1';

    configureAuthBridge({
      getAccessToken: () => accessToken,
      onSessionRenewed: (session) => {
        accessToken = session.accessToken;
      },
      onSessionLost: () => {
        accessToken = null;
      },
    });
  });

  it('emite un PUT a /api/workspace/documents/:id/content', async () => {
    const api = stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () => jsonResponse(documentContentSaved()),
    });

    await saveDocumentContent('doc-diario', '# Diario\n', 0);

    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.method).toBe('PUT');
    expect(api.calls[0]?.path).toBe('/api/workspace/documents/doc-diario/content');
  });

  it('manda el cuerpo EXACTO { content, expectedVersion }, sin una clave de más', async () => {
    const api = stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () => jsonResponse(documentContentSaved()),
    });

    await saveDocumentContent('doc-diario', '# Diario\n', 3);

    // El `ValidationPipe` del backend va con `forbidNonWhitelisted`: una clave de más (`id`,
    // `title`, `contentVersion`…) no es un detalle cosmético, es un 400. Por eso se afirma el juego
    // exacto de claves y no que el cuerpo "contenga" las dos.
    expect(api.calls[0]?.body).toEqual({ content: '# Diario\n', expectedVersion: 3 });
    expect(Object.keys(api.calls[0]?.body as object).sort()).toEqual([
      'content',
      'expectedVersion',
    ]);
  });

  it('manda Authorization: Bearer, el Content-Type de JSON y credentials: include', async () => {
    const api = stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () => jsonResponse(documentContentSaved()),
    });

    await saveDocumentContent('doc-diario', '', 0);

    expect(api.calls[0]?.headers['authorization']).toBe('Bearer access-token-1');
    expect(api.calls[0]?.headers['content-type']).toBe('application/json');
    expect(api.calls[0]?.credentials).toBe('include');
  });

  it('guardar contenido vacío es legítimo: manda content: "" y no lo omite', async () => {
    const api = stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () =>
        jsonResponse(documentContentSaved({ contentBytes: 0, contentVersion: 4 })),
    });

    const saved = await saveDocumentContent('doc-diario', '', 3);

    expect(api.calls[0]?.body).toEqual({ content: '', expectedVersion: 3 });
    expect(saved.contentBytes).toBe(0);
  });

  it('devuelve las cuatro claves del guardado, con la contentVersion ya incrementada', async () => {
    stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () =>
        jsonResponse(
          documentContentSaved({
            contentBytes: 10,
            contentVersion: 1,
            updatedAt: '2026-07-28T09:00:00.000Z',
          }),
        ),
    });

    const saved = await saveDocumentContent('doc-diario', '# Hola ñ', 0);

    expect(saved).toEqual({
      id: 'doc-diario',
      contentBytes: 10,
      contentVersion: 1,
      updatedAt: '2026-07-28T09:00:00.000Z',
    });
  });

  it('codifica el id en la ruta con encodeURIComponent', async () => {
    // Las dos rutas están simuladas a propósito: si la codificación desapareciera, la petición
    // seguiría respondiendo 200 y el caso caería en la aserción sobre la ruta —que es lo que se está
    // midiendo— en vez de en un "ruta no simulada", que sería un rojo por otro motivo.
    const api = stubApi({
      [`PUT /api/workspace/documents/${AWKWARD_ID_ENCODED}/content`]: () =>
        jsonResponse(documentContentSaved({ id: AWKWARD_ID })),
      [`PUT /api/workspace/documents/${AWKWARD_ID}/content`]: () =>
        jsonResponse(documentContentSaved({ id: AWKWARD_ID })),
    });

    await saveDocumentContent(AWKWARD_ID, 'texto', 0);

    expect(api.calls[0]?.path).toBe(`/api/workspace/documents/${AWKWARD_ID_ENCODED}/content`);
    expect(api.calls[0]?.path).not.toContain(AWKWARD_ID);
  });

  it('lanza ApiError cuando la respuesta no cumple isDocumentContentSaved', async () => {
    const { contentVersion: _ignored, ...sinContentVersion } = documentContentSaved();
    stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () => jsonResponse(sinContentVersion),
    });

    const error = (await saveDocumentContent('doc-diario', 'texto', 0).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(0);
  });

  it('lanza ApiError cuando el contentVersion de la respuesta no es numérico', async () => {
    stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () =>
        jsonResponse({ ...documentContentSaved(), contentVersion: '1' }),
    });

    await expect(saveDocumentContent('doc-diario', 'texto', 0)).rejects.toBeInstanceOf(ApiError);
  });

  it('un 409 propaga un ApiError cuyo code es exactamente DOCUMENT_CONTENT_CONFLICT', async () => {
    stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () =>
        apiErrorResponse(409, 'El documento cambió desde que lo abriste', {
          code: 'DOCUMENT_CONTENT_CONFLICT',
        }),
    });

    const error = (await saveDocumentContent('doc-diario', 'texto', 0).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(409);
    // Exactamente este código, no "un error". Es el único que obliga al editor (T-013) a una rama de
    // interfaz entera; degradado a genérico, el usuario pierde su texto sin que nadie se entere.
    expect(error.code).toBe('DOCUMENT_CONTENT_CONFLICT');
    expect(error.message).toContain('El documento cambió desde que lo abriste');
  });

  it('un 404 de documento ajeno o inexistente conserva su code y no se reintenta', async () => {
    const api = stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () =>
        apiErrorResponse(404, 'El documento no existe', { code: 'DOCUMENT_NOT_FOUND' }),
    });

    const error = (await saveDocumentContent('doc-diario', 'texto', 0).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('DOCUMENT_NOT_FOUND');
    expect(api.calls).toHaveLength(1);
  });

  it('un 400 llega con el mensaje del servidor, que es el que verá el usuario', async () => {
    stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () =>
        apiErrorResponse(400, ['content no puede superar los 200000 caracteres']),
    });

    const error = (await saveDocumentContent('doc-diario', 'x', 0).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error.statusCode).toBe(400);
    expect(error.messages).toEqual(['content no puede superar los 200000 caracteres']);
  });

  it('un 429 llega tal cual, sin reintento del cliente HTTP', async () => {
    const api = stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () =>
        apiErrorResponse(429, 'Demasiados guardados, prueba en un momento'),
    });

    const error = (await saveDocumentContent('doc-diario', 'texto', 0).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error.statusCode).toBe(429);
    expect(api.calls).toHaveLength(1);
  });

  it('un 401 SÍ dispara un refresh y un reintento: aquí el 401 es el bearer caducado', async () => {
    let saveCalls = 0;
    const api = stubApi({
      'PUT /api/workspace/documents/doc-diario/content': () => {
        saveCalls += 1;

        return saveCalls === 1
          ? apiErrorResponse(401, 'Token expirado')
          : jsonResponse(documentContentSaved({ contentVersion: 2 }));
      },
      'POST /api/auth/refresh': () => jsonResponse(authSession({ accessToken: 'access-token-2' })),
    });

    const saved = await saveDocumentContent('doc-diario', 'texto', 1);

    expect(saved.contentVersion).toBe(2);
    expect(api.calls).toHaveLength(3);
    expect(api.callsTo('POST /api/auth/refresh')).toHaveLength(1);
    expect(
      api.callsTo('PUT /api/workspace/documents/doc-diario/content')[1]?.headers['authorization'],
    ).toBe('Bearer access-token-2');
  });
});
