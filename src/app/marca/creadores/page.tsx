import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listEnrollmentsForBrand } from "@/server/services/enrollment-management-service";
import {
  listBrandSampleCatalog,
  listOpenSamplesByCreator,
} from "@/server/services/sample-service";
import { EnrollmentsPanel } from "@/components/portal/enrollments-panel";
import { SAMPLES_ENABLED } from "@/lib/features";
import { CreatorsTabs } from "@/components/portal/creators-tabs";

export default async function CreadoresVinculadosPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const [enrollments, products, openSampleRows] = await Promise.all([
    listEnrollmentsForBrand(profile.id),
    listBrandSampleCatalog(profile.id),
    SAMPLES_ENABLED ? listOpenSamplesByCreator(profile.id) : [],
  ]);
  // Sin productos para muestras mientras la función está apagada (ver
  // src/lib/features.ts): el botón "Ofrecer muestra" no aparece.
  const sampleProducts = SAMPLES_ENABLED
    ? products.filter((p) => p.sampleEnabled && p.sampleStock > 0)
    : [];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">
        Creadores
      </h1>
      <CreatorsTabs active="vinculados" />
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Los creadores que ya están en tu programa, con su código, sus ventas y
        su comisión.
      </p>

      <EnrollmentsPanel
        enrollments={enrollments.map((e) => ({
          ...e,
          commissionPercentOverride: e.commissionPercentOverride
            ? Number(e.commissionPercentOverride)
            : null,
          discountPercentOverride: e.discountPercentOverride
            ? Number(e.discountPercentOverride)
            : null,
          orderCount: e.orderCount,
          revenue: e.revenue,
          offer: {
            ...e.offer,
            defaultCommissionPercent: Number(e.offer.defaultCommissionPercent),
            defaultDiscountPercent: Number(e.offer.defaultDiscountPercent),
          },
        }))}
        openSamples={Object.fromEntries(
          openSampleRows.map((r) => [
            r.creatorId,
            {
              status: r.status === "OFFERED" ? ("OFFERED" as const) : ("PENDING" as const),
              productName: r.product.name,
            },
          ]),
        )}
        sampleProducts={sampleProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sampleStock: p.sampleStock,
        }))}
      />
    </div>
  );
}
