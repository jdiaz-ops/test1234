"use client";

import { useState } from "react";
import { PriceInput } from "@/components/portal/price-input";

/// Edita lo que el CRM de "Mi tienda" guarda a mano sobre un cliente —
/// las estadísticas (pedidos, gastado) se calculan solas de sus compras,
/// esto es lo demás: suscripción, etiquetas, notas, crédito en tienda.
/// Ver conversación del 2026-09-14 (captura de referencia de Shopify).
export function StoreCustomerEditor({
  email,
  initialEmailSubscribed,
  initialTags,
  initialNotes,
  initialStoreCreditCents,
}: {
  email: string;
  initialEmailSubscribed: boolean;
  initialTags: string[];
  initialNotes: string | null;
  initialStoreCreditCents: number;
}) {
  const [emailSubscribed, setEmailSubscribed] = useState(initialEmailSubscribed);
  const [tags, setTags] = useState(initialTags);
  const [newTag, setNewTag] = useState("");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [storeCreditCOP, setStoreCreditCOP] = useState<number | null>(
    initialStoreCreditCents > 0 ? initialStoreCreditCents / 100 : null,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/marca/tienda/clientes/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      setSaved(true);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    const next = [...tags, trimmed];
    setTags(next);
    setNewTag("");
    save({ tags: next });
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    save({ tags: next });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
        <label className="flex items-center gap-2 text-sm text-brand-ink">
          <input
            type="checkbox"
            checked={emailSubscribed}
            onChange={(e) => {
              setEmailSubscribed(e.target.checked);
              save({ emailSubscribed: e.target.checked });
            }}
          />
          Suscrito a novedades por correo
        </label>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
        <p className="text-sm font-medium text-brand-ink mb-2">Etiquetas</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 text-xs bg-brand-bg border border-brand-line rounded-full pl-3 pr-1.5 py-1"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="w-4 h-4 rounded-full hover:bg-brand-line flex items-center justify-center"
                  aria-label={`Quitar ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Ej. VIP, Mayorista"
            className="input text-sm flex-1"
          />
          <button
            type="button"
            onClick={addTag}
            className="text-xs border border-brand-line rounded-full px-4 py-2 hover:bg-brand-accent-soft shrink-0"
          >
            Agregar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
        <p className="text-sm font-medium text-brand-ink mb-2">
          Crédito en tienda
        </p>
        <PriceInput
          value={storeCreditCOP}
          onChange={(v) => setStoreCreditCOP(v)}
          className="max-w-[200px]"
        />
        <button
          type="button"
          onClick={() => save({ storeCreditCents: Math.round((storeCreditCOP ?? 0) * 100) })}
          className="mt-2 text-xs text-brand-accent font-medium hover:underline"
        >
          Guardar crédito
        </button>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
        <p className="text-sm font-medium text-brand-ink mb-2">Notas</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
          placeholder="Solo tú ves estas notas."
          className="input text-sm min-h-24"
        />
        <button
          type="button"
          onClick={() => save({ notes })}
          className="mt-2 text-xs text-brand-accent font-medium hover:underline"
        >
          Guardar nota
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saving && <p className="text-xs text-brand-ink-soft">Guardando...</p>}
      {!saving && saved && (
        <p className="text-xs text-brand-ink-soft">Guardado ✓</p>
      )}
    </div>
  );
}
