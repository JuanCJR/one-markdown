import { Link, Outlet } from 'react-router';

import { useAuthStore } from '../features/auth/auth.store';
import { DocumentTabs, EDITOR_PANEL_ID } from '../features/editor/DocumentTabs';
import { WorkspaceTreeView } from '../features/workspace/WorkspaceTreeView';
import { useUiStore } from '../shared/store/ui.store';

/**
 * Layout persistente de la aplicación: navegación (árbol de documentos) + contenido.
 * Es el punto de anclaje de las specs 002–005 (árbol, editor, tabs, split view); aquí solo se fija
 * la estructura y los landmarks.
 */
export function AppShell(): React.JSX.Element {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex h-full min-h-screen bg-sup-base text-tinta">
      <nav
        aria-label="Árbol de documentos"
        className={`flex shrink-0 flex-col bg-sup-elevada transition-[width] ${
          sidebarCollapsed ? 'w-14' : 'w-64'
        }`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={!sidebarCollapsed}
          aria-controls="document-tree"
          className="m-2 px-2 py-1 text-left text-sm text-tinta-secundaria hover:bg-tinta hover:text-sup-base"
        >
          {sidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
        </button>

        <div
          id="document-tree"
          hidden={sidebarCollapsed}
          className="min-h-0 flex-1 overflow-auto px-2 pb-3"
        >
          <WorkspaceTreeView />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <h1 className="text-lg font-semibold">One Markdown</h1>

          <div className="flex items-center gap-4 text-sm">
            {user === null ? null : <span className="text-tinta-secundaria">{user.email}</span>}

            <Link
              to="/settings/security"
              className=" px-1 font-medium text-tinta underline outline-none hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo"
            >
              Seguridad
            </Link>

            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              className="min-h-9 border border-hair-control px-3 py-1 font-medium text-tinta-secundaria outline-none hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/*
          La tira de pestañas va **aquí** y no dentro de la página del editor (`005/plan.md`,
          decisión 7): tiene que sobrevivir al documento que muestra —se ve mientras uno carga y se
          ve con la ruta en `/` si quedan pestañas— y no debe desmontarse y remontarse en cada salto,
          lo que perdería el foco y dispararía su región viva. De paso, estar por encima del `<main>`
          es lo que le da gratis el orden de tabulación que fija AC-27.
        */}
        <DocumentTabs />

        {/*
          El `id` sale de la constante que exporta `DocumentTabs`, que es quien la necesita para su
          `aria-controls`. Dos literales iguales en dos archivos es exactamente cómo un
          `aria-controls` acaba apuntando a nada sin que se note.
        */}
        <main id={EDITOR_PANEL_ID} role="main" className="min-h-0 flex-1 overflow-auto px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
