import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

/**
 * Cuerpo de `POST /api/workspace/directories/:id/move` (plan §4 de la spec 002).
 *
 * Un endpoint aparte del `PATCH` de renombrado (decisión 10 del plan): las dos operaciones fallan
 * por motivos distintos —una por nombre repetido, la otra por ciclo o profundidad—, solo el move
 * necesita transacción `Serializable`, y un `PATCH` combinado no podría distinguir «mueve a la
 * raíz» (`parentId: null`) de «no toques el sitio» (`parentId` ausente).
 */
export class MoveDirectoryRequestDto {
  /**
   * **Obligatorio**, y por eso `@ValidateIf` y no `@IsOptional()`: `@IsOptional()` se salta la
   * validación también con `null`, así que un `parentId` ausente colaría sin validarse y «mueve a
   * la raíz» sería indistinguible de «el campo no llegó» (decisión 11). En un endpoint cuyo único
   * cometido es cambiar el padre, esa confusión sería un move silencioso a la raíz.
   */
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    example: null,
    description: 'Directorio de destino, o `null` para la raíz. Obligatorio: nunca se omite.',
  })
  @ValidateIf((dto: MoveDirectoryRequestDto) => dto.parentId !== null)
  @IsUUID(undefined, { message: 'parentId debe ser un uuid, o null para mover a la raíz' })
  readonly parentId!: string | null;
}
