import { describe, expect, it } from 'vitest';

import {
  isApiErrorShape,
  isAuthSession,
  isAuthUser,
  isDirectoryNode,
  isDocumentSummary,
  isHealth,
  isLoginResult,
  isMarkdownDocument,
  isMfaRecoveryCodes,
  isMfaSetup,
  isReadiness,
  isWorkspaceTree,
  type AuthSession,
  type AuthUser,
  type DirectoryNode,
  type DocumentSummary,
  type Health,
  type LoginResult,
  type MarkdownDocument,
  type MfaRecoveryCodes,
  type MfaSetup,
  type WorkspaceTree,
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

  it('acepta el 409 de workspace con su code de dominio (spec 002, decisión 13)', () => {
    expect(
      isApiErrorShape({
        statusCode: 409,
        error: 'Conflict',
        message: 'Ya existe un directorio con ese nombre.',
        path: '/api/workspace/directories',
        timestamp: '2026-07-25T00:00:00.000Z',
        code: 'DIRECTORY_NAME_TAKEN',
      }),
    ).toBe(true);
  });

  it('rechaza un code presente pero no textual: el cliente no podría discriminar con él', () => {
    expect(
      isApiErrorShape({
        statusCode: 409,
        error: 'Conflict',
        message: 'Ya existe un directorio con ese nombre.',
        path: '/api/workspace/directories',
        timestamp: '2026-07-25T00:00:00.000Z',
        code: 409,
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

// ---------------------------------------------------------------------------------------------
// Workspace (specs/002-workspace-tree/plan.md §4 y §7)
// ---------------------------------------------------------------------------------------------

const validRootDirectory: DirectoryNode = {
  id: 'd4f1c0a9-8a1d-4f2b-9c7e-2b6d5a4f1e01',
  name: 'Notas',
  parentId: null,
  depth: 0,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
};

const validChildDirectory: DirectoryNode = {
  id: 'd4f1c0a9-8a1d-4f2b-9c7e-2b6d5a4f1e02',
  name: 'Ideas',
  parentId: validRootDirectory.id,
  depth: 1,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
};

const validSummary: DocumentSummary = {
  id: 'e5f6a7b8-8a1d-4f2b-9c7e-2b6d5a4f1e03',
  title: 'Lista de la compra',
  directoryId: null,
  contentBytes: 9,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
};

const validDocument: MarkdownDocument = { ...validSummary, content: '# Hola' };

const validTree: WorkspaceTree = {
  directories: [validRootDirectory, validChildDirectory],
  documents: [validSummary],
  generatedAt: '2026-07-25T00:00:00.000Z',
};

describe('isDirectoryNode (AC-27)', () => {
  it('acepta un directorio en la raíz con parentId null', () => {
    expect(isDirectoryNode(validRootDirectory)).toBe(true);
  });

  it('acepta un directorio anidado con parentId y depth > 0', () => {
    expect(isDirectoryNode(validChildDirectory)).toBe(true);
  });

  it('rechaza parentId ausente en vez de null', () => {
    const { parentId: _omitted, ...withoutParentId } = validRootDirectory;
    expect(isDirectoryNode(withoutParentId)).toBe(false);
  });

  it('rechaza depth no numérico', () => {
    expect(isDirectoryNode({ ...validRootDirectory, depth: '0' })).toBe(false);
    expect(isDirectoryNode({ ...validRootDirectory, depth: null })).toBe(false);
  });

  it('rechaza un parentId presente que no es texto ni null', () => {
    expect(isDirectoryNode({ ...validRootDirectory, parentId: 7 })).toBe(false);
  });

  it('rechaza id/name/createdAt/updatedAt no textuales, null y primitivos', () => {
    expect(isDirectoryNode({ ...validRootDirectory, id: 7 })).toBe(false);
    expect(isDirectoryNode({ ...validRootDirectory, name: null })).toBe(false);
    expect(isDirectoryNode({ ...validRootDirectory, createdAt: 1_753_401_600_000 })).toBe(false);
    expect(isDirectoryNode({ ...validRootDirectory, updatedAt: undefined })).toBe(false);
    expect(isDirectoryNode(null)).toBe(false);
    expect(isDirectoryNode('Notas')).toBe(false);
  });

  it('no exige content: un directorio no lo tiene', () => {
    expect('content' in validRootDirectory).toBe(false);
  });
});

describe('isDocumentSummary (AC-27)', () => {
  it('acepta un documento en la raíz con directoryId null', () => {
    expect(isDocumentSummary(validSummary)).toBe(true);
  });

  it('acepta un documento dentro de un directorio', () => {
    expect(isDocumentSummary({ ...validSummary, directoryId: validRootDirectory.id })).toBe(true);
  });

  it('acepta el resumen que llega con content: el árbol no lo manda, pero sobrar no invalida', () => {
    expect(isDocumentSummary(validDocument)).toBe(true);
  });

  it('rechaza directoryId ausente en vez de null', () => {
    const { directoryId: _omitted, ...withoutDirectoryId } = validSummary;
    expect(isDocumentSummary(withoutDirectoryId)).toBe(false);
  });

  it('rechaza contentBytes no numérico', () => {
    expect(isDocumentSummary({ ...validSummary, contentBytes: '9' })).toBe(false);
    expect(isDocumentSummary({ ...validSummary, contentBytes: null })).toBe(false);
  });

  it('rechaza title no textual, null y primitivos', () => {
    expect(isDocumentSummary({ ...validSummary, title: 7 })).toBe(false);
    expect(isDocumentSummary(null)).toBe(false);
    expect(isDocumentSummary('Ideas')).toBe(false);
  });
});

describe('isMarkdownDocument (AC-27)', () => {
  it('acepta el detalle con su markdown', () => {
    expect(isMarkdownDocument(validDocument)).toBe(true);
  });

  it('acepta un documento en blanco con content vacío', () => {
    expect(isMarkdownDocument({ ...validDocument, content: '' })).toBe(true);
  });

  it('rechaza un documento sin content: el resumen del árbol no vale como detalle', () => {
    expect(isMarkdownDocument(validSummary)).toBe(false);
  });

  it('rechaza content no textual, incluido null', () => {
    expect(isMarkdownDocument({ ...validDocument, content: 7 })).toBe(false);
    expect(isMarkdownDocument({ ...validDocument, content: null })).toBe(false);
  });

  it('rechaza directoryId ausente y contentBytes no numérico, igual que el resumen', () => {
    const { directoryId: _omitted, ...withoutDirectoryId } = validDocument;
    expect(isMarkdownDocument(withoutDirectoryId)).toBe(false);
    expect(isMarkdownDocument({ ...validDocument, contentBytes: '6' })).toBe(false);
  });
});

describe('isWorkspaceTree (AC-27)', () => {
  it('acepta el cuerpo exacto de GET /api/workspace/tree', () => {
    expect(isWorkspaceTree(validTree)).toBe(true);
  });

  it('acepta un workspace vacío con los dos arrays vacíos', () => {
    expect(
      isWorkspaceTree({ directories: [], documents: [], generatedAt: validTree.generatedAt }),
    ).toBe(true);
  });

  it('rechaza documents que no es un array', () => {
    expect(isWorkspaceTree({ ...validTree, documents: validSummary })).toBe(false);
    expect(isWorkspaceTree({ ...validTree, documents: null })).toBe(false);
  });

  it('rechaza directories que no es un array', () => {
    expect(isWorkspaceTree({ ...validTree, directories: validRootDirectory })).toBe(false);
  });

  it('rechaza un elemento de documents inválido', () => {
    const { directoryId: _omitted, ...brokenSummary } = validSummary;
    expect(isWorkspaceTree({ ...validTree, documents: [validSummary, brokenSummary] })).toBe(false);
    expect(isWorkspaceTree({ ...validTree, documents: [{ id: 'x' }] })).toBe(false);
  });

  it('rechaza un elemento de directories inválido', () => {
    expect(
      isWorkspaceTree({
        ...validTree,
        directories: [validRootDirectory, { ...validChildDirectory, depth: '1' }],
      }),
    ).toBe(false);
  });

  it('rechaza generatedAt ausente o no textual', () => {
    const { generatedAt: _omitted, ...withoutGeneratedAt } = validTree;
    expect(isWorkspaceTree(withoutGeneratedAt)).toBe(false);
    expect(isWorkspaceTree({ ...validTree, generatedAt: 1_753_401_600_000 })).toBe(false);
  });

  it('rechaza null y primitivos', () => {
    expect(isWorkspaceTree(null)).toBe(false);
    expect(isWorkspaceTree([])).toBe(false);
  });
});
