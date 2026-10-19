"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CAMPAIGNS_ENABLED, REVIEWS_ENABLED, SAMPLES_ENABLED } from "@/lib/features";
import { SETTINGS_PATHS } from "@/components/portal/settings-shell";

// Mensajes queda oculto por ahora (no se usa en esta fase) — el código y la
// ruta siguen intactos, solo se quitó del menú. Perfil, Facturación,
// Conexión de tienda, Oferta y comisión, Productos y Transacciones se
// consolidaron dentro de Cuenta. Notificaciones va dentro de Configuración
// (ver settingsChildren), con su burbuja de pendientes. Creadores va justo debajo de
// Dashboard (orden pedido el 2026-09-14) y abre en Buscar: es la acción
// que más queremos que las marcas usen.
//
// Licencias de contenido y Encargos de contenido quedan OCULTOS del menú
// desde el 2026-09-14 (no son funcionalidad para el MVP) — las rutas
// /marca/licencias y /marca/encargos siguen intactas, solo no aparecen
// acá. Reactivar: volver a agregar sus entradas a este arreglo.
const items: { href: string; label: string; exact?: boolean; activePrefix?: string }[] = [
  { href: "/marca", label: "Dashboard", exact: true },
  // Creadores agrupa Buscar y Vinculados con pestañas (ver
  // creators-tabs.tsx) — antes eran dos entradas sueltas. Pedido de la
  // marca el 2026-10-01.
  // Abre en Buscar creadores, la primera pestaña (ver creators-tabs.tsx).
  { href: "/marca/creadores/buscar", label: "Creadores", activePrefix: "/marca/creadores" },
  // Muestras va justo debajo de Creadores (pedido de la marca el
  // 2026-10-01): es trato con creadores, no parte del día a día de la
  // tienda. Escondida si SAMPLES_ENABLED está apagado (src/lib/features.ts).
  ...(SAMPLES_ENABLED ? [{ href: "/marca/tienda/muestras", label: "Muestras" }] : []),
  // Escondida mientras CAMPAIGNS_ENABLED esté apagado (src/lib/features.ts).
  ...(CAMPAIGNS_ENABLED ? [{ href: "/marca/retos", label: "Campañas" }] : []),
];

/// "Mi tienda" — el día a día de la tienda (estilo Shopify): Pedidos y
/// Clientes van sueltos. Orden pedido por la marca el 2026-10-01.
const storeItems: { href: string; label: string }[] = [
  { href: "/marca/tienda/pedidos", label: "Pedidos" },
  { href: "/marca/tienda/clientes", label: "Clientes" },
];

/// Configuración se despliega con lo que se arma una vez y se toca poco:
/// el catálogo, el diseño, las páginas y las notificaciones (pedido del
/// 2026-10-19: "dentro de configuración van productos, colecciones, diseño,
/// páginas y notificación… así tenemos una página más minimalista"). El
/// propio "Configuración" abre los ajustes (perfil, programa, pagos,
/// envíos… ver SettingsShell) y queda marcado en todas esas rutas. Reseñas
/// se quitó (REVIEWS_ENABLED, src/lib/features.ts).
const settingsChildren: { href: string; label: string }[] = [
  { href: "/marca/tienda/productos", label: "Productos" },
  { href: "/marca/tienda/colecciones", label: "Colecciones" },
  { href: "/marca/tienda/diseno", label: "Diseño" },
  { href: "/marca/tienda/paginas", label: "Páginas" },
  // Escondida mientras su interruptor esté apagado. Se filtra abajo.
  { href: "/marca/tienda/resenas", label: "Reseñas" },
  { href: "/marca/notificaciones", label: "Notificaciones" },
];

function Badge({ count, title }: { count: number; title?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="bg-brand-accent text-white text-[10px] font-mono font-medium rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
      title={title}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function BrandNav({
  unreadNotifications = 0,
  openOrders = 0,
  onboarding,
}: {
  unreadNotifications?: number;
  /// Pedidos pagados que todavía no salen — burbuja en "Pedidos", como el
  /// número de pedidos sin preparar de Shopify.
  openOrders?: number;
  onboarding?: { completedCount: number; total: number };
}) {
  const pathname = usePathname();
  const children = settingsChildren.filter((item) => REVIEWS_ENABLED || item.href !== "/marca/tienda/resenas");
  const onSettings = SETTINGS_PATHS.includes(pathname);
  const childActive = children.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(false);
  const expanded = open || onSettings || childActive;
  const linkClass = (active: boolean) =>
    `flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
      active ? "bg-brand-accent-soft text-brand-accent font-medium" : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
    }`;

  return (
    <nav className="flex flex-col gap-0.5">
      {onboarding && (
        <Link
          href="/marca/onboarding"
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm mb-1 ${
            pathname.startsWith("/marca/onboarding")
              ? "bg-brand-accent-soft text-brand-accent font-medium"
              : "text-brand-accent hover:bg-brand-accent-soft"
          }`}
        >
          Empieza aquí
          <span className="text-[10px] font-mono font-medium">
            {onboarding.completedCount}/{onboarding.total}
          </span>
        </Link>
      )}
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.activePrefix ?? item.href);
        return (
          <Link key={item.href} href={item.href} className={linkClass(active)}>
            {item.label}
          </Link>
        );
      })}

      {/* Sin rótulo "Mi tienda": el menú va como una sola lista (pedido de
          la marca el 2026-10-01). "Pedidos" queda marcado también dentro
          del detalle de un pedido. */}
      {storeItems.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(pathname.startsWith(item.href))}>
          {item.label}
          {item.href === "/marca/tienda/pedidos" && (
            <Badge count={openOrders} title={`${openOrders} ${openOrders === 1 ? "pedido por enviar" : "pedidos por enviar"}`} />
          )}
        </Link>
      ))}

      <div className={`flex items-center rounded-lg ${onSettings ? "bg-brand-accent-soft" : "hover:bg-brand-accent-soft"}`}>
        <Link
          href="/marca/tienda/configuracion"
          className={`flex flex-1 items-center justify-between px-3 py-2 text-sm ${onSettings ? "text-brand-accent font-medium" : childActive ? "text-brand-ink" : "text-brand-ink-soft hover:text-brand-ink"}`}
        >
          Configuración
          {/* Cerrado, las notificaciones sin leer se ven acá. */}
          {!expanded && <Badge count={unreadNotifications} title="Notificaciones sin leer" />}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Ocultar las opciones de Configuración" : "Ver las opciones de Configuración"}
          className="px-3 py-2 text-xs text-brand-ink-soft hover:text-brand-ink"
        >
          <span className={`inline-block transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>
      {expanded && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-brand-line pl-3">
          {children.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(pathname.startsWith(item.href))}>
              {item.label}
              {item.href === "/marca/notificaciones" && <Badge count={unreadNotifications} />}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
