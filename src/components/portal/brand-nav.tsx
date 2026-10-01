"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REVIEWS_ENABLED, SAMPLES_ENABLED } from "@/lib/features";

// Mensajes queda oculto por ahora (no se usa en esta fase) — el código y la
// ruta siguen intactos, solo se quitó del menú. Perfil, Facturación,
// Conexión de tienda, Oferta y comisión, Productos y Transacciones se
// consolidaron dentro de Cuenta. Notificaciones vive aparte, en el menú
// lateral, con su burbuja de pendientes. Creadores va justo debajo de
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
  { href: "/marca/creadores/buscar", label: "Creadores", activePrefix: "/marca/creadores" },
  { href: "/marca/retos", label: "Campañas" },
  { href: "/marca/cuenta", label: "Cuenta" },
];

/// "Mi tienda" — catálogo, pagos y envíos propios de Marcolini, aparte de
/// la conexión con Shopify/WooCommerce (esa sigue viviendo en Cuenta). Ver
/// conversación del 2026-09-06.
///
/// Es la ÚNICA navegación de Mi tienda. Orden pedido por la marca el
/// 2026-10-01, como el día a día de una tienda (estilo Shopify): primero
/// Pedidos, después el catálogo, los clientes y el diseño. Pagos y Envíos
/// ya no van sueltos: viven dentro de Configuración, con pestañas arriba
/// (ver StoreSettingsTabs) — por eso `also` marca Configuración como activa
/// también en esas dos rutas. Páginas va junto a Diseño (es contenido de
/// la tienda). Reseñas se quitó (REVIEWS_ENABLED, src/lib/features.ts).
const storeItems: { href: string; label: string; also?: string[] }[] = [
  { href: "/marca/tienda/pedidos", label: "Pedidos" },
  { href: "/marca/tienda/productos", label: "Productos" },
  { href: "/marca/tienda/colecciones", label: "Colecciones" },
  { href: "/marca/tienda/clientes", label: "Clientes" },
  { href: "/marca/tienda/diseno", label: "Diseño" },
  { href: "/marca/tienda/paginas", label: "Páginas" },
  // Escondidos mientras su interruptor esté apagado (ver
  // src/lib/features.ts). Se filtran abajo.
  { href: "/marca/tienda/resenas", label: "Reseñas" },
  { href: "/marca/tienda/muestras", label: "Muestras" },
  {
    href: "/marca/tienda/configuracion",
    label: "Configuración",
    also: ["/marca/tienda/pagos", "/marca/tienda/envios", "/marca/tienda/conexiones"],
  },
];

export function BrandNav({
  unreadNotifications = 0,
  onboarding,
}: {
  unreadNotifications?: number;
  onboarding?: { completedCount: number; total: number };
}) {
  const pathname = usePathname();

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
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-brand-accent-soft text-brand-accent font-medium"
                : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      <p className="px-3 pt-4 pb-1 text-[11px] font-mono uppercase tracking-widest text-brand-ink-soft">
        Mi tienda
      </p>
      {storeItems
        .filter((item) => SAMPLES_ENABLED || item.href !== "/marca/tienda/muestras")
        .filter((item) => REVIEWS_ENABLED || item.href !== "/marca/tienda/resenas")
        .map((item) => {
        const active = pathname === item.href || (item.also ?? []).includes(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-brand-accent-soft text-brand-accent font-medium"
                : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      <Link
        href="/marca/notificaciones"
        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
          pathname.startsWith("/marca/notificaciones")
            ? "bg-brand-accent-soft text-brand-accent font-medium"
            : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
        }`}
      >
        Notificaciones
        {unreadNotifications > 0 && (
          <span className="bg-brand-accent text-white text-[10px] font-mono font-medium rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {unreadNotifications > 99 ? "99+" : unreadNotifications}
          </span>
        )}
      </Link>
    </nav>
  );
}
