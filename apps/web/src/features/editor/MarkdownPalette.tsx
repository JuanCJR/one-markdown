import { useRef, useState } from 'react';

import {
  MARKDOWN_PALETTE,
  PALETTE_GROUP_LABELS,
  type PaletteElement,
  type PaletteGroup,
} from './markdown-palette';
import { PALETA } from '../../shared/textos/textos';

/**
 * Barra de elementos markdown insertables (`004/plan.md` §4.4; AC-24, AC-25, y la mitad de AC-27).
 *
 * Es el patrón *toolbar* de WAI-ARIA: un contenedor con nombre, grupos con nombre propio y **una
 * sola** parada de tabulación para las dieciséis, con las flechas moviendo el foco por dentro. Una
 * barra de dieciséis paradas de tabulación es exactamente la barrera que esta spec existe para no
 * crear, así que el teclado se atiende **delegado** en el contenedor: el evento nace siempre en el
 * botón enfocado y no hace falta un manejador por botón.
 *
 * El componente no sabe insertar nada: recibe `onInsert` y le entrega el elemento del catálogo. Lo
 * que hace con él —el núcleo puro, el store, el cursor— es cosa de la página (`plan.md` §4.3).
 *
 * **De dónde sale el orden.** Del catálogo, siempre: `MARKDOWN_PALETTE` se agrupa conservando su
 * orden y de ahí salen a la vez el pintado y el recorrido de las flechas. No se recorren las claves
 * de `PALETTE_GROUP_LABELS`: el orden de las claves de un objeto no es contrato de nada, y montar
 * la navegación con teclado sobre él la ataría a un detalle que ningún test defiende.
 */

export interface MarkdownPaletteProps {
  /** Se llama con el elemento del catálogo que se acaba de activar. */
  readonly onInsert: (element: PaletteElement) => void;
}

/** Un botón de la paleta, con el índice que ocupa en el recorrido **global** de las flechas. */
interface PaletteItem {
  readonly element: PaletteElement;
  readonly index: number;
}

/** Un cajón de la barra: los elementos consecutivos del catálogo que comparten grupo. */
interface PaletteSection {
  readonly group: PaletteGroup;
  readonly items: readonly PaletteItem[];
}

/**
 * Agrupa el catálogo **sin reordenarlo**: cada tramo consecutivo de elementos del mismo grupo es un
 * cajón, y el índice que se guarda es el del catálogo entero, que es el que recorren las flechas.
 */
function sectionsOf(catalog: readonly PaletteElement[]): readonly PaletteSection[] {
  const sections: { group: PaletteGroup; items: PaletteItem[] }[] = [];

  catalog.forEach((element, index) => {
    const current = sections.at(-1);

    if (current !== undefined && current.group === element.group) {
      current.items.push({ element, index });

      return;
    }

    sections.push({ group: element.group, items: [{ element, index }] });
  });

  return sections;
}

const PALETTE_SECTIONS = sectionsOf(MARKDOWN_PALETTE);

/** Lo último insertado y **el número de anuncio** que le toca. El contador es la mitad de AC-36. */
interface Announcement {
  readonly label: string;
  readonly count: number;
}

/**
 * Espacio de ancho cero: la diferencia imperceptible que hace **volver a anunciar** (AC-36).
 *
 * Escribir en la región el mismo texto que ya tenía no muta el DOM y por tanto no anuncia nada, así
 * que quien inserta «Negrita» dos veces seguidas oiría el primer anuncio y nada más, con el
 * documento cambiado las dos. Alternar este carácter entre anuncios consecutivos hace que el
 * contenido cambie **siempre**, sin cambiar lo que se lee: `U+200B` no se pinta y ni NVDA, ni JAWS,
 * ni VoiceOver lo locutan.
 *
 * **Por qué esto y no un espacio normal**: un espacio al final es whitespace, y whitespace es
 * justamente lo que todas las capas de por medio pueden colapsar —`textContent` normalizado, los
 * comparadores de los tests, y el propio cálculo de texto de un lector—. Una diferencia que consiste
 * solo en whitespace es la más fácil de que se normalice hasta desaparecer justo en el consumidor al
 * que va dirigida.
 *
 * **Y por qué no vaciar y reescribir en dos commits**, que es la otra opción que la spec admite: en
 * React las dos actualizaciones del mismo manejador se agrupan en un solo render, así que el paso
 * intermedio por vacío solo existe con `flushSync` —un render extra forzado por un detalle de
 * accesibilidad— o con un temporizador, que deja el segundo cambio fuera del alcance síncrono con el
 * que AC-36 se verifica.
 */
