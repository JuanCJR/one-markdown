import { ApiProperty } from '@nestjs/swagger';
import type { Health } from '@one-markdown/shared';

/**
 * Liveness. No toca I/O: responde mientras el proceso esté vivo.
 * `implements Health` no es decorativo: si el DTO y el contrato compartido divergen, el typecheck
 * del backend falla antes de que el frontend se entere en runtime.
 */
export class HealthResponseDto implements Health {
  @ApiProperty({ enum: ['ok'], example: 'ok', description: 'Siempre "ok" si el proceso responde' })
  readonly status: 'ok';

  @ApiProperty({ type: Number, example: 42, description: 'Segundos desde el arranque del proceso' })
  readonly uptimeSeconds: number;

  @ApiProperty({ type: String, example: '0.0.0', description: 'Versión de @one-markdown/api' })
  readonly version: string;

  constructor(params: { uptimeSeconds: number; version: string }) {
    this.status = 'ok';
    this.uptimeSeconds = params.uptimeSeconds;
    this.version = params.version;
  }
}
