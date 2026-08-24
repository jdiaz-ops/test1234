"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  brand: { companyName: string };
};

type CollectionItem = { product: Product };
type Collection = {
  id: string;
  name: string;
  description: string | null;
  visible: boolean;
  items: CollectionItem[];
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/// Editor de una colección — crea o edita (mismo componente, `collection`
/// null = nueva). Trae el catálogo de las marcas del creador para elegir
/// productos, con una franja aparte para lo que cada marca destacó.
function CollectionEditor({
  collection,
  onDone,
}: {
  collection: Collection | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [selected, setSelected] = useState<Product[]>(collection?.items.map((i) => i.product) ?? []);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [suggested, setSuggested] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (q: string) => {
    const res = await fetch(`/api/creador/productos?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const body = await res.json();
    setResults(body.products);
    setSuggested(body.suggested);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchProducts(search), 250);
    return () => clearTimeout(t);
  }, [search, fetchProducts]);

  function toggleProduct(product: Product) {
    setSelected((cur) =>
      cur.some((p) => p.id === product.id) ? cur.filter((p) => p.id !== product.id) : [...cur, product]
    );
  }

  async function save() {
    if (!name.trim()) {
      setError("Ponle un nombre a la colección.");
      return;
    }
    setSaving(true);
    setError(null);

    const id = collection?.id;
    const collectionRes = id
      ? await fetch(`/api/creador/colecciones/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        })
      : await fetch("/api/creador/colecciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });

    if (!collectionRes.ok) {
      setSaving(false);
      const body = await collectionRes.json();
      setError(body.error ?? "No se pudo guardar.");
      return;
    }

    const collectionBody = await collectionRes.json();
    const collectionId = id ?? collectionBody.collection.id;

    const productsRes = await fetch(`/api/creador/colecciones/${collectionId}/productos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: selected.map((p) => p.id) }),
    });

    setSaving(false);
    if (!productsRes.ok) {
      const body = await productsRes.json();
      setError(body.error ?? "No se pudieron guardar los productos.");
      return;
    }

    router.refresh();
    onDone();
  }

  const suggestedToShow = suggested.filter((p) => !selected.some((s) => s.id === p.id));

  return (
    <div className="rounded-2xl border-2 border-brand-accent bg-brand-accent-soft/30 p-5 mb-4">
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Nombre de la colección</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. En mi mesa de trabajo"
            className="input mb-4"
          />
          <label className="block text-sm text-brand-ink mb-1">Descripción (opcional)</label>
          <textarea
            maxLength={160}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Lo que uso todos los días..."
            className="input min-h-20 mb-4"
          />
          <p className="text-xs text-brand-ink-soft mb-1">Vista previa ({selected.length} producto{selected.length === 1 ? "" : "s"})</p>
          <div className="grid grid-cols-2 gap-2">
            {selected.map((p) => (
              <div key={p.id} className="rounded-xl border border-brand-line bg-brand-surface p-2 relative">
                <button
                  onClick={() => toggleProduct(p)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand-ink text-white text-xs flex items-center justify-center"
                  aria-label={`Quitar ${p.name}`}
                >
                  ×
                </button>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto sincronizada desde la tienda de la marca
                  <img src={p.imageUrl} alt="" className="w-full aspect-square rounded-lg object-cover mb-1" />
                ) : (
                  <div className="w-full aspect-square rounded-lg bg-brand-accent-soft mb-1" />
                )}
                <p className="text-[11px] font-medium text-brand-ink truncate">{p.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-brand-ink mb-1">Agregar productos</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto en tus marcas..."
            className="input mb-3"
          />

          {suggestedToShow.length > 0 && (
            <div className="rounded-xl bg-brand-accent-soft border border-dashed border-brand-accent p-3 mb-3">
              <p className="font-mono text-[11px] font-bold text-brand-accent uppercase tracking-wide mb-2">
                Sugeridos por tus marcas
              </p>
              <div className="flex gap-2 overflow-x-auto">
                {suggestedToShow.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleProduct(p)}
                    className="rounded-xl border border-brand-line bg-brand-surface p-2 text-left shrink-0 w-28"
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto sincronizada desde la tienda de la marca
                      <img src={p.imageUrl} alt="" className="w-full aspect-square rounded-lg object-cover mb-1" />
                    ) : (
                      <div className="w-full aspect-square rounded-lg bg-brand-accent-soft mb-1" />
                    )}
                    <p className="text-[11px] font-medium text-brand-ink truncate">{p.name}</p>
                    <p className="text-[10px] text-brand-ink-soft truncate">{p.brand.companyName}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
            {results.map((p) => {
              const isSelected = selected.some((s) => s.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p)}
                  className={`rounded-xl border bg-brand-surface p-2 text-left relative ${
                    isSelected ? "border-brand-accent" : "border-brand-line"
                  }`}
                >
                  <span
                    className={`absolute top-1 right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center ${
                      isSelected ? "bg-brand-accent text-white" : "bg-white/90 border border-brand-line text-brand-ink-soft"
                    }`}
                  >
                    {isSelected ? "✓" : "+"}
                  </span>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto sincronizada desde la tienda de la marca
                    <img src={p.imageUrl} alt="" className="w-full aspect-square rounded-lg object-cover mb-1" />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-brand-accent-soft mb-1" />
                  )}
                  <p className="text-[11px] font-medium text-brand-ink truncate">{p.name}</p>
                  <p className="text-[10px] font-mono text-brand-ink-soft">{formatPrice(p.price, p.currency)}</p>
                </button>
              );
            })}
            {results.length === 0 && (
              <p className="col-span-full text-xs text-brand-ink-soft py-4">
                No hay productos — únete a marcas y sincroniza su catálogo para poder agregar.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar colección"}
        </button>
        <button onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function CollectionsManager({ collections }: { collections: Collection[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function move(id: string, direction: -1 | 1) {
    setBusyId(id);
    await fetch(`/api/creador/colecciones/${id}/mover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function toggleVisible(collection: Collection) {
    setBusyId(collection.id);
    await fetch(`/api/creador/colecciones/${collection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible: !collection.visible }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/creador/colecciones/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  const editingCollection = editing && editing !== "new" ? collections.find((c) => c.id === editing) ?? null : null;

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 sm:p-6 mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-semibold text-brand-ink">Tus colecciones</h2>
      </div>
      <p className="text-sm text-brand-ink-soft mb-5">
        Agrupa productos por tema — se muestran en tu vitrina, arriba de tus marcas.
      </p>

      {collections.length > 0 && (
        <div className="space-y-2 mb-4">
          {collections.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-brand-line bg-brand-bg px-3 py-2.5">
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => move(c.id, -1)}
                  disabled={i === 0 || busyId === c.id}
                  className="text-xs text-brand-ink-soft disabled:opacity-30 hover:text-brand-accent"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(c.id, 1)}
                  disabled={i === collections.length - 1 || busyId === c.id}
                  className="text-xs text-brand-ink-soft disabled:opacity-30 hover:text-brand-accent"
                >
                  ▼
                </button>
              </div>
              <div className="flex -space-x-2 shrink-0">
                {c.items.slice(0, 3).map((it) =>
                  it.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto sincronizada desde la tienda de la marca
                    <img
                      key={it.product.id}
                      src={it.product.imageUrl}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover border-2 border-brand-surface"
                    />
                  ) : (
                    <div key={it.product.id} className="w-8 h-8 rounded-lg bg-brand-accent-soft border-2 border-brand-surface" />
                  )
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-ink truncate">{c.name}</p>
                <p className="text-xs text-brand-ink-soft">
                  {c.items.length} producto{c.items.length === 1 ? "" : "s"} · {c.visible ? "visible" : "oculta"}
                </p>
              </div>
              <button
                onClick={() => toggleVisible(c)}
                disabled={busyId === c.id}
                className="text-xs text-brand-ink-soft hover:underline shrink-0"
              >
                {c.visible ? "Ocultar" : "Mostrar"}
              </button>
              <button onClick={() => setEditing(c.id)} className="text-xs text-brand-accent font-medium hover:underline shrink-0">
                Editar
              </button>
              <button
                onClick={() => remove(c.id)}
                disabled={busyId === c.id}
                className="text-xs text-brand-ink-soft hover:text-red-600 hover:underline shrink-0"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {editing === "new" && <CollectionEditor collection={null} onDone={() => setEditing(null)} />}
      {editingCollection && <CollectionEditor collection={editingCollection} onDone={() => setEditing(null)} />}

      {editing === null && (
        <button onClick={() => setEditing("new")} className="text-sm text-brand-accent font-medium hover:underline">
          + Nueva colección
        </button>
      )}
    </div>
  );
}
