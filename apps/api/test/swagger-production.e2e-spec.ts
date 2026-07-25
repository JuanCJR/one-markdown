import './fixtures/env-production';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

// Archivo aparte a propósito: jest da un registro de módulos por archivo, y `AppModule` congela el
// entorno al importarse. Meter ambos entornos en un solo archivo obligaría a `jest.resetModules()`,
// que carga dos copias de `@nestjs/common` y rompe los `instanceof` del filtro de excepciones.
describe('Swagger en producción (e2e) — AC-7', () => {
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

  it('no monta /api/docs-json', async () => {
    await request(app.getHttpServer()).get('/api/docs-json').expect(404);
  });

  it('no monta /api/docs', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });

  it('el resto de la API sigue funcionando', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
});
