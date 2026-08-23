import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listActiveOffers, getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { JoinOfferButton } from "@/components/portal/join-offer-button";
import { BrandMiniProfile } from "@/components/portal/brand-mini-profile";

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ vertical?: string; buscar?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

  const [offers, enrollments, verticals] = await Promise.all([
    listActiveOffers({ verticalIds: params.vertical ? [params.vertical] : undefined, search: params.buscar }),
    getEnrollmentsForCreator(profile.id),
    prisma.vertical.findMany({ orderBy: { name: "asc" } }),
  ]);

  const enrollmentByOffer = new Map(enrollments.map((e) => [e.offerId, e]));

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MARKETPLACE DE MARCAS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Marketplace de marcas</h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-xl">
        Explora las marcas, qué descuento tienen para tu audiencia y qué comisión hay para ti. Únete a los
        programas que te interesen para conseguir tu código de descuento único.
      </p>

      <form className="flex flex-wrap gap-3 mb-8" action="/creador/marketplace">
        <input
          type="text"
          name="buscar"
          defaultValue={params.buscar}
          placeholder="Buscar marca u oferta..."
          className="input max-w-xs"
        />
        <select name="vertical" defaultValue={params.vertical ?? ""} className="input max-w-xs">
          <option value="">Todas las categorías</option>
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
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
        <div className="space-y-4">
          {offers.map((offer) => {
            const enrollment = enrollmentByOffer.get(offer.id);
            return (
              <div key={offer.id} className="rounded-2xl border border-brand-line bg-brand-surface p-5">
                <BrandMiniProfile
                  companyName={offer.brand.companyName}
                  logoUrl={offer.brand.logoUrl}
                  description={offer.brand.description}
                  websiteUrl={offer.brand.websiteUrl}
                />
                <p className="text-xs text-brand-ink-soft mt-3 mb-4">
                  {offer.category?.name ?? "General"} · {offer.name}
                </p>

                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">
                      {Number(offer.defaultDiscountPercent)}%
                    </p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Código de descuento para tu comunidad</p>
                  </div>
                  <div className="rounded-xl bg-brand-accent-soft px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-accent leading-tight">
                      {Number(offer.defaultCommissionPercent)}%
                    </p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Tu comisión por cada venta con tu código</p>
                  </div>
                </div>

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
            );
          })}
        </div>
      )}
    </div>
  );
}
