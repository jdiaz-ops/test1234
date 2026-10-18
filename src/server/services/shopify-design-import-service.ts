import { prisma } from "@/lib/prisma";
import { GOOGLE_FONT_OPTIONS } from "@/lib/brand-theme";
import { FileUploadError, MAX_UPLOAD_BYTES, uploadFile } from "@/lib/file-upload";
import { ShopifyStoreError } from "@/lib/shopify-products-json";
import type { ShopifyThemeColors } from "@/lib/shopify-theme";
import { getDraftTheme, publishTheme, updateDraftTheme } from "@/server/services/brand-theme-store";
import { fetchImageSafely, type FetchLike } from "@/server/services/shopify-store-reader";

/// Deja el panel de Diseño con lo que se leyó de la tienda Shopify (ver
/// shopify-theme.ts): colores, tipografía y barra de anuncio al borrador
/// del tema y, si se pide, publicado de una vez; el logo y el favicon se
/// descargan de Shopify y se suben al almacenamiento de Marcolini; los
/// píxeles, redes y teléfono van al perfil. Nada de esto pisa lo que la
/// marca ya tenía. Ver conversaciones del 2026-10-17 y 2026-10-18.

export type ShopifyDesignInput = {
  colors?: ShopifyThemeColors | null;
  fonts?: { headingFont: string; bodyFont: string } | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  /// Píxeles, redes y teléfono leídos de la portada: se guardan solo en
  /// los campos del perfil que estén vacíos (nunca pisan lo que la marca
  /// ya configuró).
  pixels?: { metaPixelId?: string | null; tiktokPixelId?: string | null } | null;
  social?: { instagram?: string | null; tiktok?: string | null; whatsapp?: string | null; phone?: string | null } | null;
  /// Textos de la barra de anuncio; solo si la marca no tiene ninguno.
  announcements?: string[] | null;
  /// Por defecto se publica: la marca que importa está armando la tienda.
  publish?: boolean;
};

export type ImageOutcome = "subido" | "ya-tenia" | "omitido" | "error";

export type ShopifyDesignResult = {
  colors: boolean;
  fonts: boolean;
  announcements: boolean;
  published: boolean;
  logo: ImageOutcome;
  favicon: ImageOutcome;
  /// Campos del perfil que se llenaron (metaPixelId, instagramHandle…).
  profileFields: string[];
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
  const announcements = (input.announcements ?? []).map((t) => t.trim()).filter((t) => t.length > 0).slice(0, 4);
  if (announcements.length > 0) {
    const draft = await getDraftTheme(brandId);
    if (draft.announcementBar.messages.length === 0) {
      patch.announcementBar = { enabled: true, messages: announcements.map((text) => ({ text: text.slice(0, 200), link: "" })) };
    }
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
    select: {
      logoUrl: true,
      faviconUrl: true,
      metaPixelId: true,
      tiktokPixelId: true,
      instagramHandle: true,
      tiktokHandle: true,
      phone: true,
    },
  });
  const logo = await importImage(brandId, "logoUrl", input.logoUrl, profile.logoUrl, fetchImpl);
  const favicon = await importImage(brandId, "faviconUrl", input.faviconUrl, profile.faviconUrl, fetchImpl);

  // Píxeles, redes y teléfono: solo los campos vacíos.
  const fill: Record<string, string> = {};
  const clean = (v: string | null | undefined, max: number) => (v ?? "").trim().replace(/^@/, "").slice(0, max);
  if (!profile.metaPixelId && /^\d{6,20}$/.test(clean(input.pixels?.metaPixelId, 20))) fill.metaPixelId = clean(input.pixels?.metaPixelId, 20);
  if (!profile.tiktokPixelId && /^[A-Z0-9]{8,40}$/.test(clean(input.pixels?.tiktokPixelId, 40))) fill.tiktokPixelId = clean(input.pixels?.tiktokPixelId, 40);
  if (!profile.instagramHandle && clean(input.social?.instagram, 60)) fill.instagramHandle = clean(input.social?.instagram, 60);
  if (!profile.tiktokHandle && clean(input.social?.tiktok, 60)) fill.tiktokHandle = clean(input.social?.tiktok, 60);
  if (!profile.phone) {
    const whatsapp = (input.social?.whatsapp ?? "").replace(/\D/g, "");
    const phone = (input.social?.phone ?? "").trim();
    if (whatsapp.length >= 10) fill.phone = `+${whatsapp}`.slice(0, 40);
    else if (phone) fill.phone = phone.slice(0, 40);
  }
  if (Object.keys(fill).length > 0) {
    await prisma.brandProfile.update({ where: { id: brandId }, data: fill });
  }

  return {
    colors: Boolean(patch.colors),
    fonts: Boolean(patch.typography),
    announcements: Boolean(patch.announcementBar),
    published,
    logo,
    favicon,
    profileFields: Object.keys(fill),
  };
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
export async function downloadImage(
  sourceUrl: string,
  name: string,
  fetchImpl: FetchLike = defaultFetch,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<File> {
  const response = await fetchImageSafely(fetchImpl, sourceUrl);
  if (!response.ok) throw new ShopifyStoreError(`La imagen respondió ${response.status}.`);
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = IMAGE_TYPES[type];
  if (!ext) throw new ShopifyStoreError(`Formato de imagen no permitido (${type || "desconocido"}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new ShopifyStoreError("La imagen llegó vacía.");
  if (bytes.byteLength > maxBytes) throw new ShopifyStoreError(`La imagen pesa más de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  return new File([bytes], `${name}.${ext}`, { type });
}
