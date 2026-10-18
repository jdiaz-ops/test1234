import { notFound, permanentRedirect } from "next/navigation";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontBrand } from "@/server/services/store-order-service";

/// /account/… de Shopify (la cuenta del cliente): acá no hay cuentas de
/// compradores, así que va a la portada.
export default async function OldAccountPage({ params }: { params: Promise<{ slug: string; rest?: string[] }> }) {
  const { slug } = await params;
  if (!(await getStorefrontBrand(slug))) notFound();
  permanentRedirect((await getStoreBasePath(slug)) || "/");
}
