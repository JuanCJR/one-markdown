/**
 * Contrato compartido entre `apps/api` y `apps/web`.
 *
 * Regla: el backend es la fuente de verdad. Estos tipos se derivan de los DTO de respuesta de la
 * API y no al revés. Aquí solo viajan tipos y guards sin dependencias de runtime — nada de
 * class-validator ni decoradores, que no tienen por qué llegar al bundle del navegador.
 */

export type HealthStatus = 'ok';

/** Espejo de `HealthResponseDto` (GET /api/health). */
export interface Health {
  readonly status: HealthStatus;
  readonly uptimeSeconds: number;
  readonly version: string;
}

export type CheckState = 'up' | 'down';
export type ReadinessState = 'ready' | 'not_ready';

/** Espejo de `ReadinessChecksDto`. */
export interface ReadinessChecks {
  readonly database: CheckState;
  readonly redis: CheckState;
}

/** Espejo de `ReadinessResponseDto` (GET /api/health/ready). */
export interface Readiness {
  readonly status: ReadinessState;
  readonly checks: ReadinessChecks;
}

/** Espejo de `ErrorResponseDto`: forma única de error de toda la API. */
export interface ApiErrorShape {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string | string[];
  readonly path: string;
  readonly timestamp: string;
  /**
   * Segundos que hay que esperar antes de reintentar. Lo emite solo el `429` que sabe cuánto dura el
   * castigo (cuenta bloqueada, AC-7), junto con la cabecera `Retry-After`. Es la única propiedad
   * **opcional** del contrato: el resto de errores la omiten del JSON en vez de mandarla en `null`,
   * así que aquí no puede ser `number | null` — sería mentir sobre la forma real de la respuesta.
   */
  readonly retryAfterSeconds?: number;
  /**
   * Código estable del error de dominio, para que la interfaz pueda decir algo distinto en cada
   * caso sin emparejar por el texto del `message` (que se traduce y se matiza). Lo emiten solo los
   * errores de dominio del workspace (`DIRECTORY_NAME_TAKEN`, `PARENT_NOT_FOUND`, …); un `400` de
   * validación o un `401` no lo llevan y omiten la clave, igual que `retryAfterSeconds`.
   *
   * Es `string` y no una unión cerrada a propósito: el frontend compara contra los códigos que
   * conoce y trata el resto con el mensaje genérico, así que añadir uno nuevo en el backend no
   * rompe a un cliente desplegado.
   */
  readonly code?: string;
}

// ---------------------------------------------------------------------------------------------
// Auth (specs/001-auth/plan.md §3)
//
// Regla de forma: `null` explícito, nunca propiedad ausente. Los guards la aplican de verdad
// (comprueban la presencia de la clave), porque un frontend que distingue "sin nombre" de "campo
// que no llegó" necesita que el contrato sea total y no parcial.
// ---------------------------------------------------------------------------------------------

/** El único `tokenType` que emite la API. Literal, no `string`: el cliente lo discrimina. */
export type TokenType = 'Bearer';

/** Espejo de `UserResponseDto`. Jamás lleva `passwordHash`, `mfaSecret` ni el refresh token. */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  /** `null` explícito cuando el usuario no puso nombre; nunca ausente. */
  readonly displayName: string | null;
  readonly mfaEnabled: boolean;
  /** ISO-8601. */
  readonly createdAt: string;
}

/**
 * Espejo de `AuthSessionResponseDto`. El refresh token **no** está aquí a propósito: viaja en la
 * cookie `HttpOnly` y no debe ser legible por JavaScript.
 */
export interface AuthSession {
  readonly accessToken: string;
  readonly tokenType: TokenType;
  readonly expiresInSeconds: number;
  readonly user: AuthUser;
}

/**
 * Espejo de `LoginResponseDto`. Los cuatro campos están **siempre** presentes, con `null` donde no
 * aplican: `mfaRequired` es el discriminante, no el código de estado.
 */
export interface LoginResult {
  readonly mfaRequired: boolean;
  /** Sesión abierta; `null` cuando falta el segundo factor. */
  readonly session: AuthSession | null;
  /** Acredita que la contraseña fue correcta; se canjea en `POST /api/auth/mfa/verify`. */
  readonly mfaToken: string | null;
  readonly mfaTokenExpiresInSeconds: number | null;
}

/** Espejo de `MfaSetupResponseDto`: secreto TOTP pendiente de confirmar, aún no habilitado. */
export interface MfaSetup {
  /** Base32. */
  readonly secret: string;
  readonly otpauthUri: string;
  /** `data:image/png;base64,…` */
  readonly qrCodeDataUrl: string;
  readonly expiresInSeconds: number;
}