const ZERO_WIDTH_SPACE = '\u200B';

/** El texto de la región viva: vacío mientras no se haya insertado nada (AC-27). */
function textOf(announcement: Announcement | null): string {
  if (announcement === null) {
    return '';
  }

  return `${PALETA.insertado(announcement.label)}${announcement.count % 2 === 0 ? ZERO_WIDTH_SPACE : ''}`;
}

export function MarkdownPalette({ onInsert }: MarkdownPaletteProps): React.JSX.Element {
  // Qué botón es la parada de tabulación. Es estado del componente y no del store: solo importa
  // mientras la paleta esté montada, igual que el foco del árbol de la `002`.
  const [activeIndex, setActiveIndex] = useState(0);
  // Lo último insertado, para la región viva (AC-27), **y cuántas veces se ha anunciado algo**
  // (AC-36). `null` es «todavía no se ha insertado nada» y deja la región montada pero vacía.
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const focusAt = (index: number): void => {
    const count = MARKDOWN_PALETTE.length;
    // Envuelve por los dos extremos: `-1` es el último y `count` es el primero (AC-25).
    const next = ((index % count) + count) % count;

    setActiveIndex(next);
    buttonsRef.current[next]?.focus();
  };

  /** Desde qué botón se mueve: el que tiene el foco, y la parada actual si el evento vino de otro sitio. */
  const indexOfTarget = (target: EventTarget): number => {
    const found = buttonsRef.current.findIndex((node) => node === target);

    return found === -1 ? activeIndex : found;
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
        focusAt(MARKDOWN_PALETTE.length - 1);
        break;
      default:
        // `Tab`, `Enter` y `Espacio` siguen siendo del navegador: la barra no es una trampa de
        // teclado (SC 2.1.2) y `preventDefault` sobre `Enter` cancelaría el clic del `<button>`.
        return;
    }

    event.preventDefault();
  };

  const activate = (item: PaletteItem): void => {
    setActiveIndex(item.index);
    setAnnouncement((previous) => ({
      label: item.element.label,
      count: (previous?.count ?? 0) + 1,
    }));
    onInsert(item.element);
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        role="toolbar"
        aria-label={PALETA.barra}
        onKeyDown={handleKeyDown}
        className="flex flex-wrap items-center gap-1 bg-sup-elevada p-1"
      >
        {PALETTE_SECTIONS.map((section, position) => (
          <div
            key={section.group}
            role="group"
            aria-label={PALETTE_GROUP_LABELS[section.group]}
            className={`flex flex-wrap items-center gap-0.5 ${
              position === 0 ? '' : 'border-l border-hair-fila pl-1'
            }`}
          >
            {section.items.map((item) => (
              <button
                key={item.element.id}
                type="button"
                ref={(node) => {
                  buttonsRef.current[item.index] = node;
                }}
                aria-label={item.element.label}
                tabIndex={item.index === activeIndex ? 0 : -1}
                onClick={() => {
                  activate(item);
                }}
                // `size-8` son 32 px: por encima de los 24 × 24 de SC 2.5.8 (AC-29). El anillo de
                // foco es el del repo tal cual: en Tailwind 4 `outline-none` se hereda y lo mata.
                className="flex size-8 items-center justify-center text-tinta-secundaria outline-solid outline-0 hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo"
              >
                <PaletteIcon id={item.element.id} />
              </button>
            ))}
          </div>
        ))}
      </div>

      {/*
        Región viva **propia** de la paleta (AC-27, AC-36). Se monta con el componente y está vacía
        hasta que hay algo que decir: un lector de pantalla registra las regiones vivas que encuentra
        y anuncia sus **cambios**, así que una región que entra en el DOM con su texto ya dentro no
        le presenta un cambio sino una aparición, y en NVDA y JAWS puede no leerse nunca.

        El `aria-label` la identifica en la lista de regiones y la distingue de la del guardado, que
        vive en la misma página y también es un `role="status"`.
      */}
      <p role="status" aria-label={PALETA.region} className="sr-only">
        {textOf(announcement)}
      </p>
    </div>
  );
}

