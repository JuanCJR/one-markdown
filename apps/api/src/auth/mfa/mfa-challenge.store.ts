import { Injectable } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';

/** Igual que el TTL del `mfaToken` que lo acredita: el desafío y su token mueren juntos. */
export const MFA_CHALLENGE_TTL_SECONDS = 300;
/** Cinco intentos por desafío (AC-17). Al quinto se destruye y hay que volver al login. */
export const MFA_CHALLENGE_MAX_ATTEMPTS = 5;

/** Qué encontró `consume`. El intento ya está contabilizado cuando devuelve `open`. */
export type MfaChallengeLookup =
  | { readonly status: 'open'; readonly userId: string }
  /** No existe: nunca se creó, expiró o se agotaron los intentos. Los tres son el mismo `401`. */
  | { readonly status: 'not_found' };

/**
 * Lee el desafío y contabiliza el intento en **una sola** operación.
 *
 * Hace falta Lua y no GET+SET: cinco peticiones en paralelo con el mismo `mfaToken` leerían
 * `attempts: 0` y escribirían `1`, con lo que el límite de intentos se saltaría solo pidiendo en
 * paralelo — justo el ataque que AC-17 acota.
 *
 * `KEEPTTL` conserva la caducidad original: los 5 minutos cuentan desde el login, no desde el último
 * intento, o el desafío se mantendría vivo indefinidamente a base de teclear códigos.
 */
const CONSUME_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return 'not_found'
end
local data = cjson.decode(raw)
data.attempts = data.attempts + 1
if data.attempts >= tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
else
  redis.call('SET', KEYS[1], cjson.encode(data), 'KEEPTTL')
end
return 'open:' .. data.userId
`;

interface ChallengeRecord {
  userId: string;
  attempts: number;
  createdAt: string;
}

const OPEN_PREFIX = 'open:';

/**
 * Desafío de segundo factor pendiente (`auth:mfa:challenge:{jti}`, plan §6).
 *
 * La clave es el `jti` del `mfaToken`, no el usuario: así un login nuevo no puede reciclar los
 * intentos ya gastados de un desafío anterior, y cerrar un desafío no toca a los demás.
 */
@Injectable()
export class MfaChallengeStore {
  constructor(private readonly redis: RedisService) {}

  private key(jti: string): string {
    return `auth:mfa:challenge:${jti}`;
  }

  /** Abre el desafío y devuelve su vida en segundos, que es la que anuncia el login. */
  async create(params: { jti: string; userId: string }): Promise<number> {
    const record: ChallengeRecord = {
      userId: params.userId,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    await this.redis.client.set(
      this.key(params.jti),
      JSON.stringify(record),
      'EX',
      MFA_CHALLENGE_TTL_SECONDS,
    );

    return MFA_CHALLENGE_TTL_SECONDS;
  }

  /**
   * Gasta un intento y devuelve el usuario del desafío.
   *
   * El intento se cuenta **antes** de verificar el código a propósito: si se contara después, un
   * error a mitad de la verificación regalaría intentos.
   */
  async consume(jti: string): Promise<MfaChallengeLookup> {
    const raw: unknown = await this.redis.client.eval(
      CONSUME_SCRIPT,
      1,
      this.key(jti),
      String(MFA_CHALLENGE_MAX_ATTEMPTS),
    );

    const outcome = String(raw);

    if (!outcome.startsWith(OPEN_PREFIX)) {
      return { status: 'not_found' };
    }

    return { status: 'open', userId: outcome.slice(OPEN_PREFIX.length) };
  }

  /** Cierra el desafío. Idempotente: al agotar los intentos ya se borró solo. */
  async destroy(jti: string): Promise<void> {
    await this.redis.client.del(this.key(jti));
  }
}