/** Espejo de `MfaRecoveryCodesResponseDto`: se muestran una única vez y son de un solo uso. */
export interface MfaRecoveryCodes {
  /** Formato `XXXX-XXXX`. */
  readonly recoveryCodes: readonly string[];
  /** ISO-8601. */
  readonly generatedAt: string;
}

// ---------------------------------------------------------------------------------------------
// Workspace (specs/002-workspace-tree/plan.md §4 y §7)
//
// Ninguno de estos tipos se llama `Document` ni `Directory` (riesgo #10 del plan): son los nombres
// de los modelos de Prisma y `Document` además es un global del DOM, así que reutilizarlos aquí
// haría que un test que lee los modelos del esquema real —o un `lib.dom` cargado sin querer— los
// confundiera con los tipos del contrato.
//
// Misma regla de forma que en auth: `null` explícito, nunca propiedad ausente. `parentId` y
// `directoryId` viajan **siempre**, con `null` para la raíz (decisión 11 del plan).
// ---------------------------------------------------------------------------------------------

/** Espejo de `WorkspaceDirectoryResponseDto`: un directorio del árbol plano. */
export interface DirectoryNode {
  readonly id: string;
  readonly name: string;
  /** `null` explícito cuando el directorio cuelga de la raíz; nunca ausente. */
  readonly parentId: string | null;
  /** Número de ancestros: `0` en la raíz. El servidor lo calcula al leer; no es columna. */
  readonly depth: number;
  /** ISO-8601. */
  readonly createdAt: string;
  /** ISO-8601. */
  readonly updatedAt: string;
}

/**
 * Espejo de `WorkspaceDocumentSummaryResponseDto`: el documento **sin** su markdown, que es lo que
 * viaja en el árbol, en el renombrado y en el move (decisión 4 del plan).
 */
export interface DocumentSummary {
  readonly id: string;
  readonly title: string;
  /** `null` explícito cuando el documento cuelga de la raíz; nunca ausente. */
  readonly directoryId: string | null;
  /** Tamaño del contenido en **bytes UTF-8**, no en caracteres. */
  readonly contentBytes: number;
  /** ISO-8601. */
  readonly createdAt: string;
  /** ISO-8601. */
  readonly updatedAt: string;
}

/**
 * Espejo de `WorkspaceDocumentResponseDto`: el resumen más el texto. Solo lo devuelven el alta y el
 * detalle; el árbol nunca lo trae.
 */
export interface MarkdownDocument extends DocumentSummary {
  /** Markdown en crudo. Cadena vacía si el documento está en blanco. */
  readonly content: string;
}

/** Espejo de `WorkspaceTreeResponseDto` (GET /api/workspace/tree): plano, dos listas y la foto. */
export interface WorkspaceTree {
  readonly directories: readonly DirectoryNode[];
  readonly documents: readonly DocumentSummary[];
  /** ISO-8601. Sirve para descartar una respuesta que llegue tarde y pise un estado más nuevo. */
  readonly generatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * `null` explícito, no propiedad ausente: sin el `in` bastaría con omitir el campo para colar una
 * respuesta incompleta, que es justo lo que el contrato prohíbe.
 */
function isPresentAndNullOr(
  record: Record<string, unknown>,
  key: string,
  isValue: (value: unknown) => boolean,
): boolean {
  if (!(key in record)) {
    return false;
  }

  const value = record[key];

  return value === null || isValue(value);
}

function isStringValue(value: unknown): boolean {
  return typeof value === 'string';
}

function isNumberValue(value: unknown): boolean {
  return typeof value === 'number';
}

function isCheckState(value: unknown): value is CheckState {
  return value === 'up' || value === 'down';
}

export function isHealth(value: unknown): value is Health {
  return (
    isRecord(value) &&
    value['status'] === 'ok' &&
    typeof value['uptimeSeconds'] === 'number' &&
    typeof value['version'] === 'string'
  );
}

export function isReadiness(value: unknown): value is Readiness {
  if (!isRecord(value)) {
    return false;
  }

  const checks = value['checks'];

  return (
    (value['status'] === 'ready' || value['status'] === 'not_ready') &&
    isRecord(checks) &&
    isCheckState(checks['database']) &&
    isCheckState(checks['redis'])
  );
}

export function isApiErrorShape(value: unknown): value is ApiErrorShape {
  if (!isRecord(value)) {
    return false;
  }

  const message = value['message'];
  const retryAfterSeconds = value['retryAfterSeconds'];
  const code = value['code'];

  return (
    typeof value['statusCode'] === 'number' &&
    typeof value['error'] === 'string' &&
    (typeof message === 'string' ||
      (Array.isArray(message) && message.every((item) => typeof item === 'string'))) &&
    typeof value['path'] === 'string' &&
    typeof value['timestamp'] === 'string' &&
    // Opcional de verdad: la inmensa mayoría de errores no lo trae y siguen siendo válidos. Solo
    // se rechaza si viene con un tipo que el cliente no podría usar para contar segundos.
    (retryAfterSeconds === undefined || typeof retryAfterSeconds === 'number') &&
    // Mismo criterio: opcional de verdad, pero si viene tiene que ser algo con lo que el cliente
    // pueda discriminar. Un `code` numérico solo puede venir de un error de programación.
    (code === undefined || typeof code === 'string')
  );
}

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['email'] === 'string' &&
    isPresentAndNullOr(value, 'displayName', isStringValue) &&
    typeof value['mfaEnabled'] === 'boolean' &&
    typeof value['createdAt'] === 'string'
  );
}

