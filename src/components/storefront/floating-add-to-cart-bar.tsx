"use client";

import { useEffect, useState } from "react";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";

type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number | null;
  type?: "PHYSICAL" | "SERVICE" | "DIGITAL";
};

/// Barra flotante fija abajo con solo el botón "Agregar al carrito",
/// centrado — aparece cuando el comprador scrollea y pierde de vista el
/// botón principal de la ficha (observa `sentinelId`, un <div> vacío que
/// la página pone justo debajo de ese botón). Ver
/// theme.productDetail.floatingAddToCart — habilitada por defecto. Antes
/// llevaba también la foto, el nombre y el precio; la marca pidió solo el
/// botón. Ver conversación del 2026-09-30.
///
/// Con variantes no repite el selector acá (evita duplicar ese estado) —
/// en su lugar el botón lleva de vuelta arriba a elegir la combinación.
/// `bottomOffsetClass` deja lugar para el navegador móvil (ver
/// mobile-bottom-nav.tsx) cuando ambos están activos a la vez.
export function FloatingAddToCartBar({
  sentinelId,
  basePath,
  product,
  hasVariants,
  bottomOffsetClass = "bottom-0",
}: {
  sentinelId: string;
  basePath: string;
  product: Product;
  hasVariants: boolean;
  bottomOffsetClass?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(sentinelId);
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Solo cuenta como "perdido de vista" cuando quedó arriba del
        // viewport (scrolleó hacia abajo) — si el sentinel está debajo
        // (la página es corta / recién cargó) no hay que mostrar nada
        // todavía.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelId]);

  function scrollToOptions() {
    document.getElementById(sentinelId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const buttonClass =
    "bg-brand-accent text-white rounded-full px-10 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40";

  return (
    <div
      className={`fixed ${bottomOffsetClass} inset-x-0 z-30 border-t border-brand-line bg-brand-surface px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] transition-transform duration-200 ${
        visible ? "translate-y-0" : "translate-y-full pointer-events-none"
      }`}
    >
      <div className="flex justify-center">
        {hasVariants ? (
          <button type="button" onClick={scrollToOptions} className={buttonClass}>
            Elegir opciones
          </button>
        ) : (
          <AddToCartButton basePath={basePath} product={product} className={buttonClass} />
        )}
      </div>
    </div>
  );
}
