import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ROOT_KEY, useWorkspaceStore } from './workspace.store';
import {
  apiErrorResponse,
  deferredResponse,
  jsonResponse,
  noContentResponse,
  stubApi,
} from '../../test/api-stub';
import { configureAuthBridge } from '../../shared/api/http';
import {
  directoryNode,
  documentSummary,
  markdownDocument,
  workspaceTree,
} from '../../test/workspace-fixtures';

/** Árbol de trabajo: dos directorios en la raíz, un subdirectorio y dos documentos. */
function sampleTree(): ReturnType<typeof workspaceTree> {
  return workspaceTree({
    directories: [
      directoryNode({ id: 'dir-zeta', name: 'Zeta' }),
      directoryNode({ id: 'dir-alfa', name: 'Alfa' }),
      directoryNode({ id: 'dir-sub', name: 'Sub', parentId: 'dir-alfa', depth: 1 }),
    ],
    documents: [
      documentSummary({ id: 'doc-raiz', title: 'En la raíz', directoryId: null }),
      documentSummary({ id: 'doc-dentro', title: 'Dentro de Alfa', directoryId: 'dir-alfa' }),
    ],
  });
}

function treeRoute(): Record<string, () => Response> {
  return { 'GET /api/workspace/tree': () => jsonResponse(sampleTree()) };
}

async function loadSampleTree(): Promise<void> {
  stubApi(treeRoute());
  await useWorkspaceStore.getState().loadTree();
  vi.unstubAllGlobals();
}

beforeEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);

  configureAuthBridge({
    getAccessToken: () => 'access-token-1',
    onSessionRenewed: () => undefined,
    onSessionLost: () => undefined,
  });
});

afterEach(() => {
  // El árbol es estado de UI y de servidor: nada de él debe aterrizar en el almacenamiento del
  // navegador. Si algún día alguien le añade `persist` al store, este assert es lo que lo impide.
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);

  vi.unstubAllGlobals();
});

describe('useWorkspaceStore — estado inicial', () => {
  it('arranca en "idle" con el árbol vacío y sin selección', () => {
    const state = useWorkspaceStore.getState();

    expect(state.status).toBe('idle');
    expect(state.directoriesById).toEqual({});
    expect(state.documentsById).toEqual({});
    expect(state.childDirectoryIds).toEqual({});
    expect(state.childDocumentIds).toEqual({});
    expect(state.selectedId).toBeNull();
    expect(state.error).toBeNull();
    expect(state.pendingAction).toBeNull();
    expect([...state.expandedIds]).toEqual([]);
  });
});

describe('useWorkspaceStore.loadTree', () => {
  it('pasa por "loading" mientras la petición está en vuelo y termina en "ready"', async () => {
    const pending = deferredResponse();
    stubApi({ 'GET /api/workspace/tree': () => pending.response });

    const loading = useWorkspaceStore.getState().loadTree();
    expect(useWorkspaceStore.getState().status).toBe('loading');

    pending.resolveWith(jsonResponse(sampleTree()));
    await loading;

    expect(useWorkspaceStore.getState().status).toBe('ready');
  });

  it('normaliza los nodos por id', async () => {
    stubApi(treeRoute());

    await useWorkspaceStore.getState().loadTree();

    const state = useWorkspaceStore.getState();
    expect(state.directoriesById['dir-sub']?.name).toBe('Sub');
    expect(state.directoriesById['dir-sub']?.depth).toBe(1);
    expect(state.documentsById['doc-dentro']?.title).toBe('Dentro de Alfa');
  });

  it('agrupa los hijos por padre, con "root" para la raíz y en el orden del servidor', async () => {
    stubApi(treeRoute());

    await useWorkspaceStore.getState().loadTree();

    const state = useWorkspaceStore.getState();
    expect(state.childDirectoryIds[ROOT_KEY]).toEqual(['dir-zeta', 'dir-alfa']);
    expect(state.childDirectoryIds['dir-alfa']).toEqual(['dir-sub']);
    expect(state.childDocumentIds[ROOT_KEY]).toEqual(['doc-raiz']);
    expect(state.childDocumentIds['dir-alfa']).toEqual(['doc-dentro']);
  });

  it('deja el estado en "error" con el mensaje cuando la carga falla', async () => {
    stubApi({
      'GET /api/workspace/tree': () => apiErrorResponse(500, 'Error interno del servidor'),
    });

    await useWorkspaceStore.getState().loadTree();

    const state = useWorkspaceStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Error interno del servidor');
  });
});

