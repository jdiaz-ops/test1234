import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { CopyButton } from "@/components/portal/copy-button";
import { LeaveOfferButton } from "@/components/portal/leave-offer-button";

/// Shopify soporta de fábrica un link que aplica el descuento solo, sin que
/// el cliente tenga que escribir el código — `tienda.myshopify.com/discount/CODIGO`.
/// WooCommerce no trae nada equivalente (necesitaría un plugin o código
/// adicional en la tienda de cada marca, fuera de nuestro control), así que
/// para esas marcas solo se ofrece el link normal de su web, sin intentar
/// armar un link "inteligente" que no podemos garantizar que funcione.
function buildShopifyDiscountLink(storeUrl: string | null, code: string) {
  if (!storeUrl) return null;
  try {
    const host = new URL(storeUrl).host;
    return `https://${host}/discount/${encodeURIComponent(code)}`;
  } catch {
    return null;
  }
}

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
            const smartLink =
              brand.storeType === "SHOPIFY" ? buildShopifyDiscountLink(brand.storeUrl, e.discountCode) : null;
            return (
              <div key={e.id} className="rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{brand.companyName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-brand-accent">{e.discountCode}</span>
                      <CopyButton value={e.discountCode} />
                    </div>
                  </div>
                  <LeaveOfferButton enrollmentId={e.id} />
                </div>
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">{Number(discount)}%</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Código de descuento para tu comunidad</p>
                  </div>
                  <div className="rounded-xl bg-brand-accent-soft px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-accent leading-tight">{Number(commission)}%</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Tu comisión por cada venta con tu código</p>
                  </div>
                </div>
                {(brand.websiteUrl || smartLink) && (
                  <div className="space-y-1.5 pt-3 border-t border-brand-line">
                    {brand.websiteUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-brand-ink-soft w-28 shrink-0">Web de la marca</span>
                        <span className="text-xs font-mono text-brand-ink truncate">{brand.websiteUrl}</span>
                        <CopyButton value={brand.websiteUrl} />
                      </div>
                    )}
                    {smartLink && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-brand-ink-soft w-28 shrink-0">Con tu descuento</span>
                        <span className="text-xs font-mono text-brand-ink truncate">{smartLink}</span>
                        <CopyButton value={smartLink} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
