import Papa from "papaparse";

/// Lee la exportación de productos de Shopify (Productos → Exportar → CSV)
/// y la convierte al shape de un producto manual de "Mi tienda". Es código
/// puro (sin Prisma ni Node) porque corre en el navegador: el archivo se
/// analiza ahí y la lista resultante se manda al servidor por lotes (ver
/// shopify-csv-importer.tsx), así un catálogo grande nunca depende de que
/// un solo request termine a tiempo.
///
/// Formato de Shopify: una fila por variante Y una fila extra por cada
/// imagen adicional, todas con el mismo Handle. Solo la primera fila del
/// producto trae Título, Descripción, Tipo, Estado, etc.; las demás dejan
/// esas celdas vacías. Un producto sin opciones reales viene como una
/// única variante "Title = Default Title".
export class ShopifyCsvError extends Error {}

export type ShopifyImportVariant = {
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null;
  sku: string;
  barcode: string;
  stock: number;
  weight: number | null;
  weightUnit: "KG" | "G";
};

export type ShopifyImportProduct = {
  handle: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  sku: string;
  barcode: string;
  weight: number | null;
  weightUnit: "KG" | "G";
  stock: number | null;
  status: "ACTIVE" | "DRAFT";
  collectionName: string | null;
  hasVariants: boolean;
  optionNames: string[];
  variants: ShopifyImportVariant[];
};

export type ShopifyCsvStats = {
  products: number;
  withVariants: number;
  images: number;
  /// Productos a los que no se les pudo saber el stock: la exportación
  /// actual de Shopify ya no trae la columna "Variant Inventory Qty"
  /// (el inventario se exporta aparte).
  unknownStock: number;
  /// Productos que entrarían como borrador (despublicados o archivados en
  /// Shopify, o sin precio) — solo aplica a productos nuevos; los que ya
  /// existen conservan su estado (ver shopify-csv-import-service.ts).
  draft: number;
};

export type ShopifyCsvParseResult = {
  products: ShopifyImportProduct[];
  warnings: string[];
  stats: ShopifyCsvStats;
};

type Row = Record<string, string>;

const MAX_IMAGES_PER_PRODUCT = 50;
const MAX_DESCRIPTION_LENGTH = 20000;
const MAX_PRODUCTS = 2000;

/// "Sin categoría" en español, "Uncategorized" en inglés — Shopify lo pone
/// en Product Category cuando la marca nunca eligió una.
const PLACEHOLDER_CATEGORIES = new Set([
  "sin categoría",
  "sin categoria",
  "uncategorized",
  "uncategorised",
]);

export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/// El handle de Shopify ya es un slug, pero puede pasarse del tope de 60
/// caracteres del slug de "Mi tienda" o traer caracteres que no aceptamos.
export function slugFromHandle(handle: string, fallbackName: string) {
  const base = slugify(handle) || slugify(fallbackName) || "producto";
  return base.slice(0, 60).replace(/-+$/, "") || "producto";
}

function cell(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value != null && value.trim() !== "") return value.trim();
  }
  return "";
}

function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(value: string): number | null {
  const cleaned = value.replace(/[^0-9-]/g, "");
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function positiveOrNull(value: number | null) {
  return value != null && value > 0 ? value : null;
}

/// SKU y código de barras vienen con una comilla simple adelante
/// ('7709141153134) — Shopify la agrega para que Excel no los convierta
/// en número.
function cleanCode(value: string) {
  return value.replace(/^'+/, "").trim().slice(0, 120);
}

/// "Variant Grams" siempre está en gramos, sin importar la unidad que la
/// marca eligió para verlo — Product.weight se guarda siempre en kg.
function gramsToKg(value: string): number | null {
  const grams = parseMoney(value);
  if (grams == null || grams <= 0) return null;
  return Math.round(grams) / 1000;
}

function mapWeightUnit(value: string): "KG" | "G" {
  return value.toLowerCase() === "g" ? "G" : "KG";
}

function isDefaultTitle(optionName: string, optionValue: string) {
  return (
    optionName.toLowerCase() === "title" &&
    optionValue.toLowerCase() === "default title"
  );
}

/// Activo en Shopify Y publicado en el canal de la tienda online → Activo
/// acá. Borrador o archivado (o despublicado) → Borrador, para no publicar
/// de golpe algo que en Shopify estaba oculto. Las exportaciones viejas
/// no traen la columna Status, solo Published.
function resolveStatus(main: Row, hasStatusColumn: boolean): "ACTIVE" | "DRAFT" {
  const published = cell(main, "Published").toLowerCase();
  const active = hasStatusColumn ? cell(main, "Status").toLowerCase() === "active" : true;
  return active && published !== "false" ? "ACTIVE" : "DRAFT";
}

/// El CSV de productos de Shopify NO dice a qué colecciones pertenece
/// cada producto (Shopify no lo exporta). Lo más parecido que sí viene es
/// el Tipo de producto (texto libre de la marca, ej. "Placas Stamping") y,
/// como respaldo, la categoría estándar de Shopify — se usa el último
/// tramo de la ruta ("Ropa > Camisas" → "Camisas").
function resolveCollectionName(main: Row): string | null {
  const type = cell(main, "Type");
  if (type.length >= 2) return type.slice(0, 80);
  const category = cell(main, "Product Category");
  const last = category.split(">").pop()?.trim() ?? "";
  if (last.length < 2 || PLACEHOLDER_CATEGORIES.has(last.toLowerCase())) return null;
  return last.slice(0, 80);
}

function collectImages(group: Row[]) {
  const withImage = group
    .map((row, index) => ({
      url: cell(row, "Image Src"),
      position: parseInteger(cell(row, "Image Position")) ?? Number.MAX_SAFE_INTEGER,
      index,
    }))
    .filter((img) => /^https?:\/\//i.test(img.url))
    .sort((a, b) => a.position - b.position || a.index - b.index);
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const img of withImage) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);
    urls.push(img.url);
    if (urls.length >= MAX_IMAGES_PER_PRODUCT) break;
  }
  return urls;
}

