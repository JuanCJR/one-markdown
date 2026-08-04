import type { TreeNode } from './tree-nodes';
import { accionesDeFila } from '../../shared/textos/textos';

/** Lo que se puede hacer sobre un nodo desde su propia fila. */
export type TreeNodeAction = 'create' | 'rename' | 'move' | 'delete';

interface TreeNodeRowProps {
  readonly node: TreeNode;
  readonly selected: boolean;
  /** Es el único nodo del árbol dentro del orden de tabulación (roving tabindex). */
  readonly tabbable: boolean;
  /** Hay una mutación en vuelo: ninguna fila acepta empezar otra. */
  readonly busy: boolean;
  /** Abrir el diálogo que corresponda. La fila no sabe nada de la red ni del store. */
  readonly onAction: (action: TreeNodeAction, node: TreeNode) => void;
  /** El `role="group"` con los hijos visibles, si el nodo está expandido y tiene alguno. */
  readonly children?: React.ReactNode;
}

/**
 * Un nodo del árbol: el `role="treeitem"` y, dentro, su fila visible y el grupo de sus hijos.
 *
 * El grupo cuelga **dentro** del `treeitem` (patrón *tree* de WAI-ARIA), así que el elemento
 * enfocable ocupa todo el subárbol: lo que se pinta al seleccionar o enfocar es la fila (`> div`),
 * no la caja entera, de ahí los selectores de hijo directo en las clases.
 *
 * El nombre accesible se ata con `aria-labelledby` a la etiqueta y no se deduce del contenido: si
 * no, los botones de acción lo convertirían en «Notas Renombrar Notas Borrar Notas».
 *
 * Los botones son la **única** excepción a «esta fila no tiene manejadores»: el ratón y el teclado
 * del árbol siguen atendiéndose delegados en el `role="tree"`, y por eso cada botón corta la
 * propagación de su clic (si no, pulsar «Borrar» seleccionaría además el nodo). Su `tabIndex` sigue
 * al de la fila para que el roving tabindex siga ofreciendo **una** puerta de entrada al árbol.
 */
export function TreeNodeRow({
  node,
  selected,
  tabbable,
  busy,
  onAction,
  children,
}: TreeNodeRowProps): React.JSX.Element {
  const labelId = `tree-node-label-${node.id}`;
  const isDirectory = node.kind === 'directory';

  return (
    <div
      role="treeitem"
      data-node-id={node.id}
      aria-level={node.level}
      aria-selected={selected}
      aria-labelledby={labelId}
      aria-expanded={isDirectory ? node.expanded : undefined}
      tabIndex={tabbable ? 0 : -1}
      className="outline-none"
    >
      <div
        style={{ paddingInlineStart: `${0.25 + (node.level - 1) * 0.75}rem` }}
        className="flex min-h-8 items-center gap-1 py-1 pr-1 text-sm text-tinta-secundaria hover:bg-sup-hundida [[role=treeitem][aria-selected=true]>&]:bg-sup-hundida [[role=treeitem][aria-selected=true]>&]:font-black [[role=treeitem][aria-selected=true]>&]:text-tinta [[role=treeitem]:focus-visible>&]:foco-cromo"
      >
        <span id={labelId} className="flex min-w-0 flex-1 cursor-default items-center gap-1.5 px-1">
          {/*
            «El presente»: el único trabajo de cromo. Masa de 8 px, que es el mínimo de R5, y no un
            color de texto ni un borde. Los otros dos canales del nodo seleccionado son el escalón de
            superficie (la fila sube a `hundida`) y el peso 900, para que la selección siga
            leyéndose en escala de grises y con el amarillo apagado.
            El presupuesto (04-color.md §8) admite un solo `presente` por viewport, y el árbol es de
            selección única: `aria-selected` solo es cierto en una fila.
          */}
          {selected ? (
            <span aria-hidden="true" data-cromo="presente" className="size-2 shrink-0 bg-cromo" />
          ) : null}
          {isDirectory ? <ChevronIcon expanded={node.expanded} /> : <DocumentIcon />}
          <span className="truncate">{node.name}</span>
        </span>

        {isDirectory ? (
          <RowActionButton
            label={accionesDeFila.nuevoEn(node.name)}
            tabbable={tabbable}
            busy={busy}
            onActivate={() => {
              onAction('create', node);
            }}
          >
            <path d="M7.25 3.5h1.5v3.75h3.75v1.5H8.75v3.75h-1.5V8.75H3.5v-1.5h3.75V3.5Z" />
          </RowActionButton>
        ) : null}

        <RowActionButton
          label={accionesDeFila.renombrar(node.name)}
          tabbable={tabbable}
          busy={busy}
          onActivate={() => {
            onAction('rename', node);
          }}
        >
          <path d="m11.2 2.3 2.5 2.5-1.4 1.4-2.5-2.5 1.4-1.4ZM8.7 4.8l2.5 2.5-6 6H2.7v-2.5l6-6Z" />
        </RowActionButton>

        <RowActionButton
          label={accionesDeFila.mover(node.name)}
          tabbable={tabbable}
          busy={busy}
          onActivate={() => {
            onAction('move', node);
          }}
        >
          <path d="M8 1.5 11.5 5H9v4.5H7V5H4.5L8 1.5ZM2.5 11h11v3.5h-11V11Z" />
        </RowActionButton>

        <RowActionButton
          label={accionesDeFila.borrar(node.name)}
          tabbable={tabbable}
          busy={busy}
          onActivate={() => {
            onAction('delete', node);
          }}
        >
          <path d="M6.5 1.5h3l.5 1H13v1.5H3V2.5h3l.5-1ZM4 5h8l-.6 8.2a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8L4 5Z" />
        </RowActionButton>
      </div>

      {children}
    </div>
  );
}

