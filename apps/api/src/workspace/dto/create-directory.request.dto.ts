import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

import { normalizeWorkspaceName } from '../workspace-name';
import { MAX_DIRECTORY_NAME_LENGTH } from '../workspace.constants';
import { IsWorkspaceName } from './is-workspace-name.validator';

/**
 * Normaliza el nombre **en el borde**, antes de validarlo y antes de guardarlo.
 *
 * Que la normalización ocurra aquí y no en el servicio es lo que hace que `@MaxLength` cuente sobre
 * la forma canónica: si no, `«  a  »` de 121 caracteres pasaría el máximo y se guardaría con 117.
 */
export function toNormalizedWorkspaceName({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? normalizeWorkspaceName(value) : value;
}

export class CreateDirectoryRequestDto {
  @ApiProperty({
    type: String,
    maxLength: MAX_DIRECTORY_NAME_LENGTH,
    example: 'Notas',
    description:
      'Nombre visible. Se normaliza (NFC, espacios colapsados, sin extremos) antes de validarse y de guardarse; la unicidad entre hermanos es insensible a la caja.',
  })
  @Transform(toNormalizedWorkspaceName)
  @IsString({ message: 'name debe ser una cadena' })
  @MaxLength(MAX_DIRECTORY_NAME_LENGTH, {
    message: `name no puede tener más de ${String(MAX_DIRECTORY_NAME_LENGTH)} caracteres`,
  })
  @IsWorkspaceName('directory')
  readonly name!: string;

  /**
   * `null` = raíz del workspace. **Obligatorio**, y por eso `@ValidateIf` y no `@IsOptional()`:
   * `@IsOptional()` se salta la validación también con `null`, así que un `parentId` ausente colaría
   * sin validarse y «crea en la raíz» sería indistinguible de «el campo no llegó» (decisión 11).
   */
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    example: null,
    description: 'Directorio padre, o `null` para la raíz. Obligatorio: nunca se omite.',
  })
  @ValidateIf((dto: CreateDirectoryRequestDto) => dto.parentId !== null)
  @IsUUID(undefined, { message: 'parentId debe ser un uuid, o null para crear en la raíz' })
  readonly parentId!: string | null;
}
