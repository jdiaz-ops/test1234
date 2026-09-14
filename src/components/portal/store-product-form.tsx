"use client";

import { useEffect, useState } from "react";
import { PriceInput } from "@/components/portal/price-input";
import { ProductImageUploader } from "@/components/portal/product-image-uploader";
import { RichTextEditor } from "@/components/portal/rich-text-editor";
import { WeightInput, type WeightUnit } from "@/components/portal/weight-input";
import {
  ProductCollectionsPicker,
  type BrandCollectionOption,
} from "@/components/portal/product-collections-picker";
import {
  ProductVariantsEditor,
  type VariantRowInput,
} from "@/components/portal/product-variants-editor";

export type ManualProductVariant = {
  id: string;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  weight: number | null;
  weightUnit: WeightUnit;
};

export type ManualProduct = {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  slug: string | null;
  sku: string | null;
  barcode: string | null;
  weight: number | null;
  weightUnit: WeightUnit;
  stock: number | null;
  available: boolean;
  type: "PHYSICAL" | "SERVICE";
  serviceModality: "VIRTUAL" | "PRESENCIAL" | null;
  serviceDurationMinutes: number | null;
  serviceLocation: string | null;
  collectionIds: string[];
  hasVariants: boolean;
  optionNames: string[];
  variants: ManualProductVariant[];
};

