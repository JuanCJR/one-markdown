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
    <div className="flex min-h-screen items-center justify-center bg-sup-elevada px-4 py-12">
      <main className="w-full max-w-sm bg-sup-base p-6">
        <h1 className="mb-6 text-xl font-semibold text-tinta">{title}</h1>

        {children}

        {footer === undefined ? null : (
          <p className="mt-6 pt-4 text-sm text-tinta-secundaria">{footer}</p>
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
      data-cromo="primaria"
      className="min-h-11 w-full bg-cromo px-4 py-2 font-black text-sobre-cromo outline-none hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo disabled:cursor-not-allowed disabled:inerte disabled:text-tinta-desactivada"
    >
      {children}
    </button>
  );
}
