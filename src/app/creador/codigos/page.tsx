import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { CopyButton } from "@/components/portal/copy-button";
import { LeaveOfferButton } from "@/components/portal/leave-offer-button";

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
        El link que compartes con tu audiencia es tu vitrina — este es solo tu referencia rápida, para
        cuando necesitas escribir un código a mano (en un live, respondiendo un DM, atención al cliente).
      </p>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no te has unido a ninguna marca.{" "}
          <a href="/creador/marketplace" className="text-brand-accent font-medium hover:underline">
            Ve al marketplace →
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Marca</th>
                <th className="px-5 py-3 font-normal">Código</th>
                <th className="px-5 py-3 font-normal">Comisión</th>
                <th className="px-5 py-3 font-normal">Descuento</th>
                <th className="px-5 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {active.map((e) => {
                const commission = e.commissionPercentOverride ?? e.offer.defaultCommissionPercent;
                const discount = e.discountPercentOverride ?? e.offer.defaultDiscountPercent;
                return (
                  <tr key={e.id}>
                    <td className="px-5 py-3 text-brand-ink">{e.offer.brand.companyName}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-brand-accent">{e.discountCode}</span>
                        <CopyButton value={e.discountCode} />
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-brand-ink">{Number(commission)}%</td>
                    <td className="px-5 py-3 font-mono text-brand-ink-soft">{Number(discount)}%</td>
                    <td className="px-5 py-3 text-right">
                      <LeaveOfferButton enrollmentId={e.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
