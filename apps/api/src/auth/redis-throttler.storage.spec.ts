import Redis from 'ioredis';

import { THROTTLE_KEY_PREFIX } from '../common/throttle';
import { RedisThrottlerStorage } from './redis-throttler.storage';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

/** Ventana y castigo largos: los casos que no miden la expiración no deben depender del reloj. */
const LONG_TTL_MS = 60_000;

/**
 * Contra el Redis real de docker, como el resto de los stores de auth.
 *
 * Lo que hay que demostrar aquí no es que un contador suba —eso lo hace cualquier `Map`— sino que el
 * contador **vive en Redis**: que expira solo y que dos instancias distintas del storage ven el mismo
 * número. Es la razón de ser de AC-20: con el store en memoria de `@nestjs/throttler`, dos procesos
 * del API darían al atacante el doble de intentos.
 */
describe('RedisThrottlerStorage (AC-20)', () => {
  let redis: Redis;
  let storage: RedisThrottlerStorage;
  let seq = 0;

  beforeAll(() => {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
    storage = new RedisThrottlerStorage({ client: redis });
  });

  afterAll(async () => {
    await redis.quit();
  });

  afterEach(async () => {
    const keys = await redis.keys(`${THROTTLE_KEY_PREFIX}test-${String(process.pid)}*`);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  /** Una clave por caso: este Redis lo comparten los demás tests y el entorno de desarrollo. */
  function nextKey(): string {
    seq += 1;
    return `test-${String(process.pid)}-${String(seq)}`;
  }

  function increment(key: string, limit = 5): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    return storage.increment(key, LONG_TTL_MS, limit, LONG_TTL_MS, 'login');
  }

  describe('increment', () => {
    it('devuelve totalHits creciente y timeToExpire mayor que cero', async () => {
      const key = nextKey();

      const primera = await increment(key);
      const segunda = await increment(key);

      expect(primera.totalHits).toBe(1);
      expect(segunda.totalHits).toBe(2);
      expect(primera.timeToExpire).toBeGreaterThan(0);
      expect(segunda.timeToExpire).toBeGreaterThan(0);
    });

    it('marca isBlocked solo cuando se supera el límite', async () => {
      const key = nextKey();
      const limite = 3;

      const resultados = [];
      for (let intento = 0; intento < limite + 1; intento += 1) {
        resultados.push(await increment(key, limite));
      }

      expect(resultados.map((r) => r.isBlocked)).toEqual([false, false, false, true]);
      // El bloqueo tiene que decir cuánto dura, o el cliente no sabe cuándo reintentar.
      expect(resultados[limite]?.timeToBlockExpire).toBeGreaterThan(0);
    });

    it('guarda el contador bajo el prefijo de throttle y nunca sin TTL', async () => {
      const key = nextKey();

      await increment(key);

      const ttl = await redis.pttl(`${THROTTLE_KEY_PREFIX}${key}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(LONG_TTL_MS);
    });

    it('la clave expira sola: pasada la ventana el contador vuelve a empezar', async () => {
      const key = nextKey();
      const ventanaCorta = 300;

      await storage.increment(key, ventanaCorta, 5, ventanaCorta, 'login');
      await storage.increment(key, ventanaCorta, 5, ventanaCorta, 'login');

      await new Promise((resolve) => setTimeout(resolve, ventanaCorta + 150));

      const tras = await storage.increment(key, ventanaCorta, 5, ventanaCorta, 'login');

      expect(tras.totalHits).toBe(1);
    });

    // El corazón de AC-20: el contador no puede vivir en el proceso.
    it('dos instancias distintas del storage sobre el mismo Redis comparten el contador', async () => {
      const key = nextKey();
      const otraInstancia = new RedisThrottlerStorage({ client: redis });

      const primera = await storage.increment(key, LONG_TTL_MS, 5, LONG_TTL_MS, 'login');
      const segunda = await otraInstancia.increment(key, LONG_TTL_MS, 5, LONG_TTL_MS, 'login');
      const tercera = await storage.increment(key, LONG_TTL_MS, 5, LONG_TTL_MS, 'login');

      expect(primera.totalHits).toBe(1);
      expect(segunda.totalHits).toBe(2);
      expect(tercera.totalHits).toBe(3);
    });

    it('cada clave cuenta por separado', async () => {
      const unaKey = nextKey();
      const otraKey = nextKey();

      await increment(unaKey);
      await increment(unaKey);
      const otra = await increment(otraKey);

      expect(otra.totalHits).toBe(1);
    });

    it('el bloqueo dura blockDuration aunque la ventana fuese más corta', async () => {
      const key = nextKey();
      const ventana = 300;
      const castigo = 30_000;
      const limite = 1;

      await storage.increment(key, ventana, limite, castigo, 'login');
      const bloqueada = await storage.increment(key, ventana, limite, castigo, 'login');

      expect(bloqueada.isBlocked).toBe(true);
      // Si el castigo no se aplicara, la clave expiraría con la ventana (≈1 s) y el atacante
      // recuperaría el cupo completo de inmediato.
      expect(bloqueada.timeToBlockExpire).toBeGreaterThan(Math.ceil(ventana / 1000));
      expect(await redis.pttl(`${THROTTLE_KEY_PREFIX}${key}`)).toBeGreaterThan(ventana);
    });
  });
});
