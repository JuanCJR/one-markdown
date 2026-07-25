import { ApiProperty } from '@nestjs/swagger';
import type { CheckState, Readiness, ReadinessChecks, ReadinessState } from '@one-markdown/shared';

export type { CheckState, ReadinessState };

export class ReadinessChecksDto implements ReadinessChecks {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  readonly database: CheckState;

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  readonly redis: CheckState;

  constructor(params: { database: CheckState; redis: CheckState }) {
    this.database = params.database;
    this.redis = params.redis;
  }
}

/**
 * Readiness. A diferencia del liveness, toca PostgreSQL y Redis.
 * Cuando algo está `down` la respuesta es 503 pero el cuerpo sigue siendo este DTO: el operador
 * necesita saber *qué* falló, no solo que falló.
 */
export class ReadinessResponseDto implements Readiness {
  @ApiProperty({ enum: ['ready', 'not_ready'], example: 'ready' })
  readonly status: ReadinessState;

  @ApiProperty({ type: ReadinessChecksDto })
  readonly checks: ReadinessChecksDto;

  constructor(checks: ReadinessChecksDto) {
    this.checks = checks;
    this.status = checks.database === 'up' && checks.redis === 'up' ? 'ready' : 'not_ready';
  }
}
