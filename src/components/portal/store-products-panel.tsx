"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  StoreProductForm,
  type ManualProduct,
} from "@/components/portal/store-product-form";
import { ShopifyCsvImporter } from "@/components/portal/shopify-csv-importer";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/// Lista de productos de "Mi tienda" con Agregar (a mano) e Importar desde
/// Shopify (CSV). El viejo "Importar producto" — elegir uno ya
/// sincronizado por la conexión Shopify/WooCommerce para precargar el
/// formulario — se quitó a pedido de la marca: al lado del importador de
/// CSV confundía. Ver conversación del 2026-09-30.
export function StoreProductsPanel({
  initialProducts,
}: {
  initialProducts: ManualProduct[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [mode, setMode] = useState<
    | { kind: "list" }
    | { kind: "create"; seed?: Partial<ManualProduct> }
    | { kind: "edit"; product: ManualProduct }
    | { kind: "shopify" }
  >({
    kind: "list",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activatedNotice, setActivatedNotice] = useState<string | null>(null);

  /// Borradores que sí se podrían vender (con precio o variantes) — los
  /// que cuenta el aviso de "no se ven en la tienda". Un borrador sin
  /// precio no se activa en lote: hay que ponerle precio primero.
  const sellableDrafts = products.filter(
    (p) => p.status === "DRAFT" && (p.hasVariants || p.price > 0),
  ).length;

  async function handleActivateDrafts() {
    if (
      !window.confirm(
        `¿Activar ${sellableDrafts} productos en borrador? Van a verse y poder comprarse en tu tienda de inmediato.`,
      )
    )
      return;
    setActivating(true);
    setError(null);
    setActivatedNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/activar-borradores", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudieron activar los borradores.");
        return;
      }
      setActivatedNotice(`Listo: ${body?.count ?? 0} productos activados.`);
      reloadProducts();
    } catch {
      setError("No se pudieron activar — revisa tu conexión.");
    } finally {
      setActivating(false);
    }
  }

  function reloadProducts() {
    router.refresh();
    // El server component vuelve a mandar la lista actualizada por props en
    // el próximo render — mientras tanto, disparamos un GET nosotros mismos
    // para no depender del timing del refresh de Next.
    fetch("/api/marca/tienda/productos")
      .then((r) => r.json())
      .then((body) => setProducts(body.products ?? []))
      .catch(() => {});
  }

  function refreshAfterSave() {
    setMode({ kind: "list" });
    reloadProducts();
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
      // Si venía de editar ese mismo producto, vuelve a la lista — ya no
      // hay nada que seguir editando. Sin efecto si ya estaba en la
      // lista (era ahí donde se pidió eliminar).
      setMode((prev) =>
        prev.kind === "edit" && prev.product.id === productId ? { kind: "list" } : prev,
      );
      router.refresh();
    } catch {
      setError("No se pudo eliminar — revisa tu conexión.");
    } finally {
      setDeletingId(null);
    }
  }

  /// Precarga el formulario de Crear con los datos del producto elegido —
  /// la marca revisa/ajusta el nombre u otros campos y guarda como uno
  /// nuevo, en Borrador para no publicarlo sin querer. Ver conversación
  /// del 2026-09-14.
  function handleDuplicate(product: ManualProduct) {
    setMode({
      kind: "create",
      seed: { ...product, name: `${product.name} (copia)`, status: "DRAFT" },
    });
  }

  if (mode.kind === "create") {
    return (
      // key fijo pero DISTINTO del de "edit" abajo — sin esto, pasar de
      // Editar a Duplicar (mismo tipo de componente, misma posición en
      // el árbol) hace que React reutilice la instancia en vez de
      // remontarla, y el formulario se queda con el estado viejo
      // (ignora el seed con "(copia)"). Encontrado probando el flujo
      // real. Ver conversación del 2026-09-14.
      <StoreProductForm
        key="create-form"
        seed={mode.seed}
        onSaved={refreshAfterSave}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }
  if (mode.kind === "edit") {
    return (
      <StoreProductForm
        key={`edit-${mode.product.id}`}
        initial={mode.product}
        onSaved={refreshAfterSave}
        onCancel={() => setMode({ kind: "list" })}
        onDelete={() => handleDelete(mode.product.id)}
        onDuplicate={() => handleDuplicate(mode.product)}
        deleting={deletingId === mode.product.id}
      />
    );
  }
  if (mode.kind === "shopify") {
    return (
      <ShopifyCsvImporter
        onImported={reloadProducts}
        onClose={() => setMode({ kind: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
        >
          + Agregar producto
        </button>
        <button
          type="button"
          onClick={() => setMode({ kind: "shopify" })}
          className="border border-brand-line rounded-full px-6 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft"
        >
          Importar desde Shopify
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {activatedNotice && <p className="text-sm text-green-700">{activatedNotice}</p>}

      {sellableDrafts > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-900">
            {sellableDrafts === 1
              ? "Tienes 1 producto en borrador: no se ve en tu tienda."
              : `Tienes ${sellableDrafts} productos en borrador: no se ven en tu tienda.`}
          </p>
          <button
            type="button"
            onClick={handleActivateDrafts}
            disabled={activating}
            className="rounded-full bg-brand-ink text-brand-bg px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {activating ? "Activando…" : sellableDrafts === 1 ? "Activar ese producto" : "Activar todos los borradores"}
          </button>
        </div>
      )}

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
                  {product.type === "DIGITAL" && (
                    <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-blue-100 text-blue-700 shrink-0">
                      DIGITAL
                    </span>
                  )}
                  <p className="font-display font-semibold text-brand-ink truncate">
                    {product.name}
                  </p>
                </div>
                <p className="text-sm text-brand-ink-soft">
                  {product.hasVariants
                    ? "Varios precios"
                    : formatCOP(product.price)}
                </p>
                {product.status === "DRAFT" && (
                  <p className="text-xs text-red-600 mt-0.5">Borrador</p>
                )}
                {product.status === "UNLISTED" && (
                  <p className="text-xs text-amber-600 mt-0.5">No listado</p>
                )}
                {product.hasVariants ? (
                  <p className="text-xs text-brand-ink-soft mt-0.5">
                    {product.variants.length} variantes ·{" "}
                    {product.variants.reduce((sum, v) => sum + v.stock, 0)} en
                    stock
                  </p>
                ) : (
                  product.stock != null && (
                    <p className="text-xs text-brand-ink-soft mt-0.5">
                      {product.type === "SERVICE" ? "Cupos" : "Inventario"}:{" "}
                      {product.stock}
                    </p>
                  )
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
                    onClick={() => handleDuplicate(product)}
                    className="text-xs text-brand-accent hover:underline"
                  >
                    Duplicar
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
