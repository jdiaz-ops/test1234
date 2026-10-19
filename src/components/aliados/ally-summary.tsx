import { formatCop, formatRate, monthLabel } from "@/lib/ally-earnings";
import type { AllyOverview } from "@/server/services/ally-service";

/// Lo que ve el aliado en su portal (y el admin en el detalle del aliado):
/// lo que lleva ganado, a quién trajo con su estado y días que le quedan, y
/// lo ganado mes por mes. Solo nombres y totales: nunca pedidos ni clientes
/// (así lo dicen los términos, sección "Aliados comerciales").

const LEAD_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "En revisión", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  APPROVED: { label: "Aprobada", tone: "bg-sky-50 text-sky-800 border-sky-200" },
  REJECTED: { label: "No entró", tone: "bg-neutral-100 text-neutral-600 border-neutral-200" },
};

const REFERRAL_STATE: Record<string, { label: string; tone: string }> = {
  "sin-ventas": { label: "Todavía no vende", tone: "bg-neutral-100 text-neutral-700 border-neutral-200" },
  activa: { label: "Ganando", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  terminada: { label: "Terminó", tone: "bg-neutral-100 text-neutral-600 border-neutral-200" },
};

const MONTH_STATE: Record<string, { label: string; tone: string }> = {
  "en-curso": { label: "En curso", tone: "bg-sky-50 text-sky-800 border-sky-200" },
  "por-pagar": { label: "Por pagar", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  pagado: { label: "Pagado", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  "sin-comision": { label: "Sin comisión", tone: "bg-neutral-100 text-neutral-600 border-neutral-200" },
};

function Pill({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function shortDate(date: Date) {
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });
}

export function AllyStats({ overview }: { overview: AllyOverview }) {
  const stats = [
    { label: "Este mes (en curso)", value: overview.totals.thisMonth },
    { label: "Por pagar", value: overview.totals.pending },
    { label: "Pagado en total", value: overview.totals.paid },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-brand-line bg-brand-surface p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs text-brand-ink-soft leading-tight">{s.label}</p>
          <p className="font-display text-base sm:text-2xl font-semibold text-brand-ink tabular-nums mt-1">{formatCop(s.value)}</p>
        </div>
      ))}
    </div>
  );
}

