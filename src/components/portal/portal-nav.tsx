"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/creador", label: "Dashboard", exact: true },
  { href: "/creador/marketplace", label: "Marketplace" },
  { href: "/creador/storefront", label: "Mi Storefront" },
  { href: "/creador/codigos", label: "Mis Códigos y Links" },
  { href: "/creador/transacciones", label: "Transacciones" },
  { href: "/creador/perfil", label: "Perfil" },
  { href: "/creador/pago", label: "Configuración de pago" },
  { href: "/creador/notificaciones", label: "Notificaciones" },
  { href: "/creador/cuenta", label: "Cuenta" },
];

export function PortalNav() {
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
