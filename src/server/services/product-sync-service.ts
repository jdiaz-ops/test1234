import { prisma } from "@/lib/prisma";
import { fetchShopifyProducts, ShopifyApiError } from "@/server/integrations/shopify-client";
import { fetchWooCommerceProducts, WooCommerceApiError } from "@/server/integrations/woocommerce-client";

export class ProductSyncError extends Error {}

/// Trae el catálogo real de la tienda de la marca (Shopify o WooCommerce) y
/// lo deja reflejado en la tabla Product — es la base para que un creador
/// pueda armar colecciones con fotos/nombres/precios reales, sin que la
/// marca tenga que cargar nada a mano en Marcolini. No es en vivo (no hay
/// webhooks de productos todavía) — se dispara con un botón "Sincronizar"
/// desde el portal de la marca, cuantas veces quiera.
export async function syncProductsForBrand(brandId: string): Promise<{ imported: number; total: number }> {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });

  if (brand.storeType === "SHOPIFY" && brand.storeUrl && brand.shopifyAccessToken) {
    return syncShopify(brand.id, brand.storeUrl, brand.shopifyAccessToken);
  }
  if (brand.storeType === "WOOCOMMERCE" && brand.storeUrl && brand.wooConsumerKey && brand.wooConsumerSecret) {
    return syncWooCommerce(brand.id, brand.storeUrl, brand.wooConsumerKey, brand.wooConsumerSecret);
  }
  throw new ProductSyncError("Conecta tu tienda (Shopify o WooCommerce) antes de sincronizar productos.");
}

async function syncShopify(brandId: string, storeUrl: string, accessToken: string) {
  let products;
  try {
    products = await fetchShopifyProducts({ storeUrl, accessToken });
  } catch (err) {
    if (err instanceof ShopifyApiError) throw new ProductSyncError(err.message);
    throw err;
  }

  const host = new URL(storeUrl).host;
  const active = products.filter((p) => p.status === "active");
  const syncedIds: string[] = [];

  for (const p of active) {
    const externalId = String(p.id);
    syncedIds.push(externalId);
    const price = p.variants[0]?.price ? Number(p.variants[0].price) : 0;
    await prisma.product.upsert({
      where: { brandId_externalId: { brandId, externalId } },
      create: {
        brandId,
        externalId,
        name: p.title,
        imageUrl: p.images[0]?.src ?? null,
        price,
        url: `https://${host}/products/${p.handle}`,
        available: true,
        lastSyncedAt: new Date(),
      },
      update: {
        name: p.title,
        imageUrl: p.images[0]?.src ?? null,
        price,
        url: `https://${host}/products/${p.handle}`,
        available: true,
        lastSyncedAt: new Date(),
      },
    });
  }

  await markMissingAsUnavailable(brandId, syncedIds);
  await prisma.brandProfile.update({ where: { id: brandId }, data: { storeLastSyncedAt: new Date() } });
  return { imported: syncedIds.length, total: products.length };
}

async function syncWooCommerce(brandId: string, storeUrl: string, consumerKey: string, consumerSecret: string) {
  let products;
  try {
    products = await fetchWooCommerceProducts({ storeUrl, consumerKey, consumerSecret });
  } catch (err) {
    if (err instanceof WooCommerceApiError) throw new ProductSyncError(err.message);
    throw err;
  }

  const syncedIds: string[] = [];

  for (const p of products) {
    const externalId = String(p.id);
    syncedIds.push(externalId);
    await prisma.product.upsert({
      where: { brandId_externalId: { brandId, externalId } },
      create: {
        brandId,
        externalId,
        name: p.name,
        imageUrl: p.images[0]?.src ?? null,
        price: Number(p.price) || 0,
        url: p.permalink,
        available: true,
        lastSyncedAt: new Date(),
      },
      update: {
        name: p.name,
        imageUrl: p.images[0]?.src ?? null,
        price: Number(p.price) || 0,
        url: p.permalink,
        available: true,
        lastSyncedAt: new Date(),
      },
    });
  }

  await markMissingAsUnavailable(brandId, syncedIds);
  await prisma.brandProfile.update({ where: { id: brandId }, data: { storeLastSyncedAt: new Date() } });
  return { imported: syncedIds.length, total: products.length };
}

/// Un producto que ya estaba en Marcolini pero no volvió en esta sincronización
/// (lo quitaron de la tienda, lo despublicaron) se marca no disponible — no
/// se borra, para no romper colecciones de creadores que ya lo agregaron.
async function markMissingAsUnavailable(brandId: string, syncedExternalIds: string[]) {
  await prisma.product.updateMany({
    where: { brandId, available: true, externalId: { notIn: syncedExternalIds } },
    data: { available: false },
  });
}
