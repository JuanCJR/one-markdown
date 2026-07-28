import { ApiProperty } from '@nestjs/swagger';
import type { DirectoryNode } from '@one-markdown/shared';

/**
 * Lo mínimo que necesita el DTO para construirse. Coincide a propósito con `DirectoryRow` del
 * repositorio, que ya se selecciona **sin** `userId`, `nameKey` ni `parentScopeId`: aquí no hay
 * nada que omitir, y por eso la fuga no depende de que alguien se acuerde de omitirlo (AC-26).
 */
export interface DirectoryProjection {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Directorio tal como viaja al cliente (plan §4 de la spec 002).
 *
 * Se construye campo a campo y **nunca** desde un spread de la fila: el día que el modelo gane una
 * columna interna, un spread la publicaría sin que ningún test lo notara.
 *
 * `depth` no es una columna: se calcula al leer, desde el conjunto de directorios del usuario
 * (decisión 2). Por eso entra como parámetro y no sale de la proyección.
 *
 * `implements DirectoryNode` no es decorativo: si el DTO y el contrato compartido divergen, el
 * typecheck rompe aquí antes de que el frontend descubra la diferencia en runtime.
 */
export class WorkspaceDirectoryResponseDto implements DirectoryNode {
  @ApiProperty({ type: String, format: 'uuid' })
  readonly id: string;

  @ApiProperty({ type: String, example: 'Notas' })
  readonly name: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: '`null` explícito cuando el directorio está en la raíz; nunca ausente',
  })
  readonly parentId: string | null;

  @ApiProperty({
    type: Number,
    example: 0,
    description: 'Número de ancestros: `0` en la raíz. Calculado, no persistido',
  })
  readonly depth: number;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly updatedAt: string;

  constructor(directory: DirectoryProjection, depth: number) {
    this.id = directory.id;
    this.name = directory.name;
    this.parentId = directory.parentId;
    this.depth = depth;
    this.createdAt = directory.createdAt.toISOString();
    this.updatedAt = directory.updatedAt.toISOString();
  }
}