/// En celular, tarjetas; desde sm, tabla.
export function AllyReferralsTable({ overview, actions }: { overview: AllyOverview; actions?: (referralId: string) => React.ReactNode }) {
  const now = overview.months[0]?.key;
  const rows = overview.referrals;
  const leads = overview.leads;
  if (rows.length === 0 && leads.length === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Todavía no hay solicitudes por tu link. Compártelo con marcas y creadoras: cuando llenen el formulario, aparecen acá.
      </p>
    );
  }
  return (
    <>
      <ul className="sm:hidden divide-y divide-brand-line">
        {rows.map((r) => {
          const month = now ? r.months[now] : undefined;
          const state = REFERRAL_STATE[r.state];
          return (
            <li key={r.id} className="py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-brand-ink">{r.name}</p>
                  <p className="text-xs text-brand-ink-soft">
                    {r.kind === "BRAND" ? "Marca" : "Creadora"} · {formatRate(r.rateBps)} por {r.windowMonths} meses
                  </p>
                </div>
                <Pill label={state.label} tone={state.tone} />
              </div>
              <p className="text-xs text-brand-ink-soft">
                {r.state === "activa" ? `Quedan ${r.daysLeft} días · ` : r.state === "sin-ventas" ? "Los meses corren desde su primera venta · " : ""}
                Este mes {formatCop(month?.sales ?? 0)} en ventas, {formatCop(month?.commission ?? 0)} para ti · Total {formatCop(r.totalCommission)}
              </p>
              {actions && <div>{actions(r.id)}</div>}
            </li>
          );
        })}
        {leads.map((l) => {
          const state = LEAD_STATUS[l.status];
          return (
            <li key={l.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-brand-ink">{l.name}</p>
                <p className="text-xs text-brand-ink-soft">
                  {l.kind === "BRAND" ? "Marca" : "Creadora"} · solicitud del {shortDate(l.createdAt)}
                </p>
              </div>
              <Pill label={state.label} tone={state.tone} />
            </li>
          );
        })}
      </ul>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-brand-ink-soft border-b border-brand-line">
              <th className="py-2 pr-3 font-medium">Nombre</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              <th className="py-2 pr-3 font-medium text-right">Ventas este mes</th>
              <th className="py-2 pr-3 font-medium text-right">Tu comisión este mes</th>
              <th className="py-2 font-medium text-right">Total ganado</th>
              {actions && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const month = now ? r.months[now] : undefined;
              const state = REFERRAL_STATE[r.state];
              return (
                <tr key={r.id} className="border-b border-brand-line last:border-0 align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-brand-ink">{r.name}</p>
                    <p className="text-xs text-brand-ink-soft">
                      {r.kind === "BRAND" ? "Marca" : "Creadora"} · {formatRate(r.rateBps)} de sus ventas por {r.windowMonths} meses
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <Pill label={state.label} tone={state.tone} />
                    {r.state === "activa" && <p className="text-xs text-brand-ink-soft mt-1">Quedan {r.daysLeft} días</p>}
                    {r.state === "sin-ventas" && <p className="text-xs text-brand-ink-soft mt-1">Los meses corren desde su primera venta</p>}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatCop(month?.sales ?? 0)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatCop(month?.commission ?? 0)}</td>
                  <td className="py-3 text-right tabular-nums font-medium text-brand-ink">{formatCop(r.totalCommission)}</td>
                  {actions && <td className="py-3 pl-3 text-right">{actions(r.id)}</td>}
                </tr>
              );
            })}
            {leads.map((l) => {
              const state = LEAD_STATUS[l.status];
              return (
                <tr key={l.id} className="border-b border-brand-line last:border-0 align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-brand-ink">{l.name}</p>
                    <p className="text-xs text-brand-ink-soft">
                      {l.kind === "BRAND" ? "Marca" : "Creadora"} · solicitud del {shortDate(l.createdAt)}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <Pill label={state.label} tone={state.tone} />
                  </td>
                  <td className="py-3 pr-3 text-right text-brand-ink-soft">—</td>
                  <td className="py-3 pr-3 text-right text-brand-ink-soft">—</td>
                  <td className="py-3 text-right text-brand-ink-soft">—</td>
                  {actions && <td className="py-3" />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AllyMonthsTable({ overview, actions }: { overview: AllyOverview; actions?: (month: AllyOverview["months"][number]) => React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-brand-ink-soft border-b border-brand-line">
            <th className="py-2 pr-3 font-medium">Mes</th>
            <th className="py-2 pr-3 font-medium text-right">Ventas de tus marcas y creadoras</th>
            <th className="py-2 pr-3 font-medium text-right">Tu comisión</th>
            <th className="py-2 font-medium">Estado</th>
            {actions && <th className="py-2" />}
          </tr>
        </thead>
        <tbody>
          {overview.months.map((m) => {
            const state = MONTH_STATE[m.state];
            return (
              <tr key={m.key} className="border-b border-brand-line last:border-0 align-top">
                <td className="py-3 pr-3 text-brand-ink first-letter:uppercase">{monthLabel(m.key)}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{formatCop(m.sales)}</td>
                <td className="py-3 pr-3 text-right tabular-nums font-medium text-brand-ink">{formatCop(m.commission)}</td>
                <td className="py-3">
                  <Pill label={state.label} tone={state.tone} />
                  {m.payout && (
                    <p className="text-xs text-brand-ink-soft mt-1">
                      {formatCop(m.payout.amount)} el {shortDate(m.payout.paidAt)}
                    </p>
                  )}
                  {(m.state === "en-curso" || m.state === "por-pagar") && (
                    <p className="text-xs text-brand-ink-soft mt-1">Se paga el {shortDate(m.payDate)}</p>
                  )}
                </td>
                {actions && <td className="py-3 pl-3 text-right">{actions(m)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
