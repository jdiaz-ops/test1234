"use client";

import { useState } from "react";

export type BrandCollectionOption = { id: string; name: string };

/// Multi-select de colecciones propias de la marca, con creación rápida
/// inline (sin salir del formulario de producto) — mismo patrón que el
/// "Agregar colecciones" de Shopify, simplificado.
export function ProductCollectionsPicker({
  allCollections,
  onAllCollectionsChange,
  selectedIds,
  onChange,
}: {
  allCollections: BrandCollectionOption[];
  onAllCollectionsChange: (next: BrandCollectionOption[]) => void;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  }

  async function createCollection() {
    if (newName.trim().length < 2) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/colecciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo crear la colección.");
        return;
      }
      onAllCollectionsChange([...allCollections, body.collection]);
      onChange([...selectedIds, body.collection.id]);
      setNewName("");
    } catch {
      setError("No se pudo crear — revisa tu conexión.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {allCollections.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {allCollections.map((c) => {
            const active = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`text-sm rounded-full px-3 py-1.5 border ${
                  active
                    ? "bg-brand-accent text-white border-brand-accent"
                    : "border-brand-line text-brand-ink-soft hover:bg-brand-accent-soft"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createCollection();
            }
          }}
          placeholder="Nueva colección (ej. Verano 2026)"
          className="input text-sm flex-1"
        />
        <button
          type="button"
          onClick={createCollection}
          disabled={creating || newName.trim().length < 2}
          className="text-xs border border-brand-line rounded-full px-4 py-2 hover:bg-brand-accent-soft disabled:opacity-50 shrink-0"
        >
          {creating ? "Creando..." : "Crear"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
