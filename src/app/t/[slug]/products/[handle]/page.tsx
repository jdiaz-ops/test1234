import { notFound, permanentRedirect } from "next/navigation";
import {
  getStorefrontBrand,
  getStorefrontProduct,
  findStorefrontProductByShopifyHandle,
} from "@/server/services/store-order-service";
import { getStoreBasePath } from "@/lib/store-base-path";

/// Las URLs de producto de Shopify son /products/{handle} — cuando una
/// marca migra su tienda, los links que ya repartió (Instagram, WhatsApp,
/// Google) siguen entrando por acá y se mandan a la ficha en Marcolini.
/// Ver conversación del 2026-09-30.
export default async function ShopifyProductRedirectPage({
  params,
}: {
  params: Promise<{ slug: string; handle: string }>;
}) {
  const { slug, handle } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const basePath = await getStoreBasePath(slug);
  const byHandle = await findStorefrontProductByShopifyHandle(brand.id, handle);
  if (byHandle?.slug) permanentRedirect(`${basePath}/${byHandle.slug}`);

  // Producto creado a mano cuyo slug coincide con el handle.
  const bySlug = await getStorefrontProduct(brand.id, handle);
  if (bySlug) permanentRedirect(`${basePath}/${handle}`);

  notFound();
}
