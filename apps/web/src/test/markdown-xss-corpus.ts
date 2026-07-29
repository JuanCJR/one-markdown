/**
 * Corpus de cargas de XSS para la vista previa de markdown (spec `003`, AC-25 y AC-26).
 *
 * **Vive en un único archivo a propósito** (`plan.md` §8). Lo importan el test de jsdom
 * (`features/editor/MarkdownPreview.test.tsx`) y el de Chromium real (`e2e/editor.spec.ts`). Si el
 * corpus estuviera duplicado, la verificación en navegador acabaría probando menos cargas que la de
 * jsdom sin que nadie lo notara, que es justo la forma silenciosa de perder la cobertura que más
 * importa.
 *
 * Cada carga trae, además del markdown, **el texto que la persona escribió y que tiene que seguir
 * viéndose**. Esa segunda mitad no es decoración: al diseñar la spec se midió (`plan.md` §1.3) que
 * `rehype-sanitize` a secas **borra prosa del usuario** —`<!-- oculto -->visible` se quedaba en
 * cadena vacía—, y sin afirmar la supervivencia del texto ese defecto de pérdida de datos sería
 * invisible para un test que solo comprobase la ausencia de `<script>`.
 *
 * La postura de producto que fija lo que se espera aquí (spec §5, decisión C): **el HTML embebido en
 * el markdown se muestra como texto literal y no se renderiza nunca**. Por eso varias cargas esperan
 * ver sus propias etiquetas escritas, marca por marca.
 *
 * Y una asimetría que el corpus mide a propósito (AC-25 desde la v0.1.3): la lista de protocolos de
 * **`href`** tiene seis entradas y la de **`src`** solo dos (`http`, `https`). Como el
 * `urlTransform` de `react-markdown` aplica su regex de seis a **todas** las URL, hay exactamente un
 * hueco que `rehype-sanitize` cubre **él solo**: una imagen con `irc:`. Las dos últimas cargas son
 * ese par.
 */

/** Una carga del corpus: qué se escribe, y qué tiene que seguir leyéndose después de sanear. */
export interface MarkdownXssPayload {
  /** Nombre del caso, usado como título del test que lo ejercita. */
  readonly name: string;
  /** El markdown que se escribe en el editor. */
  readonly markdown: string;
  /**
   * Fragmentos que **deben** seguir apareciendo en el texto del preview.
   *
   * Nunca está vacío: una carga sin nada que sobrevivir no puede detectar la pérdida de prosa.
   */
  readonly survives: readonly string[];
}

/**
 * Las diez cargas medidas en `plan.md` §1.3, más las que se hayan añadido después.
 *
 * Añadir una carga es la forma barata de ampliar la cobertura: el test de jsdom y el de navegador
 * la recogen los dos sin tocar ni una línea de ninguno de ellos.
 */
