import { createHash } from 'node:crypto';

import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { seconds, SkipThrottle, type ThrottlerOptions } from '@nestjs/throttler';

/**
 * Rate limit por IP de la superficie de auth (specs/001-auth/plan.md §3, AC-20).
 *
 * Es la mitad complementaria del bloqueo por cuenta de `LoginAttemptService`: aquél frena muchas
 * contraseñas contra **una** cuenta, éste frena muchas peticiones desde **una** IP. Ninguno cubre al
 * otro, y los endpoints que no tocan una cuenta concreta (verificación de TOTP, canje de códigos de
 * recuperación) solo están protegidos por éste.
 */

export const THROTTLE_NAMES = ['register', 'login', 'mfa', 'refresh'] as const;

export type ThrottleName = (typeof THROTTLE_NAMES)[number];

export interface ThrottleLimit {
  /** Peticiones permitidas por ventana. */
  readonly limit: number;
  /** Ventana en segundos (el helper `seconds()` de la librería la convierte a ms). */
  readonly ttlSeconds: number;
}

/**
 * Límites de `plan.md` §3. Van como constantes y no como variables de entorno, igual que el umbral
 * del bloqueo por cuenta: son una decisión de seguridad de la spec, no un ajuste por despliegue.
 */
export const THROTTLE_LIMITS: Record<ThrottleName, ThrottleLimit> = {
  // Cinco cuentas por cuarto de hora: crear cuentas en masa es el abuso barato del registro.
  register: { limit: 5, ttlSeconds: 900 },
  login: { limit: 10, ttlSeconds: 60 },
  // Cubre `setup`, `enable`, `verify` y `disable`: son diez intentos de segundo factor por minuto
  // **en total**, no diez por endpoint. Sin esto, adivinar un TOTP de seis dígitos (~333k intentos
  // esperados) o quemar CPU comparando ocho hashes bcrypt por petición no tiene freno.
  mfa: { limit: 10, ttlSeconds: 60 },
  refresh: { limit: 60, ttlSeconds: 60 },
};

/** Mensaje del `429`. Genérico a propósito: no dice qué límite se alcanzó ni cuántos quedaban. */
export const THROTTLE_ERROR_MESSAGE =
  'Demasiadas peticiones desde esta dirección. Inténtalo de nuevo en unos instantes.';

/**
 * Prefijo de todas las claves de rate limit en Redis. Namespace propio: los contadores comparten el
 * Redis con `auth:*` (sesiones, bloqueos, desafíos) y una colisión invalidaría una sesión real.
 */
export const THROTTLE_KEY_PREFIX = 'throttle:';

const THROTTLE_METADATA = 'om:throttle';

const reflector = new Reflector();

/**
 * Declara **el** throttler de una ruta.
 *
 * `ThrottlerGuard` evalúa *todos* los throttlers nombrados en cada petición, así que sin esta
 * declaración explícita el límite más estricto (`register`: 5 por 15 min) caería sobre cualquier
 * endpoint de la aplicación, incluidos los que aún no existen. Con el `skipIf` de más abajo el
 * modelo se invierte: nada está limitado salvo lo que lo pide.
 */
export const Throttled = (name: ThrottleName): MethodDecorator & ClassDecorator =>
  SetMetadata(THROTTLE_METADATA, name);

/**
 * Deja una ruta fuera de todos los throttlers.
 *
 * `@SkipThrottle()` a secas solo salta el throttler llamado `default`, que aquí no existe: con
 * throttlers nombrados hay que nombrarlos todos.
 */
export const SkipThrottling = (): MethodDecorator & ClassDecorator =>
  SkipThrottle(Object.fromEntries(THROTTLE_NAMES.map((name) => [name, true])));

function declaredThrottler(context: ExecutionContext): ThrottleName | undefined {
  return reflector.getAllAndOverride<ThrottleName | undefined>(THROTTLE_METADATA, [
    context.getHandler(),
    context.getClass(),
  ]);
}

/**
 * La IP del cliente. `req.ip` de Express con `trust proxy` desactivado es la dirección real del
 * socket: nunca una cabecera `X-Forwarded-For`, que cualquiera puede inventarse para saltarse el
 * límite. Cuando se despliegue tras un proxy habrá que configurar `trust proxy` a conciencia.
 */
export function throttleTracker(request: Record<string, unknown>): string {
  const ip = request['ip'];

  if (typeof ip === 'string' && ip.length > 0) {
    return ip;
  }

  const socket = request['socket'];

  if (typeof socket === 'object' && socket !== null) {
    const remote = (socket as { remoteAddress?: unknown }).remoteAddress;

    if (typeof remote === 'string' && remote.length > 0) {
      return remote;
    }
  }

  // Sin IP no se puede limitar por IP: se agrupa todo en un cubo común en vez de dejar pasar.
  return 'unknown';
}

/**
 * Clave del contador: `{throttler}:{sha256(ip)}`.
 *
 * Sin el nombre de la clase ni del handler (que es lo que hace la clave por defecto de la librería)
 * a propósito: los cuatro endpoints de MFA comparten un único cupo de diez por minuto. Si cada uno
 * tuviera el suyo, el atacante sumaría cuarenta.
 *
 * La IP va hasheada: este Redis no debe convertirse en un registro legible de quién usa la API.
 */
export function throttleKey(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string,
): string {
  return `${throttlerName}:${createHash('sha256').update(tracker).digest('hex')}`;
}

/**
 * Los cuatro throttlers nombrados. Cada uno se salta a sí mismo salvo en las rutas que lo declaran
 * con `@Throttled(name)`: un endpoint nuevo no hereda ningún límite por accidente.
 */
export const AUTH_THROTTLERS: ThrottlerOptions[] = THROTTLE_NAMES.map((name) => ({
  name,
  limit: THROTTLE_LIMITS[name].limit,
  ttl: seconds(THROTTLE_LIMITS[name].ttlSeconds),
  skipIf: (context: ExecutionContext): boolean => declaredThrottler(context) !== name,
}));
