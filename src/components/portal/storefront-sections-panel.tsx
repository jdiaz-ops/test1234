"use client";

import { useEffect, useState } from "react";
import {
  SECTION_TYPES,
  SECTION_TYPE_LABEL,
  SECTION_TYPE_DESCRIPTION,
  DEFAULT_SECTION_CONFIG,
  type SectionType,
  type BannerConfig,
  type FeaturedCollectionConfig,
  type TextConfig,
} from "@/lib/storefront-sections";

export type StorefrontSectionRow = {
  id: string;
  type: SectionType;
  enabled: boolean;
  config: unknown;
};

type CollectionOption = { id: string; name: string };

async function patchSection(id: string, body: unknown) {
  const res = await fetch(`/api/marca/tienda/secciones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function BannerFields({
  config,
  onChange,
}: {
  config: BannerConfig;
  onChange: (next: BannerConfig) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/marca/tienda/productos/imagen", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.url) onChange({ ...config, imageUrl: body.url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {config.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.imageUrl} alt="" className="w-24 h-14 rounded-lg object-cover border border-brand-line" />
        ) : (
          <div className="w-24 h-14 rounded-lg bg-brand-bg border border-dashed border-brand-line" />
        )}
        <label className="text-xs border border-brand-line rounded-full px-3 py-2 hover:bg-brand-accent-soft cursor-pointer">
          {uploading ? "Subiendo..." : config.imageUrl ? "Cambiar imagen" : "Subir imagen"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleImage(e.target.files?.[0])}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="Título"
          className="input text-sm"
        />
        <input
          value={config.subtitle}
          onChange={(e) => onChange({ ...config, subtitle: e.target.value })}
          placeholder="Subtítulo (opcional)"
          className="input text-sm"
        />
        <input
          value={config.buttonText}
          onChange={(e) => onChange({ ...config, buttonText: e.target.value })}
          placeholder="Texto del botón (opcional)"
          className="input text-sm"
        />
        <input
          value={config.buttonLink}
          onChange={(e) => onChange({ ...config, buttonLink: e.target.value })}
          placeholder="Link del botón (ej. /mi-producto)"
          className="input text-sm"
        />
      </div>
    </div>
  );
}

function FeaturedCollectionFields({
  config,
  onChange,
  collections,
}: {
  config: FeaturedCollectionConfig;
  onChange: (next: FeaturedCollectionConfig) => void;
  collections: CollectionOption[];
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <select
        value={config.collectionId ?? ""}
        onChange={(e) => onChange({ ...config, collectionId: e.target.value || null })}
        className="input text-sm"
      >
        <option value="">Elige una colección</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        value={config.title}
        onChange={(e) => onChange({ ...config, title: e.target.value })}
        placeholder="Título de la sección (opcional)"
        className="input text-sm"
      />
    </div>
  );
}

function TextFields({
  config,
  onChange,
}: {
  config: TextConfig;
  onChange: (next: TextConfig) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        value={config.heading}
        onChange={(e) => onChange({ ...config, heading: e.target.value })}
        placeholder="Título"
        className="input text-sm"
      />
      <textarea
        value={config.body}
        onChange={(e) => onChange({ ...config, body: e.target.value.slice(0, 2000) })}
        placeholder="Texto"
        className="input text-sm min-h-20"
      />
    </div>
  );
}

function SectionCard({
  section,
  collections,
  onUpdated,
  onDeleted,
  onMove,
  isFirst,
  isLast,
}: {
  section: StorefrontSectionRow;
  collections: CollectionOption[];
  onUpdated: (s: StorefrontSectionRow) => void;
  onDeleted: () => void;
  onMove: (dir: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [config, setConfig] = useState(section.config as Record<string, unknown>);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveConfig(next: Record<string, unknown>) {
    setConfig(next);
    setSaving(true);
    const ok = await patchSection(section.id, { config: next });
    setSaving(false);
    if (ok) onUpdated({ ...section, config: next });
  }

  async function toggleEnabled() {
    const ok = await patchSection(section.id, { enabled: !section.enabled });
    if (ok) onUpdated({ ...section, enabled: !section.enabled });
  }

  async function handleDelete() {
    if (!window.confirm("¿Quitar esta sección de tu vitrina?")) return;
    setDeleting(true);
    const res = await fetch(`/api/marca/tienda/secciones/${section.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) onDeleted();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => onMove("up")}
              disabled={isFirst}
              className="text-brand-ink-soft hover:text-brand-ink disabled:opacity-20 text-xs leading-none"
              aria-label="Subir"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => onMove("down")}
              disabled={isLast}
              className="text-brand-ink-soft hover:text-brand-ink disabled:opacity-20 text-xs leading-none"
              aria-label="Bajar"
            >
              ▼
            </button>
          </div>
          <span className="text-sm font-medium text-brand-ink">
            {SECTION_TYPE_LABEL[section.type]}
          </span>
          {saving && <span className="text-[10px] text-brand-ink-soft">guardando...</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-brand-ink-soft">
            <input type="checkbox" checked={section.enabled} onChange={toggleEnabled} />
            Visible
          </label>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            {deleting ? "..." : "Quitar"}
          </button>
        </div>
      </div>

      {section.type === "BANNER" && (
        <BannerFields config={config as unknown as BannerConfig} onChange={(c) => saveConfig(c)} />
      )}
      {section.type === "FEATURED_COLLECTION" && (
        <FeaturedCollectionFields
          config={config as unknown as FeaturedCollectionConfig}
          onChange={(c) => saveConfig(c)}
          collections={collections}
        />
      )}
      {section.type === "TEXT" && (
        <TextFields config={config as unknown as TextConfig} onChange={(c) => saveConfig(c)} />
      )}
    </div>
  );
}

