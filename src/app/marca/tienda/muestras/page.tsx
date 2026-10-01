import { requireBrandProfile } from "@/lib/current-brand";
import { notFound, redirect } from "next/navigation";
import { StoreSamplesPanel } from "@/components/portal/store-samples-panel";
import {
  listBrandSampleCatalog,
  listBrandSampleRequests,
} from "@/server/services/sample-service";
import { SAMPLES_ENABLED } from "@/lib/features";

export default async function TiendaMuestrasPage() {
  // Función apagada al lanzar (ver src/lib/features.ts).
  if (!SAMPLES_ENABLED) notFound();

  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [products, requests] = await Promise.all([
    listBrandSampleCatalog(profile.id),
    listBrandSampleRequests(profile.id),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Muestras
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Envía muestras de productos a creadores para que los prueben y los
        muestren en su contenido.
      </p>
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
          initiatedBy: r.initiatedBy,
          quantity: r.quantity,
          message: r.message,
          shippingName: r.shippingName,
          shippingPhone: r.shippingPhone,
          shippingAddress: r.shippingAddress,
          shippingCity: r.shippingCity,
          shippingNotes: r.shippingNotes,
          shippingEmail: r.shippingEmail,
          shippingDocument: r.shippingDocument,
          shippingRegion: r.shippingRegion,
          rejectedReason: r.rejectedReason,
          createdAt: r.createdAt.toISOString(),
          creator: { displayName: r.creator.displayName },
          product: { name: r.product.name, imageUrl: r.product.imageUrl },
        }))}
      />
    </div>
  );
}
