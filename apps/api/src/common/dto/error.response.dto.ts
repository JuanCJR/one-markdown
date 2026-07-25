import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ApiErrorShape } from '@one-markdown/shared';

/** Forma única de error de toda la API: ninguna salida escapa a un DTO, ni siquiera las de error. */
export class ErrorResponseDto implements ApiErrorShape {
  @ApiProperty({ type: Number, example: 400 })
  readonly statusCode: number;

  @ApiProperty({ type: String, example: 'Bad Request' })
  readonly error: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['title must be longer than or equal to 3 characters'],
    description: 'Mensaje único, o lista de mensajes cuando falla la validación de varios campos',
  })
  readonly message: string | string[];

  @ApiProperty({ type: String, example: '/api/documents' })
  readonly path: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-07-24T21:00:00.000Z' })
  readonly timestamp: string;

  /**
   * Segundos que hay que esperar antes de reintentar. Solo aparece en los `429` que saben cuánto
   * dura el castigo (cuenta bloqueada, AC-7); el resto de errores no lo llevan y el campo se omite
   * del JSON en vez de salir como `null`, para no ensanchar la forma común del error.
   */
  @ApiPropertyOptional({ type: Number, example: 900 })
  readonly retryAfterSeconds?: number;

  constructor(params: {
    statusCode: number;
    error: string;
    message: string | string[];
    path: string;
    timestamp: string;
    retryAfterSeconds?: number;
  }) {
    this.statusCode = params.statusCode;
    this.error = params.error;
    this.message = params.message;
    this.path = params.path;
    this.timestamp = params.timestamp;

    // Asignación condicional y no `= params.retryAfterSeconds`: con `exactOptionalPropertyTypes`
    // un `undefined` explícito no es lo mismo que la propiedad ausente.
    if (params.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = params.retryAfterSeconds;
    }
  }
}
