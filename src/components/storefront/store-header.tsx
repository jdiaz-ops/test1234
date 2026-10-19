"use client";

import type React from "react";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/storefront/cart-context";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";
import { resolveColorRef } from "@/lib/brand-theme";
import { storefrontLogoSrc } from "@/lib/logo-src";
import { CartIcon } from "@/components/storefront/mobile-nav-icons";

export type StoreHeaderMenuItem = { id: string; label: string; url: string; children?: StoreHeaderMenuItem[] };

/// "#" (o vacío) = el ítem no es un link: solo abre su submenú.
function isPlaceholderUrl(url: string) {
  return url.trim() === "" || url.trim() === "#";
}

function hasChildren(item: StoreHeaderMenuItem) {
  return Boolean(item.children && item.children.length > 0);
}

/// Para la fila deslizable de celular (sin desplegables): los ítems con
/// link van tal cual y un padre sin link se reemplaza por sus ítems.
function flattenForRow(items: StoreHeaderMenuItem[]): StoreHeaderMenuItem[] {
  return items.flatMap((item) => (isPlaceholderUrl(item.url) ? flattenForRow(item.children ?? []) : [item]));
}

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
/// Como renderMenuLink, pero un ítem sin link ("#") se muestra como texto.
function renderMenuEntry(item: StoreHeaderMenuItem, basePath: string, className: string, onClick?: () => void) {
  if (isPlaceholderUrl(item.url)) {
    return (
      <span key={item.id} className={className}>
        {item.label}
      </span>
    );
  }
  return renderMenuLink(item, basePath, className, onClick);
}

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

/// Hasta dónde el desplegable va en columnas (todo a la vista); con más
/// que esto va como lista con submenús al lado. Ver conversación del
/// 2026-10-18 ("El menú de rumi sigue un desastre").
const MEGA_MAX_CHILDREN = 6;
const MEGA_MAX_GRANDCHILDREN = 24;

/// Alto del logo — el ancho sale solo de la proporción de la imagen, sin
/// marco ni recorte circular. En celular va un escalón más grande que en
/// computadora: ahí el logo es lo único que identifica la tienda y se veía
/// chico al lado del buscador. Ver conversación del 2026-10-18.
/// Alto del logo por tamaño, y abajo el ancho máximo: desde que el logo
/// llega recortado (sin bordes vacíos, ver logo-src.ts) los altos de antes
/// lo dejaban enorme y, si el archivo es chico, pixelado — "el justo
/// medio" (2026-10-19).
const LOGO_HEIGHT_CLASS = {
  small: "h-8 sm:h-7",
  medium: "h-10 sm:h-9",
  large: "h-12 sm:h-12",
  // Ancho exacto (header.logoWidth, va en style): en celular se achica
  // hasta dejar espacio al menú y al carrito; en computador, a lo sumo
  // el 40 % del encabezado.
  custom: "h-auto max-w-[calc(100vw-12rem)] sm:max-w-[40vw]",
};

const LOGO_MAX_WIDTH_CLASS = {
  small: "max-w-[min(120px,calc(100vw-8.5rem))] sm:max-w-[140px]",
  medium: "max-w-[min(150px,calc(100vw-8.5rem))] sm:max-w-[180px]",
  large: "max-w-[min(190px,calc(100vw-8.5rem))] sm:max-w-[240px]",
};

