import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { CopyButton } from "@/components/portal/copy-button";
import { LeaveOfferButton } from "@/components/portal/leave-offer-button";
import { buildBrandStoreLink } from "@/lib/brand-store-link";

export default async function CodigosPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const enrollments = await getEnrollmentsForCreator(profile.id);
  const active = enrollments.filter((e) => e.status === "ACTIVE");

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MIS CÓDIGOS Y LINKS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Un código por marca
      </h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-xl">
        Aquí tienes todos tus códigos en un solo lugar — útil para cuando necesitas escribirlo a mano (en
        un live, respondiendo un DM, atención al cliente). Para compartir con tu audiencia, usa siempre tu
        vitrina.
      </p>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no te has unido a ninguna marca.{" "}
          <a href="/creador/marketplace" className="text-brand-accent font-medium hover:underline">
            Ve al marketplace →
          </a>
        </div>
      ) : (
        // Tarjetas en vez de tabla — así la explicación de a quién le
        // corresponde cada número (descuento/comisión) puede ir pegada al
        // número mismo, en vez de una nota aparte arriba que quedaba lejos
        // de las columnas. Mismas etiquetas exactas que en el marketplace y
        // "únete a marcas", para que sea consistente en todo el ecosistema.
        <div className="space-y-4">
          {active.map((e) => {
            const commission = e.commissionPercentOverride ?? e.offer.defaultCommissionPercent;
            const discount = e.discountPercentOverride ?? e.offer.defaultDiscountPercent;
            const { brand } = e.offer;
            const storeLink = buildBrandStoreLink(brand, e.discountCode);
            const linkHasCode = brand.storeType === "SHOPIFY" && Boolean(brand.storeUrl);
            return (
              <div key={e.id} className="rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <p className="font-display font-semibold text-brand-ink">{brand.companyName}</p>
                  <LeaveOfferButton enrollmentId={e.id} />
                </div>

                {/* Código y link van juntos, en un mismo bloque — son las dos
                    piezas de lo mismo (compartir), no dos cosas separadas. */}
                <div className="rounded-xl border border-brand-line px-3 py-2.5 mb-3 divide-y divide-brand-line">
                  <div className="pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-brand-accent font-medium">{e.discountCode}</span>
                      <CopyButton value={e.discountCode} />
                    </div>
                    <p className="text-xs text-brand-ink-soft mt-0.5">Tu código para compartir</p>
                  </div>
                  {storeLink && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-brand-ink truncate">{storeLink}</span>
                        <CopyButton value={storeLink} />
                      </div>
                      <p className="text-xs text-brand-ink-soft mt-0.5">
                        {linkHasCode ? "Link de la tienda, con tu código ya aplicado" : "Link de la tienda para compartir"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">{Number(discount)}%</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Código de descuento para tu comunidad</p>
                  </div>
                  <div className="rounded-xl bg-brand-accent-soft px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-accent leading-tight">{Number(commission)}%</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Tu comisión por cada venta con tu código</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
