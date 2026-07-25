import { vi } from 'vitest';

/**
 * Doble de `fetch` con tabla de rutas, compartido por los tests de cliente HTTP, store y páginas.
 *
 * No es un mock del cliente HTTP: sustituye la red, así que los tests siguen ejercitando el código
 * real de `http.ts` (cabeceras, `credentials`, reintentos). Una ruta no declarada revienta con un
 * mensaje explícito en vez de devolver `undefined`, para que una llamada inesperada se vea.
 */

export interface StubbedRequest {
  /** Método en mayúsculas; `GET` cuando el `init` no lo declara. */
  readonly method: string;
  /** Ruta tal cual la pidió el cliente, con el prefijo `/api`. */
  readonly path: string;
  /** Cuerpo JSON ya parseado, o `undefined` si la petición no llevaba cuerpo. */
  readonly body: unknown;
  readonly headers: Record<string, string>;
  readonly credentials: RequestCredentials | undefined;
}

export type StubHandler = (request: StubbedRequest) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

/** Réplica de `ErrorResponseDto`, la forma única de error de la API. */
export function apiErrorResponse(
  statusCode: number,
  message: string | string[],
  extra: { readonly retryAfterSeconds?: number } = {},
): Response {
  return jsonResponse(
    {
      statusCode,
      error: 'Error',
      message,
      path: '/api',
      timestamp: '2026-07-24T00:00:00.000Z',
      ...extra,
    },
    statusCode,
  );
}

export interface Deferred {
  /** Se entrega como respuesta del handler; queda pendiente hasta `resolveWith`. */
  readonly response: Promise<Response>;
  resolveWith: (response: Response) => void;
}

/** Respuesta que el test decide cuándo llega, para observar el estado "petición en vuelo". */
export function deferredResponse(): Deferred {
  let release: (response: Response) => void = () => undefined;

  const response = new Promise<Response>((resolve) => {
    release = resolve;
  });

  return { response, resolveWith: (value) => release(value) };
}

export interface ApiStub {
  /** Todas las peticiones observadas, en orden. */
  readonly calls: readonly StubbedRequest[];
  /** Peticiones a una ruta concreta, en el formato `'POST /api/auth/refresh'`. */
  callsTo: (route: string) => readonly StubbedRequest[];
}

function readHeaders(headers: HeadersInit | undefined): Record<string, string> {
  return Object.fromEntries(new Headers(headers).entries());
}

function readJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

export function stubApi(routes: Record<string, StubHandler>): ApiStub {
  const calls: StubbedRequest[] = [];

  const fetchStub = vi.fn((input: string, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const request: StubbedRequest = {
      method,
      path: input,
      body: readJsonBody(init?.body),
      headers: readHeaders(init?.headers),
      credentials: init?.credentials,
    };

    calls.push(request);

    const handler = routes[`${method} ${input}`];

    if (handler === undefined) {
      return Promise.reject(new Error(`Ruta no simulada en el test: ${method} ${input}`));
    }

    return Promise.resolve(handler(request));
  });

  vi.stubGlobal('fetch', fetchStub);

  return {
    calls,
    callsTo: (route) => calls.filter((call) => `${call.method} ${call.path}` === route),
  };
}
