import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  listActiveOffers,
  getEnrollmentsForCreator,
} from "@/server/services/marketplace-service";
import { JoinOfferButton } from "@/components/portal/join-offer-button";
import { LeaveOfferButton } from "@/components/portal/leave-offer-button";
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
    listActiveOffers({
      verticalIds: params.vertical ? [params.vertical] : undefined,
      search: params.buscar,
    }),
    getEnrollmentsForCreator(profile.id),
    prisma.vertical.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Solo ACTIVE/PENDING_APPROVAL cuentan como "unido" — un creador que se
  // retiró (REMOVED) o que fue rechazado (REJECTED) debe poder volver a ver
  // el botón de unirse, no quedar atascado mostrando un estado viejo.
  const enrollmentByOffer = new Map(
    enrollments
      .filter((e) => e.status === "ACTIVE" || e.status === "PENDING_APPROVAL")
      .map((e) => [e.offerId, e]),
  );

  // Arriba las marcas a las que ya está unido (para verlas de una, sin
  // tener que buscarlas entre el resto), abajo las que puede explorar.
  const joinedOffers = offers.filter((o) => enrollmentByOffer.has(o.id));
  const exploreOffers = offers.filter((o) => !enrollmentByOffer.has(o.id));

  function OfferCard({ offer }: { offer: (typeof offers)[number] }) {
    const enrollment = enrollmentByOffer.get(offer.id);
    return (
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 flex flex-col">
        <BrandMiniProfile
          companyName={offer.brand.companyName}
          logoUrl={offer.brand.logoUrl}
          description={offer.brand.description}
          websiteUrl={offer.brand.websiteUrl}
          websiteLinkable={false}
        />

        <div className="grid grid-cols-2 gap-2 my-4">
          <div className="rounded-xl bg-brand-bg px-2.5 py-2">
            <p className="font-mono text-base font-medium text-brand-ink leading-tight">
              {Number(offer.defaultDiscountPercent)}%
            </p>
            <p className="text-[11px] text-brand-ink-soft leading-snug mt-0.5">
              Descuento para tu comunidad
            </p>
          </div>
          <div className="rounded-xl bg-brand-accent-soft px-2.5 py-2">
            <p className="font-mono text-base font-medium text-brand-accent leading-tight">
              {Number(offer.defaultCommissionPercent)}%
            </p>
            <p className="text-[11px] text-brand-ink-soft leading-snug mt-0.5">
              Tu comisión por venta
            </p>
          </div>
        </div>

        <div className="mt-auto">
          {enrollment ? (
            <div className="text-center space-y-1.5">
              <p
                className={`text-sm font-medium ${
                  enrollment.status === "ACTIVE"
                    ? "text-brand-accent"
                    : "text-brand-ink-soft"
                }`}
              >
                {enrollment.status === "ACTIVE"
                  ? "Ya estás unido ✓"
                  : "Esperando aprobación"}
              </p>
              <LeaveOfferButton enrollmentId={enrollment.id} />
            </div>
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
  }

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MARKETPLACE DE MARCAS
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Marketplace de marcas
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-xl">
        Explora las marcas, qué descuento tienen para tu audiencia y qué
        comisión hay para ti. Únete a los programas que te interesen para
        conseguir tu código de descuento único.
      </p>

      <form className="flex flex-wrap gap-3 mb-8" action="/creador/marketplace">
        <input
          type="text"
          name="buscar"
          defaultValue={params.buscar}
          placeholder="Buscar marca u oferta..."
          className="input max-w-xs"
        />
        <select
          name="vertical"
          defaultValue={params.vertical ?? ""}
          className="input max-w-xs"
        >
          <option value="">Todas las categorías</option>
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border border-brand-line rounded-md px-4 py-2 text-sm hover:bg-brand-accent-soft"
        >
          Filtrar
        </button>
      </form>

      {offers.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          No hay ofertas disponibles con ese filtro.
        </p>
      ) : (
        <>
          {joinedOffers.length > 0 && (
            <div className="mb-10">
              <h2 className="font-display font-semibold text-brand-ink mb-4">
                Tus marcas ({joinedOffers.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {joinedOffers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>
            </div>
          )}

          <div>
            {joinedOffers.length > 0 && (
              <h2 className="font-display font-semibold text-brand-ink mb-4">
                Explorar marcas ({exploreOffers.length})
              </h2>
            )}
            {exploreOffers.length === 0 ? (
              <p className="text-sm text-brand-ink-soft">
                Ya estás unido a todas las marcas disponibles con ese filtro.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {exploreOffers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
