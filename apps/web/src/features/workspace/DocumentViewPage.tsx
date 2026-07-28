import type { DirectoryNode, MarkdownDocument } from '@one-markdown/shared';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { useWorkspaceStore } from './workspace.store';
import { ApiError, getDocument } from '../../shared/api/http';

/** Lo que la vista sabe del documento en cada momento. */
type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly document: MarkdownDocument }
  | { readonly status: 'missing' }
  | { readonly status: 'error'; readonly message: string };

/**
 * Vista de un documento (AC-31): título, ruta dentro del árbol y markdown **en crudo**.
 *
 * Andamio deliberado de la spec `003` (spec §5): aquí no se renderiza markdown ni se genera HTML a
 * partir del contenido, así que no hay nada que sanitizar. El contenido va dentro de un `<pre>` y
 * se lee literal, marcas incluidas.
 *
 * El contenido **no** vive en el store (el árbol solo guarda resúmenes): se pide en cada montaje y
 * se queda en estado local. El árbol, en cambio, ya lo pidió la barra lateral, así que la ruta se
 * deriva de `directoriesById` sin volver a la red.
 */
export function DocumentViewPage(): React.JSX.Element {
  const { id } = useParams<'id'>();
  const directoriesById = useWorkspaceStore((state) => state.directoriesById);

  const [view, setView] = useState<ViewState>({ status: 'loading' });
  const [requestedId, setRequestedId] = useState(id);

  // Ajuste de estado durante el render, no en un efecto: al pasar de un documento a otro sin
  // desmontar (la ruta es la misma), lo que se ve tiene que volver a «cargando» en el mismo
  // render, no un fotograma después mostrando todavía el documento anterior.
  if (id !== requestedId) {
    setRequestedId(id);
    setView({ status: 'loading' });
  }

  useEffect(() => {
    if (id === undefined) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const loaded = await getDocument(id);

        if (!cancelled) {
          setView({ status: 'ready', document: loaded });
        }
      } catch (cause) {
        if (cancelled) {
          return;
        }

        // Un `404` significa que el árbol que tiene el cliente ya era mentira: además de avisar,
        // se recarga, para que la barra lateral deje de ofrecer un documento que no existe.
        if (cause instanceof ApiError && cause.statusCode === 404) {
          setView({ status: 'missing' });
          void useWorkspaceStore.getState().loadTree();

          return;
        }

        setView({ status: 'error', message: describeDocumentError(cause) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const loaded = view.status === 'ready' ? view.document : null;

  const ancestors = useMemo(
    () => (loaded === null ? [] : directoryPathOf(directoriesById, loaded.directoryId)),
    [directoriesById, loaded],
  );

  if (view.status === 'loading') {
    return (
      <p role="status" className="text-sm text-slate-500">
        Cargando el documento…
      </p>
    );
  }

  if (view.status !== 'ready') {
    return (
      <p
        role="alert"
        className="max-w-prose rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        {view.status === 'missing' ? 'Este documento ya no existe.' : view.message}
      </p>
    );
  }

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4">
      <nav aria-label="Ruta del documento">
        <ol className="flex flex-wrap items-center text-sm text-slate-500">
          {ancestors.map((directory) => (
            <li key={directory.id} className={STEP_CLASS}>
              {directory.name}
            </li>
          ))}

          <li aria-current="page" className={`${STEP_CLASS} text-slate-700`}>
            {view.document.title}
          </li>
        </ol>
      </nav>

      <h2 className="text-xl font-semibold text-slate-900">{view.document.title}</h2>

      <pre
        role="region"
        aria-label="Markdown en crudo"
        tabIndex={0}
        className="overflow-auto rounded border border-slate-200 bg-slate-50 p-4 font-mono text-sm whitespace-pre-wrap text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-700/50"
      >
        {view.document.content}
      </pre>
    </article>
  );
}

/**
 * El separador es un pseudo-elemento y no un nodo de texto: así cada `<li>` contiene exactamente el
 * nombre de su paso y la ruta se lee sin barras sueltas.
 */
const STEP_CLASS =
  "before:mx-1.5 before:text-slate-300 before:content-['/'] first:before:content-none";

/**
 * Los directorios que hay que atravesar hasta el documento, de la raíz hacia abajo. Se corta ante
 * un directorio ausente (el árbol pudo cargarse después) y ante un ciclo, que el servidor impide
 * pero que aquí no puede colgar la vista.
 */
function directoryPathOf(
  directoriesById: Readonly<Record<string, DirectoryNode>>,
  directoryId: string | null,
): readonly DirectoryNode[] {
  const path: DirectoryNode[] = [];
  const seen = new Set<string>();

  let currentId = directoryId;

  while (currentId !== null && !seen.has(currentId)) {
    seen.add(currentId);

    const directory = directoriesById[currentId];

    if (directory === undefined) {
      break;
    }

    path.unshift(directory);
    currentId = directory.parentId;
  }

  return path;
}

/** Igual que en el store: los mensajes de dominio se reenvían; la red caída se traduce. */
function describeDocumentError(cause: unknown): string {
  if (!(cause instanceof ApiError)) {
    return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }

  if (cause.statusCode === 0) {
    return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }

  return cause.message;
}