export function isAuthSession(value: unknown): value is AuthSession {
  return (
    isRecord(value) &&
    typeof value['accessToken'] === 'string' &&
    value['tokenType'] === 'Bearer' &&
    typeof value['expiresInSeconds'] === 'number' &&
    isAuthUser(value['user'])
  );
}

export function isLoginResult(value: unknown): value is LoginResult {
  return (
    isRecord(value) &&
    typeof value['mfaRequired'] === 'boolean' &&
    isPresentAndNullOr(value, 'session', isAuthSession) &&
    isPresentAndNullOr(value, 'mfaToken', isStringValue) &&
    isPresentAndNullOr(value, 'mfaTokenExpiresInSeconds', isNumberValue)
  );
}

export function isMfaSetup(value: unknown): value is MfaSetup {
  return (
    isRecord(value) &&
    typeof value['secret'] === 'string' &&
    typeof value['otpauthUri'] === 'string' &&
    typeof value['qrCodeDataUrl'] === 'string' &&
    typeof value['expiresInSeconds'] === 'number'
  );
}

/**
 * `Array.isArray` más el guard de cada elemento. Un array con **un** elemento roto invalida la
 * respuesta entera a propósito: si el cliente aceptara la lista y confiara en el tipo, el elemento
 * malo explotaría mucho más tarde, ya dentro del render y sin rastro de dónde entró.
 */
function isArrayOf<T>(value: unknown, isItem: (item: unknown) => item is T): value is readonly T[] {
  return Array.isArray(value) && value.every(isItem);
}

export function isDirectoryNode(value: unknown): value is DirectoryNode {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    isPresentAndNullOr(value, 'parentId', isStringValue) &&
    typeof value['depth'] === 'number' &&
    typeof value['createdAt'] === 'string' &&
    typeof value['updatedAt'] === 'string'
  );
}

export function isDocumentSummary(value: unknown): value is DocumentSummary {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['title'] === 'string' &&
    isPresentAndNullOr(value, 'directoryId', isStringValue) &&
    typeof value['contentBytes'] === 'number' &&
    typeof value['createdAt'] === 'string' &&
    typeof value['updatedAt'] === 'string'
  );
}

export function isMarkdownDocument(value: unknown): value is MarkdownDocument {
  // Un `MarkdownDocument` es un `DocumentSummary` con texto, así que el detalle se valida con el
  // guard del resumen más el `content`. Al revés no vale: el resumen del árbol **no** lo trae, y
  // aceptarlo como detalle dejaría al visor pintando `undefined`.
  return isRecord(value) && isDocumentSummary(value) && typeof value['content'] === 'string';
}

export function isWorkspaceTree(value: unknown): value is WorkspaceTree {
  return (
    isRecord(value) &&
    isArrayOf(value['directories'], isDirectoryNode) &&
    isArrayOf(value['documents'], isDocumentSummary) &&
    typeof value['generatedAt'] === 'string'
  );
}

export function isMfaRecoveryCodes(value: unknown): value is MfaRecoveryCodes {
  if (!isRecord(value)) {
    return false;
  }

  const recoveryCodes = value['recoveryCodes'];

  return (
    Array.isArray(recoveryCodes) &&
    recoveryCodes.every((code) => typeof code === 'string') &&
    typeof value['generatedAt'] === 'string'
  );
}
