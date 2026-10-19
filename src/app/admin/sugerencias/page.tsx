import Link from "next/link";
import { notFound } from "next/navigation";
import { SUGGESTIONS_ENABLED } from "@/lib/features";
import { AdminSuggestionsList } from "@/components/portal/admin-suggestions-list";
import { SUGGESTION_STATUS, type SuggestionStatusId } from "@/lib/suggestions";
import { countSuggestionsByStatus, listSuggestionsForAdmin, senderName } from "@/server/services/suggestion-service";

const FILTERS: { key: string; status: SuggestionStatusId | null; label: string }[] = [
  { key: "nuevas", status: "NEW", label: "Nuevas" },
  { key: "leidas", status: "READ", label: "Leídas" },
  { key: "resueltas", status: "DONE", label: "Resueltas" },
  { key: "todas", status: null, label: "Todas" },
];

/// Admin → Sugerencias: el buzón del portal de marcas y del de creadoras
/// (pedido del 2026-10-19: "que este mensaje yo lo vea desde admin").
export default async function AdminSugerenciasPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  if (!SUGGESTIONS_ENABLED) notFound();
  const { estado } = await searchParams;
  const filter = FILTERS.find((f) => f.key === estado) ?? FILTERS[0];
  const [items, counts] = await Promise.all([listSuggestionsForAdmin(filter.status), countSuggestionsByStatus()]);
  const total = counts.NEW + counts.READ + counts.DONE;

  return (
    <div>
      <p className="mb-2 font-mono text-xs tracking-widest text-brand-accent">BUZÓN</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Sugerencias</h1>
      <p className="mb-6 mt-1 text-sm text-brand-ink-soft">
        Lo que mandan las marcas y las creadoras desde el buzón de su portal: por escrito o con nota de voz. Ellas ven si
        ya la leíste o si quedó resuelta.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.status ? counts[f.status] : total;
          const active = f.key === filter.key;
          return (
            <Link
              key={f.key}
              href={`/admin/sugerencias?estado=${f.key}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                active ? "border-brand-ink bg-brand-ink text-brand-surface" : "border-brand-line text-brand-ink-soft hover:text-brand-ink"
              }`}
            >
              {f.label} <span className="font-mono">{count}</span>
            </Link>
          );
        })}
      </div>

      <AdminSuggestionsList
        items={items.map((s) => ({
          id: s.id,
          portal: s.portal,
          sender: senderName(s),
          email: s.user.email,
          kind: s.kind,
          message: s.message,
          audioUrl: s.audioUrl,
          audioSeconds: s.audioSeconds,
          pagePath: s.pagePath,
          userAgent: s.userAgent,
          sentByAdmin: s.sentByAdmin,
          status: s.status,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
      {filter.status === "NEW" && counts.NEW === 0 && total > 0 && (
        <p className="mt-2 text-xs text-brand-ink-soft">
          Estás al día. Las anteriores están en {SUGGESTION_STATUS.READ.admin.toLowerCase()}s y{" "}
          {SUGGESTION_STATUS.DONE.admin.toLowerCase()}s.
        </p>
      )}
    </div>
  );
}
