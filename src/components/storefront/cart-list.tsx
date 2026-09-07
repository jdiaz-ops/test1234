"use client";

import Link from "next/link";
import { useCart } from "@/components/storefront/cart-context";

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
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-brand-ink-soft mb-4">
          Tu carrito está vacío.
        </p>
        <Link
          href={basePath || "/"}
          className="inline-block rounded-full bg-brand-accent text-white px-5 py-2 text-sm font-semibold hover:opacity-90"
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
          key={item.productId}
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
            <p className="text-xs text-brand-ink-soft font-mono">
              {formatCOP(item.price)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
              className="w-7 h-7 rounded-full border border-brand-line text-sm hover:bg-brand-accent-soft"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-mono">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
              disabled={item.stock != null && item.quantity >= item.stock}
              className="w-7 h-7 rounded-full border border-brand-line text-sm hover:bg-brand-accent-soft disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.productId)}
            className="text-xs text-brand-ink-soft hover:text-red-600"
          >
            Quitar
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between pt-4 border-t border-brand-line">
        <div>
          <p className="text-xs text-brand-ink-soft">Subtotal</p>
          <p className="font-mono font-semibold text-brand-ink">
            {formatCOP(subtotal)}
          </p>
        </div>
        <Link
          href={`${basePath}/checkout`}
          className="rounded-full bg-brand-accent text-white px-6 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          Ir al pago →
        </Link>
      </div>
    </div>
  );
}