/// El círculo con la inicial, solo para la marca que todavía no subió logo.
const LOGO_FALLBACK_CLASS = {
  small: "w-10 h-10 sm:w-7 sm:h-7 text-sm",
  medium: "w-14 h-14 sm:w-9 sm:h-9 text-base",
  large: "w-16 h-16 sm:w-12 sm:h-12 text-lg",
  custom: "w-14 h-14 sm:w-9 sm:h-9 text-base",
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
  // Dónde cae cada desplegable de computadora: debajo de su ítem, corrido
  // lo necesario para que no se salga de la pantalla (los últimos ítems
  // del menú quedan pegados al borde derecho). Se mide al pasar el mouse,
  // cuando el panel ya está visible.
  const [panelShift, setPanelShift] = useState<Record<string, number>>({});
  const placePanel = (id: string, group: HTMLElement) => {
    const panel = group.querySelector<HTMLElement>("[data-menu-panel]");
    if (!panel) return;
    requestAnimationFrame(() => {
      const margin = 16;
      const viewport = document.documentElement.clientWidth;
      const desired = group.getBoundingClientRect().left;
      const width = panel.offsetWidth;
      const left = Math.max(margin, Math.min(desired, viewport - margin - width));
      const shift = Math.round(left - desired);
      setPanelShift((prev) => (prev[id] === shift ? prev : { ...prev, [id]: shift }));
    });
  };
  // Los submenús de segundo nivel en computadora se abren hacia un lado
  // del ítem; si no caben a la derecha, a la izquierda, y si se salen por
  // abajo, se suben. Se mide al pasar el mouse.
  const [flyouts, setFlyouts] = useState<Record<string, { left: boolean; top: number }>>({});
  const placeFlyout = (id: string, item: HTMLElement) => {
    const panel = item.querySelector<HTMLElement>("[data-menu-flyout]");
    if (!panel) return;
    requestAnimationFrame(() => {
      const margin = 16;
      const viewport = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const rect = panel.getBoundingClientRect();
      const current = flyouts[id] ?? { left: false, top: 0 };
      const left = current.left ? rect.right + rect.width + margin > viewport && rect.left - rect.width >= margin ? false : current.left : rect.right > viewport - margin;
      const top = Math.round(Math.min(0, height - margin - (rect.bottom - current.top)));
      if (left !== current.left || top !== current.top) setFlyouts((prev) => ({ ...prev, [id]: { left, top } }));
    });
  };
  // Submenús abiertos en el panel lateral de celular (acordeón).
  const [openIds, setOpenIds] = useState<string[]>([]);
  const toggleOpen = (id: string) => setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const renderMobileItems = (items: StoreHeaderMenuItem[], depth: number): React.ReactNode =>
    items.map((item) => {
      const children = item.children ?? [];
      const open = openIds.includes(item.id);
      const textClass = depth === 0 ? "text-sm text-brand-ink" : "text-sm text-brand-ink-soft";
      return (
        <div key={item.id} className={depth > 0 ? "pl-3 border-l border-brand-line" : undefined}>
          <div className="flex items-center justify-between gap-2">
            {isPlaceholderUrl(item.url) && children.length > 0 ? (
              <button type="button" onClick={() => toggleOpen(item.id)} className={`${textClass} py-2.5 text-left flex-1 hover:text-brand-accent`}>
                {item.label}
              </button>
            ) : (
              renderMenuEntry(item, basePath, `${textClass} py-2.5 hover:text-brand-accent flex-1`, () => setMenuOpen(false))
            )}
            {children.length > 0 && (
              <button
                type="button"
                onClick={() => toggleOpen(item.id)}
                aria-expanded={open}
                aria-label={open ? `Cerrar ${item.label}` : `Abrir ${item.label}`}
                className="w-9 h-9 flex items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink text-lg leading-none"
              >
                {open ? "−" : "+"}
              </button>
            )}
          </div>
          {open && children.length > 0 && <div className="flex flex-col gap-1 mb-1">{renderMobileItems(children, depth + 1)}</div>}
        </div>
      );
    });

  const bgStyle =
    header.bgColorRef === "fondo"
      ? undefined
      : { background: resolveColorRef(theme.colors, header.bgColorRef) };
  const cartLarge = header.desktop.iconSize === "large";
  const desktopCentered = header.desktop.logoPosition === "center";
  const mobileCentered = header.mobile.logoPosition === "center";
  const showSearch = header.showSearch;
  // Habilitado por defecto (ver theme.header.showMenu) — sin ítems en el
  // menú no hay nada que mostrar, así que igual se apaga.
  const showMenu = header.showMenu && menuItems.length > 0;
  // Uno u otro, no los dos — pedido explícito: "Tal vez el menú que se
  // pueda seleccionar el estilo? Hamburger o debajo encabezado." Ver
  // conversación del 2026-09-15.
  const showHamburger = showMenu && header.mobile.menuStyle === "hamburger";
  const showMobileNavRow = showMenu && header.mobile.menuStyle === "below";

  // Con logo va solo el logo — sin nombre al lado ni marco: el logo ya es
  // la marca, como en Shopify. El nombre en texto queda solo como respaldo
  // para la marca que todavía no subió logo. Pedido explícito: "Quitar ese
  // texto de ahí. El logo sin recuadro o círculo." Ver conversación del
  // 2026-09-30.
  const logoLink = (
    <Link href={basePath || "/"} className="flex items-center gap-3 shrink-0">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo subido por la marca
        <img
          src={storefrontLogoSrc(brandSlug, logoUrl) ?? logoUrl}
          alt={brandName}
          className={
            header.logoSize === "custom"
              ? `${LOGO_HEIGHT_CLASS.custom} object-contain`
              : `${LOGO_HEIGHT_CLASS[header.logoSize]} ${LOGO_MAX_WIDTH_CLASS[header.logoSize]} w-auto object-contain`
          }
          style={header.logoSize === "custom" ? { width: header.logoWidth } : undefined}
        />
      ) : (
        <>
          <div
            className={`${LOGO_FALLBACK_CLASS[header.logoSize]} rounded-full bg-brand-accent-soft flex items-center justify-center font-display font-semibold text-brand-accent`}
          >
            {brandName[0]?.toUpperCase()}
          </div>
          <span className="font-display font-semibold text-brand-ink">{brandName}</span>
        </>
      )}
    </Link>
  );

  // Botón del menú lateral — solo existe en celular.
  const hamburgerButton = showHamburger ? (
    <button
      type="button"
      onClick={() => setMenuOpen(true)}
      aria-label="Abrir menú"
      className="shrink-0 w-8 h-8 -ml-1 flex items-center justify-center rounded-full hover:bg-brand-accent-soft text-brand-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-5 h-5">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  ) : null;

  // Solo en computadora — en celular el menú vive en la fila deslizable
  // de abajo (mobileNavRow) o en el panel del hamburguesa, nunca acá. Ver
  // conversación del 2026-09-15 (antes esto también se mostraba en
  // celular cuando mobile.show === "categories", duplicado con la fila
  // de abajo).
  // Un ítem con submenú abre un desplegable al pasar el mouse (o con el
  // teclado); si sus hijos también tienen hijos, el panel va en columnas
  // como el mega menú de la tienda original. Ver conversación del
  // 2026-10-18 (el menú de Rumi).
  const desktopNav = showMenu && (
    <nav className="hidden sm:flex flex-wrap items-center gap-x-5 gap-y-1">
      {menuItems.map((item) => {
        const linkClass = "text-sm text-brand-ink-soft hover:text-brand-ink whitespace-nowrap";
        if (!hasChildren(item)) return renderMenuEntry(item, basePath, linkClass);
        const children = item.children ?? [];
        // En columnas (mega menú) solo cuando cabe de un vistazo; un árbol
        // grande como el de Rumi (11 categorías con 80 subítems) va como
        // lista y cada categoría abre la suya al lado.
        const grandchildren = children.reduce((n, c) => n + (c.children?.length ?? 0), 0);
        const columns = children.some(hasChildren) && children.length <= MEGA_MAX_CHILDREN && grandchildren <= MEGA_MAX_GRANDCHILDREN;
        return (
          <div
            key={item.id}
            className="relative group"
            onMouseEnter={(e) => placePanel(item.id, e.currentTarget)}
            onFocus={(e) => placePanel(item.id, e.currentTarget)}
          >
            {isPlaceholderUrl(item.url) ? (
              <button type="button" aria-haspopup="true" className={`${linkClass} inline-flex items-center gap-1`}>
                {item.label}
                <span aria-hidden className="text-[10px]">▾</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                {renderMenuLink(item, basePath, linkClass)}
                <span aria-hidden className="text-[10px] text-brand-ink-soft">▾</span>
              </span>
            )}
            <div
              data-menu-panel
              className="absolute top-full pt-2 hidden group-hover:block group-focus-within:block z-50 w-max max-w-[min(100vw_-_2rem,56rem)]"
              style={{ left: panelShift[item.id] ?? 0 }}
            >
              <div className={`bg-brand-bg border border-brand-line rounded-xl shadow-lg p-4 ${columns ? "max-h-[70vh] overflow-y-auto" : ""}`}>
                {columns ? (
                  <div className="flex flex-wrap gap-x-8 gap-y-5">
                    {children.map((child) => (
                      <div key={child.id} className="min-w-[9rem] max-w-[14rem]">
                        {renderMenuEntry(child, basePath, "text-sm font-medium text-brand-ink hover:text-brand-accent block mb-1.5")}
                        {hasChildren(child) && (
                          <ul className="space-y-1">
                            {(child.children ?? []).map((grandchild) => (
                              <li key={grandchild.id}>
                                {renderMenuEntry(grandchild, basePath, "text-xs text-brand-ink-soft hover:text-brand-ink block")}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-0.5 min-w-[12rem]">
                    {children.map((child) =>
                      hasChildren(child) ? (
                        <li key={child.id} className="relative group/sub" onMouseEnter={(e) => placeFlyout(child.id, e.currentTarget)} onFocus={(e) => placeFlyout(child.id, e.currentTarget)}>
                          <div className="flex items-center justify-between gap-3">
                            {renderMenuEntry(child, basePath, "text-sm text-brand-ink-soft group-hover/sub:text-brand-ink block whitespace-nowrap py-0.5 flex-1")}
                            <span aria-hidden className="text-xs text-brand-ink-soft">›</span>
                          </div>
                          <div
                            data-menu-flyout
                            className={`absolute top-0 hidden group-hover/sub:block group-focus-within/sub:block z-50 w-max ${
                              flyouts[child.id]?.left ? "right-full pr-2" : "left-full pl-2"
                            }`}
                            style={{ top: flyouts[child.id]?.top ?? 0 }}
                          >
                            <div className="bg-brand-bg border border-brand-line rounded-xl shadow-lg p-3 max-h-[70vh] overflow-y-auto">
                              <ul className="space-y-0.5 min-w-[11rem] max-w-[20rem]">
                                {(child.children ?? []).map((grandchild) => (
                                  <li key={grandchild.id}>
                                    {renderMenuEntry(grandchild, basePath, "text-sm text-brand-ink-soft hover:text-brand-ink block py-0.5")}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </li>
                      ) : (
                        <li key={child.id}>
                          {renderMenuEntry(child, basePath, "text-sm text-brand-ink-soft hover:text-brand-ink block whitespace-nowrap py-0.5")}
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );

  // Fila deslizable debajo del encabezado, en celular — visible cuando el
  // estilo elegido es "below" (independiente de "Mostrar": buscador o
  // íconos ya no la tapan). Pedido explícito: "la barra de menú así
  // debajo que sea deslizable". Ver conversación del 2026-09-15.
  // La fila no tiene desplegables: un padre sin link propio ("#") se
  // reemplaza por sus ítems, y los demás van tal cual.
  const mobileNavRow = showMobileNavRow && (
    <nav className="sm:hidden flex items-center gap-5 overflow-x-auto">
      {flattenForRow(menuItems).map((item) =>
        renderMenuLink(item, basePath, "text-sm text-brand-ink-soft hover:text-brand-ink whitespace-nowrap shrink-0"),
      )}
    </nav>
  );

  // Buscador de celular — un <form> GET liso a /buscar, sin JS: funciona
  // incluso donde la hidratación no prende. Se activa desde Diseño →
  // Encabezado → Mostrar → "Buscador". Antes ocupaba la fila del logo y lo
  // dejaba chico y a la izquierda; ahora vive arriba del menú lateral (o
  // es una lupa junto al carrito cuando la tienda no tiene menú), y el
  // logo se queda con la fila entera. Ver conversación del 2026-10-18
  // ("Más grande y centrado").
  const searchBar = showSearch && (
    <form action={`${basePath}/buscar`} method="GET" role="search" className="w-full">
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
          className="w-full rounded-full border border-brand-line bg-brand-bg pl-9 pr-3 py-1.5 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:ring-1 focus:ring-brand-accent"
        />
      </div>
    </form>
  );

  // El mismo ícono de carrito que el navegador de abajo, con el contador
  // encima — antes era una pastilla con la palabra "Carrito". Ver
  // conversación del 2026-09-30.
  // Lupa — lleva a la página de búsqueda. En computadora siempre; en
  // celular solo cuando no hay menú lateral (ahí el buscador va adentro
  // del menú).
  const searchLink = (forMobile: boolean) =>
    showSearch && (
    <Link
      href={`${basePath}/buscar`}
      aria-label="Buscar"
      className={`${forMobile ? "flex sm:hidden" : "hidden sm:flex"} shrink-0 items-center justify-center rounded-full text-brand-ink hover:bg-brand-accent-soft ${
        !forMobile && cartLarge ? "w-12 h-12" : "w-10 h-10"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cartLarge ? "w-7 h-7" : "w-6 h-6"}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </Link>
    );

  const cartButton = (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={count > 0 ? `Carrito, ${count} productos` : "Carrito"}
      className={`relative shrink-0 flex items-center justify-center rounded-full text-brand-ink hover:bg-brand-accent-soft ${
        cartLarge ? "w-10 h-10 sm:w-12 sm:h-12" : "w-10 h-10"
      }`}
    >
      <CartIcon className={cartLarge ? "w-6 h-6 sm:w-7 sm:h-7" : "w-6 h-6"} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-brand-accent text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-mono">
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
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-3 sm:py-4 space-y-2">
          {/* Fila de celular: menú a la izquierda, logo centrado (o a la
              izquierda, según Diseño → Encabezado) con casi todo el ancho
              de la pantalla, y el carrito a la derecha. */}
          <div className="relative flex items-center justify-between gap-2 sm:hidden min-h-10">
            <div className="flex items-center gap-2 min-w-0">
              {hamburgerButton}
              {!mobileCentered && logoLink}
            </div>
            {mobileCentered && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center">{logoLink}</div>
            )}
            <div className="flex items-center gap-1 shrink-0">
              {!showHamburger && searchLink(true)}
              {cartButton}
            </div>
          </div>
          {/* Fila de computadora. */}
          <div
            className={`hidden sm:flex items-center gap-4 ${desktopCentered ? "sm:grid sm:grid-cols-3" : "justify-between"}`}
          >
            <div>{logoLink}</div>
            {desktopCentered && <div className="hidden sm:flex justify-center">{desktopNav}</div>}
            <div className={`flex items-center gap-4 ${desktopCentered ? "justify-end" : ""}`}>
              {!desktopCentered && desktopNav}
              {searchLink(false)}
              {cartButton}
            </div>
          </div>
          {mobileNavRow}
        </div>
      </header>

      {showHamburger && (
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
            {searchBar && <div className="px-4 pt-4">{searchBar}</div>}
            <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
              {renderMobileItems(menuItems, 0)}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
