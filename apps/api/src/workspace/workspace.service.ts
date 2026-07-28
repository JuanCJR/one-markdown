import { Injectable } from '@nestjs/common';

import { toWorkspaceDomainHttpException } from './domain-error';
import { WorkspaceDirectoryResponseDto } from './dto/workspace-directory.response.dto';
import { WorkspaceDocumentSummaryResponseDto } from './dto/workspace-document-summary.response.dto';
import { WorkspaceTreeResponseDto } from './dto/workspace-tree.response.dto';
import { toWorkspaceHttpException } from './prisma-error';
import { depthOf, type TreeIndex, type TreeNodeRef } from './tree-graph';
import { WorkspaceDomainError } from './workspace.errors';
import { WorkspaceRepository, type WorkspaceScope } from './workspace.repository';

/**
 * Lectura del árbol completo del usuario (plan §6 de la spec 002).
 *
 * Servicio propio y no un método de `DirectoriesService` ni de `DocumentsService`: el árbol es lo
 * único que cruza los dos tipos de nodo, y colgarlo de cualquiera de los dos lo dejaría en el lado
 * equivocado de la mitad de sus lecturas.
 *
 * `scope` entra siempre como primer parámetro y sale **siempre** del token: esta es la única lectura
 * del módulo sin `:id` en la ruta, así que un `where` sin `userId` no se delataría con un `404` como
 * en el resto de endpoints —devolvería el workspace de todo el mundo con un `200` de forma
 * impecable—. Por eso el `userId` va en los dos `where` del repositorio y no hay ninguna firma por
 * la que se pueda colar otro.
 */
@Injectable()
export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  /**
   * Foto plana del árbol: dos listas ordenadas y el instante en que se tomaron.
   *
   * **Sin transacción**, a diferencia del move: aquí no se decide nada sobre la foto ni se escribe,
   * así que lo peor que puede pasar entre las dos consultas es que aparezca un nodo creado en ese
   * intervalo. Un `Serializable` para eso pagaría el coste de un aislamiento fuerte —y su riesgo de
   * `P2034`— a cambio de una garantía que el cliente ya tiene por otra vía: recarga el árbol entero
   * después de cada mutación (decisión 12).
   *
   * `depth` se calcula aquí y no sale de una columna (decisión 2): la jerarquía se modela solo con
   * `parentId`, de modo que no hay ningún invariante persistido que pueda desincronizarse. El índice
   * que consume `tree-graph` se arma con las mismas filas que ya se están devolviendo, así que
   * calcular la profundidad de todos los directorios no cuesta ni una consulta extra.
   *
   * Las dos consultas van en paralelo: son independientes y ninguna necesita el resultado de la
   * otra.
   */
  async getTree(scope: WorkspaceScope): Promise<WorkspaceTreeResponseDto> {
    try {
      const [directories, documents] = await Promise.all([
        this.repository.listDirectories(scope),
        this.repository.listDocumentSummaries(scope),
      ]);

      // El índice contiene **todos** los directorios del usuario, que es justo la condición que
      // `tree-graph` exige: un `parentId` que apuntara fuera de él sería corrupción, y por eso
      // `depthOf` lanza en vez de devolver un número inventado.
      const byId: TreeIndex = new Map<string, TreeNodeRef>(
        directories.map((directory) => [directory.id, directory]),
      );

      return new WorkspaceTreeResponseDto({
        directories: directories.map(
          (directory) => new WorkspaceDirectoryResponseDto(directory, depthOf(directory.id, byId)),
        ),
        documents: documents.map((document) => new WorkspaceDocumentSummaryResponseDto(document)),
        // El instante de la respuesta, no el de la primera consulta: es lo que el cliente compara
        // para descartar una respuesta que llegue tarde y pise un estado más nuevo.
        generatedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof WorkspaceDomainError) {
        toWorkspaceDomainHttpException(error);
      }

      // Nada de lo que hace este método puede violar un índice único ni una clave ajena, pero la
      // traducción va igual y en el mismo sitio que en el resto del módulo: lo que no reconoce se
      // propaga sin tocar, así que un `WorkspaceTreeIntegrityError` sigue saliendo como el `500`
      // ruidoso que debe ser.
      toWorkspaceHttpException(error);
    }
  }
}
