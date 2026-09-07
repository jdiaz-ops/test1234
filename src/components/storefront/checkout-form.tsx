"use client";

import { useEffect, useMemo, useState } from "react";
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
  referredCode,
}: {
  brandSlug: string;
  shippingFlatRate: number | null;
  freeShippingThreshold: number | null;
  paymentsReady: boolean;
  /// Código de la cookie de atribución de primera parte (ver src/proxy.ts
  /// y buildProductLink en lib/brand-store-link.ts) — si el comprador
  /// llegó por el link de un creador y no escribe un código a mano, se
  /// aplica solo al montar.
  referredCode?: string | null;
}) {
  const { items, subtotal } = useCart();
  // Un carrito nunca mezcla tipos (ver cart-context.tsx) — con que mire el
  // primer ítem alcanza para saber si este pedido es de servicios o no.
  const isServiceOrder = items[0]?.type === "SERVICE";

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");
  const [servicePreferredAt, setServicePreferredAt] = useState("");
  // Date.now() es impuro — no se puede llamar en render ni en un useMemo
  // (las reglas de pureza de React lo bloquean). Se lee una sola vez, tras
  // montar, igual que se hace con localStorage en cart-context.tsx.
  const [minServiceDate, setMinServiceDate] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Date.now() es impuro, solo se puede leer tras montar
    setMinServiceDate(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
  }, []);

  const [code, setCode] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Atribución por cookie — el comprador no escribió ningún código, pero
  // llegó con uno de la cookie (ver src/proxy.ts): se lo aplicamos solos,
  // como si lo hubiera escrito él. Nunca pisa uno que ya haya escrito a
  // mano (por eso solo corre una vez, al montar).
  useEffect(() => {
    if (referredCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- refleja la cookie de atribución, solo se puede leer tras montar
      setCode(referredCode);
      handleApplyCode(referredCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, a propósito
  }, []);

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
    if (isServiceOrder) return 0;
    if (freeShippingThreshold != null && afterDiscount >= freeShippingThreshold)
      return 0;
    return shippingFlatRate ?? 0;
  }, [afterDiscount, freeShippingThreshold, shippingFlatRate, isServiceOrder]);
  const total = afterDiscount + shippingCost;

  async function handleApplyCode(codeOverride?: string) {
    const toApply = codeOverride ?? code;
    if (!toApply.trim()) return;
    setCheckingCode(true);
    setCodeError(null);
    try {
      const res = await fetch(`/api/tienda/${brandSlug}/codigo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: toApply }),
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
          shippingAddress: isServiceOrder ? "" : shippingAddress,
          shippingCity: isServiceOrder ? "" : shippingCity,
          shippingNotes,
          // Colombia no tiene horario de verano — UTC-5 todo el año, así
          // que un offset fijo alcanza para que el datetime-local (que no
          // trae zona horaria) llegue al servidor como un instante sin
          // ambigüedad, sin importar en qué zona corra el servidor.
          servicePreferredAt:
            isServiceOrder && servicePreferredAt
              ? `${servicePreferredAt}:00-05:00`
              : "",
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

            {isServiceOrder ? (
              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  Fecha y hora que prefieres
                </label>
                <input
                  required
                  type="datetime-local"
                  min={minServiceDate}
                  value={servicePreferredAt}
                  onChange={(e) => setServicePreferredAt(e.target.value)}
                  className="input"
                />
                <p className="text-xs text-brand-ink-soft mt-1">
                  Es tu preferencia — la marca la confirma (o te propone otra)
                  después de tu pago.
                </p>
              </div>
            ) : (
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
            )}

            <div className="grid grid-cols-2 gap-3">
              {!isServiceOrder && (
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
              )}
              <div className={isServiceOrder ? "col-span-2" : ""}>
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
                  onClick={() => handleApplyCode()}
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
          {!isServiceOrder && (
            <div className="flex justify-between text-brand-ink-soft">
              <span>Envío</span>
              <span className="font-mono">
                {shippingCost === 0 ? "Gratis" : formatCOP(shippingCost)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-brand-ink pt-1">
            <span>Total</span>
            <span className="font-mono">{formatCOP(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
