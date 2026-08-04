import { create } from 'zustand';

import {
  AUTOSAVE_DEBOUNCE_MS,
  DOCUMENT_CONTENT_CONFLICT_CODE,
  UNREACHABLE_SAVE_MESSAGE,
} from './editor.constants';
import {
  clearHistory,
  EMPTY_HISTORY,
  recordWrite,
  redoStep,
  undoStep,
  type Caret,
  type UndoState,
} from './undo-history';
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
 * Los **tres** modos excluyentes del conmutador (`003` AC-22, `005` AC-14). Vive **por documento** y
 * no en la página: con la definición de split view que fija `CLAUDE.md` —texto y vista previa del
 * **mismo** documento— el modo activo es una propiedad del documento, así que la spec `005` lo
 * conserva al volver a su pestaña sin trabajo extra (AC-17). En un `useState` de la página se
 * perdería en cada montaje.
 *
 * `'split'` es un valor **más** de la enumeración y no un booleano aparte (`005/plan.md` decisión
 * 6): con `viewMode` + `split: boolean`, «vista previa **y** dividida» sería un estado
 * representable que no significa nada, y alguien acabaría escribiéndolo. Tres valores excluyentes
 * son tres pestañas excluyentes, que es literalmente lo que se ve.
 */
export type ViewMode = 'text' | 'preview' | 'split';

export interface EditorEntry {
  /** Lo último que el servidor confirmó. */
  readonly savedContent: string;
  /** Lo que ve la persona. **Nunca** se descarta ante un error (AC-19). */
  readonly draft: string;
  /** Token de concurrencia: el `contentVersion` que se enviará en el guardado siguiente. */
  readonly contentVersion: number;
  readonly status: SaveStatus;
  /**
   * Cuándo confirmó el servidor el último guardado, en milisegundos, o `null` si en esta sesión no
   * se ha guardado nada todavía.
   *
   * Existe desde la fase 6 porque el estado limpio pasa a decir «Guardado 14:32» y no «Guardado»:
   * la hora es la diferencia entre «no hay nada pendiente» y «lo que hay en pantalla llegó al
   * servidor **hace un momento**», que es lo que de verdad se está preguntando al mirar ahí.
   *
   * `null` y no la hora de apertura: un documento recién abierto está limpio porque nadie lo ha
   * tocado, no porque se haya guardado. Ponerle la hora del momento diría que ocurrió algo que no
   * ocurrió, y el rótulo se degrada solo a «Guardado» a secas (`shared/textos/textos.ts`).
   */
  readonly savedAt: number | null;
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
  /**
   * Pila de deshacer/rehacer **de este documento** (spec `006`).
   *
   * Vive dentro de la entrada y no en un diccionario aparte, y de ahí sale por construcción lo que la
   * `004` §9.4 pedía: un `Ctrl`+`Z` no puede deshacer un cambio de **otra** pestaña, porque no hay
   * ninguna pila a la que llegar que no sea la de este id (AC-15).
   *
   * Y **muere con la entrada**, que es la política que fijó la `005` en su §6.3: cambiar de pestaña la
   * conserva —`flush` no desaloja— y cerrarla la tira —`closeTab` sí—. Esa política **es** la cota de
   * vida del historial, así que aquí no hay expulsión por tiempo ni serialización (AC-16).
   */
  readonly undo: UndoState;
}

/**
 * Lo que la interfaz necesita saber tras pedir el cierre de una pestaña, y nada más (spec `005`,
 * AC-4, AC-5, AC-7).
 */
export interface CloseResult {
  /**
   * `false` cuando la pestaña **sigue abierta**: o porque el guardado forzado falló y cerrarla habría
   * tirado el trabajo de alguien (AC-7, lo implementa `T-005`), o porque ese id no estaba abierto.
   */
  readonly closed: boolean;
  /**
   * A dónde ir **si la cerrada era la activa**: la vecina de la derecha, si no la de la izquierda, y
   * `null` cuando no queda ninguna (AC-5). Se calcula **antes** de desalojar, porque después ya no
   * está la información con la que calcularlo.
   */
  readonly next: string | null;
}

export interface EditorState {
  readonly entries: Readonly<Record<string, EditorEntry>>;
  /**
   * Pestañas abiertas, en **orden de apertura** (spec `005`, AC-1).
   *
   * Invariante que defiende AC-1: su conjunto de ids es **exactamente** el conjunto de claves de
   * `entries`. Vive aquí y no en un store aparte precisamente por eso — en dos stores la invariante
   * no tiene dueño y se rompe en la primera secuencia rara, dejando pestañas pintadas sobre la nada o
   * entradas que nadie ve y nadie puede cerrar. Y se mantiene **por construcción**: el único camino
   * que quita una entrada (`drop`) quita también su id.
   *
   * La pestaña **activa** no está aquí, y es deliberado (AC-3): es el `:id` de la ruta y nada más.
   * Un segundo origen de verdad se desincroniza exactamente donde nadie prueba a mano — el botón
   * «atrás» del navegador.
   */
  readonly openIds: readonly string[];

