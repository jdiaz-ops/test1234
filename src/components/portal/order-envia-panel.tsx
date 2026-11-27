"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";

export type OrderEnviaLabel = {
  carrier: string;
  trackingNumber: string;
  labelUrl: string | null;
  trackUrl: string | null;
  costCents: number | null;
  /// Último estado de Envia, ya en español (ver enviaStatusLabel).
  statusLabel: string | null;
  delivered: boolean;
};

export type OrderEnviaDefaults = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightGrams: number;
  /// En pesos.
  declaredValue: number;
  street: string;
  region: string;
  city: string;
  reference: string;
};

type Quote = {
  carrier: string;
  carrierName: string;
  service: string;
  serviceName: string;
  deliveryEstimate: string | null;
  priceCents: number;
};

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

/// Guía con Envia en el detalle del pedido (solo con la conexión de Envia,
/// ver envia-connection-card.tsx): cotizar, crear la guía, descargarla,
/// actualizar su estado o anularla.
export function OrderEnviaPanel({
  orderId,
  label,
  defaults,
  sandbox,
}: {
  orderId: string;
  label: OrderEnviaLabel | null;
  defaults: OrderEnviaDefaults;
  sandbox: boolean;
}) {
  const router = useRouter();
  const [length, setLength] = useState(String(defaults.lengthCm));
  const [width, setWidth] = useState(String(defaults.widthCm));
  const [height, setHeight] = useState(String(defaults.heightCm));
  const [weight, setWeight] = useState(String(defaults.weightGrams));
  const [declaredValue, setDeclaredValue] = useState(String(defaults.declaredValue));
  const [editingDestination, setEditingDestination] = useState(false);
  const [street, setStreet] = useState(defaults.street);
  const [region, setRegion] = useState(defaults.region);
  const [city, setCity] = useState(defaults.city);
  const [reference, setReference] = useState(defaults.reference);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState<"cotizar" | "crear" | "estado" | "anular" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(action: "cotizar" | "crear" | "estado" | "anular", extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMessage(null);
    const res = await fetch("/api/marca/tienda/pedidos/envia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, orderId, ...extra }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      setMessage({ ok: false, text: body?.error ?? "No se pudo completar. Revisa tu conexión a internet." });
      return null;
    }
    return body;
  }

  const shipment = () => ({
    packageLengthCm: Number(length),
    packageWidthCm: Number(width),
    packageHeightCm: Number(height),
    packageWeightGrams: Number(weight),
    declaredValue: Number(declaredValue || 0),
    destination: { street, region, city, reference: reference || null },
  });

  // Cambiar el paquete o el destino cambia el precio: hay que cotizar otra vez.
  const edited = <T,>(set: (v: T) => void) => (value: T) => {
    set(value);
    setQuotes(null);
    setChosen(null);
  };

  async function quote() {
    const body = await send("cotizar", shipment());
    if (!body) return;
    setQuotes(body.quotes);
    setFailed(body.failed ?? []);
    setChosen(body.quotes.length > 0 ? 0 : null);
  }

  async function create() {
    if (chosen == null || !quotes) return;
    const q = quotes[chosen];
    const ask = sandbox
      ? `¿Crear la guía de prueba con ${q.carrierName}?`
      : `¿Crear la guía con ${q.carrierName} por ${formatCOP(q.priceCents)}? Se cobra de tu saldo en Envia y la compradora recibe el correo con su guía.`;
    if (!window.confirm(ask)) return;
    const body = await send("crear", { ...shipment(), carrier: q.carrier, service: q.service, priceCents: q.priceCents });
    if (!body) return;
    router.refresh();
  }

  async function refreshStatus() {
    const body = await send("estado");
    if (!body) return;
    setMessage({ ok: true, text: "Estado actualizado." });
    router.refresh();
  }

  async function cancel() {
    if (!window.confirm("¿Anular esta guía en Envia? El pedido vuelve a «Preparado» para crear otra.")) return;
    const body = await send("anular");
    if (!body) return;
    setQuotes(null);
    setChosen(null);
    router.refresh();
  }

  const numberInput = (label: string, value: string, set: (v: string) => void, wide = false) => (
    <div className={wide ? "col-span-2" : undefined}>
      <label className="block text-xs text-brand-ink mb-1">{label}</label>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => edited(set)(e.target.value.replace(/\D/g, ""))}
        className="input text-sm tabular-nums"
      />
    </div>
  );

  const sandboxBadge = sandbox && (
    <span className="text-[11px] font-medium rounded-md px-1.5 py-0.5 bg-amber-100 text-amber-800">Pruebas</span>
  );

  if (label) {
    return (
      <div className="space-y-3 rounded-xl border border-brand-line bg-brand-bg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-brand-ink">Guía de Envia</p>
          {sandboxBadge}
          {label.statusLabel && (
            <span className="text-[11px] font-medium rounded-md px-1.5 py-0.5 bg-purple-100 text-purple-700">
              {label.statusLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-brand-ink">
          {label.carrier} · <span className="font-mono">{label.trackingNumber}</span>
          {label.costCents != null && <span className="text-brand-ink-soft"> · costó {formatCOP(label.costCents)}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {label.labelUrl && (
            <a
              href={label.labelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand-accent text-white rounded-full px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Descargar guía (PDF)
            </a>
          )}
          {label.trackUrl && (
            <a
              href={label.trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm border border-brand-line rounded-full px-4 py-2 hover:bg-brand-accent-soft"
            >
              Rastrear
            </a>
          )}
          <button
            type="button"
            onClick={refreshStatus}
            disabled={busy != null}
            className="text-sm border border-brand-line rounded-full px-4 py-2 hover:bg-brand-accent-soft disabled:opacity-50"
          >
            {busy === "estado" ? "Consultando..." : "Actualizar estado"}
          </button>
          {!label.delivered && (
            <button
              type="button"
              onClick={cancel}
              disabled={busy != null}
              className="text-sm text-red-600 hover:underline disabled:opacity-50 ml-auto"
            >
              {busy === "anular" ? "Anulando..." : "Anular guía"}
            </button>
          )}
        </div>
        {!label.labelUrl && (
          <p className="text-xs text-brand-ink-soft">Envia no mandó el PDF: descárgalo desde tu cuenta de Envia.</p>
        )}
        {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-brand-ink">Crear guía con Envia</p>
        {sandboxBadge}
      </div>

      <div className="text-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="text-brand-ink-soft">
            Para: <span className="text-brand-ink">{street}</span>, {city}, {region}
            {reference && <span> · {reference}</span>}
          </p>
          <button
            type="button"
            onClick={() => setEditingDestination((v) => !v)}
            className="shrink-0 text-xs font-medium text-brand-accent hover:underline"
          >
            {editingDestination ? "Listo" : "Corregir"}
          </button>
        </div>
        {editingDestination && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-brand-ink mb-1">Dirección</label>
              <input value={street} onChange={(e) => edited(setStreet)(e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs text-brand-ink mb-1">Departamento</label>
              <select value={region} onChange={(e) => edited(setRegion)(e.target.value)} className="input text-sm">
                <option value="">Elige uno</option>
                {COLOMBIA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-brand-ink mb-1">Ciudad</label>
              <input value={city} onChange={(e) => edited(setCity)(e.target.value)} className="input text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-brand-ink mb-1">Referencia (opcional)</label>
              <input value={reference} onChange={(e) => edited(setReference)(e.target.value)} className="input text-sm" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {numberInput("Largo (cm)", length, setLength)}
        {numberInput("Ancho (cm)", width, setWidth)}
        {numberInput("Alto (cm)", height, setHeight)}
        {numberInput("Peso (g)", weight, setWeight)}
        {numberInput("Valor declarado ($)", declaredValue, setDeclaredValue, true)}
      </div>

      <button
        type="button"
        onClick={quote}
        disabled={busy != null}
        className="text-sm border border-brand-line rounded-full px-4 py-2 hover:bg-brand-accent-soft disabled:opacity-50"
      >
        {busy === "cotizar" ? "Cotizando con tus transportadoras..." : quotes ? "Cotizar otra vez" : "Cotizar"}
      </button>

      {quotes && quotes.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="sr-only">Transportadora</legend>
          {quotes.map((q, i) => (
            <label
              key={`${q.carrier}-${q.service}`}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                chosen === i ? "border-brand-accent bg-brand-accent-soft" : "border-brand-line bg-brand-surface"
              }`}
            >
              <input type="radio" name="envia-quote" checked={chosen === i} onChange={() => setChosen(i)} className="w-4 h-4" />
              <span className="flex-1 min-w-0 text-sm">
                <span className="font-medium text-brand-ink">{q.carrierName}</span>
                <span className="text-brand-ink-soft"> · {q.serviceName}</span>
                {q.deliveryEstimate && <span className="block text-xs text-brand-ink-soft">{q.deliveryEstimate}</span>}
              </span>
              <span className="font-mono text-sm text-brand-ink tabular-nums">{formatCOP(q.priceCents)}</span>
            </label>
          ))}
          {failed.length > 0 && <p className="text-xs text-brand-ink-soft">Sin precio para este envío: {failed.join(", ")}.</p>}
        </fieldset>
      )}

      {quotes && chosen != null && (
        <button
          type="button"
          onClick={create}
          disabled={busy != null}
          className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy === "crear" ? "Creando la guía..." : `Crear guía por ${formatCOP(quotes[chosen].priceCents)}`}
        </button>
      )}

      {sandbox && (
        <p className="text-xs text-brand-ink-soft">
          Cuenta de pruebas de Envia: la guía no es real y la compradora no recibe el correo.
        </p>
      )}

      {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
    </div>
  );
}
