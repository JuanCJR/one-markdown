import type { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppConfig } from '../config/env.validation';
import type { RedisService } from '../redis/redis.service';
import { SessionStore } from './session.store';

const REFRESH_TTL = 604800;
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

/**
 * Contra el Redis real de docker: lo que hay que verificar aquí es el TTL, la atomicidad de la
 * rotación y que la familia quede vacía. Un doble en memoria confirmaría la implementación del doble,
 * no la de Redis.
 */
describe('SessionStore (AC-9, AC-10, AC-11)', () => {
  let redis: Redis;
  let store: SessionStore;
  let userSeq = 0;

  beforeAll(() => {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });

    const config = {
      get: (): number => REFRESH_TTL,
    } as unknown as ConfigService<AppConfig, true>;

    // En la app el cliente llega por `RedisService` (spec 000); aquí se le pasa el cliente real.
    store = new SessionStore({ client: redis } as unknown as RedisService, config);
  });

  afterAll(async () => {
    await redis.quit();
  });

  /** Un usuario distinto por caso: varios archivos de test comparten este Redis. */
  function nextUserId(): string {
    userSeq += 1;
    return `test-user-${String(process.pid)}-${String(userSeq)}`;
  }

  async function keysOf(userId: string): Promise<string[]> {
    const keys = await redis.keys(`auth:session*:${userId}*`);
    return keys.sort();
  }

  afterEach(async () => {
    const keys = await redis.keys(`auth:session*:test-user-${String(process.pid)}*`);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('create', () => {
    it('guarda la sesión con TTL y la indexa en la familia del usuario', async () => {
      const userId = nextUserId();

      await store.create({ userId, sid: 'sid-1', jti: 'jti-1' });

      const ttl = await redis.ttl(`auth:session:${userId}:sid-1`);
      const familia = await redis.smembers(`auth:sessions:${userId}`);

      expect(ttl).toBeGreaterThan(REFRESH_TTL - 10);
      expect(ttl).toBeLessThanOrEqual(REFRESH_TTL);
      expect(familia).toEqual(['sid-1']);
    });

    it('no guarda el jti en claro dentro de la clave, solo en el valor', async () => {
      const userId = nextUserId();

      await store.create({ userId, sid: 'sid-1', jti: 'jti-secreto' });

      expect((await keysOf(userId)).join(' ')).not.toContain('jti-secreto');
    });
  });

  describe('rotate', () => {
    it('acepta el jti vigente, devuelve rotated y deja el nuevo en su lugar', async () => {
      const userId = nextUserId();
      await store.create({ userId, sid: 'sid-1', jti: 'jti-1' });

      const resultado = await store.rotate({
        userId,
        sid: 'sid-1',
        presentedJti: 'jti-1',
        nextJti: 'jti-2',
      });

      expect(resultado).toBe('rotated');
      await expect(
        store.rotate({ userId, sid: 'sid-1', presentedJti: 'jti-2', nextJti: 'jti-3' }),
      ).resolves.toBe('rotated');
    });

    it('renueva el TTL en cada rotación', async () => {
      const userId = nextUserId();
      await store.create({ userId, sid: 'sid-1', jti: 'jti-1' });
      await redis.expire(`auth:session:${userId}:sid-1`, 60);

      await store.rotate({ userId, sid: 'sid-1', presentedJti: 'jti-1', nextJti: 'jti-2' });

      expect(await redis.ttl(`auth:session:${userId}:sid-1`)).toBeGreaterThan(60);
    });

    it('el jti anterior deja de servir en cuanto se rota', async () => {
      const userId = nextUserId();
      await store.create({ userId, sid: 'sid-1', jti: 'jti-1' });
      await store.rotate({ userId, sid: 'sid-1', presentedJti: 'jti-1', nextJti: 'jti-2' });

      await expect(
        store.rotate({ userId, sid: 'sid-1', presentedJti: 'jti-1', nextJti: 'jti-9' }),
      ).resolves.toBe('reused');
    });

    // AC-10: la reutilización es la señal de que el refresh se filtró. Perder la sesión es visible
    // para la víctima; compartirla en silencio con el atacante, no.
    it('ante reutilización revoca TODA la familia de sesiones del usuario', async () => {
      const userId = nextUserId();
      await store.create({ userId, sid: 'sid-1', jti: 'jti-1' });
      await store.create({ userId, sid: 'sid-2', jti: 'jti-otra' });
      await store.rotate({ userId, sid: 'sid-1', presentedJti: 'jti-1', nextJti: 'jti-2' });

      const resultado = await store.rotate({
        userId,
        sid: 'sid-1',
        presentedJti: 'jti-1',
        nextJti: 'jti-3',
      });

      expect(resultado).toBe('reused');
      expect(await keysOf(userId)).toEqual([]);
      await expect(
        store.rotate({ userId, sid: 'sid-2', presentedJti: 'jti-otra', nextJti: 'jti-4' }),
      ).resolves.toBe('not_found');
    });

    it('devuelve not_found para una sesión inexistente, sin lanzar', async () => {
      await expect(
        store.rotate({
          userId: nextUserId(),
          sid: 'sid-fantasma',
          presentedJti: 'jti-1',
          nextJti: 'jti-2',
        }),
      ).resolves.toBe('not_found');
    });

    it('dos rotaciones simultáneas con el mismo jti: solo una gana', async () => {
      const userId = nextUserId();
      await store.create({ userId, sid: 'sid-1', jti: 'jti-1' });

      const resultados = await Promise.all([
        store.rotate({ userId, sid: 'sid-1', presentedJti: 'jti-1', nextJti: 'jti-a' }),
        store.rotate({ userId, sid: 'sid-1', presentedJti: 'jti-1', nextJti: 'jti-b' }),
      ]);

      expect(resultados.filter((r) => r === 'rotated')).toHaveLength(1);
      expect(resultados.filter((r) => r === 'reused')).toHaveLength(1);
    });
  });

  describe('revoke y revokeAll (AC-11)', () => {
    it('revoke invalida solo la sesión indicada', async () => {
      const userId = nextUserId();
      await store.create({ userId, sid: 'sid-1', jti: 'jti-1' });
      await store.create({ userId, sid: 'sid-2', jti: 'jti-2' });

      await store.revoke({ userId, sid: 'sid-1' });

      await expect(
        store.rotate({ userId, sid: 'sid-1', presentedJti: 'jti-1', nextJti: 'x' }),
      ).resolves.toBe('not_found');
      await expect(
        store.rotate({ userId, sid: 'sid-2', presentedJti: 'jti-2', nextJti: 'y' }),
      ).resolves.toBe('rotated');
      expect(await redis.smembers(`auth:sessions:${userId}`)).toEqual(['sid-2']);
    });

    it('revoke de una sesión inexistente no lanza', async () => {
      await expect(
        store.revoke({ userId: nextUserId(), sid: 'sid-fantasma' }),
      ).resolves.toBeUndefined();
    });

    it('revokeAll deja al usuario sin ninguna sesión', async () => {
      const userId = nextUserId();
      await store.create({ userId, sid: 'sid-1', jti: 'jti-1' });
      await store.create({ userId, sid: 'sid-2', jti: 'jti-2' });

      await store.revokeAll({ userId });

      expect(await keysOf(userId)).toEqual([]);
    });

    // Lo usa `mfa/disable` (T-016): bajar el segundo factor cierra los demás dispositivos, pero
    // echar al usuario de la sesión desde la que lo está haciendo sería absurdo.
    it('revokeAll puede preservar la sesión actual', async () => {
      const userId = nextUserId();
      await store.create({ userId, sid: 'sid-actual', jti: 'jti-actual' });
      await store.create({ userId, sid: 'sid-otra', jti: 'jti-otra' });

      await store.revokeAll({ userId, exceptSid: 'sid-actual' });

      await expect(
        store.rotate({ userId, sid: 'sid-actual', presentedJti: 'jti-actual', nextJti: 'x' }),
      ).resolves.toBe('rotated');
      await expect(
        store.rotate({ userId, sid: 'sid-otra', presentedJti: 'jti-otra', nextJti: 'y' }),
      ).resolves.toBe('not_found');
      expect(await redis.smembers(`auth:sessions:${userId}`)).toEqual(['sid-actual']);
    });
  });
});
