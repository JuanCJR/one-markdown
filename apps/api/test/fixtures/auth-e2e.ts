import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';

/** Nombre de la cookie de refresh (specs/001-auth/plan.md §2 decisión 1). */
export const REFRESH_COOKIE = 'om_refresh';

/**
 * Levanta exactamente la misma app que se despliega (`configureApp`), no una versión recortada:
 * la mitad de lo que verifican estos e2e (prefijo, pipe global, filtro, cookie-parser) vive ahí.
 */
export async function createAuthApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}

let emailSeq = 0;

/**
 * Correos únicos por caso. Varios archivos e2e corren contra la misma base y no se limpia la tabla
 * entre archivos (riesgo #5 de la spec): un correo fijo haría fallar el segundo archivo que corra.
 */
export function uniqueEmail(prefix: string): string {
  emailSeq += 1;
  return `auth-${prefix}-${String(process.pid)}-${String(emailSeq)}@example.test`;
}

/** `response.headers` se tipa como `Record<string, string>`, pero `set-cookie` llega como array. */
export function setCookies(response: Response): string[] {
  const raw: unknown = response.headers['set-cookie'];

  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === 'string');
  }

  return typeof raw === 'string' ? [raw] : [];
}

/** La cabecera `Set-Cookie` completa de la cookie de refresh, con sus atributos. */
export function refreshCookieHeader(response: Response): string | null {
  return setCookies(response).find((cookie) => cookie.startsWith(`${REFRESH_COOKIE}=`)) ?? null;
}

/** Solo el par `om_refresh=<token>`, listo para reenviar en la cabecera `Cookie`. */
export function refreshCookiePair(response: Response): string {
  const header = refreshCookieHeader(response);

  if (header === null) {
    throw new Error('La respuesta no trae cookie de refresh');
  }

  const [pair] = header.split(';');

  if (pair === undefined) {
    throw new Error(`Cookie de refresh ilegible: ${header}`);
  }

  return pair;
}

/** El valor (el JWT) de la cookie de refresh. */
export function refreshCookieValue(response: Response): string {
  return refreshCookiePair(response).slice(REFRESH_COOKIE.length + 1);
}

/**
 * Borra las filas creadas por el caso. Se hace por correo y no con un `deleteMany` a secas: la base
 * es la de desarrollo del usuario, no un contenedor desechable.
 */
export async function deleteUsersByEmail(app: INestApplication, emails: string[]): Promise<void> {
  if (emails.length === 0) {
    return;
  }

  await app.get(PrismaService).user.deleteMany({ where: { email: { in: emails } } });
}

/**
 * Limpia las claves de Redis de los usuarios del caso. Nunca `FLUSHALL`: ese Redis es el de
 * desarrollo y tiene datos de otras cosas (riesgo #5 de la spec).
 */
export async function deleteAuthKeys(app: INestApplication, userIds: string[]): Promise<void> {
  const redis = app.get(RedisService).client;

  for (const userId of userIds) {
    const keys = await redis.keys(`auth:session*:${userId}*`);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

/** Contadores y bloqueos de login del caso: la clave es `sha256(email)`, así que se recalcula. */
export async function deleteLoginAttemptKeys(
  app: INestApplication,
  emails: string[],
): Promise<void> {
  const { createHash } = await import('node:crypto');
  const redis = app.get(RedisService).client;

  const keys = emails.flatMap((email) => {
    const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    return [`auth:login:fail:${hash}`, `auth:login:lock:${hash}`];
  });

  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
