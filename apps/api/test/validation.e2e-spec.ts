import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { ValidationProbeModule } from './fixtures/validation-probe.module';

describe('ValidationPipe global y formato de error (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ValidationProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('acepta un cuerpo válido (201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe')
      .send({ title: 'una nota', weight: 3 })
      .expect(201);

    expect(response.body).toEqual({ title: 'una nota', weight: 3 });
  });

  describe('AC-5: rechaza propiedades no declaradas en el DTO', () => {
    it('responde 400 nombrando la propiedad rechazada', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: 'una nota', weight: 3, isAdmin: true })
        .expect(400);

      const message = JSON.stringify(response.body.message);
      expect(message).toContain('isAdmin');
    });

    it('no filtra silenciosamente la propiedad extra', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: 'una nota', weight: 3, isAdmin: true });

      expect(response.status).not.toBe(201);
    });
  });

  describe('validación de tipos', () => {
    it('responde 400 cuando un campo no cumple su validador', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: 'no', weight: 99 })
        .expect(400);

      const message = JSON.stringify(response.body.message);
      expect(message).toContain('title');
      expect(message).toContain('weight');
    });

    it('responde 400 cuando falta un campo requerido', async () => {
      await request(app.getHttpServer()).post('/api/probe').send({ title: 'una nota' }).expect(400);
    });

    it('no hace conversión implícita de tipos', async () => {
      await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: 'una nota', weight: '3' })
        .expect(400);
    });
  });

  describe('toda salida de error tiene la forma de ErrorResponseDto', () => {
    it('incluye statusCode, error, message, path y timestamp', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: 'no' })
        .expect(400);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'error',
        'message',
        'path',
        'statusCode',
        'timestamp',
      ]);
      expect(response.body.statusCode).toBe(400);
      expect(typeof response.body.error).toBe('string');
      expect(response.body.path).toBe('/api/probe');
      expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('también aplica a un 404 no manejado', async () => {
      const response = await request(app.getHttpServer()).get('/api/no-existe').expect(404);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'error',
        'message',
        'path',
        'statusCode',
        'timestamp',
      ]);
      expect(response.body.statusCode).toBe(404);
    });
  });
});
