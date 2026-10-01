"use client";

import { useState } from "react";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";
import {
  CollectionProductsEditor,
  type CollectionSortOrder,
} from "@/components/portal/collection-products-editor";

export type BrandCollectionRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

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
    sortOrder: CollectionSortOrder;
  };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [productIds, setProductIds] = useState<string[]>(initial?.productIds ?? []);
  const [sortOrder, setSortOrder] = useState<CollectionSortOrder>(initial?.sortOrder ?? "MANUAL");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", await prepareImageForUpload(file));
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
          body: JSON.stringify({ name, description, imageUrl, productIds, sortOrder }),
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
        <CollectionProductsEditor
          productIds={productIds}
          onChange={setProductIds}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />
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

/// El link público de la colección con botón para copiarlo — la marca
/// lo pega en Instagram, WhatsApp, el menú de la tienda, etc. Pedido
/// explícito: "de las colecciones no se ve la url de la colección para
/// poder copiarlas". Ver conversación del 2026-09-30.
function CollectionUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia el link:", url);
    }
  }

  return (
    <div className="flex items-center gap-2 min-w-0 mt-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] text-brand-ink-soft truncate hover:underline"
      >
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button
        type="button"
        onClick={copy}
        className="text-[11px] font-medium text-brand-accent hover:underline shrink-0"
      >
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}

export function StoreCollectionsPanel({
  initialCollections,
  storeUrl,
}: {
  initialCollections: BrandCollectionRow[];
  /// Dirección pública de la tienda (https://{slug}.marcolini.lat o el
  /// dominio propio) — null si la marca todavía no configuró su link.
  storeUrl: string | null;
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
    sortOrder: CollectionSortOrder;
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
        sortOrder: body.collection.sortOrder ?? "MANUAL",
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

      {!storeUrl && collections.length > 0 && (
        <p className="text-xs text-brand-ink-soft">
          Configura el link de tu tienda en Configuración para ver la URL de cada colección.
        </p>
      )}

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
                {storeUrl && <CollectionUrl url={`${storeUrl}/coleccion/${c.slug}`} />}
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

