import Link from "next/link";
import { requireAllyAdmin } from "@/lib/ally-admin";
import { formatCop } from "@/lib/ally-earnings";
import { listAllies } from "@/server/services/ally-service";
import { NewAllyForm } from "@/components/aliados/ally-admin-forms";

export const dynamic = "force-dynamic";

/// Admin → Aliados comerciales (ver ally-service.ts).
export default async function AdminAlliesPage() {
  const admin = await requireAllyAdmin();
  if (!admin) {
    return <p className="text-sm text-brand-ink-soft">Solo el Propietario o Finanzas pueden ver los aliados.</p>;
  }
  const allies = await listAllies();
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">ALIADOS</p>
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Aliados comerciales</h1>
        <p className="text-sm text-brand-ink-soft max-w-2xl">
          Presentan marcas y creadoras con su link. Ganan 2,5 % de las ventas de cada marca y 1,25 % de cada creadora durante 6 meses desde su
          primera venta, de la tarifa de Marcolini. Entran a su portal con un link a su correo.
        </p>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 overflow-x-auto">
        {allies.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">Todavía no hay aliados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-brand-ink-soft border-b border-brand-line">
                <th className="py-2 pr-3 font-medium">Aliado</th>
                <th className="py-2 pr-3 font-medium">Link</th>
                <th className="py-2 pr-3 font-medium text-right">Vinculadas</th>
                <th className="py-2 pr-3 font-medium text-right">Solicitudes por revisar</th>
                <th className="py-2 pr-3 font-medium text-right">Este mes</th>
                <th className="py-2 font-medium text-right">Por pagar</th>
              </tr>
            </thead>
            <tbody>
              {allies.map((a) => (
                <tr key={a.id} className="border-b border-brand-line last:border-0">
                  <td className="py-3 pr-3">
                    <Link href={`/admin/aliados/${a.id}`} className="font-medium text-brand-ink hover:underline">
                      {a.name}
                    </Link>
                    <p className="text-xs text-brand-ink-soft">
                      {a.email}
                      {a.status === "PAUSED" ? " · en pausa" : ""}
                    </p>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-brand-ink-soft">/unete/{a.code}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{a.referrals}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{a.pendingLeads > 0 ? <span className="font-medium text-amber-700">{a.pendingLeads}</span> : 0}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatCop(a.thisMonth)}</td>
                  <td className="py-3 text-right tabular-nums font-medium text-brand-ink">{formatCop(a.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NewAllyForm />
    </div>
  );
}
