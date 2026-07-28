import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { CreateNodeForm } from './CreateNodeForm';
import { MoveNodeDialog } from './MoveNodeDialog';
import { RenameNodeDialog } from './RenameNodeDialog';
import { TreeNodeRow, type TreeNodeAction } from './TreeNodeRow';
import {
  buildVisibleTree,
  countSubtreeNodes,
  flattenTree,
  type TreeNode,
  type TreeNodeKind,
} from './tree-nodes';
import { useWorkspaceStore } from './workspace.store';

/** Diálogo abierto sobre el árbol, con lo que necesita para pintarse. */
type OpenDialog =
  | {
      readonly kind: 'create';
      readonly parentId: string | null;
      readonly parentName: string | null;
    }
  | { readonly kind: 'rename'; readonly node: TreeNode }
  | { readonly kind: 'move'; readonly node: TreeNode }
  | { readonly kind: 'delete'; readonly node: TreeNode };

/**
 * Árbol de directorios y documentos de la barra lateral (AC-28).
 *
 * Sigue el patrón *tree* de WAI-ARIA: un contenedor `role="tree"` con nombre, nodos `role=
 * "treeitem"` con `aria-level`, `aria-expanded` (solo directorios) y `aria-selected`, y un único
 * nodo tabulable. El teclado se atiende **delegado** en el contenedor: el evento nace siempre en el
 * nodo con el foco, así que no hace falta un manejador por fila.
 *
 * El foco es del DOM, no del store: `expandedIds` y `selectedId` son estado compartido de la
 * aplicación (los necesitan la vista de documento y las mutaciones), mientras que "qué nodo está
 * enfocado" solo le importa a este componente mientras esté montado.
 */
