import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, getHealth } from './http';

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
