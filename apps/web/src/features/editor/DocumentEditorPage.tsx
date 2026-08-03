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

/**
 * Orden de las pestañas, que es también el orden en que las recorren las flechas.
 *
 * Se **exporta** para que los tests afirmen los rótulos del conmutador contra la enumeración y no
 * contra un literal (spec `005`, AC-14): así el caso y la interfaz se ponen de acuerdo solos cuando
 * la enumeración cambie, y no queda ningún recuento escrito a mano que actualizar en dos sitios.
 */
export const VIEW_MODES: readonly ViewMode[] = ['text', 'preview', 'split'];

/**
 * Las teclas que reclama el historial, con `Ctrl`/`Cmd` siempre (spec `006`, AC-23, AC-24).
 *
 * Se **exporta** para que AC-25 la cruce con el catálogo de la paleta y el cruce salga vacío: añadir
 * mañana un elemento con `shortcut: 'z'` rompería `Ctrl`+`Z` en silencio, y el recuento vive en estas
 * dos enumeraciones y en **ningún literal**.
 *
 * `y` está por Windows, donde rehacer se ha teclado siempre así. **Ninguna suite de este repositorio
 * puede comprobar que Firefox sobre Windows entregue `Ctrl`+`Y` a la página** antes de hacer lo suyo:
 * `playwright.config.ts` tiene un único *project*, Chromium. Lo que AC-24 afirma es que **nuestro
 * manejador** responde, no que el navegador lo deje llegar (`006/spec.md` §9.3).
 */
export const HISTORY_SHORTCUT_KEYS: readonly string[] = ['z', 'y'];

/**
 * Los dos controles visibles del historial. Enumeración y no dos bloques copiados: el rótulo, el atajo
 * que se anuncia y el lado de la pila que los habilita viven en **una** fila cada uno.
 */
const HISTORY_CONTROLS = [
  { direction: 'undo', label: 'Deshacer', shortcut: 'Ctrl+Z' },
  { direction: 'redo', label: 'Rehacer', shortcut: 'Ctrl+Shift+Z' },
] as const;