export function WorkspaceTreeView(): React.JSX.Element {
  const status = useWorkspaceStore((state) => state.status);
  const error = useWorkspaceStore((state) => state.error);
  const pendingAction = useWorkspaceStore((state) => state.pendingAction);
  const directoriesById = useWorkspaceStore((state) => state.directoriesById);
  const documentsById = useWorkspaceStore((state) => state.documentsById);
  const childDirectoryIds = useWorkspaceStore((state) => state.childDirectoryIds);
  const childDocumentIds = useWorkspaceStore((state) => state.childDocumentIds);
  const expandedIds = useWorkspaceStore((state) => state.expandedIds);
  const selectedId = useWorkspaceStore((state) => state.selectedId);
  const toggleExpanded = useWorkspaceStore((state) => state.toggleExpanded);
  const select = useWorkspaceStore((state) => state.select);

  const navigate = useNavigate();
  const location = useLocation();
  const treeRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  // Se incrementa cuando una mutación deja error: el efecto que lo observa es el que lleva el foco
  // al aviso (AC-29). No basta con mirar `error`, porque el mismo mensaje dos veces seguidas no
  // cambia de valor y el foco tiene que moverse igual.
  const [errorFocusToken, setErrorFocusToken] = useState(0);

  const busy = pendingAction !== null;

  // El estado se lee del store y no de la variable de arriba a propósito: con `StrictMode` el
  // efecto de montaje corre dos veces y la segunda leería un `status` congelado en `'idle'`,
  // pidiendo el árbol dos veces. `getState()` ya ve el `'loading'` que dejó la primera.
  useEffect(() => {
    const workspace = useWorkspaceStore.getState();

    if (workspace.status === 'idle') {
      void workspace.loadTree();
    }
  }, []);

  const roots = useMemo(
    () =>
      buildVisibleTree({
        directoriesById,
        documentsById,
        childDirectoryIds,
        childDocumentIds,
        expandedIds,
      }),
    [directoriesById, documentsById, childDirectoryIds, childDocumentIds, expandedIds],
  );

  const focusOrder = useMemo(() => flattenTree(roots), [roots]);
  const activeId = resolveActiveId(focusOrder, focusedId, selectedId);

  useEffect(() => {
    if (errorFocusToken > 0) {
      alertRef.current?.focus();
    }
  }, [errorFocusToken]);

  const focusNode = (id: string): void => {
    setFocusedId(id);
    treeRef.current?.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
  };

  /**
   * Clic o `Enter` sobre un nodo: pasa a ser el seleccionado y, si es directorio, se pliega; si es
   * documento, se abre en `/documents/:id` (AC-31).
   *
   * La navegación se hace aquí y no con un `<Link>` en la fila a propósito: el elemento enfocable
   * del roving tabindex es el `treeitem`, y un ancla dentro añadiría una segunda parada de
   * tabulación por nodo, rompiendo el patrón *tree*. Clic y `Enter` ya pasan los dos por aquí.
   */
  const activate = (node: TreeNode): void => {
    setFocusedId(node.id);
    select(node.id);

    if (node.kind === 'directory') {
      toggleExpanded(node.id);

      return;
    }

    void navigate(`/documents/${node.id}`);
  };

  /**
   * Camino único de toda mutación lanzada desde un diálogo: el store **no lanza**, deja el fallo en
   * `error`. Pase lo que pase el diálogo se cierra, y si quedó mensaje se lleva el foco al aviso,
   * que es donde está la explicación (AC-29). Devuelve si la mutación salió bien, para lo que haya
   * que hacer después.
   */
  const runMutation = async (request: () => Promise<void>): Promise<boolean> => {
    await request();
    setDialog(null);

    if (useWorkspaceStore.getState().error !== null) {
      setErrorFocusToken((token) => token + 1);

      return false;
    }

    return true;
  };

  const createNode = async (kind: TreeNodeKind, name: string): Promise<void> => {
    if (dialog?.kind !== 'create') {
      return;
    }

    const { parentId } = dialog;
    const workspace = useWorkspaceStore.getState();

    const created = await runMutation(() =>
      kind === 'directory'
        ? workspace.createDirectory(name, parentId)
        : workspace.createDocument(name, parentId),
    );

    // Crear algo dentro de un directorio plegado y no ver nada aparecer se lee como que no ha
    // pasado nada: se despliega el padre para que el nodo nuevo esté a la vista.
    if (created && parentId !== null) {
      useWorkspaceStore.getState().expand(parentId);
    }
  };

  const renameNode = async (name: string): Promise<void> => {
    if (dialog?.kind !== 'rename') {
      return;
    }

    const { node } = dialog;
    const workspace = useWorkspaceStore.getState();

    await runMutation(() =>
      node.kind === 'directory'
        ? workspace.renameDirectory(node.id, name)
        : workspace.renameDocument(node.id, name),
    );
  };

  const moveNode = async (destinationId: string | null): Promise<void> => {
    if (dialog?.kind !== 'move') {
      return;
    }

    const { node } = dialog;
    const workspace = useWorkspaceStore.getState();

    await runMutation(() =>
      node.kind === 'directory'
        ? workspace.moveDirectory(node.id, destinationId)
        : workspace.moveDocument(node.id, destinationId),
    );
  };

  const deleteNode = async (node: TreeNode, contentCount: number): Promise<void> => {
    const openDocumentId = openDocumentIdOf(location.pathname);
    const workspace = useWorkspaceStore.getState();

    const deleted = await runMutation(() =>
      node.kind === 'directory'
        ? workspace.deleteDirectory(node.id, contentCount > 0)
        : workspace.deleteDocument(node.id),
    );

    // Si lo que se ha borrado era (o contenía) el documento abierto, la ruta apunta a algo que ya
    // no existe: se vuelve al inicio en vez de dejar un `404` a la vista.
    if (
      deleted &&
      openDocumentId !== null &&
      useWorkspaceStore.getState().documentsById[openDocumentId] === undefined
    ) {
      void navigate('/');
    }
  };

  const openDialog = (action: TreeNodeAction, node: TreeNode): void => {
    // El aviso anterior ya no describe lo que la persona está haciendo ahora.
    useWorkspaceStore.setState({ error: null });

    setDialog(
      action === 'create'
        ? { kind: 'create', parentId: node.id, parentName: node.name }
        : { kind: action, node },
    );
  };

  // Cada fila cubre todo el ancho de su nivel y el `role="group"` no tiene hueco propio, así que
  // el `treeitem` más cercano al punto pulsado es siempre la fila que se ve bajo el puntero.
  const handleClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    const id = treeItemIdOf(event.target);
    const node = focusOrder.find((candidate) => candidate.id === id);

    if (node !== undefined) {
      activate(node);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    // `Enter`, `Espacio` y las flechas sobre un botón de la fila también burbujean hasta aquí, y
    // sin este corte pulsar «Renombrar» activaría además el nodo.
    if (isRowActionTarget(event.target)) {
      return;
    }

    const id = treeItemIdOf(event.target);
    const index = focusOrder.findIndex((node) => node.id === id);
    const node = focusOrder[index];

    if (node === undefined) {
      return;
    }

    const focusAt = (nextIndex: number): void => {
      const next = focusOrder[nextIndex];

      if (next !== undefined) {
        focusNode(next.id);
      }
    };

    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(focusOrder.length - 1);
        break;
      case 'ArrowRight':
        // Contraído: desplegar sin moverse. Ya desplegado: bajar al primer hijo, que en el orden
        // de recorrido es siempre el nodo siguiente.
        if (node.kind === 'directory' && !node.expanded) {
          toggleExpanded(node.id);
        } else if (node.children.length > 0) {
          focusAt(index + 1);
        }
        break;
      case 'ArrowLeft':
        if (node.kind === 'directory' && node.expanded) {
          toggleExpanded(node.id);
        } else if (node.parentId !== null) {
          focusNode(node.parentId);
        }
        break;
      case 'Enter':
      case ' ':
        activate(node);
        break;
      default:
        return;
    }

    event.preventDefault();
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {error === null ? null : (
        // `tabIndex` negativo: no es una parada del tabulador, pero sí puede recibir el foco
        // mediante código cuando una mutación falla, que es lo que pide AC-29.
        <p
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-sm text-red-800 outline-solid outline-0 focus:outline-2 focus:-outline-offset-2 focus:outline-red-700"
        >
          {error}
        </p>
      )}

      {status === 'idle' || status === 'loading' ? (
        <p className="px-2 py-1 text-sm text-slate-500">Cargando el árbol…</p>
      ) : null}

      {status === 'ready' && focusOrder.length === 0 ? (
        <p className="px-2 py-1 text-sm text-slate-500">
          Todavía no hay directorios ni documentos.
        </p>
      ) : null}

      <div
        ref={treeRef}
        role="tree"
        aria-label="Documentos"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1 overflow-auto"
      >
        <TreeLevel
          nodes={roots}
          selectedId={selectedId}
          activeId={activeId}
          busy={busy}
          onAction={openDialog}
        />
      </div>

      {/*
        Va **después** del árbol en el DOM, no encima: el patrón *tree* promete que tabular hacia la
        barra lateral aterriza en el nodo activo, y un botón por delante convertiría esa promesa en
        dos tabulaciones. Visualmente queda al pie de la barra, que es donde el orden lo pone.
      */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            useWorkspaceStore.setState({ error: null });
            setDialog({ kind: 'create', parentId: null, parentName: null });
          }}
          className="min-h-8 rounded-md border border-slate-300 px-2 py-1 text-sm font-medium text-slate-700 outline-solid outline-0 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nuevo en la raíz
        </button>
      </div>

      {dialog === null ? null : (
        <WorkspaceDialog
          dialog={dialog}
          busy={busy}
          contentCount={
            dialog.kind === 'delete' && dialog.node.kind === 'directory'
              ? countSubtreeNodes({ childDirectoryIds, childDocumentIds }, dialog.node.id)
              : 0
          }
          onCancel={() => {
            setDialog(null);
          }}
          onCreate={(kind, name) => {
            void createNode(kind, name);
          }}
          onRename={(name) => {
            void renameNode(name);
          }}
          onMove={(destinationId) => {
            void moveNode(destinationId);
          }}
          onDelete={(node, contentCount) => {
            void deleteNode(node, contentCount);
          }}
        />
      )}
    </div>
  );
}

