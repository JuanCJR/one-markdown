import { describe, expect, it } from 'vitest';

import { rehypeRawAsText, type HastLikeNode } from './rehype-raw-as-text';

/**
 * Capa 2 del modelo de amenaza (`plan.md` §2.2): convertir cada nodo `raw` en un nodo `text`.
 *
 * No es una capa de seguridad —de eso se encargan la 1 (no instalar `rehype-raw`) y la 3
 * (`rehype-sanitize`)—: es la que hace que la 3 **no cueste datos**. Sin ella `hast-util-sanitize`
 * descarta los nodos `raw` y con ellos desaparece prosa que la persona escribió (`plan.md` §1.3).
 *
 * Se prueba sobre un árbol hast **construido a mano**, sin parsear markdown: lo que se afirma es la
 * transformación, no el parser de nadie.
 */

/** El árbol de prueba, recreado en cada caso porque la transformación muta en el sitio. */
function sampleTree(): HastLikeNode {
  return {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'h1',
        properties: { id: 'titulo' },
        children: [{ type: 'text', value: 'Título' }],
      },
      { type: 'raw', value: '<script>alert(1)</script>' },
      {
        type: 'element',
        tagName: 'blockquote',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'p',
            properties: {},
            children: [
              { type: 'text', value: 'antes ' },
              { type: 'raw', value: '<b>', position: { start: { line: 3 }, end: { line: 3 } } },
              { type: 'text', value: 'negrita' },
              { type: 'raw', value: '</b>' },
              { type: 'text', value: ' después' },
            ],
          },
        ],
      },
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-js'] },
            children: [{ type: 'text', value: 'alert(1)' }],
          },
        ],
      },
    ],
  };
}

/** Los hijos de un nodo, o el fallo del test si el nodo que se buscaba no está donde se creía. */
function childrenOf(node: HastLikeNode | undefined): HastLikeNode[] {
  expect(node?.children).toBeDefined();

  return node?.children ?? [];
}

describe('rehypeRawAsText', () => {
  it('convierte un nodo raw de primer nivel en un nodo text con el mismo value', () => {
    const tree = sampleTree();

    rehypeRawAsText()(tree);

    expect(childrenOf(tree)[1]).toMatchObject({
      type: 'text',
      value: '<script>alert(1)</script>',
    });
  });

  it('convierte también los raw anidados dentro de un blockquote', () => {
    const tree = sampleTree();

    rehypeRawAsText()(tree);

    const paragraph = childrenOf(childrenOf(tree)[2])[0];
    const inline = childrenOf(paragraph);

    expect(inline.map((node) => node.type)).toEqual(['text', 'text', 'text', 'text', 'text']);
    expect(inline.map((node) => node['value'])).toEqual([
      'antes ',
      '<b>',
      'negrita',
      '</b>',
      ' después',
    ]);
  });

  it('no toca ningún otro nodo: el árbol resultante es el de partida con raw → text', () => {
    const tree = sampleTree();
    const expected = sampleTree();

    // Lo único que puede cambiar es el `type` de los tres nodos `raw`. Todo lo demás —`tagName`,
    // `properties`, la clase del bloque de código, la `position` de uno de los raw— sigue
    // exactamente igual, y se afirma comparando el árbol entero.
    const expectedTop = childrenOf(expected);
    const expectedInline = childrenOf(childrenOf(expectedTop[2])[0]);

    for (const node of [expectedTop[1], expectedInline[1], expectedInline[3]]) {
      expect(node?.type).toBe('raw');

      if (node !== undefined) {
        node.type = 'text';
      }
    }

    rehypeRawAsText()(tree);

    expect(tree).toEqual(expected);
  });

  it('deja intacto un árbol sin ningún raw', () => {
    const tree: HastLikeNode = { type: 'root', children: [{ type: 'text', value: 'solo texto' }] };

    rehypeRawAsText()(tree);

    expect(tree).toEqual({ type: 'root', children: [{ type: 'text', value: 'solo texto' }] });
  });

  it('no falla ante un nodo sin children', () => {
    const tree: HastLikeNode = { type: 'root' };

    expect(() => rehypeRawAsText()(tree)).not.toThrow();
    expect(tree).toEqual({ type: 'root' });
  });

  it('conserva la position del nodo convertido, para que el mapa de origen siga sirviendo', () => {
    const tree = sampleTree();

    rehypeRawAsText()(tree);

    const converted = childrenOf(childrenOf(childrenOf(tree)[2])[0])[1];

    expect(converted?.['position']).toEqual({ start: { line: 3 }, end: { line: 3 } });
  });
});
