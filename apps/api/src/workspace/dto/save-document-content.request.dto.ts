import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

import { MAX_DOCUMENT_CONTENT_CHARS } from '../workspace.constants';

/**
 * Cuerpo de `PUT /api/workspace/documents/:id/content` (`plan.md` §4 de la spec 003).
 *
 * Dos ausencias deliberadas, las dos con un AC que las clava:
 *
 * - **Sin `@IsNotEmpty()`.** Vaciar un documento es una operación legítima y no un error (AC-2): la
 *   cadena vacía vale, y su `contentBytes` es `0`. Añadirlo aquí es el fallo clásico de este DTO, y
 *   convertiría «borrar todo el texto» en un `400` que la interfaz no sabría explicar.
 * - **Sin `@Transform`.** El markdown se guarda **byte a byte** como se escribió. Un `trim()` —o
 *   cualquier normalización de espacios o de saltos de línea— rompería el propio markdown, porque
 *   dos espacios al final de una línea **son** un salto de línea, y haría que lo guardado dejara de
 *   ser lo escrito. Compárese con `CreateDocumentRequestDto`, donde el `@Transform` está sobre el
 *   **título**, que sí es un nombre y sí se normaliza.
 */
export class SaveDocumentContentRequestDto {
  /**
   * Contenido completo del documento. **No** es un parche ni un diff: el cuerpo **reemplaza** el
   * subrecurso entero, que es lo que hace que reenviar el mismo cuerpo con la misma versión sea
   * idempotente respecto de su token (AC-8).
   *
   * El máximo se mide en **caracteres** (lo que cuenta `@MaxLength`), igual que en el alta, para que
   * el cliente pueda comprobarlo con el mismo criterio; `contentBytes` se calcula aparte, en bytes
   * UTF-8, con `contentBytesOf`.
   */
  @ApiProperty({
    type: String,
    maxLength: MAX_DOCUMENT_CONTENT_CHARS,
    example: '# Hola\n\nUn párrafo.',
    description:
      'Contenido markdown completo, tal cual se escribió. La cadena vacía es válida y vacía el documento; no se recorta ni se normaliza nada.',
  })
  @IsString({ message: 'content debe ser una cadena' })
  @MaxLength(MAX_DOCUMENT_CONTENT_CHARS, {
    message: `content no puede tener más de ${String(MAX_DOCUMENT_CONTENT_CHARS)} caracteres`,
  })
  readonly content!: string;

  /**
   * `contentVersion` que el cliente leyó. **Obligatorio y sin valor por defecto**: sin él la
   * operación degeneraría en «el último gana», que es exactamente la pérdida silenciosa de trabajo
   * que la concurrencia optimista existe para evitar.
   *
   * `@Min(0)` y no `@Min(1)`: un documento recién creado está en la versión `0` y su primer guardado
   * la envía tal cual (AC-1).
   */
  @ApiProperty({
    type: Number,
    minimum: 0,
    example: 0,
    description:
      'Versión de contenido que el cliente leyó. Si la real no coincide, la respuesta es `409 DOCUMENT_CONTENT_CONFLICT` y no se escribe nada.',
  })
  @IsInt({ message: 'expectedVersion debe ser un entero' })
  @Min(0, { message: 'expectedVersion no puede ser negativo' })
  readonly expectedVersion!: number;
}
