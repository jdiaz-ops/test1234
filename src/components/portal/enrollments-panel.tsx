"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Enrollment = {
  id: string;
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
}: {
  enrollments: Enrollment[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

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
              <tr key={e.id}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
