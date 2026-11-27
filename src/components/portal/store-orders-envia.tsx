"use client";

import { useCallback, useState } from "react";

/// Guías de Envia desde la lista de pedidos, sin abrir cada pedido
/// (pedido del 2026-11-27: "crear la guía desde el panel de pedidos… y que
/// ahí me diga cuánto va a costar el flete"). Cada pedido se cotiza y se
/// crea con el paquete de siempre y su propia dirección; ver
/// quickQuoteOrder / quickCreateOrderLabel en envia-service.ts.

/// La conexión de la marca con Envia (null = sin conectar).
export type EnviaListInfo = { sandbox: boolean; carrierName: string | null };

/// La guía de Envia que ya tiene el pedido, si tiene.
export type OrderListEnvia = { trackingNumber: string | null; labelUrl: string | null; costCents: number | null } | null;

type Quote = {
  carrier: string;
  carrierName: string;
  service: string;
  serviceName: string;
  deliveryEstimate: string | null;
  priceCents: number;
};

export type GuideState =
  | { kind: "quoting" }
  | { kind: "quoted"; quote: Quote; weightGrams: number }
  | { kind: "creating"; quote: Quote; weightGrams: number }
  | { kind: "created"; labelUrl: string | null; trackingNumber: string; costCents: number | null }
  | { kind: "error"; text: string };

const MAX_PER_PDF = 30;

export function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(cents / 100);
}

const formatKg = (grams: number) => `${(grams / 1000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg`;

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/marca/tienda/pedidos/envia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = await res?.json().catch(() => null);
  return { ok: Boolean(res?.ok), data };
}

/// De a `limit` a la vez, para no saturar a Envia.
async function inBatches<T>(items: T[], limit: number, work: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += limit) await Promise.all(items.slice(i, i + limit).map(work));
}

export function useEnviaGuides() {
  const [states, setStates] = useState<Record<string, GuideState>>({});
  const set = useCallback((id: string, state: GuideState) => setStates((prev) => ({ ...prev, [id]: state })), []);

  const fetchQuote = useCallback(
    async (id: string) => {
      const { ok, data } = await post({ action: "cotizar-rapido", orderId: id });
      if (!ok || !data?.quote) {
        set(id, { kind: "error", text: data?.error ?? "No se pudo cotizar. Revisa tu conexión a internet." });
        return;
      }
      set(id, { kind: "quoted", quote: data.quote, weightGrams: data.weightGrams });
    },
    [set],
  );

  async function quote(id: string) {
    set(id, { kind: "quoting" });
    await fetchQuote(id);
  }

  /// Todos quedan "cotizando" de una vez (así no se cotizan dos veces) y
  /// se consultan de a 3. Siempre la misma función (la usa un efecto).
  const quoteMany = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setStates((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, { kind: "quoting" } as GuideState])) }));
      await inBatches(ids, 3, fetchQuote);
    },
    [fetchQuote],
  );

  async function create(id: string, q: Quote, weightGrams: number) {
    set(id, { kind: "creating", quote: q, weightGrams });
    const { ok, data } = await post({
      action: "crear-rapido",
      orderId: id,
      carrier: q.carrier,
      service: q.service,
      priceCents: q.priceCents,
    });
    if (!ok) {
      set(id, { kind: "error", text: data?.error ?? "No se pudo crear la guía. Revisa tu conexión a internet." });
      return false;
    }
    set(id, { kind: "created", labelUrl: data.labelUrl, trackingNumber: data.trackingNumber, costCents: data.costCents });
    return true;
  }

  return {
    states,
    quote,
    create,
    quoteMany,
    /// Devuelve los pedidos a los que sí se les creó la guía, en orden.
    async createMany(entries: { id: string; quote: Quote; weightGrams: number }[], onProgress: (done: number) => void) {
      let done = 0;
      const created = new Set<string>();
      await inBatches(entries, 2, async (e) => {
        if (await create(e.id, e.quote, e.weightGrams)) created.add(e.id);
        onProgress(++done);
      });
      return entries.filter((e) => created.has(e.id)).map((e) => e.id);
    },
  };
}

