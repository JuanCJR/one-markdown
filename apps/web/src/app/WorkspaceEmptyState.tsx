/**
 * Contenido principal cuando no hay ningún documento abierto. Desde la spec 002 la barra lateral
 * sí tiene contenido, así que este texto deja de anunciar el árbol y pasa a decir qué hacer.
 */
export function WorkspaceEmptyState(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-prose text-slate-600">
      <h2 className="mb-2 text-base font-medium text-slate-900">Ningún documento abierto</h2>
      <p>Selecciona un documento en la barra lateral para verlo aquí.</p>
    </section>
  );
}
