import { prisma } from "@/lib/prisma";
import { GOOGLE_FONT_OPTIONS } from "@/lib/brand-theme";
import { FileUploadError, MAX_UPLOAD_BYTES, uploadFile } from "@/lib/file-upload";
import { ShopifyStoreError } from "@/lib/shopify-products-json";
import type { ShopifyThemeColors } from "@/lib/shopify-theme";
import { publishTheme, updateDraftTheme } from "@/server/services/brand-theme-store";
import { fetchImageSafely, type FetchLike } from "@/server/services/shopify-store-reader";

/// Deja el panel de Diseño con lo que se leyó de la tienda Shopify (ver
/// shopify-theme.ts): colores y tipografía al borrador del tema y, si se
/// pide, publicado de una vez; el logo y el favicon se descargan de
/// Shopify y se suben al almacenamiento de Marcolini (si la marca ya tenía
/// uno, no se reemplaza). Ver conversación del 2026-10-17.

export type ShopifyDesignInput = {
  colors?: ShopifyThemeColors | null;
  fonts?: { headingFont: string; bodyFont: string } | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  /// Por defecto se publica: la marca que importa está armando la tienda.
  publish?: boolean;
};

export type ImageOutcome = "subido" | "ya-tenia" | "omitido" | "error";

export type ShopifyDesignResult = {
  colors: boolean;
  fonts: boolean;
  published: boolean;
  logo: ImageOutcome;
  favicon: ImageOutcome;
};

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const defaultFetch: FetchLike = (url, init) => fetch(url, init);

function validFont(value: string) {
  return GOOGLE_FONT_OPTIONS.some((f) => f.value === value);
}

export async function applyShopifyDesign(
  brandId: string,
  input: ShopifyDesignInput,
  fetchImpl: FetchLike = defaultFetch,
): Promise<ShopifyDesignResult> {
  const patch: Record<string, unknown> = {};
  if (input.colors) patch.colors = { ...input.colors, usarAcento: false };
  if (input.fonts && validFont(input.fonts.headingFont) && validFont(input.fonts.bodyFont)) {
    patch.typography = { headingFont: input.fonts.headingFont, bodyFont: input.fonts.bodyFont };
  }
  let published = false;
  if (Object.keys(patch).length > 0) {
    await updateDraftTheme(brandId, patch);
    if (input.publish !== false) {
      await publishTheme(brandId);
      published = true;
    }
  }

  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    select: { logoUrl: true, faviconUrl: true },
  });
  const logo = await importImage(brandId, "logoUrl", input.logoUrl, profile.logoUrl, fetchImpl);
  const favicon = await importImage(brandId, "faviconUrl", input.faviconUrl, profile.faviconUrl, fetchImpl);

  return { colors: Boolean(patch.colors), fonts: Boolean(patch.typography), published, logo, favicon };
}

async function importImage(
  brandId: string,
  field: "logoUrl" | "faviconUrl",
  sourceUrl: string | null | undefined,
  currentUrl: string | null,
  fetchImpl: FetchLike,
): Promise<ImageOutcome> {
  if (!sourceUrl) return "omitido";
  if (currentUrl) return "ya-tenia";
  try {
    const file = await downloadImage(sourceUrl, field === "logoUrl" ? "logo" : "favicon", fetchImpl);
    const url = await uploadFile(file, `marcas/${brandId}`);
    await prisma.brandProfile.update({ where: { id: brandId }, data: { [field]: url } });
    return "subido";
  } catch (err) {
    const message =
      err instanceof ShopifyStoreError || err instanceof FileUploadError || err instanceof Error ? err.message : err;
    console.error(`[diseño-shopify] ${field}:`, message);
    return "error";
  }
}

/// Descarga una imagen pública (png, jpg, webp o svg; hasta el tope de
/// subida) y la deja como File para uploadFile.
export async function downloadImage(sourceUrl: string, name: string, fetchImpl: FetchLike = defaultFetch): Promise<File> {
  const response = await fetchImageSafely(fetchImpl, sourceUrl);
  if (!response.ok) throw new ShopifyStoreError(`La imagen respondió ${response.status}.`);
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = IMAGE_TYPES[type];
  if (!ext) throw new ShopifyStoreError(`Formato de imagen no permitido (${type || "desconocido"}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new ShopifyStoreError("La imagen llegó vacía.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new ShopifyStoreError("La imagen pesa más de 8 MB.");
  return new File([bytes], `${name}.${ext}`, { type });
}
