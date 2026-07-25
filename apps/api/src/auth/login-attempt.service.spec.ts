import Redis from 'ioredis';

import type { RedisService } from '../redis/redis.service';
import { AccountLockedException } from './account-locked.exception';
import { LoginAttemptService } from './login-attempt.service';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

describe('LoginAttemptService (AC-7)', () => {
  let redis: Redis;
  let service: LoginAttemptService;
  let seq = 0;

  beforeAll(() => {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
    service = new LoginAttemptService({ client: redis } as unknown as RedisService);
  });

  afterAll(async () => {
    await redis.quit();
  });

  afterEach(async () => {
    const keys = await redis.keys('auth:login:*');

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  function nextEmail(): string {
    seq += 1;
    return `intentos-${String(process.pid)}-${String(seq)}@example.test`;
  }

  async function fallar(email: string, veces: number): Promise<void> {
    for (let i = 0; i < veces; i += 1) {
      await service.registerFailure(email);
    }
  }

  it('no bloquea con cuatro fallos', async () => {
    const email = nextEmail();

    await fallar(email, 4);

    await expect(service.assertNotLocked(email)).resolves.toBeUndefined();
  });

  it('bloquea al quinto fallo, con el tiempo de espera a la vista', async () => {
    const email = nextEmail();

    await fallar(email, 5);

    await expect(service.assertNotLocked(email)).rejects.toBeInstanceOf(AccountLockedException);

    // El operador (y el usuario legítimo) necesitan saber cuánto esperar, no solo que se les negó.
    try {
      await service.assertNotLocked(email);
      throw new Error('debía haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(AccountLockedException);
      const locked = error as AccountLockedException;
      expect(locked.getStatus()).toBe(429);
      expect(locked.retryAfterSeconds).toBeGreaterThan(0);
      expect(locked.retryAfterSeconds).toBeLessThanOrEqual(900);
    }
  });

  it('un login correcto antes del quinto fallo pone el contador a cero', async () => {
    const email = nextEmail();

    await fallar(email, 4);
    await service.reset(email);
    await fallar(email, 4);

    await expect(service.assertNotLocked(email)).resolves.toBeUndefined();
  });

  it('reset levanta un bloqueo ya activo', async () => {
    const email = nextEmail();
    await fallar(email, 5);

    await service.reset(email);

    await expect(service.assertNotLocked(email)).resolves.toBeUndefined();
  });

  // El correo es un dato personal: en Redis solo viaja su hash. Un dump de la caché no debe ser una
  // lista de direcciones registradas.
  it('no deja el correo en claro en ninguna clave de Redis', async () => {
    const email = nextEmail();

    await fallar(email, 5);
    const claves = (await redis.keys('auth:login:*')).join(' ');

    expect(claves).not.toContain(email);
    expect(claves).toMatch(/auth:login:(fail|lock):[0-9a-f]{64}/);
  });

  it('normaliza el correo: la caja y los espacios no abren un contador nuevo', async () => {
    const email = nextEmail();

    await fallar(email.toUpperCase(), 3);
    await fallar(`  ${email}  `, 2);

    await expect(service.assertNotLocked(email)).rejects.toBeInstanceOf(AccountLockedException);
  });

  it('cuentas distintas no comparten contador', async () => {
    const unaEmail = nextEmail();
    const otraEmail = nextEmail();

    await fallar(unaEmail, 5);

    await expect(service.assertNotLocked(otraEmail)).resolves.toBeUndefined();
  });
});
