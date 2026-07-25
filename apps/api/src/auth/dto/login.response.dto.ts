import { ApiProperty } from '@nestjs/swagger';
import type { LoginResult } from '@one-markdown/shared';

import { AuthSessionResponseDto } from './auth-session.response.dto';

/**
 * Respuesta discriminada del login (specs/001-auth/plan.md §2 decisión 5).
 *
 * Un `200` con `mfaRequired` explícito, y no un `403` de "falta MFA": el segundo factor es un paso
 * previsto del flujo, no un error, y así el frontend lo tipa en vez de leer códigos de estado.
 *
 * Los cuatro campos están **siempre** presentes, con `null` donde no aplican (decisión 10).
 *
 * `implements LoginResult` ancla la forma al contrato de `@one-markdown/shared`: si el DTO y el tipo
 * que consume el frontend divergen, rompe el typecheck aquí y no el `isLoginResult` en el navegador.
 */
export class LoginResponseDto implements LoginResult {
  @ApiProperty({ type: Boolean, description: 'Si es `true`, la sesión aún no está abierta' })
  readonly mfaRequired: boolean;

  @ApiProperty({
    type: AuthSessionResponseDto,
    nullable: true,
    description: 'Sesión abierta; `null` cuando falta el segundo factor',
  })
  readonly session: AuthSessionResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Acredita que la contraseña fue correcta; se canjea en `POST /api/auth/mfa/verify`',
  })
  readonly mfaToken: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 300 })
  readonly mfaTokenExpiresInSeconds: number | null;

  constructor(params: {
    mfaRequired: boolean;
    session: AuthSessionResponseDto | null;
    mfaToken: string | null;
    mfaTokenExpiresInSeconds: number | null;
  }) {
    this.mfaRequired = params.mfaRequired;
    this.session = params.session;
    this.mfaToken = params.mfaToken;
    this.mfaTokenExpiresInSeconds = params.mfaTokenExpiresInSeconds;
  }

  /** Login completo: no hay segundo factor pendiente. */
  static withSession(session: AuthSessionResponseDto): LoginResponseDto {
    return new LoginResponseDto({
      mfaRequired: false,
      session,
      mfaToken: null,
      mfaTokenExpiresInSeconds: null,
    });
  }

  /** Contraseña correcta, sesión pendiente del segundo factor (AC-16, la usa T-015). */
  static withMfaChallenge(params: {
    mfaToken: string;
    expiresInSeconds: number;
  }): LoginResponseDto {
    return new LoginResponseDto({
      mfaRequired: true,
      session: null,
      mfaToken: params.mfaToken,
      mfaTokenExpiresInSeconds: params.expiresInSeconds,
    });
  }
}
