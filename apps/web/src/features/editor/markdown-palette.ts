/**
 * Catálogo de elementos markdown insertables (`spec.md` §6).
 *
 * Es **contrato de producto**, no configuración: estas son las etiquetas que lee la persona y las
 * cadenas exactas que acaban en su documento. Por eso vive en un módulo de datos, congelado, con un
 * test que lo afirma entero (`markdown-palette.test.ts`), y no repartido por el componente.
 *
 * Datos y tipos, nada más: aquí no hay ni una línea de interfaz ni de estado, y una guarda lo
 * comprueba leyendo este mismo archivo (AC-17).
 */

/** Los tres cajones de la paleta, en el orden en que se pintan. */
export type PaletteGroup = 'format' | 'textBlocks' | 'insert';

/** Cómo se llama cada cajón en la interfaz. Es el `aria-label` de su `role="group"` (AC-24). */
export const PALETTE_GROUP_LABELS: Record<PaletteGroup, string> = {
  format: 'Formato',
  textBlocks: 'Bloques de texto',
  insert: 'Insertar',
};

/**
 * Elementos que **envuelven** la selección: negrita, cursiva, tachado, código en línea, enlace e
 * imagen.
 */
export interface InlineBehaviour {
  readonly kind: 'inline';
  readonly before: string;
  readonly after: string;
  /** Lo que se inserta —y queda seleccionado— cuando no había nada seleccionado. */
  readonly placeholder: string;
  /**
   * Fragmento **de `after`** que queda seleccionado cuando sí había selección, en vez del contenido
   * envuelto. Lo declaran `link` e `image` con su URL de ejemplo (AC-5): si la persona seleccionó
   * `web` y pidió un enlace, el rótulo ya está escrito y el hueco por rellenar es el destino.
   *
   * Es una cadena y no un `true` porque el destino a seleccionar es **un dato del elemento**, no
   * algo que el núcleo pueda deducir de `after` sin ponerse a analizar paréntesis.
   */
  readonly selectTargetWhenWrapping?: string;
}

/**
 * Prefijo que recibe cada línea: fijo para encabezados, cita, viñetas y tareas; **numerado** para la
 * lista numerada, que cuenta desde 1 y **solo** las líneas que reciben prefijo (AC-8 + AC-9).
 */
export type LinePrefixSource =
  { readonly kind: 'fixed'; readonly text: string } | { readonly kind: 'numbered' };

/**
 * Elementos que prefijan **líneas enteras**: encabezados, cita y las tres listas. El prefijo va al
 * principio de la línea y nunca donde esté el cursor (AC-7).
 */
export interface LinePrefixBehaviour {
  readonly kind: 'linePrefix';
  readonly prefix: LinePrefixSource;
  /**
   * Qué prefijo previo sustituye este, anclado al inicio de línea. Es lo que hace que los
   * encabezados no se acumulen y que las listas sean idempotentes (AC-10).
   */
  readonly replaces: RegExp;
  /** Lo que se inserta —y queda seleccionado— cuando la línea está vacía (AC-11). */
  readonly placeholder: string;
}

/** Un bloque ya pintado, listo para que el núcleo lo coloque y lo separe de lo que tenga alrededor. */
export interface RenderedBlock {
  /** El bloque **sin** las líneas en blanco de separación: esas las pone el núcleo (AC-12, AC-13). */
  readonly text: string;
  /**
   * Qué queda seleccionado, en desplazamientos relativos al principio del bloque. `null` significa
   * que no queda nada seleccionado y el cursor se va a la línea siguiente (el separador).
   */
  readonly selection: { readonly start: number; readonly end: number } | null;
}

/** Elementos que ocupan **líneas propias**: bloque de código, tabla y separador. */
export interface BlockBehaviour {
  readonly kind: 'block';
  readonly render: (selected: string) => RenderedBlock;
  /**
   * Si el bloque se lleva la selección **dentro** (el bloque de código) o la respeta donde está (la
   * tabla y el separador). Un bloque que no la consume no puede borrarla: seleccionar un párrafo y
   * pulsar «separador» no puede hacer desaparecer el párrafo.
   */
  readonly consumesSelection: boolean;
}

