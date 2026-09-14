"use client";

import { useEffect } from "react";
import { useCart } from "@/components/storefront/cart-context";
import { CartList } from "@/components/storefront/cart-list";

/// Panel lateral del carrito — lo abren el botón "Carrito" del header
/// (store-header.tsx) y el ítem "Carrito" del navegador móvil
/// (mobile-bottom-nav.tsx), en vez de navegar a /carrito. Así alguien
/// viendo un producto o una colección puede consultar el carrito sin
/// perder su lugar — si entrara a otra página para verlo, después no
/// sabría cómo volver y se podría perder la venta. Ver conversación del
/// 2026-09-14. La página /carrito sigue existiendo aparte (por si alguien
/// entra directo a esa URL), reusa el mismo <CartList>.
export function CartDrawer({
  brandSlug,
  basePath,
}: {
  brandSlug: string;
  basePath?: string;
}) {
  const { drawerOpen, closeDrawer } = useCart();

  // Esc para cerrar — comportamiento esperado de cualquier panel/modal.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <>
      <div
        onClick={closeDrawer}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${
          drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tu carrito"
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-brand-surface shadow-2xl flex flex-col transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-line shrink-0">
          <p className="font-display font-semibold text-brand-ink">Tu carrito</p>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Cerrar carrito"
            className="w-8 h-8 flex items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <CartList brandSlug={brandSlug} basePath={basePath} />
        </div>
      </div>
    </>
  );
}
