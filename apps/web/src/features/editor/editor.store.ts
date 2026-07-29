import { create } from 'zustand';

import {
  AUTOSAVE_DEBOUNCE_MS,
  DOCUMENT_CONTENT_CONFLICT_CODE,
  UNREACHABLE_SAVE_MESSAGE,
} from './editor.constants';
import { ApiError, getDocument, saveDocumentContent } from '../../shared/api/http';

/**
 * Estado del editor (spec `003`, AC-16…AC-21, AC-28, AC-30).
 *
 * Indexado por **id de documento** y no en un singleton «documento actual» (plan §7): la spec `005`
 * va a cambiar la política de desalojo de este diccionario —hoy, como mucho la entrada del
 * documento abierto— pero no su forma, y el bucle de guardado recibe siempre el `id` como
 * argumento para no depender de cuál está en pantalla.
 *
 * Nada de esto persiste en `localStorage` ni en `sessionStorage`: el borrador vive en memoria,
 * igual que la sesión (spec `001`) y que el árbol (spec `002`).
 */

export type SaveStatus =
  /** Lo que se ve es lo que el servidor confirmó. */
  | 'clean'
  /** Hay cambios sin guardar y un guardado programado. */
  | 'dirty'
  /** Petición en vuelo. */
  | 'saving'
  /** `409`: el documento cambió por debajo. Lo resuelve la persona, nunca el store. */
  | 'conflict'
  /** El servidor respondió y dijo que no (`400`, `404`, `413`, `429`). */
  | 'rejected'
  /** No hubo respuesta utilizable: red caída, `5xx`, o un cuerpo que incumple el contrato. */
  | 'unreachable';

/**
 * Los dos modos excluyentes del conmutador (AC-22). Vive **por documento** y no en la página: con
 * la definición de split view que fija `CLAUDE.md` —texto y vista previa del **mismo** documento—
 * el modo activo es una propiedad del documento, así que la spec `005` lo conserva al volver a su
 * pestaña sin trabajo extra. En un `useState` de la página se perdería en cada montaje.
 */
export type ViewMode = 'text' | 'preview';

export interface EditorEntry {
  /** Lo último que el servidor confirmó. */
  readonly savedContent: string;
  /** Lo que ve la persona. **Nunca** se descarta ante un error (AC-19). */
  readonly draft: string;
  /** Token de concurrencia: el `contentVersion` que se enviará en el guardado siguiente. */
  readonly contentVersion: number;
  readonly status: SaveStatus;
  /** Modo del conmutador de este documento. Estado de interfaz: no viaja al servidor. */
  readonly viewMode: ViewMode;
  /** Mensaje para la persona. En `rejected` es el del servidor; en `unreachable`, el nuestro. */
  readonly error: string | null;
  /** Solo en `conflict`: lo que hay en el servidor, ya leído. */
  readonly serverContent: string | null;
  /**
   * Solo en `conflict`: la versión que acompaña a `serverContent`.
   *
   * Va con él y no aparte porque adoptar el texto del servidor **sin** su versión garantiza que el
   * guardado siguiente vuelva a chocar: `resolveTakeServer` dejaría el editor limpio y la primera
   * tecla lo devolvería al mismo `409`. Es una adición a la forma de `plan.md` §7, que solo
   * declaraba `serverContent`.
   */
  readonly serverVersion: number | null;
}

export interface EditorState {
  readonly entries: Readonly<Record<string, EditorEntry>>;

  /** Lee el documento y lo deja limpio. Respeta un borrador sin guardar de una visita anterior. */
  open: (id: string) => Promise<void>;
  /** Descarta la entrada sin guardar nada. Para forzar el guardado antes, `flush`. */
  close: (id: string) => void;
  /** **Único** punto por el que cambia el contenido (spec §4, para la paleta de la `004`). */
  setDraft: (id: string, draft: string) => void;
  /** Guardado explícito (`Ctrl`+`S`): inmediato, y cancela el debounce pendiente (AC-27). */
  saveNow: (id: string) => Promise<void>;
  /** Al desmontar (AC-28): fuerza lo pendiente; si sale bien descarta la entrada, si no la conserva. */
  flush: (id: string) => Promise<void>;
  /** «Conservar mi versión»: relee, adopta la versión nueva y reenvía el borrador local (AC-20). */
  resolveKeepMine: (id: string) => Promise<void>;
  /** «Descartar mis cambios»: adopta lo del servidor, sin emitir ningún `PUT` (AC-20). */
  resolveTakeServer: (id: string) => Promise<void>;
  /** Conmutador texto/vista previa **de ese documento** (AC-22). */
  setViewMode: (id: string, viewMode: ViewMode) => void;
}

