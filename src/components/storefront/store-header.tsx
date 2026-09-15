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

/// Un solo ítem de menú, compartido por el nav de computadora, la fila
/// deslizable de celular y el panel del hamburguesa — antes cada uno
/// repetía el mismo if/else externo-vs-interno por su cuenta.
function renderMenuLink(
  item: StoreHeaderMenuItem,
  basePath: string,
  className: string,
  onClick?: () => void,
) {
  return isExternalUrl(item.url) ? (
    <a
      key={item.id}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={className}
    >
      {item.label}
    </a>
  ) : (
    <Link key={item.id} href={resolveMenuHref(item.url, basePath)} onClick={onClick} className={className}>
      {item.label}
    </Link>
  );
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
  const showSearch = header.mobile.show === "search";
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

  // Solo en computadora — en celular el menú vive en la fila deslizable
  // de abajo (mobileNavRow) o en el panel del hamburguesa, nunca acá. Ver
  // conversación del 2026-09-15 (antes esto también se mostraba en
  // celular cuando mobile.show === "categories", duplicado con la fila
  // de abajo).
  const desktopNav = showMenu && (
    <nav className="hidden sm:flex items-center gap-5">
      {menuItems.map((item) =>
        renderMenuLink(item, basePath, "text-sm text-brand-ink-soft hover:text-brand-ink whitespace-nowrap"),
      )}
    </nav>
  );

  // Fila deslizable debajo del encabezado, en celular — siempre visible
  // si hay menú, sin importar qué se eligió en "Mostrar" (buscador o
  // íconos ya no la tapan, van juntos). Pedido explícito: "la barra de
  // menú así debajo que sea deslizable". Ver conversación del
  // 2026-09-15.
  const mobileNavRow = showMenu && (
    <nav className="sm:hidden flex items-center gap-5 overflow-x-auto">
      {menuItems.map((item) =>
        renderMenuLink(item, basePath, "text-sm text-brand-ink-soft hover:text-brand-ink whitespace-nowrap shrink-0"),
      )}
    </nav>
  );

  // Buscador grande de celular — un <form> GET liso a /buscar, sin JS:
  // funciona incluso donde la hidratación no prende. Se activa desde
  // Diseño → Encabezado → Mostrar → "Buscador grande". Ver conversación
  // del 2026-09-15.
  const searchBar = showSearch && (
    <form action={`${basePath}/buscar`} method="GET" role="search" className="flex-1 min-w-0">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-ink-soft pointer-events-none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          name="q"
          placeholder="Buscar"
          className="w-full rounded-full border border-brand-line bg-brand-bg pl-9 pr-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:ring-1 focus:ring-brand-accent"
        />
      </div>
    </form>
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
          {/* Con buscador: fila fija logo-izquierda / buscador-centro /
              carrito, propia de celular (la fila de computadora de abajo
              se ocupa de esa pantalla). Sin buscador: el layout de
              siempre, con las posiciones que la marca eligió. */}
          {searchBar && (
            <div className="flex items-center gap-3 sm:hidden">
              {logo}
              {searchBar}
              {cartButton}
            </div>
          )}
          <div
            className={`items-center gap-4 ${searchBar ? "hidden sm:flex" : "flex"} ${
              desktopCentered ? "sm:grid sm:grid-cols-3" : "justify-between"
            } ${mobileCentered ? "justify-center relative" : "justify-between"}`}
          >
            <div className={mobileCentered ? "absolute left-6 sm:static" : ""}>{logo}</div>
            {desktopCentered && <div className="hidden sm:flex justify-center">{desktopNav}</div>}
            <div className={`flex items-center gap-4 ${desktopCentered ? "justify-end" : ""} ${mobileCentered ? "ml-auto" : ""}`}>
              {!desktopCentered && desktopNav}
              {cartButton}
            </div>
          </div>
          {mobileNavRow}
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
                renderMenuLink(item, basePath, "text-sm text-brand-ink py-2.5 hover:text-brand-accent", () => setMenuOpen(false)),
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
