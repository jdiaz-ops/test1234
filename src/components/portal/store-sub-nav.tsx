"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/marca/tienda/productos", label: "Crear productos" },
  { href: "/marca/tienda/pedidos", label: "Pedidos" },
  { href: "/marca/tienda/muestras", label: "Muestras" },
  { href: "/marca/tienda/pagos", label: "Pagos" },
  { href: "/marca/tienda/envios", label: "Envíos" },
  { href: "/marca/tienda/configuracion", label: "Configuración" },
];

export function StoreSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 mb-8 border-b border-brand-line pb-4">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-1.5 text-sm ${
              active
                ? "bg-brand-accent text-white font-medium"
                : "border border-brand-line text-brand-ink-soft hover:bg-brand-accent-soft"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
