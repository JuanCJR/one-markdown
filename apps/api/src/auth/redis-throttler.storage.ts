import type { ThrottlerStorage } from '@nestjs/throttler';

import { THROTTLE_KEY_PREFIX } from '../common/throttle';
import type { RedisService } from '../redis/redis.service';

/**
 * `@nestjs/throttler` 6.5 no reexporta `ThrottlerStorageRecord` en su índice público, así que se
 * deriva del propio método en vez de importar de `dist/`: si la librería cambia la forma del registro,
 * el typecheck lo dice aquí.
 */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Un solo viaje a Redis y atómico. Con `INCR` + `PEXPIRE` sueltos, dos peticiones simultáneas podrían
 * incrementar antes de que ninguna pusiera el TTL y la clave quedaría **para siempre**: el primer
 * atacante que llenara el cupo dejaría la IP bloqueada de por vida.
 *
 * `hits == limite + 1` es la petición que estrena el bloqueo: ahí la ventana pasa a durar el castigo
 * (`blockDuration`), que por defecto es la propia ventana. Las peticiones siguientes solo suman.
 */
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
elseif hits == tonumber(ARGV[3]) + 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
local pttl = redis.call('PTTL', KEYS[1])
if pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  pttl = tonumber(ARGV[1])
end
return { hits, pttl }
`;

/** El contrato de `ThrottlerStorage` habla en segundos aunque las ventanas lleguen en milisegundos. */
function toSeconds(milliseconds: number): number {
  return Math.ceil(milliseconds / 1000);
}

function parseScriptResult(raw: unknown): { hits: number; pttl: number } {
  if (Array.isArray(raw) && typeof raw[0] === 'number' && typeof raw[1] === 'number') {
    return { hits: raw[0], pttl: raw[1] };
  }

  // Nunca debería pasar: si pasa, es mejor un 500 ruidoso que un contador silenciosamente inservible.
  throw new Error(`Respuesta inesperada del contador de rate limit: ${JSON.stringify(raw)}`);
}

/**
 * `ThrottlerStorage` sobre el Redis que ya usa el auth (AC-20, riesgo #2 de la spec).
 *
 * El store que trae `@nestjs/throttler` vive en la memoria del proceso: con dos instancias del API
 * detrás de un balanceador, el atacante tendría el doble de intentos, y un reinicio le devolvería el
 * cupo entero. Por eso el contador vive donde ya viven las sesiones.
 *
 * No se implementa `ThrottlerStorageService` ni se añade `@nest-lab/throttler-storage-redis`: la
 * interfaz pública son estos cinco parámetros y una implementación propia no arrastra dependencias.
 *
 * Si Redis está caído, `increment` lanza y la petición muere con un `500`. Es lo correcto aquí: sin
 * Redis tampoco hay sesiones ni bloqueo por cuenta, así que ningún endpoint de auth podría responder
 * bien, y dejar pasar el tráfico sin contarlo abriría justo la puerta que esto protege.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  /**
   * `Pick` y no `RedisService`: este storage se construye a mano en el factory del módulo (no por DI),
   * así que no necesita el provider completo y los tests pueden pasarle un cliente real sin castings.
   */
  constructor(private readonly redis: Pick<RedisService, 'client'>) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const raw: unknown = await this.redis.client.eval(
      INCREMENT_SCRIPT,
      1,
      `${THROTTLE_KEY_PREFIX}${key}`,
      String(ttl),
      String(blockDuration),
      String(limit),
    );

    const { hits, pttl } = parseScriptResult(raw);
    const isBlocked = hits > limit;
    const timeToExpire = toSeconds(pttl);

    return {
      totalHits: hits,
      timeToExpire,
      isBlocked,
      // Solo tiene sentido mientras el bloqueo dura; el guard lo usa para la cabecera `Retry-After`.
      timeToBlockExpire: isBlocked ? timeToExpire : 0,
    };
  }
}
