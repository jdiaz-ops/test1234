import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontBrand } from "@/server/services/store-order-service";

/// /search?q= de Shopify → el buscador de la vitrina.
export default async function OldSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  if (!(await getStorefrontBrand(slug))) notFound();
  const basePath = await getStoreBasePath(slug);
  permanentRedirect(`${basePath}/buscar${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}
