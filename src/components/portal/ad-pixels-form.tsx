"use client";

import { useState } from "react";

/// Configuración → Píxeles de anuncios. La marca pega su Pixel ID (o el
/// código completo; el servidor saca el número) y su tienda queda conectada
/// a Meta / TikTok. Ver lib/ad-pixels.ts. Solo los tres campos, sin textos
/// de ayuda (pedido del 2026-10-19: "aquí va Meta, aquí va TikTok, aquí va
/// Google. Sencillo").
export function AdPixelsForm({
  initialMetaPixelId,
  initialTiktokPixelId,
  initialGoogleAnalyticsId = "",
}: {
  initialMetaPixelId: string;
  initialTiktokPixelId: string;
  initialGoogleAnalyticsId?: string;
}) {
  const [meta, setMeta] = useState(initialMetaPixelId);
  const [tiktok, setTiktok] = useState(initialTiktokPixelId);
  const [ga, setGa] = useState(initialGoogleAnalyticsId);
  const [saved, setSaved] = useState({ meta: initialMetaPixelId, tiktok: initialTiktokPixelId, ga: initialGoogleAnalyticsId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = meta.trim() !== saved.meta || tiktok.trim() !== saved.tiktok || ga.trim() !== saved.ga;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const res = await fetch("/api/marca/tienda/pixeles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaPixelId: meta, tiktokPixelId: tiktok, googleAnalyticsId: ga }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      const next = { meta: body.metaPixelId ?? "", tiktok: body.tiktokPixelId ?? "", ga: body.googleAnalyticsId ?? "" };
      setSaved(next);
      setMeta(next.meta);
      setTiktok(next.tiktok);
      setGa(next.ga);
      setJustSaved(true);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6 max-w-2xl">
      <PixelField
        label="Pixel de Meta (Facebook e Instagram)"
        value={meta}
        onChange={setMeta}
        active={!!saved.meta}
        placeholder="Ej. 1234567890123456"
      />

      <PixelField
        label="Pixel de TikTok"
        value={tiktok}
        onChange={setTiktok}
        active={!!saved.tiktok}
        placeholder="Ej. CABC123DEF456GHI789J0"
      />

      <PixelField
        label="Google Analytics 4"
        value={ga}
        onChange={setGa}
        active={!!saved.ga}
        placeholder="Ej. G-ABC123XYZ"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {justSaved && !dirty && <span className="text-sm text-brand-accent">Guardado ✓</span>}
      </div>
    </form>
  );
}

function PixelField({
  label,
  value,
  onChange,
  active,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  active: boolean;
  placeholder: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-medium text-brand-ink">{label}</label>
        {active && (
          <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-brand-accent-soft text-brand-accent">
            ACTIVO
          </span>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="input text-sm font-mono"
      />
    </div>
  );
}
