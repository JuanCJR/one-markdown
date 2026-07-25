interface AuthPageLayoutProps {
  /** Único `h1` de la vista. */
  readonly title: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
}

/** Layout de las vistas públicas de auth: fuera del `AppShell`, centrado y sin navegación. */
export function AuthPageLayout({
  title,
  children,
  footer,
}: AuthPageLayoutProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <main className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">{title}</h1>

        {children}

        {footer === undefined ? null : (
          <p className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">{footer}</p>
        )}
      </main>
    </div>
  );
}

interface AuthSubmitButtonProps {
  readonly children: React.ReactNode;
  readonly busy: boolean;
}

/**
 * El nombre accesible **no** cambia mientras la petición está en vuelo (nada de "Entrando…"):
 * renombrar un control en medio de la interacción desorienta al lector de pantalla. El estado se
 * comunica con `disabled` y `aria-busy`.
 */
export function AuthSubmitButton({ children, busy }: AuthSubmitButtonProps): React.JSX.Element {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="min-h-11 w-full rounded-md bg-blue-700 px-4 py-2 font-medium text-white outline-none hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {children}
    </button>
  );
}
