import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { toWorkspaceDomainHttpException } from './domain-error';
import { CreateDirectoryRequestDto } from './dto/create-directory.request.dto';
import { DeleteDirectoryQueryDto } from './dto/delete-directory.query.dto';
import { MoveDirectoryRequestDto } from './dto/move-directory.request.dto';
import { RenameDirectoryRequestDto } from './dto/rename-directory.request.dto';
import { WorkspaceDirectoryResponseDto } from './dto/workspace-directory.response.dto';
import { toWorkspaceHttpException } from './prisma-error';
import { assertMovable, depthOf, type TreeIndex, type TreeNodeRef } from './tree-graph';
import { normalizeWorkspaceName, workspaceNameKey } from './workspace-name';
import { MAX_DIRECTORY_DEPTH, MAX_WORKSPACE_NODES } from './workspace.constants';
import {
  DepthLimitExceededError,
  DirectoryNotEmptyError,
  WorkspaceDomainError,
} from './workspace.errors';
import { WorkspaceRepository, type WorkspaceScope } from './workspace.repository';

/**
 * Los dos `404` del módulo, en un solo sitio y con el mismo texto siempre.
 *
 * `404` y nunca `403`: «no existe» y «no es tuyo» son literalmente la misma rama de código, porque
 * toda consulta lleva el `userId` del token en el `where`. Distinguirlas convertiría la API en un
 * oráculo de qué ids hay en la instalación (decisión 9 del plan).
 */
const directoryNotFound = (): NotFoundException =>
  new NotFoundException({
    message: 'El directorio no existe o no es tuyo.',
    code: 'DIRECTORY_NOT_FOUND',
  });

const parentNotFound = (): NotFoundException =>
  new NotFoundException({
    message: 'El directorio de destino no existe o no es tuyo.',
    code: 'PARENT_NOT_FOUND',
  });

/**
 * Tope de nodos del workspace alcanzado (AC-21).
 *
 * `409` y no `403`: la petición es legítima y el usuario tiene permiso; lo que no admite la
 * operación es el **estado actual** de su workspace, igual que el resto de errores de dominio.
 */
const workspaceLimitReached = (): ConflictException =>
  new ConflictException({
    message: `Has alcanzado el máximo de ${String(MAX_WORKSPACE_NODES)} nodos (directorios y documentos). Borra algo antes de crear más.`,
    code: 'WORKSPACE_LIMIT_REACHED',
  });

/**
 * Operaciones sobre directorios (plan §6 de la spec 002).
 *
 * El servicio orquesta: comprueba propiedad, aplica las reglas del dominio puro y traduce errores.
 * No conoce `Request` ni `Response` —eso es del controlador— ni Prisma —eso es del repositorio—.
 *
 * `scope` entra siempre como primer parámetro y sale **siempre** del token: ninguna ruta acepta un
 * `userId` del cliente.
 */
@Injectable()
export class DirectoriesService {
  constructor(private readonly repository: WorkspaceRepository) {}

  /**
   * Alta de un directorio. `dto.name` llega ya normalizado por el `@Transform` del DTO; se vuelve a
   * normalizar aquí porque la normalización es idempotente y el servicio no debe depender de que
   * quien lo llame lo haya hecho.
   */
  async createDirectory(
    scope: WorkspaceScope,
    dto: CreateDirectoryRequestDto,
  ): Promise<WorkspaceDirectoryResponseDto> {
    try {
      await this.assertBelowNodeLimit(scope);

      const depth = await this.depthOfNewChild(scope, dto.parentId);

      const created = await this.repository.createDirectory(scope, {
        name: normalizeWorkspaceName(dto.name),
        nameKey: workspaceNameKey(dto.name),
        parentId: dto.parentId,
      });

      return new WorkspaceDirectoryResponseDto(created, depth);
    } catch (error) {
      if (error instanceof WorkspaceDomainError) {
        toWorkspaceDomainHttpException(error);
      }

      // Traduce `P2002` (nombre repetido entre hermanos) y `P2003` (el padre desapareció entre la
      // comprobación y la escritura); cualquier otra cosa se propaga sin tocar.
      toWorkspaceHttpException(error);
    }
  }

