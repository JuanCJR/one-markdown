import { expect } from '@playwright/test';

import {
  createDocument,
  SAVE_REGION_NAME,
  test,
  textarea,
  uniqueTitle,
  watchConsole,
} from './support/editor-e2e';
import { MARKDOWN_XSS_CORPUS } from '../src/test/markdown-xss-corpus';

/**
 * El editor en un navegador de verdad (spec `003`: AC-26, AC-32 y AC-33).
 *
 * **Por qué existe este archivo teniendo la suite de jsdom en verde** (`plan.md` §8): una afirmación
 * de seguridad verificada solo en jsdom no es una afirmación sobre navegadores. jsdom no ejecuta los
 * scripts igual, no navega ante un `href` `javascript:`, y su implementación de `URL` no es la de
 * Blink. `MarkdownPreview.test.tsx` demuestra que **el árbol que produce React** no tiene nodos
 * peligrosos; lo que se demuestra aquí es que **un navegador de verdad no ejecuta nada**.
 *
 * Y las otras dos mitades son de la misma clase: que el texto se vea en pantalla no prueba que se
 * haya guardado (por eso AC-32 **recarga la página**), y que la interfaz diga «conservado» no prueba
 * que se conservara (por eso AC-33 comprueba el resultado **por API**).
 *
 * El corpus se **importa** de `src/test/markdown-xss-corpus.ts`, el mismo que usa la suite de jsdom,
 * y no se copia. Copiarlo es la forma silenciosa de que la verificación en navegador acabe probando
 * menos cargas que la de jsdom: se añade una carga al original y esta suite sigue tan verde como
 * siempre, sin cubrirla.
 *
 * Y por el mismo motivo, desde la `005` (AC-30), lo que este archivo comparte con `palette.spec.ts`
 * se **importa** de `support/editor-e2e.ts` en vez de copiarse. Lo vigila
 * `src/test/e2e-support.test.ts`, que lee este fuente: dos copias de un ayudante son dos
 * comprobaciones que se creen la misma hasta el día en que divergen.
 */

/** Elementos que la vista previa no puede crear jamás, sea cual sea la entrada (`plan.md` §2.4). */
const FORBIDDEN_TAGS = ['script', 'iframe', 'object', 'embed', 'svg'] as const;

/**
 * Protocolos admitidos en **`href`**: los seis del `defaultSchema` de `hast-util-sanitize` (la lista
 * de GitHub), que son también los seis del `safeProtocol` de `react-markdown`.
 */
const ALLOWED_HREF_PROTOCOLS = ['http:', 'https:', 'mailto:', 'irc:', 'ircs:', 'xmpp:'] as const;

/**
 * Protocolos admitidos en **`src`**: **dos**, no seis (`protocols.src = ['http', 'https']`).
 *
 * La lista está partida por atributo, igual que en `MarkdownPreview.test.tsx`, porque la asimetría
 * es justo lo que el corpus mide: `[chat](irc://…)` debe **sobrevivir** y `![logo](irc://…)` debe
 * quedar **recortado**. Con una lista única de seis protocolos, la carga de imagen pasaría y esta
 * suite afirmaría algo **distinto** de la de jsdom — exactamente lo que `plan.md` §8 quiere evitar.
 */
const ALLOWED_SRC_PROTOCOLS = ['http:', 'https:'] as const;

/**
 * El `409` de AC-33 se provoca **a propósito**, y Chromium anota en la consola toda respuesta de
 * error de una petición de red. Se tolera **solo** ese código y **solo** en el caso del conflicto;
 * cualquier otra queja del navegador sigue siendo un defecto.
 */
const PROVOKED_CONFLICT_RESPONSE = /status of 409 \(Conflict\)/;