interface WorkspaceDialogProps {
  readonly dialog: OpenDialog;
  readonly busy: boolean;
  readonly contentCount: number;
  readonly onCancel: () => void;
  readonly onCreate: (kind: TreeNodeKind, name: string) => void;
  readonly onRename: (name: string) => void;
  readonly onMove: (destinationId: string | null) => void;
  readonly onDelete: (node: TreeNode, contentCount: number) => void;
}

/** Un único punto donde se decide qué diálogo se pinta, para que no haya tres abiertos a la vez. */
function WorkspaceDialog({
  dialog,
  busy,
  contentCount,
  onCancel,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: WorkspaceDialogProps): React.JSX.Element {
  if (dialog.kind === 'create') {
    return (
      <CreateNodeForm
        parentName={dialog.parentName}
        pending={busy}
        onCancel={onCancel}
        onCreate={onCreate}
      />
    );
  }

  if (dialog.kind === 'rename') {
    return (
      <RenameNodeDialog node={dialog.node} pending={busy} onCancel={onCancel} onRename={onRename} />
    );
  }

  if (dialog.kind === 'move') {
    return <MoveNodeDialog node={dialog.node} pending={busy} onCancel={onCancel} onMove={onMove} />;
  }

  return (
    <ConfirmDeleteDialog
      node={dialog.node}
      contentCount={contentCount}
      pending={busy}
      onCancel={onCancel}
      onConfirm={() => {
        onDelete(dialog.node, contentCount);
      }}
    />
  );
}

interface TreeLevelProps {
  readonly nodes: readonly TreeNode[];
  readonly selectedId: string | null;
  readonly activeId: string | null;
  readonly busy: boolean;
  readonly onAction: (action: TreeNodeAction, node: TreeNode) => void;
}

/** Un nivel del árbol. Se llama a sí mismo por cada directorio expandido. */
function TreeLevel({
  nodes,
  selectedId,
  activeId,
  busy,
  onAction,
}: TreeLevelProps): React.JSX.Element {
  return (
    <>
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          selected={node.id === selectedId}
          tabbable={node.id === activeId}
          busy={busy}
          onAction={onAction}
        >
          {node.children.length === 0 ? null : (
            <div role="group">
              <TreeLevel
                nodes={node.children}
                selectedId={selectedId}
                activeId={activeId}
                busy={busy}
                onAction={onAction}
              />
            </div>
          )}
        </TreeNodeRow>
      ))}
    </>
  );
}

