"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

type Enrollment = {
  id: string;
  creatorId: string;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "REMOVED";
  discountCode: string;
  commissionPercentOverride: number | null;
  discountPercentOverride: number | null;
  orderCount: number;
  revenue: number;
  creator: { displayName: string; city: string | null };
  offer: {
    name: string;
    defaultCommissionPercent: number;
    defaultDiscountPercent: number;
  };
};

type SampleProductOption = {
  id: string;
  name: string;
  sampleStock: number;
};

/// Ofrecer una muestra a un creador YA vinculado (ACTIVE) — a diferencia
/// del buscador, acá nunca importa si el creador está en modo discoverable
/// (ver offerSampleToCreator en sample-service.ts): ya trabaja con esta
/// marca, no hace falta que se haya hecho público para que le llegue una
/// oferta de muestra puntual.
function OfferSampleForm({
  creatorId,
  sampleProducts,
  onDone,
}: {
  creatorId: string;
  sampleProducts: SampleProductOption[];
  onDone: () => void;
}) {
  const [productId, setProductId] = useState(sampleProducts[0]?.id ?? "");
  const selectedProduct = sampleProducts.find((p) => p.id === productId);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/creadores/ofrecer-muestra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, productId, quantity, message }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo enviar la oferta.");
        return;
      }
      setSent(true);
    } catch {
      setError("No se pudo enviar — revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  if (sampleProducts.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-brand-ink-soft">
          No tienes ningún producto habilitado para muestras — actívalo en Mi
          tienda → Muestras.
        </p>
        <button onClick={onDone} className="text-xs text-brand-ink-soft hover:underline shrink-0">
          Cerrar
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-brand-accent">
          Oferta de muestra enviada — te avisamos si la acepta.
        </p>
        <button onClick={onDone} className="text-xs text-brand-ink-soft hover:underline shrink-0">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-brand-ink mb-1">Producto</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="input text-sm"
        >
          {sampleProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sampleStock} disponibles)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-brand-ink mb-1">Cantidad</label>
        <input
          type="number"
          min={1}
          max={Math.min(5, selectedProduct?.sampleStock ?? 5)}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="input text-sm w-20"
        />
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-brand-ink mb-1">
          Mensaje (opcional)
        </label>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 300))}
          className="input text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Enviando..." : "Ofrecer muestra"}
      </button>
      <button onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
        Cancelar
      </button>
    </div>
  );
}

/// Encargar contenido NUEVO a un creador vinculado, por un fee fijo — a
/// diferencia de una muestra (que es un producto gratis) o una licencia
/// (que el creador ofrece sobre algo que YA publicó), esto es la marca
/// pidiendo algo puntual, inspirado en "Creator Connections" de Amazon. Ver
/// paid-content-service.ts.
function RequestPaidContentForm({
  creatorId,
  onDone,
}: {
  creatorId: string;
  onDone: () => void;
}) {
  const [briefing, setBriefing] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/encargos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId,
          briefing,
          feeAmount,
          deadlineDays: deadlineDays || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo enviar el encargo.");
        return;
      }
      setSent(true);
    } catch {
      setError("No se pudo enviar — revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-brand-accent">
          Encargo enviado — te avisamos si lo acepta.
        </p>
        <button onClick={onDone} className="text-xs text-brand-ink-soft hover:underline shrink-0">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-brand-ink mb-1">
          Qué necesitas
        </label>
        <textarea
          value={briefing}
          onChange={(e) => setBriefing(e.target.value.slice(0, 1000))}
          placeholder="Ej. un Reel de 30-60s mostrando el producto en tu rutina de noche, mencionando..."
          className="input text-sm min-h-16 w-full"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-brand-ink mb-1">
            Fee que ofreces
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={feeAmount}
            onChange={(e) => setFeeAmount(e.target.value)}
            className="input text-sm w-36"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">
            Días para entregar (opcional)
          </label>
          <input
            type="number"
            min="1"
            max="90"
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(e.target.value)}
            className="input text-sm w-28"
          />
        </div>
        <button
          type="button"
          onClick={send}
          disabled={busy || briefing.trim().length < 10 || !feeAmount}
          className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Enviando..." : "Enviar encargo"}
        </button>
        <button onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusLabel: Record<string, string> = {
  PENDING_APPROVAL: "Esperando tu aprobación",
  ACTIVE: "Activo",
  REJECTED: "Rechazado",
  REMOVED: "Removido",
};

function OverrideEditor({
  enrollment,
  onDone,
}: {
  enrollment: Enrollment;
  onDone: () => void;
}) {
  const router = useRouter();
  const [commission, setCommission] = useState(
    enrollment.commissionPercentOverride ??
      Number(enrollment.offer.defaultCommissionPercent),
  );
  const [discount, setDiscount] = useState(
    enrollment.discountPercentOverride ??
      Number(enrollment.offer.defaultDiscountPercent),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/marca/creadores/override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: enrollment.id,
        commissionPercentOverride: commission,
        discountPercentOverride: discount,
      }),
    });
    setSaving(false);
    router.refresh();
    onDone();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={commission}
        onChange={(e) => setCommission(Number(e.target.value))}
        className="input w-16 font-mono py-1"
      />
      <span className="text-xs text-brand-ink-soft">% comisión</span>
      <input
        type="number"
        value={discount}
        onChange={(e) => setDiscount(Number(e.target.value))}
        className="input w-16 font-mono py-1"
      />
      <span className="text-xs text-brand-ink-soft">% descuento</span>
      <button
        onClick={save}
        disabled={saving}
        className="text-xs text-brand-accent font-medium hover:underline"
      >
        {saving ? "..." : "Guardar"}
      </button>
      <button
        onClick={onDone}
        className="text-xs text-brand-ink-soft hover:underline"
      >
        Cancelar
      </button>
    </div>
  );
}

