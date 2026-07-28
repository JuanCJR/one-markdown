import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

import { MAX_DOCUMENT_TITLE_LENGTH } from '../workspace.constants';
import { toNormalizedWorkspaceName } from './create-directory.request.dto';
import { IsWorkspaceName } from './is-workspace-name.validator';

/**
 * Cuerpo de `PATCH /api/workspace/documents/:id` (plan §4 de la spec 002).
 *
 * Solo lleva `title`: renombrar y mover son endpoints separados (decisión 10 del plan), y **el
 * contenido tampoco se edita aquí** —eso es de la spec 003—. Al no declarar `directoryId` ni
 * `content`, `forbidNonWhitelisted` los rechaza con un `400` explícito en vez de ignorarlos en
 * silencio, que es el fallo que deja al cliente creyendo que movió o guardó algo.
 *
 * Las reglas del título son **las mismas** que en el alta y salen del mismo sitio
 * (`toNormalizedWorkspaceName` + `@IsWorkspaceName('document')`): dos copias divergirían.
 */
export class RenameDocumentRequestDto {
  @ApiProperty({
    type: String,
    maxLength: MAX_DOCUMENT_TITLE_LENGTH,
    example: 'Ideas del trimestre',
    description:
      'Título nuevo. Se normaliza igual que en el alta; cambiar solo la caja del propio título no es una colisión.',
  })
  @Transform(toNormalizedWorkspaceName)
  @IsString({ message: 'title debe ser una cadena' })
  @MaxLength(MAX_DOCUMENT_TITLE_LENGTH, {
    message: `title no puede tener más de ${String(MAX_DOCUMENT_TITLE_LENGTH)} caracteres`,
  })
  @IsWorkspaceName('document')
  readonly title!: string;
}
