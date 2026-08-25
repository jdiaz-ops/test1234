"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeType } from "@/lib/challenge-types";
import { getBogotaDateTimeParts } from "@/lib/colombian-business-days";

const typeLabel: Record<ChallengeType, string> = {
  GOAL_BONUS: "Misión",
  FLASH_SALE: "Flash Sale",
  MIX: "Mix",
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

function formatEndDate(iso: string) {
  const p = getBogotaDateTimeParts(new Date(iso));
  return `${p.day} ${p.monthShort}, ${p.hour12}:${p.minute} ${p.ampm}`;
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

// La frase que le explica al creador, en su propio lenguaje, cómo ganar con
// esta campaña — una por palanca activa (meta+bono / comisión / descuento),
// para que quede clarísimo qué tiene que pasar para que gane algo, sin tener
// que interpretar números sueltos.
function buildPitch(challenge: ActiveChallenge["challenge"]): string[] {
  const pieces: string[] = [];
  const { type, config } = challenge;

  if (type === "GOAL_BONUS" || type === "MIX") {
    const goalAmount = Number(config.goalAmount);
    const bonusAmount = Number(config.bonusAmount);
    if (goalAmount && bonusAmount) {
      pieces.push(
        `Vende ${formatCOP(goalAmount)} con tu código antes de que termine y ganas ${formatCOP(bonusAmount)} de bono — además de tu comisión normal en esas mismas ventas.`
      );
    }
  }
  if (type === "FLASH_SALE" || type === "MIX") {
    if (config.newCommissionPercent != null) {
      pieces.push(
        `Tu comisión sube a ${String(config.newCommissionPercent)}% en todas tus ventas de esta oferta mientras dure la campaña.`
      );
    }
    if (config.newDiscountPercent != null) {
      pieces.push(
        `Tu código tiene ahora ${String(config.newDiscountPercent)}% de descuento para quien compre con él — buen momento para contarlo.`
      );
    }
  }
  if (type === "LEADERBOARD") {
    pieces.push(`Los ${String(config.winnersCount)} creadores con más ventas al terminar se llevan un premio.`);
  }
  if (type === "WELCOME_BONUS") {
    pieces.push("Bono de bienvenida activo — cupos limitados.");
  }
  if (type === "CONTENT_CHALLENGE") {
    pieces.push(String(config.instructions));
  }
  return pieces;
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

function ChallengeCard({ challenge, myReward, progress }: ActiveChallenge) {
  const pitch = buildPitch(challenge);
  const goalReached = progress != null && progress.currentAmount >= progress.goalAmount;
  const progressPct = progress ? Math.min(100, Math.round((progress.currentAmount / progress.goalAmount) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs text-brand-ink-soft">{challenge.offer.brand.companyName}</p>
        <span className="inline-flex items-center rounded-full bg-brand-accent-soft px-2.5 py-1 text-[11px] font-medium text-brand-accent">
          {typeLabel[challenge.type]}
        </span>
      </div>

      <p className="font-display text-lg font-semibold text-brand-ink mb-1">{challenge.name}</p>
      <p className="text-xs font-mono text-brand-ink-soft mb-4">Termina el {formatEndDate(challenge.endDate)}</p>

      {pitch.length > 0 && (
        <div className="rounded-xl bg-brand-bg p-4 space-y-2 mb-4">
          {pitch.map((line, i) => (
            <p key={i} className="text-sm text-brand-ink">
              {line}
            </p>
          ))}
        </div>
      )}

      {(challenge.type === "GOAL_BONUS" || challenge.type === "MIX") && progress && (
        <div className="mb-2">
          <div className="h-2.5 rounded-full bg-brand-bg overflow-hidden mb-2">
            <div
              className={`h-full rounded-full ${goalReached ? "bg-brand-accent" : "bg-brand-accent/70"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {goalReached ? (
            <p className="text-xs font-mono text-brand-accent font-medium">
              ¡Meta alcanzada! {formatCOP(progress.bonusAmount)} de bono en camino.
            </p>
          ) : (
            <p className="text-xs font-mono text-brand-ink-soft">
              {formatCOP(progress.currentAmount)} de {formatCOP(progress.goalAmount)} ({progressPct}%) — ganas{" "}
              {formatCOP(progress.bonusAmount)}
            </p>
          )}
        </div>
      )}

      {challenge.type === "CONTENT_CHALLENGE" && (
        <div>
          <p className="text-xs font-mono text-brand-ink-soft mb-2">
            Bono: {formatCOP(Number(challenge.config.bonusAmount))}
          </p>
          {!myReward && <ContentSubmissionForm challengeId={challenge.id} />}
        </div>
      )}

      {myReward && (
        <p className="text-xs font-mono text-brand-accent mt-3 pt-3 border-t border-brand-line">
          ✓ {formatCOP(myReward.amount)} · {rewardStatusLabel[myReward.status]}
        </p>
      )}
    </div>
  );
}

export function CreatorChallengesPanel({ activeChallenges }: { activeChallenges: ActiveChallenge[] }) {
  if (activeChallenges.length === 0) {
    return <p className="text-sm text-brand-ink-soft">Ninguna de tus marcas tiene una campaña activa ahora mismo.</p>;
  }

  return (
    <div className="space-y-4">
      {activeChallenges.map((ac) => (
        <ChallengeCard key={ac.challenge.id} {...ac} />
      ))}
    </div>
  );
}
