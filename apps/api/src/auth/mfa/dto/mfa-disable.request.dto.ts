import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

import { PASSWORD_MAX_LENGTH } from '../../dto/register.request.dto';
import { MFA_CODE_PATTERN } from './mfa-verify.request.dto';

/**
 * Bajar el segundo factor pide **las dos** credenciales (plan §3).
 *
 * Solo con la contraseña bastaría un access token robado más una contraseña filtrada para desarmar la
 * protección; solo con el código, cualquiera con el teléfono delante. Se exigen ambas.
 *
 * No hay `@MinLength` en `password`: la longitud mínima es una regla del alta, y aplicarla aquí
 * respondería `400` en vez de `401` a una contraseña corta, revelando que no es la correcta.
 */
export class MfaDisableRequestDto {
  @ApiProperty({ type: String, maxLength: PASSWORD_MAX_LENGTH })
  @IsString({ message: 'password es requerida' })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `password no puede tener más de ${String(PASSWORD_MAX_LENGTH)} caracteres`,
  })
  readonly password!: string;

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