  /** Lee el documento y lo deja limpio. Respeta un borrador sin guardar de una visita anterior. */
  open: (id: string) => Promise<void>;
  /**
   * Cierra una pestaña: **guarda lo pendiente, comprueba, y solo entonces desaloja** (AC-6), sacando
   * el id de `openIds` y devolviendo a dónde ir si era la activa (AC-5). Si el guardado falla, **no
   * cierra** (AC-7).
   *
   * Es el **único** camino que desaloja una entrada. El `close(id)` de la `003` —que descartaba sin
   * guardar— se retiró aquí: con pestañas, un segundo camino de desalojo es un camino por el que
   * alguien pierde su trabajo, y ninguna parte de la aplicación lo usaba.
   */
  closeTab: (id: string) => Promise<CloseResult>;
  /**
   * **Único** punto por el que la interfaz cambia el contenido (spec §4, para la paleta de la `004`),
   * y desde la `006` también el único que **registra un paso de deshacer**.
   *
   * El tercer argumento es opcional a propósito: sin él, la escritura se registra como tecleo y las
   * selecciones se derivan del propio reemplazo, que es **exacto** para el tecleo. Lo que sí tiene que
   * pasarlo es un gesto único —insertar de la paleta, un atajo—, porque ahí la selección de partida no
   * se puede derivar: envolver texto en negrita deja un cursor donde había una selección.
   */
  setDraft: (id: string, draft: string, write?: DraftWrite) => void;
  /** Guardado explícito (`Ctrl`+`S`): inmediato, y cancela el debounce pendiente (AC-27). */
  saveNow: (id: string) => Promise<void>;
  /**
   * Al desmontar o al cambiar de pestaña (`003` AC-28, enmendado por la `005` en su v0.2.0): fuerza
   * el guardado pendiente y **conserva la entrada pase lo que pase**.
   *
   * Hasta la enmienda descartaba la entrada si el guardado salía bien, y era correcto mientras
   * navegar **fuese** cerrar. Con pestañas son dos gestos distintos: descartar aquí obligaría a
   * releer el documento en cada salto y tiraría el `viewMode` —que la `003` quería conservar
   * expresamente— y, desde la `006`, el historial de deshacer. Quien desaloja es `closeTab`.
   */
  flush: (id: string) => Promise<void>;
  /** «Conservar mi versión»: relee, adopta la versión nueva y reenvía el borrador local (AC-20). */
  resolveKeepMine: (id: string) => Promise<void>;
  /** «Descartar mis cambios»: adopta lo del servidor, sin emitir ningún `PUT` (AC-20). */
  resolveTakeServer: (id: string) => Promise<void>;
  /** Conmutador texto/vista previa **de ese documento** (AC-22). */
  setViewMode: (id: string, viewMode: ViewMode) => void;
  /**
   * Deshace el último paso de **ese** documento y devuelve dónde dejar el cursor, o `null` si no había
   * nada que deshacer (spec `006`, AC-11, AC-14).
   *
   * Escribe por el mismo camino interno que `setDraft`, con el registro apagado, así que hereda el
   * marcado de sucio, el debounce y la coalescencia sin una sola rama nueva — y por eso una ráfaga de
   * deshacer produce **una** petición (AC-20).
   */
  undo: (id: string) => Caret | null;
  /** Rehace el último paso deshecho. Misma forma que `undo` (AC-12). */
  redo: (id: string) => Caret | null;
}

/** Lo que una escritura de contenido puede contar de sí misma (spec `006`, `plan.md` §4.5). */
export interface DraftWrite {
  /**
   * `true` —el valor por defecto— para el tecleo, que se agrupa por ventana de inactividad; `false`
   * para un gesto único, que es siempre un paso propio.
   */
  readonly mergeable?: boolean | undefined;
  /** Dónde estaba el cursor antes. Se deriva del reemplazo si falta. */
  readonly caretBefore?: Caret | undefined;
  /** Dónde queda después. Se deriva del reemplazo si falta. */
  readonly caretAfter?: Caret | undefined;
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

/**
 * Lecturas en vuelo, una por documento (spec `005`, AC-10…AC-12). Es el idiom *single-flight* que
 * `shared/api/http.ts` usa en `refreshSession()`, y que la `003` dejó recomendado por nombre en su
 * §8.1 — con una diferencia que no es un detalle: allí el recurso es **uno solo** y una promesa
 * global basta; aquí hay uno por documento, así que la clave es el `id`. Con una promesa compartida,
 * abrir dos documentos a la vez leería uno y la otra pestaña saldría con el contenido del primero.
 *
 * Fuera del estado, por el mismo motivo que los temporizadores del debounce: una promesa no se pinta,
 * y meterla en el store haría que cada apertura provocara dos renders de más.
 */
const readsInFlight = new Map<string, Promise<void>>();

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

