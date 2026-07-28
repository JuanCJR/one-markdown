import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { ErrorResponseDto } from '../dto/error.response.dto';

interface HttpExceptionBody {
  readonly message?: string | string[];
  readonly error?: string;
  /** Solo lo traen los errores que saben cuánto durará el castigo (`AccountLockedException`). */
  readonly retryAfterSeconds?: number;
  /** Código estable del error de dominio; solo lo traen los del workspace (spec 002). */
  readonly code?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractBody(exception: HttpException): HttpExceptionBody {
  const raw: unknown = exception.getResponse();

  if (typeof raw === 'string') {
    return { message: raw };
  }

  if (!isRecord(raw)) {
    return {};
  }

  const message = raw['message'];
  const error = raw['error'];
  const retryAfterSeconds = raw['retryAfterSeconds'];
  const code = raw['code'];

  return {
    ...(typeof message === 'string' || Array.isArray(message)
      ? { message: message as string | string[] }
      : {}),
    ...(typeof error === 'string' ? { error } : {}),
    // Solo un entero positivo pasa: `Retry-After` con un valor absurdo es peor que sin cabecera.
    ...(typeof retryAfterSeconds === 'number' &&
    Number.isInteger(retryAfterSeconds) &&
    retryAfterSeconds > 0
      ? { retryAfterSeconds }
      : {}),
    // Solo texto: un `code` de otro tipo solo puede venir de un error de programación, y meterlo
    // en la respuesta ensancharía la forma común del error con basura.
    ...(typeof code === 'string' && code.length > 0 ? { code } : {}),
  };
}

/**
 * Estado más bajo y más alto que la traducción de errores ajenos acepta.
 *
 * El rango es deliberadamente estrecho (`4xx` y nada más): un `5xx` que reporte una librería sigue
 * siendo un fallo del servidor y tiene que seguir registrándose con traza. Ver `clientErrorStatusOf`.
 */
const MIN_CLIENT_ERROR_STATUS = 400;
const MAX_CLIENT_ERROR_STATUS = 499;

/** Las dos propiedades por las que un error ajeno puede declarar su estado; `http-errors` pone ambas. */
const STATUS_PROPERTIES = ['status', 'statusCode'] as const;

/** Un error ajeno ya reconocido: su estado `4xx` y el cuerpo que se puede publicar de él. */
interface ClientError {
  readonly status: number;
  readonly body: HttpExceptionBody;
}

/**
 * Reconoce un error que **no** es `HttpException` pero declara un estado `4xx`, o `null` si no.
 *
 * Existe por los errores de `http-errors`, que es como Express y body-parser señalan los fallos de
 * protocolo: el `PayloadTooLargeError` de un cuerpo por encima de `JSON_BODY_LIMIT` trae
 * `status: 413` y, sin esto, salía como `500` —o sea, la única respuesta que le dice al cliente
 * «reintenta, no es culpa tuya»— además de registrarse con traza completa, lo que convertía el
 * límite de cuerpo en un amplificador de ruido en los logs a disposición de cualquiera con un token.
 *
 * Se reconoce por **forma** y no con `instanceof HttpError`: `http-errors` es una dependencia
 * transitiva de Express, no una dependencia declarada del proyecto, e importarla para un `instanceof`
 * la convertiría en una de facto (spec `002`, `plan.md` §1: cero dependencias nuevas).
 *
 * Dos condiciones, y ninguna es cosmética:
 * - **entero**: un `status` que no sea un entero solo puede venir de un error de programación y no
 *   puede decidir el código de una respuesta;
 * - **en `4xx`**: si bastara «tiene un `status`», cualquier error de librería que traiga un `5xx`
 *   —o un `200`— evitaría el `logger.error`, que es justo la señal que no se puede perder.
 */
function asClientError(exception: unknown): ClientError | null {
  if (!isRecord(exception)) {
    return null;
  }

  for (const property of STATUS_PROPERTIES) {
    const value: unknown = exception[property];

    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= MIN_CLIENT_ERROR_STATUS &&
      value <= MAX_CLIENT_ERROR_STATUS
    ) {
      return { status: value, body: publishableBodyOf(exception) };
    }
  }

  return null;
}

/**
 * Cuerpo del error ajeno ya reconocido como `4xx`: solo su `message`, y solo si es texto.
 *
 * No se copia `code` ni ninguna otra propiedad: el `code` del contrato es el de los errores de
 * dominio del workspace, y dejar que una librería cualquiera rellene ese campo lo volvería
 * inservible para el frontend, que lo usa para distinguir cinco `409` distintos.
 */
function publishableBodyOf(exception: Record<string, unknown>): HttpExceptionBody {
  const message: unknown = exception['message'];

  return typeof message === 'string' && message.length > 0 ? { message } : {};
}

/**
 * Traduce cualquier excepción a `ErrorResponseDto`. Sin esto, Nest emitiría formas distintas según
 * el origen del error y el contrato de salida dejaría de ser único.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;

    // El orden importa: `HttpException` primero, porque su estado y su cuerpo son el contrato propio
    // de la API. La traducción por forma es el **último** recurso antes del `500` genérico.
    const clientError = isHttp ? null : asClientError(exception);

    const status = isHttp
      ? exception.getStatus()
      : (clientError?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const body = isHttp ? extractBody(exception) : (clientError?.body ?? {});

    // Se registra por **estado** y ya no por origen: un `4xx` es un fallo del cliente lo emita quien
    // lo emita, y llenar el log de trazas por cuerpos demasiado grandes es exactamente lo que
    // ahogaría la alerta que sí importa, la de los `5xx` de verdad.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${String(status)}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // La cabecera estándar además del campo en el cuerpo: un cliente HTTP genérico (o un proxy)
    // entiende `Retry-After` sin saber nada de nuestro DTO.
    if (body.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(body.retryAfterSeconds));
    }

    response.status(status).json(
      new ErrorResponseDto({
        statusCode: status,
        error: body.error ?? defaultErrorName(status),
        message: body.message ?? 'Error interno del servidor',
        path: request.originalUrl,
        timestamp: new Date().toISOString(),
        ...(body.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: body.retryAfterSeconds }
          : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
      }),
    );
  }
}

function defaultErrorName(status: number): string {
  const name = Object.entries(HttpStatus).find(([, value]) => value === status)?.[0];
  return name === undefined ? 'Error' : toTitleCase(name);
}

function toTitleCase(constantName: string): string {
  return constantName
    .toLowerCase()
    .split('_')
    .map((word) => (word.length === 0 ? word : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`))
    .join(' ');
}
