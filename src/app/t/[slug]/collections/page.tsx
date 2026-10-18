import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontBrand } from "@/server/services/store-order-service";

/// /collections de Shopify → la lista de colecciones. Ver
/// storefront-redirect-service.ts.
export default async function OldCollectionsIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getStorefrontBrand(slug))) notFound();
  permanentRedirect(`${await getStoreBasePath(slug)}/coleccion`);
}
