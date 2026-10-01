"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type StoreOrderRow = {
  id: string;
  kind: "PURCHASE" | "SAMPLE";
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  fulfillmentStatus: "UNFULFILLED" | "PREPARED" | "SHIPPED" | "DELIVERED";
  reference: string;
  buyerName: string;
  buyerEmail: string;
  shippingAddress: string | null;
  servicePreferredAt: string | null;
  shippingMethod: string | null;
  discountCode: string | null;
  totalCents: number;
  createdAt: string;
  /// "Hoy a las 3:54 p. m." — lo arma el servidor (ver relativeOrderDate)
  /// para que no difiera del navegador al hidratar.
  createdLabel: string;
  paidAt: string | null;
  preparedAt: string | null;
  deliveredAt: string | null;
  refundedAt: string | null;
  /// Unidades (suma de cantidades), como "6 artículos" en Shopify.
  unitCount: number;
  /// null = venta directa, sin código de creador. Viene de Transaction
  /// (ya calculado por el Motor de Comisiones) — ver listBrandOrders.
  creator: { name: string } | null;
};

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const TZ = "America/Bogota";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

type Pill = { label: string; className: string; dot?: boolean };

function paymentPill(o: StoreOrderRow): Pill {
  switch (o.status) {
    case "PAID":
      return { label: "Pagado", className: "bg-brand-bg text-brand-ink", dot: true };
    case "REFUNDED":
      return { label: "Reembolsado", className: "bg-purple-100 text-purple-800", dot: true };
    case "PENDING":
      return { label: "Pago pendiente", className: "bg-amber-100 text-amber-800", dot: true };
    case "FAILED":
      return { label: "Rechazado", className: "bg-red-100 text-red-700", dot: true };
    default:
      return { label: "Vencido", className: "bg-brand-bg text-brand-ink-soft", dot: true };
  }
}

function isService(o: StoreOrderRow) {
  return o.servicePreferredAt != null;
}
function isDigital(o: StoreOrderRow) {
  return !isService(o) && o.shippingAddress == null;
}

function preparationPill(o: StoreOrderRow): Pill | null {
  if (o.status !== "PAID" && o.status !== "REFUNDED") return null;
  if (isService(o)) return { label: "Reserva", className: "bg-brand-bg text-brand-ink-soft" };
  if (isDigital(o)) return { label: "Digital", className: "bg-brand-bg text-brand-ink-soft" };
  return o.fulfillmentStatus === "UNFULFILLED"
    ? { label: "No preparado", className: "bg-amber-100 text-amber-900 ring-1 ring-amber-300" }
    : { label: "Preparado", className: "bg-brand-bg text-brand-ink", dot: true };
}

function deliveryPill(o: StoreOrderRow): Pill | null {
  if (o.status !== "PAID" || isService(o) || isDigital(o)) return null;
  if (o.fulfillmentStatus === "DELIVERED") return { label: "Entregado", className: "bg-brand-bg text-brand-ink", dot: true };
  if (o.fulfillmentStatus === "SHIPPED") return { label: "En camino", className: "bg-sky-100 text-sky-800", dot: true };
  return null;
}

function PillView({ pill }: { pill: Pill | null }) {
  if (!pill) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${pill.className}`}>
      {pill.dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {pill.label}
    </span>
  );
}

const isIncomplete = (o: StoreOrderRow) => o.status === "PENDING" || o.status === "FAILED" || o.status === "EXPIRED";
const isToShip = (o: StoreOrderRow) =>
  o.status === "PAID" && o.shippingAddress != null && (o.fulfillmentStatus === "UNFULFILLED" || o.fulfillmentStatus === "PREPARED");

type View = "all" | "toShip" | "incomplete";
type Period = "today" | "7d" | "30d" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "all", label: "Todo" },
];

function periodStart(period: Period, now: Date) {
  if (period === "all") return 0;
  if (period === "today") return Date.parse(`${dayKey(now)}T00:00:00-05:00`);
  return now.getTime() - (period === "7d" ? 7 : 30) * 86_400_000;
}

function hoursLabel(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} días`;
}

