"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/storefront/cart-context";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";
import { cartLineKey } from "@/lib/storefront-cart";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";

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
  const { items, subtotal, updateQuantity, removeItem, discountCode, setDiscountCode } = useCart();
  const { cart } = useStorefrontTheme();
  const isPhysicalCart = items[0]?.type === "PHYSICAL";

  const [codeInput, setCodeInput] = useState(discountCode ?? "");
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeApplied, setCodeApplied] = useState(!!discountCode);

  const [region, setRegion] = useState("");
  const [shippingResult, setShippingResult] = useState<{ cents: number } | { error: string } | null>(null);
  const [calculatingShipping, setCalculatingShipping] = useState(false);

  async function applyCode() {
    if (!codeInput.trim()) return;
    setCheckingCode(true);
    setCodeError(null);
    try {
      const res = await fetch(`/api/tienda/${brandSlug}/codigo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setCodeError(body?.error ?? "Código no válido.");
        setCodeApplied(false);
        return;
      }
      setDiscountCode(codeInput.trim().toUpperCase());
      setCodeApplied(true);
    } catch {
      setCodeError("No se pudo validar el código — intenta de nuevo.");
    } finally {
      setCheckingCode(false);
    }
  }

  function removeCode() {
    setDiscountCode(null);
    setCodeApplied(false);
    setCodeInput("");
  }

  async function calculateShipping() {
    if (!region) return;
    setCalculatingShipping(true);
    setShippingResult(null);
    try {
      const res = await fetch(`/api/tienda/${brandSlug}/envio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, orderAmountCents: Math.round(subtotal * 100), weightKg: 0 }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) setShippingResult({ cents: body.shippingCents });
      else setShippingResult({ error: body?.error ?? "No se pudo cotizar el envío." });
    } catch {
      setShippingResult({ error: "No se pudo cotizar — revisa tu conexión." });
    } finally {
      setCalculatingShipping(false);
    }
  }

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

  const belowMinimum = cart.minPurchaseAmount != null && subtotal < cart.minPurchaseAmount;

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

      {cart.showViewMoreButton && (
        <Link href={basePath || "/"} className="text-xs text-brand-accent hover:underline inline-block">
          + Ver más productos
        </Link>
      )}

      {cart.allowCoupon && (
        <div className="rounded-xl border border-brand-line p-3">
          {codeApplied && discountCode ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-brand-ink">
                Código aplicado: <span className="font-mono font-medium">{discountCode}</span>
              </p>
              <button type="button" onClick={removeCode} className="text-xs text-red-600 hover:underline">
                Quitar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Código de descuento"
                className="input text-sm font-mono flex-1"
              />
              <button
                type="button"
                onClick={applyCode}
                disabled={checkingCode || !codeInput.trim()}
                className="rounded-full border border-brand-line px-4 text-sm font-medium hover:bg-brand-accent-soft disabled:opacity-50 shrink-0"
              >
                {checkingCode ? "..." : "Aplicar"}
              </button>
            </div>
          )}
          {codeError && <p className="text-xs text-red-600 mt-1">{codeError}</p>}
        </div>
      )}

      {cart.shippingCalculator && isPhysicalCart && (
        <div className="rounded-xl border border-brand-line p-3 space-y-2">
          <p className="text-xs font-medium text-brand-ink">Calcular costo de envío</p>
          <div className="flex gap-2">
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="input text-sm flex-1">
              <option value="" disabled>
                Tu departamento
              </option>
              {COLOMBIA_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={calculateShipping}
              disabled={!region || calculatingShipping}
              className="rounded-full border border-brand-line px-4 text-sm font-medium hover:bg-brand-accent-soft disabled:opacity-50 shrink-0"
            >
              {calculatingShipping ? "..." : "Calcular"}
            </button>
          </div>
          {shippingResult && "cents" in shippingResult && (
            <p className="text-sm text-brand-ink">
              Envío a {region}:{" "}
              <span className="font-mono font-medium">
                {shippingResult.cents === 0 ? "Gratis" : formatCOP(shippingResult.cents / 100)}
              </span>
            </p>
          )}
          {shippingResult && "error" in shippingResult && (
            <p className="text-xs text-red-600">{shippingResult.error}</p>
          )}
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
          {belowMinimum ? (
            <p className="text-xs text-brand-ink-soft text-right max-w-[60%]">
              Compra mínima: {formatCOP(cart.minPurchaseAmount!)} — te faltan{" "}
              {formatCOP(cart.minPurchaseAmount! - subtotal)}
            </p>
          ) : (
            <Link
              href={`${basePath}/checkout`}
              className="rounded-full bg-brand-accent text-white px-6 py-2.5 text-sm font-semibold hover:opacity-90"
            >
              Ir al pago →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
