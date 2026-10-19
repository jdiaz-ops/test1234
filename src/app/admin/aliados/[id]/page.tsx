import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAllyAdmin } from "@/lib/ally-admin";
import { formatRate } from "@/lib/ally-earnings";
import { allyOverview } from "@/server/services/ally-service";
import { AllyMonthsTable, AllyReferralsTable, AllyStats } from "@/components/aliados/ally-summary";
import { AllyAccessPanel, AllyLeadActions, AllyManualLink, AllyPayoutAction, AllyUnlinkButton } from "@/components/aliados/ally-admin-forms";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = { CC: "CC", CE: "CE", NIT: "NIT", PASAPORTE: "Pasaporte" };

/// Detalle de un aliado: lo mismo que ve él en su portal, más las
/// solicitudes por revisar, los vínculos y los pagos.
export default async function AdminAllyPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAllyAdmin();
  if (!admin) return <p className="text-sm text-brand-ink-soft">Solo el Propietario o Finanzas pueden ver los aliados.</p>;
  const { id } = await params;
  const overview = await allyOverview(id);
  if (!overview) notFound();
  const [brands, creators, leads] = await Promise.all([
    prisma.brandProfile.findMany({ where: { allyReferral: null }, select: { id: true, companyName: true }, orderBy: { companyName: "asc" } }),
    prisma.creatorProfile.findMany({ where: { allyReferral: null }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
    prisma.allyLead.findMany({ where: { allyId: id, referral: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const brandOptions = brands.map((b) => ({ id: b.id, name: b.companyName }));
  const creatorOptions = creators.map((c) => ({ id: c.id, name: c.displayName }));
  const pay = overview.ally.payoutDetails;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/aliados" className="text-xs text-brand-ink-soft hover:underline">
          ← Aliados
        </Link>
        <h1 className="font-display text-2xl font-semibold text-brand-ink mt-2">{overview.ally.name}</h1>
        <p className="text-sm text-brand-ink-soft">
          {overview.ally.email}
          {overview.ally.phone ? ` · ${overview.ally.phone}` : ""} · {formatRate(overview.ally.brandRateBps)} marcas, {formatRate(overview.ally.creatorRateBps)} creadoras,{" "}
          {overview.ally.windowMonths} meses
        </p>
        <p className="text-sm mt-1">
          <a href={overview.link} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-brand-accent hover:underline">
            {overview.link}
          </a>
          {overview.ally.status === "PAUSED" && <span className="ml-2 text-xs text-amber-700">· link en pausa</span>}
        </p>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
        <AllyAccessPanel allyId={id} status={overview.ally.status} />
      </div>

      <AllyStats overview={overview} />

      {leads.length > 0 && (
        <section className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
          <h2 className="text-sm font-medium text-brand-ink">Solicitudes por su link</h2>
          <ul className="divide-y divide-brand-line">
            {leads.map((l) => (
              <li key={l.id} className="py-3 space-y-2">
                <div>
                  <p className="text-sm font-medium text-brand-ink">
                    {l.name} <span className="text-xs font-normal text-brand-ink-soft">· {l.kind === "BRAND" ? "Marca" : "Creadora"} · {l.status === "PENDING" ? "en revisión" : l.status === "APPROVED" ? "aprobada" : "no entró"}</span>
                  </p>
                  <p className="text-xs text-brand-ink-soft">
                    {[l.contactName, l.phone, l.instagram, l.city].filter(Boolean).join(" · ")} · {l.createdAt.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" })}
                  </p>
                </div>
                <AllyLeadActions allyId={id} leadId={l.id} kind={l.kind} status={l.status} brands={brandOptions} creators={creatorOptions} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
        <h2 className="text-sm font-medium text-brand-ink">Marcas y creadoras vinculadas</h2>
        <AllyReferralsTable
          overview={{ ...overview, leads: [] }}
          actions={(referralId) => <AllyUnlinkButton allyId={id} referralId={referralId} name={overview.referrals.find((r) => r.id === referralId)?.name ?? ""} />}
        />
        <div className="pt-2 border-t border-brand-line">
          <p className="text-xs text-brand-ink-soft mb-2">Vincular a mano (si llegó sin pasar por su link):</p>
          <AllyManualLink allyId={id} brands={brandOptions} creators={creatorOptions} />
        </div>
      </section>

      <section className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
        <h2 className="text-sm font-medium text-brand-ink">Por mes</h2>
        <AllyMonthsTable
          overview={overview}
          actions={(m) =>
            m.state === "por-pagar" || m.state === "pagado" ? <AllyPayoutAction allyId={id} monthKey={m.key} commission={m.commission} paid={m.state === "pagado"} /> : null
          }
        />
      </section>

      <section className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-1">
        <h2 className="text-sm font-medium text-brand-ink mb-1">Datos de pago</h2>
        {pay.legalName ? (
          <>
            <p className="text-sm text-brand-ink">{pay.legalName}</p>
            <p className="text-xs text-brand-ink-soft">
              {DOC_LABEL[pay.documentType ?? ""] ?? pay.documentType} {pay.documentNumber}
            </p>
            <p className="text-xs text-brand-ink-soft">
              {pay.payoutMethod === "BRE_B" ? `Llave Bre-B: ${pay.breBKey}` : `${pay.bankName} · ${pay.bankAccountType === "CORRIENTE" ? "Corriente" : "Ahorros"} ${pay.bankAccountNumber}`}
            </p>
          </>
        ) : (
          <p className="text-xs text-brand-ink-soft">Todavía no los llena en su portal.</p>
        )}
      </section>
    </div>
  );
}