/**
 * El icono de un elemento. Va `aria-hidden` y `focusable="false"` **siempre**: el nombre del botón
 * es su `aria-label` en castellano, y un `<svg>` enfocable añadiría una parada de tabulación por
 * botón en Internet Explorer y en algunos lectores (AC-24).
 */
function PaletteIcon({ id }: { readonly id: string }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* El catálogo puede crecer sin icono propio: antes que reventar, un guion neutro. */}
      {ICONS[id] ?? <path d="M4 8h8" />}
    </svg>
  );
}

/** Rótulo tipográfico dentro del icono (B, I, H1…): no aporta nombre, el `<svg>` es `aria-hidden`. */
function Glyph({
  children,
  italic = false,
}: {
  readonly children: string;
  readonly italic?: boolean;
}) {
  return (
    <text
      x="8"
      y="12"
      textAnchor="middle"
      fontSize="11"
      fontWeight="700"
      fontStyle={italic ? 'italic' : 'normal'}
      fill="currentColor"
      stroke="none"
    >
      {children}
    </text>
  );
}

/** Dos líneas de «texto» con un adorno delante: la forma de las tres listas y de la cita. */
function ListRows({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      {children}
      <path d="M8 5h6" />
      <path d="M8 11h6" />
    </>
  );
}

const ICONS: Readonly<Record<string, React.ReactNode>> = {
  bold: <Glyph>B</Glyph>,
  italic: <Glyph italic>I</Glyph>,
  strikethrough: (
    <>
      <Glyph>S</Glyph>
      <path d="M2 8h12" />
    </>
  ),
  inlineCode: (
    <>
      <path d="M6 4 2.5 8 6 12" />
      <path d="M10 4l3.5 4L10 12" />
    </>
  ),
  heading1: <Glyph>H1</Glyph>,
  heading2: <Glyph>H2</Glyph>,
  heading3: <Glyph>H3</Glyph>,
  quote: (
    <ListRows>
      <path d="M3 3v10" />
    </ListRows>
  ),
  bulletList: (
    <ListRows>
      <path d="M3 5h.01" />
      <path d="M3 11h.01" />
    </ListRows>
  ),
  numberedList: (
    <ListRows>
      <text x="1.5" y="7" fontSize="6" fill="currentColor" stroke="none">
        1
      </text>
      <text x="1.5" y="13" fontSize="6" fill="currentColor" stroke="none">
        2
      </text>
    </ListRows>
  ),
  taskList: (
    <ListRows>
      <rect x="1.5" y="2.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" />
    </ListRows>
  ),
  link: (
    <>
      <path d="M7 9.5a2.8 2.8 0 0 0 4 0l2-2a2.8 2.8 0 0 0-4-4l-1 1" />
      <path d="M9 6.5a2.8 2.8 0 0 0-4 0l-2 2a2.8 2.8 0 0 0 4 4l1-1" />
    </>
  ),
  image: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M5.5 6.5h.01" />
      <path d="M3 11l3-2.5L8.5 11l2-2L13 11" />
    </>
  ),
  codeBlock: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6.5 6.5 5 8l1.5 1.5" />
      <path d="M9.5 6.5 11 8l-1.5 1.5" />
    </>
  ),
  table: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M2 6.5h12" />
      <path d="M6.5 6.5V13" />
      <path d="M10.5 6.5V13" />
    </>
  ),
  divider: <path d="M2 8h12" />,
};
