"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mensajes queda oculto por ahora (no se usa en esta fase) — el código y la
// ruta siguen intactos, solo se quitó del menú. Perfil, Facturación y
// Conexión de tienda se consolidaron dentro de Cuenta. Notificaciones vive
// aparte, en el menú lateral, con su burbuja de pendientes.
const items = [
  { href: "/marca", label: "Dashboard", exact: true },
  { href: "/marca/ofertas", label: "Oferta y comisión" },
  { href: "/marca/retos", label: "Retos" },
  { href: "/marca/creadores", label: "Creadores vinculados" },
  { href: "/marca/transacciones", label: "Transacciones" },
  { href: "/marca/cuenta", label: "Cuenta" },
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
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
