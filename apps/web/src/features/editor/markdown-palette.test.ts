import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { applyPaletteElement } from './markdown-insert';
import { MARKDOWN_PALETTE, PALETTE_GROUP_LABELS, type PaletteGroup } from './markdown-palette';

/**
 * El catálogo es **contrato de producto** (`spec.md` §6): son las etiquetas que lee la persona y las
 * cadenas exactas que acaban en su documento. Este archivo lo afirma entero —una fila por
 * elemento— y añade las dos guardas que el paso del tiempo hace falta:
 *
 * - **exhaustividad** (AC-18): añadir un elemento sin cubrirlo pone el test en rojo aquí y no en
 *   producción;
 * - **pureza** (AC-17): el núcleo y el catálogo no pueden aprenderse React, el store ni el DOM. No
 *   es una convención de estilo revisable a ojo, se comprueba **leyendo el código fuente**, mismo
 *   patrón que `no-dangerous-html.test.ts` de la `003`.
 */

/** Plantilla literal de `spec.md` §6: 3 columnas × 2 filas de cuerpo. */
const TABLE_TEMPLATE = [
  '| Encabezado 1 | Encabezado 2 | Encabezado 3 |',
  '| --- | --- | --- |',
  '| Celda | Celda | Celda |',
  '| Celda | Celda | Celda |',
].join('\n');

/**
 * Una fila por elemento de `spec.md` §6, en el orden en que la paleta los pinta.
 *
 * `text` y `selected` son el resultado de aplicar el elemento a un **documento vacío**: es la forma
 * más corta de fijar a la vez la plantilla literal de la spec y lo que queda seleccionado.
 */
interface CatalogRow {
  readonly id: string;
  readonly group: PaletteGroup;
  readonly label: string;
  /** Tecla del atajo (siempre con `Ctrl`/`Cmd`), o `null` si el elemento no tiene. */
  readonly shortcut: string | null;
  readonly text: string;
  readonly selected: string;
}

const CATALOG: readonly CatalogRow[] = [
  {
    id: 'bold',
    group: 'format',
    label: 'Negrita',
    shortcut: 'b',
    text: '**texto en negrita**',
    selected: 'texto en negrita',
  },
  {
    id: 'italic',
    group: 'format',
    label: 'Cursiva',
    shortcut: 'i',
    text: '*texto en cursiva*',
    selected: 'texto en cursiva',
  },
  {
    id: 'strikethrough',
    group: 'format',
    label: 'Tachado',
    shortcut: null,
    text: '~~texto tachado~~',
    selected: 'texto tachado',
  },
  {
    id: 'inlineCode',
    group: 'format',
    label: 'Código',
    shortcut: null,
    text: '`código`',
    selected: 'código',
  },
  {
    id: 'heading1',
    group: 'textBlocks',
    label: 'Encabezado 1',
    shortcut: null,
    text: '# Encabezado 1',
    selected: 'Encabezado 1',
  },
  {
    id: 'heading2',
    group: 'textBlocks',
    label: 'Encabezado 2',
    shortcut: null,
    text: '## Encabezado 2',
    selected: 'Encabezado 2',
  },
  {
    id: 'heading3',
    group: 'textBlocks',
    label: 'Encabezado 3',
    shortcut: null,
    text: '### Encabezado 3',
    selected: 'Encabezado 3',
  },
  {
    id: 'quote',
    group: 'textBlocks',
    label: 'Cita',
    shortcut: null,
    text: '> Cita',
    selected: 'Cita',
  },
  {
    id: 'bulletList',
    group: 'textBlocks',
    label: 'Lista con viñetas',
    shortcut: null,
    text: '- Elemento de la lista',
    selected: 'Elemento de la lista',
  },
  {
    id: 'numberedList',
    group: 'textBlocks',
    label: 'Lista numerada',
    shortcut: null,
    text: '1. Elemento de la lista',
    selected: 'Elemento de la lista',
  },
  {
    id: 'taskList',
    group: 'textBlocks',
    label: 'Lista de cosas por hacer',
    shortcut: null,
    text: '- [ ] Tarea pendiente',
    selected: 'Tarea pendiente',
  },
  {
    id: 'link',
    group: 'insert',
    label: 'Enlace',
    shortcut: 'k',
    text: '[texto del enlace](https://ejemplo.com)',
    selected: 'texto del enlace',
  },
  {
    id: 'image',
    group: 'insert',
    label: 'Imagen',
    shortcut: null,
    text: '![texto alternativo](https://ejemplo.com/imagen.png)',
    selected: 'texto alternativo',
  },
  {
    id: 'codeBlock',
    group: 'insert',
    label: 'Código en bloque',
    shortcut: null,
    text: '```\n\n```\n',
    selected: '',
  },
  {
    id: 'table',
    group: 'insert',
    label: 'Tabla',
    shortcut: null,
    text: `${TABLE_TEMPLATE}\n`,
    selected: 'Encabezado 1',
  },
  {
    id: 'divider',
    group: 'insert',
    label: 'Separador',
    shortcut: null,
    text: '---\n',
    selected: '',
  },
];

