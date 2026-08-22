"use client";

import { useState } from "react";

export function PaymentForm({
  initial,
}: {
  initial: {
    bankName: string;
    bankAccountType: string;
    bankAccountNumber: string;
    paymentHolderName: string;
  };
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/creador/pago", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo guardar.");
      return;
    }

    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Banco / entidad</label>
        <input
          required
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          placeholder="Bancolombia, Nequi, Daviplata..."
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Tipo de cuenta</label>
        <select
          required
          value={form.bankAccountType}
          onChange={(e) => setForm({ ...form, bankAccountType: e.target.value })}
          className="input"
        >
          <option value="">Selecciona...</option>
          <option value="AHORROS">Ahorros</option>
          <option value="CORRIENTE">Corriente</option>
          <option value="BILLETERA_DIGITAL">Billetera digital (Nequi/Daviplata)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Número de cuenta</label>
        <input
          required
          value={form.bankAccountNumber}
          onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
          className="input font-mono"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Nombre del titular</label>
        <input
          required
          value={form.paymentHolderName}
          onChange={(e) => setForm({ ...form, paymentHolderName: e.target.value })}
          className="input"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-accent">Datos de pago actualizados.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
