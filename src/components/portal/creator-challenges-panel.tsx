"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeType } from "@/lib/challenge-types";

const typeLabel: Record<ChallengeType, string> = {
  GOAL_BONUS: "Bono por ventas generadas",
  TEMP_COMMISSION_BOOST: "Comisión elevada temporal",
  LEADERBOARD: "Leaderboard",
  WELCOME_BONUS: "Bono de bienvenida",
  CONTENT_CHALLENGE: "Campaña de contenido",
};

const rewardStatusLabel: Record<string, string> = {
  PENDING_REVIEW: "Tu evidencia está en revisión",
  PENDING: "Ganado — en espera por reembolsos",
  APPROVED: "Aprobado, listo para tu próximo pago",
  PAID: "Pagado",
  REJECTED: "No aprobado",
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

interface ActiveChallenge {
  challenge: {
    id: string;
    name: string;
    type: ChallengeType;
    endDate: string;
    offer: { name: string; brand: { companyName: string } };
    config: Record<string, unknown>;
  };
  myReward: { id: string; status: string; amount: number } | null;
  progress: { currentAmount: number; goalAmount: number; bonusAmount: number } | null;
}

function ContentSubmissionForm({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/creador/retos/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, submissionUrl, submissionNote }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo enviar.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 mt-3">
      <input
        required
        type="url"
        value={submissionUrl}
        onChange={(e) => setSubmissionUrl(e.target.value)}
        placeholder="Link de tu contenido (https://...)"
        className="input"
      />
      <input
        value={submissionNote}
        onChange={(e) => setSubmissionNote(e.target.value)}
        placeholder="Nota opcional"
        className="input"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Enviando..." : "Enviar participación"}
      </button>
    </form>
  );
}

export function CreatorChallengesPanel({ activeChallenges }: { activeChallenges: ActiveChallenge[] }) {
  if (activeChallenges.length === 0) {
    return <p className="text-sm text-brand-ink-soft">Ninguna de tus marcas tiene una campaña activa ahora mismo.</p>;
  }

  return (
    <div className="space-y-4">
      {activeChallenges.map(({ challenge, myReward, progress }) => (
        <div key={challenge.id} className="rounded-2xl border border-brand-line bg-brand-surface p-6">
          <p className="text-xs text-brand-ink-soft mb-1">
            {challenge.offer.brand.companyName} · {typeLabel[challenge.type]} · Termina{" "}
            {new Date(challenge.endDate).toLocaleDateString("es-CO")}
          </p>
          <p className="font-display font-semibold text-brand-ink mb-3">{challenge.name}</p>

          {challenge.type === "GOAL_BONUS" && progress && (
            <div>
              <div className="h-2 rounded-full bg-brand-bg overflow-hidden mb-2">
                <div
                  className="h-full bg-brand-accent"
                  style={{ width: `${Math.min(100, (progress.currentAmount / progress.goalAmount) * 100)}%` }}
                />
              </div>
              <p className="text-xs font-mono text-brand-ink-soft">
                {formatCOP(progress.currentAmount)} de {formatCOP(progress.goalAmount)} — ganas{" "}
                {formatCOP(progress.bonusAmount)}
              </p>
            </div>
          )}

          {challenge.type === "TEMP_COMMISSION_BOOST" && (
            <p className="text-sm text-brand-ink-soft">
              Comisión especial activa para <strong>todos</strong> los creadores de esta oferta: mientras dure,
              tus ventas pagan{" "}
              <span className="text-brand-accent font-mono">{String(challenge.config.newCommissionPercent)}%</span>{" "}
              en vez de tu comisión normal.
            </p>
          )}

          {challenge.type === "LEADERBOARD" && (
            <p className="text-sm text-brand-ink-soft">
              Los {String(challenge.config.winnersCount)} creadores con más ventas al terminar se llevan un premio.
            </p>
          )}

          {challenge.type === "WELCOME_BONUS" && !myReward && (
            <p className="text-sm text-brand-ink-soft">Bono de bienvenida activo — cupos limitados.</p>
          )}

          {challenge.type === "CONTENT_CHALLENGE" && (
            <div>
              <p className="text-sm text-brand-ink-soft">{String(challenge.config.instructions)}</p>
              <p className="text-xs font-mono text-brand-ink-soft mt-1">Bono: {formatCOP(Number(challenge.config.bonusAmount))}</p>
              {!myReward && <ContentSubmissionForm challengeId={challenge.id} />}
            </div>
          )}

          {myReward && (
            <p className="text-xs font-mono text-brand-accent mt-3 pt-3 border-t border-brand-line">
              {formatCOP(myReward.amount)} · {rewardStatusLabel[myReward.status]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
