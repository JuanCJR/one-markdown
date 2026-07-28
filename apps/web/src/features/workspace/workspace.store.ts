import type { DirectoryNode, DocumentSummary, WorkspaceTree } from '@one-markdown/shared';
import { create } from 'zustand';

import {
  ApiError,
  createDirectory as createDirectoryRequest,
  createDocument as createDocumentRequest,
  deleteDirectory as deleteDirectoryRequest,
  deleteDocument as deleteDocumentRequest,
  getWorkspaceTree as getWorkspaceTreeRequest,
  moveDirectory as moveDirectoryRequest,
  moveDocument as moveDocumentRequest,
  renameDirectory as renameDirectoryRequest,
  renameDocument as renameDocumentRequest,
} from '../../shared/api/http';

/**
 * Clave de los hijos que cuelgan de la raíz. El servidor los marca con `parentId: null`, que no
 * puede ser clave de un objeto; `'root'` no colisiona con ningún id porque los ids son uuid.
 */
export const ROOT_KEY = 'root';

export type WorkspaceStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Mutación en vuelo, para que la interfaz pueda deshabilitar lo que corresponda. */
export type WorkspaceMutation =
  | 'createDirectory'
  | 'createDocument'
  | 'renameDirectory'
  | 'renameDocument'
  | 'moveDirectory'
  | 'moveDocument'
  | 'deleteDirectory'
  | 'deleteDocument';

export interface WorkspaceState {
  readonly status: WorkspaceStatus;
  readonly directoriesById: Readonly<Record<string, DirectoryNode>>;
  readonly documentsById: Readonly<Record<string, DocumentSummary>>;
  /** Ids de los directorios hijos de cada padre, en el orden que devolvió el servidor. */
  readonly childDirectoryIds: Readonly<Record<string, readonly string[]>>;
  readonly childDocumentIds: Readonly<Record<string, readonly string[]>>;
  /** Directorios desplegados en la barra lateral. Estado de interfaz: no viaja al servidor. */
  readonly expandedIds: ReadonlySet<string>;
  readonly selectedId: string | null;
  readonly error: string | null;
  readonly pendingAction: WorkspaceMutation | null;

  loadTree: () => Promise<void>;
  createDirectory: (name: string, parentId: string | null) => Promise<void>;
  createDocument: (title: string, directoryId: string | null) => Promise<void>;
  renameDirectory: (id: string, name: string) => Promise<void>;
  renameDocument: (id: string, title: string) => Promise<void>;
  moveDirectory: (id: string, parentId: string | null) => Promise<void>;
  moveDocument: (id: string, directoryId: string | null) => Promise<void>;
  deleteDirectory: (id: string, recursive: boolean) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  toggleExpanded: (id: string) => void;
  /** Despliega un directorio que quizá ya lo estaba. Idempotente, al revés que `toggleExpanded`. */
  expand: (id: string) => void;
  select: (id: string | null) => void;
}

interface NormalizedTree {
  readonly directoriesById: Record<string, DirectoryNode>;
  readonly documentsById: Record<string, DocumentSummary>;
  readonly childDirectoryIds: Record<string, string[]>;
  readonly childDocumentIds: Record<string, string[]>;
}

/**
 * Convierte las dos listas planas del servidor en los mapas que necesita el árbol. El orden de
 * cada lista de hijos es el de la respuesta: quien decide cómo se ordena el árbol es el servidor
 * (`nameKey`, luego `id`), y reordenar aquí sería una segunda regla de ordenación que mantener.
 */
function normalizeTree(tree: WorkspaceTree): NormalizedTree {
  const directoriesById: Record<string, DirectoryNode> = {};
  const documentsById: Record<string, DocumentSummary> = {};
  const childDirectoryIds: Record<string, string[]> = {};
  const childDocumentIds: Record<string, string[]> = {};

  for (const directory of tree.directories) {
    directoriesById[directory.id] = directory;
    (childDirectoryIds[directory.parentId ?? ROOT_KEY] ??= []).push(directory.id);
  }

  for (const summary of tree.documents) {
    documentsById[summary.id] = summary;
    (childDocumentIds[summary.directoryId ?? ROOT_KEY] ??= []).push(summary.id);
  }

  return { directoriesById, documentsById, childDirectoryIds, childDocumentIds };
}

