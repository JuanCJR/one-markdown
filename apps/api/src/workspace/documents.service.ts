import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { toWorkspaceDomainHttpException } from './domain-error';
import { CreateDocumentRequestDto } from './dto/create-document.request.dto';
import { MoveDocumentRequestDto } from './dto/move-document.request.dto';
import { RenameDocumentRequestDto } from './dto/rename-document.request.dto';
import { WorkspaceDocumentSummaryResponseDto } from './dto/workspace-document-summary.response.dto';
import { WorkspaceDocumentResponseDto } from './dto/workspace-document.response.dto';
import { toWorkspaceHttpException } from './prisma-error';
import { normalizeWorkspaceName, workspaceNameKey } from './workspace-name';
import { MAX_WORKSPACE_NODES } from './workspace.constants';
import { WorkspaceDomainError } from './workspace.errors';
import { WorkspaceRepository, type WorkspaceScope } from './workspace.repository';

/**
 * Los dos `404` del servicio, en un solo sitio y con el mismo texto siempre.
 *
 * `404` y nunca `403`: «no existe» y «no es tuyo» son literalmente la misma rama de código, porque
 * toda consulta lleva el `userId` del token en el `where`. Distinguirlas convertiría la API en un
 * oráculo de qué ids hay en la instalación (decisión 9 del plan).
 */
const documentNotFound = (): NotFoundException =>
  new NotFoundException({
    message: 'El documento no existe o no es tuyo.',
    code: 'DOCUMENT_NOT_FOUND',
  });

const parentNotFound = (): NotFoundException =>
  new NotFoundException({
    message: 'El directorio de destino no existe o no es tuyo.',
    code: 'PARENT_NOT_FOUND',
  });

/**
 * Tope de nodos del workspace alcanzado (AC-21). El mensaje y el `code` son los mismos que en
 * `directories.service.ts`: para el cliente es **un** límite del workspace, no dos por tipo de nodo.
 */
const workspaceLimitReached = (): ConflictException =>
  new ConflictException({
    message: `Has alcanzado el máximo de ${String(MAX_WORKSPACE_NODES)} nodos (directorios y documentos). Borra algo antes de crear más.`,
    code: 'WORKSPACE_LIMIT_REACHED',
  });

/**
 * Operaciones sobre documentos (plan §6 de la spec 002).
 *
 * Servicio propio y no un método más de `DirectoriesService` por cohesión y por despacho: los dos
 * tipos de nodo se implementan en tareas distintas y con un servicio único las dos editarían el
 * mismo archivo a la vez.
 *
 * `scope` entra siempre como primer parámetro y sale **siempre** del token: ninguna ruta acepta un
 * `userId` del cliente.
 */
@Injectable()
export class DocumentsService {
  constructor(private readonly repository: WorkspaceRepository) {}

  /**
   * Alta de un documento. `dto.title` llega ya normalizado por el `@Transform` del DTO; se vuelve a
   * normalizar aquí porque la normalización es idempotente y el servicio no debe depender de que
   * quien lo llame lo haya hecho.
   *
   * `content` ausente o `null` es la cadena vacía: para un documento recién creado «sin texto» y
   * «con texto vacío» son el mismo estado, así que no hay nada que distinguir (y `contentBytes`
   * queda en `0` sin ningún caso especial).
   */
  async createDocument(
    scope: WorkspaceScope,
    dto: CreateDocumentRequestDto,
  ): Promise<WorkspaceDocumentResponseDto> {
    try {
      await this.assertBelowNodeLimit(scope);
      await this.assertDirectoryIsOwn(scope, dto.directoryId);

      const created = await this.repository.createDocument(scope, {
        title: normalizeWorkspaceName(dto.title),
        titleKey: workspaceNameKey(dto.title),
        directoryId: dto.directoryId,
        content: dto.content ?? '',
      });

      return new WorkspaceDocumentResponseDto(created);
    } catch (error) {
      if (error instanceof WorkspaceDomainError) {
        toWorkspaceDomainHttpException(error);
      }

      // Traduce `P2002` (título repetido entre hermanos) y `P2003` (el directorio desapareció entre
      // la comprobación y la escritura); cualquier otra cosa se propaga sin tocar.
      toWorkspaceHttpException(error);
    }
  }

  /** Detalle con el markdown completo. El `where` del repositorio lleva el `userId` del token. */
  async getDocument(scope: WorkspaceScope, id: string): Promise<WorkspaceDocumentResponseDto> {
    const document = await this.repository.findDocument(scope, id);

    if (document === null) {
      throw documentNotFound();
    }

    return new WorkspaceDocumentResponseDto(document);
  }

