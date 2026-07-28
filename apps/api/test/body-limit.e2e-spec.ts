import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { JSON_BODY_LIMIT, MAX_DOCUMENT_CONTENT_CHARS } from '../src/workspace/workspace.constants';
import {
  createAuthApp,
  deleteAuthKeys,
  deleteUsersByEmail,
  resetThrottleCounters,
  uniqueEmail,
} from './fixtures/auth-e2e';

/**
 * Spec 002 · AC-33 — el límite de cuerpo JSON responde `413`, no `500`.
 *
 * `plan.md` §4 prometía un `413` desde la v0.1.0, pero lo medido al implementar `T-008` fue un `500`:
 * el `PayloadTooLargeError` de body-parser no es una `HttpException`, así que `AllExceptionsFilter`
 * no lo reconocía aunque el error trajera `status: 413`. Además el filtro registra `logger.error` con
 * traza completa en todo lo que no es `HttpException`, o sea que cualquiera con un token válido tenía
 * un amplificador de ruido en los logs y un disparador de alertas de `5xx`.
 *
 * El archivo es propio y no un caso más de `workspace-documents.e2e-spec.ts` a propósito: lo que se
 * verifica no es el endpoint de documentos, sino el **filtro global** de la spec `000`. El endpoint es
 * solo el vehículo, por ser el único de la API que acepta un cuerpo lo bastante grande como para
 * cruzar el límite sin que un DTO lo pare antes.
 *
 * Los dos casos simétricos son la mitad que impide que esto se convierta en «todo cuerpo grande es
 * 413»: por debajo del límite el cuerpo tiene que llegar al DTO y salir `400` o `201` según su
 * contenido. Si el `413` se comiera esas validaciones, AC-13 dejaría de significar nada.
 */

const VALID_PASSWORD = 'contrasena-valida-1';

/** Claves **exactas** de `ErrorResponseDto` para un error sin `retryAfterSeconds` ni `code`. */
const ERROR_KEYS = ['error', 'message', 'path', 'statusCode', 'timestamp'];

/**
 * Cuerpo por encima de `JSON_BODY_LIMIT` (2 MiB), generado aquí y nunca versionado: un fichero de
 * 3 MB en el repositorio sería peso muerto permanente para comprobar una sola cifra.
 *
 * 3 MiB de ASCII → 3 MiB de bytes en el JSON, holgadamente por encima del límite, y muy por debajo de
 * cualquier riesgo de memoria en el proceso de test.
 */
const OVERSIZED_CONTENT = 'a'.repeat(3 * 1024 * 1024);

interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
}

describe('límite de cuerpo JSON (e2e) — AC-33', () => {
  let app: INestApplication;
  const emails: string[] = [];
  const userIds: string[] = [];

  let actor: Actor;

  beforeAll(async () => {
    app = await createAuthApp();
    await resetThrottleCounters(app);
    actor = await register('body-limit');
  });

  afterAll(async () => {
    await deleteAuthKeys(app, userIds);
    await deleteUsersByEmail(app, emails);
    await resetThrottleCounters(app);
    await app.close();
  });

  // El rate limit es por IP y todas las peticiones de todos los archivos e2e salen de 127.0.0.1.
  beforeEach(async () => {
    await resetThrottleCounters(app);
  });

  async function register(prefix: string): Promise<Actor> {
    const email = uniqueEmail(prefix);
    emails.push(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    const userId: string = response.body.user.id;
    userIds.push(userId);

    return { userId, email, accessToken: response.body.accessToken };
  }

  function postDocument(body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .post('/api/workspace/documents')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send(body);
  }

  it('un cuerpo por encima de JSON_BODY_LIMIT responde 413 con la forma de ErrorResponseDto', async () => {
    // El límite se declara en caracteres de una cadena (`'2mb'`); el cuerpo lo supera de sobra.
    expect(JSON_BODY_LIMIT).toBe('2mb');
    expect(OVERSIZED_CONTENT.length).toBeGreaterThan(2 * 1024 * 1024);

    const response = await postDocument({
      title: 'Documento gigante',
      directoryId: null,
      content: OVERSIZED_CONTENT,
    });

    expect(response.status).toBe(413);

    const body = response.body as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(ERROR_KEYS);
    expect(body['statusCode']).toBe(413);
    expect(body['error']).toBe('Payload Too Large');
    expect(typeof body['message']).toBe('string');
    expect(body['path']).toBe('/api/workspace/documents');
    expect(typeof body['timestamp']).toBe('string');
  });

  it('por debajo del límite el cuerpo sigue llegando al DTO: contenido pasado de largo da 400', async () => {
    const response = await postDocument({
      title: 'Documento largo pero transportable',
      directoryId: null,
      content: 'b'.repeat(MAX_DOCUMENT_CONTENT_CHARS + 1),
    });

    // Cabe de sobra en 2 MiB, así que el rechazo tiene que venir del DTO y no del transporte.
    expect(response.status).toBe(400);

    const body = response.body as Record<string, unknown>;

    expect(body['statusCode']).toBe(400);
    // El mensaje nombra `content`: si el `400` viniera de otro campo, el caso pasaría sin medir nada.
    expect(JSON.stringify(body['message'])).toContain('content');
  });

  it('por debajo del límite un cuerpo válido sigue creando el documento', async () => {
    const response = await postDocument({
      title: 'Documento normal del test de límite',
      directoryId: null,
      content: '# Cabe sin problema',
    });

    expect(response.status).toBe(201);
  });
});
