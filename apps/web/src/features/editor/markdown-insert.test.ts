import { describe, expect, it } from 'vitest';

import { applyPaletteElement, type TextSelection } from './markdown-insert';
import type { PaletteBehaviour, PaletteElement, PaletteGroup } from './markdown-palette';

/**
 * El álgebra de inserción, entera y en cadenas puras: sin `render`, sin jsdom, sin temporizadores y
 * sin store. Lo que se afirma en cada caso son **dos** cosas —el texto resultante y la selección
 * resultante—, porque un test que solo compara el texto pasa con la selección puesta en cualquier
 * sitio, y la selección es la mitad del valor de esta funcionalidad (AC-1, AC-21).
 */

/**
 * Un elemento del catálogo reducido a lo que el núcleo mira: su `id` y su comportamiento. El rótulo
 * es contrato de interfaz y lo afirma `markdown-palette.test.ts` (AC-16); aquí sería ruido. Lo que **sí** viene literal de `spec.md` §6 son los marcadores, los marcadores de
 * posición, los prefijos y las plantillas: son las cadenas que acaban en el documento.
 */
function element(id: string, group: PaletteGroup, behaviour: PaletteBehaviour): PaletteElement {
  return { id, label: id, group, behaviour };
}

const bold = element('bold', 'format', {
  kind: 'inline',
  before: '**',
  after: '**',
  placeholder: 'texto en negrita',
});

const italic = element('italic', 'format', {
  kind: 'inline',
  before: '*',
  after: '*',
  placeholder: 'texto en cursiva',
});

const strikethrough = element('strikethrough', 'format', {
  kind: 'inline',
  before: '~~',
  after: '~~',
  placeholder: 'texto tachado',
});

const inlineCode = element('inlineCode', 'format', {
  kind: 'inline',
  before: '`',
  after: '`',
  placeholder: 'código',
});

const link = element('link', 'insert', {
  kind: 'inline',
  before: '[',
  after: '](https://ejemplo.com)',
  placeholder: 'texto del enlace',
  selectTargetWhenWrapping: 'https://ejemplo.com',
});

const image = element('image', 'insert', {
  kind: 'inline',
  before: '![',
  after: '](https://ejemplo.com/imagen.png)',
  placeholder: 'texto alternativo',
  selectTargetWhenWrapping: 'https://ejemplo.com/imagen.png',
});

/**
 * `replaces` de los tres encabezados y de las tres listas, literal de `spec.md` §6. Se escriben una
 * sola vez porque la spec las declara compartidas: los encabezados son mutuamente excluyentes entre
 * sí, y las tres listas entre sí.
 */
const REPLACES_HEADING = /^#{1,6} /;
const REPLACES_LIST = /^(- \[[ xX]\] |[-*+] |\d+\. )/;

const heading1 = element('heading1', 'textBlocks', {
  kind: 'linePrefix',
  prefix: { kind: 'fixed', text: '# ' },
  replaces: REPLACES_HEADING,
  placeholder: 'Encabezado 1',
});

const heading2 = element('heading2', 'textBlocks', {
  kind: 'linePrefix',
  prefix: { kind: 'fixed', text: '## ' },
  replaces: REPLACES_HEADING,
  placeholder: 'Encabezado 2',
});

const quote = element('quote', 'textBlocks', {
  kind: 'linePrefix',
  prefix: { kind: 'fixed', text: '> ' },
  replaces: /^> /,
  placeholder: 'Cita',
});

const bulletList = element('bulletList', 'textBlocks', {
  kind: 'linePrefix',
  prefix: { kind: 'fixed', text: '- ' },
  replaces: REPLACES_LIST,
  placeholder: 'Elemento de la lista',
});

const numberedList = element('numberedList', 'textBlocks', {
  kind: 'linePrefix',
  prefix: { kind: 'numbered' },
  replaces: REPLACES_LIST,
  placeholder: 'Elemento de la lista',
});

const taskList = element('taskList', 'textBlocks', {
  kind: 'linePrefix',
  prefix: { kind: 'fixed', text: '- [ ] ' },
  replaces: REPLACES_LIST,
  placeholder: 'Tarea pendiente',
});

const CODE_FENCE_OPEN = '```\n';
const CODE_FENCE_CLOSE = '\n```';

