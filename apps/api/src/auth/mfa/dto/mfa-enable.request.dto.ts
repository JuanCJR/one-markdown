import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Solo TOTP: confirmar el enrolamiento con un código de recuperación no probaría nada. */
export const TOTP_CODE_PATTERN = /^\d{6}$/;

export class MfaEnableRequestDto {
  @ApiProperty({ type: String, pattern: '^\\d{6}$', example: '123456' })
  @IsString({ message: 'code es requerido' })
  @Matches(TOTP_CODE_PATTERN, { message: 'code debe ser un código TOTP de 6 dígitos' })
  readonly code!: string;
}
