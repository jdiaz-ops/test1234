"use client";

import { useState } from "react";
import Link from "next/link";
import { CREATOR_AUDIENCE_OPTIONS, CREATOR_CATEGORY_OPTIONS, type SocialProfile } from "@/lib/waitlist";
import { SocialProfilesField } from "./social-profiles-field";
import { YesNoField, type YesNo } from "./yes-no-field";

// Su fuerte puede no ser IG o TikTok: puede agregar otras redes.
const FIXED_SOCIALS = [
  { platform: "Instagram", placeholder: "@tuusuario" },
  { platform: "TikTok", placeholder: "@tuusuario" },
];

/// Formulario de /lista-de-espera (creadores). Ver waitlist-service.ts.
export function CreatorWaitlistForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    audience: "",
    category: "",
  });
  const [socialsInput, setSocialsInput] = useState<SocialProfile[]>(
    FIXED_SOCIALS.map((f) => ({ platform: f.platform, handle: "" })),
  );
  // Marcolini arranca solo con uñas (2026-10-03): primero "¿Creas
  // contenido de uñas?" Sí/No; solo si dice que no, elige otra categoría.
  // Lo que se guarda es la misma categoría de siempre ("Uñas" si dice sí).
  const [doesNails, setDoesNails] = useState<YesNo>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { alreadyJoined: boolean }>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const socials = socialsInput.filter((s) => s.handle.trim());
    if (socials.length === 0) {
      setError("Escribe al menos una red social.");
      return;
    }
    if (!doesNails) {
      setError("Cuéntanos si creas contenido de uñas.");
      return;
    }
    const category = doesNails === "si" ? "Uñas" : form.category;
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
          category,
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
          {done.alreadyJoined ? "Tu solicitud ya estaba registrada" : "¡Recibimos tu solicitud!"}
        </h1>
        {/* La solicitud no da acceso: cada perfil se revisa (red
            seleccionada, 2026-10-03). */}
        <p className="text-sm text-brand-ink-soft mb-6">
          {done.alreadyJoined ? (
            <>Actualizamos tus datos y la seguimos revisando. </>
          ) : (
            <>Vamos a revisar tu perfil. </>
          )}
          Te escribiremos a <strong>{form.email}</strong> o por WhatsApp para contarte si quedaste
          seleccionada.
        </p>
        <Link href="/para-creadores" className="text-sm text-brand-accent font-medium hover:underline">
          Volver a Marcolini
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-brand-ink text-center mb-2">
        Aplica a la red de Marcolini
      </h1>
      <p className="text-sm text-brand-ink-soft text-center text-balance mb-6">
        Aplicaciones abiertas. Revisamos cada perfil uno por uno: enviar el formulario no
        garantiza el acceso a la red.
      </p>

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
        <SocialProfilesField fixed={FIXED_SOCIALS} value={socialsInput} onChange={setSocialsInput} />
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
        <YesNoField
          label="¿Creas contenido de uñas?"
          name="doesNails"
          value={doesNails}
          onChange={setDoesNails}
        />
        {doesNails === "no" && (
          <Field label="¿De qué creas contenido?">
            <select required value={form.category} onChange={set("category")} className="input">
              <option value="" disabled>
                Elige una opción
              </option>
              {CREATOR_CATEGORY_OPTIONS.filter((o) => o !== "Uñas").map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-accent text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar mi solicitud"}
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
