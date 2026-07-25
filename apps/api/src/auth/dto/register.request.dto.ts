import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

/** Longitud mínima de contraseña: 12 caracteres, decisión de la spec, no un default de librería. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254; // RFC 5321: el máximo real de una dirección

/**
 * Normaliza el correo en el borde. La unicidad en Postgres es sensible a la caja, así que si esta
 * transformación no ocurriera, `Ada@x.test` y `ada@x.test` serían dos cuentas distintas.
 */
export function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class RegisterRequestDto {
  @ApiProperty({ type: String, maxLength: EMAIL_MAX_LENGTH, example: 'ada@example.test' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email debe ser una dirección de correo válida' })
  @MaxLength(EMAIL_MAX_LENGTH, {
    message: `email no puede tener más de ${String(EMAIL_MAX_LENGTH)} caracteres`,
  })
  readonly email!: string;

  @ApiProperty({
    type: String,
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    example: 'correcta-caballo-1',
  })
  @IsString({ message: 'password es requerida' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `password debe tener al menos ${String(PASSWORD_MIN_LENGTH)} caracteres`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `password no puede tener más de ${String(PASSWORD_MAX_LENGTH)} caracteres`,
  })
  @Matches(/[A-Za-z]/, { message: 'password debe incluir al menos una letra' })
  @Matches(/\d/, { message: 'password debe incluir al menos un dígito' })
  readonly password!: string;

  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 80, example: 'Ada Lovelace' })
  @IsOptional()
  @IsString({ message: 'displayName debe ser una cadena' })
  @Length(1, 80, { message: 'displayName debe tener entre 1 y 80 caracteres' })
  readonly displayName?: string;
}
