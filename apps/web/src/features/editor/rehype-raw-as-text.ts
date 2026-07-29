/**
 * Capa 2 del modelo de amenaza de la vista previa (`plan.md` §2.2): convertir cada nodo `raw` del
 * árbol hast en un nodo `text` con el **mismo** valor.
 *
 * ## Por qué existe
 *
 * `react-markdown` deja el HTML que aparece escrito en el markdown como nodos `raw`, y sin
 * `rehype-raw` —que **no se instala a propósito**— esos nodos nunca se convierten en elementos. El
 * problema no es la seguridad, es la **pérdida de datos**: `hast-util-sanitize` descarta los nodos
 * `raw`, y con ellos se lleva prosa que la persona escribió. Está medido (`plan.md` §1.3):
 * `<!-- oculto -->visible` se quedaba en cadena vacía, porque markdown trata la línea entera como un
 * bloque HTML y «visible» viajaba dentro del mismo nodo `raw` que el comentario.
 *
 * Convertirlos en nodos de **texto** antes de sanear resuelve las dos cosas a la vez: un nodo de
 * texto es estrictamente menos poderoso que un elemento —React lo escapa al renderizar, así que no
 * puede introducir nada— y `rehype-sanitize` ya no tiene nada que borrar. Es también la postura de
 * producto que la spec aprobó de forma explícita (spec §5, decisión C): **el HTML embebido se
 * muestra como texto literal y no se renderiza nunca**.
 *
 * ## Por qué no usa `unist-util-visit`
 *
 * Recorre `children` a mano, sin dependencias. `unist-util-visit` está hoy en `node_modules` solo
 * como dependencia **transitiva** del ecosistema `unified`: usarlo aquí ataría una capa del modelo
 * de amenaza a un paquete que nadie de este repositorio ha declarado y que mañana puede no estar.
 * Doce líneas propias con test propio salen más baratas.
 */

/**
 * Un nodo de hast visto desde aquí: solo hace falta su `type` y sus hijos.
 *
 * El resto de campos (`value`, `tagName`, `properties`, `position`, …) viajan por la firma de
 * índice y **no se tocan**: la conversión cambia el `type` en el sitio, así que la posición en el
 * origen y todo lo demás sobreviven intactos.
 */
export interface HastLikeNode {
  /** `root`, `element`, `text`, `raw`, … */
  type: string;
  /** Hijos del nodo, si es de los que tienen. */
  children?: HastLikeNode[];
  /** Cualquier otro campo del nodo, que esta transformación no mira ni modifica. */
  [field: string]: unknown;
}

/**
 * Plugin de rehype. Va **antes** de `rehype-sanitize` en la cadena: primero se degrada el HTML a
 * texto, después se sanea el árbol resultante.
 */
export function rehypeRawAsText(): (tree: HastLikeNode) => void {
  return function transform(tree: HastLikeNode): void {
    rawToText(tree);
  };
}

/** Recorrido en profundidad. Un nodo `raw` no tiene hijos, así que convertirlo termina la rama. */
function rawToText(node: HastLikeNode): void {
  if (node.type === 'raw') {
    node.type = 'text';

    return;
  }

  for (const child of node.children ?? []) {
    rawToText(child);
  }
}