interface RowActionButtonProps {
  /**
   * Nombre accesible completo: incluye el nombre del nodo, no solo el verbo.
   *
   * **Ya no hay `title`.** Duplicaba esta misma cadena en un tooltip nativo que solo aparece con el
   * ratón, tarda medio segundo y no se puede leer con el teclado — y la fase 0 contó veinte iguales
   * (§4.13). Lo que hace falta es que la palabra esté **visible**, no que aparezca al pasar por
   * encima: eso es trabajo del restyle, y quitarlo ahora es lo que deja de fingir que ya estaba.
   */
  readonly label: string;
  readonly tabbable: boolean;
  readonly busy: boolean;
  readonly onActivate: () => void;
  /** El trazo del icono. Decorativo: quien nombra el botón es `aria-label`. */
  readonly children: React.ReactNode;
}

/**
 * `outline-solid` es obligatorio aquí: el `treeitem` lleva `outline-none`, que en Tailwind 4 fija
 * `--tw-outline-style: none`, y la propiedad se **hereda** hasta este botón. Sin él, el anillo de
 * foco se declara pero no se pinta (la lección de T-019).
 */
function RowActionButton({
  label,
  tabbable,
  busy,
  onActivate,
  children,
}: RowActionButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={busy}
      tabIndex={tabbable ? 0 : -1}
      onClick={(event) => {
        event.stopPropagation();
        onActivate();
      }}
      className="grid size-6 shrink-0 place-items-center text-tinta-tenue outline-solid outline-0 hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 16 16"
        className="size-3.5 fill-current"
      >
        {children}
      </svg>
    </button>
  );
}

/** Indicador de plegado. Decorativo: el estado real lo dice `aria-expanded` en el `treeitem`. */
function ChevronIcon({ expanded }: { readonly expanded: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className={`size-3.5 shrink-0 fill-current text-tinta-tenue transition-transform ${
        expanded ? 'rotate-90' : ''
      }`}
    >
      <path d="M6 3.5 10.5 8 6 12.5V3.5Z" />
    </svg>
  );
}

function DocumentIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0 fill-current text-tinta-tenue"
    >
      <path d="M4 1.5h5l3.5 3.5v9.5h-8.5V1.5Zm5 1v2.5h2.5L9 2.5Z" />
    </svg>
  );
}
