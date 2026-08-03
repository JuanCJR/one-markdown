import { useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';

import { useEditorStore } from './editor.store';
import { useWorkspaceStore } from '../workspace/workspace.store';

/**
 * Tira de pestañas de documentos abiertos (`005/plan.md` §4.3; AC-3, AC-20…AC-24, AC-28).
 *
 * Es el patrón *tabs* de WAI-ARIA con **botones** y no con enlaces (decisión A de la spec): las
 * pestañas cambian la URL, pero lo que expresan es una **selección entre N**, que es lo que dice
 * `aria-selected` y no dice `aria-current`. Lo que se pierde y está aceptado: `Ctrl`+clic y clic
 * central dejan de abrir en una pestaña del navegador. La barra lateral, que sí es navegación, no
 * cambia.
 *
 * **Recibe nada.** Lee las pestañas del store del editor, los títulos del árbol y la pestaña activa
 * de la **ruta**: la selección no tiene representación en el store y es deliberado (AC-3). Un
 * `activeId` guardado sería un segundo origen de verdad que se desincroniza justo donde nadie prueba
 * a mano — el botón «atrás» del navegador.
 *
 * **Teclado delegado en el contenedor**, igual que `MarkdownPalette` y `WorkspaceTreeView`: el evento
 * nace en el botón enfocado, así que no hace falta un manejador por pestaña. Y **roving tabindex**:
 * N pestañas son **una** parada de tabulación (AC-20), porque quien tabula hacia el `<main>` no debe
 * cruzar antes una parada por documento abierto.
 */

/**
 * Ruta que pinta un documento. La pestaña activa es su `:id` y **nada más** (AC-3).
 *
 * Se resuelve con `useMatch` y no con `useParams` porque este componente vive en el `AppShell`,
 * que es la ruta **padre** de `documents/:id`: `useParams` allí no ve el `id` del hijo.
 */
const DOCUMENT_ROUTE = '/documents/:id';

/**
 * `id` del `<main>` del `AppShell`, que es el panel que estas pestañas controlan (`aria-controls`).
 *
 * Se declara **aquí** y no en `AppShell.tsx` porque quien lo referencia es esta tira; el shell solo
 * tiene que ponérselo a su `<main>` (`T-007`). Con la constante en el shell, el consumidor tendría
 * que importar del contenedor que lo pinta, que es la dependencia al revés.
 */
export const EDITOR_PANEL_ID = 'app-main-panel';

/** Título con el que se pinta una pestaña cuyo documento el árbol todavía no conoce. */
const UNTITLED_DOCUMENT = 'Documento sin título';

/**
 * Espacio de ancho cero: la diferencia imperceptible que hace **volver a anunciar** (AC-28).
 *
 * El mecanismo está resuelto, medido y comentado en `MarkdownPalette.tsx` (su AC-36) y se reutiliza
 * tal cual en vez de inventarse otro. El resumen: escribir en la región el mismo texto que ya tenía
 * no muta el DOM y por tanto no anuncia nada, así que cerrar dos pestañas con el mismo título diría
 * la primera y callaría la segunda. Alternar este carácter hace que el contenido cambie **siempre**
 * sin cambiar lo que se lee: `U+200B` no se pinta y ningún lector lo locuta. No vale un espacio
 * normal —es whitespace, y whitespace es justo lo que todas las capas de por medio colapsan.
 */
const ZERO_WIDTH_SPACE = '\u200B';

/** Lo último cerrado y **el número de anuncio** que le toca. El contador es la mitad de AC-28. */
interface Announcement {
  readonly title: string;
  readonly count: number;
}

/** El texto de la región viva: vacío mientras no se haya cerrado nada (AC-28). */
function textOf(announcement: Announcement | null): string {
  if (announcement === null) {
    return '';
  }

  return `Cerrada: ${announcement.title}${announcement.count % 2 === 0 ? ZERO_WIDTH_SPACE : ''}`;
}

/**
 * El nombre accesible de una pestaña: título, estado y **cómo se cierra**, los tres con palabras.
 *
 * - El **título** va dentro (AC-23) porque con varias pestañas N controles llamados «Cerrar» son
 *   indistinguibles en la lista de un lector de pantalla.
 * - **«sin guardar»** va dentro (AC-24) porque un punto de color y nada más incumple WCAG 1.4.1.
 * - **«Supr para cerrar»** va dentro porque, sin ratón, `Delete` es la **única** forma de cerrar
 *   (decisión B) y un atajo que no se anuncia no existe.
 */
function accessibleNameOf(title: string, unsaved: boolean): string {
  return `«${title}»${unsaved ? ' · sin guardar' : ''} · Supr para cerrar`;
}

/** `id` del botón de una pestaña, para que el panel pueda apuntarle con `aria-labelledby`. */
function tabElementId(documentId: string): string {
  return `document-tab-${documentId}`;
}

/** El clic nació en la «×» y no en el resto de la pestaña (decisión B). */
function isCloseTarget(target: EventTarget): boolean {
  return target instanceof HTMLElement && target.dataset['tabClose'] === 'true';
}

export function DocumentTabs(): React.JSX.Element {
  // `useShallow` y no un selector pelado: en Zustand 5 un selector que derive un valor **nuevo** en
  // cada llamada provoca renders en bucle, y este es el sitio donde eso ocurriría en cuanto alguien
  // añadiera un `.map` o un `.filter` aquí. Con él, el componente solo se vuelve a pintar cuando la
  // lista de pestañas cambia de verdad.
  const openIds = useEditorStore(useShallow((state) => state.openIds));
  const entries = useEditorStore((state) => state.entries);
  const documentsById = useWorkspaceStore((state) => state.documentsById);

  const navigate = useNavigate();
  const activeId = useMatch(DOCUMENT_ROUTE)?.params.id ?? null;

  // Qué pestaña es la parada de tabulación mientras se recorre con flechas. Estado del componente y
  // no del store: solo importa mientras la tira esté montada, igual que el foco del árbol de la
  // `002` y el de la paleta de la `004`.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Lo último cerrado, para la región viva, **y cuántas veces se ha anunciado algo**. `null` es
  // «todavía no se ha cerrado nada» y deja la región montada pero vacía (AC-28).
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const liveRef = useRef<HTMLParagraphElement>(null);

  const titleOf = (id: string): string => documentsById[id]?.title ?? UNTITLED_DOCUMENT;

  /**
   * La única parada de tabulación (AC-20): la última pestaña que recibió el foco, si sigue abierta;
   * si no, la activa; si no, la primera. La cadena importa porque las tres se quedan sin candidato
   * en algún momento —al cerrar la enfocada, con la ruta en `/`, o con el árbol a medio cargar— y
   * quedarse sin ninguna dejaría la tira inalcanzable con el teclado.
   */
  const tabStopId =
    (focusedId !== null && openIds.includes(focusedId) ? focusedId : null) ??
    (activeId !== null && openIds.includes(activeId) ? activeId : null) ??
    openIds[0] ??
    null;

  const focusTab = (id: string): void => {
    setFocusedId(id);
    buttonsRef.current.get(id)?.focus();
  };

  /** Envuelve por los dos extremos (AC-21): `-1` es la última y `length` es la primera. */
  const focusAt = (index: number): void => {
    const count = openIds.length;

    if (count === 0) {
      return;
    }

    const target = openIds[((index % count) + count) % count];

    if (target !== undefined) {
      focusTab(target);
    }
  };

  /** Desde qué pestaña se mueve: la que tiene el foco, y la parada actual si el evento vino de otro sitio. */
  const indexOfTarget = (target: EventTarget): number => {
    const found = openIds.findIndex((id) => buttonsRef.current.get(id) === target);

    return found === -1 ? openIds.findIndex((id) => id === tabStopId) : found;
  };

  /**
   * Cerrar, y lo que hay que hacer después. El orden no es casual:
   *
   * 1. El título se lee **antes**, porque después de cerrar la entrada ya no está y el anuncio se
   *    quedaría sin nombre que decir.
   * 2. Si `closeTab` dice que **no** cerró (el guardado forzado falló, AC-7), no se anuncia nada y
   *    no se toca el foco: la pestaña sigue ahí con su borrador y su error.
   * 3. El foco va a la vecina que devuelve el store, que es la misma regla de AC-5 —derecha, si no
   *    izquierda—, y **nunca** al `<body>`: sin vecina va a la región que acaba de contar lo que
   *    pasó, que está montada y es donde está la explicación (AC-22).
   * 4. Solo se navega si la cerrada **era** la activa; cerrar otra no toca la ruta (AC-4).
   */
  const close = async (id: string): Promise<void> => {
    const title = titleOf(id);
    const wasActive = id === activeId;
    const { closed, next } = await useEditorStore.getState().closeTab(id);

    if (!closed) {
      return;
    }

    setAnnouncement((previous) => ({ title, count: (previous?.count ?? 0) + 1 }));

    if (next === null) {
      liveRef.current?.focus();
    } else {
      focusTab(next);
    }

    if (wasActive) {
      // `void` porque en React Router 8 `navigate` devuelve `void | Promise<void>`, igual que ya lo
      // escribe `WorkspaceTreeView.tsx`.
      void navigate(next === null ? '/' : `/documents/${next}`);
    }
  };

  const activate = (id: string): void => {
    setFocusedId(id);

    if (id !== activeId) {
      void navigate(`/documents/${id}`);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const from = indexOfTarget(event.target);

    switch (event.key) {
      case 'ArrowRight':
        focusAt(from + 1);
        break;
      case 'ArrowLeft':
        focusAt(from - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(openIds.length - 1);
        break;
      case 'Delete': {
        // `Delete` y **no** `Ctrl`+`W` (AC-22): `Ctrl`+`W` cierra la pestaña del navegador y una
        // página no puede interceptarlo, así que un atajo así sería uno que nunca llega.
        const id = openIds[from];

        if (id === undefined) {
          return;
        }

        void close(id);
        break;
      }
      default:
        // `Tab` y `Enter` siguen siendo del navegador: la tira no es una trampa de teclado (SC
        // 2.1.2) y `preventDefault` sobre `Enter` cancelaría el clic del `<button>`.
        return;
    }

    event.preventDefault();
  };

  return (
    <div className="flex flex-col">
      {openIds.length > 0 && (
        <div
          role="tablist"
          aria-label="Documentos abiertos"
          onKeyDown={handleKeyDown}
          className="flex items-stretch gap-px overflow-x-auto bg-sup-elevada px-2"
        >
          {openIds.map((id) => {
            const title = titleOf(id);
            // Cualquier estado que no sea `clean` es trabajo que el servidor todavía no confirmó, y
            // eso es lo que la persona necesita ver antes de cerrar.
            const unsaved = (entries[id]?.status ?? 'clean') !== 'clean';
            const selected = id === activeId;

            return (
              <button
                key={id}
                id={tabElementId(id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={EDITOR_PANEL_ID}
                aria-label={accessibleNameOf(title, unsaved)}
                tabIndex={id === tabStopId ? 0 : -1}
                ref={(node) => {
                  if (node === null) {
                    buttonsRef.current.delete(id);

                    return;
                  }

                  buttonsRef.current.set(id, node);
                }}
                onClick={(event) => {
                  if (isCloseTarget(event.target)) {
                    void close(id);

                    return;
                  }

                  activate(id);
                }}
                className={`flex max-w-56 min-w-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm outline-solid outline-0 focus-visible:foco-cromo ${
                  // La pestaña activa NO gasta cromo (04-color.md §8): se dice con la superficie
                  // —se apoya en el papel mientras las demás están en el escalón elevado—, con el
                  // peso 900 y con la tinta plena frente a la secundaria. Tres canales, ninguno
                  // de color.
                  selected
                    ? 'border-transparent bg-sup-base font-black text-tinta'
                    : 'border-transparent text-tinta-secundaria hover:bg-sup-hundida'
                }`}
              >
                <span className="truncate">{title}</span>

                {/*
                  El punto y la cruz van `aria-hidden`: son la versión **visual** de algo que el
                  nombre accesible ya dice con palabras, y repetirlas ahí las haría locutar dos
                  veces. La cruz es un `<span>` y no un `<button>` (decisión B): un botón dentro de
                  un botón es HTML inválido, y la receta de la APG para «una pestaña con un control
                  dentro» está marcada como experimental y depende de un atributo que no está en
                  ninguna especificación publicada.
                */}
                {unsaved && (
                  // Sin guardar no tiene color: es masa de tinta. La palabra ya está en el nombre
                  // accesible de la pestaña, así que aquí solo queda la masa.
                  <span aria-hidden="true" className="text-tinta">
                    ●
                  </span>
                )}
                {/*
                  `size-6` son 24 px: el mínimo de WCAG 2.2 SC 2.5.8 (AC-34). Antes era `px-1` sobre
                  el ancho del glifo y medía **19,73 × 20 px** — lo destapó el caso de navegador de
                  `T-010`, porque jsdom no calcula disposición y en la suite de componente esto es
                  invisible.
                  **No lo salva ninguna excepción del criterio**: la de *Spacing* no aplica porque la
                  «×» está **anidada dentro** de la pestaña, así que un círculo de 24 px centrado en
                  ella intersecta por fuerza el objetivo que la contiene; y la de *Equivalent* tampoco,
                  porque el otro camino de cierre es `Supr`, que es un atajo y no un objetivo.
                */}
                <span
                  aria-hidden="true"
                  data-tab-close="true"
                  className="flex size-6 shrink-0 items-center justify-center text-tinta-tenue hover:bg-tinta hover:text-sup-base"
                >
                  ×
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/*
        Región viva **propia** de la tira (AC-28). Se monta con el componente y está vacía hasta que
        hay algo que decir: un lector registra las regiones vivas que encuentra y anuncia sus
        **cambios**, así que una que entra en el DOM con su texto ya dentro no le presenta un cambio
        sino una aparición, y en NVDA y JAWS puede no leerse nunca.

        **La región se monta siempre, incluso sin pestañas**, y aquí hay una desviación consciente de
        `plan.md` §4.3 («devuelve `null` si no hay pestañas abiertas»). El motivo está medido: cerrar
        la **última** pestaña deja `openIds` vacío en el store **antes** de que este componente pueda
        anunciar nada —`closeTab` es asíncrono, y entre su `drop` y la reanudación del `await` hay
        puntos de comprobación de microtareas en los que React ya vuelve a pintar—, así que un
        `return null` en ese hueco desmonta la región, deja el `ref` a `null` y se lleva por delante
        el anuncio **y** el foco. Lo que se pinta de menos sin pestañas es un párrafo `sr-only`
        vacío; lo que se perdía era el AC entero. La **tira** sí desaparece, que es lo que el plan
        quería decir y lo que `AppShell` comprueba.

        El `aria-label` la distingue de las otras tres de la página del editor —el guardado (`003`),
        la paleta (`004`) y la carga—, que también son `role="status"`.

        El `tabIndex={-1}` es el destino declarado del foco cuando se cierra la última pestaña y no
        queda vecina (AC-22): existe, está montada, y es donde está la explicación de lo que acaba
        de pasar. La alternativa —dejarlo en el `<body>`— manda a quien navega con teclado al
        principio del documento sin decírselo.
      */}
      <p
        ref={liveRef}
        role="status"
        aria-label="Pestañas abiertas"
        tabIndex={-1}
        className="sr-only"
      >
        {textOf(announcement)}
      </p>
    </div>
  );
}
