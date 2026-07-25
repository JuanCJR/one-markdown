import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { AccountLockedException } from './account-locked.exception';

/**
 * Umbral y castigo del bloqueo por cuenta. Van como constantes y no como variables de entorno a
 * propósito: son una decisión de seguridad de la spec, no algo que ajustar por despliegue.
 */
const MAX_FAILURES = 5;
const LOCK_TTL_SECONDS = 900; // 15 min
const FAILURE_WINDOW_SECONDS = 900;

/**
 * Bloqueo por cuenta ante intentos fallidos de contraseña (specs/001-auth/plan.md §2 decisión 8).
 *
 * Es la mitad complementaria del rate limit por IP: éste para muchas contraseñas contra una cuenta;
 * el throttler para muchas cuentas desde una IP. Ninguno de los dos cubre al otro.
 */
@Injectable()
export class LoginAttemptService {
  constructor(private readonly redis: RedisService) {}

  /**
   * El correo se normaliza y se hashea: la clave no debe ser una lista de direcciones registradas
   * para quien lea la caché, y `A@B.test` no puede abrir un contador distinto de `a@b.test`.
   */
  private hash(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  private failureKey(email: string): string {
    return `auth:login:fail:${this.hash(email)}`;
  }

  private lockKey(email: string): string {
    return `auth:login:lock:${this.hash(email)}`;
  }

  /** Lanza `AccountLockedException` si la cuenta está bloqueada. No revela si el correo existe. */
  async assertNotLocked(email: string): Promise<void> {
    const ttl = await this.redis.client.ttl(this.lockKey(email));

    if (ttl > 0) {
      throw new AccountLockedException(ttl);
    }
  }

  /** Cuenta un fallo y bloquea al alcanzar el umbral. Devuelve los fallos acumulados. */
  async registerFailure(email: string): Promise<number> {
    const key = this.failureKey(email);
    const failures = await this.redis.client.incr(key);

    if (failures === 1) {
      await this.redis.client.expire(key, FAILURE_WINDOW_SECONDS);
    }

    if (failures >= MAX_FAILURES) {
      await this.redis.client.set(this.lockKey(email), String(failures), 'EX', LOCK_TTL_SECONDS);
    }

    return failures;
  }

  /** Login correcto: se borran contador y bloqueo. */
  async reset(email: string): Promise<void> {
    await this.redis.client.del(this.failureKey(email), this.lockKey(email));
  }
}
