import {
  DepthLimitExceededError,
  MoveIntoDescendantError,
  WorkspaceTreeIntegrityError,
} from './workspace.errors';

/**
 * Reglas del grafo del árbol (plan de la spec 002, §3).
 *
 * Funciones **puras** sobre un índice `id → { id, parentId }`: sin Nest, sin Prisma, sin HTTP y sin
 * constantes del módulo — `maxDepth` entra como parámetro de `assertMovable`. La única dependencia
 * es `workspace.errors.ts`, que también es dominio puro.
 */

/** Lo mínimo que necesita el grafo de un nodo: su id y el de su padre (`null` = raíz). */
export interface TreeNodeRef {
  readonly id: string;
  readonly parentId: string | null;
}

/**
 * Índice completo del subgrafo sobre el que se razona. En el servicio es **siempre** el conjunto de
 * directorios de un único usuario (`where: { userId }`), y por eso un `parentId` que apunte fuera
 * del índice es un error de integridad y no un caso normal.
 */
export type TreeIndex = ReadonlyMap<string, TreeNodeRef>;

const nodeOrThrow = (id: string, byId: TreeIndex): TreeNodeRef => {
  const node = byId.get(id);

  if (node === undefined) {
    throw new WorkspaceTreeIntegrityError(
      'UNKNOWN_NODE',
      `El nodo ${id} no está en el índice del árbol.`,
    );
  }

  return node;
};

/**
 * Ancestros de un nodo, del padre a la raíz. La raíz devuelve `[]`.
 *
 * Lleva un conjunto de visitados: si vuelve a pasar por un nodo ya visto **lanza**, porque un árbol
 * con un ciclo es corrupción y tiene que fallar ruidosamente en vez de colgar el proceso.
 */
export function ancestorsOf(id: string, byId: TreeIndex): string[] {
  const ancestors: string[] = [];
  const seen = new Set<string>([id]);

  let parentId = nodeOrThrow(id, byId).parentId;

  while (parentId !== null) {
    if (seen.has(parentId)) {
      throw new WorkspaceTreeIntegrityError(
        'CYCLE',
        `El árbol tiene un ciclo: el nodo ${parentId} es ancestro de sí mismo.`,
      );
    }

    seen.add(parentId);
    ancestors.push(parentId);
    parentId = nodeOrThrow(parentId, byId).parentId;
  }

  return ancestors;
}

/** Profundidad de un nodo = número de ancestros. La raíz mide `0`. */
export function depthOf(id: string, byId: TreeIndex): number {
  return ancestorsOf(id, byId).length;
}

const childIdsByParent = (byId: TreeIndex): Map<string, string[]> => {
  const children = new Map<string, string[]>();

  for (const node of byId.values()) {
    if (node.parentId === null) {
      continue;
    }

    const siblings = children.get(node.parentId);

    if (siblings === undefined) {
      children.set(node.parentId, [node.id]);
    } else {
      siblings.push(node.id);
    }
  }

  return children;
};

/**
 * Niveles por debajo de un nodo: una hoja mide `0`, un abuelo mide `2`.
 *
 * Desciende por niveles (no recursivo, para que una cadena larga no dependa del tamaño de la pila)
 * y con conjunto de visitados, por el mismo motivo que `ancestorsOf`.
 */
export function subtreeHeightOf(id: string, byId: TreeIndex): number {
  nodeOrThrow(id, byId);

  const children = childIdsByParent(byId);
  const visited = new Set<string>([id]);

  let height = 0;
  let frontier: string[] = [id];

  for (;;) {
    const next: string[] = [];

    for (const nodeId of frontier) {
      for (const childId of children.get(nodeId) ?? []) {
        if (visited.has(childId)) {
          throw new WorkspaceTreeIntegrityError(
            'CYCLE',
            `El árbol tiene un ciclo: el nodo ${childId} es descendiente de sí mismo.`,
          );
        }

        visited.add(childId);
        next.push(childId);
      }
    }

    if (next.length === 0) {
      return height;
    }

    height += 1;
    frontier = next;
  }
}

export interface MovableCheck {
  /** Directorio que se mueve. */
  readonly subjectId: string;
  /** Directorio de destino; `null` = raíz del workspace. */
  readonly targetId: string | null;
  /** Índice completo de los directorios del usuario. */
  readonly byId: TreeIndex;
  /** Tope de profundidad: las profundidades válidas son `0`…`maxDepth - 1`. */
  readonly maxDepth: number;
}

/**
 * Comprueba que un directorio se puede mover al destino dado. Rechaza en este orden:
 *
 * 1. destino igual al sujeto, o destino descendiente del sujeto → `MOVE_INTO_DESCENDANT`;
 * 2. el descendiente más profundo del sujeto quedaría por debajo del tope → `DEPTH_LIMIT_EXCEEDED`.
 *
 * Mover al padre que ya se tiene **no** es error: es un no-op, y el servicio responde `200`.
 */
export function assertMovable({ subjectId, targetId, byId, maxDepth }: MovableCheck): void {
  nodeOrThrow(subjectId, byId);

  if (targetId !== null) {
    nodeOrThrow(targetId, byId);
  }

  if (targetId === subjectId) {
    throw new MoveIntoDescendantError();
  }

  if (targetId !== null && ancestorsOf(targetId, byId).includes(subjectId)) {
    throw new MoveIntoDescendantError();
  }

  // Con destino en la raíz el sujeto pasa a profundidad 0, que es `-1 + 1`.
  const targetDepth = targetId === null ? -1 : depthOf(targetId, byId);
  const deepestDepth = targetDepth + 1 + subtreeHeightOf(subjectId, byId);

  if (deepestDepth > maxDepth - 1) {
    throw new DepthLimitExceededError();
  }
}
