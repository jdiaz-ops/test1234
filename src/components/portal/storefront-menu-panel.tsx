"use client";

import { useState } from "react";
import { MENU_MAX_DEPTH } from "@/lib/menu-tree";
import { MenuImportTool } from "@/components/portal/menu-import-tool";

export type StorefrontMenuItemRow = {
  id: string;
  label: string;
  url: string;
  /// null = nivel de arriba; un ítem puede colgar de otro (submenú).
  parentId: string | null;
};

/// Diseño → Menú: el menú de la vitrina como árbol de hasta tres
/// niveles (ítem, submenú, sub-submenú), como lo trae la importación de
/// la tienda original. Un ítem con link "#" no lleva a ningún lado: solo
/// abre su submenú. Ver conversación del 2026-10-18 (el menú de Rumi).

function ItemForm({
  initialLabel,
  initialUrl,
  saving,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialLabel: string;
  initialUrl: string;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (label: string, url: string) => void;
  onCancel?: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [url, setUrl] = useState(initialUrl);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nombre (ej. Sobre nosotros)" className="input text-sm" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (ej. /coleccion/esmaltes, o # si solo abre el submenú)" className="input text-sm" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onSubmit(label, url)}
          disabled={saving || !label.trim() || !url.trim()}
          className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs text-brand-ink-soft hover:underline">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function MenuItemRow({
  item,
  depth,
  siblings,
  allItems,
  onUpdated,
  onDeleted,
  onMove,
  onCreated,
}: {
  item: StorefrontMenuItemRow;
  depth: number;
  siblings: StorefrontMenuItemRow[];
  allItems: StorefrontMenuItemRow[];
  onUpdated: (i: StorefrontMenuItemRow) => void;
  onDeleted: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onCreated: (i: StorefrontMenuItemRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const index = siblings.findIndex((s) => s.id === item.id);
  const children = allItems.filter((i) => i.parentId === item.id);
  const canAddChild = depth < MENU_MAX_DEPTH - 1;

  async function handleSave(label: string, url: string) {
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
      onUpdated({ ...item, label: body.item.label, url: body.item.url });
      setEditing(false);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddChild(label: string, url: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url, parentId: item.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo agregar el subítem.");
        return;
      }
      onCreated({ id: body.item.id, label: body.item.label, url: body.item.url, parentId: item.id });
      setAdding(false);
    } catch {
      setError("No se pudo agregar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const warn = children.length > 0 ? ` Se van también sus ${children.length} subítems.` : "";
    if (!window.confirm(`¿Quitar este ítem del menú?${warn}`)) return;
    setDeleting(true);
    const res = await fetch(`/api/marca/tienda/menu/${item.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) onDeleted(item.id);
  }

  return (
    <div className={depth > 0 ? "pl-4 border-l-2 border-brand-line" : undefined}>
      <div className="rounded-xl border border-brand-line bg-brand-surface p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex flex-col shrink-0">
              <button
                type="button"
                onClick={() => onMove(item.id, "up")}
                disabled={index <= 0}
                className="text-brand-ink-soft hover:text-brand-ink disabled:opacity-20 text-xs leading-none"
                aria-label="Subir"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onMove(item.id, "down")}
                disabled={index >= siblings.length - 1}
                className="text-brand-ink-soft hover:text-brand-ink disabled:opacity-20 text-xs leading-none"
                aria-label="Bajar"
              >
                ▼
              </button>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-ink truncate">
                {item.label}
                {children.length > 0 && <span className="ml-2 text-xs font-normal text-brand-ink-soft">({children.length} en el submenú)</span>}
              </p>
              <p className="text-xs text-brand-ink-soft font-mono truncate">{item.url === "#" ? "sin link — solo abre el submenú" : item.url}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {canAddChild && (
              <button type="button" onClick={() => setAdding((v) => !v)} className="text-xs text-brand-accent hover:underline">
                {adding ? "Cerrar" : "+ Subítem"}
              </button>
            )}
            <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs text-brand-accent hover:underline">
              {editing ? "Cerrar" : "Editar"}
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="text-xs text-red-600 hover:underline disabled:opacity-50">
              {deleting ? "..." : "Quitar"}
            </button>
          </div>
        </div>
        {editing && (
          <ItemForm key={`edit-${item.id}`} initialLabel={item.label} initialUrl={item.url} saving={saving} error={error} submitLabel="Guardar" onSubmit={handleSave} />
        )}
        {adding && (
          <div className="rounded-lg border border-dashed border-brand-line p-3">
            <p className="text-xs text-brand-ink-soft mb-2">Nuevo subítem de «{item.label}»</p>
            <ItemForm key={`add-${item.id}`} initialLabel="" initialUrl="" saving={saving} error={error} submitLabel="Agregar subítem" onSubmit={handleAddChild} onCancel={() => setAdding(false)} />
          </div>
        )}
      </div>
      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map((child) => (
            <MenuItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              siblings={children}
              allItems={allItems}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onMove={onMove}
              onCreated={onCreated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StorefrontMenuPanel({
  initialItems,
  importTools = false,
  storeUrl = null,
}: {
  initialItems: StorefrontMenuItemRow[];
  /// "Traer el menú de la tienda original": solo para el admin con
  /// "Entrar como" (ver isAdminActingAsBrand).
  importTools?: boolean;
  /// El link de la tienda original, si se conoce, para no tener que pegarlo.
  storeUrl?: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  // Después de traer el menú de la tienda original, se vuelve a leer completo.
  async function reload() {
    const res = await fetch("/api/marca/tienda/menu");
    const body = await res.json();
    if (res.ok && Array.isArray(body.items)) {
      setItems(body.items.map((i: { id: string; label: string; url: string; parentId?: string | null }) => ({ id: i.id, label: i.label, url: i.url, parentId: i.parentId ?? null })));
    }
  }
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topLevel = items.filter((i) => !i.parentId);

  async function handleCreate(label: string, url: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo agregar el ítem.");
        return;
      }
      setItems((prev) => [...prev, { id: body.item.id, label: body.item.label, url: body.item.url, parentId: null }]);
      setCreating(false);
    } catch {
      setError("No se pudo agregar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  /// Sube o baja un ítem entre sus hermanos (mismo padre) y guarda el
  /// orden de ese grupo.
  async function move(id: string, dir: "up" | "down") {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const siblings = items.filter((i) => (i.parentId ?? null) === (item.parentId ?? null));
    const index = siblings.findIndex((i) => i.id === id);
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= siblings.length) return;
    const order = [...siblings];
    [order[index], order[target]] = [order[target], order[index]];
    const orderIds = order.map((i) => i.id);
    // Los hermanos quedan en el orden nuevo; los demás, donde estaban.
    setItems((prev) => {
      const rest = prev.filter((i) => !orderIds.includes(i.id));
      const firstAt = prev.findIndex((i) => orderIds.includes(i.id));
      return [...rest.slice(0, firstAt), ...order, ...rest.slice(firstAt)];
    });
    await fetch("/api/marca/tienda/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: orderIds }),
    });
  }

  function removeWithChildren(prev: StorefrontMenuItemRow[], id: string): StorefrontMenuItemRow[] {
    const gone = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const i of prev) if (i.parentId && gone.has(i.parentId) && !gone.has(i.id)) { gone.add(i.id); changed = true; }
    }
    return prev.filter((i) => !gone.has(i.id));
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <p className="text-sm font-medium text-brand-ink mb-1">Menú de navegación</p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Lo que ve el comprador en el menú de tu tienda — enlaza tus páginas, colecciones o cualquier link externo (ej. tu
        Instagram). Con &quot;+ Subítem&quot; armas submenús de hasta tres niveles: en computadora se abren al pasar el mouse
        y en celular dentro del panel del menú. Un ítem que lleva a un producto agotado o a una colección sin productos
        disponibles se esconde solo en la tienda (a menos que en Diseño → Página de colecciones muestres los agotados); acá
        se sigue viendo para que no lo pierdas.
      </p>

      {importTools && <MenuImportTool defaultUrl={storeUrl ?? ""} onApplied={reload} />}

      {topLevel.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-4">Todavía no agregas ningún ítem al menú.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {topLevel.map((item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              depth={0}
              siblings={topLevel}
              allItems={items}
              onUpdated={(updated) => setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
              onDeleted={(id) => setItems((prev) => removeWithChildren(prev, id))}
              onMove={move}
              onCreated={(created) => setItems((prev) => [...prev, created])}
            />
          ))}
        </div>
      )}

      {creating ? (
        <div className="rounded-xl border border-brand-line p-3">
          <ItemForm initialLabel="" initialUrl="" saving={saving} error={error} submitLabel="Agregar ítem" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="text-sm text-brand-accent font-medium hover:underline">
          + Agregar ítem
        </button>
      )}
    </div>
  );
}