const codeBlock = element('codeBlock', 'insert', {
  kind: 'block',
  // El bloque de código sí se lleva la selección dentro de la valla (AC-14).
  consumesSelection: true,
  render: (selected) => ({
    text: CODE_FENCE_OPEN + selected + CODE_FENCE_CLOSE,
    selection: { start: CODE_FENCE_OPEN.length, end: CODE_FENCE_OPEN.length + selected.length },
  }),
});

/** Plantilla literal de `spec.md` §6: 3 columnas × 2 filas de cuerpo. */
const TABLE_TEMPLATE = [
  '| Encabezado 1 | Encabezado 2 | Encabezado 3 |',
  '| --- | --- | --- |',
  '| Celda | Celda | Celda |',
  '| Celda | Celda | Celda |',
].join('\n');
const TABLE_FIRST_CELL = 'Encabezado 1';

const table = element('table', 'insert', {
  kind: 'block',
  consumesSelection: false,
  render: () => ({
    text: TABLE_TEMPLATE,
    selection: {
      start: TABLE_TEMPLATE.indexOf(TABLE_FIRST_CELL),
      end: TABLE_TEMPLATE.indexOf(TABLE_FIRST_CELL) + TABLE_FIRST_CELL.length,
    },
  }),
});

const divider = element('divider', 'insert', {
  kind: 'block',
  consumesSelection: false,
  // El separador no deja nada seleccionado: el cursor se va a la línea siguiente.
  render: () => ({ text: '---', selection: null }),
});

/** Azúcar para leer los casos: `[start, end]` en vez de dos campos sueltos. */
function at(text: string, selectionStart: number, selectionEnd = selectionStart): TextSelection {
  return { text, selectionStart, selectionEnd };
}

describe('núcleo de inserción · elementos que envuelven', () => {
  it('envuelve la selección y la deja cubriendo el texto, no los marcadores (AC-1)', () => {
    const result = applyPaletteElement(bold, at('hola mundo', 0, 4));

    expect(result.text).toBe('**hola** mundo');
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(6);
  });

  it('encadenar dos elementos vuelve a envolver el texto, no los asteriscos (AC-1)', () => {
    // La entrada y la salida tienen la misma forma justamente para poder componer sin maquinaria:
    // si la selección de AC-1 cubriera los marcadores, esto daría `**hola****` o algo peor.
    const negrita = applyPaletteElement(bold, at('hola mundo', 0, 4));
    const cursiva = applyPaletteElement(italic, negrita);

    expect(cursiva.text).toBe('***hola*** mundo');
    expect(cursiva.selectionStart).toBe(3);
    expect(cursiva.selectionEnd).toBe(7);
  });

  it('sin selección inserta el marcador de posición y lo deja seleccionado entero (AC-2)', () => {
    const result = applyPaletteElement(bold, at('hola ', 5));

    expect(result.text).toBe('hola **texto en negrita**');
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(23);
    // La siguiente tecla tiene que sustituir el marcador de posición y nada más.
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('texto en negrita');
  });

  it('envuelve una selección multilínea entera, sin partirla por líneas (AC-3)', () => {
    const result = applyPaletteElement(bold, at('primera\nsegunda', 0, 15));

    expect(result.text).toBe('**primera\nsegunda**');
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(17);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('primera\nsegunda');
  });

  it('envuelve una selección multilínea parcial por sus extremos exactos (AC-3)', () => {
    const result = applyPaletteElement(inlineCode, at('primera\nsegunda', 4, 11));

    expect(result.text).toBe('prim`era\nseg`unda');
    expect(result.selectionStart).toBe(5);
    expect(result.selectionEnd).toBe(12);
  });

  const marcadores: ReadonlyArray<
    readonly [string, PaletteElement, string, string, readonly [number, number]]
  > = [
    ['bold', bold, '**hola** mundo', 'hola **texto en negrita**', [2, 6]],
    ['italic', italic, '*hola* mundo', 'hola *texto en cursiva*', [1, 5]],
    ['strikethrough', strikethrough, '~~hola~~ mundo', 'hola ~~texto tachado~~', [2, 6]],
    ['inlineCode', inlineCode, '`hola` mundo', 'hola `código`', [1, 5]],
  ];

  it.each(marcadores)(
    '«%s» usa los marcadores del catálogo y deja «hola» seleccionado (AC-4)',
    (_id, elemento, esperado, _sinSeleccion, [inicio, fin]) => {
      const result = applyPaletteElement(elemento, at('hola mundo', 0, 4));

      expect(result.text).toBe(esperado);
      expect(result.selectionStart).toBe(inicio);
      expect(result.selectionEnd).toBe(fin);
      expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('hola');
    },
  );

  it.each(marcadores)(
    '«%s» sin selección inserta su marcador de posición de `spec.md` §6 (AC-4)',
    (_id, elemento, _conSeleccion, esperado) => {
      const result = applyPaletteElement(elemento, at('hola ', 5));

      expect(result.text).toBe(esperado);
      expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe(
        elemento.behaviour.kind === 'inline' ? elemento.behaviour.placeholder : '',
      );
    },
  );
});

