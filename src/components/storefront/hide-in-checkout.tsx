"use client";

import { usePathname } from "next/navigation";

/// Esconde lo que envuelve mientras el comprador está pagando — mismo
/// criterio que MobileBottomNav. En el checkout no va el pie de página de
/// la tienda (redes, menú): distrae de terminar la compra, como en Shopify.
/// Pedido del 2026-10-04.
export function HideInCheckout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.endsWith("/checkout")) return null;
  return <>{children}</>;
}
