import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { listManualProducts } from "@/server/services/brand-store-product-service";
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
        El catálogo propio de tu tienda en Marcolini — independiente de Shopify
        o WooCommerce.
      </p>
      <StoreSubNav />
      <StoreProductsPanel
        initialProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          imageUrl: p.imageUrl,
          price: Number(p.price),
          compareAtPrice:
            p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
          slug: p.slug,
          stock: p.stock,
          available: p.available,
          type: p.type,
          serviceModality: p.serviceModality,
          serviceDurationMinutes: p.serviceDurationMinutes,
          serviceLocation: p.serviceLocation,
        }))}
      />
    </div>
  );
}
