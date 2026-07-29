import { MAX_DOCUMENT_CONTENT_CHARS, type DirectoryNode } from '@one-markdown/shared';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';

import { ConflictDialog } from './ConflictDialog';
import { CONTENT_COUNTER_THRESHOLD } from './editor.constants';
import { useEditorStore, type ViewMode } from './editor.store';
import { applyPaletteElement } from './markdown-insert';
import { MARKDOWN_PALETTE, type PaletteElement } from './markdown-palette';
import { MarkdownPalette } from './MarkdownPalette';
import { MarkdownPreview } from './MarkdownPreview';
import { SaveStatus } from './SaveStatus';
import { ApiError } from '../../shared/api/http';
import { useWorkspaceStore } from '../workspace/workspace.store';

/**
 * Editor de un documento (AC-22, AC-23, AC-27, AC-29, AC-30, AC-31, y AC-20/AC-28 en su parte de
 * interfaz). Sustituye a `features/workspace/DocumentViewPage.tsx`, que era el andamio declarado
 * de la spec `002`, y **hereda** lo que aquella verificaba y sigue siendo cierto: el breadcrumb,
 * el anuncio de carga y el «este documento ya no existe» con recarga del árbol ante un `404`.
 *
 * El reparto de responsabilidades es el de `plan.md` §7: el **contenido** y todo el ciclo de
 * guardado viven en `editor.store.ts` —indexado por id, para que la spec `005` cambie la política
 * de desalojo y no el bucle—, y esta página solo pinta y traduce gestos a acciones del store.
 *
 * El **título y la ruta** salen del árbol (`workspace.store`) y no del documento leído, por dos
 * razones: el detalle ya lo pide el store y pedirlo otra vez para leerle el título serían dos
 * peticiones por apertura; y renombrar desde la barra lateral actualiza el encabezado al instante,
 * cosa que el andamio no hacía (se quedaba con el título rancio hasta volver a montar).
 */

/** Lo que la página sabe de la **carga** del documento; el guardado lo cuenta el store. */
type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready' }
  | { readonly status: 'missing' }
  | { readonly status: 'error'; readonly message: string };

/** Orden de las pestañas, que es también el orden en que las recorren las flechas. */
const VIEW_MODES: readonly ViewMode[] = ['text', 'preview'];

const VIEW_MODE_LABELS: Readonly<Record<ViewMode, string>> = {
  text: 'Texto',
  preview: 'Vista previa',
};

