import { Injectable } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';
import { MfaSecretCipher } from './mfa-secret.cipher';

/** 10 minutos: lo que tarda una persona en abrir su app, escanear el QR y teclear un código. */
export const MFA_SETUP_TTL_SECONDS = 600;

/**
 * Enrolamiento TOTP sin confirmar (`auth:mfa:setup:{userId}`, plan §6 y decisión 6).
 *
 * Vive en Redis y **no** en la base por dos motivos: AC-13 exige que `users.mfaSecret` siga nulo
 * mientras nadie confirme, y así los enrolamientos abandonados desaparecen solos en vez de dejar
 * filas con un secreto que nunca se usó.
 *
 * El valor se guarda **ya cifrado**: un `KEYS *` en el Redis compartido no debe entregar segundos
 * factores a medio montar.
 */
@Injectable()
export class MfaSetupStore {
  constructor(
    private readonly redis: RedisService,
    private readonly cipher: MfaSecretCipher,
  ) {}

  readonly ttlSeconds = MFA_SETUP_TTL_SECONDS;

  private key(userId: string): string {
    return `auth:mfa:setup:${userId}`;
  }

  /** Reemplaza cualquier enrolamiento anterior: solo el último `setup` puede confirmarse. */
  async save(userId: string, secret: string): Promise<void> {
    await this.redis.client.set(
      this.key(userId),
      this.cipher.encrypt(secret),
      'EX',
      MFA_SETUP_TTL_SECONDS,
    );
  }

  /**
   * El secreto pendiente, o `null` si no hay ninguno (nunca se pidió, expiró o ya se confirmó).
   *
   * Un valor que no descifra también sale como `null`: la clave de cifrado cambió o alguien escribió
   * en Redis a mano, y en ambos casos lo correcto es pedir un `setup` nuevo, no un 500.
   */
  async find(userId: string): Promise<string | null> {
    const stored = await this.redis.client.get(this.key(userId));

    if (stored === null) {
      return null;
    }

    try {
      return this.cipher.decrypt(stored);
    } catch {
      return null;
    }
  }

  async discard(userId: string): Promise<void> {
    await this.redis.client.del(this.key(userId));
  }
}
