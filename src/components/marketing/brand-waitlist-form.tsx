"use client";

import { useState } from "react";
import Link from "next/link";
import { BRAND_CATEGORY_OPTIONS, BRAND_SALES_CHANNEL_OPTIONS } from "@/lib/waitlist";

/// Formulario de /lista-de-espera/marcas. Ver waitlist-service.ts.
export function BrandWaitlistForm() {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    whatsapp: "",
    handle: "",
    category: "",
    salesChannel: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { alreadyJoined: boolean }>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/lista-de-espera/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "No pudimos guardar tus datos. Intenta de nuevo.");
        return;
      }
      setDone({ alreadyJoined: Boolean(body.alreadyJoined) });
    } catch {
      setError("No pudimos guardar tus datos. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="font-display text-lg font-semibold text-brand-ink mb-2">
          {done.alreadyJoined ? "Tu marca ya estaba en la lista" : "¡Tu marca está en la lista!"}
        </h1>
        <p className="text-sm text-brand-ink-soft mb-6">
          {done.alreadyJoined ? "Actualizamos tus datos. " : ""}
          Te escribiremos a <strong>{form.email}</strong> o por WhatsApp cuando abramos tu acceso.
        </p>
        <Link href="/para-marcas" className="text-sm text-brand-accent font-medium hover:underline">
          Volver a Marcolini
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-brand-ink text-center mb-6">
        Únete a la lista de espera
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Tu nombre">
          <input required autoComplete="name" value={form.name} onChange={set("name")} className="input" />
        </Field>
        <Field label="Nombre de la marca">
          <input required autoComplete="organization" value={form.company} onChange={set("company")} className="input" />
        </Field>
        <Field label="Correo">
          <input type="email" required autoComplete="email" value={form.email} onChange={set("email")} className="input" />
        </Field>
        <Field label="WhatsApp">
          <input
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="300 123 4567"
            value={form.whatsapp}
            onChange={set("whatsapp")}
            className="input"
          />
        </Field>
        <Field label="Instagram o web de la marca">
          <input
            required
            autoCapitalize="none"
            placeholder="@tumarca o tumarca.com"
            value={form.handle}
            onChange={set("handle")}
            className="input"
          />
        </Field>
        <Field label="¿Qué vende tu marca?">
          <select required value={form.category} onChange={set("category")} className="input">
            <option value="" disabled>
              Elige una opción
            </option>
            {BRAND_CATEGORY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="¿Dónde vendes hoy?">
          <select required value={form.salesChannel} onChange={set("salesChannel")} className="input">
            <option value="" disabled>
              Elige una opción
            </option>
            {BRAND_SALES_CHANNEL_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-accent text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Unirme a la lista"}
        </button>
        <p className="text-xs text-brand-ink-soft text-center">
          Usamos tus datos solo para contactarte sobre Marcolini.{" "}
          <Link href="/privacidad" className="underline" target="_blank">
            Política de privacidad
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-brand-ink mb-1">{label}</span>
      {children}
    </label>
  );
}
