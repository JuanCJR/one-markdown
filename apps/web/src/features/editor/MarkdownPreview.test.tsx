import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { applyPaletteElement } from './markdown-insert';
import { MARKDOWN_PALETTE } from './markdown-palette';
import { MarkdownPreview } from './MarkdownPreview';
import { MARKDOWN_XSS_CORPUS } from '../../test/markdown-xss-corpus';

/**
 * La vista previa sanitizada (AC-24 y AC-25).
 *
 * Dos mitades que se sostienen la una a la otra:
 *
 * - **AC-24** — lo que la persona escribe en markdown tiene que salir como **elementos** del
 *   documento, GFM incluido, porque la paleta de la spec `004` va a ofrecer tablas, listas de
 *   tareas, tachado y enlaces automáticos y no puede tener que añadir un plugin de parseo.
 * - **AC-25** — para **cada** carga del corpus compartido: ni un `script`, `iframe`, `object`,
 *   `embed` o `svg`; ni un atributo que empiece por `on`; ni un `href`/`src` con protocolo fuera de
 *   la lista; **y el texto que escribió la persona sigue apareciendo**.
 *
 * Esa última aserción es la que impide que la sanitización se coma prosa. Está medido
 * (`plan.md` §1.3): con `rehype-sanitize` a secas, `<!-- oculto -->visible` se queda en cadena
 * vacía. Un test que solo comprobase la ausencia de `<script>` daría verde sobre un preview que
 * borra el documento del usuario.
 */

/** Elementos que la vista previa no puede crear jamás, sea cual sea la entrada (`plan.md` §2.4). */
const FORBIDDEN_TAGS = ['script', 'iframe', 'object', 'embed', 'svg'] as const;

/**
 * Protocolos admitidos en **`href`** (AC-25, ampliado en la v0.1.3 de la spec).
 *
 * Son los seis del `defaultSchema` de `hast-util-sanitize` —lista de GitHub— y los mismos seis que
 * deja pasar el `safeProtocol` de `react-markdown`. `irc`, `ircs` y `xmpp` abren un cliente
 * externo: no ejecutan nada en la página.
 */
const ALLOWED_HREF_PROTOCOLS = ['http:', 'https:', 'mailto:', 'irc:', 'ircs:', 'xmpp:'] as const;

/**
 * Protocolos admitidos en **`src`**: **dos**, no seis.
 *
 * La asimetría es del `defaultSchema` (`protocols.src = ['http', 'https']`) y es la razón de que
 * esta lista esté separada de la de `href`. Importa mucho más de lo que parece: el `urlTransform`
 * de `react-markdown` aplica su regex de **seis** protocolos a **todas** las URL, imágenes
 * incluidas, así que a un `![x](irc://…)` **solo lo detiene `rehype-sanitize`**. Es el único punto
 * medido en el que la capa 3 no es redundante con la 4, y por eso hay una carga del corpus dedicada
 * a él: quien retire el sanitizador verá caer esa carga y sabrá qué está perdiendo.
 */
const ALLOWED_SRC_PROTOCOLS = ['http:', 'https:'] as const;

/** Todos los elementos del subárbol renderizado, incluido el contenedor que envuelve la vista. */
function allElements(container: HTMLElement): readonly Element[] {
  return [...container.querySelectorAll('*')];
}

/** Nombres de atributo que empiezan por `on`, o sea todo manejador de evento en línea. */
function eventHandlerAttributes(container: HTMLElement): readonly string[] {
  return allElements(container).flatMap((element) =>
    [...element.attributes]
      .map((attribute) => attribute.name.toLowerCase())
      .filter((name) => name.startsWith('on')),
  );
}

/**
 * Una URL es aceptable si no declara protocolo (ruta relativa) o si el que declara está en la lista
 * **que le corresponde a ese atributo**. Se resuelve con el parser del entorno para no
 * reimplementar a mano un análisis de esquemas, que es exactamente donde viven los saltos de la
 * lista negra.
 */
function isAcceptableUrl(raw: string, allowedProtocols: readonly string[]): boolean {
  if (raw === '') {
    return true;
  }

  let parsed: URL;

  try {
    parsed = new URL(raw, 'https://base.test/');
  } catch {
    return false;
  }

  const declaresProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw.trim());

  return !declaresProtocol || allowedProtocols.includes(parsed.protocol);
}

