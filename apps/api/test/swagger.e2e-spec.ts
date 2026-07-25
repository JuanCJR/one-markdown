import './fixtures/env-development';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

describe('Swagger fuera de producción (e2e) — AC-7', () => {
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

  it('sirve /api/docs-json con la ruta /api/health documentada', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.paths).toHaveProperty(['/api/health']);
    expect(response.body.paths['/api/health']).toHaveProperty('get');
  });

  it('expone el schema HealthResponseDto con sus tres propiedades', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    const schema = response.body.components?.schemas?.HealthResponseDto;
    expect(schema).toBeDefined();
    expect(Object.keys(schema.properties).sort()).toEqual(['status', 'uptimeSeconds', 'version']);
  });

  it('documenta ErrorResponseDto como contrato de error', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.components?.schemas?.ErrorResponseDto).toBeDefined();
  });

  it('sirve la UI en /api/docs', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});
