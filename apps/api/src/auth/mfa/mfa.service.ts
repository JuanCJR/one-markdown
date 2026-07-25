import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthService, type IssuedSession } from '../auth.service';
import type { AuthenticatedUser } from '../authenticated-user';
import { UserResponseDto } from '../dto/user.response.dto';
import { PasswordService } from '../password.service';
import { SessionStore } from '../session.store';
import { TokenService } from '../token.service';
import { MfaDisableRequestDto } from './dto/mfa-disable.request.dto';
import { MfaEnableRequestDto } from './dto/mfa-enable.request.dto';
import { MfaRecoveryCodesResponseDto } from './dto/mfa-recovery-codes.response.dto';
import { MfaSetupResponseDto } from './dto/mfa-setup.response.dto';
import { MfaVerifyRequestDto } from './dto/mfa-verify.request.dto';
import { MfaChallengeStore } from './mfa-challenge.store';
import { MfaSecretCipher } from './mfa-secret.cipher';
import { MfaSetupStore } from './mfa-setup.store';
import { RecoveryCodeService } from './recovery-code.service';
import { TotpService } from './totp.service';

/** Distingue un TOTP de un código de recuperación: el DTO ya garantizó que es una de las dos formas. */
const TOTP_CODE_PATTERN = /^\d{6}$/;

/** Lo que hace falta para verificar un segundo factor: el secreto cifrado y el dueño. */
interface MfaEnabledUser {
  readonly id: string;
  readonly mfaEnabled: boolean;
  readonly mfaSecret: string | null;
}

/**
 * Mensaje único de todo rechazo de segundo factor: código TOTP incorrecto, código de recuperación ya
 * gastado, contraseña equivocada en el `disable`. Distinguirlos le diría al atacante qué mitad de la
 * credencial acertó.
 */
export const MFA_REJECTED_MESSAGE = 'Código de verificación inválido';

/** MFA ya activo: reenrolar sin bajarlo primero dejaría al usuario con dos secretos posibles. */
export const MFA_ALREADY_ENABLED_MESSAGE = 'El segundo factor ya está habilitado';
/** El enrolamiento pendiente expiró (10 min) o nunca se pidió: hay que volver a empezar por `setup`. */
export const MFA_NO_PENDING_SETUP_MESSAGE =
  'No hay un enrolamiento pendiente; vuelve a empezar el alta del segundo factor';
