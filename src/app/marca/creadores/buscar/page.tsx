import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listOffersForBrand } from "@/server/services/offer-service";
import { listBrandSampleCatalog } from "@/server/services/sample-service";
import { CreatorDirectoryPanel } from "@/components/portal/creator-directory-panel";

export default async function BuscarCreadoresPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [verticals, offers, products] = await Promise.all([
    prisma.vertical.findMany({ orderBy: { name: "asc" } }),
    listOffersForBrand(profile.id),
    listBrandSampleCatalog(profile.id),
  ]);

  const activeOffers = offers.filter((o) => o.status === "ACTIVE");
  const sampleProducts = products.filter(
    (p) => p.sampleEnabled && p.sampleStock > 0,
  );

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        BUSCAR CREADORES
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Recluta creadores
      </h1>
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
      />
    </div>
  );
}
