"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUploadField } from "@/components/portal/file-upload-field";
import { BrandMiniProfile } from "@/components/portal/brand-mini-profile";

type Values = {
  companyName: string;
  legalName: string;
  taxId: string;
  description: string;
  city: string;
  websiteUrl: string;
  phone: string;
  fiscalAddress: string;
  instagramHandle: string;
  tiktokHandle: string;
};

type Files = {
  logoUrl: string | null;
  rutDocumentUrl: string | null;
  camaraComercioUrl: string | null;
};

/// Si escriben "www.marca.com" o "marca.com" (sin protocolo), el input
/// type="url" del navegador lo rechaza con "Ingresa una URL" — sin
/// explicar por qué, ni decir qué falta. En vez de pedirle a la marca
/// que escriba "https://" a mano, se lo agregamos solos al salir del
/// campo (blur), no en cada tecla — así no estorba mientras escribe.
function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-brand-ink mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={
          type === "url"
            ? (e) => onChange(normalizeUrl(e.target.value))
            : undefined
        }
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

export function BrandProfileForm({
  initial,
  files,
  onSaved,
}: {
  initial: Values;
  files: Files;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/marca/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }

      setSaved(true);
      router.refresh();
      onSaved?.();
    } catch {
      setError("No se pudo guardar — revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10 max-w-lg">
      <div>
        <h2 className="font-display font-semibold text-brand-ink mb-1">Logo</h2>
        <p className="text-xs text-brand-ink-soft mb-3">
          Formato cuadrado (1:1), mínimo 400×400px, fondo transparente en PNG o
          SVG — así se ve bien en cualquier tamaño (lista de marcas, storefront
          de creadores, comunicados).
        </p>
        <FileUploadField kind="logo" label="" currentUrl={files.logoUrl} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <h2 className="font-display font-semibold text-brand-ink -mb-1">
          Información del negocio
        </h2>
        <Field
          label="Nombre de la marca"
          value={form.companyName}
          onChange={(v) => set("companyName", v)}
        />
        <Field
          label="Página web"
          value={form.websiteUrl}
          onChange={(v) => set("websiteUrl", v)}
          placeholder="https://"
          type="url"
        />
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Descripción
          </label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value.slice(0, 150))}
            maxLength={150}
            className="input min-h-20"
          />
          <p
            className={`text-xs mt-1 text-right ${form.description.length >= 150 ? "text-red-600" : "text-brand-ink-soft"}`}
          >
            {form.description.length}/150 caracteres
          </p>
        </div>

        <div>
          <p className="text-xs text-brand-ink-soft mb-2">
            Así te ven los creadores en el marketplace:
          </p>
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-4">
            <BrandMiniProfile
              companyName={form.companyName}
              logoUrl={files.logoUrl}
              description={form.description}
              websiteUrl={form.websiteUrl}
            />
          </div>
        </div>

        <Field
          label="Teléfono / WhatsApp"
          value={form.phone}
          onChange={(v) => set("phone", v)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Instagram"
            value={form.instagramHandle}
            onChange={(v) => set("instagramHandle", v)}
            placeholder="@marca"
          />
          <Field
            label="TikTok"
            value={form.tiktokHandle}
            onChange={(v) => set("tiktokHandle", v)}
            placeholder="@marca"
          />
        </div>

        <div className="pt-4">
          <h2 className="font-display font-semibold text-brand-ink">
            Datos legales y tributarios
          </h2>
          <p className="text-xs text-brand-ink-soft mt-1">
            Los usamos para la facturación electrónica.
          </p>
        </div>
        <Field
          label="Razón social"
          value={form.legalName}
          onChange={(v) => set("legalName", v)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="NIT"
            value={form.taxId}
            onChange={(v) => set("taxId", v)}
          />
          <Field
            label="Ciudad"
            value={form.city}
            onChange={(v) => set("city", v)}
          />
        </div>
        <Field
          label="Dirección fiscal"
          value={form.fiscalAddress}
          onChange={(v) => set("fiscalAddress", v)}
        />

        <div className="pt-4">
          <h2 className="font-display font-semibold text-brand-ink mb-3">
            Documentos
          </h2>
          <div className="space-y-4">
            <FileUploadField
              kind="rut"
              label="RUT"
              currentUrl={files.rutDocumentUrl}
            />
            <FileUploadField
              kind="camara"
              label="Cámara de Comercio"
              currentUrl={files.camaraComercioUrl}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && (
          <p className="text-sm text-brand-accent">Perfil actualizado.</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
