import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/env.validation';
import { RedisService } from '../redis/redis.service';

/** Resultado de presentar un refresh token para rotarlo. */
export type RotateOutcome =
  /** El `jti` presentado era el vigente: la sesión sigue viva con un `jti` nuevo. */
  | 'rotated'
  /** El `jti` ya se había rotado: se asume filtración y la familia queda revocada. */
  | 'reused'
  /** No hay sesión con ese `sid`: expiró, se cerró o nunca existió. */
  | 'not_found';

interface SessionRecord {
  jti: string;
  createdAt: string;
  rotatedAt: string | null;
}

/**
 * Rotación atómica. Hace falta Lua y no GET+SET: dos refresh simultáneos con el mismo `jti` (una app
 * con dos pestañas, un reintento de red) leerían ambos el mismo valor y ambos se creerían válidos,
 * que es justo la condición que la detección de reutilización debe distinguir de un robo.
 */
const ROTATE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return 'not_found'
end
local data = cjson.decode(raw)
if data.jti ~= ARGV[1] then
  return 'reused'
end
data.jti = ARGV[2]
data.rotatedAt = ARGV[3]
redis.call('SET', KEYS[1], cjson.encode(data), 'EX', ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return 'rotated'
`;

/**
 * Sesiones de refresh en Redis (specs/001-auth/plan.md §4 decisión 4 y §6).
 *
 * `auth:session:{userId}:{sid}` guarda el `jti` vigente y expira solo; `auth:sessions:{userId}` es el
 * índice de `sid` del usuario, para revocar la familia sin recorrer Redis con `SCAN`.
 */
@Injectable()
export class SessionStore {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get ttl(): number {
    return this.config.get('JWT_REFRESH_TTL', { infer: true });
  }

  private sessionKey(userId: string, sid: string): string {
    return `auth:session:${userId}:${sid}`;
  }

  private familyKey(userId: string): string {
    return `auth:sessions:${userId}`;
  }

  async create(params: { userId: string; sid: string; jti: string }): Promise<void> {
    const record: SessionRecord = {
      jti: params.jti,
      createdAt: new Date().toISOString(),
      rotatedAt: null,
    };

    await this.redis.client
      .multi()
      .set(this.sessionKey(params.userId, params.sid), JSON.stringify(record), 'EX', this.ttl)
      .sadd(this.familyKey(params.userId), params.sid)
      .expire(this.familyKey(params.userId), this.ttl)
      .exec();
  }

  async rotate(params: {
    userId: string;
    sid: string;
    presentedJti: string;
    nextJti: string;
  }): Promise<RotateOutcome> {
    const raw: unknown = await this.redis.client.eval(
      ROTATE_SCRIPT,
      2,
      this.sessionKey(params.userId, params.sid),
      this.familyKey(params.userId),
      params.presentedJti,
      params.nextJti,
      new Date().toISOString(),
      String(this.ttl),
    );

    const outcome = String(raw) as RotateOutcome;

    if (outcome === 'reused') {
      await this.revokeAll({ userId: params.userId });
    }

    return outcome;
  }

  async revoke(params: { userId: string; sid: string }): Promise<void> {
    await this.redis.client
      .multi()
      .del(this.sessionKey(params.userId, params.sid))
      .srem(this.familyKey(params.userId), params.sid)
      .exec();
  }

  /** `exceptSid` conserva la sesión desde la que se pide la revocación (lo usa `mfa/disable`). */
  async revokeAll(params: { userId: string; exceptSid?: string }): Promise<void> {
    const sids = await this.redis.client.smembers(this.familyKey(params.userId));
    const aRevocar = sids.filter((sid) => sid !== params.exceptSid);

    if (aRevocar.length === 0) {
      return;
    }

    const pipeline = this.redis.client.multi();

    for (const sid of aRevocar) {
      pipeline.del(this.sessionKey(params.userId, sid));
      pipeline.srem(this.familyKey(params.userId), sid);
    }

    await pipeline.exec();
  }
}
