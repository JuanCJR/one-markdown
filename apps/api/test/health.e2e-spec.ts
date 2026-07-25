import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health (AC-2)', () => {
    it('responde 200 con la forma exacta de HealthResponseDto', async () => {
      const response = await request(app.getHttpServer()).get('/api/health').expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'status',
        'uptimeSeconds',
        'version',
      ]);
      expect(response.body).toMatchObject({ status: 'ok' });
      expect(typeof response.body.uptimeSeconds).toBe('number');
      expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(typeof response.body.version).toBe('string');
      expect(response.body.version.length).toBeGreaterThan(0);
    });

    it('no expone el endpoint sin el prefijo global /api', async () => {
      await request(app.getHttpServer()).get('/health').expect(404);
    });
  });

  describe('GET /api/health/ready (AC-3)', () => {
    it('responde 200 con ambos checks up cuando PostgreSQL y Redis están arriba', async () => {
      const response = await request(app.getHttpServer()).get('/api/health/ready').expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual(['checks', 'status']);
      expect(response.body).toEqual({
        status: 'ready',
        checks: { database: 'up', redis: 'up' },
      });
    });
  });
});
