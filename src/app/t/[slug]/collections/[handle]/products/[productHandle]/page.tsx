import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import {
  findStorefrontProductByShopifyHandle,
  getStorefrontBrand,
  getStorefrontProduct,
} from "@/server/services/store-order-service";
import { oldCollectionTarget } from "@/server/services/storefront-redirect-service";

/// /collections/{coleccion}/products/{handle}: así enlaza Shopify los
/// productos desde una colección. Va a la ficha del producto; si ya no
/// existe, a la colección.
export default async function OldCollectionProductPage({
  params,
}: {
  params: Promise<{ slug: string; handle: string; productHandle: string }>;
}) {
  const { slug, handle, productHandle } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();
  const basePath = await getStoreBasePath(slug);
  const byHandle = await findStorefrontProductByShopifyHandle(brand.id, productHandle);
  if (byHandle?.slug) permanentRedirect(`${basePath}/${byHandle.slug}`);
  if (await getStorefrontProduct(brand.id, productHandle)) permanentRedirect(`${basePath}/${productHandle}`);
  permanentRedirect(`${basePath}${await oldCollectionTarget(brand.id, handle)}`);
}
