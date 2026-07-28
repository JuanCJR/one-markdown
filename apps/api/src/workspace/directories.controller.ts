import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { type AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../auth';
import { AUTH_BEARER_SCHEME } from '../common/api-security';
import { ErrorResponseDto } from '../common/dto/error.response.dto';
import { Throttled } from '../common/throttle';
import { DirectoriesService } from './directories.service';
import { CreateDirectoryRequestDto } from './dto/create-directory.request.dto';
import { DeleteDirectoryQueryDto } from './dto/delete-directory.query.dto';
import { MoveDirectoryRequestDto } from './dto/move-directory.request.dto';
import { RenameDirectoryRequestDto } from './dto/rename-directory.request.dto';
import { WorkspaceDirectoryResponseDto } from './dto/workspace-directory.response.dto';

/**
 * `/api/workspace/directories` (plan §4 de la spec 002).
 *
 * El controlador solo hace protocolo: guard, DTO, código de estado y contrato OpenAPI. El `userId`
 * sale de `@CurrentUser()`, es decir del token, y **nunca** de un parámetro de la petición: es lo
 * que hace que la autorización por recurso no dependa de recordar comprobarla en cada método.
 */
@ApiTags('workspace')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
// Un `@Query()` con DTO se publica **explotado** en parámetros sueltos, así que el DTO en sí no
// llega a `components.schemas` y el generador de clientes se queda sin el tipo de la query string.
// `@ApiExtraModels` lo registra sin cambiar cómo viaja el parámetro (AC-26 lo exige entre los siete
// DTO de entrada).
@ApiExtraModels(DeleteDirectoryQueryDto)
@Controller('workspace/directories')
@UseGuards(JwtAuthGuard)
// Declarado a nivel de clase: con throttlers nombrados y opt-in, una ruta nueva de este controlador
// hereda el límite en lugar de quedarse sin ninguno.
@Throttled('workspace')
export class DirectoriesController {
  constructor(private readonly directories: DirectoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un directorio', operationId: 'createDirectory' })
  @ApiCreatedResponse({
    type: WorkspaceDirectoryResponseDto,
    description: 'Directorio creado, con su profundidad calculada',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Nombre o `parentId` inválidos' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El `parentId` no existe o no es tuyo (`PARENT_NOT_FOUND`)',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: '`DIRECTORY_NAME_TAKEN` o `DEPTH_LIMIT_EXCEEDED`',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirectoryRequestDto,
  ): Promise<WorkspaceDirectoryResponseDto> {
    return this.directories.createDirectory({ userId: user.id }, dto);
  }

  /**
   * Renombrar. El `:id` se valida con `ParseUUIDPipe` y no con un DTO: la regla dura de «toda
   * entrada por DTO» cubre cuerpos y query strings, y para un único escalar de ruta el pipe es el
   * mecanismo idiomático de Nest y produce el mismo `ErrorResponseDto` (plan §4).
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Renombra un directorio', operationId: 'renameDirectory' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Directorio a renombrar' })
  @ApiOkResponse({
    type: WorkspaceDirectoryResponseDto,
    description: 'Directorio con el nombre nuevo',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Nombre o `:id` inválidos' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El directorio no existe o no es tuyo (`DIRECTORY_NOT_FOUND`)',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Ya hay un hermano con ese nombre (`DIRECTORY_NAME_TAKEN`)',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameDirectoryRequestDto,
  ): Promise<WorkspaceDirectoryResponseDto> {
    return this.directories.renameDirectory({ userId: user.id }, id, dto);
  }

  /**
   * Mover. Endpoint propio y no un `PATCH` con `parentId` opcional (decisión 10 del plan): un
   * `PATCH` combinado no podría distinguir «mueve a la raíz» de «no toques el sitio», las dos
   * operaciones fallan por motivos distintos y solo ésta necesita transacción `Serializable`.
   *
   * `POST` y no `PUT`: la operación no es idempotente en su forma de fallar (mover dos veces al
   * mismo destino es un no-op, pero mover a un destino que entretanto desapareció es un `404`).
   */
  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mueve un directorio, con su subárbol, a otro padre o a la raíz',
    operationId: 'moveDirectory',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Directorio a mover' })
  @ApiOkResponse({
    type: WorkspaceDirectoryResponseDto,
    description: 'Directorio con el `parentId` y el `depth` nuevos',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: '`parentId` o `:id` inválidos' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El directorio (`DIRECTORY_NOT_FOUND`) o el destino (`PARENT_NOT_FOUND`) no existen o no son tuyos',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description:
      '`MOVE_INTO_DESCENDANT`, `DEPTH_LIMIT_EXCEEDED`, `DIRECTORY_NAME_TAKEN` o `WORKSPACE_CONFLICT`',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveDirectoryRequestDto,
  ): Promise<WorkspaceDirectoryResponseDto> {
    return this.directories.moveDirectory({ userId: user.id }, id, dto);
  }

  /**
   * Borrar. `204` sin cuerpo: no hay nada que devolver de un recurso que ya no existe, y el
   * `@HttpCode` es necesario porque Nest responde `200` por defecto también en `DELETE`.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borra un directorio, opcionalmente con su contenido',
    operationId: 'deleteDirectory',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Directorio a borrar' })
  @ApiNoContentResponse({ description: 'Directorio borrado; la respuesta no lleva cuerpo' })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: '`:id` no es un uuid, o `recursive` no es `true` ni `false`',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El directorio no existe o no es tuyo (`DIRECTORY_NOT_FOUND`)',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Tiene contenido y no se pidió `recursive=true` (`DIRECTORY_NOT_EMPTY`)',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteDirectoryQueryDto,
  ): Promise<void> {
    await this.directories.deleteDirectory({ userId: user.id }, id, query);
  }
}
