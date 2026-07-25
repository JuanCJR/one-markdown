import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/env.validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthSessionResponseDto } from './dto/auth-session.response.dto';
import { LoginRequestDto } from './dto/login.request.dto';
import { LoginResponseDto } from './dto/login.response.dto';
import { RegisterRequestDto } from './dto/register.request.dto';
import { UserProjection, UserResponseDto } from './dto/user.response.dto';
import { LoginAttemptService } from './login-attempt.service';
import { MfaChallengeStore } from './mfa/mfa-challenge.store';
import { PasswordService } from './password.service';
import { SessionStore } from './session.store';
import { TokenService } from './token.service';

/**
 * Mensaje único para "no existe ese correo" y "la contraseña no es esa" (AC-6).
 *
 * Es una constante y no un literal repetido a propósito: si los dos caminos escribieran su propio
 * texto, cualquier retoque en uno de ellos reabriría la enumeración de cuentas sin que se note.
 */
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas';

/**
 * Mensaje único de todo rechazo de sesión: sin cookie, firma inválida, expirado, sesión revocada o
 * reutilización detectada. Al atacante que prueba refresh tokens no se le dice **cuál** de esas
 * cosas pasó; en particular, no se le confirma que su token fue válido alguna vez.
 */
export const SESSION_REJECTED_MESSAGE = 'Sesión inválida o expirada';

/** Sesión emitida: el DTO que sale en el cuerpo y el refresh que sale en la cookie. */
export interface IssuedSession {
  readonly session: AuthSessionResponseDto;
  readonly refreshToken: string;
}

/** Resultado del login: el cuerpo, y el refresh solo si la sesión quedó realmente abierta. */
export interface LoginOutcome {
  readonly response: LoginResponseDto;
  /** `null` cuando falta el segundo factor: sin sesión no hay cookie de refresh (AC-16). */
  readonly refreshToken: string | null;
}