  /**
   * Renombrado. Devuelve el **resumen**, sin `content`: cambiarle el título a un documento no es
   * motivo para descargar su texto entero, que en PostgreSQL vive en TOAST.
   *
   * La propiedad la impone el `where` del repositorio (`{ id, userId }`), así que «no existe» y «no
   * es tuyo» salen los dos como el `404` que traduce `P2025`: no hay un `if` de autorización que
   * alguien pueda olvidar, ni un `403` que confirme qué ids existen.
   *
   * La colisión con un hermano la detecta el índice único, **no** un `findFirst` previo: entre la
   * comprobación y la escritura cabe otra petición, así que el índice acabaría disparando igual.
   * Cambiar solo la caja del propio título no colisiona porque el índice compara la fila con las
   * demás, no consigo misma.
   */
  async renameDocument(
    scope: WorkspaceScope,
    id: string,
    dto: RenameDocumentRequestDto,
  ): Promise<WorkspaceDocumentSummaryResponseDto> {
    try {
      const updated = await this.repository.updateDocument(scope, id, {
        title: normalizeWorkspaceName(dto.title),
        titleKey: workspaceNameKey(dto.title),
      });

      return new WorkspaceDocumentSummaryResponseDto(updated);
    } catch (error) {
      if (error instanceof WorkspaceDomainError) {
        toWorkspaceDomainHttpException(error);
      }

      toWorkspaceHttpException(error);
    }
  }

  /**
   * Mover un documento a otro directorio o a la raíz.
   *
   * **Sin transacción `Serializable`**, a diferencia del move de directorios: un documento es
   * siempre una hoja, así que no hay ciclo ni profundidad que decidir sobre una foto del árbol y no
   * hay nada que dos moves simultáneos puedan corromper entre ellos.
   *
   * Lo que sí hay que comprobar es la **propiedad del destino**: la clave ajena de PostgreSQL solo
   * verifica que la fila exista, así que sin el `findDirectory` de `assertDirectoryIsOwn` —que
   * lleva `userId` en el `where`— un usuario podría meter su documento en la carpeta de otro. La
   * carrera que queda (el destino se borra justo después de la comprobación) la cierra el `P2003`
   * del `update`, que sale como el mismo `404 PARENT_NOT_FOUND`.
   *
   * El `parentScopeId` lo recalcula el repositorio: es el ámbito de unicidad de títulos, y si se
   * quedara en el del directorio anterior la unicidad se rompería en silencio.
   */
  async moveDocument(
    scope: WorkspaceScope,
    id: string,
    dto: MoveDocumentRequestDto,
  ): Promise<WorkspaceDocumentSummaryResponseDto> {
    try {
      await this.assertDirectoryIsOwn(scope, dto.directoryId);

      // Sin caso especial para «ya está en ese directorio»: detectarlo exigiría leer antes la fila,
      // y la única lectura de documento del repositorio trae también el `content`. Pagar una
      // lectura del texto completo para ahorrarse una escritura idéntica no compensa.
      const moved = await this.repository.moveDocument(scope, id, dto.directoryId);

      return new WorkspaceDocumentSummaryResponseDto(moved);
    } catch (error) {
      if (error instanceof WorkspaceDomainError) {
        toWorkspaceDomainHttpException(error);
      }

      // Aquí llegan el `P2025` del documento ajeno o inexistente y el `P2002` del título que ya
      // está usado en el destino.
      toWorkspaceHttpException(error);
    }
  }

  /**
   * Borrado. `0` filas borradas significa «no existe **o** no es tuyo», y las dos salen como `404`.
   *
   * **No es idempotente**: un segundo `DELETE` del mismo id responde `404`, al contrario que el
   * `logout` de la spec `001`, cuyo objetivo es «asegurar que no hay sesión». Aquí el `404` le dice
   * al cliente que su árbol está desactualizado, que es justo lo que necesita saber.
   */
  async deleteDocument(scope: WorkspaceScope, id: string): Promise<void> {
    if ((await this.repository.deleteDocument(scope, id)) === 0) {
      throw documentNotFound();
    }
  }

  /**
   * Corta el alta si el usuario ya llegó a `MAX_WORKSPACE_NODES` (AC-21).
   *
   * El contador suma directorios **y** documentos: el tope es del workspace entero, así que el
   * documento 5.001 se rechaza aunque no haya ningún directorio. Se comprueba antes que la
   * propiedad del directorio contenedor porque no depende de él y es la consulta más barata que
   * puede terminar la petición. Solo frena las **altas**: renombrar, mover o borrar no añaden
   * nodos, y un workspace en el tope tiene que poder reorganizarse para salir de él.
   */
  private async assertBelowNodeLimit(scope: WorkspaceScope): Promise<void> {
    if ((await this.repository.countWorkspaceNodes(scope)) >= MAX_WORKSPACE_NODES) {
      throw workspaceLimitReached();
    }
  }

  /**
   * Comprueba que el directorio contenedor es del usuario **antes** de escribir.
   *
   * **Es la autorización del alta y del move anidados, no una cortesía.** El `create` y el `update`
   * del repositorio no pueden verificarlo: la clave ajena de PostgreSQL solo comprueba que la fila
   * exista, así que sin este `findDirectory` —que lleva `userId` en el `where`— un usuario podría
   * colgar un documento suyo dentro de la carpeta de otro. La carrera que queda (el directorio se
   * borra justo después de esta consulta) la cierra el `P2003` del repositorio, que sale como el
   * mismo `404 PARENT_NOT_FOUND`.
   *
   * A diferencia de los directorios, aquí no hay comprobación de profundidad: un documento es
   * siempre una hoja y no añade un nivel al árbol.
   */
  private async assertDirectoryIsOwn(
    scope: WorkspaceScope,
    directoryId: string | null,
  ): Promise<void> {
    if (directoryId === null) {
      return;
    }

    if ((await this.repository.findDirectory(scope, directoryId)) === null) {
      throw parentNotFound();
    }
  }
}
