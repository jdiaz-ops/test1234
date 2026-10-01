import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import {
  listManualProducts,
  toManualProductSummary,
} from "@/server/services/brand-store-product-service";
import { StoreProductsPanel } from "@/components/portal/store-products-panel";
import { ROOT_DOMAIN } from "@/lib/subdomain";

export default async function TiendaProductosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const products = await listManualProducts(profile.id);

  // Para el link "Ver en la tienda" de cada producto — mismo criterio que
  // en Colecciones (dominio propio verificado, si no el subdominio).
  const storeUrl =
    profile.customDomain && profile.customDomainVerifiedAt
      ? `https://${profile.customDomain}`
      : profile.storefrontSlug
        ? `https://${profile.storefrontSlug}.${ROOT_DOMAIN}`
        : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Productos
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        El catálogo de tu tienda en Marcolini.
      </p>
      <StoreProductsPanel initialProducts={products.map(toManualProductSummary)} storeUrl={storeUrl} />
    </div>
  );
}
