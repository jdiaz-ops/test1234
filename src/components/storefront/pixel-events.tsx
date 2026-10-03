"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  trackInitiateCheckout,
  trackPageView,
  trackPurchase,
  trackViewContent,
  type PixelItem,
} from "@/lib/ad-pixels";
import { useCart } from "@/components/storefront/cart-context";

/// La tienda navega sin recargar la página: cada cambio de ruta es una
/// visita nueva para Meta/TikTok. La primera ya la manda el código base.
export function PixelPageViews() {
  const pathname = usePathname();
  // Guarda la última ruta avisada: así una misma visita nunca se cuenta
  // dos veces aunque el efecto corra de nuevo.
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    trackPageView();
  }, [pathname]);
  return null;
}

/// Producto visto — en la ficha del producto.
export function TrackViewContent({ id, name, price }: { id: string; name: string; price: number }) {
  const sentFor = useRef<string | null>(null);
  useEffect(() => {
    if (sentFor.current === id) return;
    sentFor.current = id;
    trackViewContent({ id, name, price, quantity: 1 });
  }, [id, name, price]);
  return null;
}

/// Llegó al checkout — con lo que tiene en el carrito.
export function TrackInitiateCheckout() {
  const { items } = useCart();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || items.length === 0) return;
    sent.current = true;
    trackInitiateCheckout(
      items.map((i) => ({ id: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
    );
  }, [items]);
  return null;
}

/// Compra — en la página del pedido, solo cuando el pago quedó aprobado.
export function TrackPurchase({
  orderId,
  items,
  value,
}: {
  orderId: string;
  items: PixelItem[];
  value: number;
}) {
  useEffect(() => {
    trackPurchase(orderId, items, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez por pedido
  }, [orderId]);
  return null;
}