/**
 * El nodo tabulable: el último que tuvo el foco, si sigue visible; si no, el seleccionado; y si
 * tampoco, el primero. Así el árbol siempre tiene exactamente una puerta de entrada al tabular,
 * incluso después de contraer el directorio donde estaba el foco.
 */
function resolveActiveId(
  focusOrder: readonly TreeNode[],
  focusedId: string | null,
  selectedId: string | null,
): string | null {
  const isVisible = (id: string | null): boolean =>
    id !== null && focusOrder.some((node) => node.id === id);

  if (isVisible(focusedId)) {
    return focusedId;
  }

  if (isVisible(selectedId)) {
    return selectedId;
  }

  return focusOrder[0]?.id ?? null;
}

/** Id del `treeitem` en el que ocurrió el evento, o `null` si ocurrió fuera de uno. */
function treeItemIdOf(target: EventTarget): string | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  return target.closest<HTMLElement>('[role="treeitem"]')?.dataset['nodeId'] ?? null;
}

/** El evento nació en un botón de acción de la fila, no en la fila. */
function isRowActionTarget(target: EventTarget): boolean {
  return target instanceof HTMLElement && target.closest('button') !== null;
}

/**
 * Id del documento que la ruta tiene abierto, si es que hay alguno. Se mira la ruta y no
 * `useParams`, porque este componente vive en el `AppShell`, fuera de la ruta `documents/:id`.
 */
function openDocumentIdOf(pathname: string): string | null {
  const match = /^\/documents\/([^/]+)$/.exec(pathname);

  return match?.[1] === undefined ? null : decodeURIComponent(match[1]);
}