function parseRows(text: string) {
  const result = Papa.parse<Row>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  return { rows: result.data, fields: result.meta.fields ?? [] };
}

export function parseShopifyProductsCsv(text: string): ShopifyCsvParseResult {
  const { rows, fields } = parseRows(text);
  const required = ["Handle", "Title", "Variant Price"];
  if (!required.every((name) => fields.includes(name))) {
    throw new ShopifyCsvError(
      "Este archivo no parece la exportación de productos de Shopify — faltan las columnas Handle, Title o Variant Price.",
    );
  }
  const hasQtyColumn = fields.includes("Variant Inventory Qty");
  const hasStatusColumn = fields.includes("Status");

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const handle = cell(row, "Handle");
    if (!handle) continue;
    const group = groups.get(handle);
    if (group) group.push(row);
    else groups.set(handle, [row]);
  }
  if (groups.size > MAX_PRODUCTS) {
    throw new ShopifyCsvError(
      `El archivo trae ${groups.size} productos — el máximo por importación es ${MAX_PRODUCTS}. Divídelo en varios archivos.`,
    );
  }

  const products: ShopifyImportProduct[] = [];
  const warnings: string[] = [];
  const stats: ShopifyCsvStats = { products: 0, withVariants: 0, images: 0, unknownStock: 0, draft: 0 };

  const stockFor = (row: Row): number | null => {
    if (!hasQtyColumn) return null;
    const qty = parseInteger(cell(row, "Variant Inventory Qty"));
    return qty == null ? null : Math.max(0, qty);
  };

  for (const [handle, group] of groups) {
    const main = group.find((row) => cell(row, "Title"));
    if (!main) {
      warnings.push(`"${handle}": no tiene título — se omitió.`);
      continue;
    }
    const name = cell(main, "Title").slice(0, 255);
    if (cell(main, "Gift Card").toLowerCase() === "true") {
      warnings.push(`"${name}": es una tarjeta de regalo — se omitió.`);
      continue;
    }

    const optionNames: string[] = [];
    for (const i of [1, 2, 3]) {
      const optionName = cell(main, `Option${i} Name`);
      if (!optionName) break;
      optionNames.push(optionName.slice(0, 40));
    }
    if (optionNames.length > 0 && isDefaultTitle(optionNames[0], cell(main, "Option1 Value"))) {
      optionNames.length = 0;
    }

    const variantRows = group.filter((row) => cell(row, "Option1 Value"));
    const hasVariants = optionNames.length > 0 && variantRows.length > 0;
    const baseRow = variantRows[0] ?? main;

    const images = collectImages(group);
    const description = cell(main, "Body (HTML)").slice(0, MAX_DESCRIPTION_LENGTH);
    const collectionName = resolveCollectionName(main);
    let status = resolveStatus(main, hasStatusColumn);
    let unknownStock = false;

    if (hasVariants) {
      const seen = new Set<string>();
      const variants: ShopifyImportVariant[] = [];
      for (const row of variantRows) {
        const values = [1, 2, 3].map((i) =>
          i <= optionNames.length ? cell(row, `Option${i} Value`) || null : null,
        );
        const key = values.map((v) => (v ?? "").toLowerCase()).join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const stock = stockFor(row);
        if (stock == null) unknownStock = true;
        variants.push({
          option1Value: values[0],
          option2Value: values[1],
          option3Value: values[2],
          price: positiveOrNull(parseMoney(cell(row, "Variant Price"))),
          sku: cleanCode(cell(row, "Variant SKU")),
          barcode: cleanCode(cell(row, "Variant Barcode", "Variant Barcodes")),
          stock: stock ?? 0,
          weight: gramsToKg(cell(row, "Variant Grams")),
          weightUnit: mapWeightUnit(cell(row, "Variant Weight Unit")),
        });
      }
      stats.withVariants++;
      products.push({
        handle,
        name,
        description,
        price: 0,
        compareAtPrice: null,
        images,
        sku: "",
        barcode: "",
        weight: null,
        weightUnit: mapWeightUnit(cell(baseRow, "Variant Weight Unit")),
        stock: null,
        status,
        collectionName,
        hasVariants: true,
        optionNames,
        variants,
      });
    } else {
      const price = Math.max(0, parseMoney(cell(baseRow, "Variant Price")) ?? 0);
      if (price <= 0) {
        warnings.push(`"${name}": no tiene precio — queda en borrador hasta que le pongas uno.`);
        status = "DRAFT";
      }
      const stock = stockFor(baseRow);
      if (stock == null) unknownStock = true;
      products.push({
        handle,
        name,
        description,
        price,
        compareAtPrice: positiveOrNull(parseMoney(cell(baseRow, "Variant Compare At Price"))),
        images,
        sku: cleanCode(cell(baseRow, "Variant SKU")),
        barcode: cleanCode(cell(baseRow, "Variant Barcode", "Variant Barcodes")),
        weight: gramsToKg(cell(baseRow, "Variant Grams")),
        weightUnit: mapWeightUnit(cell(baseRow, "Variant Weight Unit")),
        stock,
        status,
        collectionName,
        hasVariants: false,
        optionNames: [],
        variants: [],
      });
    }

    stats.products++;
    stats.images += images.length;
    if (products[products.length - 1]?.status === "DRAFT") stats.draft++;
    if (unknownStock) stats.unknownStock++;
  }

  if (products.length === 0) {
    throw new ShopifyCsvError("El archivo no trae ningún producto.");
  }

  return { products, warnings, stats };
}