describe('núcleo de inserción · enlace e imagen', () => {
  it('con selección, el enlace envuelve el rótulo y deja seleccionada la URL (AC-5)', () => {
    const result = applyPaletteElement(link, at('mira la web', 8, 11));

    expect(result.text).toBe('mira la [web](https://ejemplo.com)');
    // Lo que la persona escribió es el rótulo; lo que falta por rellenar es el destino.
    expect(result.selectionStart).toBe(14);
    expect(result.selectionEnd).toBe(33);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe(
      'https://ejemplo.com',
    );
  });

  it('con selección, la imagen deja seleccionada la URL y no el texto alternativo (AC-5)', () => {
    const result = applyPaletteElement(image, at('mira la foto', 8, 12));

    expect(result.text).toBe('mira la ![foto](https://ejemplo.com/imagen.png)');
    expect(result.selectionStart).toBe(16);
    expect(result.selectionEnd).toBe(46);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe(
      'https://ejemplo.com/imagen.png',
    );
  });

  it('sin selección, el enlace deja seleccionado el rótulo (AC-6)', () => {
    const result = applyPaletteElement(link, at('', 0));

    expect(result.text).toBe('[texto del enlace](https://ejemplo.com)');
    expect(result.selectionStart).toBe(1);
    expect(result.selectionEnd).toBe(17);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('texto del enlace');
  });

  it('sin selección, la imagen deja seleccionado el texto alternativo (AC-6)', () => {
    const result = applyPaletteElement(image, at('', 0));

    expect(result.text).toBe('![texto alternativo](https://ejemplo.com/imagen.png)');
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(19);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('texto alternativo');
  });

  it('el enlace no arrastra el `selectTargetWhenWrapping` al caso sin selección (AC-6)', () => {
    // Si la marca se aplicara siempre, sin selección quedaría seleccionada la URL y la plantilla
    // recién insertada obligaría a volver atrás a escribir el rótulo.
    const result = applyPaletteElement(link, at('hola ', 5));

    expect(result.text.slice(result.selectionStart, result.selectionEnd)).not.toBe(
      'https://ejemplo.com',
    );
  });

  it('los elementos que envuelven sin la marca siguen seleccionando el contenido (AC-4, AC-5)', () => {
    // La marca es de `link`/`image`, no de la familia entera: la regresión evidente al implementar
    // AC-5 es dejar seleccionado el `after` de todos.
    const result = applyPaletteElement(bold, at('mira la web', 8, 11));

    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('web');
  });
});

