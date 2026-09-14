"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/marca/tienda/productos", label: "Crear productos" },
  { href: "/marca/tienda/colecciones", label: "Colecciones" },
  // Antes vivía escondida al fondo de Configuración — su propio botón
  // desde el 2026-09-14, mismo nivel que el resto de secciones de "Mi
  // tienda" (como en Airbnb/Shopify).
  { href: "/marca/tienda/plantilla", label: "Plantilla" },
  { href: "/marca/tienda/diseno", label: "Diseño" },
  { href: "/marca/tienda/paginas", label: "Páginas" },
  { href: "/marca/tienda/pedidos", label: "Pedidos" },
  { href: "/marca/tienda/clientes", label: "Clientes" },
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
