import {
  isApiErrorShape,
  isAuthSession,
  isAuthUser,
  isHealth,
  isLoginResult,
  isMfaRecoveryCodes,
  isMfaSetup,
  type AuthSession,
  type AuthUser,
  type Health,
  type LoginResult,
  type MfaRecoveryCodes,
  type MfaSetup,
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

  constructor(params: {
    statusCode: number;
    messages: string[];
    retryAfterSeconds?: number | null;
  }) {
    super(params.messages.join(' · '));
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    this.messages = params.messages;
    this.retryAfterSeconds = params.retryAfterSeconds ?? null;
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
  readonly method: 'GET' | 'POST';
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
 */
async function authorizedJson(
  path: string,
  request: JsonRequest,
  options: AuthorizedOptions = { refreshOn401: true },
): Promise<unknown> {
  const first = await sendRequest(path, buildInit(request, authBridge.getAccessToken()));

  if (first.status !== 401 || !options.refreshOn401) {
    return toJson(first);
  }

  await refreshSession();

  return toJson(await sendRequest(path, buildInit(request, authBridge.getAccessToken())));
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
  const response = await sendRequest('/auth/logout', buildInit({ method: 'POST' }, null));

  if (!response.ok) {
    throw errorFrom(response, await readJson(response));
  }
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
