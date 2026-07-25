import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { type AuthenticatedUser, isAuthenticatedUser } from './authenticated-user';

/**
 * Inyecta el usuario autenticado en un controlador. Solo tiene sentido en una ruta con
 * `JwtAuthGuard`.
 *
 * Si el guard falta, lanza `401` en vez de devolver `undefined`: un `@CurrentUser()` sin guard es un
 * endpoint desprotegido, y el fallo tiene que ser evidente en el primer test que lo toque, no un
 * `userId` `undefined` que acabe filtrando los documentos de todos.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();

    if (!isAuthenticatedUser(request.user)) {
      throw new UnauthorizedException('Autenticación requerida');
    }

    return request.user;
  },
);
