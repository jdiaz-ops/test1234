"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnterAsButton } from "@/components/portal/enter-as-button";

type Brand = {
  id: string;
  userId: string;
  companyName: string;
  city: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  storeType: string;
  platformFeePercentOverride: number | null;
  marketplaceVisibilityOverride: "AUTO" | "FORCE_VISIBLE" | "FORCE_HIDDEN";
  _count: { offers: number };
  // El query que llena esto ya filtra status != PAID — el tipo incluye PAID
  // solo porque así lo infiere Prisma, nunca llega ese valor en la práctica.
  openCharge: { id: string; status: "PENDING" | "PROOF_SUBMITTED" | "OVERDUE" | "PAID"; totalAmount: number } | null;
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

const chargeStatusLabel: Record<string, string> = {
  PENDING: "esperando pago",
  PROOF_SUBMITTED: "comprobante en revisión",
  OVERDUE: "vencido — bloqueada",
};

function AddBrandForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", companyName: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/marcas/crear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo crear la marca.");
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 border-b border-brand-line bg-brand-accent-soft/40 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          type="email"
          required
          placeholder="correo@marca.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="input"
        />
        <input
          type="text"
          required
          placeholder="Nombre de la marca"
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          className="input"
        />
        <input
          type="text"
          placeholder="Ciudad (opcional)"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="input"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear marca"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
        <p className="text-xs text-brand-ink-soft">
          Queda aprobada de inmediato y le llega un correo para poner su contraseña.
        </p>
      </div>
    </form>
  );
}

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

export function AdminBrandsPanel({ brands, isOwner }: { brands: Brand[]; isOwner: boolean }) {
  const router = useRouter();
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);
  const [creatingTestBrands, setCreatingTestBrands] = useState(false);

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

  async function createTestBrands() {
    setCreatingTestBrands(true);
    await fetch("/api/admin/marcas/prueba", { method: "POST" });
    setCreatingTestBrands(false);
    router.refresh();
  }

  async function simulateOverdue(brandId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/prueba/moroso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function removeTestCharge(brandId: string, chargeId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/prueba/moroso/quitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chargeId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function setVisibility(brandId: string, override: "AUTO" | "FORCE_VISIBLE" | "FORCE_HIDDEN") {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/visibilidad", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, override }),
    });
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
      <div className="flex justify-end gap-4 px-5 py-3 border-b border-brand-line">
        {isOwner && (
          <button
            onClick={createTestBrands}
            disabled={creatingTestBrands}
            className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
          >
            {creatingTestBrands ? "Creando..." : "Crear 4 marcas de prueba"}
          </button>
        )}
        {!addingBrand && (
          <button onClick={() => setAddingBrand(true)} className="text-xs text-brand-accent font-medium hover:underline">
            + Agregar marca manualmente
          </button>
        )}
      </div>
      {addingBrand && <AddBrandForm onDone={() => setAddingBrand(false)} />}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
            <th className="px-5 py-3 font-normal">Marca</th>
            <th className="px-5 py-3 font-normal">Tienda</th>
            <th className="px-5 py-3 font-normal">Ofertas</th>
            <th className="px-5 py-3 font-normal">Tarifa</th>
            <th className="px-5 py-3 font-normal">Estado</th>
            {isOwner && <th className="px-5 py-3 font-normal">Marketplace</th>}
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
              {isOwner && (
                <td className="px-5 py-3">
                  <select
                    value={b.marketplaceVisibilityOverride}
                    onChange={(e) => setVisibility(b.id, e.target.value as "AUTO" | "FORCE_VISIBLE" | "FORCE_HIDDEN")}
                    disabled={loadingId === b.id}
                    title="Fuerza si esta marca aparece en el marketplace del creador, sin importar si completó su onboarding real — para pruebas visuales."
                    className={`input py-1 text-xs ${
                      b.marketplaceVisibilityOverride !== "AUTO" ? "border-brand-accent text-brand-accent font-medium" : ""
                    }`}
                  >
                    <option value="AUTO">Auto (real)</option>
                    <option value="FORCE_VISIBLE">Forzar visible</option>
                    <option value="FORCE_HIDDEN">Forzar oculta</option>
                  </select>
                </td>
              )}
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
                  {isOwner && b.status === "APPROVED" && (
                    <>
                      {b.openCharge ? (
                        <button
                          onClick={() => removeTestCharge(b.id, b.openCharge!.id)}
                          disabled={loadingId === b.id}
                          className="text-xs text-brand-ink-soft hover:text-red-600 hover:underline disabled:opacity-50"
                          title={`Corte activo: ${chargeStatusLabel[b.openCharge.status] ?? b.openCharge.status}`}
                        >
                          Quitar corte de prueba
                        </button>
                      ) : (
                        <button
                          onClick={() => simulateOverdue(b.id)}
                          disabled={loadingId === b.id}
                          className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
                        >
                          Simular corte vencido
                        </button>
                      )}
                    </>
                  )}
                  {isOwner && <EnterAsButton userId={b.userId} role="BRAND" />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