/**
 * Por qué las pestañas del conmutador se piden con `exact: true` en este archivo.
 *
 * Desde la `005` la página tiene **dos** `tablist`, y el nombre accesible de una pestaña de documento
 * **lleva el título dentro** (««Notas» · Supr para cerrar»). La coincidencia por defecto de Playwright
 * es por **subcadena**, así que un documento titulado «Texto» o «Vista previa» haría que la consulta
 * resolviera a dos elementos y el caso muriera por violación de modo estricto — un rojo que no tendría
 * nada que ver con lo que este archivo mide. Hoy los títulos llevan un uuid y no colisionan, así que
 * esto es **endurecimiento y no un arreglo**: la mina estaba puesta y no había disparado. La destapó
 * `tabs.spec.ts` al escribirse, con ese mensaje exacto.
 */

declare global {
  interface Window {
    /**
     * Centinela de AC-26: pasa a `true` en cuanto **algo** de una carga del corpus consigue
     * ejecutarse. Lo instala `addInitScript` antes de que corra ni una línea de la aplicación.
     */
    __xssTripped?: boolean;
  }
}

test.describe('Editor en el navegador (AC-26, AC-32, AC-33)', () => {
  test('escribir, guardar, recargar y previsualizar sin errores de consola (AC-32)', async ({
    page,
  }) => {
    const consoleErrors = watchConsole(page);
    const title = uniqueTitle('Editor', 'recorrido');
    const markdown = '# Diario de julio\n\n- primera nota\n- segunda nota';

    await page.goto('/');
    await expect(
      page.getByRole('banner').getByRole('img', { name: 'One Markdown' }),
    ).toBeAttached();

    // El documento se crea **desde la interfaz**, que es el recorrido que AC-32 describe: quien
    // escribe llega a su documento por el árbol, no por una URL que alguien le sembró.
    await page.getByRole('button', { name: 'Nuevo en la raíz' }).click();

    const create = page.getByRole('dialog', { name: 'Nuevo en la raíz' });

    await create.getByRole('radio', { name: 'Documento' }).check();
    await create.getByLabel('Título').fill(title);
    await create.getByRole('button', { name: 'Crear el documento' }).click();

    await expect(create).toBeHidden();

    const row = page.getByRole('treeitem', { name: title, exact: true });

    await row.getByText(title, { exact: true }).click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/);

    const saveStatus = page.getByRole('status', { name: SAVE_REGION_NAME });

    await expect(textarea(page, title)).toHaveValue('');
    // Recién creado: está limpio porque nadie lo ha tocado, **no** porque se haya guardado, así que
    // el rótulo va sin hora. Inventarle una diría que ocurrió algo que no ocurrió (fase 6, §4.9).
    await expect(saveStatus).toHaveText('Guardado');

    // Escribir marca el documento como sucio y programa el guardado automático. La aserción
    // intermedia no es decorativa: sin ella, un «Guardado» leído demasiado pronto sería el de un
    // documento que nunca se llegó a ensuciar, y el caso pasaría sin guardar nada.
    await textarea(page, title).fill(markdown);
    await expect(saveStatus).toHaveText('Sin guardar');
    // Con la hora: el guardado ha ocurrido de verdad y la región lo fecha (fase 6, §4.9).
    await expect(saveStatus).toHaveText(/^Guardado \d{2}:\d{2}$/);

    // **La recarga es el criterio.** Es lo único que distingue «se pintó en pantalla» de «llegó al
    // servidor»: después de ella no queda nada del estado del cliente, así que el texto que se lea
    // viene de la base de datos.
    await page.reload();

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(textarea(page, title)).toHaveValue(markdown);

    // Y en vista previa, el encabezado y la lista tienen que salir como **elementos**, no como el
    // texto con sus almohadillas y sus guiones.
    await page.getByRole('tab', { name: 'Vista', exact: true }).click();

    const preview = page.getByRole('tabpanel');

    await expect(preview.getByRole('heading', { level: 1, name: 'Diario de julio' })).toBeVisible();
    await expect(preview.getByRole('listitem')).toHaveText(['primera nota', 'segunda nota']);

    expect(consoleErrors()).toEqual([]);
  });

  test('un conflicto de versión se resuelve conservando el texto local (AC-33)', async ({
    page,
    session,
  }) => {
    const consoleErrors = watchConsole(page, PROVOKED_CONFLICT_RESPONSE);
    const title = uniqueTitle('Editor', 'conflicto');
    const mine = '# Mi versión\n\nEsto es lo que estaba escribiendo.';
    const theirs = '# La otra pestaña\n\nEsto lo guardó otro sitio.';

    const { authorization } = session;
    const documentId = await createDocument(page, authorization, title);

    await page.goto(`/documents/${documentId}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    const saveStatus = page.getByRole('status', { name: SAVE_REGION_NAME });

    await textarea(page, title).fill(mine);
    await expect(saveStatus).toHaveText('Sin guardar');

    // Otro sitio guarda **antes** que el editor y sube la versión. Va por `page.request`, que
    // comparte el tarro de cookies con la pestaña, en vez de por un segundo navegador: dos contextos
    // serían más lentos, más frágiles y probarían lo mismo.
    //
    // El margen es el debounce de 1.500 ms: esta petición y el `click` de abajo tardan un par de
    // decenas de milisegundos. Y si aun así el editor se adelantara, el `409` caería del otro lado y
    // el caso fallaría a la vista, nunca pasaría en falso.
    const bumped = await page.request.put(`/api/workspace/documents/${documentId}/content`, {
      headers: { authorization },
      data: { content: theirs, expectedVersion: 0 },
    });

    expect(bumped.status()).toBe(200);

    await page.getByRole('button', { name: 'Guardar' }).click();

    const conflict = page.getByRole('dialog', {
      name: 'Este documento cambió mientras escribías',
    });

    await expect(conflict).toBeVisible();
    await expect(conflict.getByRole('button', { name: 'Descartar lo que escribí' })).toBeVisible();
    await conflict.getByRole('button', { name: 'Conservar mi versión' }).click();

    await expect(conflict).toBeHidden();
    // Con la hora: el guardado ha ocurrido de verdad y la región lo fecha (fase 6, §4.9).
    await expect(saveStatus).toHaveText(/^Guardado \d{2}:\d{2}$/);
    await expect(textarea(page, title)).toHaveValue(mine);

    // **La comprobación que cuenta**, y por eso es por API y no por pantalla: que la interfaz diga
    // «Guardado» sobre el texto local no prueba que el servidor lo tenga. Lo prueba releer la fila.
    const stored = await page.request.get(`/api/workspace/documents/${documentId}`, {
      headers: { authorization },
    });

    expect(stored.status()).toBe(200);
    expect(((await stored.json()) as { content: string }).content).toBe(mine);

    expect(consoleErrors()).toEqual([]);
  });

  test('ninguna carga del corpus de XSS ejecuta nada en Chromium (AC-26)', async ({
    page,
    session,
  }) => {
    const consoleErrors = watchConsole(page);
    const dialogs: string[] = [];

    // Las **dos** redes, que no miden lo mismo: el manejador ve un diálogo que se llegó a abrir (y
    // lo cierra, para que la página no se quede bloqueada esperando), y el centinela ve que el
    // código se ejecutó **aunque el diálogo no llegara a aparecer**. Un `alert` interceptado por el
    // manejador no es lo mismo que un script que no llegó a ejecutarse; con una sola de las dos, la
    // diferencia entre «bloqueado» y «nunca ocurrió» se pierde.
    page.on('dialog', (dialog) => {
      dialogs.push(`${dialog.type()}: ${dialog.message()}`);
      void dialog.dismiss();
    });

    await page.addInitScript(() => {
      window.__xssTripped = false;

      // Se marca **y** se delega: así el diálogo sigue abriéndose y el manejador de arriba lo ve.
      // Sustituirlo sin delegar dejaría al manejador sin nada que detectar y convertiría las dos
      // redes en una sola.
      const trip = <Args extends unknown[], Result>(
        native: (...args: Args) => Result,
      ): ((...args: Args) => Result) => {
        return (...args: Args): Result => {
          window.__xssTripped = true;

          return native(...args);
        };
      };

      window.alert = trip(window.alert.bind(window));
      window.confirm = trip(window.confirm.bind(window));
      window.prompt = trip(window.prompt.bind(window));
    });

    const title = uniqueTitle('Editor', 'corpus');
    const documentId = await createDocument(page, session.authorization, title);

    await page.goto(`/documents/${documentId}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    // Guardia contra el corpus podado o vacío: sin ella el bucle de abajo no ejercitaría nada y el
    // caso pasaría con nota. Es la misma que hace `MarkdownPreview.test.tsx`, y aquí importa más:
    // este archivo **importa** el corpus justo para no poder quedarse corto respecto de aquél.
    expect(MARKDOWN_XSS_CORPUS.length).toBeGreaterThanOrEqual(15);

    const preview = page.getByRole('tabpanel');

    for (const payload of MARKDOWN_XSS_CORPUS) {
      await page.getByRole('tab', { name: 'Texto', exact: true }).click();
      await textarea(page, title).fill(payload.markdown);
      await page.getByRole('tab', { name: 'Vista', exact: true }).click();

      const rendered = await preview.evaluate(
        (container, protocols) => {
          const elements = [...container.querySelectorAll('*')];

          const isAcceptableUrl = (raw: string, allowed: readonly string[]): boolean => {
            if (raw === '') {
              return true;
            }

            let parsed: URL;

            try {
              // El `URL` de Blink, que es el que importa: la resolución de esquemas de jsdom no es
              // la de un navegador, y esa diferencia es la razón de ser de este archivo.
              parsed = new URL(raw, 'https://base.test/');
            } catch {
              return false;
            }

            return !/^[a-z][a-z0-9+.-]*:/i.test(raw.trim()) || allowed.includes(parsed.protocol);
          };

          return {
            forbidden: elements
              .map((element) => element.tagName.toLowerCase())
              .filter((tag) => protocols.forbidden.includes(tag)),
            handlers: elements.flatMap((element) =>
              [...element.attributes]
                .map((attribute) => attribute.name.toLowerCase())
                .filter((name) => name.startsWith('on')),
            ),
            // El atributo va en el mensaje porque el mismo `irc://…` es legítimo en un `href` e
            // inaceptable en un `src`: sin él, el fallo no diría cuál de los dos casos se rompió.
            unsafeUrls: elements.flatMap((element) => {
              if (element.tagName === 'A') {
                const href = element.getAttribute('href');

                return href !== null && !isAcceptableUrl(href, protocols.href)
                  ? [`a[href]=${href}`]
                  : [];
              }

              if (element.tagName === 'IMG') {
                const src = element.getAttribute('src');

                return src !== null && !isAcceptableUrl(src, protocols.src)
                  ? [`img[src]=${src}`]
                  : [];
              }

              return [];
            }),
            text: container.textContent ?? '',
          };
        },
        {
          forbidden: [...FORBIDDEN_TAGS] as string[],
          href: [...ALLOWED_HREF_PROTOCOLS] as string[],
          src: [...ALLOWED_SRC_PROTOCOLS] as string[],
        },
      );

      expect(rendered.forbidden, payload.name).toEqual([]);
      expect(rendered.handlers, payload.name).toEqual([]);
      expect(rendered.unsafeUrls, payload.name).toEqual([]);

      // La mitad que impide que la sanitización se coma prosa: sin ella, una vista previa que
      // devolviera la cadena vacía ante cualquier entrada pasaría las tres aserciones de arriba.
      for (const fragment of payload.survives) {
        expect(rendered.text, payload.name).toContain(fragment);
      }

      expect(dialogs, payload.name).toEqual([]);
      expect(await page.evaluate(() => window.__xssTripped), payload.name).toBe(false);
    }

    expect(consoleErrors()).toEqual([]);
  });
});
