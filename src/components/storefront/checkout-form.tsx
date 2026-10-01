"use client";

import { useEffect, useId, useState } from "react";
import { useCart } from "@/components/storefront/cart-context";
import { cartLineKey } from "@/lib/storefront-cart";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import { taxIncluded, orderTotal } from "@/lib/order-math";
import { openWompiWidget, type WompiParams } from "@/components/storefront/wompi-widget";

type PendingPayment = {
  payload: string;
  wompi: WompiParams;
  customerData: Record<string, string>;
  checkoutUrl: string;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const ID_TYPES = [
  { value: "CC", label: "CC", field: "Cédula" },
  { value: "NIT", label: "NIT", field: "NIT" },
  { value: "CE", label: "CE", field: "Cédula de extranjería" },
  { value: "PASAPORTE", label: "Pasaporte", field: "Pasaporte" },
  { value: "PPT", label: "PPT", field: "PPT" },
] as const;

const inputClass =
  "peer block w-full rounded-lg border border-brand-line bg-brand-surface px-3 pt-5 pb-1.5 text-sm text-brand-ink placeholder-transparent focus:border-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink";

/// Campo con la etiqueta adentro, como en el checkout de Shopify: grande
/// mientras está vacío, chiquita arriba cuando se escribe.
function Field({
  label,
  value,
  onChange,
  required,
  optional,
  type = "text",
  inputMode,
  autoComplete,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  optional?: boolean;
  type?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  autoComplete?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={label}
        className={inputClass}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 right-3 top-1.5 truncate text-[11px] text-brand-ink-soft transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[11px]"
      >
        {label}
        {optional && " (opcional)"}
      </label>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  required,
  children,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`relative ${className}`}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="block w-full appearance-none rounded-lg border border-brand-line bg-brand-surface px-3 pt-5 pb-1.5 pr-8 text-sm text-brand-ink focus:border-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink"
      >
        {children}
      </select>
      <label htmlFor={id} className="pointer-events-none absolute left-3 top-1.5 text-[11px] text-brand-ink-soft">
        {label}
      </label>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink-soft"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/// Checkout de una sola página, como el de Shopify: contacto, entrega (con
/// cédula o NIT), métodos de envío, pago con Wompi y dirección de
/// facturación a la izquierda; el resumen del pedido a la derecha. "Pagar
/// ahora" crea el pedido y abre enseguida la ventana de pago de Wompi con
/// los datos ya llenos (ver wompi-widget.ts) — antes había un paso
/// intermedio con un segundo botón. Ver conversación del 2026-10-01.
export function CheckoutForm({
  requireBillingId = false,
  brandSlug,
  basePath = `/t/${brandSlug}`,
  taxRatePercent,
  paymentsReady,
  referredCode,
}: {
  brandSlug: string;
  /// Prefijo de los links de la tienda ("" en el subdominio).
  basePath?: string;
  /// BrandProfile.taxRatePercent — solo para mostrar cuánto IVA va
  /// incluido; el monto real lo calcula createStoreOrder en el servidor.
  taxRatePercent: number;
  paymentsReady: boolean;
  /// Código de la cookie de atribución de primera parte (ver src/proxy.ts)
  /// — si el comprador llegó por el link de un creador se aplica solo.
  referredCode?: string | null;
  /// La tienda factura electrónicamente (Dataico): la cédula o NIT es
  /// obligatoria. Si no, el campo es opcional.
  requireBillingId?: boolean;
}) {
  const { items, subtotal, discountCode: cartDiscountCode } = useCart();
  // Un carrito nunca mezcla tipos (ver cart-context.tsx).
  const isServiceOrder = items[0]?.type === "SERVICE";
  const isDigitalOrder = items[0]?.type === "DIGITAL";
  const needsShipping = !isServiceOrder && !isDigitalOrder;

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idType, setIdType] = useState("CC");
  const [idNumber, setIdNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [sameBilling, setSameBilling] = useState(true);
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingRegion, setBillingRegion] = useState("");
  // Autorización de datos personales (Ley 1581) — obligatoria para pagar.
  const [dataConsent, setDataConsent] = useState(false);
  const [servicePreferredAt, setServicePreferredAt] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Date.now() es impuro — se lee una sola vez tras montar.
  const [minServiceDate, setMinServiceDate] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Date.now() es impuro, solo se puede leer tras montar
    setMinServiceDate(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
  }, []);

  const [code, setCode] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Precarga el código del carrito o de la cookie de atribución (el del
  // carrito gana). Solo al montar.
  useEffect(() => {
    const initialCode = cartDiscountCode || referredCode;
    if (initialCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- refleja el carrito/cookie de atribución, solo se puede leer tras montar
      setCode(initialCode);
      handleApplyCode(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, a propósito
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [openingWompi, setOpeningWompi] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const discountAmount = discountPercent ? Math.round((subtotal * discountPercent) / 100) : 0;
  const afterDiscount = subtotal - discountAmount;

  // El envío depende de la zona que cubra el departamento: se cotiza en
  // vivo apenas lo eligen (en pesos; la API responde centavos). El cobro
  // real lo recalcula createStoreOrder al confirmar.
  const [shippingQuote, setShippingQuote] = useState<{
    amount: number | null;
    name: string | null;
    error: string | null;
    loading: boolean;
  }>({ amount: null, name: null, error: null, loading: false });

  useEffect(() => {
    if (!needsShipping || !region) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea la cotización cuando se borra el departamento
      setShippingQuote({ amount: null, name: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setShippingQuote((prev) => ({ ...prev, loading: true, error: null }));
    fetch(`/api/tienda/${brandSlug}/envio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, orderAmountCents: Math.round(afterDiscount * 100), weightKg: 0 }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (body?.ok) {
          setShippingQuote({ amount: body.shippingCents / 100, name: body.rateName ?? null, error: null, loading: false });
        } else {
          setShippingQuote({ amount: null, name: null, error: body?.error ?? "No se pudo cotizar el envío.", loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShippingQuote({ amount: null, name: null, error: "No se pudo cotizar el envío — revisa tu conexión.", loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- afterDiscount cambia con cada tecla del código, no hace falta recotizar por eso
  }, [brandSlug, needsShipping, region]);

  const shippingCost = shippingQuote.amount ?? 0;
  // Los precios ya traen el IVA: se muestra cuánto va incluido, no se suma.
  const taxAmount = taxIncluded(afterDiscount, taxRatePercent);
  const total = orderTotal({ subtotal, discount: discountAmount, shipping: shippingCost });
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

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
    if (!dataConsent) {
      setSubmitError("Para continuar, autoriza el tratamiento de tus datos personales.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const fullAddress = [address.trim(), address2.trim()].filter(Boolean).join(", ");
    const hasId = idNumber.trim().length > 0;

    const payload = JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            ...(i.variantId ? { variantId: i.variantId } : {}),
            quantity: i.quantity,
          })),
          buyerName: fullName,
          buyerFirstName: firstName,
          buyerLastName: lastName,
          buyerEmail: email,
          buyerPhone: phone,
          shippingAddress: needsShipping ? fullAddress : "",
          shippingCity: needsShipping ? city : "",
          shippingRegion: needsShipping ? region : "",
          shippingPostalCode: needsShipping ? postalCode : "",
          // Colombia es UTC-5 todo el año: offset fijo para que el
          // datetime-local llegue al servidor sin ambigüedad.
          servicePreferredAt: isServiceOrder && servicePreferredAt ? `${servicePreferredAt}:00-05:00` : "",
          discountCode: discountPercent ? code : "",
          dataConsent,
          ...(hasId
            ? { billingIdType: idType, billingIdNumber: idNumber, billingName: idType === "NIT" ? companyName : "" }
            : {}),
          ...(needsShipping && !sameBilling
            ? { billingAddress, billingCity, billingRegion }
            : {}),
        });

    // Si ya se creó el pedido con exactamente estos datos (el comprador
    // cerró la ventana de Wompi y vuelve a tocar "Pagar ahora"), se reabre
    // la misma ventana en vez de crear otro pedido.
    if (pendingPayment && pendingPayment.payload === payload) {
      setSubmitting(false);
      await openPayment(pendingPayment);
      return;
    }

    try {
      const res = await fetch(`/api/tienda/${brandSlug}/ordenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const body = await res.json();
      if (!res.ok) {
        setSubmitError(body?.error ?? "No se pudo crear el pedido.");
        return;
      }
      const pending = { payload, wompi: body.wompi, customerData: body.customerData ?? {}, checkoutUrl: body.checkoutUrl };
      setPendingPayment(pending);
      await openPayment(pending);
    } catch {
      setSubmitError("No se pudo crear el pedido — revisa tu conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  /// Abre la ventana de pago de Wompi encima del checkout; si no carga,
  /// lleva a la página de pago de Wompi.
  async function openPayment(pending: PendingPayment) {
    setOpeningWompi(true);
    const opened = await openWompiWidget(pending.wompi, pending.customerData);
    setOpeningWompi(false);
    if (!opened) window.location.assign(pending.checkoutUrl);
  }

  if (items.length === 0 && !pendingPayment) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-sm text-brand-ink-soft">Tu carrito está vacío.</p>
        <a href={basePath || "/"} className="text-sm font-medium text-brand-accent hover:underline">
          Volver a la tienda
        </a>
      </div>
    );
  }

  const idTypeInfo = ID_TYPES.find((t) => t.value === idType) ?? ID_TYPES[0];
  const shippingBlocked =
    needsShipping && (!region || shippingQuote.loading || shippingQuote.amount == null || Boolean(shippingQuote.error));

  // El código de creador tiene que estar a la vista: de ahí sale la
  // estrategia de Marcolini con los creadores. En el celular va arriba del
  // formulario, no escondido en el resumen plegado. Ver conversación del
  // 2026-10-02.
  const codeBox = (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-brand-ink">¿Tienes un código de creador?</p>
        <p className="text-xs text-brand-ink-soft">Si un creador te compartió su código, escríbelo aquí y te aplicamos su descuento.</p>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setDiscountPercent(null);
            }}
            onKeyDown={(e) => {
              // Dentro del formulario, Enter aplicaría el pago: aplica el código.
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyCode();
              }
            }}
            placeholder="Ej. LAURA30"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label="Código de creador o de descuento"
            className="block w-full rounded-lg border border-brand-line bg-brand-surface px-3 py-3 text-sm text-brand-ink uppercase placeholder:normal-case placeholder:text-brand-ink-soft focus:border-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink"
          />
        </div>
        <button
          type="button"
          onClick={() => handleApplyCode()}
          disabled={checkingCode || !code.trim()}
          className="rounded-lg bg-brand-button text-brand-button-text px-4 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {checkingCode ? "..." : "Aplicar"}
        </button>
      </div>
      {codeError && <p className="text-xs text-red-600">{codeError}</p>}
      {discountPercent != null && (
        <p className="text-xs text-brand-ink font-medium">Código aplicado: {discountPercent}% de descuento.</p>
      )}
    </div>
  );

  const summary = (
    <div className="space-y-5">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={cartLineKey(item)} className="flex items-center gap-3">
            <span className="relative shrink-0">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto del producto subida por la marca
                <img
                  src={item.imageUrl}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover border border-brand-line bg-brand-surface"
                />
              ) : (
                <span className="block w-16 h-16 rounded-lg border border-brand-line bg-brand-surface" />
              )}
              <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-brand-ink text-brand-bg text-xs font-medium flex items-center justify-center">
                {item.quantity}
              </span>
            </span>
            <span className="flex-1 min-w-0 text-sm">
              <span className="block text-brand-ink truncate">{item.name}</span>
              {item.variantLabel && <span className="block text-xs text-brand-ink-soft">{item.variantLabel}</span>}
            </span>
            <span className="text-sm text-brand-ink tabular-nums">{formatCOP(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      {/* En computador el código va en el resumen; en el celular, arriba
          del formulario (ver codeBox). */}
      <div className="hidden lg:block">{codeBox}</div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-brand-ink">
          <span>
            Subtotal · {itemCount} {itemCount === 1 ? "artículo" : "artículos"}
          </span>
          <span className="tabular-nums">{formatCOP(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-brand-accent">
            <span>Descuento ({code})</span>
            <span className="tabular-nums">-{formatCOP(discountAmount)}</span>
          </div>
        )}
        {needsShipping && (
          <div className="flex justify-between text-brand-ink">
            <span>Envío</span>
            <span className="tabular-nums text-brand-ink-soft">
              {!region
                ? "Ingresa tu dirección"
                : shippingQuote.loading
                  ? "Calculando..."
                  : shippingQuote.amount == null
                    ? "—"
                    : shippingCost === 0
                      ? "Gratis"
                      : formatCOP(shippingCost)}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-2">
          <span className="text-lg font-semibold text-brand-ink">Total</span>
          <span className="text-brand-ink">
            <span className="text-xs text-brand-ink-soft mr-1.5">COP</span>
            <span className="text-lg font-semibold tabular-nums">{formatCOP(total)}</span>
          </span>
        </div>
        {taxAmount > 0 && (
          <p className="text-xs text-brand-ink-soft -mt-1">Incluye {formatCOP(taxAmount)} de IVA</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:min-h-[calc(100vh-5rem)]">
      {/* Resumen arriba, plegable, en el celular — como Shopify. */}
      <div className="lg:hidden border-b border-brand-line bg-[color-mix(in_srgb,var(--brand-ink)_4%,var(--brand-bg))]">
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          aria-expanded={summaryOpen}
          className="w-full flex items-center justify-between px-4 py-4 text-sm"
        >
          <span className="flex items-center gap-1.5 text-brand-accent font-medium">
            {summaryOpen ? "Ocultar resumen del pedido" : "Mostrar resumen del pedido"}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${summaryOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span className="font-semibold text-brand-ink tabular-nums">{formatCOP(total)}</span>
        </button>
        {summaryOpen && <div className="px-4 pb-5">{summary}</div>}
      </div>

      <div className="bg-brand-surface lg:border-r lg:border-brand-line">
        <form onSubmit={handleSubmit} className="max-w-xl px-4 sm:px-8 py-8 space-y-8 lg:ml-auto lg:pr-12">
          <div className="lg:hidden rounded-xl border border-brand-line bg-[color-mix(in_srgb,var(--brand-ink)_4%,var(--brand-bg))] p-4">
            {codeBox}
          </div>

          <Section title="Contacto">
            <Field label="Correo electrónico" type="email" inputMode="email" autoComplete="email" required value={email} onChange={setEmail} />
          </Section>

          <Section title={needsShipping ? "Entrega" : "Tus datos"}>
            {needsShipping && (
              <SelectField label="País / Región" value="CO" onChange={() => {}}>
                <option value="CO">Colombia</option>
              </SelectField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" autoComplete="given-name" required value={firstName} onChange={setFirstName} />
              <Field label="Apellidos" autoComplete="family-name" required value={lastName} onChange={setLastName} />
            </div>
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
              <SelectField label="Documento" value={idType} onChange={setIdType}>
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectField>
              <Field
                label={idType === "CC" ? "Cédula o NIT" : idTypeInfo.field}
                inputMode={idType === "PASAPORTE" ? "text" : "numeric"}
                required={requireBillingId}
                optional={!requireBillingId}
                value={idNumber}
                onChange={setIdNumber}
              />
            </div>
            {idType === "NIT" && (
              <Field label="Razón social" autoComplete="organization" required={idNumber.trim().length > 0} value={companyName} onChange={setCompanyName} />
            )}

            {needsShipping && (
              <>
                <Field label="Dirección" autoComplete="address-line1" required value={address} onChange={setAddress} />
                <Field label="Casa, apartamento, etc." optional autoComplete="address-line2" value={address2} onChange={setAddress2} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Ciudad" autoComplete="address-level2" required value={city} onChange={setCity} className="col-span-2 sm:col-span-1" />
                  <SelectField label="Departamento" required value={region} onChange={setRegion}>
                    <option value="">Elige uno</option>
                    {COLOMBIA_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </SelectField>
                  <Field label="Código postal" optional inputMode="numeric" autoComplete="postal-code" value={postalCode} onChange={setPostalCode} />
                </div>
              </>
            )}
            <Field label="Celular con WhatsApp" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={setPhone} />

            {isServiceOrder && (
              <div className="space-y-1">
                <Field label="Fecha y hora que prefieres" type="datetime-local" required value={servicePreferredAt} onChange={setServicePreferredAt} />
                <p className="text-xs text-brand-ink-soft">
                  Es tu preferencia — la marca la confirma (o te propone otra) después de tu pago.
                </p>
                {minServiceDate && servicePreferredAt && servicePreferredAt < minServiceDate && (
                  <p className="text-xs text-red-600">Elige una fecha a partir de una hora desde ahora.</p>
                )}
              </div>
            )}
            {isDigitalOrder && (
              <p className="text-sm text-brand-ink-soft rounded-lg border border-brand-line p-3">
                Es un producto digital — no se envía. Recibes el link de descarga o acceso apenas se confirme tu pago.
              </p>
            )}
          </Section>

          {needsShipping && (
            <Section title="Métodos de envío">
              {!region ? (
                <p className="rounded-lg bg-brand-bg px-4 py-3.5 text-sm text-brand-ink-soft">
                  Elige tu departamento para ver los métodos de envío disponibles.
                </p>
              ) : shippingQuote.loading ? (
                <p className="rounded-lg bg-brand-bg px-4 py-3.5 text-sm text-brand-ink-soft">Calculando envío...</p>
              ) : shippingQuote.error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">{shippingQuote.error}</p>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-brand-ink bg-brand-bg/60 px-4 py-3.5 text-sm">
                  <span className="flex items-center gap-3 text-brand-ink">
                    <span className="w-4 h-4 rounded-full border-[5px] border-brand-ink bg-brand-surface" aria-hidden="true" />
                    {shippingQuote.name ?? "Envío a domicilio"}
                  </span>
                  <span className="font-medium text-brand-ink tabular-nums">
                    {shippingCost === 0 ? "Gratis" : formatCOP(shippingCost)}
                  </span>
                </div>
              )}
            </Section>
          )}

          <Section title="Pago">
            <p className="text-xs text-brand-ink-soft -mt-2">Todas las transacciones son seguras y están encriptadas.</p>
            {paymentsReady ? (
              <div className="rounded-lg border border-brand-ink overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-brand-bg/60">
                  <span className="flex items-center gap-3 text-sm font-medium text-brand-ink">
                    <span className="w-4 h-4 rounded-full border-[5px] border-brand-ink bg-brand-surface" aria-hidden="true" />
                    Wompi
                  </span>
                  <span className="flex items-center gap-1.5">
                    {["Tarjetas", "PSE", "Nequi"].map((m) => (
                      <span key={m} className="text-[10px] font-semibold rounded border border-brand-line bg-brand-surface px-1.5 py-0.5 text-brand-ink">
                        {m}
                      </span>
                    ))}
                    <span className="text-[10px] font-semibold rounded border border-brand-line bg-brand-surface px-1.5 py-0.5 text-brand-ink-soft">
                      +3
                    </span>
                  </span>
                </div>
                <p className="border-t border-brand-line bg-brand-bg px-4 py-4 text-center text-sm text-brand-ink-soft">
                  Al tocar Pagar ahora se abre Wompi para completar tu compra.
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-brand-line px-4 py-3.5 text-sm text-brand-ink-soft">
                Esta tienda todavía no activó los pagos en línea — vuelve más tarde.
              </p>
            )}
          </Section>

          {needsShipping && (
            <Section title="Dirección de facturación">
              <div className="rounded-lg border border-brand-line overflow-hidden text-sm">
                {[
                  { same: true, label: "La misma dirección de envío" },
                  { same: false, label: "Usar una dirección de facturación distinta" },
                ].map((opt, i) => (
                  <label
                    key={opt.label}
                    className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer ${i > 0 ? "border-t border-brand-line" : ""} ${
                      sameBilling === opt.same ? "bg-brand-bg/60" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="billing"
                      checked={sameBilling === opt.same}
                      onChange={() => setSameBilling(opt.same)}
                      className="w-4 h-4 accent-brand-ink"
                    />
                    <span className="text-brand-ink">{opt.label}</span>
                  </label>
                ))}
                {!sameBilling && (
                  <div className="border-t border-brand-line bg-brand-bg/40 p-4 space-y-3">
                    <Field label="Dirección" required value={billingAddress} onChange={setBillingAddress} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Ciudad" required value={billingCity} onChange={setBillingCity} />
                      <SelectField label="Departamento" required value={billingRegion} onChange={setBillingRegion}>
                        <option value="">Elige uno</option>
                        {COLOMBIA_REGIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          <div className="space-y-4">
            <label className="flex items-start gap-2.5 text-xs text-brand-ink leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={dataConsent}
                onChange={(e) => {
                  setDataConsent(e.target.checked);
                  if (e.target.checked) setSubmitError(null);
                }}
                className="mt-0.5 w-4 h-4 shrink-0 accent-brand-ink"
                required
              />
              <span>
                Autorizo el tratamiento de mis datos personales para gestionar mi pedido, el envío y la atención de mi
                compra, según la{" "}
                <a href={`${basePath}/politica-de-privacidad`} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  política de privacidad
                </a>{" "}
                de la tienda.
              </span>
            </label>

            {/* En el celular el resumen va plegado arriba: el total, con el
                descuento si hay, se repite justo antes de pagar. */}
            <div className="lg:hidden space-y-1.5 text-sm border-t border-brand-line pt-4">
              <div className="flex justify-between text-brand-ink">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCOP(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-brand-accent">
                  <span>Descuento ({code})</span>
                  <span className="tabular-nums">-{formatCOP(discountAmount)}</span>
                </div>
              )}
              {needsShipping && (
                <div className="flex justify-between text-brand-ink">
                  <span>Envío</span>
                  <span className="tabular-nums text-brand-ink-soft">
                    {!region ? "Ingresa tu dirección" : shippingQuote.amount == null ? "—" : shippingCost === 0 ? "Gratis" : formatCOP(shippingCost)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-brand-ink pt-1">
                <span>Total</span>
                <span className="tabular-nums">{formatCOP(total)}</span>
              </div>
            </div>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <button
              type="submit"
              disabled={!paymentsReady || submitting || openingWompi || shippingBlocked}
              className="w-full rounded-lg bg-brand-button text-brand-button-text px-6 py-4 text-base font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {openingWompi
                ? "Abriendo Wompi..."
                : submitting
                  ? "Creando tu pedido..."
                  : needsShipping && shippingQuote.loading
                    ? "Calculando envío..."
                    : "Pagar ahora"}
            </button>
          </div>
        </form>
      </div>

      {/* Gris suave sobre el fondo de la marca, como la columna del resumen en
          Shopify. */}
      <aside className="hidden lg:block bg-[color-mix(in_srgb,var(--brand-ink)_4%,var(--brand-bg))]">
        <div className="max-w-md px-8 lg:pl-12 py-8 sticky top-0">{summary}</div>
      </aside>
    </div>
  );
}
