import {
  isApiErrorShape,
  isAuthSession,
  isAuthUser,
  isDirectoryNode,
  isDocumentContentSaved,
  isDocumentSummary,
  isHealth,
  isLoginResult,
  isMarkdownDocument,
  isMfaRecoveryCodes,
  isMfaSetup,
  isWorkspaceTree,
  type AuthSession,
  type AuthUser,
  type DirectoryNode,
  type DocumentContentSaved,
  type DocumentSummary,
  type Health,
  type LoginResult,
  type MarkdownDocument,
  type MfaRecoveryCodes,
  type MfaSetup,
  type WorkspaceTree,
} from '@one-markdown/shared';

/** Todas las llamadas van al mismo origen: en dev lo resuelve el proxy de Vite. */
const API_BASE = '/api';

/**
 * Error único del cliente HTTP. `statusCode: 0` significa que la petición nunca llegó a
 * responder (red caída, CORS, abort), que es distinto de un error devuelto por la API.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly messages: string[];
  /**
   * Segundos que hay que esperar antes de reintentar. Solo lo trae el `429` de cuenta bloqueada;
   * el resto de errores lo dejan en `null` para que la UI pueda distinguir "espera 15 minutos" de
   * "algo falló".
   */
  readonly retryAfterSeconds: number | null;
  /**
   * Código estable del error de dominio (`DIRECTORY_NAME_TAKEN`, `MOVE_INTO_DESCENDANT`, …), o
   * `null` si el error no trae ninguno. Es deliberadamente `string` y no una unión cerrada: la UI
   * compara con los códigos que conoce y cae al mensaje genérico con el resto, así que un código
   * nuevo del backend no rompe el cliente (decisión 13 del plan de la spec 002).
   */
  readonly code: string | null;

  constructor(params: {
    statusCode: number;
    messages: string[];
    retryAfterSeconds?: number | null;
    code?: string | null;
  }) {
    super(params.messages.join(' · '));
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    this.messages = params.messages;
    this.retryAfterSeconds = params.retryAfterSeconds ?? null;
    this.code = params.code ?? null;
  }
}

/**
 * Puente entre el cliente HTTP y el dueño de la sesión (`useAuthStore`).
 *
 * Se inyecta en vez de importar el store para no crear un ciclo (`auth.store` → `http` → `auth.store`)
 * y para que los tests del cliente puedan ejercitarlo sin montar el store.
 */
export interface AuthBridge {
  /** Token de acceso vigente, siempre en memoria. `null` si no hay sesión. */
  readonly getAccessToken: () => string | null;
  /** El refresh devolvió una sesión nueva: el dueño de la sesión debe adoptarla. */
  readonly onSessionRenewed: (session: AuthSession) => void;
  /** El refresh falló: la sesión se perdió y no se puede recuperar sin volver a autenticarse. */
  readonly onSessionLost: () => void;
}

const detachedBridge: AuthBridge = {
  getAccessToken: () => null,
  onSessionRenewed: () => undefined,
  onSessionLost: () => undefined,
};

let authBridge: AuthBridge = detachedBridge;

export function configureAuthBridge(bridge: AuthBridge): void {
  authBridge = bridge;
}

interface JsonRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Cuerpo a serializar como JSON. Ausente = petición sin cuerpo (y sin `Content-Type`). */
  readonly body?: unknown;
}

function buildInit(request: JsonRequest, accessToken: string | null): RequestInit {
  const headers: Record<string, string> = {};

  if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken !== null) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return {
    method: request.method,
    headers,
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
  };
}