export function StorefrontSectionsPanel({
  initialSections,
}: {
  initialSections: StorefrontSectionRow[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marca/tienda/colecciones")
      .then((r) => r.json())
      .then((body) =>
        setCollections((body.collections ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))),
      )
      .catch(() => {});
  }, []);

  async function addSection(type: SectionType) {
    setAdding(false);
    setError(null);
    const res = await fetch("/api/marca/tienda/secciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, config: DEFAULT_SECTION_CONFIG[type] }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "No se pudo agregar la sección.");
      return;
    }
    setSections((prev) => [...prev, body.section]);
  }

  async function move(index: number, dir: "up" | "down") {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    await fetch("/api/marca/tienda/secciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((s) => s.id) }),
    });
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <p className="text-sm font-medium text-brand-ink mb-1">
        Secciones de tu página de inicio
      </p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Arma tu página con secciones ya diseñadas — prende, apaga, reordena
        y llena el contenido, sin tocar código. Van encima de tu catálogo de
        productos.
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {sections.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-4">
          Todavía no agregas ninguna sección.
        </p>
      ) : (
        <div className="space-y-3 mb-4">
          {sections.map((s, i) => (
            <SectionCard
              key={s.id}
              section={s}
              collections={collections}
              isFirst={i === 0}
              isLast={i === sections.length - 1}
              onMove={(dir) => move(i, dir)}
              onUpdated={(updated) =>
                setSections((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
              onDeleted={() => setSections((prev) => prev.filter((p) => p.id !== s.id))}
            />
          ))}
        </div>
      )}

      {adding ? (
        <div className="rounded-xl border border-brand-line p-3 space-y-2">
          <p className="text-xs text-brand-ink-soft mb-1">Elige un tipo de sección:</p>
          {SECTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addSection(t)}
              className="w-full text-left rounded-lg border border-brand-line p-3 hover:border-brand-accent hover:bg-brand-accent-soft"
            >
              <p className="text-sm font-medium text-brand-ink">{SECTION_TYPE_LABEL[t]}</p>
              <p className="text-xs text-brand-ink-soft mt-0.5">
                {SECTION_TYPE_DESCRIPTION[t]}
              </p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-xs text-brand-ink-soft hover:underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-sm text-brand-accent font-medium hover:underline"
        >
          + Agregar sección
        </button>
      )}
    </div>
  );
}
