import { create } from 'zustand';

interface UiState {
  /** La barra lateral del árbol de documentos está plegada. */
  readonly sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

/**
 * Estado de UI global. Por ahora solo el sidebar; las specs 002–005 sumarán aquí el árbol,
 * las tabs abiertas y el split view. Nada se persiste todavía.
 */
export const useUiStore = create<UiState>()((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: (): void => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
}));
