import { auth } from "@/auth";
import { getBrandProfileByUserId } from "@/server/services/brand-profile-service";
import { listProductsForBrand } from "@/server/services/product-service";
import { ProductsPanel } from "@/components/portal/products-panel";

export default async function MarcaProductosPage() {
  const session = await auth();
  const profile = await getBrandProfileByUserId(session!.user.id);
  const products = await listProductsForBrand(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">PRODUCTOS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Tu catálogo</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Trae tus productos desde tu tienda para que los creadores puedan armar colecciones con fotos y
        precios reales en su vitrina — y destaca hasta 3 para que aparezcan primero.
      </p>

      <ProductsPanel
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          price: Number(p.price),
          currency: p.currency,
          available: p.available,
          featured: p.featured,
        }))}
        storeConnected={profile.storeConnectionStatus === "CONNECTED" && profile.storeType !== "OTHER"}
        lastSyncedAt={profile.storeLastSyncedAt?.toISOString() ?? null}
      />
    </div>
  );
}
