import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { rehypeRawAsText } from './rehype-raw-as-text';

/**
 * Vista previa **sanitizada** de un documento markdown (AC-24, AC-25).
 *
 * Es el único punto de todo el producto donde una cadena que escribió una persona se convierte en
 * nodos del documento, así que la cadena de plugins de aquí abajo es normativa. El modelo de
 * amenaza completo, con la salida medida de cada carga, está en `plan.md` §2.
 *
 * Las cinco capas, y qué se rompe al tocar cada una:
 *
 * 1. **`rehype-raw` no está instalado.** Es lo que impide que el HTML escrito en el markdown se
 *    convierta en elementos. Instalarlo «para soportar HTML» es exactamente el cambio que rompe
 *    esta capa; la postura de producto (spec §5, decisión C) es que el HTML embebido se ve como
 *    texto literal y no se renderiza nunca.
 * 2. **`rehypeRawAsText`** degrada cada nodo `raw` a nodo de texto. Va **antes** del sanitizador y
 *    no después: quitarlo no abre un agujero, pero hace que el sanitizador **borre prosa** del
 *    usuario (`plan.md` §1.3).
 * 3. **`rehype-sanitize` con el `defaultSchema` sin modificar** (estilo GitHub). Es la capa que
 *    sobrevive a que las specs `004` o `005` añadan un plugin, un `components` a medida o el propio
 *    `rehype-raw`: sanea el árbol **final**, venga de donde venga.
 * 4. **El `urlTransform` por defecto de `react-markdown`**, que **no se sobrescribe**: vacía los
 *    `href`/`src` con `javascript:`, `data:` y compañía antes de llegar al árbol. Es lo único que
 *    el README de la librería señala como la forma de romper su seguridad.
 * 5. **Nunca se inyecta HTML en crudo** —el atributo de React que empieza por `dangerously…`—: no
 *    existe una cadena de HTML en ningún momento, se construyen elementos. Lo comprueba
 *    `no-dangerous-html.test.ts` sobre todo el árbol de archivos, no por revisión. El nombre
 *    completo del atributo no se escribe **en ninguna parte de `src/`**, ni siquiera en un
 *    comentario: el detector es una coincidencia literal, y tiene que serlo para no dejar huecos.
 *
 * Tampoco se pasa `skipHtml`: filtra por nombre de elemento, no cubre atributos ni protocolos, y
 * además se comería el texto que la capa 2 existe para conservar.
 */

/**
 * Listas a nivel de módulo, no literales dentro del render: `react-markdown` recrea su cadena de
 * `unified` cuando cambia la identidad de estos arrays, y con un editor que reescribe el markdown a
 * cada pulsación eso sería reconstruirla en cada tecla.
 */
const REMARK_PLUGINS = [remarkGfm];

/** **El orden importa**: primero degradar el HTML a texto, después sanear el árbol resultante. */
const REHYPE_PLUGINS = [rehypeRawAsText, rehypeSanitize];

export interface MarkdownPreviewProps {
  /** El markdown a renderizar. En el editor es el `draft`, no el `savedContent` (AC-24). */
  readonly markdown: string;
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps): React.JSX.Element {
  return (
    <div className={PREVIEW_CLASS}>
      <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
        {markdown}
      </Markdown>
    </div>
  );
}

/**
 * Tipografía del preview. Se hace con variantes de descendiente en vez de con un plugin de
 * tipografía porque los elementos los produce el parser: no hay dónde poner una clase por elemento
 * sin pasar un `components` a medida, y eso es superficie extra sobre la que sanear.
 */
const PREVIEW_CLASS = [
  'max-w-none text-slate-800',
  '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-slate-900',
  '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900',
  '[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900',
  '[&_p]:my-3 [&_p]:leading-relaxed',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_li]:my-1 [&_li.task-list-item]:list-none [&_li.task-list-item]:-ml-6',
  '[&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-2',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300',
  '[&_blockquote]:pl-4 [&_blockquote]:text-slate-600',
  '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono',
  '[&_code]:text-[0.9em]',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-900 [&_pre]:p-4',
  '[&_pre]:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100',
  '[&_hr]:my-6 [&_hr]:border-slate-200',
  '[&_img]:max-w-full',
  '[&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto',
  '[&_table]:border-collapse [&_table]:text-sm',
  '[&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-1.5',
  '[&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-1.5',
].join(' ');
