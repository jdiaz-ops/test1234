import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PhotoShape } from "@/lib/brand-theme";
import { downloadImage } from "@/server/services/shopify-design-import-service";
import type { FetchLike } from "@/server/services/shopify-store-reader";

/// La forma de las tarjetas de producto en "Automática" (Diseño → Página de
/// colecciones → Forma de las fotos): la que más usan las fotos de la
/// tienda, para que todas las tarjetas queden iguales — con fotos de dos
/// formas, la otra se recorta parejo, como en Shopify. Pedido del
/// 2026-10-19: con cada foto en su forma las tarjetas quedaban disparejas
/// ("esto no podemos tener"), y con todas cuadradas a las verticales se
/// les cortaba el texto de arriba y de abajo.
///
/// Se mide mirando el tamaño de hasta SAMPLE fotos y se guarda en la marca
/// (BrandProfile.photoShape); se vuelve a medir cada TTL o cuando una
/// importación lo pide (forgetPhotoShape). Mientras no se sabe, cuadradas.

const SAMPLE = 30;
const TTL_MS = 2 * 24 * 3600 * 1000;
/// Alto ÷ ancho desde el que una foto cuenta como vertical (4:5 = 1,25;
/// 3:4 = 1,33).
const PORTRAIT_FROM = 1.12;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const DEFAULT_PHOTO_SHAPE: PhotoShape = "square";

/// "portrait" si al menos la mitad de las fotos son verticales; null si no
/// hay suficientes fotos para decidir.
export function shapeFromRatios(ratios: number[]): PhotoShape | null {
  const valid = ratios.filter((r) => Number.isFinite(r) && r > 0);
  if (valid.length < 3) return null;
  return valid.filter((r) => r >= PORTRAIT_FROM).length / valid.length >= 0.5 ? "portrait" : "square";
}

/// Shopify sirve cualquier tamaño de la misma foto: se pide una chiquita.
function smallerVariant(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "cdn.shopify.com" || u.pathname.includes("/cdn/shop/")) {
      u.searchParams.set("width", "120");
      return u.href;
    }
  } catch {
    // dirección relativa
  }
  return url;
}

async function photoRatio(url: string, fetchImpl: FetchLike): Promise<number | null> {
  try {
    let bytes: Buffer;
    if (url.startsWith("/uploads/")) {
      const root = path.join(process.cwd(), "public");
      const file = path.resolve(root, `.${url}`);
      if (!file.startsWith(`${root}${path.sep}`)) return null;
      bytes = await readFile(file);
    } else {
      const file = await downloadImage(smallerVariant(url), "foto", fetchImpl, MAX_IMAGE_BYTES);
      bytes = Buffer.from(await file.arrayBuffer());
    }
    const meta = await sharp(bytes, { failOn: "none" }).metadata();
    if (!meta.width || !meta.height) return null;
    // Fotos de celular giradas por los datos de la cámara.
    const turned = (meta.orientation ?? 1) >= 5;
    return turned ? meta.width / meta.height : meta.height / meta.width;
  } catch {
    return null;
  }
}

export async function detectStorePhotoShape(brandId: string, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<PhotoShape | null> {
  const products = await prisma.product.findMany({
    where: { brandId, manual: true, available: true, imageUrl: { not: null } },
    select: { imageUrl: true },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: SAMPLE,
  });
  // Cuenta por producto (lo que muestran las tarjetas); una foto repetida
  // se baja una sola vez.
  const urls = Array.from(new Set(products.map((p) => p.imageUrl!)));
  const byUrl = new Map<string, number | null>();
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        byUrl.set(url, await photoRatio(url, fetchImpl));
      }
    }),
  );
  return shapeFromRatios(products.map((p) => byUrl.get(p.imageUrl!) ?? NaN));
}

/// Mide y guarda. Solo uno a la vez por tienda: el que logra marcar la
/// medición como suya (photoShapeAt vencido o vacío) es el que mide.
export async function refreshPhotoShape(brandId: string, fetchImpl?: FetchLike) {
  const now = new Date();
  const claimed = await prisma.brandProfile.updateMany({
    where: { id: brandId, OR: [{ photoShapeAt: null }, { photoShapeAt: { lt: new Date(now.getTime() - TTL_MS) } }] },
    data: { photoShapeAt: now },
  });
  if (claimed.count === 0) return null;
  const shape = await detectStorePhotoShape(brandId, fetchImpl);
  if (shape) await prisma.brandProfile.update({ where: { id: brandId }, data: { photoShape: shape, photoShapeAt: new Date() } });
  return shape;
}

/// La forma para mostrar ya (la guardada, o cuadradas) y, si hace falta
/// medir, se mide después de responder.
export function resolvePhotoShape(brand: { id: string; photoShape: string | null; photoShapeAt: Date | null }): PhotoShape {
  const stale = !brand.photoShapeAt || Date.now() - brand.photoShapeAt.getTime() > TTL_MS;
  if (stale) {
    after(async () => {
      await refreshPhotoShape(brand.id).catch((err) => console.error("[forma-fotos]", err instanceof Error ? err.message : err));
    });
  }
  return brand.photoShape === "portrait" || brand.photoShape === "square" ? brand.photoShape : DEFAULT_PHOTO_SHAPE;
}

/// Después de importar o reemplazar muchos productos: la próxima visita
/// vuelve a medir.
export async function forgetPhotoShape(brandId: string) {
  await prisma.brandProfile.update({ where: { id: brandId }, data: { photoShapeAt: null } });
}
