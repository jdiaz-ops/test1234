import {
  IconSparkle,
  IconStore,
  IconLayers,
  IconGift,
  IconTrendingUp,
  IconWallet,
  IconTrace,
  IconTarget,
} from "@/components/marketing/icons";
import type { CreatorBadgeDef } from "@/lib/creator-badges";

const ICONS = {
  IconSparkle,
  IconStore,
  IconLayers,
  IconGift,
  IconTrendingUp,
  IconWallet,
  IconTrace,
  IconTarget,
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function formatProgress(hint: { badge: CreatorBadgeDef; current: number; goal: number }) {
  if (hint.badge.key === "millon_comisiones") {
    return `${formatCOP(hint.current)} de ${formatCOP(hint.goal)}`;
  }
  return `${hint.current} de ${hint.goal}`;
}

export function CreatorBadgesCard({
  earnedBadges,
  nextHint,
  totalCount,
}: {
  earnedBadges: CreatorBadgeDef[];
  nextHint: { badge: CreatorBadgeDef; current: number; goal: number } | null;
  totalCount: number;
}) {
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-brand-ink">Tus insignias</h2>
        <span className="text-xs font-mono text-brand-ink-soft">
          {earnedBadges.length}/{totalCount}
        </span>
      </div>

      {earnedBadges.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-4">Todavía no tienes ninguna — completa tu perfil para ganar la primera.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mb-4">
          {earnedBadges.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <div key={b.key} className="flex flex-col items-center text-center gap-1.5" title={b.description}>
                <div className="w-10 h-10 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-[10px] text-brand-ink-soft leading-tight">{b.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {nextHint && (
        <div className="pt-4 border-t border-brand-line">
          <p className="text-xs text-brand-ink-soft mb-1.5">
            Próxima: <span className="text-brand-ink font-medium">{nextHint.badge.label}</span> —{" "}
            {formatProgress(nextHint)}
          </p>
          <div className="h-1.5 rounded-full bg-brand-line overflow-hidden">
            <div
              className="h-full bg-brand-accent transition-all"
              style={{ width: `${Math.min((nextHint.current / nextHint.goal) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
