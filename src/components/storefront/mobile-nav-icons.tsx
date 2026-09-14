/// Íconos predefinidos del navegador móvil (ver theme.mobileNav) — uno
/// por posición fija (Inicio/Categorías/Carrito). Inline SVG, no
/// dependen de ninguna librería de íconos — se usan solo cuando el ítem
/// no tiene iconUrl propio (la marca no subió uno personalizado).

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function CategoriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 4h2l.4 2M6 16h12l3-8H5.4M6 16 5.4 6M6 16l-1.2 3H4" />
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="17.5" cy="20" r="1.2" />
    </svg>
  );
}

/// Índice fijo (0/1/2) — theme.mobileNav.items siempre tiene exactamente
/// 3 posiciones, en este orden (ver MOBILE_NAV_DEFAULTS en brand-theme.ts).
export const MOBILE_NAV_DEFAULT_ICONS = [HomeIcon, CategoriesIcon, CartIcon];