  /**
   * Renombrado. La propiedad la impone el `where` del repositorio (`{ id, userId }`), así que «no
   * existe» y «no es tuyo» salen los dos como el `404` que traduce `P2025`: no hay un `if` de
   * autorización que alguien pueda olvidar, ni un `403` que confirme qué ids existen.
   *
   * La colisión con un hermano la detecta el índice único, **no** un `findFirst` previo: entre la
   * comprobación y la escritura cabe otra petición, así que el índice acabaría disparando igual.
   * Cambiar solo la caja del propio nombre no colisiona porque el índice compara la fila con las
   * demás, no consigo misma.
   */
  async renameDirectory(
    scope: WorkspaceScope,
    id: string,
    dto: RenameDirectoryRequestDto,
  ): Promise<WorkspaceDirectoryResponseDto> {
    try {
      const updated = await this.repository.updateDirectory(scope, id, {
        name: normalizeWorkspaceName(dto.name),
        nameKey: workspaceNameKey(dto.name),
      });

      return new WorkspaceDirectoryResponseDto(updated, await this.depthOf(scope, id));
    } catch (error) {
      if (error instanceof WorkspaceDomainError) {
        toWorkspaceDomainHttpException(error);
      }

      toWorkspaceHttpException(error);
    }
  }

  /**
   * Borrado. Sin `recursive`, un directorio con hijos se rechaza con `409`; con `recursive`, el
   * subárbol y los documentos se los lleva la **cascada de PostgreSQL** (`onDelete: Cascade` en la
   * autorrelación y en `Document.directory`).
   *
   * El recorrido del árbol en la aplicación se descartó a propósito: puede quedarse a medias si el
   * proceso muere entre dos niveles y dejar un bosque de huérfanos, mientras que la cascada es
   * recursiva y atómica dentro de la misma sentencia.
   *
   * El orden importa: se cuenta primero y se borra después. Un directorio que no existe —o que es
   * de otro— cuenta `0` hijos y cae en el `404` del `delete`, así que el `409` nunca puede delatar
   * la existencia de un id ajeno.
   */
  async deleteDirectory(
    scope: WorkspaceScope,
    id: string,
    query: DeleteDirectoryQueryDto,
  ): Promise<void> {
    try {
      if (!query.recursive && (await this.repository.countDirectoryChildren(scope, id)) > 0) {
        throw new DirectoryNotEmptyError();
      }

      if ((await this.repository.deleteDirectory(scope, id)) === 0) {
        throw directoryNotFound();
      }
    } catch (error) {
      if (error instanceof WorkspaceDomainError) {
        toWorkspaceDomainHttpException(error);
      }

      toWorkspaceHttpException(error);
    }
  }

  /**
   * Mover un directorio, con su subárbol, a otro padre o a la raíz.
   *
   * Todo ocurre dentro de una transacción `Serializable` porque la decisión se toma sobre una foto
   * del árbol entero: sin ella, dos moves simultáneos en ramas distintas podrían leer cada uno un
   * árbol acíclico y escribir entre los dos un ciclo que ninguno vio (decisión 7 del plan).
   *
   * La propiedad **del destino** se comprueba aquí y es imprescindible: la clave ajena de
   * PostgreSQL solo verifica que la fila exista, así que sin esta comprobación un usuario podría
   * colgar su directorio bajo una carpeta ajena. Se resuelve sin una consulta extra: el índice que
   * ya se carga contiene **solo** los directorios del usuario, de modo que un destino que no esté
   * en él o no existe o no es suyo —la misma rama, y el mismo `404` (decisión 9)—. La carrera que
   * queda (el destino se borra dentro de la transacción) la cierra el `P2003` del `update`, que
   * sale como el mismo `404 PARENT_NOT_FOUND`.
   */
  async moveDirectory(
    scope: WorkspaceScope,
    id: string,
    dto: MoveDirectoryRequestDto,
  ): Promise<WorkspaceDirectoryResponseDto> {
    const targetId = dto.parentId;

    try {
      return await this.repository.inSerializableTransaction(scope, async (tx) => {
        const byId = new Map<string, TreeNodeRef>(
          (await tx.listDirectoryRefs()).map((ref) => [ref.id, ref]),
        );

        const subject = byId.get(id);

        if (subject === undefined) {
          throw directoryNotFound();
        }

        if (targetId !== null && !byId.has(targetId)) {
          throw parentNotFound();
        }

        // Ciclo y profundidad, con la misma función pura que se prueba sin infraestructura.
        assertMovable({ subjectId: id, targetId, byId, maxDepth: MAX_DIRECTORY_DEPTH });

        const depth = targetId === null ? 0 : depthOf(targetId, byId) + 1;

        if (subject.parentId === targetId) {
          // Mover al padre que ya se tiene es un no-op y responde `200` (plan §3). Se devuelve la
          // fila tal cual, **sin** escribir: un `update` idéntico movería `updatedAt` y le diría al
          // cliente que el directorio cambió cuando no ha cambiado nada.
          const current = await tx.findDirectory(id);

          if (current === null) {
            throw directoryNotFound();
          }

          return new WorkspaceDirectoryResponseDto(current, depth);
        }

        return new WorkspaceDirectoryResponseDto(await tx.moveDirectory(id, targetId), depth);
      });
    } catch (error) {
      if (error instanceof WorkspaceDomainError) {
        toWorkspaceDomainHttpException(error);
      }

      // Aquí llegan además el `P2002` del índice único (ya hay un hermano con ese nombre en el
      // destino) y el `P2034` de un conflicto de serialización.
      toWorkspaceHttpException(error);
    }
  }

