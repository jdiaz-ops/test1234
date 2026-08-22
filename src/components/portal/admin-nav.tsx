"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/marcas", label: "Marcas" },
  { href: "/admin/creadores", label: "Creadores" },
  { href: "/admin/transacciones", label: "Transacciones" },
  { href: "/admin/finanzas", label: "Finanzas" },
  { href: "/admin/fraude", label: "Antifraude" },
  { href: "/admin/configuracion", label: "Configuración" },
  { href: "/admin/equipo", label: "Equipo" },
  { href: "/admin/notificaciones", label: "Notificaciones" },
  { href: "/admin/cuenta", label: "Cuenta" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
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
    </nav>
  );
}
