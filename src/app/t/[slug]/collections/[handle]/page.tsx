import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { oldCollectionTarget } from "@/server/services/storefront-redirect-service";

/// /collections/{handle} de la tienda anterior → la colección en Marcolini
/// (ver storefront-redirect-service.ts). Los links repartidos y los de
/// Google siguen funcionando cuando la marca apaga su tienda vieja.
export default async function OldCollectionPage({ params }: { params: Promise<{ slug: string; handle: string }> }) {
  const { slug, handle } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();
  permanentRedirect(`${await getStoreBasePath(slug)}${await oldCollectionTarget(brand.id, handle)}`);
}
