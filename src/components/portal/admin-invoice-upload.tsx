"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminInvoiceUpload({ brands }: { brands: { id: string; companyName: string }[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Selecciona el PDF de la factura");
      return;
    }
    setSaving(true);
    setError(null);
    setOk(false);

    const form = new FormData();
    form.append("brandId", brandId);
    form.append("period", period);
    form.append("amount", amount);
    form.append("note", note);
    form.append("file", file);

    const res = await fetch("/api/admin/facturas", { method: "POST", body: form });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo subir la factura.");
      return;
    }

    setOk(true);
    setPeriod("");
    setAmount("");
    setNote("");
    setFile(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-line bg-brand-surface p-6 space-y-4 max-w-lg mb-10">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Marca</label>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="input">
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.companyName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">Período</label>
          <input
            required
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Monto (COP)</label>
        <input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="input font-mono" />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Nota (opcional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">PDF de la factura</label>
        <input
          required
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-brand-accent">Factura subida — ya la puede ver la marca.</p>}
      <button
        type="submit"
        disabled={saving || brands.length === 0}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Subiendo..." : "Subir factura"}
      </button>
      {brands.length === 0 && <p className="text-xs text-brand-ink-soft">No hay marcas aprobadas todavía.</p>}
    </form>
  );
}
