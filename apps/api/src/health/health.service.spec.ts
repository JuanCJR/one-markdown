import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import { HealthService } from './health.service';

type PingResult = Promise<unknown>;

function createService(options: {
  prismaPing?: () => PingResult;
  redisPing?: () => PingResult;
}): HealthService {
  const prisma = {
    ping: jest.fn(options.prismaPing ?? ((): PingResult => Promise.resolve())),
  } as unknown as PrismaService;

  const redis = {
    ping: jest.fn(options.redisPing ?? ((): PingResult => Promise.resolve('PONG'))),
  } as unknown as RedisService;

  return new HealthService(prisma, redis);
}

describe('HealthService', () => {
  describe('liveness', () => {
    it('responde ok sin tocar dependencias externas', () => {
      const prismaPing = jest.fn(() => Promise.resolve());
      const service = createService({ prismaPing });

      const result = service.liveness();

      expect(result.status).toBe('ok');
      expect(prismaPing).not.toHaveBeenCalled();
    });
  });

  describe('readiness (AC-3)', () => {
    it('devuelve ready con ambos checks up cuando las dependencias responden', async () => {
      const result = await createService({}).readiness();

      expect(result.status).toBe('ready');
      expect(result.checks).toEqual({ database: 'up', redis: 'up' });
    });
  });

  describe('readiness degradado (AC-4)', () => {
    it('marca database down y no propaga la excepción cuando PostgreSQL falla', async () => {
      const result = await createService({
        prismaPing: () => Promise.reject(new Error('ECONNREFUSED')),
      }).readiness();

      expect(result.status).toBe('not_ready');
      expect(result.checks).toEqual({ database: 'down', redis: 'up' });
    });

    it('marca redis down cuando Redis falla', async () => {
      const result = await createService({
        redisPing: () => Promise.reject(new Error('ECONNREFUSED')),
      }).readiness();

      expect(result.status).toBe('not_ready');
      expect(result.checks).toEqual({ database: 'up', redis: 'down' });
    });

    it('marca ambos down cuando las dos dependencias fallan', async () => {
      const result = await createService({
        prismaPing: () => Promise.reject(new Error('down')),
        redisPing: () => Promise.reject(new Error('down')),
      }).readiness();

      expect(result.status).toBe('not_ready');
      expect(result.checks).toEqual({ database: 'down', redis: 'down' });
    });

    it('marca down un check que no responde antes del timeout', async () => {
      jest.useFakeTimers();

      try {
        const pending = createService({
          prismaPing: () => new Promise<void>(() => undefined),
        }).readiness();

        await jest.advanceTimersByTimeAsync(3000);
        const result = await pending;

        expect(result.checks.database).toBe('down');
        expect(result.checks.redis).toBe('up');
        expect(result.status).toBe('not_ready');
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
