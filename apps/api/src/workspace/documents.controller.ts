import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { type AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../auth';
import { AUTH_BEARER_SCHEME } from '../common/api-security';
import { ErrorResponseDto } from '../common/dto/error.response.dto';
import { Throttled } from '../common/throttle';
import { DocumentsService } from './documents.service';
import { CreateDocumentRequestDto } from './dto/create-document.request.dto';
import { MoveDocumentRequestDto } from './dto/move-document.request.dto';
import { RenameDocumentRequestDto } from './dto/rename-document.request.dto';
import { SaveDocumentContentRequestDto } from './dto/save-document-content.request.dto';
import { WorkspaceDocumentContentResponseDto } from './dto/workspace-document-content.response.dto';
import { WorkspaceDocumentSummaryResponseDto } from './dto/workspace-document-summary.response.dto';
import { WorkspaceDocumentResponseDto } from './dto/workspace-document.response.dto';

/**
 * `/api/workspace/documents` (plan §4 de la spec 002).
 *
 * El controlador solo hace protocolo: guard, DTO, `ParseUUIDPipe`, código de estado y contrato
 * OpenAPI. El `userId` sale de `@CurrentUser()`, es decir del token, y **nunca** de un parámetro de
 * la petición: es lo que hace que la autorización por recurso no dependa de recordar comprobarla en
 * cada método.
 */
@ApiTags('workspace')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@Controller('workspace/documents')
@UseGuards(JwtAuthGuard)
// Declarado a nivel de clase: con throttlers nombrados y opt-in, una ruta nueva de este controlador
// hereda el límite en lugar de quedarse sin ninguno.
@Throttled('workspace')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un documento', operationId: 'createDocument' })
  @ApiCreatedResponse({
    type: WorkspaceDocumentResponseDto,
    description: 'Documento creado, con su contenido tal como se guardó',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Título, `directoryId` o `content` inválidos (incluido el contenido demasiado largo)',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El `directoryId` no existe o no es tuyo (`PARENT_NOT_FOUND`)',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: '`DOCUMENT_TITLE_TAKEN`',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentRequestDto,
  ): Promise<WorkspaceDocumentResponseDto> {
    return this.documents.createDocument({ userId: user.id }, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Devuelve un documento con su contenido', operationId: 'getDocument' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({
    type: WorkspaceDocumentResponseDto,
    description: 'Documento con su markdown completo',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'El `id` no es un uuid' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El documento no existe o no es tuyo (`DOCUMENT_NOT_FOUND`)',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkspaceDocumentResponseDto> {
    return this.documents.getDocument({ userId: user.id }, id);
  }

  /**
   * Renombrar. Devuelve el **resumen** y no el documento completo: un cambio de título no tiene por
   * qué arrastrar el markdown entero de vuelta al cliente (plan §4).
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Renombra un documento', operationId: 'renameDocument' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'Documento a renombrar' })
  @ApiOkResponse({
    type: WorkspaceDocumentSummaryResponseDto,
    description: 'Documento con el título nuevo, **sin** su contenido',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Título o `:id` inválidos' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El documento no existe o no es tuyo (`DOCUMENT_NOT_FOUND`)',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Ya hay un hermano con ese título (`DOCUMENT_TITLE_TAKEN`)',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameDocumentRequestDto,
  ): Promise<WorkspaceDocumentSummaryResponseDto> {
    return this.documents.renameDocument({ userId: user.id }, id, dto);
  }

  /**
   * Mover. Endpoint propio y no un `PATCH` con `directoryId` opcional (decisión 10 del plan): un
   * `PATCH` combinado no podría distinguir «mueve a la raíz» de «no toques el sitio», y las dos
   * operaciones fallan por motivos distintos.
   */
  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mueve un documento a otro directorio o a la raíz',
    operationId: 'moveDocument',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'Documento a mover' })
  @ApiOkResponse({
    type: WorkspaceDocumentSummaryResponseDto,
    description: 'Documento con el `directoryId` nuevo, **sin** su contenido',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: '`directoryId` o `:id` inválidos' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description:
      'El documento (`DOCUMENT_NOT_FOUND`) o el directorio de destino (`PARENT_NOT_FOUND`) no existen o no son tuyos',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Ya hay un documento con ese título en el destino (`DOCUMENT_TITLE_TAKEN`)',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveDocumentRequestDto,
  ): Promise<WorkspaceDocumentSummaryResponseDto> {
    return this.documents.moveDocument({ userId: user.id }, id, dto);
  }

  /**
   * Guardar el contenido (spec 003, `plan.md` §4). Ruta propia y no una ampliación del `PATCH /:id`
   * (decisión 1 del plan): los modos de fallo son distintos —renombrar puede chocar con un hermano,
   * guardar solo puede chocar con una versión—, las frecuencias son incomparables (decenas por
   * minuto frente a una vez al mes) y un DTO combinado haría que el guardado automático reenviara el
   * título cada segundo y medio.
   *
   * `PUT` y no `PATCH` porque el cuerpo **reemplaza** el subrecurso entero, y la operación es
   * idempotente respecto de su token: reenviar el mismo cuerpo con la misma versión ya consumida da
   * `409` y no un segundo cambio (AC-8), que es justo lo que hace seguro reintentar un guardado.
   *
   * `@Throttled('documentContent')` **a nivel de método**: `declaredThrottler` resuelve la metadata
   * con `getAllAndOverride([getHandler(), getClass()])`, donde el primer elemento gana, así que este
   * decorador anula el `@Throttled('workspace')` de la clase. Es lo que evita que escribir agote el
   * cupo con el que se navega el árbol —y al revés— sin tener que partir el controlador (AC-10, y
   * `throttle.spec.ts` lo mide con un `ExecutionContext` real).
   */
  @Put(':id/content')
  @Throttled('documentContent')
  @ApiOperation({
    summary: 'Guarda el contenido de un documento',
    operationId: 'saveDocumentContent',
    description:
      'Reemplaza el markdown completo del documento **solo si** su `contentVersion` sigue siendo la que envía el cliente. Concurrencia optimista: no hay última escritura que gane en silencio.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'Documento a guardar' })
  @ApiOkResponse({
    type: WorkspaceDocumentContentResponseDto,
    description:
      'Contenido guardado. Devuelve la `contentVersion` **nueva**, que el cliente debe adoptar para su próximo guardado, y **no** devuelve el texto',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      '`content` o `expectedVersion` inválidos (incluido el contenido demasiado largo), o `:id` que no es uuid',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description:
      'El documento no existe o no es tuyo (`DOCUMENT_NOT_FOUND`). También con una `expectedVersion` incorrecta: un `409` sobre un documento ajeno confirmaría que existe',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description:
      'La `contentVersion` real no es la esperada (`DOCUMENT_CONTENT_CONFLICT`): alguien guardó antes y **no** se ha escrito nada',
  })
  @ApiPayloadTooLargeResponse({
    type: ErrorResponseDto,
    description: 'El cuerpo JSON supera el límite global de 2 MiB',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Cupo de guardados por IP agotado (`documentContent`)',
  })
  async saveContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDocumentContentRequestDto,
  ): Promise<WorkspaceDocumentContentResponseDto> {
    return this.documents.saveDocumentContent({ userId: user.id }, id, dto);
  }

  /**
   * Borrar. `204` sin cuerpo: no hay nada que devolver de un recurso que ya no existe, y el
   * `@HttpCode` es necesario porque Nest responde `200` por defecto también en `DELETE`.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra un documento', operationId: 'deleteDocument' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'Documento a borrar' })
  @ApiNoContentResponse({ description: 'Documento borrado; la respuesta no lleva cuerpo' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'El `:id` no es un uuid' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description:
      'El documento no existe o no es tuyo (`DOCUMENT_NOT_FOUND`); también en un segundo borrado, que **no** es idempotente',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de peticiones por IP alcanzado',
  })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.documents.deleteDocument({ userId: user.id }, id);
  }
}