describe('catálogo de elementos markdown', () => {
  it('expone exactamente los elementos de `spec.md` §6, en su orden y sin repetir `id`', () => {
    // OJO: `spec.md` §6 y AC-16 dicen «14 elementos», pero las tres tablas de §6 enumeran 4 + 7 + 5
    // y la propia lista de AC-16 nombra 16. El recuento de la spec está mal; la enumeración, que es
    // el contrato de verdad, manda. Reportado al orchestrator (afecta también a T-006).
    expect(MARKDOWN_PALETTE.map((element) => element.id)).toEqual(CATALOG.map((row) => row.id));
    expect(new Set(MARKDOWN_PALETTE.map((element) => element.id)).size).toBe(
      MARKDOWN_PALETTE.length,
    );
  });

  it('reparte los elementos en los tres grupos, con etiqueta en castellano', () => {
    expect(PALETTE_GROUP_LABELS).toEqual({
      format: 'Formato',
      textBlocks: 'Bloques de texto',
      insert: 'Insertar',
    });
    expect([...new Set(MARKDOWN_PALETTE.map((element) => element.group))]).toEqual([
      'format',
      'textBlocks',
      'insert',
    ]);
  });

  it.each(CATALOG)('«$label» trae rótulo, grupo y atajo (AC-16)', (row) => {
    const element = MARKDOWN_PALETTE.find((candidate) => candidate.id === row.id);

    expect(element).toBeDefined();
    expect(element?.label).toBe(row.label);
    expect(element?.group).toBe(row.group);
    expect(element?.shortcut ?? null).toBe(row.shortcut);
  });

  it('solo negrita, cursiva y enlace llevan atajo (`spec.md` §6)', () => {
    expect(
      MARKDOWN_PALETTE.filter((element) => element.shortcut !== undefined).map(
        (element) => element.id,
      ),
    ).toEqual(['bold', 'italic', 'link']);
  });

  it.each(CATALOG)(
    '«$label» aplicado a un documento vacío da la plantilla literal de `spec.md` §6 (AC-18)',
    (row) => {
      const element = MARKDOWN_PALETTE.find((candidate) => candidate.id === row.id);

      expect(element).toBeDefined();
      if (element === undefined) {
        return;
      }

      const result = applyPaletteElement(element, { text: '', selectionStart: 0, selectionEnd: 0 });

      expect(result.text).toBe(row.text);
      expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe(row.selected);
    },
  );

  it('ningún elemento deja el documento igual ni la selección fuera de límites (AC-18)', () => {
    // La guarda que hace que añadir un elemento al catálogo sin cubrirlo se note aquí y no en
    // producción: se recorre **el catálogo**, no la lista de casos de arriba.
    for (const element of MARKDOWN_PALETTE) {
      const result = applyPaletteElement(element, { text: '', selectionStart: 0, selectionEnd: 0 });

      expect(result.text, element.id).not.toBe('');
      expect(result.selectionStart, element.id).toBeGreaterThanOrEqual(0);
      expect(result.selectionEnd, element.id).toBeGreaterThanOrEqual(result.selectionStart);
      expect(result.selectionEnd, element.id).toBeLessThanOrEqual(result.text.length);
    }
  });

  it('el destino que se selecciona al envolver está dentro de la plantilla del elemento', () => {
    // Invariante que el núcleo da por buena para colocar la selección en la URL (AC-5): si un día
    // alguien cambia la plantilla de `link` y no el destino, esto lo dice antes que un cursor
    // aparecido en un sitio absurdo.
    for (const element of MARKDOWN_PALETTE) {
      if (element.behaviour.kind !== 'inline') {
        continue;
      }

      const target = element.behaviour.selectTargetWhenWrapping;

      if (target !== undefined) {
        expect(element.behaviour.after, element.id).toContain(target);
      }
    }
  });
});

