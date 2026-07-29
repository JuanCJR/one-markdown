import { ApiProperty } from '@nestjs/swagger';
import type { MarkdownDocument } from '@one-markdown/shared';

import {
  type DocumentSummaryProjection,
  WorkspaceDocumentSummaryResponseDto,
} from './workspace-document-summary.response.dto';

/** El resumen más el texto y su token de concurrencia: lo que devuelven el alta y el detalle. */
export interface DocumentProjection extends DocumentSummaryProjection {
  readonly content: string;
  readonly contentVersion: number;
}

/**
 * Documento **con** su markdown (plan §4 de la spec 002).
 *
 * Se devuelve en el alta además de en el detalle a propósito: el cliente recibe exactamente lo que
 * se guardó —normalizaciones incluidas— y la spec 003 podrá abrir el documento recién creado en una
 * pestaña sin una segunda petición.
 *
 * `implements MarkdownDocument` no es decorativo: si el DTO y el contrato compartido divergen, el
 * typecheck rompe aquí antes de que el frontend descubra la diferencia en runtime. El tipo
 * compartido **no** se llama `Document` (riesgo #10 del plan): ese nombre es el del modelo de
 * Prisma y, además, un global del DOM.
 */
export class WorkspaceDocumentResponseDto
  extends WorkspaceDocumentSummaryResponseDto
  implements MarkdownDocument
{
  @ApiProperty({
    type: String,
    example: '# Hola',
    description:
      'Contenido markdown tal como se guardó. Cadena vacía si el documento está en blanco',
  })
  readonly content: string;

  @ApiProperty({
    type: Number,
    example: 0,
    description:
      'Token de concurrencia optimista del guardado: se devuelve tal cual en `expectedVersion` al hacer `PUT /api/workspace/documents/{id}/content`. Vale `0` en un documento recién creado y solo lo incrementa ese guardado — renombrar y mover no lo tocan',
  })
  readonly contentVersion: number;

  constructor(document: DocumentProjection) {
    super(document);
    this.content = document.content;
    // Campo a campo, como el resumen: el DTO es la única superficie de la respuesta y ninguna fila
    // de Prisma se devuelve entera.
    this.contentVersion = document.contentVersion;
  }
}
