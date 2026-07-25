import { ApiProperty } from '@nestjs/swagger';
import type { AuthSession, TokenType } from '@one-markdown/shared';

import { UserResponseDto } from './user.response.dto';

/** El único `tokenType` que emite la API. Literal, no `string`: el frontend lo discrimina. */
export const BEARER: TokenType = 'Bearer';

/**
 * Sesión recién emitida (specs/001-auth/plan.md §3).
 *
 * El refresh token **no** está aquí a propósito: viaja en la cookie `HttpOnly` y no debe ser
 * legible por JavaScript.
 *
 * `implements AuthSession` ancla la forma al contrato de `@one-markdown/shared`: una divergencia
 * (un campo renombrado, un `tokenType` que deje de ser literal) rompe el typecheck, no el frontend.
 */
export class AuthSessionResponseDto implements AuthSession {
  @ApiProperty({ type: String, description: 'JWT de acceso; se guarda solo en memoria del cliente' })
  readonly accessToken: string;

  @ApiProperty({ type: String, enum: [BEARER], example: BEARER })
  readonly tokenType: typeof BEARER;

  @ApiProperty({ type: Number, example: 900, description: 'Vida del access token en segundos' })
  readonly expiresInSeconds: number;

  @ApiProperty({ type: UserResponseDto })
  readonly user: UserResponseDto;

  constructor(params: { accessToken: string; expiresInSeconds: number; user: UserResponseDto }) {
    this.accessToken = params.accessToken;
    this.tokenType = BEARER;
    this.expiresInSeconds = params.expiresInSeconds;
    this.user = params.user;
  }
}
