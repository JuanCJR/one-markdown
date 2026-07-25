import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './authenticated-user';

/** Nombre de la estrategia. Explícito y no `'jwt'`: el refresh no pasa por Passport, y confundirlas
 * sería justo el agujero que AC-12 prohíbe. */
export const JWT_ACCESS_STRATEGY = 'jwt-access';

/** Motivo único de rechazo: distinguirlos le daría pistas a quien prueba tokens. */
const REJECTED = 'Token de acceso inválido o expirado';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Estrategia del access token (specs/001-auth/plan.md §2 decisión 3): Passport se usa solo para
 * proteger rutas; el login valida credenciales en `AuthService` para no saltarse el `ValidationPipe`.
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, JWT_ACCESS_STRATEGY) {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Sin esto un token caducado seguiría abriendo puertas: es el TTL corto lo que limita el daño
      // de un access token robado, y solo sirve si se respeta.
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /**
   * Passport ya validó firma y expiración con el secreto de **access**; aquí se comprueba lo que él
   * no sabe: que el `typ` sea `'access'` (AC-12) y que el usuario siga existiendo (decisión 12).
   */
  async validate(payload: unknown): Promise<AuthenticatedUser> {
    if (!isRecord(payload)) {
      throw new UnauthorizedException(REJECTED);
    }

    const sub = payload['sub'];
    const sid = payload['sid'];

    if (payload['typ'] !== 'access' || typeof sub !== 'string' || typeof sid !== 'string') {
      throw new UnauthorizedException(REJECTED);
    }

    // La columna es `uuid`: consultar con un `sub` que no lo sea haría fallar a Postgres con un 500
    // en vez del 401 que corresponde.
    if (!UUID_PATTERN.test(sub)) {
      throw new UnauthorizedException(REJECTED);
    }

    const user = await this.prisma.user.findUnique({ where: { id: sub } });

    // Un token firmado por nosotros de un usuario ya borrado no debe pasar: la spec 002 filtrará
    // documentos por este `id` y no puede haber un `userId` sin dueño.
    if (user === null) {
      throw new UnauthorizedException(REJECTED);
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
      sid,
    };
  }
}
