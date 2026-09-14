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
        El catálogo de tu tienda en Marcolini.
      </p>
      <StoreSubNav />
      <StoreProductsPanel
        initialProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          images: p.images.map((img) => img.url),
          imageUrl: p.imageUrl,
          price: Number(p.price),
          compareAtPrice:
            p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
          slug: p.slug,
          sku: p.sku,
          barcode: p.barcode,
          weight: p.weight != null ? Number(p.weight) : null,
          stock: p.stock,
          available: p.available,
          type: p.type,
          serviceModality: p.serviceModality,
          serviceDurationMinutes: p.serviceDurationMinutes,
          serviceLocation: p.serviceLocation,
          collectionIds: p.brandCollections.map((c) => c.collectionId),
          hasVariants: p.hasVariants,
          optionNames: p.optionNames,
          variants: p.variants.map((v) => ({
            id: v.id,
            option1Value: v.option1Value,
            option2Value: v.option2Value,
            option3Value: v.option3Value,
            price: v.price != null ? Number(v.price) : null,
            sku: v.sku,
            barcode: v.barcode,
            stock: v.stock,
            weight: v.weight != null ? Number(v.weight) : null,
          })),
        }))}
      />
    </div>
  );
}
