import { requireCreatorProfile } from "@/lib/current-creator";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { CreatorSamplesPanel } from "@/components/portal/creator-samples-panel";
import {
  listSampleEligibleProducts,
  listCreatorSampleRequests,
  listCreatorSampleOffers,
} from "@/server/services/sample-service";
import { SAMPLES_ENABLED } from "@/lib/features";
import type { SampleShipping } from "@/components/portal/sample-shipping-fields";

/// Su última dirección de muestra (CreatorProfile.savedShipping); si nunca
/// ha pedido una, lo que ya sabemos de su perfil para adelantar campos.
function defaultShippingFor(
  profile: {
    savedShipping: unknown;
    legalName: string | null;
    documentId: string | null;
    phone: string | null;
    city: string | null;
  },
  email: string,
): SampleShipping {
  const saved = (profile.savedShipping ?? {}) as Partial<SampleShipping>;
  return {
    shippingName: saved.shippingName ?? profile.legalName ?? "",
    shippingDocument: saved.shippingDocument ?? profile.documentId ?? "",
    shippingEmail: saved.shippingEmail ?? email,
    shippingPhone: saved.shippingPhone ?? profile.phone ?? "",
    shippingRegion: saved.shippingRegion ?? "",
    shippingCity: saved.shippingCity ?? profile.city ?? "",
    shippingAddress: saved.shippingAddress ?? "",
    shippingNotes: saved.shippingNotes ?? "",
  };
}

export default async function CreadorMuestrasPage() {
  // Función apagada (ver src/lib/features.ts).
  if (!SAMPLES_ENABLED) notFound();

  const profile = await requireCreatorProfile();
  if (!profile) redirect("/login");

  const [products, requests, offers, user] = await Promise.all([
    listSampleEligibleProducts(),
    listCreatorSampleRequests(profile.id),
    listCreatorSampleOffers(profile.id),
    prisma.user.findUniqueOrThrow({ where: { id: profile.userId }, select: { email: true } }),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MUESTRAS
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Solicitar muestras
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
          sampleContentType: p.sampleContentType,
          sampleInstructions: p.sampleInstructions,
          sampleDeadlineDays: p.sampleDeadlineDays,
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
        initialOffers={offers.map((o) => ({
          id: o.id,
          quantity: o.quantity,
          message: o.message,
          createdAt: o.createdAt.toISOString(),
          product: { name: o.product.name, imageUrl: o.product.imageUrl },
          brand: { companyName: o.brand.companyName },
        }))}
        defaultShipping={defaultShippingFor(profile, user.email)}
      />
    </div>
  );
}
