import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, Matches } from 'class-validator';

/**
 * Un TOTP de 6 dígitos **o** un código de recuperación `XXXX-XXXX` (plan §3).
 *
 * Los dos entran por el mismo campo a propósito: quien perdió el teléfono no debería tener que
 * descubrir que existe otro formulario, y el servidor ya sabe distinguir las dos formas.
 */
export const MFA_CODE_PATTERN = /^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$/;

export class MfaVerifyRequestDto {
  @ApiProperty({
    type: String,
    description: 'El `mfaToken` que devolvió `POST /api/auth/login` con `mfaRequired: true`',
  })
  @IsString({ message: 'mfaToken es requerido' })
  @IsJWT({ message: 'mfaToken debe ser un JWT' })
  readonly mfaToken!: string;

  @ApiProperty({
    type: String,
    pattern: '^(\\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$',
    example: '123456',
    description: 'Código TOTP de 6 dígitos o código de recuperación `XXXX-XXXX`',
  })
  @IsString({ message: 'code es requerido' })
  @Matches(MFA_CODE_PATTERN, {
    message: 'code debe ser un TOTP de 6 dígitos o un código de recuperación XXXX-XXXX',
  })
  readonly code!: string;
}
