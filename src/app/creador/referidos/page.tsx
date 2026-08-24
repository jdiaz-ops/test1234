import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getReferralSummaryForCreator } from "@/server/services/referral-service";
import { CopyButton } from "@/components/portal/copy-button";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Esperando su primera venta",
  QUALIFIED: "Calificó — en camino",
  PAID: "Pagado",
};

export default async function ReferidosPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
    select: { id: true },
  });
  const { baseCode, referrals, earned } = await getReferralSummaryForCreator(profile.id);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const referralLink = `${appUrl.replace(/^https?:\/\//, "")}/registro/creador?ref=${baseCode}`;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">INVITA Y GANA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Gana $20.000 por cada creador que invites
      </h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-xl">
        Comparte tu link con otro creador — cuando se registre y haga su primera venta, te
        transferimos $20.000 junto a tu próximo pago.
      </p>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-brand-ink truncate">{referralLink}</span>
          <CopyButton value={`https://${referralLink}`} />
        </div>
        <p className="text-xs text-brand-ink-soft mt-1">Tu link de invitación</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="rounded-xl bg-brand-accent-soft px-4 py-3">
          <p className="font-mono text-xl font-semibold text-brand-accent leading-tight">{formatCOP(earned)}</p>
          <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Ganado con referidos</p>
        </div>
        <div className="rounded-xl bg-brand-bg px-4 py-3">
          <p className="font-mono text-xl font-semibold text-brand-ink leading-tight">{referrals.length}</p>
          <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Creadores invitados</p>
        </div>
      </div>

      <h2 className="font-display text-base font-semibold text-brand-ink mb-3">Tus invitados</h2>
      {referrals.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no has invitado a nadie — comparte tu link arriba.
        </div>
      ) : (
        <div className="space-y-2.5">
          {referrals.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-brand-line bg-brand-surface px-4 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium text-brand-ink">{r.referred.displayName}</p>
                <p className="text-xs text-brand-ink-soft mt-0.5">{STATUS_LABEL[r.status]}</p>
              </div>
              <p className="font-mono text-sm text-brand-ink-soft shrink-0">{formatCOP(Number(r.bonusAmount))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
