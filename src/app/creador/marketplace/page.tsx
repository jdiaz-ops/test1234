import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listActiveOffers, getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { JoinOfferButton } from "@/components/portal/join-offer-button";
import { BrandMiniProfile } from "@/components/portal/brand-mini-profile";

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; buscar?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

  const [offers, enrollments, categories] = await Promise.all([
    listActiveOffers({ categorySlug: params.categoria, search: params.buscar }),
    getEnrollmentsForCreator(profile.id),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const enrollmentByOffer = new Map(enrollments.map((e) => [e.offerId, e]));

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MARKETPLACE</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
        Ofertas de marcas
      </h1>

      <form className="flex flex-wrap gap-3 mb-8" action="/creador/marketplace">
        <input
          type="text"
          name="buscar"
          defaultValue={params.buscar}
          placeholder="Buscar marca u oferta..."
          className="input max-w-xs"
        />
        <select name="categoria" defaultValue={params.categoria ?? ""} className="input max-w-xs">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="border border-brand-line rounded-md px-4 py-2 text-sm hover:bg-brand-accent-soft">
          Filtrar
        </button>
      </form>

      {offers.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">No hay ofertas disponibles con ese filtro.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {offers.map((offer) => {
            const enrollment = enrollmentByOffer.get(offer.id);
            return (
              <div
                key={offer.id}
                className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden flex flex-col"
              >
                <div className="p-5">
                  <BrandMiniProfile
                    companyName={offer.brand.companyName}
                    logoUrl={offer.brand.logoUrl}
                    description={offer.brand.description}
                    websiteUrl={offer.brand.websiteUrl}
                  />
                  <p className="text-xs text-brand-ink-soft mt-3">
                    {offer.category?.name ?? "General"} · {offer.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-px bg-brand-line">
                  <div className="bg-brand-surface p-4 text-center">
                    <p className="text-xs text-brand-ink-soft mb-1">Descuento para tu comprador</p>
                    <p className="font-display text-xl font-semibold text-brand-ink">
                      {Number(offer.defaultDiscountPercent)}%
                    </p>
                  </div>
                  <div className="bg-brand-accent-soft p-4 text-center">
                    <p className="text-xs text-brand-ink-soft mb-1">Tu comisión</p>
                    <p className="font-display text-xl font-semibold text-brand-accent">
                      {Number(offer.defaultCommissionPercent)}%
                    </p>
                  </div>
                </div>

                <div className="p-5 mt-auto">
                  {enrollment ? (
                    <p
                      className={`text-sm font-medium text-center ${
                        enrollment.status === "ACTIVE" ? "text-brand-accent" : "text-brand-ink-soft"
                      }`}
                    >
                      {enrollment.status === "ACTIVE" ? "Ya estás unido ✓" : "Esperando aprobación"}
                    </p>
                  ) : (
                    <JoinOfferButton
                      offerId={offer.id}
                      joinMode={offer.joinMode}
                      suggestedCode={profile.baseCode}
                      fullWidth
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