/** Qué hace un elemento cuando se aplica. */
export type PaletteBehaviour = InlineBehaviour | LinePrefixBehaviour | BlockBehaviour;

/** Un elemento de la paleta, tal y como lo pinta la interfaz y lo aplica el núcleo. */
export interface PaletteElement {
  readonly id: string;
  /** Rótulo en castellano. Es el nombre accesible del botón (AC-24). */
  readonly label: string;
  /** Frase de ayuda; es el `title` del botón. */
  readonly description: string;
  readonly group: PaletteGroup;
  /**
   * Tecla del atajo, en minúscula y tal y como llega en `KeyboardEvent.key`. El modificador es
   * siempre `Ctrl`/`Cmd` (`spec.md` §6), así que no hace falta declararlo por elemento.
   */
  readonly shortcut?: string;
  readonly behaviour: PaletteBehaviour;
}

/**
 * `replaces` compartidas de `spec.md` §6: los encabezados son mutuamente excluyentes entre sí y las
 * tres listas entre sí. La alternativa de la tarea va **antes** que la de la viñeta a propósito, para
 * que `- [ ] ` se reconozca entero y no como un `- ` seguido de basura (AC-10).
 */
const REPLACES_HEADING = /^#{1,6} /;
const REPLACES_LIST = /^(- \[[ xX]\] |[-*+] |\d+\. )/;

/** Valla de código con el hueco de lenguaje **vacío** (AC-14). */
const CODE_FENCE_OPEN = '```\n';
const CODE_FENCE_CLOSE = '\n```';

/** Plantilla literal de `spec.md` §6: 3 columnas × 2 filas de cuerpo. */
const TABLE_TEMPLATE = [
  '| Encabezado 1 | Encabezado 2 | Encabezado 3 |',
  '| --- | --- | --- |',
  '| Celda | Celda | Celda |',
  '| Celda | Celda | Celda |',
].join('\n');
const TABLE_FIRST_CELL = 'Encabezado 1';

/**
 * El catálogo, en el orden en que se pinta: «Formato», «Bloques de texto» e «Insertar».
 *
 * Ese orden es también el que recorren las flechas de la paleta **atravesando los grupos** (AC-25),
 * así que reordenar esta lista reordena la navegación con teclado.
 */
