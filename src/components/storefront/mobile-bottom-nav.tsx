"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ThemeConfig } from "@/lib/brand-theme";
import { resolveStoreLink } from "@/lib/resolve-store-link";
import { MOBILE_NAV_DEFAULT_ICONS } from "./mobile-nav-icons";

/// Navegador flotante fijo abajo, solo en celular (tipo app nativa) —
/// Inicio/Categorías/Carrito por defecto, personalizable en Diseño →
/// "Navegador móvil". Vive en el layout de la vitrina (se ve en toda la
/// tienda), no en cada página. Ver conversación del 2026-09-14.
export function MobileBottomNav({
  config,
  basePath,
}: {
  config: ThemeConfig["mobileNav"];
  basePath: string;
}) {
  const pathname = usePathname();
  const visible = config.items
    .map((item, i) => ({ ...item, index: i }))
    .filter((item) => item.enabled);
  if (!config.enabled || visible.length === 0) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 h-16 border-t border-brand-line bg-brand-surface flex sm:hidden"
      aria-label="Navegación"
    >
      {visible.map((item) => {
        const href = resolveStoreLink(item.url, basePath);
        // La home es el único caso donde hace falta match exacto — el
        // resto (categorías/carrito/lo que sea) usa startsWith para que
        // siga marcado activo en sub-páginas (ej. /coleccion/{slug}
        // cuenta como "Categorías").
        const isHome = href === basePath || href === `${basePath}/`;
        const active = isHome ? pathname === href || pathname === `${basePath}/` : pathname.startsWith(href);
        const Icon = MOBILE_NAV_DEFAULT_ICONS[item.index] ?? MOBILE_NAV_DEFAULT_ICONS[0];
        return (
          <Link
            key={item.index}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${
              active ? "text-brand-accent" : "text-brand-ink-soft"
            }`}
          >
            {item.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ícono subido por la marca
              <img src={item.iconUrl} alt="" className="w-5 h-5 object-contain" />
            ) : (
              <Icon />
            )}
            <span className="text-[10px] font-medium leading-none truncate max-w-[72px]">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
