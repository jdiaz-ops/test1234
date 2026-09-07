"use client";

import { useState } from "react";
import { STOREFRONT_TEMPLATE_OPTIONS, type StorefrontTemplateKey } from "@/components/storefront/catalog-templates";

/// Mini-preview dibujado a mano (sin capturas de pantalla reales) — solo
/// para que la marca reconozca la forma del layout de un vistazo: grid
/// parejo, lista, o hero + grid chico.
function TemplatePreview({ template }: { template: StorefrontTemplateKey }) {
  if (template === "CLASICA") {
    return (
      <div className="grid grid-cols-3 gap-1 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded bg-brand-accent-soft" />
        ))}
      </div>
    );
  }
  if (template === "MINIMAL") {
    return (
      <div className="p-2 space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-brand-accent-soft shrink-0" />
            <div className="h-1.5 flex-1 rounded-full bg-brand-line" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="p-2 space-y-1.5">
      <div className="w-full h-8 rounded bg-brand-accent-soft" />
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square rounded bg-brand-accent-soft/60" />
        ))}
      </div>
    </div>
  );
}

export function StorefrontTemplateForm({
  initialTemplate,
}: {
  initialTemplate: string;
}) {
  const [selected, setSelected] = useState(initialTemplate);
  const [saving, setSaving] = useState<string | null>(null);

  async function select(template: StorefrontTemplateKey) {
    if (template === selected) return;
    setSaving(template);
    try {
      const res = await fetch("/api/marca/tienda/plantilla", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (res.ok) setSelected(template);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mt-6">
      <p className="text-sm font-medium text-brand-ink mb-1">
        Plantilla de tu catálogo
      </p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Cómo se ven tus productos en la página principal de tu tienda — no
        es solo color, cambia la estructura.
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        {STOREFRONT_TEMPLATE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => select(opt.key)}
            disabled={saving != null}
            className={`text-left rounded-xl border overflow-hidden disabled:opacity-60 ${
              selected === opt.key
                ? "border-brand-accent ring-1 ring-brand-accent"
                : "border-brand-line hover:border-brand-accent"
            }`}
          >
            <div className="bg-brand-bg">
              <TemplatePreview template={opt.key} />
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-brand-ink">
                {opt.label}
                {selected === opt.key && (
                  <span className="ml-2 text-[10px] font-mono text-brand-accent">
                    ACTUAL
                  </span>
                )}
              </p>
              <p className="text-xs text-brand-ink-soft mt-0.5">
                {opt.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
