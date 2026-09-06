import { requireCreatorProfile } from "@/lib/current-creator";
import { redirect } from "next/navigation";
import { CreatorSamplesPanel } from "@/components/portal/creator-samples-panel";
import {
  listSampleEligibleProducts,
  listCreatorSampleRequests,
} from "@/server/services/sample-service";

export default async function CreadorMuestrasPage() {
  const profile = await requireCreatorProfile();
  if (!profile) redirect("/login");

  const [products, requests] = await Promise.all([
    listSampleEligibleProducts(),
    listCreatorSampleRequests(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MUESTRAS
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Pide muestras gratis
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Productos que las marcas de Marcolini regalan a creadores para que los
        prueben y los muestren en su contenido.
      </p>
      <CreatorSamplesPanel
        initialProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          sampleStock: p.sampleStock,
          brand: {
            companyName: p.brand.companyName,
            logoUrl: p.brand.logoUrl,
          },
        }))}
        initialRequests={requests.map((r) => ({
          id: r.id,
          productId: r.productId,
          status: r.status,
          quantity: r.quantity,
          rejectedReason: r.rejectedReason,
          createdAt: r.createdAt.toISOString(),
          product: { name: r.product.name, imageUrl: r.product.imageUrl },
          brand: { companyName: r.brand.companyName },
        }))}
        defaultPhone={profile.phone ?? ""}
        defaultCity={profile.city ?? ""}
      />
    </div>
  );
}