describe('núcleo de inserción · prefijos de línea', () => {
  it('prefija al principio de la línea y desplaza el cursor lo que mide el prefijo (AC-7)', () => {
    const result = applyPaletteElement(heading2, at('una línea', 4));

    expect(result.text).toBe('## una línea');
    // El prefijo va al principio de la línea; el cursor conserva su posición relativa en la prosa.
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(7);
  });

  it('sobre una línea con texto no inserta ningún marcador de posición (AC-7, AC-11)', () => {
    const result = applyPaletteElement(heading2, at('una línea', 9));

    expect(result.text).toBe('## una línea');
    expect(result.text).not.toContain('Encabezado 2');
    expect(result.selectionStart).toBe(12);
    expect(result.selectionEnd).toBe(12);
  });

  it('prefija las tres líneas seleccionadas y cubre el bloque entero (AC-8)', () => {
    const result = applyPaletteElement(bulletList, at('uno\ndos\ntres', 0, 12));

    expect(result.text).toBe('- uno\n- dos\n- tres');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(18);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe(
      '- uno\n- dos\n- tres',
    );
  });

  it('numera 1./2./3. en orden (AC-8)', () => {
    const result = applyPaletteElement(numberedList, at('uno\ndos\ntres', 0, 12));

    expect(result.text).toBe('1. uno\n2. dos\n3. tres');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(21);
  });

  it('una selección que empieza a media línea prefija la línea entera igual (AC-8)', () => {
    const result = applyPaletteElement(bulletList, at('uno\ndos\ntres', 1, 5));

    expect(result.text).toBe('- uno\n- dos\ntres');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(11);
  });

  it('una selección que acaba en el salto de línea no arrastra la línea siguiente (AC-8)', () => {
    // Seleccionar «uno\n» entero es seleccionar **una** línea, no dos. Es el caso que separa un
    // rango de líneas bien calculado de uno que se pasa por el final.
    const result = applyPaletteElement(bulletList, at('uno\ndos', 0, 4));

    expect(result.text).toBe('- uno\ndos');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(5);
  });

  it('las líneas vacías del rango no reciben prefijo (AC-9)', () => {
    const result = applyPaletteElement(bulletList, at('uno\n\ndos', 0, 8));

    // Un `- ` colgado en medio parte la lista en dos.
    expect(result.text).toBe('- uno\n\n- dos');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(12);
  });

  it('las líneas vacías tampoco cuentan para la numeración (AC-9)', () => {
    const result = applyPaletteElement(numberedList, at('uno\n\ndos\n\n\ntres', 0, 15));

    // Si la numeración contara líneas del rango en vez de líneas prefijadas, saldría 1./3./6.
    expect(result.text).toBe('1. uno\n\n2. dos\n\n\n3. tres');
  });

  it('una línea de solo espacios tampoco recibe prefijo ni número (AC-9)', () => {
    const result = applyPaletteElement(numberedList, at('uno\n   \ndos', 0, 11));

    expect(result.text).toBe('1. uno\n   \n2. dos');
  });

  it('los encabezados se sustituyen entre sí en vez de acumularse (AC-10)', () => {
    expect(applyPaletteElement(heading2, at('# título', 0)).text).toBe('## título');
    expect(applyPaletteElement(heading1, at('###### título', 0)).text).toBe('# título');
    expect(applyPaletteElement(heading2, at('## título', 0)).text).toBe('## título');
  });

  it('la lista con viñetas es idempotente sobre una línea que ya la tiene (AC-10)', () => {
    const result = applyPaletteElement(bulletList, at('- ya', 4));

    expect(result.text).toBe('- ya');
    // Idempotente de verdad: ni `- - ya`, ni un cursor movido de sitio.
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it('la cita es idempotente y las listas se sustituyen entre sí (AC-10)', () => {
    expect(applyPaletteElement(quote, at('> ya', 0)).text).toBe('> ya');
    expect(applyPaletteElement(bulletList, at('1. ya', 0)).text).toBe('- ya');
    expect(applyPaletteElement(bulletList, at('* ya', 0)).text).toBe('- ya');
    expect(applyPaletteElement(numberedList, at('- ya', 0)).text).toBe('1. ya');
  });

  it('la lista de tareas sobre una línea con viñeta da `- [ ] ` y no `- - [ ] ` (AC-10)', () => {
    const result = applyPaletteElement(taskList, at('- ya', 4));

    expect(result.text).toBe('- [ ] ya');
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(8);
  });

  it('la lista de tareas es idempotente sobre una tarea ya marcada (AC-10)', () => {
    expect(applyPaletteElement(taskList, at('- [ ] ya', 0)).text).toBe('- [ ] ya');
    expect(applyPaletteElement(taskList, at('- [x] ya', 0)).text).toBe('- [ ] ya');
    expect(applyPaletteElement(bulletList, at('- [ ] ya', 0)).text).toBe('- ya');
  });

  it('en una línea vacía inserta prefijo y marcador de posición seleccionado (AC-11)', () => {
    const result = applyPaletteElement(heading2, at('', 0));

    expect(result.text).toBe('## Encabezado 2');
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(15);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('Encabezado 2');
  });

  it('en una línea vacía en medio del documento hace lo mismo, en su sitio (AC-11)', () => {
    const result = applyPaletteElement(heading2, at('uno\n\ndos', 4));

    expect(result.text).toBe('uno\n## Encabezado 2\ndos');
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(19);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('Encabezado 2');
  });

  it('la lista numerada empieza en 1 cuando entra en una línea vacía (AC-11)', () => {
    const result = applyPaletteElement(numberedList, at('', 0));

    expect(result.text).toBe('1. Elemento de la lista');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe(
      'Elemento de la lista',
    );
  });
});

describe('núcleo de inserción · bloques', () => {
  it('el separador en un documento vacío da exactamente `---\\n` (AC-12)', () => {
    const result = applyPaletteElement(divider, at('', 0));

    expect(result.text).toBe('---\n');
    // Ni una línea en blanco por delante: el documento recién creado empieza por el separador.
    expect(result.text.startsWith('\n')).toBe(false);
    // Y el cursor se queda en la línea siguiente, sin nada seleccionado.
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it('deja una sola línea en blanco por arriba cuando hay texto antes (AC-13)', () => {
    const result = applyPaletteElement(divider, at('párrafo anterior', 16));

    expect(result.text).toBe('párrafo anterior\n\n---\n');
  });

  it('no crea una segunda línea en blanco cuando ya la había (AC-13)', () => {
    // Contar los `\n` que ya hay y añadir solo los que falten. Concatenar `\n\n` a ciegas daría
    // `párrafo anterior\n\n\n\n---\n`.
    const result = applyPaletteElement(divider, at('párrafo anterior\n\n', 18));

    expect(result.text).toBe('párrafo anterior\n\n---\n');
  });

  it('separa por arriba y por abajo cuando hay texto a los dos lados (AC-13)', () => {
    const result = applyPaletteElement(divider, at('uno\ndos', 3));

    expect(result.text).toBe('uno\n\n---\n\ndos');
  });

  it('tampoco duplica la separación de abajo cuando ya existía (AC-13)', () => {
    const result = applyPaletteElement(divider, at('uno\n\ndos', 3));

    expect(result.text).toBe('uno\n\n---\n\ndos');
  });

  it('no se mete en medio de un párrafo: corta por el borde de línea (AC-13)', () => {
    const result = applyPaletteElement(divider, at('párrafo anterior', 3));

    expect(result.text).toBe('---\n\npárrafo anterior');
    expect(result.text).not.toContain('pár\n');
  });

  it('el separador con selección no se lleva por delante el texto seleccionado (AC-13)', () => {
    // El separador no consume la selección: si la borrara, un clic destruiría lo que hubiera
    // seleccionado sin decir nada.
    const result = applyPaletteElement(divider, at('uno\ndos', 0, 3));

    expect(result.text).toContain('uno');
    expect(result.text).toBe('uno\n\n---\n\ndos');
  });

  it('el bloque de código sin selección deja el hueco de lenguaje vacío y el cursor dentro (AC-14)', () => {
    const result = applyPaletteElement(codeBlock, at('', 0));

    expect(result.text).toBe('```\n\n```\n');
    // Hueco de lenguaje vacío: nada entre la valla de apertura y el salto de línea.
    expect(result.text.startsWith('```\n')).toBe(true);
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it('el bloque de código mete la selección dentro de la valla y la deja seleccionada (AC-14)', () => {
    const result = applyPaletteElement(codeBlock, at('hola mundo', 0, 4));

    expect(result.text).toBe('```\nhola\n```\n\n mundo');
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(8);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('hola');
  });

  it('el bloque de código admite una selección multilínea entera (AC-14)', () => {
    const result = applyPaletteElement(codeBlock, at('uno\ndos', 0, 7));

    expect(result.text).toBe('```\nuno\ndos\n```\n');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('uno\ndos');
  });

  it('la tabla inserta la plantilla de `spec.md` §6 con la primera celda seleccionada (AC-15)', () => {
    const result = applyPaletteElement(table, at('', 0));

    expect(result.text).toBe(
      '| Encabezado 1 | Encabezado 2 | Encabezado 3 |\n' +
        '| --- | --- | --- |\n' +
        '| Celda | Celda | Celda |\n' +
        '| Celda | Celda | Celda |\n',
    );
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(14);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('Encabezado 1');
  });

  it('la tabla se separa del párrafo anterior igual que cualquier bloque (AC-13, AC-15)', () => {
    const result = applyPaletteElement(table, at('párrafo anterior', 16));

    expect(result.text.startsWith('párrafo anterior\n\n| Encabezado 1 |')).toBe(true);
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('Encabezado 1');
  });
});
