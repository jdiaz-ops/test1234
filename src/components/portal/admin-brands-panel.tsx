"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Brand = {
  id: string;
  companyName: string;
  city: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  storeType: string;
  platformFeePercentOverride: number | null;
  _count: { offers: number };
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
};

const statusColor: Record<string, string> = {
  PENDING: "text-amber-600",
  APPROVED: "text-brand-accent",
  REJECTED: "text-red-600",
  PAUSED: "text-brand-ink-soft",
};

function FeeEditor({ brand, onDone }: { brand: Brand; onDone: () => void }) {
  const router = useRouter();
  const [fee, setFee] = useState(brand.platformFeePercentOverride ?? 5);
  const [saving, setSaving] = useState(false);

  async function save(value: number | null) {
    setSaving(true);
    await fetch("/api/admin/marcas/tarifa", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: brand.id, feePercent: value }),
    });
    setSaving(false);
    router.refresh();
    onDone();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={fee}
        onChange={(e) => setFee(Number(e.target.value))}
        className="input w-16 font-mono py-1"
      />
      <button onClick={() => save(fee)} disabled={saving} className="text-xs text-brand-accent hover:underline">
        Guardar
      </button>
      <button onClick={() => save(null)} disabled={saving} className="text-xs text-brand-ink-soft hover:underline">
        Usar default
      </button>
      <button onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
        Cancelar
      </button>
    </div>
  );
}

export function AdminBrandsPanel({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function decide(brandId: string, decision: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, decision }),
    });
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
            <th className="px-5 py-3 font-normal">Marca</th>
            <th className="px-5 py-3 font-normal">Tienda</th>
            <th className="px-5 py-3 font-normal">Ofertas</th>
            <th className="px-5 py-3 font-normal">Tarifa</th>
            <th className="px-5 py-3 font-normal">Estado</th>
            <th className="px-5 py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {brands.map((b) => (
            <tr key={b.id}>
              <td className="px-5 py-3 text-brand-ink">
                {b.companyName}
                {b.city && <span className="text-brand-ink-soft"> · {b.city}</span>}
              </td>
              <td className="px-5 py-3 text-brand-ink-soft">{b.storeType}</td>
              <td className="px-5 py-3 font-mono text-brand-ink-soft">{b._count.offers}</td>
              <td className="px-5 py-3">
                {editingFeeId === b.id ? (
                  <FeeEditor brand={b} onDone={() => setEditingFeeId(null)} />
                ) : (
                  <button
                    onClick={() => setEditingFeeId(b.id)}
                    className="font-mono text-brand-ink hover:text-brand-accent"
                  >
                    {b.platformFeePercentOverride ?? "5 (default)"}%
                  </button>
                )}
              </td>
              <td className={`px-5 py-3 font-medium ${statusColor[b.status]}`}>{statusLabel[b.status]}</td>
              <td className="px-5 py-3">
                <div className="flex gap-3">
                  {b.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => decide(b.id, "APPROVE")}
                        disabled={loadingId === b.id}
                        className="text-xs text-brand-accent font-medium hover:underline"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => decide(b.id, "REJECT")}
                        disabled={loadingId === b.id}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  {b.status === "APPROVED" && (
                    <button
                      onClick={() => decide(b.id, "PAUSE")}
                      disabled={loadingId === b.id}
                      className="text-xs text-brand-ink-soft hover:underline"
                    >
                      Pausar
                    </button>
                  )}
                  {b.status === "PAUSED" && (
                    <button
                      onClick={() => decide(b.id, "REACTIVATE")}
                      disabled={loadingId === b.id}
                      className="text-xs text-brand-accent hover:underline"
                    >
                      Reactivar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
