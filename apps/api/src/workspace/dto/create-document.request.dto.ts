import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

import { MAX_DOCUMENT_CONTENT_CHARS, MAX_DOCUMENT_TITLE_LENGTH } from '../workspace.constants';
import { toNormalizedWorkspaceName } from './create-directory.request.dto';
import { IsWorkspaceName } from './is-workspace-name.validator';

/**
 * Cuerpo de `POST /api/workspace/documents` (plan §4 de la spec 002).
 *
 * El título se normaliza y se valida con las **mismas** reglas que el nombre de un directorio —el
 * `@Transform` y el validador son literalmente los de aquél— y solo cambia el máximo de longitud.
 * Duplicar aquí las reglas con expresiones regulares propias es lo que acabaría permitiendo un
 * título con `/` el día que alguien tocara una de las dos copias.
 */
export class CreateDocumentRequestDto {
  @ApiProperty({
    type: String,
    maxLength: MAX_DOCUMENT_TITLE_LENGTH,
    example: 'Ideas',
    description:
      'Título visible. Se normaliza (NFC, espacios colapsados, sin extremos) antes de validarse y de guardarse; la unicidad entre hermanos es insensible a la caja.',
  })
  @Transform(toNormalizedWorkspaceName)
  @IsString({ message: 'title debe ser una cadena' })
  @MaxLength(MAX_DOCUMENT_TITLE_LENGTH, {
    message: `title no puede tener más de ${String(MAX_DOCUMENT_TITLE_LENGTH)} caracteres`,
  })
  @IsWorkspaceName('document')
  readonly title!: string;

  /**
   * `null` = raíz del workspace. **Obligatorio**, con el mismo idiom que `parentId` en directorios:
   * `@IsOptional()` se salta la validación también con `null`, así que un `directoryId` ausente
   * colaría sin validarse y «crea en la raíz» sería indistinguible de «el campo no llegó»
   * (decisión 11).
   */
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    example: null,
    description: 'Directorio contenedor, o `null` para la raíz. Obligatorio: nunca se omite.',
  })
  @ValidateIf((dto: CreateDocumentRequestDto) => dto.directoryId !== null)
  @IsUUID(undefined, { message: 'directoryId debe ser un uuid, o null para crear en la raíz' })
  readonly directoryId!: string | null;

  /**
   * Markdown del documento. **Sí** es opcional, al contrario que `directoryId`: aquí «ausente» y
   * «vacío» significan lo mismo —un documento recién creado sin texto— y no hay ninguna decisión
   * que el servidor deba distinguir, así que `@IsOptional()` no esconde nada.
   *
   * El máximo se mide en **caracteres** (lo que cuenta `@MaxLength`) para que el cliente pueda
   * comprobarlo con el mismo criterio; `contentBytes` se calcula aparte, en bytes UTF-8.
   */
  @ApiPropertyOptional({
    type: String,
    maxLength: MAX_DOCUMENT_CONTENT_CHARS,
    example: '# Hola',
    description: 'Contenido markdown. Ausente o `null` equivale a la cadena vacía.',
  })
  @IsOptional()
  @IsString({ message: 'content debe ser una cadena' })
  @MaxLength(MAX_DOCUMENT_CONTENT_CHARS, {
    message: `content no puede tener más de ${String(MAX_DOCUMENT_CONTENT_CHARS)} caracteres`,
  })
  readonly content?: string | null;
}
