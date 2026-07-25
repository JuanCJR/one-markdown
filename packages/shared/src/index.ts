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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

  return (
    typeof value['statusCode'] === 'number' &&
    typeof value['error'] === 'string' &&
    (typeof message === 'string' ||
      (Array.isArray(message) && message.every((item) => typeof item === 'string'))) &&
    typeof value['path'] === 'string' &&
    typeof value['timestamp'] === 'string'
  );
}
