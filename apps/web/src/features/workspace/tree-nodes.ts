import { ROOT_KEY, type WorkspaceState } from './workspace.store';

/**
 * Vista del árbol lista para pintar y para recorrer con el teclado.
 *
 * El store guarda los nodos normalizados (mapas por id + listas de hijos); aquí se convierten en la
 * forma que la barra lateral necesita, que es otra cosa: solo los nodos **visibles**, con su nivel
 * ya calculado y en el orden en que se ven. Es una función pura para que la misma estructura sirva
 * al render (anidado, con `role="group"`) y a la navegación por teclado (lista plana), sin dos
 * recorridos que puedan discrepar.
 */

export type TreeNodeKind = 'directory' | 'document';

export interface TreeNode {
  readonly id: string;
  readonly kind: TreeNodeKind;
  /** Nombre del directorio o título del documento: lo que se lee en la fila. */
  readonly name: string;
  /** Profundidad 1-based, tal cual la espera `aria-level`. */
  readonly level: number;
  /** Directorio que lo contiene, o `null` si cuelga de la raíz. */
  readonly parentId: string | null;
  /** Solo tiene sentido en los directorios; en un documento siempre es `false`. */
  readonly expanded: boolean;
  /** Hijos visibles: vacío en los documentos y en los directorios contraídos. */
  readonly children: readonly TreeNode[];
}

/** La porción del store de la que depende la forma del árbol. */
export type TreeSource = Pick<
  WorkspaceState,
  'directoriesById' | 'documentsById' | 'childDirectoryIds' | 'childDocumentIds' | 'expandedIds'
>;

/** Nodos de la raíz, cada uno con sus descendientes visibles colgando. */
export function buildVisibleTree(source: TreeSource): readonly TreeNode[] {
  return buildLevel(source, ROOT_KEY, 1);
}

/**
 * Los directorios van antes que los documentos, y dentro de cada grupo se respeta el orden del
 * servidor (`nameKey`): quien decide cómo se ordena el árbol es el backend.
 */
function buildLevel(source: TreeSource, parentKey: string, level: number): readonly TreeNode[] {
  const directories = (source.childDirectoryIds[parentKey] ?? []).flatMap<TreeNode>((id) => {
    const directory = source.directoriesById[id];

    if (directory === undefined) {
      return [];
    }

    const expanded = source.expandedIds.has(id);

    return [
      {
        id,
        kind: 'directory',
        name: directory.name,
        level,
        parentId: directory.parentId,
        expanded,
        children: expanded ? buildLevel(source, id, level + 1) : [],
      },
    ];
  });

  const documents = (source.childDocumentIds[parentKey] ?? []).flatMap<TreeNode>((id) => {
    const summary = source.documentsById[id];

    if (summary === undefined) {
      return [];
    }

    return [
      {
        id,
        kind: 'document',
        name: summary.title,
        level,
        parentId: summary.directoryId,
        expanded: false,
        children: [],
      },
    ];
  });

  return [...directories, ...documents];
}

/**
 * El árbol en el orden en que el foco lo recorre de arriba abajo, que es justo el orden visual.
 * Los hijos de un directorio contraído no están, porque no están en `children`.
 */
export function flattenTree(nodes: readonly TreeNode[]): readonly TreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** Lo mínimo para recorrer el árbol **completo**, esté o no desplegado en la barra lateral. */
export type SubtreeSource = Pick<WorkspaceState, 'childDirectoryIds' | 'childDocumentIds'>;

/**
 * Todos los directorios que cuelgan de uno, a cualquier profundidad y **sin mirar `expandedIds`**:
 * lo que está plegado sigue existiendo. Es lo contrario de `buildVisibleTree`, que solo devuelve lo
 * visible, y por eso no se puede reutilizar aquella para esto.
 *
 * El conjunto `seen` no es decorativo: el servidor impide los ciclos, pero un árbol recibido a
 * medias no puede colgar la interfaz.
 */
export function collectDescendantDirectoryIds(
  source: Pick<WorkspaceState, 'childDirectoryIds'>,
  directoryId: string,
): readonly string[] {
  const found: string[] = [];
  const seen = new Set<string>([directoryId]);
  const pending: string[] = [directoryId];

  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    for (const childId of source.childDirectoryIds[current] ?? []) {
      if (!seen.has(childId)) {
        seen.add(childId);
        found.push(childId);
        pending.push(childId);
      }
    }
  }

  return found;
}

/** Un directorio como destino posible de un movimiento, con su ruta completa para distinguirlo. */
export interface DirectoryOption {
  readonly id: string;
  /** `Notas / Diario`: sin la ruta, dos directorios homónimos en ramas distintas serían iguales. */
  readonly path: string;
}

/**
 * Todos los directorios del árbol en orden de recorrido y **sin mirar `expandedIds`**: lo que se
 * puede elegir como destino no depende de lo que la barra lateral tenga desplegado.
 */
export function listDirectoryPaths(
  source: Pick<WorkspaceState, 'directoriesById' | 'childDirectoryIds'>,
): readonly DirectoryOption[] {
  const walk = (parentKey: string, prefix: string): DirectoryOption[] =>
    (source.childDirectoryIds[parentKey] ?? []).flatMap<DirectoryOption>((id) => {
      const directory = source.directoriesById[id];

      if (directory === undefined) {
        return [];
      }

      const path = prefix === '' ? directory.name : `${prefix} / ${directory.name}`;

      return [{ id, path }, ...walk(id, path)];
    });

  return walk(ROOT_KEY, '');
}

/**
 * Cuántos nodos se llevaría por delante el borrado recursivo de un directorio, él **no** incluido:
 * es lo que la confirmación tiene que nombrar antes de mandar `recursive=true`.
 */
export function countSubtreeNodes(source: SubtreeSource, directoryId: string): number {
  const { directories, documents } = countSubtreeByKind(source, directoryId);

  return directories + documents;
}

/** Lo mismo, **repartido por tipo**. Es el desglose que enseña la confirmación de borrado. */
export interface SubtreeCount {
  readonly directories: number;
  readonly documents: number;
}

/**
 * El reparto por tipo del subárbol, él no incluido.
 *
 * Existe porque desde la fase 6 el aviso de borrado dice «dentro hay 12 elementos: 3 carpetas y 9
 * documentos» en vez de un total pelado. Los dos números no son cosmética: borrar tres carpetas no
 * es lo mismo que borrar tres notas sueltas, y quien confirma tiene derecho a saber cuál de las dos
 * cosas está a punto de hacer.
 *
 * `countSubtreeNodes` se deriva de aquí y no al revés, para que el total y el desglose no puedan
 * discrepar: dos recorridos del mismo árbol es cómo un aviso acaba diciendo 12 arriba y 13 abajo.
 */
export function countSubtreeByKind(source: SubtreeSource, directoryId: string): SubtreeCount {
  const descendants = collectDescendantDirectoryIds(source, directoryId);

  return {
    directories: descendants.length,
    documents: [directoryId, ...descendants].reduce(
      (total, id) => total + (source.childDocumentIds[id] ?? []).length,
      0,
    ),
  };
}
