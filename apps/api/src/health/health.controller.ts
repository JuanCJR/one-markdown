import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { HealthResponseDto } from './dto/health.response.dto';
import { ReadinessResponseDto } from './dto/readiness.response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: el proceso responde', operationId: 'getHealth' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return this.healthService.liveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness: PostgreSQL y Redis responden',
    operationId: 'getReadiness',
  })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    type: ReadinessResponseDto,
    description: 'Alguna dependencia está caída; el cuerpo indica cuál',
  })
  async getReadiness(
    // `passthrough` para elegir el código de estado sin perder el DTO como cuerpo: un 503 con
    // ErrorResponseDto ocultaría *qué* dependencia falló.
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessResponseDto> {
    const readiness = await this.healthService.readiness();

    response.status(
      readiness.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return readiness;
  }
}
