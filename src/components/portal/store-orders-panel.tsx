"use client";

import { useState } from "react";
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
  /// Unidades (suma de cantidades), como "6 artículos" en Shopify.
  unitCount: number;
  /// null = venta directa, sin código de creador. Viene de Transaction
  /// (ya calculado por el Motor de Comisiones) — ver listBrandOrders.
  creator: { name: string } | null;
  archived: boolean;
  /// Se puede eliminar: nunca fue una venta real (ver canDeleteStoreOrder).
  deletable: boolean;
};

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

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

type View = "all" | "toShip" | "incomplete" | "archived";

function inView(o: StoreOrderRow, view: View) {
  if (view === "archived") return o.archived;
  if (o.archived) return false;
  return view === "all" ? !isIncomplete(o) : view === "toShip" ? isToShip(o) : isIncomplete(o);
}
/// Pedidos al estilo de la lista de Shopify: vistas (Todos / Por enviar / Pagos incompletos), buscador y una
/// tabla con número, fecha, cliente, creador, total, estado del pago, de
/// preparación y de entrega, artículos y forma de entrega. Cada fila abre
/// el detalle. Los intentos sin pagar quedan aparte, en "Pagos
/// incompletos". Se pueden seleccionar varios para archivar o eliminar
/// (eliminar solo lo que nunca fue una venta real). Ver conversaciones
/// del 2026-10-01 y 2026-10-02.
export function StoreOrdersPanel({ initialOrders }: { initialOrders: StoreOrderRow[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const counts = {
    all: initialOrders.filter((o) => inView(o, "all")).length,
    toShip: initialOrders.filter((o) => inView(o, "toShip")).length,
    incomplete: initialOrders.filter((o) => inView(o, "incomplete")).length,
    archived: initialOrders.filter((o) => o.archived).length,
  };

  const q = query.trim().toLowerCase().replace(/^#/, "");
  const shown = initialOrders.filter((o) => {
    if (!inView(o, view)) return false;
    if (!q) return true;
    return [o.reference.slice(-8), o.buyerName, o.buyerEmail, o.discountCode ?? "", o.creator?.name ?? ""].some((v) =>
      v.toLowerCase().includes(q),
    );
  });

  const views: { key: View; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "toShip", label: "Por enviar" },
    { key: "incomplete", label: "Pagos incompletos" },
    { key: "archived", label: "Archivados" },
  ];

  const selectedRows = shown.filter((o) => selected.has(o.id));
  const deletableCount = selectedRows.filter((o) => o.deletable).length;
  const allShownSelected = shown.length > 0 && shown.every((o) => selected.has(o.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAction(action: "archive" | "unarchive" | "delete") {
    const ids = action === "delete" ? selectedRows.filter((o) => o.deletable).map((o) => o.id) : selectedRows.map((o) => o.id);
    if (ids.length === 0) return;
    if (
      action === "delete" &&
      !window.confirm(
        `¿Eliminar ${ids.length} ${ids.length === 1 ? "pedido" : "pedidos"}? No se puede deshacer.` +
          (ids.length < selectedRows.length
            ? ` Los otros ${selectedRows.length - ids.length} son ventas reales y no se eliminan: archívalos.`
            : ""),
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/marca/tienda/pedidos/lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, orderIds: ids }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMessage({ ok: false, text: body?.error ?? "No se pudo hacer el cambio." });
      return;
    }
    const n = action === "delete" ? body.deleted : body.changed;
    const verb = action === "delete" ? "eliminado" : action === "archive" ? "archivado" : "desarchivado";
    setMessage({ ok: true, text: `${n} ${n === 1 ? `pedido ${verb}` : `pedidos ${verb}s`}.` });
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-line bg-brand-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-brand-line">
          <div className="flex gap-1">
            {views.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => {
                  setView(v.key);
                  setSelected(new Set());
                }}
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

        {selectedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-brand-line bg-brand-bg/60 text-sm">
            <span className="text-brand-ink font-medium">
              {selectedRows.length} {selectedRows.length === 1 ? "seleccionado" : "seleccionados"}
            </span>
            {view === "archived" ? (
              <button type="button" disabled={busy} onClick={() => runAction("unarchive")} className="rounded-md border border-brand-line bg-brand-surface px-3 py-1 text-xs font-medium text-brand-ink hover:bg-brand-bg disabled:opacity-50">
                Desarchivar
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => runAction("archive")} className="rounded-md border border-brand-line bg-brand-surface px-3 py-1 text-xs font-medium text-brand-ink hover:bg-brand-bg disabled:opacity-50">
                Archivar
              </button>
            )}
            <button
              type="button"
              disabled={busy || deletableCount === 0}
              onClick={() => runAction("delete")}
              title={deletableCount === 0 ? "Solo se eliminan pagos incompletos y compras de prueba. Las ventas reales se archivan." : undefined}
              className="rounded-md border border-red-200 bg-brand-surface px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              Eliminar{deletableCount > 0 && deletableCount < selectedRows.length ? ` (${deletableCount})` : ""}
            </button>
            {deletableCount < selectedRows.length && (
              <span className="text-xs text-brand-ink-soft">Las ventas reales no se eliminan: se archivan.</span>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-brand-ink-soft hover:text-brand-ink">
              Quitar selección
            </button>
          </div>
        )}
        {message && (
          <p className={`px-4 py-2 text-xs border-b border-brand-line ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
        )}

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
                  : view === "incomplete"
                    ? "No hay pagos incompletos."
                    : "No hay pedidos archivados."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-brand-ink-soft bg-brand-bg/50 border-b border-brand-line">
                  <th className="pl-4 pr-1 py-2.5 w-8">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={allShownSelected}
                      onChange={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((o) => o.id)))}
                      className="w-4 h-4 accent-brand-ink"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Pedido</th>
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
                      <td className="pl-4 pr-1 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar pedido ${o.reference.slice(-8).toUpperCase()}`}
                          checked={selected.has(o.id)}
                          onChange={() => toggle(o.id)}
                          className="w-4 h-4 accent-brand-ink"
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
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
