import { prisma } from "@/lib/prisma";
import { fetchShopifyProducts, ShopifyApiError, type ShopifyProduct } from "@/server/integrations/shopify-client";
import { fetchWooCommerceProducts, WooCommerceApiError, type WooCommerceProduct } from "@/server/integrations/woocommerce-client";

export class ProductSyncError extends Error {}

/// Trae el catálogo real de la tienda de la marca (Shopify o WooCommerce) y
/// lo deja reflejado en la tabla Product — es la base para que un creador
/// pueda armar colecciones con fotos/nombres/precios reales, sin que la
/// marca tenga que cargar nada a mano en Marcolini. Solo entran productos
/// publicados y con stock (ver hasStockShopify/hasStockWooCommerce) — un
/// producto agotado no sirve para recomendar.
///
/// Se dispara en tres momentos, para que la marca nunca tenga que pedirlo a
/// mano: (1) justo al conectar la tienda, en el onboarding — ver los
/// callbacks de OAuth y /api/marca/tienda; (2) cada vez que llega un
/// webhook de producto (creado/actualizado/eliminado) — ver los webhooks de
/// Shopify/WooCommerce, que simplemente vuelven a llamar esto entero en vez
/// de tratar de parchar un producto suelto (el catálogo es chico, un
/// resync completo es barato y así queda siempre consistente); y (3) una
/// vez al día por cron, de respaldo, por si algún webhook se perdió. El
/// botón "Sincronizar productos" en el portal sigue existiendo, pero ya no
/// es necesario para que el catálogo esté al día.
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

function hasStockShopify(variant: ShopifyProduct["variants"][number]) {
  // Sin gestión de inventario (inventory_management null) = Shopify no lo
  // rastrea, así que se asume siempre disponible (comportamiento estándar
  // de Shopify para "no seguir el stock").
  return variant.inventory_management === null || variant.inventory_quantity > 0;
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
  // Publicado Y con al menos una variante con stock.
  const inStock = products.filter((p) => p.status === "active" && p.variants.some(hasStockShopify));
  const syncedIds: string[] = [];

  for (const p of inStock) {
    const externalId = String(p.id);
    syncedIds.push(externalId);
    const variant = p.variants.find(hasStockShopify) ?? p.variants[0];
    const price = variant?.price ? Number(variant.price) : 0;
    const compareAt = variant?.compare_at_price ? Number(variant.compare_at_price) : null;

    const data = {
      name: p.title,
      imageUrl: p.images[0]?.src ?? null,
      price,
      compareAtPrice: compareAt && compareAt > price ? compareAt : null,
      url: `https://${host}/products/${p.handle}`,
      available: true,
      lastSyncedAt: new Date(),
    };
    await prisma.product.upsert({
      where: { brandId_externalId: { brandId, externalId } },
      create: { brandId, externalId, ...data },
      update: data,
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

  const inStock = products.filter((p: WooCommerceProduct) => p.stock_status === "instock");
  const syncedIds: string[] = [];

  for (const p of inStock) {
    const externalId = String(p.id);
    syncedIds.push(externalId);
    const onSale = p.sale_price && p.regular_price && Number(p.sale_price) < Number(p.regular_price);

    const data = {
      name: p.name,
      imageUrl: p.images[0]?.src ?? null,
      price: onSale ? Number(p.sale_price) : Number(p.price) || 0,
      compareAtPrice: onSale ? Number(p.regular_price) : null,
      category: p.categories?.[0]?.name ?? null,
      url: p.permalink,
      available: true,
      lastSyncedAt: new Date(),
    };
    await prisma.product.upsert({
      where: { brandId_externalId: { brandId, externalId } },
      create: { brandId, externalId, ...data },
      update: data,
    });
  }

  await markMissingAsUnavailable(brandId, syncedIds);
  await prisma.brandProfile.update({ where: { id: brandId }, data: { storeLastSyncedAt: new Date() } });
  return { imported: syncedIds.length, total: products.length };
}

/// Un producto que ya estaba en Marcolini pero no volvió en esta sincronización
/// (se agotó, lo quitaron de la tienda, lo despublicaron) se marca no
/// disponible — no se borra, para no romper colecciones de creadores que ya
/// lo habían agregado.
async function markMissingAsUnavailable(brandId: string, syncedExternalIds: string[]) {
  await prisma.product.updateMany({
    where: { brandId, available: true, externalId: { notIn: syncedExternalIds } },
    data: { available: false },
  });
}

/// Sincroniza todas las marcas con tienda conectada — usado por el cron
/// diario de respaldo. Nunca deja que el error de una marca tumbe a las
/// demás.
export async function syncAllConnectedBrands() {
  const brands = await prisma.brandProfile.findMany({
    where: {
      storeConnectionStatus: "CONNECTED",
      OR: [{ storeType: "SHOPIFY" }, { storeType: "WOOCOMMERCE" }],
    },
    select: { id: true },
  });

  let synced = 0;
  let failed = 0;
  for (const brand of brands) {
    try {
      await syncProductsForBrand(brand.id);
      synced += 1;
    } catch (err) {
      failed += 1;
      console.error(`[sync-productos-cron] Falló la marca ${brand.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { synced, failed, total: brands.length };
}
