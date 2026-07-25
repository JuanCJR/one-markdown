import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

import { EMAIL_MAX_LENGTH, normalizeEmail, PASSWORD_MAX_LENGTH } from './register.request.dto';

/**
 * El login **no** repite las reglas de fuerza de la contraseña del registro: si se endureciera la
 * política, quien tenga una contraseña vieja debe poder seguir entrando. Solo se acota el tamaño,
 * para no pasarle a bcrypt una entrada arbitrariamente grande.
 */
export class LoginRequestDto {
  @ApiProperty({ type: String, maxLength: EMAIL_MAX_LENGTH, example: 'ada@example.test' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email debe ser una dirección de correo válida' })
  @MaxLength(EMAIL_MAX_LENGTH, {
    message: `email no puede tener más de ${String(EMAIL_MAX_LENGTH)} caracteres`,
  })
  readonly email!: string;

  @ApiProperty({ type: String, maxLength: PASSWORD_MAX_LENGTH })
  @IsString({ message: 'password es requerida' })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `password no puede tener más de ${String(PASSWORD_MAX_LENGTH)} caracteres`,
  })
  readonly password!: string;
}
