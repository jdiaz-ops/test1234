import { slugify, type ShopifyImportProduct, type ShopifyImportVariant } from "@/lib/shopify-csv";
import type { ShopifyImportCollection } from "@/lib/shopify-products-json";

/// Lo que se arma en el navegador con lo que Claude lee de los archivos de
/// una marca sin web (ver catalog-files-reader.tsx). Código puro para
/// poder probarlo.

/// Recuadro de la foto dentro de una imagen, de 0 a 1000. null = la imagen
/// entera.
export type PhotoBox = { x0: number; y0: number; x1: number; y1: number };

export type PhotoRef = { id: string; sourceId: string; box: PhotoBox | null };

export type DraftOption = { name: string; values: string[] };

/// Un producto en la tabla de revisión, editable.
export type DraftProduct = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  compareAtPrice: number | null;
  category: string;
  sku: string;
  weightGrams: number | null;
  options: DraftOption[];
  photos: PhotoRef[];
};

const MAX_VARIANTS = 100;

export function normalizeName(name: string) {
  return slugify(name).replace(/-/g, " ").trim();
}

/// El mismo producto puede aparecer en el PDF y en la lista de precios: se
/// une por nombre. Se queda lo que falte en el primero (precio,
/// descripción, fotos, opciones) con lo del segundo.
export function mergeDrafts(drafts: DraftProduct[]): DraftProduct[] {
  const byName = new Map<string, DraftProduct>();
  const out: DraftProduct[] = [];
  for (const d of drafts) {
    const key = normalizeName(d.name);
    const existing = key ? byName.get(key) : undefined;
    if (!existing) {
      const copy = { ...d, photos: [...d.photos], options: d.options.map((o) => ({ ...o, values: [...o.values] })) };
      if (key) byName.set(key, copy);
      out.push(copy);
      continue;
    }
    existing.price ??= d.price;
    existing.compareAtPrice ??= d.compareAtPrice;
    existing.weightGrams ??= d.weightGrams;
    if (!existing.description && d.description) existing.description = d.description;
    if (!existing.sku && d.sku) existing.sku = d.sku;
    if (!existing.category && d.category) existing.category = d.category;
    if (existing.options.length === 0 && d.options.length > 0) existing.options = d.options;
    existing.photos.push(...d.photos);
  }
  return out;
}

/// Parte un texto largo (Excel, CSV, mensajes de WhatsApp) en pedazos que
/// Claude pueda leer en un solo request, sin cortar líneas. Cada pedazo
/// repite la primera línea (los encabezados de la tabla).
export function chunkText(text: string, maxLines = 120, maxChars = 12000): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0];
  const chunks: string[] = [];
  let current: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (current.length > 0 && (current.length >= maxLines || size + line.length > maxChars)) {
      chunks.push(current.join("\n"));
      current = line === header ? [] : [header];
      size = current.join("\n").length;
    }
    current.push(line.slice(0, maxChars));
    size += line.length + 1;
  }
  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks;
}

function cartesian(options: DraftOption[]): string[][] {
  let combos: string[][] = [[]];
  for (const option of options) {
    const next: string[][] = [];
    for (const combo of combos) {
      for (const value of option.values) {
        next.push([...combo, value]);
        if (next.length >= MAX_VARIANTS) break;
      }
      if (next.length >= MAX_VARIANTS) break;
    }
    combos = next;
  }
  return combos;
}

function uniqueHandle(name: string, used: Set<string>) {
  const base = (slugify(name) || "producto").slice(0, 60).replace(/-+$/, "") || "producto";
  let handle = base;
  for (let i = 2; used.has(handle); i++) handle = `${base.slice(0, 55)}-${i}`;
  used.add(handle);
  return handle;
}

/// La tabla revisada → productos en el shape del importador (el mismo del
/// CSV y del link de Shopify). `imageUrls` = las fotos ya subidas a
/// Marcolini, por id de PhotoRef. Sin precio → borrador.
export function draftsToImport(
  drafts: DraftProduct[],
  imageUrls: Map<string, string>,
): { products: ShopifyImportProduct[]; collections: ShopifyImportCollection[] } {
  const used = new Set<string>();
  const products: ShopifyImportProduct[] = [];
  const collections = new Map<string, ShopifyImportCollection>();
  for (const d of drafts) {
    const name = d.name.trim();
    if (name.length < 2) continue;
    const handle = uniqueHandle(name, used);
    const price = d.price != null && d.price > 0 ? d.price : 0;
    const weight = d.weightGrams != null && d.weightGrams > 0 ? Math.round(d.weightGrams) / 1000 : null;
    const options = d.options.filter((o) => o.name.trim() && o.values.length > 0).slice(0, 3);
    const variants: ShopifyImportVariant[] = cartesian(options).map((combo) => ({
      option1Value: combo[0] ?? null,
      option2Value: combo[1] ?? null,
      option3Value: combo[2] ?? null,
      price: price > 0 ? price : null,
      sku: "",
      barcode: "",
      stock: 0,
      weight,
      weightUnit: "G",
    }));
    const hasVariants = options.length > 0 && variants.length > 0;
    const description = d.description.trim()
      ? d.description
          .trim()
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
          .join("")
      : "";
    products.push({
      handle,
      name: name.slice(0, 255),
      description,
      price: hasVariants ? 0 : price,
      compareAtPrice: hasVariants ? null : d.compareAtPrice != null && d.compareAtPrice > price ? d.compareAtPrice : null,
      images: Array.from(new Set(d.photos.map((p) => imageUrls.get(p.id)).filter((u): u is string => Boolean(u)))),
      sku: hasVariants ? "" : d.sku.trim().slice(0, 120),
      barcode: "",
      weight: hasVariants ? null : weight,
      weightUnit: "G",
      stock: null,
      status: price > 0 ? "ACTIVE" : "DRAFT",
      collectionName: d.category.trim() || null,
      hasVariants,
      optionNames: hasVariants ? options.map((o) => o.name.trim().slice(0, 40)) : [],
      variants: hasVariants ? variants : [],
    });
    const category = d.category.trim();
    if (category.length >= 2) {
      const key = category.toLowerCase();
      const collection = collections.get(key) ?? {
        handle: slugify(category) || "coleccion",
        name: category.slice(0, 80),
        description: "",
        imageUrl: null,
        productsCount: 0,
        sortOrder: "MANUAL" as const,
        productHandles: [],
      };
      collection.productHandles.push(handle);
      collection.productsCount = collection.productHandles.length;
      collections.set(key, collection);
    }
  }
  return { products, collections: Array.from(collections.values()) };
}