/// Pedidos al estilo de la lista de Shopify: indicadores del periodo
/// arriba, vistas (Todos / Por enviar / Pagos incompletos), buscador y una
/// tabla con número, fecha, cliente, creador, total, estado del pago, de
/// preparación y de entrega, artículos y forma de entrega. Cada fila abre
/// el detalle. Los intentos sin pagar quedan aparte, en "Pagos
/// incompletos". Ver conversación del 2026-10-01.
export function StoreOrdersPanel({ initialOrders, nowIso }: { initialOrders: StoreOrderRow[]; nowIso: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>("all");
  const [period, setPeriod] = useState<Period>("30d");
  const [query, setQuery] = useState("");
  // Misma hora de referencia en el servidor y en el navegador.
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const stats = useMemo(() => {
    const from = periodStart(period, now);
    const inPeriod = (iso: string | null) => iso != null && Date.parse(iso) >= from;
    const sales = initialOrders.filter((o) => (o.status === "PAID" || o.status === "REFUNDED") && inPeriod(o.paidAt ?? o.createdAt));
    const prepTimes = initialOrders
      .filter((o) => o.paidAt && o.preparedAt && inPeriod(o.preparedAt))
      .map((o) => (Date.parse(o.preparedAt!) - Date.parse(o.paidAt!)) / 3_600_000);
    return {
      orders: sales.length,
      units: sales.reduce((n, o) => n + o.unitCount, 0),
      revenueCents: sales.filter((o) => o.status === "PAID").reduce((n, o) => n + o.totalCents, 0),
      refunds: initialOrders.filter((o) => inPeriod(o.refundedAt)).reduce((n, o) => n + o.totalCents, 0),
      prepared: initialOrders.filter((o) => inPeriod(o.preparedAt)).length,
      delivered: initialOrders.filter((o) => inPeriod(o.deliveredAt)).length,
      avgPrepHours: prepTimes.length > 0 ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : null,
    };
  }, [initialOrders, period, now]);

  const counts = {
    all: initialOrders.filter((o) => !isIncomplete(o)).length,
    toShip: initialOrders.filter(isToShip).length,
    incomplete: initialOrders.filter(isIncomplete).length,
  };

  const q = query.trim().toLowerCase().replace(/^#/, "");
  const shown = initialOrders.filter((o) => {
    const inView = view === "all" ? !isIncomplete(o) : view === "toShip" ? isToShip(o) : isIncomplete(o);
    if (!inView) return false;
    if (!q) return true;
    return [o.reference.slice(-8), o.buyerName, o.buyerEmail, o.discountCode ?? "", o.creator?.name ?? ""].some((v) =>
      v.toLowerCase().includes(q),
    );
  });

  const kpis: { label: string; value: string }[] = [
    { label: "Pedidos", value: String(stats.orders) },
    { label: "Artículos pedidos", value: String(stats.units) },
    { label: "Ventas", value: formatCOP(stats.revenueCents) },
    { label: "Reembolsos", value: formatCOP(stats.refunds) },
    { label: "Pedidos preparados", value: String(stats.prepared) },
    { label: "Pedidos entregados", value: String(stats.delivered) },
    { label: "Del pago a la preparación", value: stats.avgPrepHours == null ? "—" : hoursLabel(stats.avgPrepHours) },
  ];

  const views: { key: View; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "toShip", label: "Por enviar" },
    { key: "incomplete", label: "Pagos incompletos" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-line bg-brand-surface overflow-x-auto">
        <div className="flex min-w-max">
          <div className="flex items-center px-3 border-r border-brand-line">
            <label className="sr-only" htmlFor="orders-period">
              Periodo
            </label>
            <select
              id="orders-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="bg-transparent text-xs text-brand-ink rounded-md px-2 py-1.5 hover:bg-brand-bg focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink"
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {kpis.map((k, i) => (
            <div key={k.label} className={`px-4 py-3 min-w-[9.5rem] ${i > 0 ? "border-l border-brand-line" : ""}`}>
              <p className="text-xs text-brand-ink-soft whitespace-nowrap">{k.label}</p>
              <p className="text-base font-semibold text-brand-ink tabular-nums mt-0.5 whitespace-nowrap">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-brand-line bg-brand-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-brand-line">
          <div className="flex gap-1">
            {views.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                  view === v.key ? "bg-brand-bg text-brand-ink" : "text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink"
                }`}
              >
                {v.label}
                <span className="ml-1.5 tabular-nums opacity-60">{counts[v.key]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[12rem]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-ink-soft"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, cliente, correo o código"
              aria-label="Buscar pedidos"
              className="w-full rounded-md border border-brand-line bg-brand-surface pl-8 pr-3 py-1.5 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:ring-1 focus:ring-brand-ink"
            />
          </div>
        </div>

        {view === "incomplete" && shown.length > 0 && (
          <p className="px-4 py-2 text-xs text-brand-ink-soft border-b border-brand-line bg-brand-bg/50">
            Personas que llegaron al pago y no lo terminaron. No son ventas: no descuentan inventario ni se facturan.
          </p>
        )}

        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-brand-ink-soft">
            {q
              ? "Ningún pedido coincide con la búsqueda."
              : view === "all"
                ? "Todavía no tienes pedidos. Aparecen acá apenas alguien pague en tu tienda."
                : view === "toShip"
                  ? "No hay pedidos por enviar."
                  : "No hay pagos incompletos."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-brand-ink-soft bg-brand-bg/50 border-b border-brand-line">
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">Pedido</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Fecha</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Cliente</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Creador</th>
                  <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">Total</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Estado del pago</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Estado de preparación</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Artículos</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Estado de la entrega</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Forma de entrega</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {shown.map((o) => {
                  const href = `/marca/tienda/pedidos/${o.id}`;
                  return (
                    <tr key={o.id} onClick={() => router.push(href)} className="cursor-pointer hover:bg-brand-bg/60 focus-within:bg-brand-bg/60">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(href);
                          }}
                          className="font-semibold text-brand-ink hover:underline focus:outline-none focus-visible:underline"
                        >
                          #{o.reference.slice(-8).toUpperCase()}
                        </a>
                        {o.kind === "SAMPLE" && (
                          <span className="ml-2 text-[10px] font-mono rounded px-1.5 py-0.5 bg-purple-100 text-purple-700">MUESTRA</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-brand-ink whitespace-nowrap">{o.createdLabel}</td>
                      <td className="px-3 py-2.5 text-brand-ink max-w-[14rem] truncate">{o.buyerName}</td>
                      <td className="px-3 py-2.5 text-brand-ink-soft whitespace-nowrap">
                        {o.creator?.name ?? (o.discountCode ? <span className="font-mono text-xs">{o.discountCode}</span> : "—")}
                      </td>
                      <td className="px-3 py-2.5 text-right text-brand-ink tabular-nums whitespace-nowrap">{formatCOP(o.totalCents)}</td>
                      <td className="px-3 py-2.5">
                        <PillView pill={paymentPill(o)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <PillView pill={preparationPill(o)} />
                      </td>
                      <td className="px-3 py-2.5 text-brand-ink whitespace-nowrap">
                        {o.unitCount} {o.unitCount === 1 ? "artículo" : "artículos"}
                      </td>
                      <td className="px-3 py-2.5">
                        <PillView pill={deliveryPill(o)} />
                      </td>
                      <td className="px-3 py-2.5 text-brand-ink whitespace-nowrap">
                        {isService(o) ? "Reserva" : isDigital(o) ? "Digital" : o.shippingMethod ?? "Envío"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
