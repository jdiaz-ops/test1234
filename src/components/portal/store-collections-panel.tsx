"use client";

import { useEffect, useState } from "react";

export type BrandCollectionRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

type ProductOption = { id: string; name: string; imageUrl: string | null };

/// Selector de productos para meter en una colección — busca entre los
/// productos manuales de la marca y marca cuáles quedan incluidos. Mismo
/// espíritu que el modal "Selecciona productos para incluir" de Shopify,
/// simplificado a una lista con checkboxes (sin modal aparte).
function ProductPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [products, setProducts] = useState<ProductOption[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/marca/tienda/productos")
      .then((r) => r.json())
      .then((body) =>
        setProducts(
          (body.products ?? []).map((p: { id: string; name: string; imageUrl: string | null }) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
          })),
        ),
      )
      .catch(() => setProducts([]));
  }, []);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  }

  const filtered = (products ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="rounded-xl border border-brand-line overflow-hidden">
      <div className="p-2 border-b border-brand-line">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar productos"
          className="input text-sm"
        />
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-brand-line">
        {products === null ? (
          <p className="text-xs text-brand-ink-soft p-3">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-brand-ink-soft p-3">Sin productos.</p>
        ) : (
          filtered.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-brand-bg"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={() => toggle(p.id)}
              />
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-brand-bg shrink-0" />
              )}
              <span className="text-brand-ink truncate">{p.name}</span>
            </label>
          ))
        )}
      </div>
      <p className="text-[11px] text-brand-ink-soft px-3 py-1.5 bg-brand-bg">
        {selectedIds.length} producto{selectedIds.length === 1 ? "" : "s"} en la colección
      </p>
    </div>
  );
}

function CollectionForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    productIds: string[];
  };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [productIds, setProductIds] = useState<string[]>(initial?.productIds ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (res.ok && body?.url) setImageUrl(body.url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Ingresa un nombre para la colección.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        initial ? `/api/marca/tienda/colecciones/${initial.id}` : "/api/marca/tienda/colecciones",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, imageUrl, productIds }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar la colección.");
        return;
      }
      onSaved();
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-brand-line bg-brand-surface p-5"
    >
      <div>
        <label className="block text-sm text-brand-ink mb-1">Nombre</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Verano 2026"
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">
          Descripción (opcional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          className="input min-h-20"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">
          Imagen de portada (opcional)
        </label>
        <div className="flex items-center gap-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-brand-line" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-brand-bg border border-dashed border-brand-line" />
          )}
          <label className="text-xs border border-brand-line rounded-full px-3 py-2 hover:bg-brand-accent-soft cursor-pointer">
            {uploading ? "Subiendo..." : imageUrl ? "Cambiar" : "Subir imagen"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleImage(e.target.files?.[0])}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Productos</label>
        <ProductPicker selectedIds={productIds} onChange={setProductIds} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar colección"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-brand-ink-soft hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function StoreCollectionsPanel({
  initialCollections,
}: {
  initialCollections: BrandCollectionRow[];
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [mode, setMode] = useState<
    | { kind: "list" }
    | { kind: "create" }
    | { kind: "edit"; id: string }
  >({ kind: "list" });
  const [editData, setEditData] = useState<{
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    productIds: string[];
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/marca/tienda/colecciones");
    const body = await res.json().catch(() => null);
    if (body?.collections) setCollections(body.collections);
  }

  async function openEdit(id: string) {
    setEditData(null);
    setMode({ kind: "edit", id });
    const res = await fetch(`/api/marca/tienda/colecciones/${id}`);
    const body = await res.json().catch(() => null);
    if (body?.collection) {
      setEditData({
        id: body.collection.id,
        name: body.collection.name,
        description: body.collection.description,
        imageUrl: body.collection.imageUrl,
        productIds: body.collection.products.map((p: { productId: string }) => p.productId),
      });
    }
  }

  function backToList() {
    setMode({ kind: "list" });
    setEditData(null);
    refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta colección? No se puede deshacer.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/marca/tienda/colecciones/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo eliminar.");
        return;
      }
      setCollections((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("No se pudo eliminar — revisa tu conexión.");
    } finally {
      setDeletingId(null);
    }
  }

  if (mode.kind === "create") {
    return <CollectionForm onSaved={backToList} onCancel={backToList} />;
  }
  if (mode.kind === "edit") {
    if (!editData) return <p className="text-sm text-brand-ink-soft">Cargando...</p>;
    return <CollectionForm initial={editData} onSaved={backToList} onCancel={backToList} />;
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setMode({ kind: "create" })}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
      >
        + Nueva colección
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {collections.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no tienes colecciones — agrúpalas por temporada, tipo de
          producto, lo que te sirva para organizar tu catálogo.
        </p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden divide-y divide-brand-line">
          {collections.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-4">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-brand-bg shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-ink truncate">{c.name}</p>
                <p className="text-xs text-brand-ink-soft">
                  {c.productCount} producto{c.productCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(c.id)}
                  className="text-xs text-brand-accent hover:underline"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  {deletingId === c.id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

