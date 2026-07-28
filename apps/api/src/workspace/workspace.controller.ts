import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { type AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../auth';
import { AUTH_BEARER_SCHEME } from '../common/api-security';
import { ErrorResponseDto } from '../common/dto/error.response.dto';
import { Throttled } from '../common/throttle';
import { WorkspaceTreeResponseDto } from './dto/workspace-tree.response.dto';
import { WorkspaceService } from './workspace.service';

/**
 * `/api/workspace/tree` (plan §4 de la spec 002).
 *
 * El controlador solo hace protocolo: guard, código de estado y contrato OpenAPI. El `userId` sale
 * de `@CurrentUser()`, es decir del token, y **nunca** de un parámetro de la petición: sin `:id` ni
 * *query string*, el token es literalmente lo único que decide qué árbol se devuelve.
 *
 * Sin DTO de entrada porque no hay entrada: la carga por niveles (`?parentId=`) está fuera de
 * alcance por decisión 4 del plan, y un parámetro opcional que hoy nadie manda sería una superficie
 * que validar y documentar a cambio de nada.
 */
@ApiTags('workspace')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@Controller('workspace')
@UseGuards(JwtAuthGuard)
// Declarado a nivel de clase, igual que en los otros dos controladores del módulo: con throttlers
// nombrados y opt-in, una ruta nueva hereda el límite en lugar de quedarse sin ninguno.
@Throttled('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get('tree')
  @ApiOperation({
    summary: 'Devuelve el árbol completo del usuario, plano y sin contenidos',
    operationId: 'getWorkspaceTree',
  })
  @ApiOkResponse({
    type: WorkspaceTreeResponseDto,
    description:
      'Directorios y documentos del usuario en dos listas planas, con orden estable y `generatedAt`',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  // **Sin `@ApiNotFoundResponse`, y es deliberado** (spec v0.2.2, AC-26 acotado; `plan.md` §4). Es la
  // única de las diez rutas que no resuelve ningún id de recurso —ni de la ruta ni del cuerpo—, así
  // que no tiene nada que no encontrar: un workspace vacío responde `200` con las dos listas vacías.
  // Declararlo «por uniformidad del tag» metería en el contrato público una rama de error muerta que
  // un cliente generado se lleva igual, y una descripción en prosa que avise no es legible por
  // máquina. El único `404` que puede ver aquí un cliente es el de ruta inexistente de Nest, que no
  // es una respuesta de esta operación. El e2e de Swagger lo afirma en negativo.
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async tree(@CurrentUser() user: AuthenticatedUser): Promise<WorkspaceTreeResponseDto> {
    return this.workspace.getTree({ userId: user.id });
  }
}
