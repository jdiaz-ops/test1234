import Link from "@/components/storefront/store-link";

/// 404 de la vitrina — antes salía la página pelada de Next ("This page
/// could not be found"). Sin los params de la ruta no se puede cargar la
/// marca, así que es neutra; "/" es la portada de la tienda cuando se
/// sirve desde su subdominio o dominio propio.
export default function StorefrontNotFound() {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full rounded-2xl border border-brand-line bg-brand-surface p-8 text-center space-y-3">
        <p className="font-mono text-xs text-brand-accent tracking-widest">404</p>
        <h1 className="font-display text-xl font-semibold text-brand-ink">No encontramos esa página</h1>
        <p className="text-sm text-brand-ink-soft">
          Puede que el link esté viejo o que el producto o la colección ya no estén. Sigue viendo la tienda desde la
          portada.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-brand-button text-brand-button-text px-5 py-2 text-sm font-semibold hover:opacity-90"
        >
          Ir a la tienda
        </Link>
      </div>
    </div>
  );
}
