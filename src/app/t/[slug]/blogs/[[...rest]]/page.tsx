import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontBrand } from "@/server/services/store-order-service";

/// /blogs/… de Shopify: la vitrina no tiene blog, así que un link viejo
/// va a la portada en vez de a una página rota.
export default async function OldBlogPage({ params }: { params: Promise<{ slug: string; rest?: string[] }> }) {
  const { slug } = await params;
  if (!(await getStorefrontBrand(slug))) notFound();
  permanentRedirect((await getStoreBasePath(slug)) || "/");
}