/**
 * Temporizadores del debounce, uno por documento. Fuera del estado a propósito: un identificador de
 * `setTimeout` no se pinta, y meterlo en el store obligaría a que cada tecla provocara un render.
 */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Guardados en vuelo, uno por documento. Es lo que hace que la coalescencia sea una **invariante**
 * y no una coincidencia: mientras hay una promesa aquí no se puede empezar otra petición, y el
 * guardado encolado lo lanza el que está corriendo, al terminar.
 */
const savesInFlight = new Map<string, Promise<void>>();

function cancelDebounce(id: string): void {
  const timer = debounceTimers.get(id);

  if (timer !== undefined) {
    clearTimeout(timer);
    debounceTimers.delete(id);
  }
}

/**
 * Traduce un fallo del guardado a una de las **tres** ramas de AC-19.
 *
 * Que sean tres y no una es la respuesta al riesgo #15 de la spec `002`: allí el aviso genérico
 * presentaba igual un fallo del cliente y uno del servidor, y eso ocultó un defecto real de caché
 * hasta que alguien instrumentó. `rejected` enseña el mensaje del servidor —que ya está redactado
 * para leerse— y `unreachable` uno propio, porque cuando no hubo respuesta no hay nada del
 * servidor que enseñar y fingir que sí lo hay es precisamente el error que se está evitando.
 */
function classifySaveFailure(cause: unknown): {
  readonly status: SaveStatus;
  readonly error: string;
} {
  if (!(cause instanceof ApiError)) {
    return { status: 'unreachable', error: UNREACHABLE_SAVE_MESSAGE };
  }

  if (cause.code === DOCUMENT_CONTENT_CONFLICT_CODE) {
    return { status: 'conflict', error: cause.message };
  }

  // `statusCode: 0` lo pone el cliente HTTP cuando la petición no llegó a responder **y** cuando la
  // respuesta incumple el contrato: en los dos casos no hay nada del servidor en lo que confiar.
  if (cause.statusCode === 0 || cause.statusCode >= 500) {
    return { status: 'unreachable', error: UNREACHABLE_SAVE_MESSAGE };
  }

  return { status: 'rejected', error: cause.message };
}

