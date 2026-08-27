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
  // Forma completa — CollectionsManager (que se edita acá mismo, al lado de
  // la vista previa) la necesita entera; para la vista previa se manda solo
  // el subconjunto liviano que le hace falta (ver livePreviewCollections
  // más abajo).
  collections?: Collection[];
  publicUrl: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [items, setItems] = useState<EnrollmentItem[]>(enrollments);
  const [name, setName] = useState(displayName);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(photoUrl);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);

    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/creador/perfil/subir", {
      method: "POST",
      body,
    });
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

    const [vitrinaRes, marcasRes, perfilRes] = await Promise.all([
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
      fetch("/api/creador/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      }),
    ]);

    setSaving(false);

    if (!vitrinaRes.ok || !marcasRes.ok || !perfilRes.ok) {
      setError("No se pudo guardar.");
      return;
    }

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

  return (
    <div className="grid lg:grid-cols-[1fr_240px] gap-8 items-start max-w-4xl">
      {/* La vista previa (columna derecha, sticky) queda pegada durante todo
          — tanto el form de acá como CollectionsManager más abajo son
          hermanos dentro de esta misma celda, así que nunca se pierde de
          vista mientras se arma una colección. CollectionsManager va A
          PROPÓSITO fuera del <form>: sus propios botones (sin type="button"
          en algunos casos) no deben poder disparar el submit de este form. */}
      <div className="space-y-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="rounded-2xl border-2 border-brand-accent bg-brand-accent-soft p-5">
            <p className="text-sm font-medium text-brand-ink mb-1">
              Tu link de vitrina personalizado — ponlo en tu bio de Instagram o
              TikTok, en tus historias, por WhatsApp o correo — donde sea que
              esté tu audiencia
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-mono text-brand-accent text-lg">
                {publicUrl}
              </span>
              <CopyButton value={`https://${publicUrl}`} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-brand-ink mb-2">
              Foto de perfil
            </label>
            <div className="flex items-center gap-3">
              {currentPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto subida por el creador
                <img
                  src={currentPhotoUrl}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover border border-brand-line shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-brand-accent-soft shrink-0" />
              )}
              <label className="text-xs border border-brand-line rounded-full px-4 py-1.5 cursor-pointer hover:bg-brand-accent-soft shrink-0">
                {uploadingPhoto ? "Subiendo..." : "Cambiar foto"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoChange}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-brand-ink mb-2">
              Username
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. dani15"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-ink mb-2">
              Paleta de colores
            </label>
            <div className="grid grid-cols-3 gap-2">
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
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ background: p.accent }}
                    />
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ background: p.accentSoft }}
                    />
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={{ color: p.ink }}
                  >
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
            <div className="flex items-baseline justify-between mb-1">
              <label className="block text-sm text-brand-ink">
                Título de tu vitrina (opcional)
              </label>
              <span className="text-xs text-brand-ink-soft">
                {form.storefrontHeadline.length}/60
              </span>
            </div>
            <input
              maxLength={60}
              value={form.storefrontHeadline}
              onChange={(e) =>
                setForm({ ...form, storefrontHeadline: e.target.value })
              }
              placeholder="ej. Mis descuentos favoritos ✨"
              className="input"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="block text-sm text-brand-ink">
                Descripción corta (opcional)
              </label>
              <span className="text-xs text-brand-ink-soft">
                {form.bio.length}/160
              </span>
            </div>
            <textarea
              maxLength={160}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="input min-h-20"
            />
          </div>

          {items.length > 0 && (
            <div>
              <label className="block text-sm text-brand-ink mb-1">
                Qué marcas se ven, y en qué orden
              </label>
              <p className="text-xs text-brand-ink-soft mb-2">
                Así aparecen en tu vitrina, de arriba hacia abajo.
              </p>
              <div className="space-y-1.5">
                {items.map((it, i) => (
                  <div
                    key={it.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-opacity ${
                      it.visible
                        ? "border-brand-line bg-brand-surface"
                        : "border-brand-line bg-brand-surface opacity-50"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-brand-ink-soft w-4 text-center shrink-0">
                      {i + 1}
                    </span>
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
                      <img
                        src={it.logoUrl}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-brand-accent-soft text-brand-accent text-[11px] font-semibold flex items-center justify-center shrink-0">
                        {it.brandName[0]?.toUpperCase()}
                      </div>
                    )}
                    <p className="text-sm text-brand-ink flex-1 truncate">
                      {it.brandName}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleVisible(it.id)}
                      aria-pressed={it.visible}
                      aria-label={
                        it.visible
                          ? "Ocultar de la vitrina"
                          : "Mostrar en la vitrina"
                      }
                      className="flex items-center gap-2 shrink-0"
                    >
                      {/* Texto explícito además del switch — un switch solo
                          (rosado = on para las tres marcas por defecto) no
                          se lee de un vistazo como control de mostrar/ocultar;
                          el texto es el mismo "visible"/"oculta" que ya usa
                          Tus colecciones más abajo, para no inventar un
                          segundo lenguaje en la misma pantalla. */}
                      <span
                        className={`text-xs ${it.visible ? "text-brand-accent font-medium" : "text-brand-ink-soft"}`}
                      >
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
            <a
              href={`/c/${publicUrl.split("/").pop()}`}
              target="_blank"
              className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline"
            >
              Ver vitrina completa →
            </a>
          </div>
        </form>

        <CollectionsManager collections={collections} />
      </div>

      <VitrinaLivePreview
        displayName={name}
        photoUrl={currentPhotoUrl}
        palette={form.storefrontPalette}
        font={form.storefrontFont}
        headline={form.storefrontHeadline}
        bio={form.bio}
        items={items}
        collections={livePreviewCollections}
      />
    </div>
  );
}
