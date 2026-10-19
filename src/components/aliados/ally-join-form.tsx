"use client";

import { useState } from "react";
import Link from "next/link";

type Kind = "BRAND" | "CREATOR";

const FIELDS: Record<Kind, { key: "name" | "contactName" | "phone" | "instagram" | "city"; label: string; type?: string; autoComplete?: string }[]> = {
  BRAND: [
    { key: "name", label: "Nombre de la marca", autoComplete: "organization" },
    { key: "contactName", label: "Tu nombre", autoComplete: "name" },
    { key: "phone", label: "Celular", type: "tel", autoComplete: "tel" },
    { key: "instagram", label: "Instagram o web de la marca" },
  ],
  CREATOR: [
    { key: "name", label: "Tu nombre", autoComplete: "name" },
    { key: "phone", label: "Celular", type: "tel", autoComplete: "tel" },
    { key: "instagram", label: "Tu Instagram" },
    { key: "city", label: "Ciudad", autoComplete: "address-level2" },
  ],
};

/// "Soy marca" / "Soy creadora" y el formulario corto de cada una.
export function AllyJoinForm({ code }: { code: string }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [values, setValues] = useState({ name: "", contactName: "", phone: "", instagram: "", city: "" });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return;
    setSending(true);
    setError(null);
    try {
      const payload =
        kind === "BRAND"
          ? { kind, name: values.name, contactName: values.contactName, phone: values.phone, instagram: values.instagram, consent }
          : { kind, name: values.name, phone: values.phone, instagram: values.instagram, city: values.city, consent };
      const res = await fetch(`/api/unete/${encodeURIComponent(code)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => null);
      if (res.ok) setDone(true);
      else setError(body?.error ?? "No pudimos guardar tus datos. Intenta de nuevo.");
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-center space-y-2">
        <h2 className="font-display text-xl font-semibold text-brand-ink">¡Listo!</h2>
        <p className="text-sm text-brand-ink-soft">Recibimos tus datos. El equipo de Marcolini te escribe en los próximos días.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 space-y-5">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="¿Qué eres?">
        {(
          [
            ["BRAND", "Soy marca"],
            ["CREATOR", "Soy creadora"],
          ] as [Kind, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setError(null);
            }}
            className={`rounded-xl border px-4 py-4 text-sm font-medium transition ${
              kind === value ? "border-brand-accent bg-brand-accent-soft text-brand-ink" : "border-brand-line text-brand-ink hover:border-brand-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {kind && (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-brand-ink-soft">
            {kind === "BRAND"
              ? "Tu tienda en Marcolini y creadoras que recomiendan tus productos. Solo pagas cuando vendes."
              : "Elige las marcas de uñas con las que trabajas y gana comisión por cada venta."}
          </p>
          {FIELDS[kind].map((field) => (
            <label key={field.key} className="block">
              <span className="block text-sm text-brand-ink mb-1">{field.label}</span>
              <input
                required
                type={field.type ?? "text"}
                autoComplete={field.autoComplete}
                value={values[field.key]}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                className="input"
              />
            </label>
          ))}
          <label className="flex items-start gap-2 text-xs text-brand-ink-soft">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" required />
            <span>
              Autorizo a Marcolini a usar estos datos para contactarme, según su{" "}
              <Link href="/privacidad" target="_blank" className="text-brand-accent hover:underline">
                política de datos
              </Link>
              .
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={sending} className="w-full rounded-full bg-brand-accent text-white py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </form>
      )}
    </div>
  );
}