async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    // `credentials` va al final a propósito: sin él la cookie `HttpOnly` de refresh no viaja y el
    // refresh silencioso no puede funcionar. Ninguna llamada debe poder desactivarlo.
    return await fetch(`${API_BASE}${path}`, { method: 'GET', ...init, credentials: 'include' });
  } catch (cause) {
    throw new ApiError({
      statusCode: 0,
      messages: [cause instanceof Error ? cause.message : 'La petición no pudo completarse'],
    });
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function errorFrom(response: Response, body: unknown): ApiError {
  // El backend promete ErrorResponseDto, pero un proxy o un balanceador pueden colarse en medio
  // con HTML: por eso el cuerpo se valida en vez de asumirse.
  if (isApiErrorShape(body)) {
    return new ApiError({
      statusCode: body.statusCode,
      messages: Array.isArray(body.message) ? body.message : [body.message],
      retryAfterSeconds: body.retryAfterSeconds ?? null,
      code: body.code ?? null,
    });
  }

  return new ApiError({
    statusCode: response.status,
    messages: [`Respuesta de error no reconocida (HTTP ${String(response.status)})`],
  });
}

async function toJson(response: Response): Promise<unknown> {
  const body = await readJson(response);

  if (!response.ok) {
    throw errorFrom(response, body);
  }

  return body;
}

/**
 * Camino para las respuestas **sin cuerpo** (`204` de los borrados y del logout): comprueba el
 * estado y no toca el cuerpo. Parsearlo daría `undefined` y cualquier validación posterior lo
 * tomaría por una respuesta que incumple el contrato; el cuerpo de un error sí se lee, porque ahí
 * el `ErrorResponseDto` es justo lo que hay que traducir.
 */
async function toNothing(response: Response): Promise<void> {
  if (!response.ok) {
    throw errorFrom(response, await readJson(response));
  }
}

function expectShape<T>(
  value: unknown,
  guard: (candidate: unknown) => candidate is T,
  what: string,
): T {
  if (!guard(value)) {
    throw new ApiError({
      statusCode: 0,
      messages: [`La respuesta de ${what} no cumple el contrato`],
    });
  }

  return value;
}

/** Petición sin credencial de sesión: registro, login, canje de MFA, refresh y logout. */
async function publicJson(path: string, request: JsonRequest): Promise<unknown> {
  return toJson(await sendRequest(path, buildInit(request, null)));
}

interface AuthorizedOptions {
  /**
   * `false` para los endpoints donde un `401` significa "la credencial que mandaste **en el cuerpo**
   * es incorrecta" (el código TOTP de `mfa/enable`, la contraseña de `mfa/disable`) y no "tu bearer
   * caducó". Sin esta distinción, teclear mal un código dispararía un refresh, reintentaría el
   * código equivocado y, si el refresh no llega, cerraría la sesión en medio del enrolamiento.
   */
  readonly refreshOn401: boolean;
}

/**
 * Petición con `Authorization: Bearer`. Ante un `401` hace **un** refresh y **un** reintento
 * (AC-24). Si el refresh falla, propaga el error: el aviso de sesión perdida ya lo dio el refresh.
 *
 * Devuelve la `Response` sin interpretarla, porque quien decide si hay cuerpo que leer es la
 * función de contrato: el reintento es idéntico para un `GET` con JSON y para un `DELETE` con `204`.
 */
async function authorizedResponse(
  path: string,
  request: JsonRequest,
  options: AuthorizedOptions = { refreshOn401: true },
): Promise<Response> {
  const first = await sendRequest(path, buildInit(request, authBridge.getAccessToken()));

  if (first.status !== 401 || !options.refreshOn401) {
    return first;
  }

  await refreshSession();

  return sendRequest(path, buildInit(request, authBridge.getAccessToken()));
}

async function authorizedJson(
  path: string,
  request: JsonRequest,
  options?: AuthorizedOptions,
): Promise<unknown> {
  return toJson(await authorizedResponse(path, request, options));
}

/** Igual que `authorizedJson`, para los endpoints cuyo éxito es un `204` sin cuerpo. */
async function authorizedNoContent(path: string, request: JsonRequest): Promise<void> {
  return toNothing(await authorizedResponse(path, request));
}

let refreshInFlight: Promise<AuthSession> | null = null;

async function runRefresh(): Promise<AuthSession> {
  try {
    const session = expectShape(
      await publicJson('/auth/refresh', { method: 'POST' }),
      isAuthSession,
      '/api/auth/refresh',
    );

    authBridge.onSessionRenewed(session);

    return session;
  } catch (cause) {
    authBridge.onSessionLost();
    throw cause;
  } finally {
    refreshInFlight = null;
  }
}

/**
 * Rota el refresh token y devuelve la sesión nueva. Es *single-flight*: varias llamadas
 * concurrentes comparten la misma promesa, así que un `401` simultáneo en N peticiones produce un
 * único refresh (y una única rotación de cookie, que es lo que el backend permite).
 */
export function refreshSession(): Promise<AuthSession> {
  refreshInFlight ??= runRefresh();

  return refreshInFlight;
}

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface MfaVerifyInput {
  readonly mfaToken: string;
  readonly code: string;
}

export interface MfaDisableInput {
  readonly password: string;
  readonly code: string;
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  return expectShape(
    await publicJson('/auth/register', { method: 'POST', body: input }),
    isAuthSession,
    '/api/auth/register',
  );
}

export async function login(input: LoginInput): Promise<LoginResult> {
  return expectShape(
    await publicJson('/auth/login', { method: 'POST', body: input }),
    isLoginResult,
    '/api/auth/login',
  );
}

export async function verifyMfa(input: MfaVerifyInput): Promise<AuthSession> {
  return expectShape(
    await publicJson('/auth/mfa/verify', { method: 'POST', body: input }),
    isAuthSession,
    '/api/auth/mfa/verify',
  );
}

export async function logout(): Promise<void> {
  return toNothing(await sendRequest('/auth/logout', buildInit({ method: 'POST' }, null)));
}

export async function getMe(): Promise<AuthUser> {
  return expectShape(
    await authorizedJson('/auth/me', { method: 'GET' }),
    isAuthUser,
    '/api/auth/me',
  );
}

export async function mfaSetup(): Promise<MfaSetup> {
  return expectShape(
    await authorizedJson('/auth/mfa/setup', { method: 'POST' }),
    isMfaSetup,
    '/api/auth/mfa/setup',
  );
}

export async function mfaEnable(code: string): Promise<MfaRecoveryCodes> {
  return expectShape(
    await authorizedJson(
      '/auth/mfa/enable',
      { method: 'POST', body: { code } },
      { refreshOn401: false },
    ),
    isMfaRecoveryCodes,
    '/api/auth/mfa/enable',
  );
}

export async function mfaDisable(input: MfaDisableInput): Promise<AuthUser> {
  return expectShape(
    await authorizedJson(
      '/auth/mfa/disable',
      { method: 'POST', body: input },
      { refreshOn401: false },
    ),
    isAuthUser,
    '/api/auth/mfa/disable',
  );
}

export async function getHealth(): Promise<Health> {
  return expectShape(await publicJson('/health', { method: 'GET' }), isHealth, '/api/health');
}

// ---------------------------------------------------------------------------------------------
// Workspace (specs/002-workspace-tree/plan.md §4 y §7): diez rutas, todas con bearer.
// ---------------------------------------------------------------------------------------------

export interface CreateDirectoryInput {
  readonly name: string;
  /** `null` explícito para la raíz; nunca ausente (decisión 11 del plan). */
  readonly parentId: string | null;
}

export interface CreateDocumentInput {
  readonly title: string;
  readonly directoryId: string | null;
  /** Ausente = documento en blanco; el backend lo guarda como cadena vacía. */
  readonly content?: string;
}

function directoryPath(id: string): string {
  return `/workspace/directories/${encodeURIComponent(id)}`;
}

function documentPath(id: string): string {
  return `/workspace/documents/${encodeURIComponent(id)}`;
}

export async function getWorkspaceTree(): Promise<WorkspaceTree> {
  return expectShape(
    await authorizedJson('/workspace/tree', { method: 'GET' }),
    isWorkspaceTree,
    '/api/workspace/tree',
  );
}

export async function createDirectory(input: CreateDirectoryInput): Promise<DirectoryNode> {
  return expectShape(
    await authorizedJson('/workspace/directories', { method: 'POST', body: input }),
    isDirectoryNode,
    '/api/workspace/directories',
  );
}

export async function renameDirectory(id: string, name: string): Promise<DirectoryNode> {
  return expectShape(
    await authorizedJson(directoryPath(id), { method: 'PATCH', body: { name } }),
    isDirectoryNode,
    'PATCH /api/workspace/directories/:id',
  );
}

export async function moveDirectory(id: string, parentId: string | null): Promise<DirectoryNode> {
  return expectShape(
    await authorizedJson(`${directoryPath(id)}/move`, { method: 'POST', body: { parentId } }),
    isDirectoryNode,
    'POST /api/workspace/directories/:id/move',
  );
}

export async function deleteDirectory(id: string, recursive: boolean): Promise<void> {
  // `recursive` viaja siempre explícito: el backend acepta solo 'true' y 'false', y mandarlo
  // siempre hace que el borrado no recursivo sea visible en la petición en vez de implícito.
  return authorizedNoContent(`${directoryPath(id)}?recursive=${recursive ? 'true' : 'false'}`, {
    method: 'DELETE',
  });
}

export async function createDocument(input: CreateDocumentInput): Promise<MarkdownDocument> {
  const body = {
    title: input.title,
    directoryId: input.directoryId,
    ...(input.content === undefined ? {} : { content: input.content }),
  };

  return expectShape(
    await authorizedJson('/workspace/documents', { method: 'POST', body }),
    isMarkdownDocument,
    '/api/workspace/documents',
  );
}

export async function getDocument(id: string): Promise<MarkdownDocument> {
  return expectShape(
    await authorizedJson(documentPath(id), { method: 'GET' }),
    isMarkdownDocument,
    'GET /api/workspace/documents/:id',
  );
}

export async function renameDocument(id: string, title: string): Promise<DocumentSummary> {
  return expectShape(
    await authorizedJson(documentPath(id), { method: 'PATCH', body: { title } }),
    isDocumentSummary,
    'PATCH /api/workspace/documents/:id',
  );
}

export async function moveDocument(
  id: string,
  directoryId: string | null,
): Promise<DocumentSummary> {
  return expectShape(
    await authorizedJson(`${documentPath(id)}/move`, { method: 'POST', body: { directoryId } }),
    isDocumentSummary,
    'POST /api/workspace/documents/:id/move',
  );
}

export async function deleteDocument(id: string): Promise<void> {
  return authorizedNoContent(documentPath(id), { method: 'DELETE' });
}

/**
 * Guarda el markdown de un documento (spec `003`, AC-15).
 *
 * `expectedVersion` es el `contentVersion` que el cliente leyó, y viaja **en el cuerpo** y no en una
 * cabecera (decisión 2 del plan `003`). El servidor lo exige en el `where` del update, así que dos
 * guardados desde la misma versión no pueden pisarse: el perdedor recibe un `409` con
 * `code: 'DOCUMENT_CONTENT_CONFLICT'`, que es el único código al que el editor reacciona con una
 * rama de interfaz propia en vez de con el aviso genérico.
 *
 * El cuerpo lleva **exactamente** `content` y `expectedVersion`. Una clave de más —el `id`, el
 * `title`, la versión ya incrementada— no se ignora: el `ValidationPipe` global va con
 * `forbidNonWhitelisted` y responde `400`.
 *
 * Va por `authorizedJson` con el refresh-on-401 **por defecto**: aquí, a diferencia de
 * `mfa/enable` y `mfa/disable`, no hay ninguna credencial en el cuerpo, así que un `401` solo puede
 * significar que el bearer caducó y reintentar tras refrescar es lo correcto.
 */
export async function saveDocumentContent(
  id: string,
  content: string,
  expectedVersion: number,
): Promise<DocumentContentSaved> {
  return expectShape(
    await authorizedJson(`${documentPath(id)}/content`, {
      method: 'PUT',
      body: { content, expectedVersion },
    }),
    isDocumentContentSaved,
    'PUT /api/workspace/documents/:id/content',
  );
}
