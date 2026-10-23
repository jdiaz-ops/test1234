"use client";

import { useEffect, useState } from "react";
import Link from "@/components/storefront/store-link";
import { useCart } from "@/components/storefront/cart-context";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";
import { cartLineKey } from "@/lib/storefront-cart";
import { CARD_BUTTON_CLASS, CARD_PRIMARY_BUTTON_CLASS } from "@/components/storefront/product-card";

type Suggestion = {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number | null;
  type: "PHYSICAL" | "SERVICE" | "DIGITAL";
  hasVariants: boolean;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CartList({
  brandSlug,
  basePath = `/t/${brandSlug}`,
}: {
  brandSlug: string;
  basePath?: string;
}) {
  const { items, subtotal, updateQuantity, removeItem, closeDrawer, addItem } = useCart();
  const { cart } = useStorefrontTheme();

  // Sugerencias — se piden al servidor cada vez que cambia QUÉ productos
  // hay en el carrito (no la cantidad), ver getComplementaryProducts. Ver
  // conversación del 2026-09-30. El título depende de dónde salieron:
  // "Otros clientes también compraron" solo con ventas reales (2026-10-19).
  const cartProductIds = Array.from(new Set(items.map((i) => i.productId))).sort().join(",");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [alsoBought, setAlsoBought] = useState(false);
  useEffect(() => {
    if (!cart.suggestComplementary || !cartProductIds) return;
    let cancelled = false;
    fetch(`/api/tienda/${brandSlug}/complementarios?ids=${encodeURIComponent(cartProductIds)}`)
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((body) => {
        if (cancelled) return;
        setSuggestions(body.products ?? []);
        setAlsoBought(body.alsoBought === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cart.suggestComplementary, cartProductIds, brandSlug]);
  const visibleSuggestions = suggestions.filter((s) => !items.some((i) => i.productId === s.id));

  // El código de descuento ya no va en el carrito: se escribe en el pago
  // (checkout-form.tsx), un solo lugar. Pedido del 2026-10-19.

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-brand-ink-soft mb-4">
          Tu carrito está vacío.
        </p>
        <Link
          href={basePath || "/"}
          onClick={closeDrawer}
          className="inline-block rounded-full bg-brand-button text-brand-button-text px-5 py-2 text-sm font-semibold hover:opacity-90"
        >
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={cartLineKey(item)}
          className="flex items-center gap-4 rounded-2xl border border-brand-line bg-brand-surface p-4"
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto del producto
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-16 h-16 rounded-lg object-cover border border-brand-line shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-brand-accent-soft shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-ink truncate">
              {item.name}
            </p>
            {item.variantLabel && (
              <p className="text-xs text-brand-ink-soft">{item.variantLabel}</p>
            )}
            <p className="text-xs text-brand-ink-soft font-mono">
              {formatCOP(item.price)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateQuantity(item.productId, item.variantId, item.quantity - 1)
              }
              className="w-7 h-7 rounded-full border border-brand-line text-sm hover:bg-brand-accent-soft"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-mono">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() =>
                updateQuantity(item.productId, item.variantId, item.quantity + 1)
              }
              disabled={item.stock != null && item.quantity >= item.stock}
              className="w-7 h-7 rounded-full border border-brand-line text-sm hover:bg-brand-accent-soft disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.productId, item.variantId)}
            className="text-xs text-brand-ink-soft hover:text-red-600"
          >
            Quitar
          </button>
        </div>
      ))}

      {cart.suggestComplementary && visibleSuggestions.length > 0 && (
        <div className="pt-4 border-t border-brand-line space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-ink">
            {alsoBought ? "Otros clientes también compraron" : "También te puede gustar"}
          </p>
          {visibleSuggestions.map((s) => {
            const href = `${basePath}/${s.slug ?? ""}`;
            const sameType = items.length === 0 || items[0].type === s.type;
            const canAdd = !s.hasVariants && sameType && !(s.stock != null && s.stock <= 0);
            return (
              <div key={s.id} className="flex items-center gap-3">
                <Link href={href} onClick={closeDrawer} className="shrink-0">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto del producto
                    <img src={s.imageUrl} alt={s.name} className="w-14 h-14 object-cover border border-brand-line" />
                  ) : (
                    <div className="w-14 h-14 bg-brand-accent-soft" />
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={href} onClick={closeDrawer} className="text-sm font-medium text-brand-ink line-clamp-2 leading-snug">
                    {s.name}
                  </Link>
                  <p className="text-xs font-mono text-brand-ink-soft">{formatCOP(s.price)}</p>
                </div>
                {canAdd ? (
                  <button
                    type="button"
                    onClick={() =>
                      addItem({
                        productId: s.id,
                        variantId: null,
                        variantLabel: null,
                        slug: s.slug ?? "",
                        name: s.name,
                        price: s.price,
                        imageUrl: s.imageUrl,
                        stock: s.stock,
                        type: s.type,
                      })
                    }
                    className={`${CARD_BUTTON_CLASS} ${CARD_PRIMARY_BUTTON_CLASS} !w-auto shrink-0 px-4 py-2`}
                  >
                    Agregar
                  </button>
                ) : (
                  <Link
                    href={href}
                    onClick={closeDrawer}
                    className="text-xs font-bold uppercase tracking-wide text-brand-ink underline shrink-0"
                  >
                    Ver
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-brand-line space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-ink-soft">Subtotal</p>
            <p className="font-mono font-semibold text-brand-ink">
              {formatCOP(subtotal)}
            </p>
          </div>
          <Link
            href={`${basePath}/checkout`}
            onClick={closeDrawer}
            className="rounded-full bg-brand-button text-brand-button-text px-6 py-2.5 text-sm font-semibold hover:opacity-90"
          >
            Ir al pago →
          </Link>
        </div>
      </div>
    </div>
  );
}