export const MARKDOWN_PALETTE: readonly PaletteElement[] = [
  {
    id: 'bold',
    label: 'Negrita',
    description: 'Resalta el texto en negrita',
    group: 'format',
    shortcut: 'b',
    behaviour: {
      kind: 'inline',
      before: '**',
      after: '**',
      placeholder: 'texto en negrita',
    },
  },
  {
    id: 'italic',
    label: 'Cursiva',
    description: 'Pone el texto en cursiva',
    group: 'format',
    shortcut: 'i',
    behaviour: {
      kind: 'inline',
      before: '*',
      after: '*',
      placeholder: 'texto en cursiva',
    },
  },
  {
    id: 'strikethrough',
    label: 'Tachado',
    description: 'Tacha el texto',
    group: 'format',
    behaviour: {
      kind: 'inline',
      before: '~~',
      after: '~~',
      placeholder: 'texto tachado',
    },
  },
  {
    id: 'inlineCode',
    label: 'Código en línea',
    description: 'Marca un fragmento como código',
    group: 'format',
    behaviour: {
      kind: 'inline',
      before: '`',
      after: '`',
      placeholder: 'código',
    },
  },
  {
    id: 'heading1',
    label: 'Encabezado 1',
    description: 'Título de primer nivel',
    group: 'textBlocks',
    behaviour: {
      kind: 'linePrefix',
      prefix: { kind: 'fixed', text: '# ' },
      replaces: REPLACES_HEADING,
      placeholder: 'Encabezado 1',
    },
  },
  {
    id: 'heading2',
    label: 'Encabezado 2',
    description: 'Título de segundo nivel',
    group: 'textBlocks',
    behaviour: {
      kind: 'linePrefix',
      prefix: { kind: 'fixed', text: '## ' },
      replaces: REPLACES_HEADING,
      placeholder: 'Encabezado 2',
    },
  },
  {
    id: 'heading3',
    label: 'Encabezado 3',
    description: 'Título de tercer nivel',
    group: 'textBlocks',
    behaviour: {
      kind: 'linePrefix',
      prefix: { kind: 'fixed', text: '### ' },
      replaces: REPLACES_HEADING,
      placeholder: 'Encabezado 3',
    },
  },
  {
    id: 'quote',
    label: 'Cita',
    description: 'Convierte la línea en una cita',
    group: 'textBlocks',
    behaviour: {
      kind: 'linePrefix',
      prefix: { kind: 'fixed', text: '> ' },
      replaces: /^> /,
      placeholder: 'Cita',
    },
  },
  {
    id: 'bulletList',
    label: 'Lista con viñetas',
    description: 'Convierte las líneas en una lista con viñetas',
    group: 'textBlocks',
    behaviour: {
      kind: 'linePrefix',
      prefix: { kind: 'fixed', text: '- ' },
      replaces: REPLACES_LIST,
      placeholder: 'Elemento de la lista',
    },
  },
  {
    id: 'numberedList',
    label: 'Lista numerada',
    description: 'Convierte las líneas en una lista numerada',
    group: 'textBlocks',
    behaviour: {
      kind: 'linePrefix',
      prefix: { kind: 'numbered' },
      replaces: REPLACES_LIST,
      placeholder: 'Elemento de la lista',
    },
  },
  {
    id: 'taskList',
    label: 'Lista de tareas',
    description: 'Convierte las líneas en tareas por hacer',
    group: 'textBlocks',
    behaviour: {
      kind: 'linePrefix',
      prefix: { kind: 'fixed', text: '- [ ] ' },
      replaces: REPLACES_LIST,
      placeholder: 'Tarea pendiente',
    },
  },
  {
    id: 'link',
    label: 'Enlace',
    description: 'Inserta un enlace',
    group: 'insert',
    shortcut: 'k',
    behaviour: {
      kind: 'inline',
      before: '[',
      after: '](https://ejemplo.com)',
      placeholder: 'texto del enlace',
      selectTargetWhenWrapping: 'https://ejemplo.com',
    },
  },
  {
    id: 'image',
    label: 'Imagen',
    description: 'Inserta una imagen',
    group: 'insert',
    behaviour: {
      kind: 'inline',
      before: '![',
      after: '](https://ejemplo.com/imagen.png)',
      placeholder: 'texto alternativo',
      selectTargetWhenWrapping: 'https://ejemplo.com/imagen.png',
    },
  },
  {
    id: 'codeBlock',
    label: 'Bloque de código',
    description: 'Inserta un bloque de código',
    group: 'insert',
    behaviour: {
      kind: 'block',
      consumesSelection: true,
      render: (selected) => ({
        text: CODE_FENCE_OPEN + selected + CODE_FENCE_CLOSE,
        selection: {
          start: CODE_FENCE_OPEN.length,
          end: CODE_FENCE_OPEN.length + selected.length,
        },
      }),
    },
  },
  {
    id: 'table',
    label: 'Tabla',
    description: 'Inserta una tabla de 3 columnas',
    group: 'insert',
    behaviour: {
      kind: 'block',
      consumesSelection: false,
      render: () => ({
        text: TABLE_TEMPLATE,
        selection: {
          start: TABLE_TEMPLATE.indexOf(TABLE_FIRST_CELL),
          end: TABLE_TEMPLATE.indexOf(TABLE_FIRST_CELL) + TABLE_FIRST_CELL.length,
        },
      }),
    },
  },
  {
    id: 'divider',
    label: 'Separador',
    description: 'Inserta una línea separadora',
    group: 'insert',
    behaviour: {
      kind: 'block',
      consumesSelection: false,
      // No deja nada seleccionado: el cursor se va a la línea siguiente.
      render: () => ({ text: '---', selection: null }),
    },
  },
];
