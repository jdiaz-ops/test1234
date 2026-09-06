"use client";

import { useState } from "react";

export type ManualProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  slug: string | null;
  stock: number | null;
  available: boolean;
};

/// Slug automático a partir del nombre — la marca lo puede corregir a mano
/// después si quiere (ej. acortar), pero no tiene que pensarlo desde cero.
function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function StoreProductForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: ManualProduct;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    initial?.compareAtPrice != null ? String(initial.compareAtPrice) : "",
  );
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [stock, setStock] = useState(
    initial?.stock != null ? String(initial.stock) : "",
  );
  const [available, setAvailable] = useState(initial?.available ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    // Solo autogenera mientras la marca no haya tocado el slug a mano —
    // si ya lo editó, no se lo pisamos con cada letra que escriba del nombre.
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/marca/tienda/productos/imagen", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo subir la imagen.");
        return;
      }
      setImageUrl(body.url);
    } catch {
      setError("No se pudo subir la imagen — revisa tu conexión.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name,
      description,
      price,
      compareAtPrice: compareAtPrice || null,
      imageUrl,
      slug,
      stock: stock === "" ? null : stock,
      available,
    };

    try {
      const res = await fetch("/api/marca/tienda/productos", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          initial ? { ...payload, productId: initial.id } : payload,
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar el producto.");
        return;
      }
      onSaved();
    } catch {
      setError("No se pudo guardar — revisa tu conexión e intenta de nuevo.");
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
        <label className="block text-sm text-brand-ink mb-1">
          Nombre del producto
        </label>
        <input
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
          className="input min-h-24"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Imagen</label>
        <div className="flex items-center gap-3">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="w-16 h-16 rounded-lg object-cover border border-brand-line"
            />
          )}
          <label className="text-xs border border-brand-line rounded-full px-4 py-1.5 cursor-pointer hover:bg-brand-accent-soft">
            {uploading
              ? "Subiendo..."
              : imageUrl
                ? "Reemplazar"
                : "Subir imagen"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Precio</label>
          <input
            required
            type="number"
            min="0"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Precio antes (opcional)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={compareAtPrice}
            onChange={(e) => setCompareAtPrice(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Slug (URL)
          </label>
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className="input font-mono text-sm"
          />
          <p className="text-xs text-brand-ink-soft mt-1">
            Solo minúsculas, números y guiones.
          </p>
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Stock (opcional)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Sin límite"
            className="input"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-brand-ink">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
        />
        Disponible para la venta
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar producto"}
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
