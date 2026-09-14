"use client";

import { useState } from "react";

export type StorefrontMenuItemRow = {
  id: string;
  label: string;
  url: string;
};

function MenuItemRow({
  item,
  onUpdated,
  onDeleted,
  onMove,
  isFirst,
  isLast,
}: {
  item: StorefrontMenuItemRow;
  onUpdated: (i: StorefrontMenuItemRow) => void;
  onDeleted: () => void;
  onMove: (dir: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/marca/tienda/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      onUpdated(body.item);
      setEditing(false);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("¿Quitar este ítem del menú?")) return;
    setDeleting(true);
    const res = await fetch(`/api/marca/tienda/menu/${item.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) onDeleted();
  }

  return (
    <div className="rounded-xl border border-brand-line bg-brand-surface p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex flex-col shrink-0">
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
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-ink truncate">{item.label}</p>
            <p className="text-xs text-brand-ink-soft font-mono truncate">{item.url}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-brand-accent hover:underline"
          >
            {editing ? "Cerrar" : "Editar"}
          </button>
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
      {editing && (
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre (ej. Sobre nosotros)"
            className="input text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (ej. /pagina/sobre-nosotros)"
            className="input text-sm"
          />
          {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 sm:col-span-2 w-fit"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

export function StorefrontMenuPanel({
  initialItems,
}: {
  initialItems: StorefrontMenuItemRow[];
}) {
  const [items, setItems] = useState(initialItems);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel, url: newUrl }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo agregar el ítem.");
        return;
      }
      setItems((prev) => [...prev, body.item]);
      setNewLabel("");
      setNewUrl("");
      setCreating(false);
    } catch {
      setError("No se pudo agregar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, dir: "up" | "down") {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await fetch("/api/marca/tienda/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((i) => i.id) }),
    });
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mt-6">
      <p className="text-sm font-medium text-brand-ink mb-1">
        Menú de navegación
      </p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Lo que ve el comprador en el menú de tu tienda — enlaza tus páginas,
        colecciones, o cualquier link externo (ej. tu Instagram).
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-4">
          Todavía no agregas ningún ítem al menú.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {items.map((item, i) => (
            <MenuItemRow
              key={item.id}
              item={item}
              isFirst={i === 0}
              isLast={i === items.length - 1}
              onMove={(dir) => move(i, dir)}
              onUpdated={(updated) =>
                setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
              }
              onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
            />
          ))}
        </div>
      )}

      {creating ? (
        <div className="rounded-xl border border-brand-line p-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nombre (ej. Sobre nosotros)"
              className="input text-sm"
            />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Link (ej. /pagina/sobre-nosotros)"
              className="input text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !newLabel.trim() || !newUrl.trim()}
              className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Agregando..." : "Agregar ítem"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-xs text-brand-ink-soft hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-sm text-brand-accent font-medium hover:underline"
        >
          + Agregar ítem
        </button>
      )}
    </div>
  );
}
