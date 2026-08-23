"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  documentId: string;
  payoutMethod: "BANK" | "BRE_B";
  breBKey: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  paymentHolderName: string;
};

export function PaymentForm({
  initial,
  onSaved,
}: {
  initial: FormState;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
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
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Cédula (titular de la cuenta)</label>
        <input
          required
          value={form.documentId}
          onChange={(e) => setForm({ ...form, documentId: e.target.value })}
          className="input font-mono"
        />
        <p className="text-xs text-brand-ink-soft mt-1">
          Los bancos la piden para validar que la cuenta es realmente tuya antes de transferir.
        </p>
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">¿Cómo prefieres que te paguemos?</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, payoutMethod: "BRE_B" })}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${
              form.payoutMethod === "BRE_B"
                ? "border-brand-accent bg-brand-accent-soft text-brand-accent"
                : "border-brand-line text-brand-ink-soft hover:border-brand-ink-soft"
            }`}
          >
            Llave Bre-B
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, payoutMethod: "BANK" })}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${
              form.payoutMethod === "BANK"
                ? "border-brand-accent bg-brand-accent-soft text-brand-accent"
                : "border-brand-line text-brand-ink-soft hover:border-brand-ink-soft"
            }`}
          >
            Cuenta bancaria
          </button>
        </div>
      </div>

      {form.payoutMethod === "BRE_B" ? (
        <div>
          <label className="block text-sm text-brand-ink mb-1">Tu llave Bre-B</label>
          <input
            required
            value={form.breBKey}
            onChange={(e) => setForm({ ...form, breBKey: e.target.value })}
            placeholder="@tullave, tu celular, o tu correo"
            className="input font-mono"
          />
        </div>
      ) : (
        <>
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
        </>
      )}

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
