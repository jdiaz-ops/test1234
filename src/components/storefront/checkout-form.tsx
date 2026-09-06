"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/components/storefront/cart-context";
import {
  WompiCheckoutButton,
  type WompiWidgetParams,
} from "@/components/storefront/wompi-checkout-button";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CheckoutForm({
  brandSlug,
  shippingFlatRate,
  freeShippingThreshold,
  paymentsReady,
}: {
  brandSlug: string;
  shippingFlatRate: number | null;
  freeShippingThreshold: number | null;
  paymentsReady: boolean;
}) {
  const { items, subtotal } = useCart();

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");

  const [code, setCode] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wompiParams, setWompiParams] = useState<WompiWidgetParams | null>(
    null,
  );

  const discountAmount = discountPercent
    ? Math.round((subtotal * discountPercent) / 100)
    : 0;
  const afterDiscount = subtotal - discountAmount;
  const shippingCost = useMemo(() => {
    if (freeShippingThreshold != null && afterDiscount >= freeShippingThreshold)
      return 0;
    return shippingFlatRate ?? 0;
  }, [afterDiscount, freeShippingThreshold, shippingFlatRate]);
  const total = afterDiscount + shippingCost;

  async function handleApplyCode() {
    if (!code.trim()) return;
    setCheckingCode(true);
    setCodeError(null);
    try {
      const res = await fetch(`/api/tienda/${brandSlug}/codigo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();
      if (!res.ok) {
        setDiscountPercent(null);
        setCodeError(body?.error ?? "Código no válido.");
        return;
      }
      setDiscountPercent(body.discountPercent);
    } catch {
      setCodeError("No se pudo validar el código — intenta de nuevo.");
    } finally {
      setCheckingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/tienda/${brandSlug}/ordenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          buyerName,
          buyerEmail,
          buyerPhone,
          shippingAddress,
          shippingCity,
          shippingNotes,
          discountCode: discountPercent ? code : "",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSubmitError(body?.error ?? "No se pudo crear el pedido.");
        return;
      }
      setWompiParams(body.wompi);
    } catch {
      setSubmitError("No se pudo crear el pedido — revisa tu conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0 && !wompiParams) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Tu carrito está vacío — vuelve a la tienda y agrega algún producto.
      </p>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="order-2 md:order-1">
        {!wompiParams ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  Nombre completo
                </label>
                <input
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  Teléfono
                </label>
                <input
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-brand-ink mb-1">
                Correo
              </label>
              <input
                required
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm text-brand-ink mb-1">
                Dirección de envío
              </label>
              <input
                required
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  Ciudad
                </label>
                <input
                  required
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  Notas (opcional)
                </label>
                <input
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-brand-ink mb-1">
                Código de creador (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setDiscountPercent(null);
                  }}
                  className="input font-mono flex-1"
                  placeholder="Ej. LAURA30"
                />
                <button
                  type="button"
                  onClick={handleApplyCode}
                  disabled={checkingCode || !code.trim()}
                  className="rounded-full border border-brand-line px-4 text-sm font-medium hover:bg-brand-accent-soft disabled:opacity-50"
                >
                  {checkingCode ? "..." : "Aplicar"}
                </button>
              </div>
              {codeError && (
                <p className="text-xs text-red-600 mt-1">{codeError}</p>
              )}
              {discountPercent != null && (
                <p className="text-xs text-brand-accent mt-1">
                  Código aplicado — {discountPercent}% de descuento.
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-red-600">{submitError}</p>
            )}

            {!paymentsReady ? (
              <p className="text-sm text-brand-ink-soft rounded-xl border border-brand-line p-3">
                Esta tienda todavía no activó los pagos en línea — vuelve más
                tarde.
              </p>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Creando pedido..." : "Continuar al pago"}
              </button>
            )}
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-brand-ink">
              Tu pedido quedó registrado. Completa el pago con Wompi para
              confirmarlo — tus datos de tarjeta nunca pasan por Marcolini.
            </p>
            <WompiCheckoutButton params={wompiParams} />
          </div>
        )}
      </div>

      <div className="order-1 md:order-2 rounded-2xl border border-brand-line bg-brand-surface p-5 h-fit space-y-3">
        <p className="text-sm font-medium text-brand-ink">Resumen del pedido</p>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="text-brand-ink-soft">
                {item.name} × {item.quantity}
              </span>
              <span className="font-mono">
                {formatCOP(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-brand-line pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-brand-ink-soft">
            <span>Subtotal</span>
            <span className="font-mono">{formatCOP(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-brand-accent">
              <span>Descuento</span>
              <span className="font-mono">-{formatCOP(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-brand-ink-soft">
            <span>Envío</span>
            <span className="font-mono">
              {shippingCost === 0 ? "Gratis" : formatCOP(shippingCost)}
            </span>
          </div>
          <div className="flex justify-between font-semibold text-brand-ink pt-1">
            <span>Total</span>
            <span className="font-mono">{formatCOP(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
