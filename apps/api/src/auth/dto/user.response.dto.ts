import { ApiProperty } from '@nestjs/swagger';
import type { AuthUser } from '@one-markdown/shared';

/** Lo mínimo que necesita el DTO para construirse: nada de la fila completa de Prisma. */
export interface UserProjection {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly mfaEnabled: boolean;
  readonly createdAt: Date;
}

/**
 * Usuario tal como viaja al cliente (specs/001-auth/plan.md §3).
 *
 * Se construye campo a campo y **nunca** desde un spread de la fila: `passwordHash` y `mfaSecret`
 * viven en la misma fila, y un spread los publicaría al añadir una columna en el futuro.
 *
 * `implements AuthUser` no es decorativo: si el DTO y el contrato compartido divergen, el typecheck
 * rompe aquí antes de que el frontend descubra la diferencia en runtime.
 */
export class UserResponseDto implements AuthUser {
  @ApiProperty({ type: String, format: 'uuid' })
  readonly id: string;

  @ApiProperty({ type: String, format: 'email', example: 'ada@example.test' })
  readonly email: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Ada Lovelace',
    description: '`null` explícito cuando el usuario no puso nombre; nunca ausente',
  })
  readonly displayName: string | null;

  @ApiProperty({ type: Boolean, example: false })
  readonly mfaEnabled: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly createdAt: string;

  constructor(user: UserProjection) {
    this.id = user.id;
    this.email = user.email;
    this.displayName = user.displayName;
    this.mfaEnabled = user.mfaEnabled;
    this.createdAt = user.createdAt.toISOString();
  }
}
