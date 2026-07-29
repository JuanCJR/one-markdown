import { ApiProperty } from '@nestjs/swagger';

/**
 * Lo mínimo que necesita el DTO para construirse. Coincide con `DocumentContentSavedRow` del
 * repositorio, que ya se selecciona con **exactamente** estas cuatro columnas: aquí no hay nada que
 * omitir, y por eso la fuga no depende de que alguien se acuerde de omitirlo.
 */
export interface DocumentContentSavedProjection {
  readonly id: string;
  readonly contentBytes: number;
  readonly contentVersion: number;
  readonly updatedAt: Date;
}

/**
 * Respuesta de `PUT /api/workspace/documents/:id/content` (`plan.md` §4 de la spec 003).
 *
 * **Cuatro claves y ninguna más**, y las tres ausencias son decisiones y no descuidos:
 *
 * - **Sin `content`.** Devolver el texto duplicaría hasta ~800 kB en **cada** guardado automático,
 *   y el cliente ya lo tiene: acaba de enviarlo. Lo único que no sabía es el token nuevo.
 * - **Sin `title` ni `directoryId`.** Esta operación no los toca (AC-9), así que devolverlos daría a
 *   entender que participan de ella.
 * - **Sin `createdAt`.** No cambia nunca; el resumen ya lo trae cuando hace falta.
 *
 * Lo que sí devuelve es lo único que el cliente **no puede** calcular: la `contentVersion` nueva,
 * que es el token con el que tendrá que emitir el guardado siguiente, y el `contentBytes` real en
 * bytes UTF-8, que no es la longitud de lo que envió.
 *
 * Construido **campo a campo** y nunca desde un spread de la fila: el día que el modelo gane una
 * columna interna, un spread la publicaría sin que ningún test lo notara.
 */
export class WorkspaceDocumentContentResponseDto {
  @ApiProperty({ type: String, format: 'uuid', description: 'Documento guardado' })
  readonly id: string;

  @ApiProperty({
    type: Number,
    example: 9,
    description:
      'Tamaño del contenido guardado en **bytes UTF-8**, no en caracteres: un texto con acentos o emoji pesa más de lo que mide',
  })
  readonly contentBytes: number;

  @ApiProperty({
    type: Number,
    example: 1,
    description:
      'Versión **nueva** del contenido. Es el token que el cliente debe enviar en su próximo guardado; sin adoptarlo, el siguiente `PUT` recibiría un `409`.',
  })
  readonly contentVersion: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Marca de tiempo de esta escritura',
  })
  readonly updatedAt: string;

  constructor(saved: DocumentContentSavedProjection) {
    this.id = saved.id;
    this.contentBytes = saved.contentBytes;
    this.contentVersion = saved.contentVersion;
    this.updatedAt = saved.updatedAt.toISOString();
  }
}