/**
 * Los `href` de enlace y `src` de imagen que no pasan el filtro, cada uno contra **su** lista.
 *
 * Se devuelve el atributo junto al valor porque la asimetría entre `href` y `src` hace que el mismo
 * `irc://…` sea legítimo en uno e inaceptable en el otro: sin el atributo delante, el mensaje de
 * fallo no diría cuál de los dos casos se rompió.
 */
function unsafeUrls(container: HTMLElement): readonly string[] {
  return allElements(container).flatMap((element) => {
    if (element.tagName === 'A') {
      const href = element.getAttribute('href');

      return href !== null && !isAcceptableUrl(href, ALLOWED_HREF_PROTOCOLS)
        ? [`a[href]=${href}`]
        : [];
    }

    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src');

      return src !== null && !isAcceptableUrl(src, ALLOWED_SRC_PROTOCOLS) ? [`img[src]=${src}`] : [];
    }

    return [];
  });
}

describe('MarkdownPreview — elementos y GFM (AC-24)', () => {
  it('renderiza encabezados como elementos de encabezado', () => {
    render(<MarkdownPreview markdown={'# Título uno\n\n## Título dos'} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Título uno' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Título dos' })).toBeInTheDocument();
  });

  it('renderiza listas como lista con sus elementos', () => {
    render(<MarkdownPreview markdown={'- uno\n- dos\n- tres'} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renderiza el énfasis como em y strong, no como asteriscos', () => {
    const { container } = render(<MarkdownPreview markdown={'*cursiva* y **negrita**'} />);

    expect(container.querySelector('em')?.textContent).toBe('cursiva');
    expect(container.querySelector('strong')?.textContent).toBe('negrita');
    expect(container.textContent).not.toContain('*');
  });

  it('renderiza los enlaces como anclas con su href', () => {
    render(<MarkdownPreview markdown={'[documentación](https://ejemplo.test/docs)'} />);

    expect(screen.getByRole('link', { name: 'documentación' })).toHaveAttribute(
      'href',
      'https://ejemplo.test/docs',
    );
  });

  it('renderiza las imágenes como img con su texto alternativo', () => {
    render(<MarkdownPreview markdown={'![un gato](/gato.png)'} />);

    expect(screen.getByRole('img', { name: 'un gato' })).toHaveAttribute('src', '/gato.png');
  });

  it('renderiza los bloques de código conservando la clase del lenguaje', () => {
    const { container } = render(
      <MarkdownPreview markdown={'```js\nconst uno = 1;\n```'} />,
    );

    const code = container.querySelector('pre > code');

    expect(code?.textContent).toContain('const uno = 1;');
    // El resaltado de sintaxis está fuera de alcance (spec §4), pero la clase sobrevive al saneado
    // para que añadirlo después sea un plugin y no un rediseño.
    expect(code?.className).toContain('language-js');
  });

  it('renderiza las tablas de GFM como tabla', () => {
    render(<MarkdownPreview markdown={'| a | b |\n| - | - |\n| 1 | 2 |'} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'a' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
  });

  it('renderiza las listas de tareas de GFM como casillas deshabilitadas', () => {
    render(<MarkdownPreview markdown={'- [x] hecho\n- [ ] pendiente'} />);

    const checkboxes = screen.getAllByRole('checkbox');

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[0]).toBeDisabled();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('renderiza el tachado de GFM como del', () => {
    const { container } = render(<MarkdownPreview markdown={'~~tachado~~'} />);

    expect(container.querySelector('del')?.textContent).toBe('tachado');
  });

  it('renderiza los enlaces automáticos de GFM como anclas', () => {
    render(<MarkdownPreview markdown={'Visita https://ejemplo.test/pagina para más.'} />);

    expect(screen.getByRole('link', { name: 'https://ejemplo.test/pagina' })).toHaveAttribute(
      'href',
      'https://ejemplo.test/pagina',
    );
  });
});

describe('MarkdownPreview — corpus de XSS (AC-25)', () => {
  it('el corpus trae al menos las quince cargas medidas hasta la 004', () => {
    // Guardia contra el corpus que se queda vacío o se poda sin querer: sin ella los casos de abajo
    // pasarían sin ejercitar nada. Sube de 10 a 15 con la `004` (AC-31: 12 + 3), **a la vez** que la
    // gemela de `e2e/editor.spec.ts`: están duplicadas a propósito para que jsdom y navegador no
    // puedan divergir, y moverla en un solo sitio destruye justo esa garantía.
    expect(MARKDOWN_XSS_CORPUS.length).toBeGreaterThanOrEqual(15);
    expect(MARKDOWN_XSS_CORPUS.every((payload) => payload.survives.length > 0)).toBe(true);
  });

  it.each(MARKDOWN_XSS_CORPUS)('no crea elementos activos: $name', ({ markdown }) => {
    const { container } = render(<MarkdownPreview markdown={markdown} />);

    for (const tag of FORBIDDEN_TAGS) {
      expect(container.querySelectorAll(tag)).toHaveLength(0);
    }
  });

  it.each(MARKDOWN_XSS_CORPUS)('no deja ningún manejador de evento: $name', ({ markdown }) => {
    const { container } = render(<MarkdownPreview markdown={markdown} />);

    expect(eventHandlerAttributes(container)).toEqual([]);
  });

  it.each(MARKDOWN_XSS_CORPUS)('no deja ninguna URL con protocolo peligroso: $name', ({ markdown }) => {
    const { container } = render(<MarkdownPreview markdown={markdown} />);

    expect(unsafeUrls(container)).toEqual([]);
  });

  it.each(MARKDOWN_XSS_CORPUS)(
    'conserva el texto que escribió la persona: $name',
    ({ markdown, survives }) => {
      const { container } = render(<MarkdownPreview markdown={markdown} />);

      // La aserción que impide que la sanitización se coma prosa (`plan.md` §1.3). Sin ella, un
      // preview que devuelve la cadena vacía ante cualquier entrada pasaría los tres casos de
      // arriba con nota.
      for (const fragment of survives) {
        expect(container.textContent).toContain(fragment);
      }
    },
  );
});

/**
 * Qué elemento HTML tiene que producir cada plantilla del catálogo de la `004` (AC-30).
 *
 * Es un mapa **por identificador** y no una lista paralela de casos: el recorrido de abajo lo hace
 * `it.each(MARKDOWN_PALETTE)` sobre el catálogo **real**, así que un elemento nuevo sin fila aquí no
 * se salta en silencio, se cae. Y la guarda de exhaustividad cierra el otro lado: una fila sobrante
 * —un identificador que ya no existe, o uno inventado— también pone el archivo en rojo.
 */
const EXPECTED_SELECTOR: Readonly<Record<string, string>> = {
  bold: 'strong',
  italic: 'em',
  strikethrough: 'del',
  inlineCode: 'code',
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  quote: 'blockquote',
  bulletList: 'ul',
  numberedList: 'ol',
  taskList: 'input[type="checkbox"]',
  link: 'a',
  image: 'img',
  codeBlock: 'pre > code',
  table: 'table',
  divider: 'hr',
};

/** El documento vacío: el punto de partida de cada plantilla, igual que en `markdown-palette.test.ts`. */
const EMPTY_DOCUMENT = { text: '', selectionStart: 0, selectionEnd: 0 } as const;

describe('MarkdownPreview — cada plantilla del catálogo se renderiza y no trae nada activo (AC-30)', () => {
  it('el recorrido cubre el catálogo entero, ni una fila de más ni de menos', () => {
    // Sin esto, el `it.each` de abajo seguiría en verde con la mitad del catálogo sin mapa: quien
    // añada un elemento a `spec.md` §6 se entera aquí y no en producción. §6 enumera 4 + 7 + 5 = 16.
    expect([...MARKDOWN_PALETTE].map((element) => element.id).sort()).toEqual(
      Object.keys(EXPECTED_SELECTOR).sort(),
    );
    expect(MARKDOWN_PALETTE).toHaveLength(16);
    expect(new Set(Object.values(EXPECTED_SELECTOR)).size).toBe(16);
  });

  it.each(MARKDOWN_PALETTE)(
    'la plantilla de «$label» produce su elemento y nada activo',
    (element) => {
      const { text } = applyPaletteElement(element, EMPTY_DOCUMENT);
      const { container } = render(<MarkdownPreview markdown={text} />);
      const selector = EXPECTED_SELECTOR[element.id];

      // Un elemento sin fila en el mapa no puede pasar de aquí: sería un caso que se ejecuta sin
      // comprobar nada.
      expect(selector).toBeDefined();
      expect(container.querySelectorAll(selector ?? '')).not.toHaveLength(0);

      for (const tag of FORBIDDEN_TAGS) {
        expect(container.querySelectorAll(tag)).toHaveLength(0);
      }

      expect(eventHandlerAttributes(container)).toEqual([]);
      expect(unsafeUrls(container)).toEqual([]);
    },
  );
});

/**
 * Raíz del paquete del cliente: `apps/web`, tres niveles por encima de este archivo.
 *
 * Se resuelve con `import.meta.dirname` y **no** con `new URL(…, import.meta.url)` por lo mismo que
 * `no-dangerous-html.test.ts` dejó medido: el `URL` global de este entorno es el de jsdom.
 */
const WEB_PACKAGE_ROOT = join(import.meta.dirname, '../../..');

/** Las dependencias de la cadena de markdown que la `003` dejó instaladas, y **solo** esas. */
const MARKDOWN_DEPENDENCIES = ['react-markdown', 'rehype-sanitize', 'remark-gfm'] as const;

/** Qué se considera «dependencia de la cadena de markdown» al leer el manifiesto. */
const MARKDOWN_PACKAGE_PATTERN = /markdown|remark|rehype|unified|hast|mdast|micromark|sanitiz/i;

const IMPORT_PATTERN = /^import\s[^;]*?from\s'([^']+)';$/gm;

