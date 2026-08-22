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
  taxRegime: string;
  legalRepName: string;
  legalRepId: string;
  instagramHandle: string;
  tiktokHandle: string;
};

type Files = {
  logoUrl: string | null;
  rutDocumentUrl: string | null;
  camaraComercioUrl: string | null;
};

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
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

export function BrandProfileForm({ initial, files }: { initial: Values; files: Files }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleDraft() {
    if (!form.companyName.trim()) {
      setDraftError("Escribe primero el nombre de la marca.");
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/marca/perfil/redactar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          websiteUrl: form.websiteUrl,
          draft: form.description,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setDraftError(body?.error ?? "No se pudo generar la descripción.");
        return;
      }
      set("description", (body?.description ?? "").slice(0, 500));
    } catch {
      setDraftError("No se pudo generar la descripción — revisa tu conexión e intenta de nuevo.");
    } finally {
      setDrafting(false);
    }
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
          Formato cuadrado (1:1), mínimo 400×400px, fondo transparente en PNG o SVG — así se ve bien
          en cualquier tamaño (lista de marcas, storefront de creadores, comunicados).
        </p>
        <FileUploadField kind="logo" label="" currentUrl={files.logoUrl} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <h2 className="font-display font-semibold text-brand-ink -mb-1">Información del negocio</h2>
        <Field label="Nombre de la marca" value={form.companyName} onChange={(v) => set("companyName", v)} />
        <Field label="Página web" value={form.websiteUrl} onChange={(v) => set("websiteUrl", v)} placeholder="https://" type="url" />
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm text-brand-ink">Descripción</label>
            <button
              type="button"
              onClick={handleDraft}
              disabled={drafting}
              className="text-xs font-medium text-brand-accent hover:underline disabled:opacity-50"
            >
              {drafting ? "Redactando..." : "✨ Mejorar con IA"}
            </button>
          </div>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value.slice(0, 500))}
            maxLength={500}
            className="input min-h-20"
          />
          <div className="flex items-center justify-between mt-1">
            {draftError ? <p className="text-xs text-red-600">{draftError}</p> : <span />}
            <p className={`text-xs ${form.description.length >= 500 ? "text-red-600" : "text-brand-ink-soft"}`}>
              {form.description.length}/500 caracteres
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-brand-ink-soft mb-2">Así te ven los creadores en el marketplace:</p>
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-4">
            <BrandMiniProfile
              companyName={form.companyName}
              logoUrl={files.logoUrl}
              description={form.description}
              websiteUrl={form.websiteUrl}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Ciudad" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="Teléfono / WhatsApp" value={form.phone} onChange={(v) => set("phone", v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Instagram" value={form.instagramHandle} onChange={(v) => set("instagramHandle", v)} placeholder="@marca" />
          <Field label="TikTok" value={form.tiktokHandle} onChange={(v) => set("tiktokHandle", v)} placeholder="@marca" />
        </div>

        <h2 className="font-display font-semibold text-brand-ink pt-4 -mb-1">Datos legales y tributarios</h2>
        <p className="text-xs text-brand-ink-soft -mt-3">Los usamos para la facturación electrónica.</p>
        <Field label="Razón social" value={form.legalName} onChange={(v) => set("legalName", v)} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="NIT" value={form.taxId} onChange={(v) => set("taxId", v)} />
          <Field label="Régimen tributario" value={form.taxRegime} onChange={(v) => set("taxRegime", v)} placeholder="Responsable de IVA" />
        </div>
        <Field label="Dirección fiscal" value={form.fiscalAddress} onChange={(v) => set("fiscalAddress", v)} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Representante legal" value={form.legalRepName} onChange={(v) => set("legalRepName", v)} />
          <Field label="Cédula del representante" value={form.legalRepId} onChange={(v) => set("legalRepId", v)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-brand-accent">Perfil actualizado.</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <div>
        <h2 className="font-display font-semibold text-brand-ink mb-3">Documentos</h2>
        <div className="space-y-4">
          <FileUploadField kind="rut" label="RUT" currentUrl={files.rutDocumentUrl} />
          <FileUploadField kind="camara" label="Cámara de Comercio" currentUrl={files.camaraComercioUrl} />
        </div>
      </div>
    </div>
  );
}