export function EnrollmentsPanel({
  enrollments,
  sampleProducts,
}: {
  enrollments: Enrollment[];
  sampleProducts: SampleProductOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [offeringSampleId, setOfferingSampleId] = useState<string | null>(null);
  const [requestingContentId, setRequestingContentId] = useState<string | null>(null);

  async function decide(enrollmentId: string, decision: "APPROVE" | "REJECT") {
    setLoadingId(enrollmentId);
    await fetch("/api/marca/creadores/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId, decision }),
    });
    setLoadingId(null);
    router.refresh();
  }

  if (enrollments.length === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Todavía no tienes creadores vinculados a tus ofertas.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
              <th className="px-5 py-3 font-normal">Creador</th>
              <th className="px-5 py-3 font-normal">Código</th>
              <th className="px-5 py-3 font-normal">Órdenes</th>
              <th className="px-5 py-3 font-normal">Ingreso generado</th>
              <th className="px-5 py-3 font-normal">Comisión / Descuento</th>
              <th className="px-5 py-3 font-normal">Estado</th>
              <th className="px-5 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {enrollments.map((e) => (
              <Fragment key={e.id}>
              <tr>
                <td className="px-5 py-3 text-brand-ink">
                  {e.creator.displayName}
                </td>
                <td className="px-5 py-3 font-mono text-brand-accent">
                  {e.discountCode}
                </td>
                <td className="px-5 py-3 font-mono text-brand-ink-soft">
                  {e.orderCount}
                </td>
                <td className="px-5 py-3 font-mono text-brand-ink">
                  {formatCOP(e.revenue)}
                </td>
                <td className="px-5 py-3">
                  {editingId === e.id ? (
                    <OverrideEditor
                      enrollment={e}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingId(e.id)}
                      className="font-mono text-brand-ink hover:text-brand-accent"
                    >
                      {e.commissionPercentOverride ??
                        Number(e.offer.defaultCommissionPercent)}
                      % /{" "}
                      {e.discountPercentOverride ??
                        Number(e.offer.defaultDiscountPercent)}
                      %
                    </button>
                  )}
                </td>
                <td className="px-5 py-3 text-brand-ink-soft">
                  {statusLabel[e.status]}
                </td>
                <td className="px-5 py-3">
                  {e.status === "PENDING_APPROVAL" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => decide(e.id, "APPROVE")}
                        disabled={loadingId === e.id}
                        className="text-xs text-brand-accent font-medium hover:underline"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => decide(e.id, "REJECT")}
                        disabled={loadingId === e.id}
                        className="text-xs text-brand-ink-soft hover:underline"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                  {e.status === "ACTIVE" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setOfferingSampleId(offeringSampleId === e.id ? null : e.id);
                          setRequestingContentId(null);
                        }}
                        className="text-xs text-brand-accent font-medium hover:underline"
                      >
                        Ofrecer muestra
                      </button>
                      <button
                        onClick={() => {
                          setRequestingContentId(requestingContentId === e.id ? null : e.id);
                          setOfferingSampleId(null);
                        }}
                        className="text-xs text-brand-accent font-medium hover:underline"
                      >
                        Encargar contenido
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {offeringSampleId === e.id && (
                <tr className="bg-brand-bg">
                  <td colSpan={7} className="px-5 py-3">
                    <OfferSampleForm
                      creatorId={e.creatorId}
                      sampleProducts={sampleProducts}
                      onDone={() => setOfferingSampleId(null)}
                    />
                  </td>
                </tr>
              )}
              {requestingContentId === e.id && (
                <tr className="bg-brand-bg">
                  <td colSpan={7} className="px-5 py-3">
                    <RequestPaidContentForm
                      creatorId={e.creatorId}
                      onDone={() => setRequestingContentId(null)}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
