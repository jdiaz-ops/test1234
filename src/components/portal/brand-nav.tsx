"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/marca", label: "Dashboard", exact: true },
  { href: "/marca/ofertas", label: "Oferta y comisión" },
  { href: "/marca/retos", label: "Retos y Campañas" },
  { href: "/marca/creadores", label: "Creadores vinculados" },
  { href: "/marca/transacciones", label: "Transacciones" },
  { href: "/marca/perfil", label: "Perfil" },
  { href: "/marca/facturacion", label: "Facturación" },
  { href: "/marca/tienda", label: "Conexión de tienda" },
  { href: "/marca/notificaciones", label: "Notificaciones" },
  { href: "/marca/cuenta", label: "Cuenta" },
];

export function BrandNav() {
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
