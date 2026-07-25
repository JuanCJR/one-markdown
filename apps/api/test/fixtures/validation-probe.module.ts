import { Body, Controller, Module, Post } from '@nestjs/common';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Módulo SOLO para tests: ejercita el `ValidationPipe` global sin inventar un endpoint de negocio
 * que no pertenece a la spec 000. Nunca se importa desde `AppModule`.
 */
export class ProbeRequestDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsInt()
  @Min(0)
  @Max(10)
  weight!: number;
}

export class ProbeResponseDto {
  readonly title: string;
  readonly weight: number;

  constructor(params: { title: string; weight: number }) {
    this.title = params.title;
    this.weight = params.weight;
  }
}

@Controller('probe')
export class ProbeController {
  @Post()
  create(@Body() body: ProbeRequestDto): ProbeResponseDto {
    return new ProbeResponseDto({ title: body.title, weight: body.weight });
  }
}

@Module({ controllers: [ProbeController] })
export class ValidationProbeModule {}
