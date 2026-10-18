import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { oldPageTarget } from "@/server/services/storefront-redirect-service";

/// /pages/{handle} de Shopify → la página propia en Marcolini (ver
/// storefront-redirect-service.ts).
export default async function OldStorePage({ params }: { params: Promise<{ slug: string; handle: string }> }) {
  const { slug, handle } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();
  const basePath = await getStoreBasePath(slug);
  const target = await oldPageTarget(brand.id, handle);
  permanentRedirect(target === "/" ? basePath || "/" : `${basePath}${target}`);
}
