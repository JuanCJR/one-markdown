import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

import { MAX_DIRECTORY_NAME_LENGTH } from '../workspace.constants';
import { toNormalizedWorkspaceName } from './create-directory.request.dto';
import { IsWorkspaceName } from './is-workspace-name.validator';

/**
 * Cuerpo de `PATCH /api/workspace/directories/:id` (plan §4 de la spec 002).
 *
 * Solo lleva `name`: renombrar y mover son endpoints separados (decisión 10 del plan). Un `PATCH`
 * combinado con `name?` y `parentId?` no podría distinguir «mueve a la raíz» (`parentId: null`) de
 * «no toques el sitio» (`parentId` ausente), porque `@IsOptional()` trata `null` igual que ausente.
 * Al no declarar `parentId`, `forbidNonWhitelisted` lo rechaza con un `400` explícito en vez de
 * ignorarlo en silencio, que es el fallo que deja al cliente creyendo que movió algo.
 *
 * Las reglas del nombre son **las mismas** que en el alta y salen del mismo sitio
 * (`toNormalizedWorkspaceName` + `@IsWorkspaceName('directory')`): dos copias divergirían.
 */
export class RenameDirectoryRequestDto {
  @ApiProperty({
    type: String,
    maxLength: MAX_DIRECTORY_NAME_LENGTH,
    example: 'Notas del trimestre',
    description:
      'Nombre nuevo. Se normaliza igual que en el alta; cambiar solo la caja del propio nombre no es una colisión.',
  })
  @Transform(toNormalizedWorkspaceName)
  @IsString({ message: 'name debe ser una cadena' })
  @MaxLength(MAX_DIRECTORY_NAME_LENGTH, {
    message: `name no puede tener más de ${String(MAX_DIRECTORY_NAME_LENGTH)} caracteres`,
  })
  @IsWorkspaceName('directory')
  readonly name!: string;
}