export const VIEW_MODE_LABELS: Readonly<Record<ViewMode, string>> = {
  text: 'Texto',
  preview: 'Vista previa',
  split: 'Dividida',
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
  const pendingSelection = useRef<{
    readonly start: number;
    readonly end: number;
    /**
     * Si además hay que **llevar el foco** al área de escritura. La paleta y los atajos dicen que sí
     * —el foco ya está ahí o tiene que volver ahí—; los botones de historial dicen que **no**, y ese
     * `false` es AC-30 entero: enfocar desde el botón haría que la segunda pulsación de `Enter`
     * escribiera un salto de línea en el documento.
     */
    readonly focus: boolean;
  } | null>(null);
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

    // El `focus()` va antes que el rango y no es adorno: es lo que hace que AC-22 de la `004`
    // —documento vacío, el área de escritura sin haber tenido nunca el foco— acabe donde tiene que
    // acabar. Desde la `006` es **condicional**: ver el comentario de `pendingSelection`.
    if (target.focus) {
      node.focus();
    }

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
      <p role="alert" className="max-w-prose bg-tinta px-3 py-2 text-sm text-sup-base">
        {load.status === 'missing' ? 'Este documento ya no existe.' : load.message}
      </p>
    );
  }

  // La entrada puede faltar con la carga ya resuelta: al desmontar, `flush` la descarta.
  if (load.status === 'loading' || entry === undefined) {
    return (
      // El `aria-label` es de la `005` (AC-26) y no cambia ningún comportamiento: la tira de
      // pestañas se pinta **mientras** el documento carga, así que en ese instante hay dos regiones
      // vivas en la página y esta era la anónima. Con dos `role="status"` sin distinguir, quien
      // recorre la lista de regiones con un lector de pantalla no sabe cuál acaba de hablar.
      <p role="status" aria-label="Carga del documento" className="text-sm text-tinta-tenue">
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

    pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd, focus: true };
    // Un gesto único es **un** paso de deshacer, nunca fundido con el tecleo de al lado; y las dos
    // selecciones van exactas porque aquí la derivación del store no valdría: envolver texto en
    // negrita deja un cursor donde había una selección, y deshacer tiene que devolver la selección.
    useEditorStore.getState().setDraft(documentId, next.text, {
      mergeable: false,
      caretBefore: { start: node.selectionStart, end: node.selectionEnd },
      caretAfter: { start: next.selectionStart, end: next.selectionEnd },
    });
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

    // **El historial va primero**, y el orden no es indiferente: AC-25 impide que un elemento del
    // catálogo reclame `z` o `y`, y este orden es el cinturón por si alguna vez esa guarda cae.
    if (HISTORY_SHORTCUT_KEYS.includes(key)) {
      // Sin esto correría **además** el deshacer nativo del navegador, que desde la primera escritura
      // programática ya no describe el historial real del documento. Retirar esa red de seguridad es
      // deliberado: la red ya mentía (`006/spec.md`, riesgo #3).
      event.preventDefault();

      const store = useEditorStore.getState();
      const caret = key === 'y' || event.shiftKey ? store.redo(documentId) : store.undo(documentId);

      if (caret !== null) {
        // El mismo mecanismo que la paleta (`004/plan.md` §4.3): la selección se aplica **después** de
        // que el valor nuevo aterrice en el DOM, porque React manda el caret al final de un control
        // controlado al que se le asigna un valor distinto de `e.target.value`.
        pendingSelection.current = { start: caret.start, end: caret.end, focus: true };
      }

      return;
    }

    const element = MARKDOWN_PALETTE.find((candidate) => candidate.shortcut === key);

    if (element === undefined) {
      return;
    }

    event.preventDefault();
    insertElement(element);
  };

  /**
   * Un paso de historial pedido **desde un botón**, no desde el teclado.
   *
   * La única diferencia con el atajo es `focus: false`, y es la que sostiene AC-30: el control
   * devuelve la selección al área de escritura pero **deja el foco donde estaba**, que es en el propio
   * botón. Enfocar aquí convertiría la segunda pulsación de `Enter` en un salto de línea dentro del
   * documento — un defecto que solo aparece navegando con teclado, o sea con el público exacto para el
   * que existe el botón.
   */
  const stepHistory = (direction: 'undo' | 'redo'): void => {
    const store = useEditorStore.getState();
    const caret = direction === 'undo' ? store.undo(documentId) : store.redo(documentId);

    if (caret !== null) {
      pendingSelection.current = { start: caret.start, end: caret.end, focus: false };
    }
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

  // Las dos mitades del panel, definidas **una vez** y colocadas de tres formas distintas: en
  // `split` no hay un editor nuevo ni una vista previa nueva, es la misma pareja de la `003` puesta
  // lado a lado (`005/spec.md` §1.2). El texto que se edita es el que se previsualiza.
  const editorTextarea = (
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
      className="h-full min-h-96 w-full resize-none border border-hair-control bg-sup-base p-4 font-mono text-sm text-tinta outline-solid outline-0 focus-visible:foco-cromo"
    />
  );

  // El **borrador**, no lo último guardado: se previsualiza lo que se está escribiendo (AC-16).
  const preview = <MarkdownPreview markdown={entry.draft} />;

  return (
    <article
      className={`mx-auto flex h-full flex-col gap-4 ${
        // Dos columnas dentro de 768 px son dos columnas inservibles (`plan.md` decisión 9): el
        // ancho de la página es **función del modo**, y AC-19 afirma en el navegador que crece.
        viewMode === 'split' ? 'max-w-6xl' : 'max-w-3xl'
      }`}
    >
      <header className="flex flex-col gap-1">
        <nav aria-label="Ruta del documento">
          <ol className="flex flex-wrap items-center text-sm text-tinta-tenue">
            {ancestors.map((directory) => (
              <li key={directory.id} className={STEP_CLASS}>
                {directory.name}
              </li>
            ))}

            <li aria-current="page" className={`${STEP_CLASS} text-tinta-secundaria`}>
              {title}
            </li>
          </ol>
        </nav>

        <h2 className="text-xl font-semibold text-tinta">{title}</h2>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Modo de vista"
          onKeyDown={handleTablistKeyDown}
          className="flex gap-1 border border-hair-control p-0.5"
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
                // La vista elegida NO es cromo. Cromo dice «el presente» —el objeto sobre el que
                // actúa la siguiente tecla— y esto es un modo de ver, más cercano al «filtro
                // aplicado» que `04-color.md` §8 saca expresamente del presupuesto. Se dice con
                // inversión: masa de tinta y texto en papel, el mismo recurso que el elemento de la
                // paleta recién usado. Gastar cromo aquí dejaría el presupuesto sin sitio para la
                // acción primaria de un diálogo abierto sobre esta misma pantalla.
                className={`min-h-8 px-3 py-1 text-sm font-medium outline-solid outline-0 focus-visible:foco-cromo ${
                  selected
                    ? 'bg-tinta font-black text-sup-base'
                    : 'text-tinta-secundaria hover:bg-tinta hover:text-sup-base'
                }`}
              >
                {VIEW_MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {entry.draft.length < CONTENT_COUNTER_THRESHOLD ? null : (
            <p className={remaining < 0 ? 'text-sm text-tinta' : 'text-sm text-tinta-tenue'}>
              {remaining < 0
                ? `Te sobran ${(-remaining).toLocaleString('es-ES')} caracteres`
                : `Quedan ${remaining.toLocaleString('es-ES')} caracteres`}
            </p>
          )}

          {/*
            Solo donde se escribe —`text` y `split`—, igual que la paleta (AC-29): deshacer es una
            acción de edición, y en vista previa no se edita. `disabled` y no `aria-disabled`: el
            estado tiene que ser el de verdad, y es además **la única señal** que distingue «se acabó
            el historial» de «esto está roto» cuando la cota de memoria desaloja los pasos viejos.
          */}
          {viewMode === 'text' || viewMode === 'split' ? (
            <div className="flex items-center gap-1">
              {HISTORY_CONTROLS.map((control) => (
                <button
                  key={control.direction}
                  type="button"
                  // El atajo va **en el nombre accesible**, como la «×» de la `005` dice «Supr para
                  // cerrar»: un atajo que no se anuncia en ninguna parte solo lo usa quien ya lo sabía.
                  aria-label={`${control.label} · ${control.shortcut}`}
                  disabled={
                    (control.direction === 'undo' ? entry.undo.past : entry.undo.future).length ===
                    0
                  }
                  onClick={() => {
                    stepHistory(control.direction);
                  }}
                  className="min-h-9 min-w-9 border border-hair-control px-3 py-1 text-sm font-medium text-tinta-secundaria outline-solid outline-0 hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo disabled:cursor-not-allowed disabled:border-hair-fila disabled:text-tinta-tenue disabled:hover:bg-transparent"
                >
                  {control.label}
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void useEditorStore.getState().saveNow(documentId);
            }}
            className="min-h-9 border border-hair-control px-3 py-1 text-sm font-medium text-tinta-secundaria outline-solid outline-0 hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo"
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
        Va **antes** del panel y solo donde se escribe —`text` y `split`— (`004` AC-19 y AC-26,
        `005` AC-18): quien recorra la página con lector de pantalla o con el tabulador encuentra la
        paleta antes de entrar a escribir, y no después de haber pasado por dentro del área de
        texto. **Una sola vez** y fuera de la retícula: con vista dividida hay **un** panel de texto,
        así que hay una paleta, y ponerla dentro de la columna movería el orden de tabulación que
        fija AC-27.
      */}
      {viewMode === 'text' || viewMode === 'split' ? (
        <MarkdownPalette onInsert={insertElement} />
      ) : null}

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(viewMode)}
        // La vista previa puede no tener nada enfocable dentro, así que entra en el orden de
        // tabulación para poder leerla con el teclado; el modo texto ya ofrece su textarea.
        tabIndex={viewMode === 'preview' ? 0 : -1}
        className="min-h-0 flex-1 outline-solid outline-0 focus-visible:foco-cromo"
      >
        {viewMode === 'text' ? (
          editorTextarea
        ) : viewMode === 'preview' ? (
          preview
        ) : (
          // Un **solo** `role="tabpanel"` también aquí (`plan.md` decisión 10): el patrón *tabs*
          // tiene un panel visible por definición y `aria-controls` apunta a uno, así que el modo
          // dividido es «el panel de la vista dividida, que dentro tiene dos regiones con nombre».
          // Dos `tabpanel` a la vez sería inventarse una variante del patrón.
          <div className="grid h-full min-h-0 gap-4 md:grid-cols-2">
            <section aria-label="Texto" className="flex min-h-0 flex-col">
              {editorTextarea}
            </section>

            {/*
              Sin `overflow-auto`: un contenedor que se desplaza y al que no llega el foco no lo
              puede leer quien va con el teclado (WCAG 2.1.1). Aquí se desplaza el `<main>` del
              shell, que es lo que ya pasa hoy con la vista previa a pantalla completa.
            */}
            <section aria-label="Vista previa" className="min-h-0">
              {preview}
            </section>
          </div>
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
  "before:mx-1.5 before:text-tinta-tenue before:content-['/'] first:before:content-none";

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
