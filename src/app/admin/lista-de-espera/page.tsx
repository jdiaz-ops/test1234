import { PageTabs } from "@/components/portal/page-tabs";
import { socialsText } from "@/lib/waitlist";
import { listWaitlist, sourceLabel, summarizeWaitlist } from "@/server/services/waitlist-service";

const TABS = [
  { href: "/admin/lista-de-espera", label: "Creadores" },
  { href: "/admin/lista-de-espera?tipo=marcas", label: "Marcas" },
] as const;

/// Lista de espera de creadores y marcas: cuánta gente se inscribe y desde
/// qué anuncio llega (utm_*). Ver waitlist-service.ts.
export default async function AdminListaDeEsperaPage({ searchParams }: PageProps<"/admin/lista-de-espera">) {
  const brands = (await searchParams).tipo === "marcas";
  const entries = await listWaitlist(brands ? "BRAND" : "CREATOR");

  const { lastWeek, lastDay, sources } = summarizeWaitlist(entries);

  const date = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">LISTA DE ESPERA</p>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Lista de espera</h1>
        {entries.length > 0 && (
          <a
            href={`/api/admin/lista-de-espera/exportar${brands ? "?tipo=marcas" : ""}`}
            className="text-sm border border-brand-line rounded-full px-4 py-1.5 hover:bg-brand-accent-soft"
          >
            Exportar a Excel
          </a>
        )}
      </div>

      <PageTabs tabs={TABS} active={TABS[brands ? 1 : 0].href} />

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total", value: entries.length },
          { label: "Últimos 7 días", value: lastWeek },
          { label: "Últimas 24 horas", value: lastDay },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-brand-line bg-brand-surface p-4">
            <p className="text-xs text-brand-ink-soft mb-1">{s.label}</p>
            <p className="font-mono text-2xl text-brand-ink tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no hay inscritos. El formulario está en marcolini.lat
          {brands ? "/lista-de-espera/marcas" : "/lista-de-espera"} y los botones de
          {brands ? " /para-marcas" : " /para-creadores"} llevan ahí.
        </p>
      ) : (
        <>
          <h2 className="font-display text-base font-semibold text-brand-ink mb-2">De dónde llegan</h2>
          <div className="rounded-xl border border-brand-line bg-brand-surface mb-8 divide-y divide-brand-line">
            {sources.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-brand-ink">{label}</span>
                <span className="font-mono tabular-nums text-brand-ink-soft">{count}</span>
              </div>
            ))}
          </div>

          <h2 className="font-display text-base font-semibold text-brand-ink mb-2">Inscritos</h2>
          <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-brand-ink-soft border-b border-brand-line">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  {brands && <th className="px-4 py-2 font-medium">Marca</th>}
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Contacto</th>
                  <th className="px-4 py-2 font-medium">{brands ? "Instagram o web" : "Redes"}</th>
                  <th className="px-4 py-2 font-medium">{brands ? "Dónde vende" : "Seguidores"}</th>
                  <th className="px-4 py-2 font-medium">Categoría</th>
                  <th className="px-4 py-2 font-medium">Llegó por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {entries.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-4 py-2 whitespace-nowrap text-brand-ink-soft">{date.format(e.createdAt)}</td>
                    {brands && <td className="px-4 py-2 text-brand-ink font-medium">{e.company}</td>}
                    <td className="px-4 py-2 text-brand-ink">{e.name}</td>
                    <td className="px-4 py-2">
                      <div className="text-brand-ink">{e.email}</div>
                      <div className="text-brand-ink-soft">{e.whatsapp}</div>
                    </td>
                    <td className="px-4 py-2 text-brand-ink">
                      {brands
                        ? e.handle
                        : socialsText(e.socials)
                            .split(" · ")
                            .map((line) => <div key={line}>{line}</div>)}
                    </td>
                    <td className="px-4 py-2 text-brand-ink-soft">{brands ? e.salesChannel : e.audience}</td>
                    <td className="px-4 py-2 text-brand-ink-soft">{e.category}</td>
                    <td className="px-4 py-2 text-brand-ink-soft">{sourceLabel(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
