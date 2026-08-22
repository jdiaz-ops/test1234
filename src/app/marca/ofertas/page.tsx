import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listOffersForBrand } from "@/server/services/offer-service";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import { OffersPanel } from "@/components/portal/offers-panel";

export default async function OfertasPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

  const [offers, categories, summary] = await Promise.all([
    listOffersForBrand(profile.id),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getBrandDashboardSummary(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">OFERTA Y COMISIÓN</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Tu programa de afiliados</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        La comisión que definas es 100% para el creador. La tarifa de
        Marcolini se cobra aparte, nunca se descuenta de lo que él gana.
      </p>

      <OffersPanel
        offers={offers.map((o) => ({
          ...o,
          defaultCommissionPercent: Number(o.defaultCommissionPercent),
          defaultDiscountPercent: Number(o.defaultDiscountPercent),
        }))}
        categories={categories}
        platformFeePercent={summary.platformFeePercent}
        vatPercent={summary.vatPercent}
      />
    </div>
  );
}
