"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Config = {
  defaultPlatformFeePercent: number;
  vatPercent: number;
  chargeDayOfMonth: number;
  payoutDayOfMonth: number;
  refundHoldDays: number;
  instantPayoutFeePercent: number;
  paymentInstructions: string;
  paymentGraceHours: number;
};

export function PlatformConfigForm({ initial, readOnly }: { initial: Config; readOnly: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/configuracion", {
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
  }

  const field = (label: string, key: keyof Config, suffix = "%") => (
    <div>
      <label className="block text-sm text-brand-ink mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          disabled={readOnly}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
          className="input w-28 font-mono disabled:opacity-60"
        />
        <span className="text-sm text-brand-ink-soft">{suffix}</span>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {field("Tarifa de plataforma por defecto", "defaultPlatformFeePercent")}
      {field("IVA", "vatPercent")}
      {field("Día de cobro a marcas", "chargeDayOfMonth", "del mes")}
      {field("Día de pago a creadores", "payoutDayOfMonth", "del mes")}
      {field("Días de espera por reembolsos", "refundHoldDays", "días")}
      {field("Fee de cobro anticipado", "instantPayoutFeePercent")}
      {field("Plazo antes del bloqueo por impago", "paymentGraceHours", "horas")}

      <div>
        <label className="block text-sm text-brand-ink mb-1">Instrucciones de pago (QR/Bre-B, cuenta, etc.)</label>
        <textarea
          disabled={readOnly}
          value={form.paymentInstructions}
          onChange={(e) => setForm({ ...form, paymentInstructions: e.target.value })}
          rows={4}
          placeholder="Ej: Bre-B — llave: 3134058607&#10;Cuenta de ahorros Bancolombia 000-000000-00, Marcolini SAS"
          className="input disabled:opacity-60"
        />
        <p className="text-xs text-brand-ink-soft mt-1">
          Se muestra tal cual (con saltos de línea) en cada aviso de cobro y en el aviso de bloqueo.
        </p>
      </div>

      {readOnly && (
        <p className="text-xs text-brand-ink-soft">Solo el propietario puede editar esta configuración.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-accent">Configuración actualizada.</p>}

      {!readOnly && (
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      )}
    </form>
  );
}
