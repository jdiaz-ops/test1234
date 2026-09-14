"use client";

import Link from "next/link";
import { useCart } from "@/components/storefront/cart-context";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";
import { resolveColorRef } from "@/lib/brand-theme";

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

const LOGO_SIZE_CLASS = {
  small: "w-7 h-7 text-sm",
  medium: "w-9 h-9 text-base",
  large: "w-12 h-12 text-lg",
};

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
  const theme = useStorefrontTheme();
  const { header } = theme;

  const bgStyle =
    header.bgColorRef === "fondo"
      ? undefined
      : { background: resolveColorRef(theme.colors, header.bgColorRef) };
  const logoSizeClass = LOGO_SIZE_CLASS[header.logoSize];
  const iconSizeClass = header.desktop.iconSize === "large" ? "sm:px-4 sm:py-2 sm:text-sm" : "sm:px-3 sm:py-1.5 sm:text-xs";
  const desktopCentered = header.desktop.logoPosition === "center";
  const mobileCentered = header.mobile.logoPosition === "center";

  const logo = (
    <Link href={basePath || "/"} className="flex items-center gap-3 shrink-0">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo subido por la marca
        <img
          src={logoUrl}
          alt={brandName}
          className={`${logoSizeClass} rounded-full object-cover border border-brand-line`}
        />
      ) : (
        <div className={`${logoSizeClass} rounded-full bg-brand-accent-soft flex items-center justify-center font-display font-semibold text-brand-accent`}>
          {brandName[0]?.toUpperCase()}
        </div>
      )}
      <span className="font-display font-semibold text-brand-ink">{brandName}</span>
    </Link>
  );

  const nav = menuItems.length > 0 && (
    <nav
      className={`items-center gap-5 ${
        header.mobile.show === "categories" ? "flex overflow-x-auto sm:overflow-visible" : "hidden sm:flex"
      }`}
    >
      {menuItems.map((item) =>
        isExternalUrl(item.url) ? (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-ink-soft hover:text-brand-ink whitespace-nowrap"
          >
            {item.label}
          </a>
        ) : (
          <Link
            key={item.id}
            href={resolveMenuHref(item.url, basePath)}
            className="text-sm text-brand-ink-soft hover:text-brand-ink whitespace-nowrap"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );

  const cartButton = (
    <Link
      href={`${basePath}/carrito`}
      className={`relative rounded-full border border-brand-line px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft shrink-0 ${iconSizeClass}`}
    >
      Carrito
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-mono">
          {count}
        </span>
      )}
    </Link>
  );

  return (
    <header
      className={`z-10 border-b border-brand-line ${
        header.sticky ? "sticky top-0" : ""
      } ${bgStyle ? "" : "bg-brand-bg/95 backdrop-blur"}`}
      style={bgStyle}
    >
      <div className="max-w-3xl mx-auto px-6 py-4 space-y-2">
        <div
          className={`flex items-center gap-4 ${
            desktopCentered ? "sm:grid sm:grid-cols-3" : "justify-between"
          } ${mobileCentered ? "justify-center relative" : "justify-between"}`}
        >
          <div className={mobileCentered ? "absolute left-6 sm:static" : ""}>{logo}</div>
          {desktopCentered && <div className="hidden sm:flex justify-center">{nav}</div>}
          <div className={`flex items-center gap-4 ${desktopCentered ? "justify-end" : ""} ${mobileCentered ? "ml-auto" : ""}`}>
            {!desktopCentered && nav}
            {cartButton}
          </div>
        </div>
        {header.mobile.show === "categories" && <div className="sm:hidden">{nav}</div>}
      </div>
    </header>
  );
}
