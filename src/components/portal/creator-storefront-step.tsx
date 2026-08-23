"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STOREFRONT_PALETTES, STOREFRONT_FONTS } from "@/lib/creator-storefront-themes";
import { CopyButton } from "@/components/portal/copy-button";
import { VitrinaLivePreview } from "@/components/portal/vitrina-live-preview";

type EnrollmentItem = {
  id: string;
  brandName: string;
  logoUrl: string | null;
  visible: boolean;
  discountPercent: number;
  discountCode: string;
};

export function CreatorStorefrontStep({
  displayName,
  photoUrl,
  initial,
  enrollments,
  publicUrl,
  onSaved,
}: {
  displayName: string;
  photoUrl: string | null;
  initial: { storefrontPalette: string; storefrontFont: string; storefrontHeadline: string; bio: string };
  enrollments: EnrollmentItem[];
  publicUrl: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [items, setItems] = useState<EnrollmentItem[]>(enrollments);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleVisible(id: string) {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it)));
  }

  function move(id: string, direction: -1 | 1) {
    setItems((cur) => {
      const index = cur.findIndex((it) => it.id === id);
      const target = index + direction;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const [vitrinaRes, marcasRes] = await Promise.all([
      fetch("/api/creador/vitrina", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
      fetch("/api/creador/vitrina/marcas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it, i) => ({ enrollmentId: it.id, storefrontVisible: it.visible, storefrontOrder: i })),
        }),
      }),
    ]);

    setSaving(false);

    if (!vitrinaRes.ok || !marcasRes.ok) {
      setError("No se pudo guardar.");
      return;
    }

    router.refresh();
    onSaved?.();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="rounded-2xl border-2 border-brand-accent bg-brand-accent-soft p-5">
          <p className="text-sm font-medium text-brand-ink mb-1">
            Tu link — ponlo en tu bio de Instagram/TikTok o compártelo por WhatsApp/correo
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="font-mono text-brand-accent text-lg">{publicUrl}</span>
            <CopyButton value={`https://${publicUrl}`} />
          </div>
        </div>

        <div>
          <label className="block text-sm text-brand-ink mb-2">Paleta de colores</label>
          <div className="grid grid-cols-3 gap-2">
            {STOREFRONT_PALETTES.map((p) => (
              <button
                type="button"
                key={p.key}
                onClick={() => setForm({ ...form, storefrontPalette: p.key })}
                className={`rounded-xl border p-3 text-left ${
                  form.storefrontPalette === p.key ? "border-brand-accent ring-2 ring-brand-accent" : "border-brand-line"
                }`}
                style={{ background: p.bg }}
              >
                <div className="flex gap-1 mb-2">
                  <span className="w-4 h-4 rounded-full" style={{ background: p.accent }} />
                  <span className="w-4 h-4 rounded-full" style={{ background: p.accentSoft }} />
                </div>
                <span className="text-xs font-medium" style={{ color: p.ink }}>
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-brand-ink mb-2">Fuente</label>
          <div className="flex flex-wrap gap-2">
            {STOREFRONT_FONTS.map((f) => (
              <button
                type="button"
                key={f.key}
                onClick={() => setForm({ ...form, storefrontFont: f.key })}
                className={`rounded-full px-4 py-2 text-sm border ${
                  form.storefrontFont === f.key
                    ? "border-brand-accent bg-brand-accent-soft text-brand-accent font-medium"
                    : "border-brand-line text-brand-ink-soft"
                }`}
                style={{ fontFamily: f.stack }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-brand-ink mb-1">Título de tu vitrina</label>
          <input
            value={form.storefrontHeadline}
            onChange={(e) => setForm({ ...form, storefrontHeadline: e.target.value })}
            placeholder="ej. Mis descuentos favoritos ✨"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm text-brand-ink mb-1">Descripción corta (opcional)</label>
          <textarea
            maxLength={280}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="input min-h-20"
          />
        </div>

        {items.length > 0 && (
          <div>
            <label className="block text-sm text-brand-ink mb-2">Qué marcas se ven, y en qué orden</label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={it.id} className="flex items-center gap-3 rounded-xl border border-brand-line bg-brand-surface px-3 py-2">
                  <div className="flex flex-col shrink-0">
                    <button type="button" onClick={() => move(it.id, -1)} disabled={i === 0} className="text-xs text-brand-ink-soft disabled:opacity-30 hover:text-brand-accent">
                      ▲
                    </button>
                    <button type="button" onClick={() => move(it.id, 1)} disabled={i === items.length - 1} className="text-xs text-brand-ink-soft disabled:opacity-30 hover:text-brand-accent">
                      ▼
                    </button>
                  </div>
                  <p className="text-sm text-brand-ink flex-1">{it.brandName}</p>
                  <label className="flex items-center gap-1.5 text-xs text-brand-ink-soft shrink-0">
                    <input type="checkbox" checked={it.visible} onChange={() => toggleVisible(it.id)} />
                    Visible
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <a href={`/c/${publicUrl.split("/").pop()}`} target="_blank" className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline">
            Ver vitrina completa →
          </a>
        </div>
      </form>

      <VitrinaLivePreview
        displayName={displayName}
        photoUrl={photoUrl}
        palette={form.storefrontPalette}
        font={form.storefrontFont}
        headline={form.storefrontHeadline}
        bio={form.bio}
        items={items}
      />
    </div>
  );
}
