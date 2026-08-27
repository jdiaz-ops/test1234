import { auth } from "@/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCreatorDashboardSummary } from "@/server/services/creator-finance-service";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function nextPayoutDate(dayOfMonth: number) {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (candidate < now) candidate.setMonth(candidate.getMonth() + 1);
  return candidate.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
  });
}

export default async function CreadorDashboardPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

  // Aunque el onboarding no esté terminado, el creador puede navegar
  // libremente todo el portal (mismo criterio que marca) — el único
  // empujón hacia "Empieza aquí" es el link en el sidebar y el botón
  // "Terminar onboarding" del centro de la barra superior. Nada
  // redirige por la fuerza, ni siquiera el dashboard.
  const summary = await getCreatorDashboardSummary(profile.id);

  // Igual que la invitación del dashboard de marca (ver /marca), pero en
  // sentido contrario — acá no hay nada que crear, solo avisar que hay
  // campañas activas esperando y motivar a que las revise. Si no tiene
  // ninguna activa, no tiene sentido invitarla a "consultarlas".
  const enrolledOfferIds = (
    await prisma.creatorOfferEnrollment.findMany({
      where: { creatorId: profile.id, status: "ACTIVE" },
      select: { offerId: true },
    })
  ).map((e) => e.offerId);
  const activeCampaigns =
    enrolledOfferIds.length === 0
      ? 0
      : await prisma.challenge.count({
          where: { offerId: { in: enrolledOfferIds }, status: "ACTIVE" },
        });

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        DASHBOARD
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
        Hola, {profile.displayName}
      </h1>

      {activeCampaigns > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-accent/30 bg-brand-accent-soft/40 p-5 mb-6">
          <div>
            <p className="text-sm font-medium text-brand-ink">
              {activeCampaigns === 1
                ? "Tienes una campaña activa"
                : `Tienes ${activeCampaigns} campañas activas`}
            </p>
            <p className="text-xs text-brand-ink-soft mt-1">
              Gana más comisión o bonos completando misiones — revisa qué está
              activo ahora.
            </p>
          </div>
          <Link
            href="/creador/retos"
            className="shrink-0 bg-brand-accent text-white text-xs font-medium rounded-full px-5 py-2.5 hover:opacity-90"
          >
            Ver campañas
          </Link>
        </div>
      )}

      {/* 2 columnas desde el arranque en mobile (antes se apilaban una
          debajo de otra) — mismo tratamiento que los dashboards de admin
          y marca. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-10">
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
          <p className="text-xs text-brand-ink-soft mb-1">
            Comisión confirmada
          </p>
          <p className="font-display text-lg sm:text-2xl font-semibold text-brand-ink">
            {formatCOP(summary.approvedPendingPayout)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            lista para tu próximo pago
          </p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Próximo pago</p>
          <p className="font-display text-lg sm:text-2xl font-semibold text-brand-ink">
            {nextPayoutDate(summary.payoutDayOfMonth)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            solo montos ya aprobados
          </p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Pagado este año</p>
          <p className="font-display text-lg sm:text-2xl font-semibold text-brand-ink">
            {formatCOP(summary.paidThisYear)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            acumulado en desembolsos
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 max-w-xl">
        <h2 className="font-display font-semibold text-brand-ink mb-4">
          Tus marcas top
        </h2>
        {summary.topBrands.length === 0 ? (
          <div className="text-sm text-brand-ink-soft">
            <p className="mb-3">Todavía no tienes ventas registradas.</p>
            <a
              href="/creador/marketplace"
              className="text-brand-accent font-medium hover:underline"
            >
              Explora el marketplace y únete a una marca →
            </a>
          </div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {summary.topBrands.map((b) => (
              <li
                key={b.name}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-brand-ink">{b.name}</span>
                <span className="font-mono text-brand-ink-soft">
                  {formatCOP(b.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