/// Slug interno — la marca ya no lo ve ni lo edita (ver conversación del
/// 2026-09-14: "no sé a qué se refiere un Slug URL"), se genera solo a
/// partir del nombre. El servicio le agrega un sufijo si choca con uno
/// existente (assertSlugAvailable ya no hace falta que la marca lo
/// resuelva a mano).
function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toVariantRows(variants: ManualProductVariant[]): VariantRowInput[] {
  return variants.map((v) => ({
    key: v.id,
    option1Value: v.option1Value,
    option2Value: v.option2Value,
    option3Value: v.option3Value,
    price: v.price,
    sku: v.sku ?? "",
    barcode: v.barcode ?? "",
    stock: v.stock,
    weight: v.weight,
    weightUnit: v.weightUnit,
    imageUrl: null,
  }));
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
  const [price, setPrice] = useState<number | null>(initial?.price ?? null);
  const [compareAtPrice, setCompareAtPrice] = useState<number | null>(
    initial?.compareAtPrice ?? null,
  );
  // Productos creados antes de la galería (ver ProductImage en el schema)
  // solo tienen imageUrl, sin filas en `images` — sin este respaldo, abrir
  // uno para editarlo y guardar sin tocar las fotos les borraría la
  // portada (images[0] ?? null en el servicio). Ver conversación del
  // 2026-09-14.
  const [images, setImages] = useState<string[]>(
    initial?.images && initial.images.length > 0
      ? initial.images
      : initial?.imageUrl
        ? [initial.imageUrl]
        : [],
  );
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [weight, setWeight] = useState<number | null>(initial?.weight ?? null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    initial?.weightUnit ?? "KG",
  );
  const [stock, setStock] = useState(
    initial?.stock != null ? String(initial.stock) : "",
  );
  const [available, setAvailable] = useState(initial?.available ?? true);
  const [type, setType] = useState<"PHYSICAL" | "SERVICE">(
    initial?.type ?? "PHYSICAL",
  );
  const [serviceModality, setServiceModality] = useState<
    "VIRTUAL" | "PRESENCIAL"
  >(initial?.serviceModality ?? "VIRTUAL");
  const [serviceDurationMinutes, setServiceDurationMinutes] = useState(
    initial?.serviceDurationMinutes != null
      ? String(initial.serviceDurationMinutes)
      : "",
  );
  const [serviceLocation, setServiceLocation] = useState(
    initial?.serviceLocation ?? "",
  );

  const [allCollections, setAllCollections] = useState<BrandCollectionOption[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>(
    initial?.collectionIds ?? [],
  );

  const [hasVariants, setHasVariants] = useState(initial?.hasVariants ?? false);
  const [optionNames, setOptionNames] = useState<string[]>(
    initial?.optionNames ?? [],
  );
  const [variantRows, setVariantRows] = useState<VariantRowInput[]>(
    toVariantRows(initial?.variants ?? []),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isService = type === "SERVICE";

  useEffect(() => {
    fetch("/api/marca/tienda/colecciones")
      .then((r) => r.json())
      .then((body) => setAllCollections(body.collections ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (price == null && !hasVariants) {
      setError("Ingresa el precio.");
      return;
    }
    if (!hasVariants && (stock === "" || Number(stock) < 0)) {
      setError("Ingresa el stock.");
      return;
    }
    if (hasVariants && variantRows.length === 0) {
      setError("Agrega al menos una opción con valores para generar variantes.");
      return;
    }

    setSaving(true);

    const payload = {
      name,
      description,
      images,
      slug: slugify(name),
      price: hasVariants ? 0 : price,
      compareAtPrice: hasVariants ? null : compareAtPrice,
      sku: hasVariants ? "" : sku,
      barcode: hasVariants ? "" : barcode,
      weight: hasVariants ? null : weight,
      weightUnit,
      stock: hasVariants ? null : Number(stock),
      available,
      type,
      serviceModality: isService ? serviceModality : null,
      serviceDurationMinutes: isService
        ? serviceDurationMinutes === ""
          ? null
          : serviceDurationMinutes
        : null,
      serviceLocation: isService ? serviceLocation : "",
      collectionIds,
      hasVariants,
      optionNames: hasVariants ? optionNames.filter((n) => n.trim()) : [],
      variants: hasVariants
        ? variantRows.map((v) => ({
            option1Value: v.option1Value,
            option2Value: v.option2Value,
            option3Value: v.option3Value,
            price: v.price,
            sku: v.sku,
            barcode: v.barcode,
            stock: v.stock,
            weight: v.weight,
            weightUnit: v.weightUnit,
          }))
        : [],
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
        <label className="block text-sm text-brand-ink mb-1">Tipo</label>
        <div className="flex gap-2">
          {(["PHYSICAL", "SERVICE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={Boolean(initial)}
              onClick={() => setType(t)}
              className={`text-sm rounded-full px-4 py-1.5 border disabled:opacity-50 disabled:cursor-not-allowed ${
                type === t
                  ? "bg-brand-accent text-white border-brand-accent"
                  : "border-brand-line text-brand-ink-soft hover:bg-brand-accent-soft"
              }`}
            >
              {t === "PHYSICAL" ? "Producto físico" : "Servicio"}
            </button>
          ))}
        </div>
        {initial && (
          <p className="text-xs text-brand-ink-soft mt-1">
            El tipo no se puede cambiar después de crear el producto.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">
          {isService ? "Nombre del servicio" : "Nombre del producto"}
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Descripción</label>
        <RichTextEditor value={description} onChange={setDescription} />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Fotos</label>
        <ProductImageUploader images={images} onChange={setImages} />
      </div>

      {isService && (
        <div className="space-y-4 rounded-xl border border-brand-line p-4">
          <div>
            <label className="block text-sm text-brand-ink mb-1">
              Modalidad
            </label>
            <div className="flex gap-2">
              {(["VIRTUAL", "PRESENCIAL"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setServiceModality(m)}
                  className={`text-sm rounded-full px-4 py-1.5 border ${
                    serviceModality === m
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "border-brand-line text-brand-ink-soft hover:bg-brand-accent-soft"
                  }`}
                >
                  {m === "VIRTUAL" ? "Virtual" : "Presencial"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-brand-ink mb-1">
                Duración (min, opcional)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={serviceDurationMinutes}
                onChange={(e) => setServiceDurationMinutes(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-brand-ink mb-1">
                {serviceModality === "PRESENCIAL"
                  ? "Dirección"
                  : "Link o instrucciones de la videollamada"}
              </label>
              <input
                required
                value={serviceLocation}
                onChange={(e) => setServiceLocation(e.target.value)}
                placeholder={
                  serviceModality === "PRESENCIAL"
                    ? "Calle 10 #5-20, Bogotá"
                    : "Se agenda por Zoom — te llega el link al confirmar"
                }
                className="input"
              />
            </div>
          </div>
          <p className="text-xs text-brand-ink-soft">
            Cuando alguien reserve, elige la fecha y hora que prefiere — tú la
            confirmas (o propones otra) desde Pedidos.
          </p>
        </div>
      )}

      {!isService && (
        <div className="rounded-xl border border-brand-line p-3">
          <label className="flex items-center gap-2 text-sm text-brand-ink">
            <input
              type="checkbox"
              checked={hasVariants}
              onChange={(e) => setHasVariants(e.target.checked)}
            />
            Este producto tiene variantes (talla, color, etc.)
          </label>
          {initial && hasVariants !== initial.hasVariants && (
            <p className="text-xs text-amber-600 mt-1.5">
              ⚠ Al guardar se{" "}
              {hasVariants
                ? "borra el stock/precio actual del producto — vas a tener que cargarlos de nuevo por cada variante"
                : "borran las variantes actuales y su stock — vuelve a poner el stock y precio del producto"}
              . Si alguien tiene este producto en el carrito ahora mismo, puede
              que no le funcione el pago hasta que actualice la página.
            </p>
          )}
        </div>
      )}

      {!hasVariants && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-brand-ink mb-1">Precio</label>
              <PriceInput required value={price} onChange={setPrice} />
            </div>
            <div>
              <label className="block text-sm text-brand-ink mb-1">
                Precio antes (opcional)
              </label>
              <PriceInput value={compareAtPrice} onChange={setCompareAtPrice} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-brand-ink mb-1">SKU</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-brand-ink mb-1">
                Código de barras (EAN)
              </label>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {!isService && (
            <div>
              <label className="block text-sm text-brand-ink mb-1">
                Peso (opcional)
              </label>
              <WeightInput
                valueKg={weight}
                unit={weightUnit}
                onChange={(w, u) => {
                  setWeight(w);
                  setWeightUnit(u);
                }}
                placeholder="Para reglas de envío por peso"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-brand-ink mb-1">
              {isService ? "Cupos disponibles" : "Stock"}
            </label>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="input"
            />
          </div>
        </>
      )}

      {hasVariants && (
        <div>
          <label className="block text-sm text-brand-ink mb-2">Variantes</label>
          <ProductVariantsEditor
            optionNames={optionNames}
            onOptionNamesChange={setOptionNames}
            variants={variantRows}
            onVariantsChange={setVariantRows}
          />
        </div>
      )}

      {!isService && (
        <div>
          <label className="block text-sm text-brand-ink mb-1">Colecciones</label>
          <ProductCollectionsPicker
            allCollections={allCollections}
            onAllCollectionsChange={setAllCollections}
            selectedIds={collectionIds}
            onChange={setCollectionIds}
          />
        </div>
      )}

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
          disabled={saving}
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
