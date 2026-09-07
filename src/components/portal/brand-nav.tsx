"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mensajes queda oculto por ahora (no se usa en esta fase) — el código y la
// ruta siguen intactos, solo se quitó del menú. Perfil, Facturación,
// Conexión de tienda, Oferta y comisión, Productos y Transacciones se
// consolidaron dentro de Cuenta. Notificaciones vive aparte, en el menú
// lateral, con su burbuja de pendientes. Campañas va justo debajo de
// Dashboard porque es la acción que más queremos que las marcas usen.
const items = [
  { href: "/marca", label: "Dashboard", exact: true },
  { href: "/marca/retos", label: "Campañas" },
  { href: "/marca/creadores", label: "Creadores vinculados", exact: true },
  // Nuevo — buscador para reclutar creadores en vez de solo esperar a que
  // te encuentren. Ver conversación del 2026-09-06.
  { href: "/marca/creadores/buscar", label: "Buscar creadores" },
  // Nuevo — alquilar contenido ya publicado de un creador vinculado para
  // pauta paga. Va junto a "Creadores vinculados" porque solo aplica ahí,
  // no es parte de "Mi tienda". Ver conversación del 2026-09-06.
  { href: "/marca/licencias", label: "Licencias de contenido" },
  { href: "/marca/encargos", label: "Encargos de contenido" },
  { href: "/marca/cuenta", label: "Cuenta" },
];

/// "Mi tienda" — catálogo, pagos y envíos propios de Marcolini, aparte de
/// la conexión con Shopify/WooCommerce (esa sigue viviendo en Cuenta). Ver
/// conversación del 2026-09-06.
const storeItems = [
  { href: "/marca/tienda/productos", label: "Crear productos" },
  { href: "/marca/tienda/pedidos", label: "Pedidos" },
  { href: "/marca/tienda/muestras", label: "Muestras" },
  { href: "/marca/tienda/pagos", label: "Pagos" },
  { href: "/marca/tienda/envios", label: "Envíos" },
  { href: "/marca/tienda/configuracion", label: "Configuración" },
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
          : pathname.startsWith(item.href);
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
      {storeItems.map((item) => {
        const active = pathname === item.href;
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
