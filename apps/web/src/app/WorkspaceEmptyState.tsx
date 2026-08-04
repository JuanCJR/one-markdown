import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { useEditorStore } from '../features/editor/editor.store';
import { useUiStore } from '../shared/store/ui.store';
import { SIN_DOCUMENTO } from '../shared/textos/textos';

/**
 * Contenido principal cuando no hay ningún documento abierto.
 *
 * Desde la fase 6 el vacío **ofrece una salida** en vez de describir dónde está el árbol («Selecciona
 * un documento en la barra lateral para verlo aquí»): quien lee eso ya está viendo la barra lateral,
 * así que la frase no le decía nada que no supiera y le dejaba el trabajo entero.
 *
 * Son dos salidas y no una, porque las dos situaciones son distintas:
 *
 * - **Con historial** —hay pestañas abiertas—, un enlace a la última. Es un `<Link>` de verdad, así
 *   que se puede abrir en otra pestaña del navegador y el botón «atrás» se comporta.
 * - **Sin historial** —sesión recién empezada—, un botón que lleva el foco a la estructura. Es un
 *   botón y no un enlace porque no navega a ninguna parte: mueve el foco dentro de esta misma
 *   página, y anunciarlo como enlace prometería un destino que no hay.
 *
 * Qué significa «el último que escribiste»: la última pestaña abierta **de esta sesión**. Nada
 * persiste entre recargas (`editor.store.ts`), así que no hay un «último» de ayer que ofrecer, y
 * fingir que sí llevaría a un enlace que no abre nada. Ver `docs/design/06-marca.md` §7.
 */
export function WorkspaceEmptyState(): React.JSX.Element {
  const ultimoAbierto = useEditorStore((state) => state.openIds.at(-1) ?? null);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  /**
   * Queda pendiente llevar el foco al árbol.
   *
   * Es un `ref` y **no** estado: con la barra plegada el árbol está `hidden` y no es enfocable, así
   * que hay que esperar al render que la despliega, pero el dato no se pinta. En `useState` habría
   * que apagarlo dentro del efecto, que es un `setState` en un efecto —un render en cascada, y lo
   * que señala `react-hooks/set-state-in-effect`—. El efecto se dispara con el cambio de
   * `sidebarCollapsed`, que sí es estado de verdad.
   */
  const pendienteDeFoco = useRef(false);

  /**
   * La única parada de tabulación del árbol (roving tabindex, `WorkspaceTreeView`). Se busca por el
   * rol y no por un `id` para no atarse a un detalle de otro componente; si el árbol todavía no
   * tiene nodos —está cargando, o el archivo está vacío— no hay nada que enfocar y no pasa nada.
   */
  const enfocaLaEstructura = (): void => {
    document.querySelector<HTMLElement>('[role="tree"] [role="treeitem"][tabindex="0"]')?.focus();
  };

  useEffect(() => {
    if (!pendienteDeFoco.current || sidebarCollapsed) {
      return;
    }

    pendienteDeFoco.current = false;
    enfocaLaEstructura();
  }, [sidebarCollapsed]);

  return (
    <section className="mx-auto max-w-prose text-tinta-secundaria">
      <h1 className="mb-4 text-base font-medium text-tinta">{SIN_DOCUMENTO.titulo}</h1>

      {ultimoAbierto === null ? (
        <button
          type="button"
          onClick={() => {
            // Con la barra ya desplegada el foco va ahora mismo; plegada, hay que desplegarla y
            // esperar al render, porque hasta entonces el árbol está `hidden` y no acepta el foco.
            if (!sidebarCollapsed) {
              enfocaLaEstructura();

              return;
            }

            pendienteDeFoco.current = true;
            toggleSidebar();
          }}
          className="min-h-9 border border-hair-control px-3 py-1 font-medium text-tinta outline-solid outline-0 hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo"
        >
          {SIN_DOCUMENTO.elegirEnEstructura}
        </button>
      ) : (
        <Link
          to={`/documents/${ultimoAbierto}`}
          className="text-tinta underline hover:bg-tinta hover:text-sup-base"
        >
          {SIN_DOCUMENTO.abrirUltimo}
        </Link>
      )}
    </section>
  );
}
