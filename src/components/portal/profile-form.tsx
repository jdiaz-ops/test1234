"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SocialLink = { platform: string; handle: string };

export function ProfileForm({
  initial,
}: {
  initial: {
    displayName: string;
    bio: string;
    city: string;
    verticalId: string | null;
    socialLinks: SocialLink[];
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/creador/perfil", {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Nombre</label>
        <input
          required
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Bio corta</label>
        <textarea
          maxLength={280}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="input min-h-20"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Ciudad</label>
        <input
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="input"
        />
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
              <select
                value={link.platform}
                onChange={(e) => updateLink(i, "platform", e.target.value)}
                className="input w-32"
              >
                <option>Instagram</option>
                <option>TikTok</option>
                <option>Facebook</option>
              </select>
              <input
                value={link.handle}
                onChange={(e) => updateLink(i, "handle", e.target.value)}
                placeholder="@usuario"
                className="input"
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="text-xs text-brand-ink-soft hover:text-red-600 shrink-0"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
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
  );
}
