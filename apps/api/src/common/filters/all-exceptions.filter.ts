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
  };
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
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? extractBody(exception) : {};

    if (!isHttp || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
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
