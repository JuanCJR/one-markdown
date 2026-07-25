/** Placeholder del área de trabajo. La spec 002 lo reemplaza por el árbol y los documentos. */
export function WorkspaceEmptyState(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-prose text-slate-600">
      <h2 className="mb-2 text-base font-medium text-slate-900">Workspace vacío</h2>
      <p>
        Todavía no hay ningún documento abierto. Cuando existan directorios y documentos, aparecerán
        en la barra lateral.
      </p>
    </section>
  );
}
