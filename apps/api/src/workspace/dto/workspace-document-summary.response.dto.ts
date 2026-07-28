import { ApiProperty } from '@nestjs/swagger';
import type { DocumentSummary } from '@one-markdown/shared';

/**
 * Lo mínimo que necesita el resumen para construirse. Coincide a propósito con `DocumentSummaryRow`
 * del repositorio, que ya se selecciona **sin** `userId`, `titleKey` ni `parentScopeId`: aquí no hay
 * nada que omitir, y por eso la fuga no depende de que alguien se acuerde de omitirlo (AC-26).
 */
export interface DocumentSummaryProjection {
  readonly id: string;
  readonly directoryId: string | null;
  readonly title: string;
  readonly contentBytes: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Documento **sin** su texto (plan §4 de la spec 002): lo que viaja en el árbol, en el renombrado y
 * en el move.
 *
 * Existe separado del DTO completo por una razón de coste, no de estilo: en PostgreSQL el `content`
 * vive en TOAST y traerlo significa leer todo el texto del usuario. Un listado del árbol que
 * devolviera el contenido de cada documento sería, en la práctica, una descarga completa del
 * workspace en cada recarga de la barra lateral.
 *
 * `contentBytes` es columna persistida y no un cálculo al leer, justo para que este resumen pueda
 * informar del tamaño sin tocar el texto.
 *
 * `implements DocumentSummary` no es decorativo: si el DTO y el contrato compartido divergen, el
 * typecheck rompe aquí antes de que el frontend descubra la diferencia en runtime.
 */
export class WorkspaceDocumentSummaryResponseDto implements DocumentSummary {
  @ApiProperty({ type: String, format: 'uuid' })
  readonly id: string;

  @ApiProperty({ type: String, example: 'Ideas' })
  readonly title: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: '`null` explícito cuando el documento está en la raíz; nunca ausente',
  })
  readonly directoryId: string | null;

  @ApiProperty({
    type: Number,
    example: 9,
    description:
      'Tamaño del contenido en **bytes UTF-8**, no en caracteres: un texto con acentos o emoji pesa más de lo que mide',
  })
  readonly contentBytes: number;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly updatedAt: string;

  constructor(document: DocumentSummaryProjection) {
    // Campo a campo y **nunca** desde un spread de la fila: el día que el modelo gane una columna
    // interna, un spread la publicaría sin que ningún test lo notara.
    this.id = document.id;
    this.title = document.title;
    this.directoryId = document.directoryId;
    this.contentBytes = document.contentBytes;
    this.createdAt = document.createdAt.toISOString();
    this.updatedAt = document.updatedAt.toISOString();
  }
}
