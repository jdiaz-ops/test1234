"use client";

import { useEffect } from "react";
import { writeCart } from "@/lib/storefront-cart";

/// Se monta solo cuando el pedido ya quedó PAID — recién ahí vaciamos el
/// carrito del comprador (mientras estuvo PENDING lo dejamos intacto, por
/// si canceló el pago y quiere reintentar sin volver a armar todo).
export function ClearCartIfPaid({ brandSlug }: { brandSlug: string }) {
  useEffect(() => {
    writeCart(brandSlug, []);
  }, [brandSlug]);
  return null;
}
