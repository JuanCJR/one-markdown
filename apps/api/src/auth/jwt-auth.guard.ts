import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { JWT_ACCESS_STRATEGY } from './jwt-access.strategy';

/**
 * Protege una ruta con `Authorization: Bearer <accessToken>`.
 *
 * Se exporta desde el índice público del módulo: es, junto con `@CurrentUser()`, todo lo que la spec
 * `002-workspace-tree` necesita importar para hacer autorización por recurso.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_ACCESS_STRATEGY) {}