  /**
   * Quita la entrada **y su pestaña**, que es lo que mantiene la invariante de AC-1 por construcción
   * en vez de por disciplina: mientras este sea el único camino que borra una entrada, no puede
   * quedar ni una entrada sin pestaña ni una pestaña sin entrada.
   */
  const drop = (id: string): void => {
    set((state) => {
      const { [id]: _removed, ...rest } = state.entries;

      return { entries: rest, openIds: state.openIds.filter((open) => open !== id) };
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
        savedAt: Date.now(),
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

  /**
   * Lee el documento y crea su entrada **y su pestaña** (spec `005`, AC-1).
   *
   * El error **se propaga** a quien llamó y no se traga: es el contrato que la `003` cerró en su
   * `T-012`, y lo que permite a `DocumentEditorPage` distinguir `loading` de `missing` y de `error`
   * en vez de caer en el aviso genérico que su AC-19 existe para evitar.
   */
  const readDocument = async (id: string): Promise<void> => {
    const document = await getDocument(id);

    set((state) => ({
      entries: {
        ...state.entries,
        [id]: {
          savedContent: document.content,
          draft: document.content,
          contentVersion: document.contentVersion,
          status: 'clean',
          // Recién leído: está limpio, pero **no** se ha guardado en esta sesión.
          savedAt: null,
          viewMode: 'text',
          error: null,
          serverContent: null,
          serverVersion: null,
          undo: EMPTY_HISTORY,
        },
      },
      // Al **final** y solo si no estaba (AC-1, AC-2). Un `push` incondicional duplicaría la pestaña
      // al volver a un documento; recalcular la lista poniendo el último abierto al final es lo que
      // hace el historial de un navegador, y no lo que hace un gestor de pestañas.
      openIds: state.openIds.includes(id) ? state.openIds : [...state.openIds, id],
    }));
  };

  /**
   * Escribe el borrador y su historial. **Es la única ruta de escritura de contenido**, y `setDraft`,
   * `undo` y `redo` son tres formas de llamarla: no hay un segundo camino que pueda discrepar del
   * primero, hay uno con un interruptor —quién trae el historial ya calculado—.
   *
   * De aquí sale que deshacer herede el marcado de sucio, el debounce y la coalescencia **sin código
   * propio**, que es lo que hace que una ráfaga de deshacer sea una petición y no diez (AC-20).
   */
  const writeDraft = (id: string, draft: string, undo: UndoState): void => {
    const entry = entryOf(id);

    if (entry === undefined) {
      return;
    }

    if (draft === entry.savedContent) {
      // Deshacer hasta el original no es un cambio pendiente: además de volver a `clean`, cancela
      // el guardado programado, para no mandar una petición que no cambia nada.
      cancelDebounce(id);
      patch(id, { draft, undo, status: 'clean', error: null });

      return;
    }

    patch(id, { draft, undo, status: 'dirty', error: null });
    scheduleSave(id);
  };

  /**
   * Un paso de historial, en los dos sentidos. Lo que cambia entre deshacer y rehacer es **qué función
   * del módulo se pregunta**, y nada más: el resto —escribir por la ruta única, devolver dónde va el
   * cursor, no registrarse a sí mismo— es idéntico, así que vive escrito una vez (AC-13).
   */
  const applyHistoryStep = (id: string, step: typeof undoStep | typeof redoStep): Caret | null => {
    const entry = entryOf(id);

    if (entry === undefined) {
      return null;
    }

    const applied = step(entry.undo, entry.draft);

    // Sin nada que deshacer no se toca el borrador, no se marca sucio y no se programa guardado
    // (AC-14). Devolver `null` es lo que le permite a la interfaz no mover el cursor.
    if (applied === null) {
      return null;
    }

    writeDraft(id, applied.text, applied.history);

    return applied.caret;
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
    openIds: [],

    open: async (id) => {
      // Con entrada ya en el store —**limpia o sucia**— no se pide nada (spec `005`, AC-13).
      //
      // La rama «sucia» viene de la `003` (su AC-28): volver a un documento cuyo guardado falló tiene
      // que devolver **el texto sin guardar**, no el del servidor, y releer aquí sería la forma
      // silenciosa de perderlo. La rama «limpia» es nueva y es un **cambio consciente**: en la `003`
      // navegar fuera descartaba la entrada, así que esa rama era casi código muerto; con pestañas
      // sería una lectura por cada salto entre pestañas. La consecuencia —una pestaña vieja puede
      // chocar con un `409` al guardar— es exactamente el caso que la maquinaria de conflicto de la
      // `003` existe para resolver.
      if (entryOf(id) !== undefined) {
        return;
      }

      // Una sola lectura por documento aunque la pidan varios a la vez (AC-10).
      const reading = readsInFlight.get(id);

      if (reading !== undefined) {
        return reading;
      }

      const run = readDocument(id).finally(() => {
        // En el `finally` y no tras el `await`: si la lectura falla, la promesa **tiene que
        // liberarse** igual (AC-12). Cachearla sin limpiarla dejaría el documento imposible de abrir
        // hasta recargar la aplicación, a partir de un fallo de red pasajero.
        readsInFlight.delete(id);
      });

      readsInFlight.set(id, run);

      return run;
    },

    closeTab: async (id) => {
      const { openIds } = get();
      const index = openIds.indexOf(id);

      // Cerrar algo que no está abierto no cierra nada, y decir lo contrario haría que la interfaz
      // navegara a `/` por un gesto que no ocurrió.
      if (index === -1) {
        return { closed: false, next: null };
      }

      // Se calcula **antes** de guardar y de desalojar: después, `openIds` ya no tiene con qué. La
      // derecha manda y la izquierda es el respaldo, que es lo que hace que cerrar la última no salte
      // al principio.
      const next = openIds[index + 1] ?? openIds[index - 1] ?? null;

      // Guardar **antes** de desalojar, y comprobar el resultado **después** del `await`: la entrada
      // pudo cambiar mientras la petición volaba, que es la misma precaución que ya toma `patch`.
      await get().flush(id);

      // Si no quedó limpio, la pestaña se queda abierta **con su borrador y su error** (AC-7).
      // Cerrarla igual sería tirar el trabajo de alguien mientras la interfaz dice que se guardó, que
      // es el defecto más caro que esta spec podía introducir.
      if (entryOf(id)?.status !== 'clean') {
        return { closed: false, next };
      }

      cancelDebounce(id);
      drop(id);

      return { closed: true, next };
    },

    setDraft: (id, draft, write) => {
      const entry = entryOf(id);

      if (entry === undefined || entry.draft === draft) {
        return;
      }

      writeDraft(
        id,
        draft,
        recordWrite(entry.undo, {
          before: entry.draft,
          after: draft,
          mergeable: write?.mergeable ?? true,
          // **El único punto de la `006` que lee el reloj.** El módulo de historial lo recibe como
          // argumento, así que sus casos se comprueban pasando dos números en vez de moviendo relojes.
          now: Date.now(),
          caretBefore: write?.caretBefore,
          caretAfter: write?.caretAfter,
        }),
      );
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

      // Y **no se descarta nada**. Aquí vivía el `drop` de la `003`; se mudó a `closeTab`, que es
      // quien sabe si la persona quiso cerrar o solo cambiar de pestaña (enmienda v0.2.0 de la `003`,
      // pedida por la `005`: sus AC-4 a AC-9).
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
          // Lo que hay ahora es del servidor y no lo hemos escrito nosotros: no sabemos cuándo se
          // guardó, así que no se inventa una hora. El rótulo cae a «Guardado» a secas.
          savedAt: null,
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
        // Mismo caso que en `resolveKeepMine`: se adopta un texto que guardó el servidor en un
        // momento que este cliente no presenció.
        savedAt: null,
        error: null,
        serverContent: null,
        serverVersion: null,
        // La pila **se vacía** (spec `006`, AC-21). Adoptar el texto del servidor cambia el documento
        // entero, y dejar los pasos anteriores permitiría deshacer «hacia atrás» hasta reintroducir el
        // conflicto que se acaba de resolver — con un `Ctrl`+`Z` cuyo resultado nadie puede predecir.
        // Es el único sitio del store, aparte de `setDraft`, que escribe el borrador y tiene que
        // decidir qué hacer con el historial (`006/spec.md` §1.3).
        undo: clearHistory(),
      });
    },

    // `patch` ignora los documentos que no están abiertos, así que pintar no puede resucitar una
    // entrada que se cerró.
    setViewMode: (id, viewMode) => {
      patch(id, { viewMode });
    },

    undo: (id) => applyHistoryStep(id, undoStep),

    redo: (id) => applyHistoryStep(id, redoStep),
  };
});
