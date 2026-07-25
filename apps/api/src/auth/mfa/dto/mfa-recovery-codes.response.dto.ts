import { ApiProperty } from '@nestjs/swagger';
import type { MfaRecoveryCodes } from '@one-markdown/shared';

/**
 * Códigos de recuperación entregados al confirmar el segundo factor (AC-14, decisión 7 del plan).
 *
 * **Es la única vez que existen en claro**: en la base solo queda su hash bcrypt. Si el usuario los
 * pierde, la salida es desactivar MFA y volver a enrolar, no recuperarlos.
 *
 * `implements MfaRecoveryCodes` ancla la forma al contrato de `@one-markdown/shared`: una divergencia
 * rompe el typecheck aquí antes de que el frontend la descubra en runtime.
 */
export class MfaRecoveryCodesResponseDto implements MfaRecoveryCodes {
  @ApiProperty({
    type: [String],
    example: ['A7K2-9QMD', 'H3XP-42RT'],
    description: 'Ocho códigos de un solo uso con formato `XXXX-XXXX`; se muestran una única vez',
  })
  readonly recoveryCodes: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  readonly generatedAt: string;

  constructor(params: { recoveryCodes: string[]; generatedAt: Date }) {
    this.recoveryCodes = params.recoveryCodes;
    this.generatedAt = params.generatedAt.toISOString();
  }
}
