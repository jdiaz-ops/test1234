import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StoreSamplesPanel } from "@/components/portal/store-samples-panel";
import {
  listBrandSampleCatalog,
  listBrandSampleRequests,
} from "@/server/services/sample-service";

export default async function TiendaMuestrasPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [products, requests] = await Promise.all([
    listBrandSampleCatalog(profile.id),
    listBrandSampleRequests(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Muestras
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Regala productos a creadores para que los prueben y los muestren en su
        contenido — inspirado en las muestras de TikTok Shop.
      </p>
      <StoreSubNav />
      <StoreSamplesPanel
        initialProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          price: Number(p.price),
          manual: p.manual,
          sampleEnabled: p.sampleEnabled,
          sampleStock: p.sampleStock,
          sampleContentType: p.sampleContentType,
          sampleInstructions: p.sampleInstructions,
          sampleDeadlineDays: p.sampleDeadlineDays,
        }))}
        initialRequests={requests.map((r) => ({
          id: r.id,
          status: r.status,
          quantity: r.quantity,
          message: r.message,
          shippingName: r.shippingName,
          shippingPhone: r.shippingPhone,
          shippingAddress: r.shippingAddress,
          shippingCity: r.shippingCity,
          shippingNotes: r.shippingNotes,
          rejectedReason: r.rejectedReason,
          createdAt: r.createdAt.toISOString(),
          creator: { displayName: r.creator.displayName },
          product: { name: r.product.name, imageUrl: r.product.imageUrl },
        }))}
      />
    </div>
  );
}