/** Los módulos que importa un archivo fuente, ordenados. */
function importedModules(source: string): readonly string[] {
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? '').sort();
}

/** Los nombres de dependencia de un `package.json` que suenan a cadena de markdown, ordenados. */
function markdownDependenciesOf(manifest: string): readonly string[] {
  const parsed: unknown = JSON.parse(manifest);

  if (typeof parsed !== 'object' || parsed === null || !('dependencies' in parsed)) {
    throw new Error('el manifiesto leído no declara dependencias');
  }

  const { dependencies } = parsed as { readonly dependencies: unknown };

  if (typeof dependencies !== 'object' || dependencies === null) {
    throw new Error('las dependencias del manifiesto no son un objeto');
  }

  return Object.keys(dependencies)
    // `@one-markdown/shared` lleva «markdown» en el nombre y no es un plugin de nadie: es el paquete
    // de tipos del propio monorepo.
    .filter((name) => !name.startsWith('@one-markdown/') && MARKDOWN_PACKAGE_PATTERN.test(name))
    .sort();
}

describe('MarkdownPreview — la cadena de plugins sigue siendo la de la 003 (AC-30)', () => {
  const source = readFileSync(join(import.meta.dirname, 'MarkdownPreview.tsx'), 'utf8');

  it('los detectores se comprueban a sí mismos', () => {
    expect(importedModules("import rehypeRaw from 'rehype-raw';")).toEqual(['rehype-raw']);
    expect(importedModules('const x = 1;')).toEqual([]);
    expect(
      markdownDependenciesOf(
        '{"dependencies":{"rehype-raw":"1","react":"19","@one-markdown/shared":"workspace:*"}}',
      ),
    ).toEqual(['rehype-raw']);
  });

  it('se ha leído el componente de verdad (si no, la guarda no comprobaría nada)', () => {
    expect(source.length).toBeGreaterThan(500);
    expect(source).toContain('export function MarkdownPreview');
  });

  it('importa exactamente los tres plugins de la 003 y ninguno más', () => {
    expect(importedModules(source)).toEqual([
      './rehype-raw-as-text',
      'react-markdown',
      'rehype-sanitize',
      'remark-gfm',
    ]);
  });

  it('las dos cadenas conservan su contenido y su orden', () => {
    // El orden es normativo (`MarkdownPreview.tsx`): primero degradar el HTML a texto, después
    // sanear el árbol resultante. Se afirma sobre el texto del módulo porque los arrays no se
    // exportan: exportarlos para poder mirarlos sería ampliar la superficie del componente que la
    // `003` dejó cerrada.
    expect(source).toContain('const REMARK_PLUGINS = [remarkGfm];');
    expect(source).toContain('const REHYPE_PLUGINS = [rehypeRawAsText, rehypeSanitize];');
  });

  it('la 004 no ha instalado ninguna dependencia de markdown', () => {
    const manifest = readFileSync(join(WEB_PACKAGE_ROOT, 'package.json'), 'utf8');

    expect(markdownDependenciesOf(manifest)).toEqual([...MARKDOWN_DEPENDENCIES].sort());
  });
});