export const MARKDOWN_XSS_CORPUS: readonly MarkdownXssPayload[] = [
  {
    name: 'etiqueta script en bloque',
    markdown: '<script>alert(1)</script>',
    survives: ['<script>alert(1)</script>'],
  },
  {
    name: 'imagen con manejador onerror',
    markdown: '<img src=x onerror="alert(1)">',
    survives: ['<img src=x onerror="alert(1)">'],
  },
  {
    name: 'svg con manejador onload',
    markdown: '<svg onload="alert(1)"></svg>',
    survives: ['<svg onload="alert(1)"></svg>'],
  },
  {
    name: 'iframe hacia un origen ajeno',
    markdown: '<iframe src="https://tercero.test/robar"></iframe>',
    survives: ['<iframe src="https://tercero.test/robar"></iframe>'],
  },
  {
    name: 'enlace con protocolo javascript',
    markdown: '[pincha aquí](javascript:alert(1))',
    survives: ['pincha aquí'],
  },
  {
    name: 'imagen con protocolo javascript',
    // La carga medida va rodeada de prosa porque una imagen sola no deja texto que pueda
    // desaparecer, y esta carga tiene que poder detectar la pérdida como todas las demás.
    markdown: 'antes de la imagen ![alt](javascript:alert(1)) después de la imagen',
    survives: ['antes de la imagen', 'después de la imagen'],
  },
  {
    name: 'enlace con data: URL de html',
    markdown: '[descarga](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    survives: ['descarga'],
  },
  {
    name: 'comentario de html seguido de texto',
    // El caso que justifica `rehypeRawAsText` por completo: con `rehype-sanitize` a secas la línea
    // entera es un bloque HTML, sus nodos `raw` se descartan, y con ellos se va «visible».
    markdown: '<!-- oculto -->visible',
    survives: ['visible'],
  },
  {
    name: 'etiqueta en línea dentro de un párrafo',
    markdown: 'texto <b>negrita</b> fin',
    survives: ['texto <b>negrita</b> fin'],
  },
  {
    name: 'div con manejador onclick y texto dentro',
    markdown: '<div onclick="alert(1)">texto dentro del div</div>',
    survives: ['texto dentro del div'],
  },
  {
    name: 'enlace con protocolo irc — permitido en href',
    // `irc`, `ircs` y `xmpp` abren un cliente externo y no ejecutan nada en la página: están en el
    // `defaultSchema` (lista de GitHub) y en el `safeProtocol` de `react-markdown`. La carga existe
    // para clavar que **siguen** permitidos: si alguien recorta `protocols.href` del esquema, esta
    // carga se lo dice en vez de descubrirlo un usuario con un enlace roto.
    markdown: '[chat](irc://irc.tercero.test/canal)',
    survives: ['chat'],
  },
  {
    name: 'imagen con protocolo irc — prohibido en src, y solo el sanitizador lo detiene',
    // **La carga que mide la asimetría**, y la más valiosa del corpus para el mantenimiento.
    // `protocols.src` del `defaultSchema` admite solo `http` y `https`, mientras que el
    // `urlTransform` de `react-markdown` aplica su regex de **seis** protocolos a todas las URL,
    // imágenes incluidas. Es decir: aquí la capa 4 no llega, y quien recorta este `src` es
    // **únicamente** `rehype-sanitize`. Es el contraejemplo de «el sanitizador es redundante hoy»,
    // medido con una mutación (quitarlo pone esta carga en rojo y solo esta).
    markdown: 'antes del logo ![logo](irc://irc.tercero.test/logo.png) después del logo',
    survives: ['antes del logo', 'después del logo'],
  },
  {
    name: 'bloque de código vallado que contiene una etiqueta script',
    // Las tres cargas de la `004` (AC-31) tienen el mismo motivo: la paleta vuelve estos tres
    // contenedores alcanzables **de un clic**, y hasta hoy el corpus no visitaba **ninguno** de los
    // tres. Todas las cargas de la `003` viven en la raíz del documento o dentro de un párrafo.
    //
    // Esta es la valla de código: dentro de ella el markdown no se interpreta, así que el contenido
    // llega al árbol como texto y tiene que **verse escrito**, marca por marca, sin que aparezca un
    // `<script>` de verdad.
    markdown: '```\n<script>alert(1)</script>\n```',
    survives: ['<script>alert(1)</script>'],
  },
  {
    name: 'celda de tabla que contiene una imagen con manejador onerror',
    // La celda de tabla: un contenedor que solo existe gracias a `remark-gfm`, con lo que la carga
    // atraviesa **los dos** plugins de remark y de rehype antes de sanearse. El corpus de la `003`
    // no metía nada dentro de una tabla, y la paleta inserta una con un botón.
    markdown: '| celda | otra |\n| --- | --- |\n| <img src=x onerror="alert(1)"> | texto vecino |',
    survives: ['<img src=x onerror="alert(1)">', 'texto vecino'],
  },
  {
    name: 'elemento de lista de tareas con un enlace javascript',
    // El elemento de tarea: otro contenedor de `remark-gfm`, y el único del corpus donde el enlace
    // peligroso cuelga de un `<li>` con `<input type="checkbox">` delante. Dos botones de la paleta
    // —«Lista de tareas» y «Enlace»— dejan exactamente esta construcción.
    markdown: '- [ ] [pincha aquí](javascript:alert(1)) y sigue la tarea',
    survives: ['pincha aquí', 'y sigue la tarea'],
  },
];
