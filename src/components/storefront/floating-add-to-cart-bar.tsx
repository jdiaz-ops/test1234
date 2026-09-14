"use client";

import { useEffect, useState } from "react";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number | null;
  type?: "PHYSICAL" | "SERVICE" | "DIGITAL";
};

/// Barra flotante fija abajo con el producto + "Agregar al carrito" —
/// aparece cuando el comprador scrollea y pierde de vista el botón
/// principal de la ficha (observa `sentinelId`, un <div> vacío que la
/// página pone justo debajo de ese botón). Ver
/// theme.productDetail.floatingAddToCart — habilitada por defecto.
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

  return (
    <div
      className={`fixed ${bottomOffsetClass} inset-x-0 z-30 border-t border-brand-line bg-brand-surface px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] transition-transform duration-200 ${
        visible ? "translate-y-0" : "translate-y-full pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-3 max-w-3xl mx-auto">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- foto del producto
          <img
            src={product.imageUrl}
            alt=""
            className="w-10 h-10 rounded-lg object-cover shrink-0 hidden xs:block"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand-ink truncate">{product.name}</p>
          <p className="text-xs font-mono text-brand-ink-soft">{formatCOP(product.price)}</p>
        </div>
        {hasVariants ? (
          <button
            type="button"
            onClick={scrollToOptions}
            className="shrink-0 bg-brand-accent text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90"
          >
            Elegir opciones
          </button>
        ) : (
          <div className="shrink-0">
            <AddToCartButton basePath={basePath} product={product} />
          </div>
        )}
      </div>
    </div>
  );
}
