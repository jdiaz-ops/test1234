"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SocialLink = { platform: string; handle: string };
type Vertical = { id: string; name: string };

export function CreatorProfileStepForm({
  initial,
  photoUrl,
  verticals,
  initialInterestIds,
  onSaved,
  submitLabel = "Guardar y continuar",
}: {
  initial: {
    displayName: string;
    legalName: string;
    city: string;
    phone: string;
    socialLinks: SocialLink[];
  };
  photoUrl: string | null;
  verticals: Vertical[];
  initialInterestIds: string[];
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [interestIds, setInterestIds] = useState<string[]>(initialInterestIds);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(photoUrl);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLink(index: number, field: keyof SocialLink, value: string) {
    const links = [...form.socialLinks];
    links[index] = { ...links[index], [field]: value };
    setForm({ ...form, socialLinks: links });
  }

  function addLink() {
    setForm({ ...form, socialLinks: [...form.socialLinks, { platform: "Instagram", handle: "" }] });
  }

  function removeLink(index: number) {
    setForm({ ...form, socialLinks: form.socialLinks.filter((_, i) => i !== index) });
  }

  function toggleInterest(id: string) {
    setInterestIds((cur) => (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);

    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/creador/perfil/subir", { method: "POST", body });
    setUploadingPhoto(false);

    if (!res.ok) {
      const b = await res.json();
      setError(b.error ?? "No se pudo subir la foto.");
      return;
    }
    const b = await res.json();
    setCurrentPhotoUrl(b.url);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const [perfilRes, interesesRes] = await Promise.all([
      fetch("/api/creador/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
      fetch("/api/creador/intereses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verticalIds: interestIds }),
      }),
    ]);

    setSaving(false);

    if (!perfilRes.ok) {
      const b = await perfilRes.json();
      setError(b.error ?? "No se pudo guardar.");
      return;
    }
    if (!interesesRes.ok) {
      const b = await interesesRes.json();
      setError(b.error ?? "No se pudo guardar.");
      return;
    }

    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Foto de perfil</label>
        <div className="flex items-center gap-3">
          {currentPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto subida por el creador
            <img src={currentPhotoUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-brand-line" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-brand-accent-soft" />
          )}
          <label className="text-xs border border-brand-line rounded-full px-4 py-1.5 cursor-pointer hover:bg-brand-accent-soft">
            {uploadingPhoto ? "Subiendo..." : "Subir foto"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} disabled={uploadingPhoto} className="hidden" />
          </label>
        </div>
        <p className="text-xs text-brand-ink-soft mt-1">Opcional — pero ayuda a que las marcas confíen más rápido.</p>
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Username (cómo te conocen)</label>
        <input
          required
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          placeholder="ej. dani15"
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Nombre y apellido completo</label>
        <input
          value={form.legalName}
          onChange={(e) => setForm({ ...form, legalName: e.target.value })}
          placeholder="Para pagos — nunca se muestra en tu vitrina pública"
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Ciudad</label>
        <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Celular / WhatsApp</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-brand-ink">Redes sociales</label>
          <button type="button" onClick={addLink} className="text-xs text-brand-accent font-medium hover:underline">
            + Agregar red
          </button>
        </div>
        <div className="space-y-2">
          {form.socialLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={link.platform} onChange={(e) => updateLink(i, "platform", e.target.value)} className="input w-32">
                <option>Instagram</option>
                <option>TikTok</option>
                <option>Facebook</option>
              </select>
              <input value={link.handle} onChange={(e) => updateLink(i, "handle", e.target.value)} placeholder="@usuario" className="input" />
              <button type="button" onClick={() => removeLink(i)} className="text-xs text-brand-ink-soft hover:text-red-600 shrink-0">
                Quitar
              </button>
            </div>
          ))}
          {form.socialLinks.length === 0 && <p className="text-xs text-brand-ink-soft">Todavía no agregas ninguna.</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-2">Categorías de tu interés</label>
        <div className="flex flex-wrap gap-2">
          {verticals.map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => toggleInterest(v.id)}
              className={`text-xs rounded-full px-3 py-1.5 border ${
                interestIds.includes(v.id)
                  ? "border-brand-accent bg-brand-accent-soft text-brand-accent font-medium"
                  : "border-brand-line text-brand-ink-soft hover:border-brand-ink-soft"
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-ink-soft mt-1">
          Marca todas las que te interesen — nos ayuda a saber a dónde expandir el marketplace.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
