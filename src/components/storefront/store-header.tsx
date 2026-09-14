"use client";

import Link from "next/link";
import { useCart } from "@/components/storefront/cart-context";

export type StoreHeaderMenuItem = { id: string; label: string; url: string };

/// Un link del menú es interno (empieza con "/") o externo (todo lo
/// demás) — uno interno se arma sobre basePath, uno externo se usa tal
/// cual y se abre en pestaña nueva. Ver StorefrontMenuItem en el schema.
function resolveMenuHref(url: string, basePath: string) {
  if (url.startsWith("/")) return `${basePath}${url}`;
  return url;
}

function isExternalUrl(url: string) {
  return !url.startsWith("/");
}

export function StoreHeader({
  brandSlug,
  brandName,
  logoUrl,
  basePath = `/t/${brandSlug}`,
  menuItems = [],
}: {
  brandSlug: string;
  brandName: string;
  logoUrl: string | null;
  /// "" cuando se sirve desde el subdominio de la marca ({slug}.marcolini.lat)
  /// — ver getStoreBasePath en lib/store-base-path.ts. Por defecto arma el
  /// link viejo /t/{slug} si no se pasa, para no romper ningún uso viejo.
  basePath?: string;
  /// Menú de navegación de la vitrina (ver StorefrontMenuPanel en el
  /// portal) — opcional, una tienda sin ítems configurados simplemente no
  /// muestra la barra. Ver conversación del 2026-09-14.
  menuItems?: StoreHeaderMenuItem[];
}) {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur border-b border-brand-line">
      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href={basePath || "/"} className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido por la marca
            <img
              src={logoUrl}
              alt={brandName}
              className="w-9 h-9 rounded-full object-cover border border-brand-line"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-brand-accent-soft flex items-center justify-center font-display font-semibold text-brand-accent">
              {brandName[0]?.toUpperCase()}
            </div>
          )}
          <span className="font-display font-semibold text-brand-ink">
            {brandName}
          </span>
        </Link>

        {menuItems.length > 0 && (
          <nav className="hidden sm:flex items-center gap-5">
            {menuItems.map((item) =>
              isExternalUrl(item.url) ? (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-ink-soft hover:text-brand-ink"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.id}
                  href={resolveMenuHref(item.url, basePath)}
                  className="text-sm text-brand-ink-soft hover:text-brand-ink"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        )}

        <Link
          href={`${basePath}/carrito`}
          className="relative rounded-full border border-brand-line px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft"
        >
          Carrito
          {count > 0 && (
            <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-mono">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