/**
 * Guarda de pureza (AC-17), calcada de `no-dangerous-html.test.ts`: se lee el **código fuente** de
 * los dos módulos del núcleo y se comprueba que no menciona nada del entorno del navegador ni del
 * estado de la aplicación.
 *
 * Ningún test de comportamiento puede comprobar esto: un núcleo que importara el store funcionaría
 * igual de bien hasta el día en que hiciera falta reutilizarlo en la spec `005` con dos paneles
 * abiertos. Lo que lo rompe es el paso del tiempo, y el paso del tiempo se vigila sobre el archivo.
 */
/**
 * La lista **crece con cada spec que estrena un módulo puro**, y eso no cambia lo que AC-17 exige de
 * los dos de la `004` (enmienda v0.3.1 de esa spec, pedida por la `006`). La guarda es **una**, con
 * **una** lista de tokens: un segundo archivo con el mismo detector sería una copia que puede
 * divergir, que es la avería que la `005` pagó con seis ayudantes de e2e duplicados.
 */
const PURE_MODULES = [
  'markdown-insert.ts',
  'markdown-palette.ts',
  'text-edit.ts',
  'undo-history.ts',
] as const;

const FORBIDDEN_TOKENS = [
  "from 'react'",
  'react-dom',
  'zustand',
  './editor.store',
  'document.',
  'window.',
] as const;

/** Este archivo vive en `apps/web/src/features/editor`, que es también donde viven los módulos. */
const MODULE_DIRECTORY = import.meta.dirname;

function forbiddenTokensIn(source: string): string[] {
  return FORBIDDEN_TOKENS.filter((token) => source.includes(token));
}

describe('el detector de dependencias del entorno se comprueba a sí mismo', () => {
  it('encuentra cada token cuando está presente', () => {
    expect(forbiddenTokensIn("import { useState } from 'react';")).toEqual(["from 'react'"]);
    expect(forbiddenTokensIn('const node = document.querySelector("textarea");')).toEqual([
      'document.',
    ]);
    expect(forbiddenTokensIn('window.setTimeout(fn, 0);')).toEqual(['window.']);
    expect(forbiddenTokensIn("import { create } from 'zustand';")).toEqual(['zustand']);
  });

  it('no confunde una palabra que solo se parece', () => {
    expect(forbiddenTokensIn('// el documento y la ventana no se tocan aquí')).toEqual([]);
  });
});

describe.each(PURE_MODULES)(
  '`%s` no conoce el navegador ni el estado (`004` AC-17 · `006` AC-9)',
  (module) => {
    const source = readFileSync(join(MODULE_DIRECTORY, module), 'utf8');

    it('se ha leído el módulo de verdad (si no, la guarda no comprobaría nada)', () => {
      expect(source.length).toBeGreaterThan(500);
      expect(source).toContain('export');
    });

    it('no menciona ninguno de los tokens prohibidos', () => {
      expect(forbiddenTokensIn(source)).toEqual([]);
    });
  },
);
