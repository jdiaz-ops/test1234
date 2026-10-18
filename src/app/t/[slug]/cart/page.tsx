import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontBrand } from "@/server/services/store-order-service";

/// /cart de Shopify → el carrito de la vitrina.
export default async function OldCartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getStorefrontBrand(slug))) notFound();
  permanentRedirect(`${await getStoreBasePath(slug)}/carrito`);
}
