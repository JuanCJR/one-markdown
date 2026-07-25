import { describe, expect, it } from 'vitest';

import { isApiErrorShape, isHealth, isReadiness, type Health } from './index';

const validHealth: Health = { status: 'ok', uptimeSeconds: 12, version: '0.0.0' };

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
});