  /**
   * Corta el alta si el usuario ya llegó a `MAX_WORKSPACE_NODES` (AC-21).
   *
   * Se comprueba **antes** que la propiedad del padre y que la profundidad: el tope no depende de
   * dónde se cuelgue el nodo, así que la consulta más barata que puede terminar la petición va
   * primero. Solo frena las **altas**: renombrar o mover no añade nodos, y un workspace en el tope
   * tiene que poder reorganizarse (y borrar) para salir de él.
   *
   * No es una garantía atómica —dos altas simultáneas en el nodo 4.999 podrían pasar las dos—, y no
   * pretende serlo: el tope existe para acotar el tamaño del árbol que sirve `GET /tree`, no para
   * facturar. Cerrarlo del todo pediría un `Serializable` en cada alta, que es mucho coste para un
   * borde que se excede como mucho en uno.
   */
  private async assertBelowNodeLimit(scope: WorkspaceScope): Promise<void> {
    if ((await this.repository.countWorkspaceNodes(scope)) >= MAX_WORKSPACE_NODES) {
      throw workspaceLimitReached();
    }
  }

  /** Profundidad actual de un directorio del usuario, calculada sobre la foto de su árbol. */
  private async depthOf(scope: WorkspaceScope, id: string): Promise<number> {
    return depthOf(id, await this.directoryIndex(scope));
  }

  /**
   * Profundidad que tendría un hijo nuevo de `parentId`, comprobando por el camino que el padre es
   * del usuario y que la operación no rompe el tope de niveles.
   *
   * **Esta comprobación es la autorización del alta anidada, no una cortesía.** El `create` del
   * repositorio no puede verificar la propiedad del padre: la clave ajena de PostgreSQL solo
   * comprueba que la fila exista, así que sin este `findDirectory` —que lleva `userId` en el
   * `where`— un usuario podría colgar un directorio suyo bajo una carpeta de otro. La carrera que
   * queda (el padre se borra justo después de esta consulta) la cierra el `P2003` del repositorio,
   * que sale como el mismo `404 PARENT_NOT_FOUND`.
   */
  private async depthOfNewChild(scope: WorkspaceScope, parentId: string | null): Promise<number> {
    if (parentId === null) {
      return 0;
    }

    const parent = await this.repository.findDirectory(scope, parentId);

    if (parent === null) {
      throw parentNotFound();
    }

    const depth = depthOf(parentId, await this.directoryIndex(scope)) + 1;

    // Profundidades válidas: `0`…`MAX_DIRECTORY_DEPTH - 1`.
    if (depth > MAX_DIRECTORY_DEPTH - 1) {
      throw new DepthLimitExceededError();
    }

    return depth;
  }

  /** Foto de los directorios del usuario, lista para `tree-graph`. */
  private async directoryIndex(scope: WorkspaceScope): Promise<TreeIndex> {
    const refs = await this.repository.listDirectoryRefs(scope);

    return new Map<string, TreeNodeRef>(refs.map((ref) => [ref.id, ref]));
  }
}