interface MutationCase {
  readonly name: string;
  readonly route: string;
  readonly reply: () => Response;
  readonly run: () => Promise<void>;
}

const mutations: readonly MutationCase[] = [
  {
    name: 'createDirectory',
    route: 'POST /api/workspace/directories',
    reply: () => jsonResponse(directoryNode({ id: 'dir-nuevo', name: 'Nuevo' }), 201),
    run: () => useWorkspaceStore.getState().createDirectory('Nuevo', null),
  },
  {
    name: 'createDocument',
    route: 'POST /api/workspace/documents',
    reply: () => jsonResponse(markdownDocument({ id: 'doc-nuevo' }), 201),
    run: () => useWorkspaceStore.getState().createDocument('Nuevo', 'dir-alfa'),
  },
  {
    name: 'renameDirectory',
    route: 'PATCH /api/workspace/directories/dir-alfa',
    reply: () => jsonResponse(directoryNode({ id: 'dir-alfa', name: 'Apuntes' })),
    run: () => useWorkspaceStore.getState().renameDirectory('dir-alfa', 'Apuntes'),
  },
  {
    name: 'renameDocument',
    route: 'PATCH /api/workspace/documents/doc-raiz',
    reply: () => jsonResponse(documentSummary({ id: 'doc-raiz', title: 'Bitácora' })),
    run: () => useWorkspaceStore.getState().renameDocument('doc-raiz', 'Bitácora'),
  },
  {
    name: 'moveDirectory',
    route: 'POST /api/workspace/directories/dir-sub/move',
    reply: () => jsonResponse(directoryNode({ id: 'dir-sub', name: 'Sub', parentId: null })),
    run: () => useWorkspaceStore.getState().moveDirectory('dir-sub', null),
  },
  {
    name: 'moveDocument',
    route: 'POST /api/workspace/documents/doc-raiz/move',
    reply: () => jsonResponse(documentSummary({ id: 'doc-raiz', directoryId: 'dir-alfa' })),
    run: () => useWorkspaceStore.getState().moveDocument('doc-raiz', 'dir-alfa'),
  },
  {
    name: 'deleteDirectory',
    route: 'DELETE /api/workspace/directories/dir-alfa?recursive=true',
    reply: () => noContentResponse(),
    run: () => useWorkspaceStore.getState().deleteDirectory('dir-alfa', true),
  },
  {
    name: 'deleteDocument',
    route: 'DELETE /api/workspace/documents/doc-raiz',
    reply: () => noContentResponse(),
    run: () => useWorkspaceStore.getState().deleteDocument('doc-raiz'),
  },
];

