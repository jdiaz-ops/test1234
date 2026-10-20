import { requireCreatorProfile } from "@/lib/current-creator";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { CreatorSamplesPanel } from "@/components/portal/creator-samples-panel";
import { CreatorPrBoxesPanel } from "@/components/portal/creator-pr-boxes-panel";
import { creatorPrBoxesView } from "@/server/services/creator-pr-box-view";
import {
  listSampleEligibleProducts,
  listCreatorSampleRequests,
  listCreatorSampleOffers,
} from "@/server/services/sample-service";
import { SAMPLES_ENABLED } from "@/lib/features";
import { defaultShippingFor } from "@/lib/sample-shipping";

export default async function CreadorMuestrasPage() {
  // Función apagada (ver src/lib/features.ts).
  if (!SAMPLES_ENABLED) notFound();

  const profile = await requireCreatorProfile();
  if (!profile) redirect("/login");

  const [products, requests, offers, user, prBoxes] = await Promise.all([
    listSampleEligibleProducts(),
    listCreatorSampleRequests(profile.id),
    listCreatorSampleOffers(profile.id),
    prisma.user.findUniqueOrThrow({ where: { id: profile.userId }, select: { email: true } }),
    creatorPrBoxesView(profile.id),
  ]);
  const defaultShipping = defaultShippingFor(profile, user.email);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MUESTRAS
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Solicitar muestras
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Lo que las marcas de Marcolini regalan a creadoras para que lo prueben
        y lo muestren en su contenido.
      </p>
      {/* Arriba las muestras (antes Cajas PR, también en Marketplace →
          Muestras) y abajo los productos del catálogo de cada marca
          (pedido del 2026-10-19: dejar las dos, con nombres distintos). */}
      <div className="mb-12">
        <CreatorPrBoxesPanel boxes={prBoxes.boxes} requests={prBoxes.requests} defaultShipping={defaultShipping} />
      </div>
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
        defaultShipping={defaultShipping}
      />
    </div>
  );
}