/// Baja las guías de esos pedidos en un PDF (o varios, de a 30). Con
/// `packing`, cada PDF empieza con la hoja de empaque de esos pedidos.
export async function downloadGuides(orderIds: string[], options: { packing?: boolean } = {}): Promise<{ ok: boolean; text: string }> {
  let missing = 0;
  let files = 0;
  const name = options.packing ? "guias-y-hoja-de-empaque" : "guias-envia";
  for (let i = 0; i < orderIds.length; i += MAX_PER_PDF) {
    const res = await fetch("/api/marca/tienda/pedidos/envia/guias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: orderIds.slice(i, i + MAX_PER_PDF), conEmpaque: options.packing === true }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      return { ok: false, text: data?.error ?? "No se pudieron descargar las guías. Revisa tu conexión a internet." };
    }
    missing += Number(res.headers.get("X-Guias-Faltantes") ?? 0);
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = orderIds.length > MAX_PER_PDF ? `${name}-${i / MAX_PER_PDF + 1}.pdf` : `${name}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    files += 1;
  }
  return {
    ok: missing === 0,
    text:
      missing === 0
        ? files === 1
          ? options.packing
            ? "Listo: la hoja de empaque y las guías quedaron en un solo PDF para imprimir."
            : "Guías descargadas en un solo PDF."
          : `Listo: quedó todo en ${files} PDF (de a ${MAX_PER_PDF} pedidos).`
        : `Faltaron ${missing} ${missing === 1 ? "guía" : "guías"}: descárgalas desde cada pedido.`,
  };
}

/// La celda «Guía» de cada pedido: el flete y el botón para crearla, o el
/// PDF si ya la tiene.
export function EnviaGuideCell({
  existing,
  eligible,
  state,
  onQuote,
  onCreate,
}: {
  existing: OrderListEnvia;
  eligible: boolean;
  state: GuideState | undefined;
  onQuote: () => void;
  onCreate: (q: Quote, weightGrams: number) => void;
}) {
  const label =
    state?.kind === "created"
      ? state
      : existing
        ? { labelUrl: existing.labelUrl, trackingNumber: existing.trackingNumber, costCents: existing.costCents }
        : null;
  const smallButton =
    "rounded-md border border-brand-line bg-brand-surface px-2 py-0.5 text-xs font-medium text-brand-ink hover:bg-brand-bg disabled:opacity-50";

  return (
    <div onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-xs">
      {label ? (
        <span className="inline-flex items-center gap-2">
          {label.labelUrl ? (
            <a href={label.labelUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-accent hover:underline">
              Guía PDF
            </a>
          ) : (
            <span className="text-brand-ink-soft">Guía {label.trackingNumber}</span>
          )}
          {label.costCents != null && <span className="text-brand-ink-soft tabular-nums">{formatCOP(label.costCents)}</span>}
        </span>
      ) : !eligible ? null : state?.kind === "quoting" ? (
        <span className="text-brand-ink-soft">Cotizando…</span>
      ) : state?.kind === "creating" ? (
        <span className="text-brand-ink-soft">Creando guía…</span>
      ) : state?.kind === "quoted" ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="font-medium text-brand-ink tabular-nums"
            title={`${state.quote.carrierName} · ${state.quote.serviceName}${state.quote.deliveryEstimate ? ` · ${state.quote.deliveryEstimate}` : ""} · ${formatKg(state.weightGrams)}`}
          >
            {formatCOP(state.quote.priceCents)}
          </span>
          <span className="text-brand-ink-soft">{formatKg(state.weightGrams)}</span>
          <button type="button" onClick={() => onCreate(state.quote, state.weightGrams)} className={smallButton}>
            Crear
          </button>
        </span>
      ) : state?.kind === "error" ? (
        <span className="inline-flex items-start gap-2">
          <span className="max-w-[18rem] whitespace-normal text-[11px] leading-snug text-red-600">{state.text}</span>
          <button type="button" onClick={onQuote} className={smallButton}>
            Reintentar
          </button>
        </span>
      ) : (
        <button type="button" onClick={onQuote} className={smallButton}>
          Cotizar
        </button>
      )}
    </div>
  );
}
