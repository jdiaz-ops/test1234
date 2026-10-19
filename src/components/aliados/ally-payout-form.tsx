"use client";

import { useState } from "react";

type Details = {
  legalName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  payoutMethod: "BANK" | "BRE_B" | null;
  breBKey: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
};

/// Los datos con los que Marcolini le paga al aliado.
export function AllyPayoutForm({ initial }: { initial: Details }) {
  const [form, setForm] = useState({
    legalName: initial.legalName ?? "",
    documentType: initial.documentType ?? "CC",
    documentNumber: initial.documentNumber ?? "",
    payoutMethod: initial.payoutMethod ?? "BANK",
    breBKey: initial.breBKey ?? "",
    bankName: initial.bankName ?? "",
    bankAccountType: initial.bankAccountType ?? "AHORROS",
    bankAccountNumber: initial.bankAccountNumber ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/aliado/datos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await res.json().catch(() => null);
      setMessage(res.ok ? { ok: true, text: "Guardado." } : { ok: false, text: body?.error ?? "No se pudo guardar." });
    } catch {
      setMessage({ ok: false, text: "Sin conexión. Intenta de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 max-w-xl">
      <input value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} placeholder="Nombre completo o razón social" className="input text-sm" aria-label="Nombre completo o razón social" />
      <div className="grid grid-cols-3 gap-2">
        <select value={form.documentType} onChange={(e) => set({ documentType: e.target.value })} className="input text-sm" aria-label="Tipo de documento">
          <option value="CC">CC</option>
          <option value="CE">CE</option>
          <option value="NIT">NIT</option>
          <option value="PASAPORTE">Pasaporte</option>
        </select>
        <input value={form.documentNumber} onChange={(e) => set({ documentNumber: e.target.value })} placeholder="Número de documento" className="input text-sm col-span-2" aria-label="Número de documento" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["BANK", "Cuenta bancaria"],
            ["BRE_B", "Llave Bre-B"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => set({ payoutMethod: value })}
            className={`rounded-full px-3 py-1.5 text-xs ${form.payoutMethod === value ? "bg-brand-ink text-white" : "border border-brand-line text-brand-ink-soft hover:text-brand-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {form.payoutMethod === "BANK" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} placeholder="Banco" className="input text-sm" aria-label="Banco" />
          <select value={form.bankAccountType} onChange={(e) => set({ bankAccountType: e.target.value })} className="input text-sm" aria-label="Tipo de cuenta">
            <option value="AHORROS">Ahorros</option>
            <option value="CORRIENTE">Corriente</option>
          </select>
          <input value={form.bankAccountNumber} onChange={(e) => set({ bankAccountNumber: e.target.value })} placeholder="Número de cuenta" className="input text-sm" inputMode="numeric" aria-label="Número de cuenta" />
        </div>
      ) : (
        <input value={form.breBKey} onChange={(e) => set({ breBKey: e.target.value })} placeholder="Tu llave Bre-B (celular, correo o documento)" className="input text-sm" aria-label="Llave Bre-B" />
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-brand-accent text-white px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
      </div>
    </form>
  );
}
