import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

/**
 * Cuerpo de `POST /api/workspace/documents/:id/move` (plan §4 de la spec 002).
 *
 * Endpoint aparte del `PATCH` de renombrado (decisión 10 del plan): las dos operaciones fallan por
 * motivos distintos y un `PATCH` combinado no podría distinguir «mueve a la raíz»
 * (`directoryId: null`) de «no toques el sitio» (`directoryId` ausente).
 */
export class MoveDocumentRequestDto {
  /**
   * **Obligatorio**, y por eso `@ValidateIf` y no `@IsOptional()`: `@IsOptional()` se salta la
   * validación también con `null`, así que un `directoryId` ausente colaría sin validarse
   * (decisión 11). En un endpoint cuyo único cometido es cambiar de carpeta, esa confusión sería un
   * move silencioso a la raíz.
   */
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    example: null,
    description: 'Directorio de destino, o `null` para la raíz. Obligatorio: nunca se omite.',
  })
  @ValidateIf((dto: MoveDocumentRequestDto) => dto.directoryId !== null)
  @IsUUID(undefined, { message: 'directoryId debe ser un uuid, o null para mover a la raíz' })
  readonly directoryId!: string | null;
}
