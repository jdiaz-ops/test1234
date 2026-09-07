"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  StoreProductForm,
  type ManualProduct,
} from "@/components/portal/store-product-form";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function StoreProductsPanel({
  initialProducts,
}: {
  initialProducts: ManualProduct[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [mode, setMode] = useState<
    | { kind: "list" }
    | { kind: "create" }
    | { kind: "edit"; product: ManualProduct }
  >({
    kind: "list",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refreshAfterSave() {
    setMode({ kind: "list" });
    router.refresh();
    // El server component vuelve a mandar la lista actualizada por props en
    // el próximo render — mientras tanto, disparamos un GET nosotros mismos
    // para no depender del timing del refresh de Next.
    fetch("/api/marca/tienda/productos")
      .then((r) => r.json())
      .then((body) => setProducts(body.products ?? []))
      .catch(() => {});
  }

  async function handleDelete(productId: string) {
    if (!window.confirm("¿Eliminar este producto? No se puede deshacer."))
      return;
    setDeletingId(productId);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/productos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo eliminar el producto.");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      router.refresh();
    } catch {
      setError("No se pudo eliminar — revisa tu conexión.");
    } finally {
      setDeletingId(null);
    }
  }

  if (mode.kind === "create") {
    return (
      <StoreProductForm
        onSaved={refreshAfterSave}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }
  if (mode.kind === "edit") {
    return (
      <StoreProductForm
        initial={mode.product}
        onSaved={refreshAfterSave}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setMode({ kind: "create" })}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
      >
        + Agregar producto
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {products.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no has agregado ningún producto.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-brand-line bg-brand-surface p-4 flex gap-3"
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-brand-bg shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {product.type === "SERVICE" && (
                    <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-purple-100 text-purple-700 shrink-0">
                      SERVICIO
                    </span>
                  )}
                  <p className="font-display font-semibold text-brand-ink truncate">
                    {product.name}
                  </p>
                </div>
                <p className="text-sm text-brand-ink-soft">
                  {formatCOP(product.price)}
                </p>
                {!product.available && (
                  <p className="text-xs text-red-600 mt-0.5">No disponible</p>
                )}
                {product.stock != null && (
                  <p className="text-xs text-brand-ink-soft mt-0.5">
                    {product.type === "SERVICE" ? "Cupos" : "Stock"}: {product.stock}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setMode({ kind: "edit", product })}
                    className="text-xs text-brand-accent hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === product.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
