import { isAdminActingAsBrand, requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import {
  listManualProducts,
  toManualProductSummary,
} from "@/server/services/brand-store-product-service";
import { StoreProductsPanel } from "@/components/portal/store-products-panel";
import { publicStoreUrl } from "@/lib/store-url";

export default async function TiendaProductosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const products = await listManualProducts(profile.id);
  // La importación desde Shopify (y guardar sus fotos) es una herramienta
  // del administrador: solo aparece cuando Juan entra con "Entrar como".
  const importTools = await isAdminActingAsBrand();

  // Para el link "Ver en la tienda" de cada producto — mismo criterio que
  // en Colecciones (dominio propio activo, si no el subdominio).
  const storeUrl = publicStoreUrl(profile);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Productos
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        El catálogo de tu tienda en Marcolini.
      </p>
      <StoreProductsPanel
        initialProducts={products.map(toManualProductSummary)}
        storeUrl={storeUrl}
        importTools={importTools}
      />
    </div>
  );
}
