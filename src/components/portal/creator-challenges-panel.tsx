"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeType } from "@/lib/challenge-types";
import { getBogotaDateTimeParts } from "@/lib/colombian-business-days";
import { CopyButton } from "./copy-button";

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

// Duración total de la campaña (fin - inicio) — se calcula solo con las dos
// fechas guardadas, nunca con la hora actual, así que es igual en el
// servidor y en el cliente desde el primer render (a diferencia del
// contador de tiempo restante, que sí depende del momento).
function durationLabel(startISO: string, endISO: string) {
  const hours = Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / (60 * 60 * 1000));
  if (hours <= 0) return "";
  if (hours < 48) return `${hours} horas`;
  return `${Math.round(hours / 24)} días`;
}

function IconTimer({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9.5 2.5h5" />
      <path d="M18.5 5.5 20 4" />
    </svg>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "muy pronto";
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (totalHours < 24) return `${totalHours}h ${mins}m`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${hours}h`;
}

// Cuenta regresiva en vivo. Arranca en null a propósito: el servidor no
// tiene forma de saber la hora exacta en la que el cliente va a hidratar,
// así que renderiza vacío en el primer paso (server y cliente coinciden) y
// recién calcula el valor real dentro de un efecto, después de montar — así
// nunca hay un mismatch de hidratación, solo una actualización normal justo
// después.
function CountdownFooter({ endISO }: { endISO: string }) {
  const [state, setState] = useState<{ label: string; urgent: boolean } | null>(null);

  useEffect(() => {
    function tick() {
      const ms = new Date(endISO).getTime() - Date.now();
      setState({ label: formatRemaining(ms), urgent: ms < 24 * 60 * 60 * 1000 });
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [endISO]);

  if (!state) return null;

  return (
    <div className={`flex items-center gap-1.5 text-sm ${state.urgent ? "text-amber-700" : "text-brand-ink-soft"}`}>
      <IconTimer className={`w-4 h-4 shrink-0 ${state.urgent ? "text-amber-600" : "text-brand-ink-soft"}`} />
      Termina en <span className="font-semibold text-brand-ink">{state.label}</span>
    </div>
  );
}

interface ActiveChallenge {
  challenge: {
    id: string;
    name: string;
    type: ChallengeType;
    startDate: string;
    endDate: string;
    offer: { name: string; brand: { companyName: string } };
    config: Record<string, unknown>;
  };
  myReward: { id: string; status: string; amount: number } | null;
  progress: { currentAmount: number; goalAmount: number; bonusAmount: number } | null;
  discountCode: string;
  baseCommissionPercent: number;
}

// Un titular corto y directo (lo primero que se lee) más, si aplica, líneas
// de apoyo para las otras palancas de un Mix — en vez de una sola frase
// larga con todo adentro, que se pierde de vista.
function buildPitch(challenge: ActiveChallenge["challenge"]): { headline: string; secondary: string[] } {
  const { type, config } = challenge;

  if (type === "GOAL_BONUS" || type === "MIX") {
    const goalAmount = Number(config.goalAmount);
    const bonusAmount = Number(config.bonusAmount);
    const headline =
      goalAmount && bonusAmount ? `Vende ${formatCOP(goalAmount)} y desbloquea un bono de ${formatCOP(bonusAmount)}` : "";
    const secondary: string[] = [];
    if (type === "MIX") {
      if (config.newCommissionPercent != null) {
        secondary.push(`Tu comisión sube a ${String(config.newCommissionPercent)}% mientras dure la campaña.`);
      }
      if (config.newDiscountPercent != null) {
        secondary.push(`Tu código tiene ${String(config.newDiscountPercent)}% de descuento extra para quien compre.`);
      }
    }
    return { headline, secondary };
  }

  if (type === "FLASH_SALE") {
    const lines: string[] = [];
    if (config.newCommissionPercent != null) lines.push(`Tu comisión sube a ${String(config.newCommissionPercent)}%`);
    if (config.newDiscountPercent != null) lines.push(`tu código tiene ${String(config.newDiscountPercent)}% de descuento extra`);
    return { headline: lines.length === 2 ? `${lines[0]} y ${lines[1]}` : (lines[0] ?? ""), secondary: [] };
  }

  if (type === "LEADERBOARD") {
    return { headline: `Los ${String(config.winnersCount)} creadores con más ventas al terminar se llevan un premio.`, secondary: [] };
  }
  if (type === "WELCOME_BONUS") {
    return { headline: "Bono de bienvenida activo — cupos limitados.", secondary: [] };
  }
  if (type === "CONTENT_CHALLENGE") {
    return { headline: String(config.instructions), secondary: [] };
  }
  return { headline: "", secondary: [] };
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

function ChallengeCard({ challenge, myReward, progress, discountCode, baseCommissionPercent }: ActiveChallenge) {
  const { headline, secondary } = buildPitch(challenge);
  const goalReached = progress != null && progress.currentAmount >= progress.goalAmount;
  const progressPct = progress ? Math.min(100, Math.round((progress.currentAmount / progress.goalAmount) * 100)) : 0;
  const duration = durationLabel(challenge.startDate, challenge.endDate);

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="inline-flex items-center rounded-full bg-brand-accent-soft px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-accent">
          {typeLabel[challenge.type]}
          {duration && ` · ${duration}`}
        </span>
        <span className="text-sm font-bold text-brand-ink shrink-0">{baseCommissionPercent}% base</span>
      </div>
      <p className="text-xs text-brand-ink-soft mb-4">{challenge.offer.brand.companyName}</p>

      {headline && <p className="font-display text-lg font-bold text-brand-ink leading-snug mb-1">{headline}</p>}
      {secondary.map((line, i) => (
        <p key={i} className="text-sm text-brand-ink-soft mb-1">
          {line}
        </p>
      ))}

      {/* El código siempre a la vista — para que nunca tenga que ir a
          buscarlo a otra pestaña mientras la campaña está corriendo. */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-accent-soft px-3.5 py-2.5 mt-3 mb-4">
        <div>
          <p className="text-[11px] text-brand-ink-soft mb-0.5">Tu código para esta campaña</p>
          <p className="font-mono text-brand-accent font-semibold">{discountCode}</p>
        </div>
        <CopyButton value={discountCode} />
      </div>

      {(challenge.type === "GOAL_BONUS" || challenge.type === "MIX") && progress && (
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-xs text-brand-ink-soft">Progreso</p>
            <p className="text-xs font-mono text-brand-ink">
              {formatCOP(progress.currentAmount)} / {formatCOP(progress.goalAmount)}
            </p>
          </div>
          <div className="h-2.5 rounded-full bg-brand-bg overflow-hidden">
            <div
              className={`h-full rounded-full ${goalReached ? "bg-brand-accent" : "bg-brand-accent/70"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className={`text-xs mt-1.5 ${goalReached ? "font-mono text-brand-accent font-medium" : "text-right font-mono text-brand-ink-soft"}`}>
            {goalReached ? `¡Meta alcanzada! ${formatCOP(progress.bonusAmount)} de bono en camino.` : `${progressPct}% completado`}
          </p>
        </div>
      )}

      {challenge.type === "CONTENT_CHALLENGE" && (
        <div className="mb-4">
          <p className="text-xs font-mono text-brand-ink-soft mb-2">
            Bono: {formatCOP(Number(challenge.config.bonusAmount))}
          </p>
          {!myReward && <ContentSubmissionForm challengeId={challenge.id} />}
        </div>
      )}

      {myReward && (
        <p className="text-xs font-mono text-brand-accent mb-4">
          ✓ {formatCOP(myReward.amount)} · {rewardStatusLabel[myReward.status]}
        </p>
      )}

      <div className="pt-3 border-t border-brand-line flex items-center justify-between gap-3 flex-wrap">
        <CountdownFooter endISO={challenge.endDate} />
        <p className="text-xs font-mono text-brand-ink-soft">Termina el {formatEndDate(challenge.endDate)}</p>
      </div>
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