/** P2002 es la violación de índice único de Prisma: aquí solo puede venir del `email`. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionStore,
    private readonly attempts: LoginAttemptService,
    private readonly challenges: MfaChallengeStore,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterRequestDto): Promise<IssuedSession> {
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          // `null` y no ausencia: la columna es nullable y el contrato de salida promete `null`.
          displayName: dto.displayName ?? null,
        },
      });

      return await this.issueSession(user);
    } catch (error) {
      // El 409 sale del error de la base y no de un `findUnique` previo: entre la consulta y el
      // insert cabe otro registro con el mismo correo, y el índice único es el único juez atómico.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ese correo ya está registrado');
      }

      throw error;
    }
  }

  /**
   * Login sin segundo factor (AC-5, AC-6, AC-7).
   *
   * El orden importa: primero el bloqueo por cuenta — si no, cinco fallos y un sexto acierto darían
   * sesión al atacante que ya adivinó la contraseña — y solo después la comparación.
   */
  async login(dto: LoginRequestDto): Promise<LoginOutcome> {
    await this.attempts.assertNotLocked(dto.email);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Cuando el correo no existe se gasta un bcrypt contra un hash señuelo: sin él, la respuesta
    // volvería mucho antes y el tiempo delataría qué cuentas están registradas (decisión 9).
    const passwordOk =
      user === null
        ? await this.passwords.compareWithDecoy(dto.password)
        : await this.passwords.compare(dto.password, user.passwordHash);

    if (user === null || !passwordOk) {
      await this.attempts.registerFailure(dto.email);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.attempts.reset(dto.email);

    // El segundo factor corta el flujo aquí (AC-16): la contraseña ya es correcta, pero no se abre
    // sesión ni se emite cookie. `mfaSecret` nulo con `mfaEnabled` en `true` sería una fila
    // imposible; si apareciera, dejar entrar sin segundo factor sería peor que negar el paso.
    if (user.mfaEnabled) {
      return this.challengeSecondFactor(user.id);
    }

    const issued = await this.issueSession(user);

    return { response: LoginResponseDto.withSession(issued.session), refreshToken: issued.refreshToken };
  }

  /**
   * Abre el desafío de segundo factor y devuelve el `mfaToken` que lo acredita (AC-16).
   *
   * El `jti` del token es la clave del desafío en Redis: el token por sí solo no vale nada, y así
   * cerrar el desafío (al resolverlo o al agotar los intentos) invalida el token sin listas negras.
   */
  private async challengeSecondFactor(userId: string): Promise<LoginOutcome> {
    const jti = randomUUID();
    const expiresInSeconds = await this.challenges.create({ jti, userId });
    const mfaToken = await this.tokens.signMfa({ userId, jti });

    return {
      response: LoginResponseDto.withMfaChallenge({ mfaToken, expiresInSeconds }),
      // `null` y no un token: sin sesión no hay cookie de refresh que emitir.
      refreshToken: null,
    };
  }

  /**
   * Abre una sesión nueva: `sid` identifica el dispositivo y `jti` el refresh vigente de ese `sid`.
   *
   * Público porque lo comparten registro, login, verificación de segundo factor (T-015) y rotación:
   * un solo sitio decide qué es "estar dentro".
   */
  async issueSession(user: UserProjection): Promise<IssuedSession> {
    const sid = randomUUID();
    const jti = randomUUID();

    await this.sessions.create({ userId: user.id, sid, jti });

    return this.buildSession(user, sid, jti);
  }

  /**
   * Rota el refresh y devuelve una sesión nueva sobre el **mismo** `sid` (AC-9, AC-10).
   *
   * No se llama a `issueSession` a propósito: eso crearía un `sid` nuevo en cada refresh y la
   * familia del usuario crecería sin límite, con lo que "revocar la familia" dejaría de ser eficaz.
   */
  async refresh(refreshToken: string | null): Promise<IssuedSession> {
    if (refreshToken === null) {
      throw new UnauthorizedException(SESSION_REJECTED_MESSAGE);
    }

    // Lanza `UnauthorizedException` con mensaje único ante firma inválida, expiración o `typ` que no
    // sea `refresh`: un access token en la cookie no sirve para rotar (AC-12 en espejo).
    const payload = await this.tokens.verifyRefresh(refreshToken);
    const nextJti = randomUUID();

    // La rotación es atómica en Redis; `reused` ya revoca la familia entera dentro del store.
    const outcome = await this.sessions.rotate({
      userId: payload.sub,
      sid: payload.sid,
      presentedJti: payload.jti,
      nextJti,
    });

    if (outcome !== 'rotated') {
      throw new UnauthorizedException(SESSION_REJECTED_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (user === null) {
      // El usuario se borró con la sesión viva: no queda nada que refrescar y la familia sobra.
      await this.sessions.revokeAll({ userId: payload.sub });
      throw new UnauthorizedException(SESSION_REJECTED_MESSAGE);
    }

    return this.buildSession(user, payload.sid, nextJti);
  }

  /**
   * Cierra la sesión del refresh presentado (AC-11).
   *
   * Idempotente y silencioso por diseño: un logout que responde error deja al usuario sin saber si
   * su sesión sigue abierta, que es lo contrario de lo que pide quien cierra sesión.
   */
  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken === null) {
      return;
    }

    try {
      const payload = await this.tokens.verifyRefresh(refreshToken);
      await this.sessions.revoke({ userId: payload.sub, sid: payload.sid });
    } catch {
      // Un token ilegible o expirado ya no abre nada: no hay sesión que cerrar.
    }
  }

  /** Firma el par de tokens de una sesión ya registrada en Redis y arma el DTO de salida. */
  private async buildSession(
    user: UserProjection,
    sid: string,
    jti: string,
  ): Promise<IssuedSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess({ userId: user.id, sid }),
      this.tokens.signRefresh({ userId: user.id, sid, jti }),
    ]);

    return {
      session: new AuthSessionResponseDto({
        accessToken,
        expiresInSeconds: this.config.get('JWT_ACCESS_TTL', { infer: true }),
        user: new UserResponseDto(user),
      }),
      refreshToken,
    };
  }
}
