"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/marcas", label: "Marcas" },
  { href: "/admin/creadores", label: "Creadores" },
  { href: "/admin/transacciones", label: "Transacciones" },
  { href: "/admin/finanzas", label: "Finanzas" },
  { href: "/admin/cobros", label: "Cobros" },
  { href: "/admin/pagos-creadores", label: "Pagos" },
  { href: "/admin/facturas", label: "Facturas" },
  { href: "/admin/fraude", label: "Antifraude" },
  { href: "/admin/configuracion", label: "Configuración" },
  { href: "/admin/equipo", label: "Equipo" },
  { href: "/admin/comunicados", label: "Comunicados" },
  { href: "/admin/notificaciones", label: "Notificaciones" },
  { href: "/admin/cuenta", label: "Cuenta" },
];

export function AdminNav({ pendingCobros = 0, pendingPagos = 0 }: { pendingCobros?: number; pendingPagos?: number }) {
  const pathname = usePathname();
  const badges: Record<string, number> = {
    "/admin/cobros": pendingCobros,
    "/admin/pagos-creadores": pendingPagos,
  };

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const badge = badges[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-brand-accent-soft text-brand-accent font-medium"
                : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
            }`}
          >
            {item.label}
            {badge > 0 && (
              <span className="bg-brand-accent text-white text-[10px] font-mono font-medium rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