describe('useWorkspaceStore — mutaciones (decisión 12: nada optimista, se recarga el árbol)', () => {
  it.each(mutations)(
    '$name llama a su endpoint y recarga el árbol',
    async ({ route, reply, run }) => {
      const api = stubApi({ [route]: reply, ...treeRoute() });

      await run();

      expect(api.callsTo(route)).toHaveLength(1);
      expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(1);
      expect(api.calls).toHaveLength(2);
      expect(useWorkspaceStore.getState().error).toBeNull();
    },
  );

  it('marca la acción en vuelo en pendingAction y la limpia al terminar', async () => {
    const pending = deferredResponse();
    stubApi({ 'POST /api/workspace/directories': () => pending.response, ...treeRoute() });

    const creating = useWorkspaceStore.getState().createDirectory('Nuevo', null);
    expect(useWorkspaceStore.getState().pendingAction).toBe('createDirectory');

    pending.resolveWith(jsonResponse(directoryNode({ id: 'dir-nuevo' }), 201));
    await creating;

    expect(useWorkspaceStore.getState().pendingAction).toBeNull();
  });

  it('un 409 deja el mensaje del servidor y no toca el árbol', async () => {
    await loadSampleTree();
    const antes = useWorkspaceStore.getState();
    const api = stubApi({
      'POST /api/workspace/directories': () =>
        apiErrorResponse(409, 'Ya existe un directorio con ese nombre', {
          code: 'DIRECTORY_NAME_TAKEN',
        }),
      ...treeRoute(),
    });

    await useWorkspaceStore.getState().createDirectory('Alfa', null);

    const state = useWorkspaceStore.getState();
    expect(state.error).toBe('Ya existe un directorio con ese nombre');
    expect(state.status).toBe('ready');
    expect(state.directoriesById).toEqual(antes.directoriesById);
    expect(state.childDirectoryIds).toEqual(antes.childDirectoryIds);
    // El árbol del servidor no cambió: recargarlo sería una petición inútil.
    expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(0);
  });

  it('un 404 deja el mensaje y además recarga el árbol, que estaba desactualizado', async () => {
    await loadSampleTree();
    const api = stubApi({
      'PATCH /api/workspace/documents/doc-raiz': () =>
        apiErrorResponse(404, 'El documento no existe', { code: 'DOCUMENT_NOT_FOUND' }),
      'GET /api/workspace/tree': () =>
        jsonResponse(workspaceTree({ directories: [directoryNode({ id: 'dir-zeta' })] })),
    });

    await useWorkspaceStore.getState().renameDocument('doc-raiz', 'Bitácora');

    const state = useWorkspaceStore.getState();
    expect(state.error).toBe('El documento no existe');
    expect(api.callsTo('GET /api/workspace/tree')).toHaveLength(1);
    expect(state.documentsById['doc-raiz']).toBeUndefined();
  });

  it('un error de red deja un mensaje comprensible en vez del texto del navegador', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await useWorkspaceStore.getState().createDirectory('Nuevo', null);

    expect(useWorkspaceStore.getState().error).toBe(
      'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    );
  });

  it('una mutación correcta limpia el error de la anterior', async () => {
    useWorkspaceStore.setState({ error: 'Ya existe un directorio con ese nombre' });
    stubApi({
      'POST /api/workspace/directories': () => jsonResponse(directoryNode(), 201),
      ...treeRoute(),
    });

    await useWorkspaceStore.getState().createDirectory('Nuevo', null);

    expect(useWorkspaceStore.getState().error).toBeNull();
  });
});

describe('useWorkspaceStore — estado de interfaz', () => {
  it('toggleExpanded abre y cierra un directorio sin tocar la red', () => {
    const api = stubApi({});

    useWorkspaceStore.getState().toggleExpanded('dir-alfa');
    expect([...useWorkspaceStore.getState().expandedIds]).toEqual(['dir-alfa']);

    useWorkspaceStore.getState().toggleExpanded('dir-alfa');
    expect([...useWorkspaceStore.getState().expandedIds]).toEqual([]);
    expect(api.calls).toHaveLength(0);
  });

  it('select marca el nodo activo sin tocar la red', () => {
    const api = stubApi({});

    useWorkspaceStore.getState().select('doc-raiz');

    expect(useWorkspaceStore.getState().selectedId).toBe('doc-raiz');
    expect(api.calls).toHaveLength(0);
  });

  it('la recarga del árbol conserva lo que la persona tenía abierto y seleccionado', async () => {
    useWorkspaceStore.getState().toggleExpanded('dir-alfa');
    useWorkspaceStore.getState().select('doc-raiz');
    stubApi(treeRoute());

    await useWorkspaceStore.getState().loadTree();

    const state = useWorkspaceStore.getState();
    expect([...state.expandedIds]).toEqual(['dir-alfa']);
    expect(state.selectedId).toBe('doc-raiz');
  });
});
