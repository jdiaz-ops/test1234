import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import {
  listManualProducts,
  toManualProductSummary,
} from "@/server/services/brand-store-product-service";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StoreProductsPanel } from "@/components/portal/store-products-panel";

export default async function TiendaProductosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const products = await listManualProducts(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Crear productos
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        El catálogo de tu tienda en Marcolini.
      </p>
      <StoreSubNav />
      <StoreProductsPanel initialProducts={products.map(toManualProductSummary)} />
    </div>
  );
}
