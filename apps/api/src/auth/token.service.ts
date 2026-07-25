import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AppConfig } from '../config/env.validation';

/** Los tres tipos de token del sistema. Viaja en el claim `typ` y se verifica siempre. */
export const TOKEN_TYPES = ['access', 'refresh', 'mfa'] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

/** El desafío de segundo factor dura 5 minutos: es un trámite, no una sesión. */
const MFA_TOKEN_TTL_SECONDS = 300;

export interface AccessPayload {
  readonly sub: string;
  readonly sid: string;
  readonly typ: 'access';
}

export interface RefreshPayload {
  readonly sub: string;
  readonly sid: string;
  readonly jti: string;
  readonly typ: 'refresh';
}

export interface MfaPayload {
  readonly sub: string;
  readonly jti: string;
  readonly typ: 'mfa';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Firma y verificación de los tokens de auth.
 *
 * Dos secretos distintos (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) **y** un claim `typ` explícito:
 * el secreto separado ya impide cruzar circuitos, y el `typ` deja el contrato escrito en el token,
 * así que un futuro cambio de configuración que unificara secretos no abriría el agujero (AC-12).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async signAccess(params: { userId: string; sid: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: params.userId, sid: params.sid, typ: 'access' satisfies TokenType },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );
  }

  async signRefresh(params: { userId: string; sid: string; jti: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: params.userId, sid: params.sid, jti: params.jti, typ: 'refresh' satisfies TokenType },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_TTL', { infer: true }),
      },
    );
  }

  /** Acredita que la contraseña ya fue correcta, sin conceder sesión: por eso no lleva `sid`. */
  async signMfa(params: { userId: string; jti: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: params.userId, jti: params.jti, typ: 'mfa' satisfies TokenType },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: MFA_TOKEN_TTL_SECONDS,
      },
    );
  }

  async verifyAccess(token: string): Promise<AccessPayload> {
    const claims = await this.verify(token, this.config.get('JWT_ACCESS_SECRET', { infer: true }));
    const sub = this.requireString(claims, 'sub');
    const sid = this.requireString(claims, 'sid');

    this.requireType(claims, 'access');

    return { sub, sid, typ: 'access' };
  }

  async verifyRefresh(token: string): Promise<RefreshPayload> {
    const claims = await this.verify(token, this.config.get('JWT_REFRESH_SECRET', { infer: true }));
    const sub = this.requireString(claims, 'sub');
    const sid = this.requireString(claims, 'sid');
    const jti = this.requireString(claims, 'jti');

    this.requireType(claims, 'refresh');

    return { sub, sid, jti, typ: 'refresh' };
  }

  async verifyMfa(token: string): Promise<MfaPayload> {
    const claims = await this.verify(token, this.config.get('JWT_ACCESS_SECRET', { infer: true }));
    const sub = this.requireString(claims, 'sub');
    const jti = this.requireString(claims, 'jti');

    this.requireType(claims, 'mfa');

    return { sub, jti, typ: 'mfa' };
  }

  /**
   * Cualquier motivo de rechazo (firma, expiración, basura, claim ausente) sale como el **mismo**
   * `401`: distinguirlos le daría a quien prueba tokens una pista de por qué falló.
   */
  private async verify(token: string, secret: string): Promise<Record<string, unknown>> {
    let claims: unknown;

    try {
      // El genérico de `verifyAsync` exige `object`; se recibe como record y se valida claim a claim
      // más abajo, sin confiar en la forma que declare el llamador.
      claims = await this.jwt.verifyAsync<Record<string, unknown>>(token, { secret });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (!isRecord(claims)) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    return claims;
  }

  private requireString(claims: Record<string, unknown>, key: string): string {
    const value = claims[key];

    if (typeof value !== 'string' || value.length === 0) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    return value;
  }

  private requireType(claims: Record<string, unknown>, expected: TokenType): void {
    if (claims['typ'] !== expected) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