/** No se puede bajar lo que no está puesto: es un conflicto de estado, no un fallo de credenciales. */
export const MFA_NOT_ENABLED_MESSAGE = 'El segundo factor no está habilitado';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly setups: MfaSetupStore,
    private readonly totp: TotpService,
    private readonly cipher: MfaSecretCipher,
    private readonly recoveryCodes: RecoveryCodeService,
    private readonly challenges: MfaChallengeStore,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionStore,
    private readonly auth: AuthService,
  ) {}

  /**
   * Arranca el enrolamiento (AC-13).
   *
   * El secreto se guarda cifrado en Redis con TTL y **no** toca la base: mientras nadie confirme, la
   * fila del usuario sigue con `mfaEnabled: false` y `mfaSecret: null`.
   */
  async setup(user: AuthenticatedUser): Promise<MfaSetupResponseDto> {
    this.assertMfaDisabled(user.mfaEnabled);

    const secret = this.totp.generateSecret();

    await this.setups.save(user.id, secret);

    const otpauthUri = this.totp.buildUri({ secret, email: user.email });

    return new MfaSetupResponseDto({
      secret,
      otpauthUri,
      qrCodeDataUrl: await this.totp.buildQrDataUrl(otpauthUri),
      expiresInSeconds: this.setups.ttlSeconds,
    });
  }

  /**
   * Confirma el enrolamiento (AC-14, AC-15).
   *
   * Es el único punto donde el secreto llega a la base, y llega cifrado. Un código incorrecto **no**
   * descarta el enrolamiento pendiente: quien teclea mal un dígito no debería tener que reescanear.
   */
  async enable(
    user: AuthenticatedUser,
    dto: MfaEnableRequestDto,
  ): Promise<MfaRecoveryCodesResponseDto> {
    this.assertMfaDisabled(user.mfaEnabled);

    const secret = await this.setups.find(user.id);

    if (secret === null) {
      throw new ConflictException(MFA_NO_PENDING_SETUP_MESSAGE);
    }

    if (!(await this.totp.verify(secret, dto.code))) {
      throw new UnauthorizedException(MFA_REJECTED_MESSAGE);
    }

    const codes = await this.recoveryCodes.generate();
    const generatedAt = new Date();
    const encryptedSecret = this.cipher.encrypt(secret);

    await this.prisma.$transaction(async (tx) => {
      // `updateMany` con `mfaEnabled: false` en el `where` y no `update` por id: dos `enable`
      // simultáneos leerían el mismo enrolamiento pendiente y ambos entregarían ocho códigos, de los
      // que solo los últimos quedarían en la base. La base decide quién gana.
      const activated = await tx.user.updateMany({
        where: { id: user.id, mfaEnabled: false },
        data: { mfaEnabled: true, mfaSecret: encryptedSecret },
      });

      if (activated.count !== 1) {
        throw new ConflictException(MFA_ALREADY_ENABLED_MESSAGE);
      }

      // Un alta no debería encontrar códigos previos (el `disable` los borra), pero si un enrolamiento
      // anterior dejó alguno, seguir vivo con códigos de otro secreto sería una puerta abierta.
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.mfaRecoveryCode.createMany({
        data: codes.map((code) => ({ userId: user.id, codeHash: code.hash })),
      });
    });

    await this.setups.discard(user.id);

    return new MfaRecoveryCodesResponseDto({
      recoveryCodes: codes.map((code) => code.plain),
      generatedAt,
    });
  }

  /**
   * Canjea el `mfaToken` del login por una sesión real (AC-17, AC-18).
   *
   * Pública: la credencial es el `mfaToken`, no un Bearer. Todo rechazo — token ilegible, desafío
   * agotado, código incorrecto, código de recuperación ya gastado — sale con el **mismo** `401`.
   */
  async verifyChallenge(dto: MfaVerifyRequestDto): Promise<IssuedSession> {
    // Lanza `UnauthorizedException` ante firma inválida, expiración o `typ` distinto de `mfa`: un
    // access token en este campo no abre una sesión nueva.
    const payload = await this.tokens.verifyMfa(dto.mfaToken);

    // Gasta el intento antes de verificar el código: así un fallo a mitad de camino no regala
    // intentos, y al quinto el desafío ya no existe ni para el código correcto.
    const lookup = await this.challenges.consume(payload.jti);

    if (lookup.status !== 'open' || lookup.userId !== payload.sub) {
      throw new UnauthorizedException(MFA_REJECTED_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({ where: { id: lookup.userId } });

    if (user === null || !(await this.matchesSecondFactor(user, dto.code))) {
      throw new UnauthorizedException(MFA_REJECTED_MESSAGE);
    }

    // Un desafío resuelto no puede reutilizarse: el `mfaToken` sigue firmado y sin expirar, y lo
    // único que lo invalida es que su clave desaparezca.
    await this.challenges.destroy(payload.jti);

    return this.auth.issueSession(user);
  }

  /**
   * Baja el segundo factor (AC-19).
   *
   * Pide contraseña **y** código: con solo una de las dos, quien robase un access token y conociera la
   * contraseña filtrada podría desarmar la protección desde otro continente.
   *
   * Y como bajar el segundo factor es un cambio de postura de seguridad, cierra las demás sesiones del
   * usuario: si el atacante llegó hasta aquí, su dispositivo no debe sobrevivir al cambio.
   */
  async disable(user: AuthenticatedUser, dto: MfaDisableRequestDto): Promise<UserResponseDto> {
    const row = await this.prisma.user.findUnique({ where: { id: user.id } });

    if (row === null) {
      throw new UnauthorizedException(MFA_REJECTED_MESSAGE);
    }

    if (!row.mfaEnabled || row.mfaSecret === null) {
      throw new ConflictException(MFA_NOT_ENABLED_MESSAGE);
    }

    // La contraseña se comprueba **antes** del código: al revés, un intento con la contraseña
    // equivocada gastaría el código de recuperación que el usuario acaba de teclear.
    if (!(await this.passwords.compare(dto.password, row.passwordHash))) {
      throw new UnauthorizedException(MFA_REJECTED_MESSAGE);
    }

    if (!(await this.matchesSecondFactor(row, dto.code))) {
      throw new UnauthorizedException(MFA_REJECTED_MESSAGE);
    }

    await this.prisma.$transaction(async (tx) => {
      const disabled = await tx.user.updateMany({
        where: { id: row.id, mfaEnabled: true },
        data: { mfaEnabled: false, mfaSecret: null },
      });

      if (disabled.count !== 1) {
        throw new ConflictException(MFA_NOT_ENABLED_MESSAGE);
      }

      // El secreto y los códigos se van juntos o no se van: quedarse con códigos de recuperación de
      // un secreto ya borrado dejaría credenciales huérfanas que aún abrirían la cuenta.
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: row.id } });
    });

    // Un `setup` a medias del mismo usuario no debe sobrevivir a la baja.
    await this.setups.discard(row.id);
    await this.sessions.revokeAll({ userId: row.id, exceptSid: user.sid });

    return new UserResponseDto({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      // Acaba de apagarse en la transacción de arriba: volver a leer la fila solo para confirmarlo
      // sería un viaje de más contra la base.
      mfaEnabled: false,
      createdAt: row.createdAt,
    });
  }

  /**
   * `true` si el código es el TOTP vigente del usuario o uno de sus códigos de recuperación sin usar.
   *
   * El código de recuperación se **gasta** aquí (uso único, AC-18): por eso quien llame debe haber
   * comprobado antes todo lo demás, o un fallo posterior quemaría un código sin dar acceso.
   */
  private async matchesSecondFactor(user: MfaEnabledUser, code: string): Promise<boolean> {
    if (!user.mfaEnabled || user.mfaSecret === null) {
      return false;
    }

    if (!TOTP_CODE_PATTERN.test(code)) {
      return this.recoveryCodes.consume(user.id, code);
    }

    let secret: string;

    try {
      secret = this.cipher.decrypt(user.mfaSecret);
    } catch {
      // Secreto ilegible (clave rotada, fila manipulada): es un fallo de credenciales para el
      // usuario, no un 500 que además revelaría el estado interno.
      return false;
    }

    return this.totp.verify(secret, code);
  }

  private assertMfaDisabled(mfaEnabled: boolean): void {
    if (mfaEnabled) {
      throw new ConflictException(MFA_ALREADY_ENABLED_MESSAGE);
    }
  }
}
