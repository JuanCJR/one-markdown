import { ApiProperty } from '@nestjs/swagger';
import type { WorkspaceTree } from '@one-markdown/shared';

import { WorkspaceDirectoryResponseDto } from './workspace-directory.response.dto';
import { WorkspaceDocumentSummaryResponseDto } from './workspace-document-summary.response.dto';

/** Lo que el servicio ya tiene construido cuando llega aquí: los dos arrays y el instante de la foto. */
export interface WorkspaceTreeProjection {
  readonly directories: WorkspaceDirectoryResponseDto[];
  readonly documents: WorkspaceDocumentSummaryResponseDto[];
  readonly generatedAt: Date;
}

/**
 * El árbol completo del usuario, **plano** (decisión 4 del plan de la spec 002).
 *
 * Dos arrays y no un `children: []` recursivo por tres razones que se refuerzan entre sí: el cliente
 * necesita de todas formas un mapa normalizado por `id` —para la selección de la barra lateral y,
 * más adelante, para las pestañas de la spec 005—, así que una respuesta anidada le obligaría a
 * aplanarla nada más recibirla; un DTO recursivo en OpenAPI es un `$ref` a sí mismo, mucho más
 * incómodo de generar y de validar con un *type guard*; y la relación padre-hijo ya viaja entera en
 * el `parentId`/`directoryId` de cada nodo, así que anidar no añadiría ni un dato.
 *
 * `documents` lleva el **resumen**, sin `content`: incluir el texto convertiría cada recarga de la
 * barra lateral en la descarga del workspace entero.
 *
 * `implements WorkspaceTree` no es decorativo: si el DTO y el contrato compartido divergen, el
 * typecheck rompe aquí antes de que el frontend descubra la diferencia en runtime. El contrato
 * declara las dos listas como `readonly DirectoryNode[]` / `readonly DocumentSummary[]`, y un array
 * mutable las satisface: aquí se mantienen mutables porque `@nestjs/swagger` necesita el tipo del
 * array para el `$ref` del esquema.
 */
export class WorkspaceTreeResponseDto implements WorkspaceTree {
  @ApiProperty({
    type: () => [WorkspaceDirectoryResponseDto],
    description:
      'Todos los directorios del usuario, en una lista **plana** ordenada por nombre normalizado y desempatada por `id`',
  })
  readonly directories: WorkspaceDirectoryResponseDto[];

  @ApiProperty({
    type: () => [WorkspaceDocumentSummaryResponseDto],
    description:
      'Todos los documentos del usuario, en una lista **plana** ordenada por título normalizado y desempatada por `id`. **Sin** su contenido',
  })
  readonly documents: WorkspaceDocumentSummaryResponseDto[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Instante en que se tomó la foto del árbol. El cliente lo usa para descartar una respuesta que llegue tarde y pisar un estado más nuevo',
  })
  readonly generatedAt: string;

  constructor(tree: WorkspaceTreeProjection) {
    this.directories = tree.directories;
    this.documents = tree.documents;
    this.generatedAt = tree.generatedAt.toISOString();
  }
}
