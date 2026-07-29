import type {
  DirectoryNode,
  DocumentSummary,
  MarkdownDocument,
  WorkspaceTree,
} from '@one-markdown/shared';

/**
 * Formas del contrato de workspace (`packages/shared`, spec 002 §4) para los tests del cliente
 * HTTP, del store y de los componentes del árbol.
 *
 * Los `id` son legibles a propósito (`dir-notas`, no un uuid): aparecen dentro de las rutas que
 * declaran los tests (`PATCH /api/workspace/directories/dir-notas`) y un uuid ahí convierte cada
 * caso en una sopa de hexadecimal. El cliente no valida el formato; quien lo valida es el
 * `ParseUUIDPipe` del backend, que tiene sus propios e2e.
 */

const CREATED_AT = '2026-07-25T00:00:00.000Z';
const UPDATED_AT = '2026-07-25T00:00:00.000Z';

/** Espejo de `WorkspaceDirectoryResponseDto`. Por defecto, un directorio en la raíz. */
export function directoryNode(overrides: Partial<DirectoryNode> = {}): DirectoryNode {
  return {
    id: 'dir-notas',
    name: 'Notas',
    parentId: null,
    depth: 0,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

/** Espejo de `WorkspaceDocumentSummaryResponseDto`: **sin** `content`, como en el árbol. */
export function documentSummary(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: 'doc-diario',
    title: 'Diario',
    directoryId: null,
    contentBytes: 9,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

/** Espejo de `WorkspaceDocumentResponseDto`: el resumen más el markdown en crudo. */
export function markdownDocument(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    ...documentSummary(),
    content: '# Diario\n',
    contentVersion: 0,
    ...overrides,
  };
}

/** Espejo de `WorkspaceTreeResponseDto`. Vacío por defecto; cada caso pone lo que necesita. */
export function workspaceTree(overrides: Partial<WorkspaceTree> = {}): WorkspaceTree {
  return {
    directories: [],
    documents: [],
    generatedAt: '2026-07-25T12:00:00.000Z',
    ...overrides,
  };
}
