import Redis from 'ioredis';

import type { RedisService } from '../../redis/redis.service';
import {
  MFA_CHALLENGE_MAX_ATTEMPTS,
  MFA_CHALLENGE_TTL_SECONDS,
  MfaChallengeStore,
} from './mfa-challenge.store';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

/**
 * Contra el Redis real de docker, igual que `session.store.spec.ts`: lo que hay que verificar es el
 * TTL, el conteo atómico de intentos y que el desafío desaparezca al agotarse. Un doble en memoria
 * confirmaría la implementación del doble.
 */
describe('MfaChallengeStore (AC-17)', () => {
  let redis: Redis;
  let store: MfaChallengeStore;
  let seq = 0;

  beforeAll(() => {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
    store = new MfaChallengeStore({ client: redis } as unknown as RedisService);
  });

  afterAll(async () => {
    await redis.quit();
  });

  /** Un `jti` distinto por caso: varios archivos de test comparten este Redis. */
  function nextJti(): string {
    seq += 1;
    return `test-challenge-${String(process.pid)}-${String(seq)}`;
  }

  function key(jti: string): string {
    return `auth:mfa:challenge:${jti}`;
  }

  afterEach(async () => {
    const keys = await redis.keys(`auth:mfa:challenge:test-challenge-${String(process.pid)}*`);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('create', () => {
    it('guarda el desafío con TTL y devuelve los segundos que dura', async () => {
      const jti = nextJti();

      const ttl = await store.create({ jti, userId: 'user-1' });

      expect(ttl).toBe(MFA_CHALLENGE_TTL_SECONDS);
      expect(await redis.ttl(key(jti))).toBeGreaterThan(MFA_CHALLENGE_TTL_SECONDS - 10);
      expect(await redis.ttl(key(jti))).toBeLessThanOrEqual(MFA_CHALLENGE_TTL_SECONDS);
    });

    it('arranca sin intentos gastados', async () => {
      const jti = nextJti();
      await store.create({ jti, userId: 'user-1' });

      for (let intento = 0; intento < MFA_CHALLENGE_MAX_ATTEMPTS; intento += 1) {
        await expect(store.consume(jti)).resolves.toEqual({ status: 'open', userId: 'user-1' });
      }
    });
  });

  describe('consume', () => {
    it('devuelve el usuario del desafío', async () => {
      const jti = nextJti();
      await store.create({ jti, userId: 'user-42' });

      await expect(store.consume(jti)).resolves.toEqual({ status: 'open', userId: 'user-42' });
    });

    it('devuelve not_found para un jti que no existe, sin lanzar', async () => {
      await expect(store.consume(nextJti())).resolves.toEqual({ status: 'not_found' });
    });

    // AC-17: cinco intentos y el desafío muere. Al sexto ya no queda nada que verificar, ni con el
    // código correcto: hay que volver al login.
    it(`destruye el desafío al intento ${String(MFA_CHALLENGE_MAX_ATTEMPTS)} y el siguiente no lo encuentra`, async () => {
      const jti = nextJti();
      await store.create({ jti, userId: 'user-1' });

      for (let intento = 0; intento < MFA_CHALLENGE_MAX_ATTEMPTS; intento += 1) {
        await expect(store.consume(jti)).resolves.toEqual({ status: 'open', userId: 'user-1' });
      }

      expect(await redis.exists(key(jti))).toBe(0);
      await expect(store.consume(jti)).resolves.toEqual({ status: 'not_found' });
    });

    // Renovar el TTL en cada intento dejaría el desafío vivo indefinidamente a base de teclear
    // códigos: los 5 minutos cuentan desde el login, no desde el último intento.
    it('no alarga el TTL del desafío', async () => {
      const jti = nextJti();
      await store.create({ jti, userId: 'user-1' });
      await redis.expire(key(jti), 60);

      await store.consume(jti);

      expect(await redis.ttl(key(jti))).toBeLessThanOrEqual(60);
      expect(await redis.ttl(key(jti))).toBeGreaterThan(0);
    });

    // Sin atomicidad, cinco peticiones en paralelo leerían `attempts: 0` y escribirían `1`: el límite
    // de intentos se saltaría con solo pedir en paralelo.
    it('cuenta los intentos de forma atómica aunque lleguen en paralelo', async () => {
      const jti = nextJti();
      await store.create({ jti, userId: 'user-1' });

      const resultados = await Promise.all(
        Array.from({ length: MFA_CHALLENGE_MAX_ATTEMPTS }, () => store.consume(jti)),
      );

      expect(resultados.every((r) => r.status === 'open')).toBe(true);
      expect(await redis.exists(key(jti))).toBe(0);
    });
  });

  describe('destroy', () => {
    it('un desafío destruido ya no se encuentra', async () => {
      const jti = nextJti();
      await store.create({ jti, userId: 'user-1' });

      await store.destroy(jti);

      await expect(store.consume(jti)).resolves.toEqual({ status: 'not_found' });
    });

    it('destruir un desafío inexistente no lanza', async () => {
      await expect(store.destroy(nextJti())).resolves.toBeUndefined();
    });
  });
});
