import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listOffersForBrand } from "@/server/services/offer-service";
import { listBrandSampleCatalog } from "@/server/services/sample-service";
import { CreatorDirectoryPanel } from "@/components/portal/creator-directory-panel";
import { SAMPLES_ENABLED } from "@/lib/features";
import { CreatorsTabs } from "@/components/portal/creators-tabs";
import { getPlatformConfig } from "@/server/services/admin-config-service";

export default async function BuscarCreadoresPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [verticals, offers, products, boxes, config] = await Promise.all([
    prisma.vertical.findMany({ orderBy: { name: "asc" } }),
    listOffersForBrand(profile.id),
    listBrandSampleCatalog(profile.id),
    // Cajas PR que se pueden proponer (ver pr-box-service.ts).
    SAMPLES_ENABLED
      ? prisma.prBox.findMany({ where: { brandId: profile.id, status: "OPEN", allowProposals: true, unitsUsed: { lt: prisma.prBox.fields.units } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, units: true, unitsUsed: true } })
      : Promise.resolve([]),
    getPlatformConfig(),
  ]);

  const activeOffers = offers.filter((o) => o.status === "ACTIVE");
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
      <CreatorsTabs active="buscar" />
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Encuentra creadores activados en Marcolini e invítalos directo a tu
        programa, con la comisión que quieras ofrecerles — o regálales una
        muestra para que te conozcan.
      </p>

      <CreatorDirectoryPanel
        verticals={verticals.map((v) => ({ id: v.id, name: v.name }))}
        offers={activeOffers.map((o) => ({
          id: o.id,
          name: o.name,
          defaultCommissionPercent: Number(o.defaultCommissionPercent),
          defaultDiscountPercent: Number(o.defaultDiscountPercent),
        }))}
        sampleProducts={sampleProducts.map((p) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          sampleStock: p.sampleStock,
        }))}
        prBoxes={boxes.map((b) => ({ id: b.id, name: b.name, left: b.units - b.unitsUsed }))}
        // Para armar el programa ahí mismo si todavía no tiene (ver OfferForm).
        platformFeePercent={profile.platformFeePercentOverride ? Number(profile.platformFeePercentOverride) : Number(config.defaultPlatformFeePercent)}
        vatPercent={Number(config.vatPercent)}
      />
    </div>
  );
}
