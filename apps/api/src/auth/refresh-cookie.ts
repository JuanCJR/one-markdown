import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';

/** Nombre de la cookie de refresh (specs/001-auth/plan.md §2 decisión 1). */
export const REFRESH_COOKIE_NAME = 'om_refresh';

/**
 * La cookie solo se envía a `/api/auth/*`. Reducir el alcance importa: así ninguna otra petición de
 * la aplicación la lleva encima, y el resto de la API no puede filtrarla por accidente en un log.
 */
export const REFRESH_COOKIE_PATH = '/api/auth';

function baseOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true, // ningún XSS puede leerla
    sameSite: 'strict', // el navegador no la manda desde otro sitio: mitiga el CSRF del refresh
    path: REFRESH_COOKIE_PATH,
    secure, // en producción solo por HTTPS; en dev, http://localhost tiene que seguir funcionando
  };
}

export function setRefreshCookie(
  response: Response,
  token: string,
  params: { ttlSeconds: number; secure: boolean },
): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(params.secure),
    maxAge: params.ttlSeconds * 1000,
  });
}

/**
 * `Max-Age=0` explícito en vez de `res.clearCookie()`: el contrato dice `Max-Age=0` y `clearCookie`
 * emite solo `Expires` en el pasado, que un cliente con el reloj desajustado podría ignorar.
 */
export function clearRefreshCookie(response: Response, params: { secure: boolean }): void {
  response.cookie(REFRESH_COOKIE_NAME, '', { ...baseOptions(params.secure), maxAge: 0 });
}

/**
 * El refresh token de la cookie, o `null` si no viene.
 *
 * Un decorador y no `@Req()`: así el controlador no toca el objeto de Express (cuyo `cookies` está
 * tipado laxo) y la ausencia de cookie llega como un `null` explícito que el servicio debe tratar.
 */
export const RefreshCookie = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest<{ cookies?: Record<string, unknown> }>();
    const value = request.cookies?.[REFRESH_COOKIE_NAME];

    return typeof value === 'string' && value.length > 0 ? value : null;
  },
);
