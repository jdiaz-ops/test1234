import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listEnrollmentsForBrand } from "@/server/services/enrollment-management-service";
import { listBrandSampleCatalog } from "@/server/services/sample-service";
import { EnrollmentsPanel } from "@/components/portal/enrollments-panel";

export default async function CreadoresVinculadosPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const [enrollments, products] = await Promise.all([
    listEnrollmentsForBrand(profile.id),
    listBrandSampleCatalog(profile.id),
  ]);
  const sampleProducts = products.filter(
    (p) => p.sampleEnabled && p.sampleStock > 0,
  );

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        CREADORES VINCULADOS
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">
        Creadores en tu programa
      </h1>

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
        sampleProducts={sampleProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sampleStock: p.sampleStock,
        }))}
      />
    </div>
  );
}
