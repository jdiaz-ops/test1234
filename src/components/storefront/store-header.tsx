"use client";

import { useState } from "react";
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
  const { count, openDrawer } = useCart();
  const theme = useStorefrontTheme();
  const { header } = theme;
  const [menuOpen, setMenuOpen] = useState(false);

  const bgStyle =
    header.bgColorRef === "fondo"
      ? undefined
      : { background: resolveColorRef(theme.colors, header.bgColorRef) };
  const logoSizeClass = LOGO_SIZE_CLASS[header.logoSize];
  const iconSizeClass = header.desktop.iconSize === "large" ? "sm:px-4 sm:py-2 sm:text-sm" : "sm:px-3 sm:py-1.5 sm:text-xs";
  const desktopCentered = header.desktop.logoPosition === "center";
  const mobileCentered = header.mobile.logoPosition === "center";
  // Habilitado por defecto (ver theme.header.showMenu) — sin ítems en el
  // menú no hay nada que mostrar, así que igual se apaga.
  const showMenu = header.showMenu && menuItems.length > 0;

  const logoLink = (
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

  // El logo y el hamburger comparten el mismo "casillero" del layout (ver
  // más abajo) para no alterar el conteo de columnas del grid/flex del
  // encabezado en computadora — el botón trae su propio sm:hidden, así
  // que en computadora no ocupa espacio ni se nota que está ahí.
  const logo = showMenu ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Abrir menú"
        className="sm:hidden shrink-0 w-8 h-8 -ml-1 flex items-center justify-center rounded-full hover:bg-brand-accent-soft text-brand-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-5 h-5">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {logoLink}
    </div>
  ) : (
    logoLink
  );

  const nav = showMenu && (
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
    <button
      type="button"
      onClick={openDrawer}
      className={`relative rounded-full border border-brand-line px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft shrink-0 ${iconSizeClass}`}
    >
      Carrito
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-mono">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <>
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

      {showMenu && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
            className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 sm:hidden ${
              menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className={`fixed top-0 left-0 z-50 h-full w-full max-w-xs bg-brand-surface shadow-2xl flex flex-col transition-transform duration-300 sm:hidden ${
              menuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-line shrink-0">
              <p className="font-display font-semibold text-brand-ink">Menú</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
                className="w-8 h-8 flex items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
              {menuItems.map((item) =>
                isExternalUrl(item.url) ? (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="text-sm text-brand-ink py-2.5 hover:text-brand-accent"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.id}
                    href={resolveMenuHref(item.url, basePath)}
                    onClick={() => setMenuOpen(false)}
                    className="text-sm text-brand-ink py-2.5 hover:text-brand-accent"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
