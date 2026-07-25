import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { TotpService } from '../../src/auth/mfa/totp.service';
import { TokenService } from '../../src/auth/token.service';
import { RedisService } from '../../src/redis/redis.service';
import { uniqueEmail } from './auth-e2e';

/**
 * Helpers de los e2e de MFA. Complementan `auth-e2e.ts` (que ya cubre app, correos únicos y cookies)
 * con lo específico del segundo factor: códigos TOTP del instante actual y limpieza de las claves
 * `auth:mfa:*` del caso.
 */

/**
 * Código TOTP válido **ahora mismo**.
 *
 * El `epoch` de `TotpService` es un parámetro opcional, así que el e2e genera el código del instante
 * en curso en vez de esperar treinta segundos o falsear el reloj del proceso (plan §8).
 */
export async function currentTotpCode(app: INestApplication, secret: string): Promise<string> {
  return app.get(TotpService).generateCode(secret);
}

/**
 * Un código de seis dígitos que el servicio **rechaza** para ese secreto.
 *
 * No se usa un literal como `'000000'`: con la tolerancia de ±30 s hay tres ventanas activas, y un
 * literal podría coincidir con una de ellas y volver el test intermitente. Se prueban candidatos
 * hasta encontrar uno que la verificación real rechace.
 */
export async function wrongTotpCode(app: INestApplication, secret: string): Promise<string> {
  const totp = app.get(TotpService);

  for (let digito = 0; digito < 10; digito += 1) {
    const candidato = String(digito).repeat(6);

    if (!(await totp.verify(secret, candidato))) {
      return candidato;
    }
  }

  throw new Error('no se pudo construir un código TOTP inválido');
}

/** Usuario ya enrolado, con lo único que el e2e no puede volver a pedir: el secreto y los códigos. */
export interface EnrolledMfaUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  /** Access token del registro; sigue sirviendo tras el `enable`. */
  readonly accessToken: string;
  readonly secret: string;
  readonly recoveryCodes: string[];
}

/**
 * Registra un usuario y le activa el segundo factor pasando por los endpoints reales
 * (`register` → `mfa/setup` → `mfa/enable`).
 *
 * Se hace por HTTP y no escribiendo la fila a mano: el secreto tiene que quedar cifrado con la misma
 * clave y el mismo formato que usa la aplicación, o los casos de `verify` probarían otra cosa.
 */
export async function enrollMfaUser(
  app: INestApplication,
  prefix: string,
  password: string,
): Promise<EnrolledMfaUser> {
  const email = uniqueEmail(prefix);
  const server = app.getHttpServer();

  const registered = await request(server)
    .post('/api/auth/register')
    .send({ email, password })
    .expect(201);

  const accessToken = String(registered.body.accessToken);
  const setup = await request(server)
    .post('/api/auth/mfa/setup')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const secret = String(setup.body.secret);
  const enabled = await request(server)
    .post('/api/auth/mfa/enable')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ code: await currentTotpCode(app, secret) })
    .expect(200);

  return {
    id: String(registered.body.user.id),
    email,
    password,
    accessToken,
    secret,
    recoveryCodes: enabled.body.recoveryCodes as string[],
  };
}

/** El `jti` del desafío que hay dentro de un `mfaToken`, para poder borrar su clave de Redis. */
export async function mfaChallengeJti(app: INestApplication, mfaToken: string): Promise<string> {
  return (await app.get(TokenService).verifyMfa(mfaToken)).jti;
}

/** Claves de enrolamiento pendiente (`auth:mfa:setup:{userId}`) creadas por el caso. */
export async function deleteMfaSetupKeys(
  app: INestApplication,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) {
    return;
  }

  await app.get(RedisService).client.del(...userIds.map((id) => `auth:mfa:setup:${id}`));
}

/** Desafíos de segundo factor (`auth:mfa:challenge:{jti}`) creados por el caso. */
export async function deleteMfaChallengeKeys(
  app: INestApplication,
  jtis: string[],
): Promise<void> {
  if (jtis.length === 0) {
    return;
  }

  await app.get(RedisService).client.del(...jtis.map((jti) => `auth:mfa:challenge:${jti}`));
}
