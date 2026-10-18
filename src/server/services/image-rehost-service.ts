import { prisma } from "@/lib/prisma";
import { optimizeImageUpload } from "@/lib/image-optimize";
import { uploadFile } from "@/lib/file-upload";
import { downloadImage } from "@/server/services/shopify-design-import-service";
import type { FetchLike } from "@/server/services/shopify-store-reader";

/// Copia a Marcolini las fotos que todavía viven en otro servidor (las
/// importadas de Shopify quedan enlazadas a cdn.shopify.com): se
/// descargan, se comprimen como cualquier foto subida (ver
/// image-optimize.ts) y se suben al almacenamiento de Marcolini, y todas
/// las filas que apuntaban a la URL vieja pasan a la nueva. Así el día que
/// la marca cierre su Shopify no se rompe nada. Se hace de a pocas por
/// request (el navegador repite hasta que no quede ninguna) para caber en
/// el tiempo máximo de una función de Vercel. Ver conversación del
/// 2026-10-18.

/// Lo que ya es nuestro: rutas relativas (public/uploads en local) y el
/// Blob de Vercel.
const OWN_HOST_SUFFIXES = ["vercel-storage.com", "marcolini.lat"];
/// Las fotos de Shopify pueden pesar bastante antes de comprimirlas.
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const MAX_SCAN = 2000;

export function isExternalImageUrl(url: string | null | undefined): url is string {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !OWN_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

/// URLs externas distintas, de más antigua a más nueva, sin las que ya se
/// intentaron y fallaron en esta pasada.
async function findExternalImages(brandId: string, exclude: Set<string>) {
  const [images, products, variants, collections] = await Promise.all([
    prisma.productImage.findMany({
      where: { product: { brandId }, url: { startsWith: "http" } },
      select: { url: true },
      orderBy: { createdAt: "asc" },
      take: MAX_SCAN,
    }),
    prisma.product.findMany({
      where: { brandId, imageUrl: { startsWith: "http" } },
      select: { imageUrl: true },
      take: MAX_SCAN,
    }),
    prisma.productVariant.findMany({
      where: { product: { brandId }, imageUrl: { startsWith: "http" } },
      select: { imageUrl: true },
      take: MAX_SCAN,
    }),
    prisma.brandCollection.findMany({
      where: { brandId },
      select: { imageUrl: true, bannerUrl: true, bannerMobileUrl: true },
    }),
  ]);
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (url: string | null) => {
    if (!isExternalImageUrl(url) || seen.has(url) || exclude.has(url)) return;
    seen.add(url);
    urls.push(url);
  };
  for (const i of images) add(i.url);
  for (const p of products) add(p.imageUrl);
  for (const v of variants) add(v.imageUrl);
  for (const c of collections) {
    add(c.imageUrl);
    add(c.bannerUrl);
    add(c.bannerMobileUrl);
  }
  return urls;
}

export async function countExternalImages(brandId: string, exclude: string[] = []) {
  const urls = await findExternalImages(brandId, new Set(exclude));
  return { total: urls.length };
}

export type RehostResult = {
  saved: { url: string; newUrl: string }[];
  failed: { url: string; error: string }[];
  /// Cuántas externas quedan (sin contar las que fallaron en esta pasada
  /// ni las que el navegador pidió saltar).
  remaining: number;
};

export async function rehostImages(
  brandId: string,
  options: { limit?: number; skip?: string[] } = {},
  fetchImpl?: FetchLike,
): Promise<RehostResult> {
  const limit = Math.max(1, Math.min(10, options.limit ?? 6));
  const exclude = new Set(options.skip ?? []);
  const pending = await findExternalImages(brandId, exclude);
  const saved: RehostResult["saved"] = [];
  const failed: RehostResult["failed"] = [];

  for (const url of pending.slice(0, limit)) {
    try {
      const file = await downloadImage(url, "foto", fetchImpl, MAX_DOWNLOAD_BYTES);
      const optimized = await optimizeImageUpload(file);
      const newUrl = await uploadFile(optimized, `marcas/${brandId}/fotos`);
      await prisma.$transaction([
        prisma.productImage.updateMany({ where: { url, product: { brandId } }, data: { url: newUrl } }),
        prisma.product.updateMany({ where: { brandId, imageUrl: url }, data: { imageUrl: newUrl } }),
        prisma.productVariant.updateMany({ where: { imageUrl: url, product: { brandId } }, data: { imageUrl: newUrl } }),
        prisma.brandCollection.updateMany({ where: { brandId, imageUrl: url }, data: { imageUrl: newUrl } }),
        prisma.brandCollection.updateMany({ where: { brandId, bannerUrl: url }, data: { bannerUrl: newUrl } }),
        prisma.brandCollection.updateMany({ where: { brandId, bannerMobileUrl: url }, data: { bannerMobileUrl: newUrl } }),
      ]);
      saved.push({ url, newUrl });
    } catch (err) {
      const error = err instanceof Error ? err.message : "No se pudo copiar esta foto.";
      console.error(`[fotos] ${url}:`, error);
      failed.push({ url, error });
      exclude.add(url);
    }
  }

  const remaining = (await findExternalImages(brandId, exclude)).length;
  return { saved, failed, remaining };
}
