import { notFound } from "next/navigation";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { StoreHeader } from "@/components/storefront/store-header";
import { CartList } from "@/components/storefront/cart-list";
import { getStoreBasePath } from "@/lib/store-base-path";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";

/// Sigue existiendo como página propia (por si alguien entra directo a
/// esta URL o la comparte) — el flujo normal ahora es el drawer del
/// carrito (ver cart-drawer.tsx), que reusa el mismo <CartList/>.
export default async function StorefrontCartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();
  const [basePath, menuItems] = await Promise.all([
    getStoreBasePath(slug),
    listStorefrontMenuItems(brand.id),
  ]);

  return (
    <div className="min-h-screen bg-brand-bg">
      <StoreHeader
        brandSlug={slug}
        brandName={brand.companyName}
        logoUrl={brand.logoUrl}
        basePath={basePath}
        menuItems={menuItems}
      />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
          CARRITO
        </p>
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
          Tu pedido en {brand.companyName}
        </h1>
        <CartList brandSlug={slug} basePath={basePath} />
      </div>
    </div>
  );
}
