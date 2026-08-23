"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SocialLink = { platform: string; handle: string };
type Vertical = { id: string; name: string };

// Antes era una lista libre (agregar fila + elegir plataforma) — ahora son
// tres campos fijos, más directo para el creador.
const SOCIAL_PLATFORMS = ["TikTok", "Instagram", "Facebook"] as const;

function getHandle(links: SocialLink[], platform: string) {
  return links.find((l) => l.platform === platform)?.handle ?? "";
}

function setHandle(links: SocialLink[], platform: string, handle: string): SocialLink[] {
  const others = links.filter((l) => l.platform !== platform);
  return handle.trim() ? [...others, { platform, handle }] : others;
}

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

  function updateSocial(platform: string, handle: string) {
    setForm((f) => ({ ...f, socialLinks: setHandle(f.socialLinks, platform, handle) }));
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
        <label className="block text-sm text-brand-ink mb-2">Redes sociales</label>
        <div className="space-y-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform} className="flex items-center gap-2">
              <span className="text-xs text-brand-ink-soft w-20 shrink-0">@{platform}</span>
              <input
                value={getHandle(form.socialLinks, platform)}
                onChange={(e) => updateSocial(platform, e.target.value)}
                placeholder="tu_usuario"
                className="input"
              />
            </div>
          ))}
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
        <p className="text-xs text-brand-ink-soft mt-1">Marca todas las categorías que te interesan.</p>
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