export const useEditorStore = create<EditorState>()((set, get) => {
  const entryOf = (id: string): EditorEntry | undefined => get().entries[id];

  const patch = (id: string, changes: Partial<EditorEntry>): void => {
    set((state) => {
      const current = state.entries[id];

      // La entrada pudo cerrarse mientras había una petición en vuelo. Volver a crearla aquí
      // resucitaría un documento que ya no está abierto.
      if (current === undefined) {
        return {};
      }

      return { entries: { ...state.entries, [id]: { ...current, ...changes } } };
    });
  };

  const drop = (id: string): void => {
    set((state) => {
      const { [id]: _removed, ...rest } = state.entries;

      return { entries: rest };
    });
  };

  /**
   * Un intento de guardado, y solo uno. No reintenta **nada**: un `429` reintentado es cómo un
   * aviso de cupo se convierte en un bloqueo (AC-21), y un `409` reintentado pisaría el trabajo del
   * otro, que es justo lo que la versión existe para impedir.
   */
  const attemptSave = async (id: string): Promise<void> => {
    const entry = entryOf(id);

    if (entry === undefined) {
      return;
    }

    cancelDebounce(id);

    if (entry.draft === entry.savedContent) {
      if (entry.status === 'dirty') {
        patch(id, { status: 'clean', error: null });
      }

      return;
    }

    const sent = entry.draft;

    patch(id, { status: 'saving', error: null });

    try {
      const saved = await saveDocumentContent(id, sent, entry.contentVersion);
      const after = entryOf(id);

      if (after === undefined) {
        return;
      }

      // Adoptar el `contentVersion` devuelto no es cosmético: es lo único que hace que el guardado
      // siguiente no reciba un `409` por mandar el token que acaba de quedar viejo.
      patch(id, {
        savedContent: sent,
        contentVersion: saved.contentVersion,
        status: after.draft === sent ? 'clean' : 'dirty',
        error: null,
        serverContent: null,
        serverVersion: null,
      });
    } catch (cause) {
      await recordFailure(id, cause);
    }
  };

  /**
   * Deja el fallo en la entrada **sin tocar el borrador** y, si es un conflicto, lee el documento
   * del servidor para que `resolveTakeServer` pueda resolverlo sin red.
   *
   * Si esa lectura falla, el estado resultante es `unreachable` y no `conflict`: un conflicto sin
   * el texto del servidor no se puede ofrecer a resolver, y decir «conflicto» sin poder enseñar
   * contra qué sería el aviso genérico que AC-19 existe para evitar.
   */
  const recordFailure = async (id: string, cause: unknown): Promise<void> => {
    const failure = classifySaveFailure(cause);

    patch(id, failure);

    if (failure.status !== 'conflict') {
      return;
    }

    try {
      const current = await getDocument(id);

      if (entryOf(id)?.status === 'conflict') {
        patch(id, { serverContent: current.content, serverVersion: current.contentVersion });
      }
    } catch {
      patch(id, {
        status: 'unreachable',
        error: UNREACHABLE_SAVE_MESSAGE,
        serverContent: null,
        serverVersion: null,
      });
    }
  };

  /**
   * Guardado con coalescencia (AC-17). Mientras hay uno en vuelo **no** se empieza otro: quien está
   * corriendo comprueba al terminar si el borrador cambió y, si cambió, manda uno más. Así diez
   * pulsaciones durante un guardado producen **una** petición extra y no diez, y la cola no puede
   * tener nunca dos elementos.
   */
  const requestSave = (id: string): Promise<void> => {
    const running = savesInFlight.get(id);

    if (running !== undefined) {
      return running;
    }

    const run = (async () => {
      // Bucle y no recursión: cada vuelta manda el **último** texto conocido, así que solo continúa
      // mientras alguien siga escribiendo, y para en cuanto el guardado falla (el estado deja de
      // ser `dirty`), que es lo que impide el reintento automático de AC-21.
      for (;;) {
        await attemptSave(id);

        if (entryOf(id)?.status !== 'dirty') {
          return;
        }
      }
    })().finally(() => {
      savesInFlight.delete(id);
    });

    savesInFlight.set(id, run);

    return run;
  };

  const scheduleSave = (id: string): void => {
    cancelDebounce(id);

    debounceTimers.set(
      id,
      setTimeout(() => {
        debounceTimers.delete(id);
        void requestSave(id);
      }, AUTOSAVE_DEBOUNCE_MS),
    );
  };

  return {
    entries: {},

    open: async (id) => {
      const existing = entryOf(id);

      // Volver a un documento cuyo guardado falló tiene que devolver **el texto sin guardar**, no
      // el del servidor (AC-28). Releer aquí sería la forma silenciosa de perderlo.
      if (existing !== undefined && existing.draft !== existing.savedContent) {
        return;
      }

      const document = await getDocument(id);

      set((state) => ({
        entries: {
          ...state.entries,
          [id]: {
            savedContent: document.content,
            draft: document.content,
            contentVersion: document.contentVersion,
            status: 'clean',
            viewMode: 'text',
            error: null,
            serverContent: null,
            serverVersion: null,
          },
        },
      }));
    },

    close: (id) => {
      cancelDebounce(id);
      drop(id);
    },

    setDraft: (id, draft) => {
      const entry = entryOf(id);

      if (entry === undefined || entry.draft === draft) {
        return;
      }

      if (draft === entry.savedContent) {
        // Deshacer hasta el original no es un cambio pendiente: además de volver a `clean`, cancela
        // el guardado programado, para no mandar una petición que no cambia nada.
        cancelDebounce(id);
        patch(id, { draft, status: 'clean', error: null });

        return;
      }

      patch(id, { draft, status: 'dirty', error: null });
      scheduleSave(id);
    },

    saveNow: async (id) => {
      cancelDebounce(id);
      await requestSave(id);
    },

    flush: async (id) => {
      cancelDebounce(id);

      if (entryOf(id) === undefined) {
        return;
      }

      await requestSave(id);

      // Solo se descarta si acabó limpio. Si falló, la entrada se conserva **con su borrador**:
      // volver al documento tiene que restaurar lo que la persona escribió (AC-28).
      if (entryOf(id)?.status === 'clean') {
        drop(id);
      }
    },

    resolveKeepMine: async (id) => {
      const entry = entryOf(id);

      if (entry === undefined) {
        return;
      }

      const mine = entry.draft;

      patch(id, { status: 'saving', error: null });

      try {
        // Se **relee** aunque el conflicto ya trajera la versión: entre el `409` y la decisión de la
        // persona pasa tiempo indeterminado, y guardar contra una versión adivinada volvería a
        // chocar (AC-20).
        const current = await getDocument(id);

        patch(id, {
          savedContent: current.content,
          contentVersion: current.contentVersion,
          draft: mine,
          status: mine === current.content ? 'clean' : 'dirty',
          error: null,
          serverContent: null,
          serverVersion: null,
        });
      } catch (cause) {
        await recordFailure(id, cause);

        return;
      }

      await requestSave(id);
    },

    resolveTakeServer: async (id) => {
      const entry = entryOf(id);

      if (entry === undefined || entry.serverContent === null || entry.serverVersion === null) {
        return;
      }

      // Ni un `PUT` ni un `GET`: el texto y su versión se leyeron al detectar el conflicto, así que
      // descartar los cambios propios no toca la red.
      cancelDebounce(id);
      patch(id, {
        savedContent: entry.serverContent,
        draft: entry.serverContent,
        contentVersion: entry.serverVersion,
        status: 'clean',
        error: null,
        serverContent: null,
        serverVersion: null,
      });
    },

    // `patch` ignora los documentos que no están abiertos, así que pintar no puede resucitar una
    // entrada que se cerró.
    setViewMode: (id, viewMode) => {
      patch(id, { viewMode });
    },
  };
});
