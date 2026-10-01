"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  STOREFRONT_PALETTES,
  STOREFRONT_FONTS,
} from "@/lib/creator-storefront-themes";
import { CopyButton } from "@/components/portal/copy-button";
import { VitrinaLivePreview } from "@/components/portal/vitrina-live-preview";
import {
  CollectionsManager,
  type Collection,
} from "@/components/portal/collections-manager";

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
  collections = [],
  publicUrl,
  onSaved,
}: {
  displayName: string;
  photoUrl: string | null;
  initial: {
    storefrontPalette: string;
    storefrontFont: string;
    storefrontHeadline: string;
    bio: string;
  };
  enrollments: EnrollmentItem[];
  // Forma completa — CollectionsManager (que se edita acá mismo, junto a la
  // vista previa) la necesita entera; para la vista previa se manda solo
  // el subconjunto liviano que le hace falta (ver livePreviewCollections
  // más abajo).
  collections?: Collection[];
  publicUrl: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [items, setItems] = useState<EnrollmentItem[]>(enrollments);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleVisible(id: string) {
    setItems((cur) =>
      cur.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it)),
    );
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
          items: items.map((it, i) => ({
            enrollmentId: it.id,
            storefrontVisible: it.visible,
            storefrontOrder: i,
          })),
        }),
      }),
    ]);

    setSaving(false);

    if (!vitrinaRes.ok || !marcasRes.ok) {
      setError("No se pudo guardar.");
      return;
    }

    setSaved(true);
    router.refresh();
    onSaved?.();
  }

  // Subconjunto liviano para la vista previa — mismo criterio que ve la
  // audiencia real en /c/[slug]/page.tsx (visible y con al menos un
  // producto).
  const livePreviewCollections = collections
    .filter((c) => c.visible && c.items.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.map((it) => ({
        id: it.product.id,
        name: it.product.name,
        imageUrl: it.product.imageUrl,
        brandName: it.product.brand.companyName,
      })),
    }));

  const sectionClass = "rounded-2xl border border-brand-line bg-brand-surface p-5 sm:p-6";
  const stepTitle = (n: number, title: string, hint: string) => (
    <div className="mb-4">
      <h2 className="font-display font-semibold text-brand-ink flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-brand-accent text-white text-xs font-semibold flex items-center justify-center">
          {n}
        </span>
        {title}
      </h2>
      <p className="text-sm text-brand-ink-soft mt-1">{hint}</p>
    </div>
  );

  // Flujo en orden (2026-10-01, el anterior saltaba entre colecciones,
  // vista previa y marcas sin secuencia): el link arriba; luego 1 · Estilo
  // y 2 · Tus marcas, que se guardan juntos; luego 3 · Colecciones, que se
  // guardan cada una por su lado. La vista previa en vivo va al lado en
  // pantallas anchas (fija al hacer scroll) y al final en el celular. La
  // foto y el username ya no se piden acá: viven en "Tu perfil".
  return (
    <div className="space-y-6">
      {/* Link en un recuadro blanco tipo campo, texto oscuro y botones
          claros — antes era rosado sobre rosado y costaba leerlo
          (2026-10-01). */}
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 sm:p-6">
        <p className="text-sm font-semibold text-brand-ink">Tu link de vitrina</p>
        <p className="text-sm text-brand-ink-soft mt-0.5 mb-4">
          Ponlo en tu bio de Instagram o TikTok, en tus historias, por WhatsApp o correo.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0 rounded-xl border border-brand-line bg-brand-bg px-4 py-3">
            <span className="font-mono text-base sm:text-lg text-brand-ink font-medium break-all">{publicUrl}</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <CopyButton
              value={`https://${publicUrl}`}
              className="bg-brand-accent text-white rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90"
            />
            {/* publicUrl es siempre https:// (subdominio o /c/ en
                marcolini.lat, ver creatorVitrinaUrl). */}
            <a
              href={`https://${publicUrl}`}
              target="_blank"
              rel="noreferrer"
              className="border border-brand-line text-brand-ink rounded-full px-5 py-2.5 text-sm font-medium hover:bg-brand-accent-soft"
            >
              Ver vitrina
            </a>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_240px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className={sectionClass}>
              {stepTitle(1, "Estilo", "Los colores, la letra y los textos de tu vitrina.")}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-brand-ink mb-2">Paleta de colores</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STOREFRONT_PALETTES.map((p) => (
                      <button
                        type="button"
                        key={p.key}
                        onClick={() => setForm({ ...form, storefrontPalette: p.key })}
                        className={`rounded-xl border p-3 text-left ${
                          form.storefrontPalette === p.key
                            ? "border-brand-accent ring-2 ring-brand-accent"
                            : "border-brand-line"
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
                  <label className="block text-sm text-brand-ink mb-2">Letra</label>
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
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="block text-sm text-brand-ink">Título de tu vitrina (opcional)</label>
                    <span className="text-xs text-brand-ink-soft">{form.storefrontHeadline.length}/60</span>
                  </div>
                  <input
                    maxLength={60}
                    value={form.storefrontHeadline}
                    onChange={(e) => setForm({ ...form, storefrontHeadline: e.target.value })}
                    placeholder="ej. Mis descuentos favoritos ✨"
                    className="input"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="block text-sm text-brand-ink">Descripción corta (opcional)</label>
                    <span className="text-xs text-brand-ink-soft">{form.bio.length}/160</span>
                  </div>
                  <textarea
                    maxLength={160}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    className="input min-h-20"
                  />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              {stepTitle(2, "Tus marcas", "Cuáles se ven en tu vitrina y en qué orden, de arriba hacia abajo.")}
              {items.length === 0 ? (
                <p className="text-sm text-brand-ink-soft">
                  Todavía no te has unido a ninguna marca.{" "}
                  <a href="/creador/marketplace" className="text-brand-accent font-medium hover:underline">
                    Ve al marketplace →
                  </a>
                </p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((it, i) => (
                    <div
                      key={it.id}
                      className={`flex items-center gap-3 rounded-xl border border-brand-line bg-brand-bg px-3 py-2 transition-opacity ${
                        it.visible ? "" : "opacity-50"
                      }`}
                    >
                      <div className="flex flex-col shrink-0 -space-y-0.5">
                        <button
                          type="button"
                          onClick={() => move(it.id, -1)}
                          disabled={i === 0}
                          aria-label="Subir"
                          className="text-brand-ink-soft disabled:opacity-20 hover:text-brand-accent leading-none"
                        >
                          ⌃
                        </button>
                        <button
                          type="button"
                          onClick={() => move(it.id, 1)}
                          disabled={i === items.length - 1}
                          aria-label="Bajar"
                          className="text-brand-ink-soft disabled:opacity-20 hover:text-brand-accent leading-none"
                        >
                          ⌄
                        </button>
                      </div>
                      {it.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- logo de la marca
                        <img src={it.logoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-brand-accent-soft text-brand-accent text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {it.brandName[0]?.toUpperCase()}
                        </div>
                      )}
                      <p className="text-sm text-brand-ink flex-1 truncate">{it.brandName}</p>
                      <button
                        type="button"
                        onClick={() => toggleVisible(it.id)}
                        aria-pressed={it.visible}
                        aria-label={it.visible ? "Ocultar de la vitrina" : "Mostrar en la vitrina"}
                        className="flex items-center gap-2 shrink-0"
                      >
                        <span className={`text-xs ${it.visible ? "text-brand-accent font-medium" : "text-brand-ink-soft"}`}>
                          {it.visible ? "Visible" : "Oculta"}
                        </span>
                        <span
                          className={`relative w-9 h-5 rounded-full transition-colors ${
                            it.visible ? "bg-brand-accent" : "bg-brand-line"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                              it.visible ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
              <div className="flex items-center gap-3 mt-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar estilo y marcas"}
                </button>
                {saved && !saving && <span className="text-xs text-green-700">Guardado ✓</span>}
              </div>
            </div>
          </form>

          <CollectionsManager
            collections={collections}
            stepNumber={3}
            startOpen={false}
          />
        </div>

        <div className="lg:sticky lg:top-6">
          <VitrinaLivePreview
            displayName={displayName}
            photoUrl={photoUrl}
            palette={form.storefrontPalette}
            font={form.storefrontFont}
            headline={form.storefrontHeadline}
            bio={form.bio}
            items={items}
            collections={livePreviewCollections}
          />
        </div>
      </div>
    </div>
  );
}
