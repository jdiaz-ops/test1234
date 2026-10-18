import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { oldPolicyTarget } from "@/server/services/storefront-redirect-service";

/// /policies/{kind} de Shopify (envíos, cambios, privacidad, términos) →
/// la política importada como página (ver storefront-redirect-service.ts).
export default async function OldPolicyPage({ params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();
  const basePath = await getStoreBasePath(slug);
  const target = await oldPolicyTarget(brand.id, kind);
  permanentRedirect(target === "/" ? basePath || "/" : `${basePath}${target}`);
}