export function DocumentEditorPage(): React.JSX.Element {
  const { id } = useParams<'id'>();
  const directoriesById = useWorkspaceStore((state) => state.directoriesById);
  const summary = useWorkspaceStore((state) =>
    id === undefined ? undefined : state.documentsById[id],
  );
  const entry = useEditorStore((state) => (id === undefined ? undefined : state.entries[id]));

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [requestedId, setRequestedId] = useState(id);
  const [conflictDismissed, setConflictDismissed] = useState(false);
  const tabsRef = useRef<Partial<Record<ViewMode, HTMLButtonElement | null>>>({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Selección que hay que aplicar **después** de que el valor nuevo aterrice en el DOM. Es un `ref`
  // y no estado porque no se pinta: en `useState` sería un render extra por inserción.
  const pendingSelection = useRef<{ readonly start: number; readonly end: number } | null>(null);
  const baseId = useId();

  const status = entry?.status ?? 'clean';

  // Ajustes de estado durante el render, no en un efecto: al pasar de un documento a otro sin
  // desmontar (la ruta es la misma), lo que se ve tiene que volver a «cargando» en el mismo
  // render, no un fotograma después mostrando todavía el documento anterior.
  if (id !== requestedId) {
    setRequestedId(id);
    setLoad({ status: 'loading' });
    setConflictDismissed(false);
  }

  // Un conflicto resuelto (o uno nuevo) tiene que volver a abrir su diálogo: sin esto, cerrarlo
  // una vez lo dejaría cerrado para siempre en este documento.
  if (conflictDismissed && status !== 'conflict') {
    setConflictDismissed(false);
  }

  useEffect(() => {
    if (id === undefined) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await useEditorStore.getState().open(id);

        if (!cancelled) {
          setLoad({ status: 'ready' });
        }
      } catch (cause) {
        if (cancelled) {
          return;
        }

        // Un `404` significa que el árbol que tiene el cliente ya era mentira: además de avisar,
        // se recarga, para que la barra lateral deje de ofrecer un documento que no existe.
        if (cause instanceof ApiError && cause.statusCode === 404) {
          setLoad({ status: 'missing' });
          void useWorkspaceStore.getState().loadTree();

          return;
        }

        setLoad({ status: 'error', message: describeDocumentError(cause) });
      }
    })();

    return () => {
      cancelled = true;

      // AC-28: salir del documento fuerza lo pendiente. `flush` descarta la entrada si sale bien y
      // la conserva **con su borrador** si falla, y en ningún caso bloquea la navegación.
      void useEditorStore.getState().flush(id);
    };
  }, [id]);

  // `Ctrl`/`Cmd`+`S` es un atajo **añadido** (hay un botón de guardar visible), y se escucha en la
  // ventana para que funcione con el foco en cualquier parte de la página, no solo en el textarea.
  useEffect(() => {
    if (id === undefined) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') {
        return;
      }

      // Sin esto el navegador abre su diálogo de guardar página, que es lo último que quiere quien
      // está escribiendo. `saveNow` cancela el debounce pendiente y no emite nada si está limpio.
      event.preventDefault();
      void useEditorStore.getState().saveNow(id);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [id]);

  /**
   * Restaura la selección tras una inserción de la paleta (AC-21).
   *
   * React documenta que a un `<textarea>` controlado al que se le asigna un valor distinto de
   * `e.target.value` se le va el caret al final. Por eso esto va aquí y **no** dentro del manejador
   * del clic: en el manejador el valor nuevo todavía no ha aterrizado y `setSelectionRange` mediría
   * sobre el texto anterior. `useLayoutEffect` corre tras el commit y antes de pintar, así que la
   * persona nunca llega a ver el cursor al final.
   *
   * Sin array de dependencias y protegido por el `ref`, que se **consume**: solo hace algo cuando
   * hay una selección pendiente. Un array sobre `entry.draft` también dispararía al teclear.
   */
  useLayoutEffect(() => {
    const target = pendingSelection.current;

    if (target === null) {
      return;
    }

    pendingSelection.current = null;

    const node = textareaRef.current;

    if (node === null) {
      return;
    }

    // El `focus()` va antes que el rango y no es adorno: es lo que hace que AC-22 —documento
    // vacío, el área de escritura sin haber tenido nunca el foco— acabe donde tiene que acabar.
    node.focus();
    node.setSelectionRange(target.start, target.end);
  });

  const unsaved = entry !== undefined && status !== 'clean';

  // AC-29. La segunda mitad —**retirarlo**— es la que importa: dejarlo puesto avisa de que «vas a
  // perder cambios» sobre un documento que ya está guardado, y esa alarma falsa enseña a
  // ignorarla. Es una red de seguridad y no el mecanismo: el mecanismo es el guardado automático.
  useEffect(() => {
    if (!unsaved) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unsaved]);

  const title = summary?.title ?? 'Documento';

  const ancestors = useMemo(
    () => directoryPathOf(directoriesById, summary?.directoryId ?? null),
    [directoriesById, summary],
  );

  // Los fallos van **antes** que el estado de carga: cuando la lectura falla no hay entrada en el
  // store, y comprobar la entrada primero dejaría un «Cargando el documento…» eterno sobre un
  // documento que ya se sabe que no va a llegar.
  if (load.status === 'missing' || load.status === 'error') {
    return (
      <p
        role="alert"
        className="max-w-prose rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        {load.status === 'missing' ? 'Este documento ya no existe.' : load.message}
      </p>
    );
  }

  // La entrada puede faltar con la carga ya resuelta: al desmontar, `flush` la descarta.
  if (load.status === 'loading' || entry === undefined) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Cargando el documento…
      </p>
    );
  }

  const documentId = id ?? '';
  const viewMode = entry.viewMode;
  const tabId = (mode: ViewMode): string => `${baseId}-tab-${mode}`;
  const panelId = `${baseId}-panel-${viewMode}`;

  const selectMode = (mode: ViewMode): void => {
    useEditorStore.getState().setViewMode(documentId, mode);
  };

  /**
   * Aplicar un elemento de la paleta (AC-20, AC-21). Tres pasos y ninguno más: se lee dónde está el
   * cursor, se pide al núcleo el texto resultante y se deja el borrador por **el único camino** que
   * cambia el contenido, `setDraft`. Así la inserción hereda el debounce, la coalescencia y el
   * marcado de sucio de la `003` sin una sola rama nueva.
   *
   * El texto de partida es `entry.draft` y no `node.value`: el store es quien manda, y leer del DOM
   * abriría la puerta a insertar sobre un valor que React está a punto de pisar.
   *
   * Tampoco hay rama por el límite de caracteres (AC-23): quien reacciona es el contador que ya
   * existe y el rechazo del servidor. Dos formas distintas de impedir lo mismo es cómo se produce
   * el aviso que no coincide con la realidad.
   */
  const insertElement = (element: PaletteElement): void => {
    const node = textareaRef.current;

    if (node === null) {
      return;
    }

    const next = applyPaletteElement(element, {
      text: entry.draft,
      selectionStart: node.selectionStart,
      selectionEnd: node.selectionEnd,
    });

    pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd };
    useEditorStore.getState().setDraft(documentId, next.text);
  };

  /**
   * Atajos `Ctrl`/`Cmd`+`B`/`I`/`K` (AC-28).
   *
   * Van **en el área de escritura** y no en la ventana, al revés que el `Ctrl`+`S` de la `003`, que
   * sigue donde estaba y no se toca. La diferencia es deliberada: guardar es una acción de la
   * página entera, mientras que envolver texto solo significa algo donde se está escribiendo. Los
   * tres pisan atajos del navegador (`Ctrl`+`B` abre los marcadores en Firefox, `Ctrl`+`K` enfoca
   * la búsqueda en Chrome), así que fuera del `<textarea>` se dejan intactos.
   *
   * Qué tecla hace qué sale del **catálogo**, del campo `shortcut`: añadir un atajo es añadir un
   * dato en su fila, no una rama aquí.
   */
  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const key = event.key.toLowerCase();
    const element = MARKDOWN_PALETTE.find((candidate) => candidate.shortcut === key);

    if (element === undefined) {
      return;
    }

    event.preventDefault();
    insertElement(element);
  };

  const handleTablistKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (step === 0) {
      return;
    }

    event.preventDefault();

    const index = VIEW_MODES.indexOf(viewMode);
    const next = VIEW_MODES[(index + step + VIEW_MODES.length) % VIEW_MODES.length];

    if (next === undefined) {
      return;
    }

    // La selección sigue al foco (activación automática): con dos pestañas y un panel que ya está
    // en memoria, exigir un `Enter` extra solo añade una pulsación.
    selectMode(next);
    tabsRef.current[next]?.focus();
  };

  const remaining = MAX_DOCUMENT_CONTENT_CHARS - entry.draft.length;

  return (
    <article className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <nav aria-label="Ruta del documento">
          <ol className="flex flex-wrap items-center text-sm text-slate-500">
            {ancestors.map((directory) => (
              <li key={directory.id} className={STEP_CLASS}>
                {directory.name}
              </li>
            ))}

            <li aria-current="page" className={`${STEP_CLASS} text-slate-700`}>
              {title}
            </li>
          </ol>
        </nav>

        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Modo de vista"
          onKeyDown={handleTablistKeyDown}
          className="flex gap-1 rounded-md border border-slate-200 p-0.5"
        >
          {VIEW_MODES.map((mode) => {
            const selected = mode === viewMode;

            return (
              <button
                key={mode}
                type="button"
                role="tab"
                id={tabId(mode)}
                ref={(node) => {
                  tabsRef.current[mode] = node;
                }}
                aria-selected={selected}
                // Solo la pestaña activa apunta a un panel: el otro no está en el documento, y una
                // referencia a un id inexistente no le sirve a nadie.
                aria-controls={selected ? panelId : undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  selectMode(mode);
                }}
                className={`min-h-8 rounded px-3 py-1 text-sm font-medium outline-solid outline-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                  selected ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {VIEW_MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {entry.draft.length < CONTENT_COUNTER_THRESHOLD ? null : (
            <p className={remaining < 0 ? 'text-sm text-red-700' : 'text-sm text-slate-500'}>
              {remaining < 0
                ? `Te sobran ${(-remaining).toLocaleString('es-ES')} caracteres`
                : `Quedan ${remaining.toLocaleString('es-ES')} caracteres`}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              void useEditorStore.getState().saveNow(documentId);
            }}
            className="min-h-9 rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 outline-solid outline-0 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Guardar
          </button>

          <SaveStatus
            status={status}
            error={entry.error}
            onResolveConflict={
              status === 'conflict' && conflictDismissed
                ? () => {
                    setConflictDismissed(false);
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/*
        Va **antes** del panel y solo en modo texto (AC-19, AC-26): quien recorra la página con
        lector de pantalla o con el tabulador encuentra la paleta antes de entrar a escribir, y no
        después de haber pasado por dentro del área de texto.
      */}
      {viewMode === 'text' ? <MarkdownPalette onInsert={insertElement} /> : null}

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(viewMode)}
        // La vista previa puede no tener nada enfocable dentro, así que entra en el orden de
        // tabulación para poder leerla con el teclado; el modo texto ya ofrece su textarea.
        tabIndex={viewMode === 'preview' ? 0 : -1}
        className="min-h-0 flex-1 outline-solid outline-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        {viewMode === 'text' ? (
          <textarea
            ref={textareaRef}
            aria-label={`Contenido de «${title}» en markdown`}
            value={entry.draft}
            spellCheck={false}
            onKeyDown={handleTextareaKeyDown}
            onChange={(event) => {
              // Único camino por el que cambia el contenido (decisión 10 del plan): la paleta de
              // la spec `004` llamará a la misma acción y heredará el debounce y la coalescencia.
              useEditorStore.getState().setDraft(documentId, event.target.value);
            }}
            className="h-full min-h-96 w-full resize-none rounded border border-slate-200 bg-white p-4 font-mono text-sm text-slate-800 outline-solid outline-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
        ) : (
          // El **borrador**, no lo último guardado: se previsualiza lo que se está escribiendo.
          <MarkdownPreview markdown={entry.draft} />
        )}
      </div>

      {status === 'conflict' && !conflictDismissed ? (
        <ConflictDialog
          busy={false}
          onKeepMine={() => {
            void useEditorStore.getState().resolveKeepMine(documentId);
          }}
          onTakeServer={() => {
            void useEditorStore.getState().resolveTakeServer(documentId);
          }}
          onDismiss={() => {
            setConflictDismissed(true);
          }}
        />
      ) : null}
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
