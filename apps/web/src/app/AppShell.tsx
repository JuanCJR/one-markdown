import { Outlet } from 'react-router';

import { useUiStore } from '../shared/store/ui.store';

/**
 * Layout persistente de la aplicación: navegación (árbol de documentos) + contenido.
 * Es el punto de anclaje de las specs 002–005 (árbol, editor, tabs, split view); aquí solo se fija
 * la estructura y los landmarks.
 */
export function AppShell(): React.JSX.Element {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <div className="flex h-full min-h-screen bg-white text-slate-900">
      <nav
        aria-label="Árbol de documentos"
        className={`flex shrink-0 flex-col border-r border-slate-200 bg-slate-50 transition-[width] ${
          sidebarCollapsed ? 'w-14' : 'w-64'
        }`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={!sidebarCollapsed}
          aria-controls="document-tree"
          className="m-2 rounded px-2 py-1 text-left text-sm text-slate-600 hover:bg-slate-200"
        >
          {sidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
        </button>

        <div id="document-tree" hidden={sidebarCollapsed} className="px-3 py-2 text-sm text-slate-500">
          El árbol de directorios llega con la spec 002.
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 px-6 py-4">
          <h1 className="text-lg font-semibold">One Markdown</h1>
        </header>

        <main role="main" className="min-h-0 flex-1 overflow-auto px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
