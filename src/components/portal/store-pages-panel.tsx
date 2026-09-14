"use client";

import { useState } from "react";

export type StorePageRow = {
  id: string;
  title: string;
  slug: string;
  body: string;
};

function PageCard({
  page,
  onUpdated,
  onDeleted,
  onMove,
  isFirst,
  isLast,
}: {
  page: StorePageRow;
  onUpdated: (p: StorePageRow) => void;
  onDeleted: () => void;
  onMove: (dir: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/marca/tienda/paginas/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const responseBody = await res.json().catch(() => null);
      if (!res.ok) {
        setError(responseBody?.error ?? "No se pudo guardar.");
        return;
      }
      onUpdated(responseBody.page);
      setEditing(false);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("¿Eliminar esta página? No se puede deshacer.")) return;
    setDeleting(true);
    const res = await fetch(`/api/marca/tienda/paginas/${page.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) onDeleted();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 space-y-3">
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
            <p className="text-sm font-medium text-brand-ink truncate">{page.title}</p>
            <p className="text-xs text-brand-ink-soft font-mono truncate">
              /pagina/{page.slug}
            </p>
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
            {deleting ? "..." : "Eliminar"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="space-y-2 pt-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className="input text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Contenido de la página"
            className="input text-sm min-h-32"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

export function StorePagesPanel({ initialPages }: { initialPages: StorePageRow[] }) {
  const [pages, setPages] = useState(initialPages);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/paginas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, body: newBody }),
      });
      const responseBody = await res.json().catch(() => null);
      if (!res.ok) {
        setError(responseBody?.error ?? "No se pudo crear la página.");
        return;
      }
      setPages((prev) => [...prev, responseBody.page]);
      setNewTitle("");
      setNewBody("");
      setCreating(false);
    } catch {
      setError("No se pudo crear — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, dir: "up" | "down") {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    setPages(next);
    await fetch("/api/marca/tienda/paginas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((p) => p.id) }),
    });
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <p className="text-sm font-medium text-brand-ink mb-1">Páginas</p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Páginas propias de tu tienda — &ldquo;Sobre nosotros&rdquo;, preguntas
        frecuentes, política de cambios... Enlázalas desde Diseño →
        &ldquo;Menú de navegación&rdquo; para que se vean.
      </p>

      {pages.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-4">
          Todavía no creas ninguna página.
        </p>
      ) : (
        <div className="space-y-3 mb-4">
          {pages.map((p, i) => (
            <PageCard
              key={p.id}
              page={p}
              isFirst={i === 0}
              isLast={i === pages.length - 1}
              onMove={(dir) => move(i, dir)}
              onUpdated={(updated) =>
                setPages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
              }
              onDeleted={() => setPages((prev) => prev.filter((x) => x.id !== p.id))}
            />
          ))}
        </div>
      )}

      {creating ? (
        <div className="rounded-xl border border-brand-line p-3 space-y-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título (ej. Sobre nosotros)"
            className="input text-sm"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Contenido de la página"
            className="input text-sm min-h-32"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || newTitle.trim().length < 2}
              className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Creando..." : "Crear página"}
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
          + Agregar página
        </button>
      )}
    </div>
  );
}
