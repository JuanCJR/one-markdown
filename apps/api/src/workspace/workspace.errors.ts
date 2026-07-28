/**
 * Errores de dominio del workspace.
 *
 * Dominio **puro**: este archivo no importa nada de Nest, Prisma ni HTTP, para que `tree-graph.ts`
 * (que lanza estos errores) siga siendo comprobable sin infraestructura. La traducción a HTTP la
 * hace la capa de servicio/controlador, que es la única que conoce el protocolo.
 */

/**
 * Códigos estables que viajan al cliente en `ErrorResponseDto.code` (decisión 13 del plan de la
 * spec 002). La unión es la tabla del plan §3 al completo: los que lanza el dominio puro
 * (`MOVE_INTO_DESCENDANT`, `DEPTH_LIMIT_EXCEEDED`, …) y los que solo puede detectar la base y
 * traduce `prisma-error.ts` (`DIRECTORY_NAME_TAKEN`, `PARENT_NOT_FOUND`, `WORKSPACE_CONFLICT`, …).
 * Tenerlos en un solo sitio es lo que impide que dos capas emitan códigos que no coinciden.
 */
export type WorkspaceErrorCode =
  | 'DIRECTORY_NAME_TAKEN'
  | 'DOCUMENT_TITLE_TAKEN'
  | 'DIRECTORY_NOT_EMPTY'
  | 'MOVE_INTO_DESCENDANT'
  | 'DEPTH_LIMIT_EXCEEDED'
  | 'WORKSPACE_LIMIT_REACHED'
  | 'WORKSPACE_CONFLICT'
  | 'DIRECTORY_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'PARENT_NOT_FOUND';

/**
 * Base común de los errores de dominio: todos llevan un `code` estable con el que la interfaz
 * puede decidir qué decir, sin emparejar por el texto del mensaje.
 */
export abstract class WorkspaceDomainError extends Error {
  abstract readonly code: WorkspaceErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** El destino de un move es el propio directorio o uno de sus descendientes. */
export class MoveIntoDescendantError extends WorkspaceDomainError {
  readonly code = 'MOVE_INTO_DESCENDANT';

  constructor(
    message = 'No se puede mover un directorio dentro de sí mismo ni de uno de sus descendientes.',
  ) {
    super(message);
  }
}

/**
 * `DELETE` de un directorio que tiene subdirectorios o documentos dentro, sin `?recursive=true`.
 *
 * Es un error de dominio y no una traducción de la base porque la base **no** protesta: la cascada
 * de PostgreSQL se llevaría el subárbol encantada. Quien decide que hace falta una confirmación
 * explícita es esta capa (decisión 6 del plan: sin papelera, el borrado es definitivo).
 */
export class DirectoryNotEmptyError extends WorkspaceDomainError {
  readonly code = 'DIRECTORY_NOT_EMPTY';

  constructor(
    message = 'El directorio no está vacío. Repite la petición con `?recursive=true` para borrarlo con su contenido.',
  ) {
    super(message);
  }
}

/** La operación dejaría algún nodo por debajo del tope de profundidad. */
export class DepthLimitExceededError extends WorkspaceDomainError {
  readonly code = 'DEPTH_LIMIT_EXCEEDED';

  constructor(message = 'La operación superaría la profundidad máxima de directorios.') {
    super(message);
  }
}

/** Por qué el grafo cargado no es un árbol válido. */
export type WorkspaceTreeIntegrityReason = 'CYCLE' | 'UNKNOWN_NODE';

/**
 * El grafo recibido no es un árbol: hay un ciclo, o un nodo (o un padre) que no está en el índice.
 *
 * **No** es un error de dominio y a propósito no lleva `code`: no es una regla de negocio que el
 * usuario pueda incumplir, es corrupción de datos o un índice incompleto, y tiene que salir como un
 * `500` ruidoso en vez de disfrazarse de `409`. Con `onDelete: Cascade` en la autorrelación y un
 * índice que siempre carga **todos** los directorios del usuario, no debería poder ocurrir; que
 * exista esta clase es lo que evita que, si ocurre, el proceso se quede colgado recorriendo el
 * ciclo.
 */
export class WorkspaceTreeIntegrityError extends Error {
  readonly reason: WorkspaceTreeIntegrityReason;

  constructor(reason: WorkspaceTreeIntegrityReason, message: string) {
    super(message);
    this.name = 'WorkspaceTreeIntegrityError';
    this.reason = reason;
  }
}
