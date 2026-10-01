"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CREATOR_AUDIENCE_OPTIONS,
  CREATOR_CATEGORY_OPTIONS,
  EXTRA_SOCIAL_PLATFORMS,
  type SocialProfile,
} from "@/lib/waitlist";

/// Formulario de /lista-de-espera (creadores). Ver waitlist-service.ts.
export function CreatorWaitlistForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    instagram: "",
    tiktok: "",
    audience: "",
    category: "",
  });
  // Redes extra (YouTube, Facebook…): su fuerte puede no ser IG o TikTok.
  const [others, setOthers] = useState<SocialProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { alreadyJoined: boolean }>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const socials = [
      { platform: "Instagram", handle: form.instagram },
      { platform: "TikTok", handle: form.tiktok },
      ...others,
    ].filter((s) => s.handle.trim());
    if (socials.length === 0) {
      setError("Escribe al menos una red social.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/lista-de-espera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          whatsapp: form.whatsapp,
          audience: form.audience,
          category: form.category,
          socials,
        }),
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
          {done.alreadyJoined ? "Ya estabas en la lista" : "¡Estás en la lista!"}
        </h1>
        <p className="text-sm text-brand-ink-soft mb-6">
          {done.alreadyJoined
            ? "Actualizamos tus datos. "
            : ""}
          Te escribiremos a <strong>{form.email}</strong> o por WhatsApp cuando abramos tu acceso.
        </p>
        <Link href="/para-creadores" className="text-sm text-brand-accent font-medium hover:underline">
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
        <Field label="Nombre">
          <input required autoComplete="name" value={form.name} onChange={set("name")} className="input" />
        </Field>
        <Field label="Correo">
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            className="input"
          />
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
        <fieldset className="space-y-2">
          <legend className="text-sm text-brand-ink mb-1">
            Tus redes <span className="text-brand-ink-soft">(llena al menos una)</span>
          </legend>
          <SocialRow label="Instagram">
            <input
              aria-label="Instagram"
              autoCapitalize="none"
              placeholder="@tuusuario"
              value={form.instagram}
              onChange={set("instagram")}
              className="input"
            />
          </SocialRow>
          <SocialRow label="TikTok">
            <input
              aria-label="TikTok"
              autoCapitalize="none"
              placeholder="@tuusuario"
              value={form.tiktok}
              onChange={set("tiktok")}
              className="input"
            />
          </SocialRow>
          {others.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                aria-label="Red social"
                value={s.platform}
                onChange={(e) =>
                  setOthers(others.map((o, j) => (j === i ? { ...o, platform: e.target.value } : o)))
                }
                className="input w-[6.5rem] shrink-0"
              >
                {EXTRA_SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Usuario o link de ${s.platform}`}
                autoCapitalize="none"
                placeholder="Usuario o link"
                value={s.handle}
                onChange={(e) =>
                  setOthers(others.map((o, j) => (j === i ? { ...o, handle: e.target.value } : o)))
                }
                className="input min-w-0 flex-1"
              />
              <button
                type="button"
                aria-label={`Quitar ${s.platform}`}
                onClick={() => setOthers(others.filter((_, j) => j !== i))}
                className="shrink-0 w-8 h-8 rounded-full text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
              >
                ×
              </button>
            </div>
          ))}
          {others.length < 8 && (
            <button
              type="button"
              onClick={() => setOthers([...others, { platform: EXTRA_SOCIAL_PLATFORMS[0], handle: "" }])}
              className="text-sm text-brand-accent font-medium hover:underline"
            >
              + Agregar otra red
            </button>
          )}
        </fieldset>
        <Field label="¿Cuántos seguidores tienes en tu red más fuerte?">
          <select required value={form.audience} onChange={set("audience")} className="input">
            <option value="" disabled>
              Elige una opción
            </option>
            {CREATOR_AUDIENCE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="¿De qué creas contenido?">
          <select required value={form.category} onChange={set("category")} className="input">
            <option value="" disabled>
              Elige una opción
            </option>
            {CREATOR_CATEGORY_OPTIONS.map((o) => (
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

function SocialRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[6.5rem] shrink-0 text-sm text-brand-ink-soft">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
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