/**
 * Texto que se le muestra a la persona. Los mensajes de dominio del backend ya están redactados
 * para leerse («Ya existe un directorio con ese nombre»), así que se reenvían tal cual; lo que no
 * se puede enseñar es el mensaje del navegador cuando la red falla.
 */
function describeWorkspaceError(cause: unknown): string {
  if (!(cause instanceof ApiError)) {
    return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }

  if (cause.statusCode === 0) {
    return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }

  return cause.message;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => {
  /**
   * Recarga el árbol **sin tocar `error`**: la usa tanto `loadTree` (que lo ha limpiado antes)
   * como el camino de `404`, donde el mensaje de la mutación que la provocó debe sobrevivir a la
   * recarga.
   */
  const reloadTree = async (): Promise<void> => {
    try {
      set({ status: 'ready', ...normalizeTree(await getWorkspaceTreeRequest()) });
    } catch (cause) {
      set((state) => ({ status: 'error', error: state.error ?? describeWorkspaceError(cause) }));
    }
  };

  /**
   * Toda mutación sigue el mismo camino (decisión 12 del plan): llamar al endpoint y **recargar**
   * el árbol, sin actualización optimista. Un error deja el mensaje y no toca los mapas, salvo el
   * `404`, que además fuerza la recarga porque significa que el árbol del cliente ya era mentira.
   */
  const mutate = async (
    action: WorkspaceMutation,
    request: () => Promise<unknown>,
    options: { readonly reloadOnError?: boolean } = {},
  ): Promise<void> => {
    set({ pendingAction: action, error: null });

    try {
      await request();
      await reloadTree();
    } catch (cause) {
      set({ error: describeWorkspaceError(cause) });

      const stale =
        options.reloadOnError === true || (cause instanceof ApiError && cause.statusCode === 404);

      if (stale) {
        await reloadTree();
      }
    } finally {
      set({ pendingAction: null });
    }
  };

  return {
    status: 'idle',
    directoriesById: {},
    documentsById: {},
    childDirectoryIds: {},
    childDocumentIds: {},
    expandedIds: new Set<string>(),
    selectedId: null,
    error: null,
    pendingAction: null,

    loadTree: async () => {
      set({ status: 'loading', error: null });

      await reloadTree();
    },

    createDirectory: async (name, parentId) => {
      await mutate('createDirectory', () => createDirectoryRequest({ name, parentId }));
    },

    createDocument: async (title, directoryId) => {
      await mutate('createDocument', () => createDocumentRequest({ title, directoryId }));
    },

    renameDirectory: async (id, name) => {
      await mutate('renameDirectory', () => renameDirectoryRequest(id, name));
    },

    renameDocument: async (id, title) => {
      await mutate('renameDocument', () => renameDocumentRequest(id, title));
    },

    // Los dos movimientos recargan **también** cuando fallan (AC-30). Un movimiento rechazado se
    // decide contra la jerarquía real, no contra la que tiene el cliente: si el servidor dice que el
    // destino es un descendiente y aquí no lo parecía, el árbol de la pantalla ya no era cierto.
    moveDirectory: async (id, parentId) => {
      await mutate('moveDirectory', () => moveDirectoryRequest(id, parentId), {
        reloadOnError: true,
      });
    },

    moveDocument: async (id, directoryId) => {
      await mutate('moveDocument', () => moveDocumentRequest(id, directoryId), {
        reloadOnError: true,
      });
    },

    deleteDirectory: async (id, recursive) => {
      await mutate('deleteDirectory', () => deleteDirectoryRequest(id, recursive));
    },

    deleteDocument: async (id) => {
      await mutate('deleteDocument', () => deleteDocumentRequest(id));
    },

    toggleExpanded: (id) => {
      set((state) => {
        const expandedIds = new Set(state.expandedIds);

        if (!expandedIds.delete(id)) {
          expandedIds.add(id);
        }

        return { expandedIds };
      });
    },

    expand: (id) => {
      set((state) =>
        state.expandedIds.has(id) ? {} : { expandedIds: new Set(state.expandedIds).add(id) },
      );
    },

    select: (id) => {
      set({ selectedId: id });
    },
  };
});
