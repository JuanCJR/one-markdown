import { isApiErrorShape, isHealth, type Health } from '@one-markdown/shared';

/** Todas las llamadas van al mismo origen: en dev lo resuelve el proxy de Vite. */
const API_BASE = '/api';

/**
 * Error único del cliente HTTP. `statusCode: 0` significa que la petición nunca llegó a
 * responder (red caída, CORS, abort), que es distinto de un error devuelto por la API.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly messages: string[];

  constructor(params: { statusCode: number; messages: string[] }) {
    super(params.messages.join(' · '));
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    this.messages = params.messages;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, { method: 'GET', ...init });
  } catch (cause) {
    throw new ApiError({
      statusCode: 0,
      messages: [cause instanceof Error ? cause.message : 'La petición no pudo completarse'],
    });
  }

  const body = await readJson(response);

  if (!response.ok) {
    // El backend promete ErrorResponseDto, pero un proxy o un balanceador pueden colarse en medio
    // con HTML: por eso el cuerpo se valida en vez de asumirse.
    if (isApiErrorShape(body)) {
      throw new ApiError({
        statusCode: body.statusCode,
        messages: Array.isArray(body.message) ? body.message : [body.message],
      });
    }

    throw new ApiError({
      statusCode: response.status,
      messages: [`Respuesta de error no reconocida (HTTP ${String(response.status)})`],
    });
  }

  return body;
}

export async function getHealth(): Promise<Health> {
  const body = await requestJson('/health');

  if (!isHealth(body)) {
    throw new ApiError({
      statusCode: 0,
      messages: ['La respuesta de /api/health no cumple el contrato Health'],
    });
  }

  return body;
}
