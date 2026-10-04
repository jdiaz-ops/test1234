import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  listActiveOffers,
  getEnrollmentsForCreator,
} from "@/server/services/marketplace-service";
import { listCreatorInvitations } from "@/server/services/recruit-service";
import { JoinOfferButton } from "@/components/portal/join-offer-button";
import { LeaveOfferButton } from "@/components/portal/leave-offer-button";
import { BrandMiniProfile } from "@/components/portal/brand-mini-profile";
import { InvitationsPanel } from "@/components/portal/invitations-panel";
import { SAMPLES_ENABLED } from "@/lib/features";
import { publicStoreUrl } from "@/lib/store-url";
import Link from "next/link";

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ vertical?: string; buscar?: string; muestras?: string; pestana?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

  const [allOffers, enrollments, verticals, invitations] = await Promise.all([
    listActiveOffers({
      verticalIds: params.vertical ? [params.vertical] : undefined,
      search: params.buscar,
    }),
    getEnrollmentsForCreator(profile.id),
    prisma.vertical.findMany({ orderBy: { name: "asc" } }),
    listCreatorInvitations(profile.id),
  ]);

  // Filtro "solo con muestras" — aparte del query de Prisma porque es un
  // cruce con datos que ya vienen incluidos (brand.products), no hace
  // falta otra vuelta a la base de datos.
  const soloMuestras = SAMPLES_ENABLED && params.muestras === "1";
  const offers = soloMuestras
    ? allOffers.filter((o) => o.brand.products.length > 0)
    : allOffers;

  // Solo ACTIVE/PENDING_APPROVAL cuentan como "unido" — un creador que se
  // retiró (REMOVED) o que fue rechazado (REJECTED) debe poder volver a ver
  // el botón de unirse, no quedar atascado mostrando un estado viejo.
  const enrollmentByOffer = new Map(
    enrollments
      .filter((e) => e.status === "ACTIVE" || e.status === "PENDING_APPROVAL")
      .map((e) => [e.offerId, e]),
  );

  // Dos pestañas: "Explorar marcas" (las que todavía no tiene) y "Tus
  // marcas" (a las que ya está unida). Antes iban una debajo de la otra
  // (pedido del 2026-10-04).
  const joinedOffers = offers.filter((o) => enrollmentByOffer.has(o.id));
  const exploreOffers = offers.filter((o) => !enrollmentByOffer.has(o.id));
  const tab = params.pestana === "tuyas" ? "tuyas" : "explorar";
  const filtered = Boolean(params.buscar || params.vertical || soloMuestras);
  function tabHref(target: "explorar" | "tuyas") {
    const q = new URLSearchParams();
    if (params.buscar) q.set("buscar", params.buscar);
    if (params.vertical) q.set("vertical", params.vertical);
    if (soloMuestras) q.set("muestras", "1");
    if (target === "tuyas") q.set("pestana", "tuyas");
    const query = q.toString();
    return `/creador/marketplace${query ? `?${query}` : ""}`;
  }
  const shownOffers = tab === "tuyas" ? joinedOffers : exploreOffers;

  function OfferCard({ offer }: { offer: (typeof offers)[number] }) {
    const enrollment = enrollmentByOffer.get(offer.id);
    return (
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 flex flex-col">
        <BrandMiniProfile
          companyName={offer.brand.companyName}
          logoUrl={offer.brand.logoUrl}
          description={offer.brand.description}
          // La tienda de la marca dentro de Marcolini (donde de verdad
          // compran con el código del creador); la web externa solo si
          // todavía no tiene tienda.
          websiteUrl={publicStoreUrl(offer.brand) ?? offer.brand.websiteUrl}
        />

        {/* Tipos de oportunidad — hoy toda oferta es afiliado (comisión),
            pero algunas marcas TAMBIÉN regalan muestras a quien se una. No
            es información nueva (ya existía en Mi tienda → Muestras de esa
            marca), solo se hace visible acá para que el creador sepa de una
            qué más puede sacar de esa marca, sin tener que ir a buscarlo. */}
        {/* "Afiliado" se quitó: hoy toda oferta lo es, no distinguía nada. */}
        {SAMPLES_ENABLED && offer.brand.products.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-purple-100 text-purple-700">
              Puedes solicitar muestras
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 my-4">
          <div className="rounded-xl bg-brand-bg px-3 py-2.5">
            <p className="font-mono text-base font-medium text-brand-ink leading-tight">
              {Number(offer.defaultDiscountPercent)}%
            </p>
            <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">
              Descuento para tu comunidad
            </p>
          </div>
          <div className="rounded-xl bg-brand-accent-soft px-3 py-2.5">
            <p className="font-mono text-base font-medium text-brand-accent leading-tight">
              {Number(offer.defaultCommissionPercent)}%
            </p>
            <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">
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
        {tab === "tuyas" && <input type="hidden" name="pestana" value="tuyas" />}
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
        {SAMPLES_ENABLED && (
          <label className="flex items-center gap-2 text-sm text-brand-ink-soft px-1">
            <input
              type="checkbox"
              name="muestras"
              value="1"
              defaultChecked={soloMuestras}
            />
            Solo con muestras para solicitar
          </label>
        )}
        <button
          type="submit"
          className="border border-brand-line rounded-md px-4 py-2 text-sm hover:bg-brand-accent-soft"
        >
          Filtrar
        </button>
      </form>

      <InvitationsPanel
        initialInvitations={invitations.map((inv) => ({
          id: inv.id,
          commissionPercentOverride: inv.commissionPercentOverride
            ? Number(inv.commissionPercentOverride)
            : null,
          discountPercentOverride: inv.discountPercentOverride
            ? Number(inv.discountPercentOverride)
            : null,
          message: inv.message,
          createdAt: inv.createdAt.toISOString(),
          offer: {
            name: inv.offer.name,
            defaultCommissionPercent: Number(
              inv.offer.defaultCommissionPercent,
            ),
            defaultDiscountPercent: Number(inv.offer.defaultDiscountPercent),
            brand: {
              companyName: inv.offer.brand.companyName,
              logoUrl: inv.offer.brand.logoUrl,
            },
          },
        }))}
        suggestedCode={profile.baseCode}
      />

      <div className="flex gap-1 border-b border-brand-line mb-6" role="tablist">
        {(
          [
            { key: "explorar", label: "Explorar marcas", count: exploreOffers.length },
            { key: "tuyas", label: "Tus marcas", count: joinedOffers.length },
          ] as const
        ).map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-brand-accent text-brand-ink"
                : "border-transparent text-brand-ink-soft hover:text-brand-ink"
            }`}
          >
            {t.label} <span className="font-mono text-xs text-brand-ink-soft">{t.count}</span>
          </Link>
        ))}
      </div>

      {shownOffers.length === 0 ? (
        <div className="text-sm text-brand-ink-soft">
          {tab === "tuyas" ? (
            filtered ? (
              <p>Ninguna de tus marcas coincide con ese filtro.</p>
            ) : (
              <p>
                Todavía no te has unido a ninguna marca.{" "}
                <Link href={tabHref("explorar")} className="text-brand-accent font-medium hover:underline">
                  Explora marcas →
                </Link>
              </p>
            )
          ) : filtered ? (
            <p>No hay marcas por explorar con ese filtro.</p>
          ) : (
            <p>Ya estás unida a todas las marcas disponibles. Pronto llegan más.</p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {shownOffers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
