"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChallengeForm } from "./challenge-form";
import type { ChallengeType } from "@/lib/challenge-types";
import { getBogotaDateTimeParts } from "@/lib/colombian-business-days";
import { roiComment, formatROI, ROI_SMALL_SAMPLE_THRESHOLD } from "@/lib/challenge-roi";

const typeLabel: Record<ChallengeType, string> = {
  GOAL_BONUS: "Misión",
  FLASH_SALE: "Flash Sale",
  MIX: "Mix",
  LEADERBOARD: "Leaderboard",
  WELCOME_BONUS: "Bono de bienvenida",
  CONTENT_CHALLENGE: "Campaña de contenido",
};

// Resumen de una línea con los valores reales de la campaña, para que se
// entienda de un vistazo en la tarjeta sin tener que abrirla.
function configSummary(type: ChallengeType, config: Record<string, unknown>): string {
  const parts: string[] = [];
  if (type === "GOAL_BONUS" || type === "MIX") {
    parts.push(`Meta ${formatCOP(Number(config.goalAmount))} · Bono ${formatCOP(Number(config.bonusAmount))}`);
  }
  if (config.newCommissionPercent != null) parts.push(`Comisión → ${config.newCommissionPercent}%`);
  if (config.newDiscountPercent != null) parts.push(`Descuento → ${config.newDiscountPercent}%`);
  return parts.join(" · ");
}

function formatDateTime(iso: string) {
  const p = getBogotaDateTimeParts(new Date(iso));
  return `${p.day} ${p.monthShort}, ${p.hour12}:${p.minute} ${p.ampm}`;
}

// La frase completa que la marca aprobó al crear la campaña — mismo texto
// que vio en el resumen del formulario (ver buildSummary en
// challenge-form.tsx), pero reconstruida acá a partir de lo que quedó
// guardado, para que la tarjeta lo siga mostrando después.
function buildAcceptedSentence(c: Challenge): string | null {
  const pieces: string[] = [];
  if (c.type === "GOAL_BONUS" || c.type === "MIX") {
    const goalAmount = Number(c.config.goalAmount);
    const bonusAmount = Number(c.config.bonusAmount);
    if (!goalAmount || !bonusAmount) return null;
    pieces.push(
      `cada creador que llegue a ${formatCOP(goalAmount)} en ventas gana ${formatCOP(bonusAmount)} de bono adicional a su comisión`
    );
  }
  if (c.type === "FLASH_SALE" || c.type === "MIX") {
    if (c.config.newCommissionPercent != null) {
      pieces.push(`la comisión del creador sube a ${c.config.newCommissionPercent}%`);
    }
    if (c.config.newDiscountPercent != null) {
      pieces.push(`el descuento del comprador sube a ${c.config.newDiscountPercent}%`);
    }
  }
  if (pieces.length === 0) return null;

  const detail = pieces.length === 1 ? pieces[0] : `${pieces.slice(0, -1).join(", ")} y ${pieces[pieces.length - 1]}`;

  // formatDateTime ya termina en "a. m."/"p. m." (con su propio punto), así
  // que no hace falta agregar uno más al final.
  return `En la campaña "${c.name}", ${detail}. Empieza el ${formatDateTime(c.startDate)} y termina el ${formatDateTime(c.endDate)}`;
}

const rewardStatusLabel: Record<string, string> = {
  PENDING_REVIEW: "En revisión",
  PENDING: "En espera",
  APPROVED: "Aprobado",
  PAID: "Pagado",
  REJECTED: "Rechazado",
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

interface Reward {
  id: string;
  amount: number;
  status: string;
  creator: { displayName: string };
}

interface ChallengeResults {
  gmv: number;
  orderCount: number;
  totalCommission: number;
  totalBonus: number;
  creatorsReachedGoal: number;
  creatorsSoldNotReached: number;
  roi: number | null;
}

interface Challenge {
  id: string;
  name: string;
  type: ChallengeType;
  status: "ACTIVE" | "ENDED";
  startDate: string;
  endDate: string;
  offer: { name: string };
  rewards: Reward[];
  config: Record<string, unknown>;
  /// Solo tiene sentido para FLASH_SALE/MIX con el lado de descuento
  /// configurado — si el % elevado ya está puesto de verdad en la tienda
  /// (true) o todavía no le tocaba/ya se devolvió a la normal (false). Ver
  /// syncDiscountBoosts en challenge-service.ts.
  discountBoostActive: boolean;
  /// Solo viene con datos para campañas ya ENDED (ver getChallengeResults en
  /// challenge-service.ts) — null mientras está activa.
  results: ChallengeResults | null;
}

interface Submission {
  id: string;
  submissionUrl: string | null;
  submissionNote: string | null;
  creator: { displayName: string };
  challenge: { name: string };
  amount: number;
}

function ReviewSubmissionButtons({ rewardId }: { rewardId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function decide(decision: "APPROVE" | "REJECT") {
    setLoading(true);
    await fetch("/api/marca/retos/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardId, decision }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => decide("APPROVE")}
        disabled={loading}
        className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
      >
        Aprobar
      </button>
      <button
        onClick={() => decide("REJECT")}
        disabled={loading}
        className="text-xs text-brand-ink-soft border border-brand-line rounded-full px-4 py-1.5 hover:bg-brand-bg disabled:opacity-50"
      >
        Rechazar
      </button>
    </div>
  );
}

function StatTile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-brand-bg px-3 py-2.5">
      <p className={`font-mono text-lg font-medium leading-tight ${accent ? "text-brand-accent" : "text-brand-ink"}`}>
        {value}
      </p>
      <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">{label}</p>
    </div>
  );
}

// El resumen de resultado de una campaña terminada — para que la marca vea
// de un vistazo si le funcionó, sin tener que ir a Transacciones a sumar a
// mano. Meta/bono solo tienen sentido para Misión y Mix; GMV, órdenes y
// comisión aplican a cualquier tipo.
function ChallengeResultsGrid({ type, results }: { type: ChallengeType; results: ChallengeResults }) {
  const hasGoal = type === "GOAL_BONUS" || type === "MIX";
  const comment = roiComment(results.roi);
  const smallSample = results.orderCount > 0 && results.orderCount < ROI_SMALL_SAMPLE_THRESHOLD;
  return (
    <div>
      <p className="text-xs text-brand-ink-soft mb-2">Resultado de la campaña</p>

      {results.roi != null && (
        <div className="rounded-xl bg-brand-accent-soft px-4 py-3 mb-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="font-display text-2xl font-bold text-brand-accent">{formatROI(results.roi)}</p>
            <p className="text-xs text-brand-ink-soft">
              por cada $1 invertido (comisión + bono + tarifa), generaste {formatROI(results.roi)} en ventas
            </p>
          </div>
          {comment && <p className="text-sm text-brand-ink font-medium mt-1.5">{comment}</p>}
          {smallSample && (
            <p className="text-xs text-brand-ink-soft mt-1.5">
              Muestra pequeña ({results.orderCount} {results.orderCount === 1 ? "orden" : "órdenes"}) — tómalo con cautela.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {hasGoal && (
          <>
            <StatTile value={String(results.creatorsReachedGoal)} label="Creadores que lograron la meta" accent />
            <StatTile value={String(results.creatorsSoldNotReached)} label="Vendieron, pero no llegaron" />
          </>
        )}
        <StatTile value={formatCOP(results.gmv)} label="Ventas generadas (GMV)" />
        <StatTile value={String(results.orderCount)} label="Órdenes" />
        {hasGoal && <StatTile value={formatCOP(results.totalBonus)} label="Bono total otorgado" />}
        <StatTile value={formatCOP(results.totalCommission)} label="Comisión total generada" />
      </div>
    </div>
  );
}

function ChallengeCard({ c, onEnd }: { c: Challenge; onEnd: (id: string) => void }) {
  const totalAwarded = c.rewards.reduce((sum, r) => sum + r.amount, 0);
  const acceptedSentence = c.status === "ACTIVE" ? buildAcceptedSentence(c) : null;
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-brand-ink-soft mb-1">
            {typeLabel[c.type]} ·{" "}
            <span className={c.status === "ACTIVE" ? "text-brand-accent" : ""}>
              {c.status === "ACTIVE" ? "Activo" : "Terminado"}
            </span>
          </p>
          <p className="font-display font-semibold text-brand-ink">{c.name}</p>
          <p className="text-xs font-mono text-brand-ink-soft mt-1">
            {formatDateTime(c.startDate)} — {formatDateTime(c.endDate)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">{configSummary(c.type, c.config)}</p>
          {acceptedSentence && <p className="text-xs text-brand-ink-soft mt-2 max-w-md">{acceptedSentence}</p>}
        </div>
        {c.status === "ACTIVE" && (
          <button onClick={() => onEnd(c.id)} className="text-xs text-brand-ink-soft hover:underline shrink-0">
            Terminar ahora
          </button>
        )}
      </div>

      {(c.status === "ENDED" && c.results ? true : c.rewards.length > 0) && (
        <div className="mt-3 pt-3 border-t border-brand-line">
          {c.status === "ENDED" && c.results && <ChallengeResultsGrid type={c.type} results={c.results} />}

          {c.rewards.length > 0 && (
            <div className={c.status === "ENDED" && c.results ? "mt-3" : ""}>
              <p className="text-xs text-brand-ink-soft mb-2">
                {c.rewards.length} premio(s) otorgado(s) · {formatCOP(totalAwarded)} en total
              </p>
              <div className="space-y-1">
                {c.rewards.map((r) => (
                  <div key={r.id} className="flex justify-between text-xs font-mono">
                    <span className="text-brand-ink">{r.creator.displayName}</span>
                    <span className="text-brand-ink-soft">
                      {formatCOP(r.amount)} · {rewardStatusLabel[r.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChallengesPanel({
  offers,
  challenges,
  submissions,
}: {
  offers: { id: string; name: string; defaultCommissionPercent: number; defaultDiscountPercent: number }[];
  challenges: Challenge[];
  submissions: Submission[];
}) {
  const router = useRouter();

  async function handleEnd(challengeId: string) {
    await fetch("/api/marca/retos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    router.refresh();
  }

  const active = challenges.filter((c) => c.status === "ACTIVE");
  const ended = challenges.filter((c) => c.status === "ENDED");

  return (
    <div>
      {submissions.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display font-semibold text-brand-ink mb-3">
            Participaciones por revisar ({submissions.length})
          </h2>
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-2xl border border-brand-line bg-brand-surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-brand-ink-soft mb-1">
                      {s.challenge.name} · {s.creator.displayName}
                    </p>
                    {s.submissionUrl && (
                      <a href={s.submissionUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-accent hover:underline break-all">
                        {s.submissionUrl}
                      </a>
                    )}
                    {s.submissionNote && <p className="text-sm text-brand-ink-soft mt-1">{s.submissionNote}</p>}
                    <p className="text-xs font-mono text-brand-ink-soft mt-2">Bono: {formatCOP(s.amount)}</p>
                  </div>
                  <ReviewSubmissionButtons rewardId={s.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {offers.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-6">Crea primero una oferta para poder lanzar campañas sobre ella.</p>
      ) : active.length > 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 mb-8">
          <h2 className="font-display font-semibold text-brand-ink mb-2">Crear una campaña</h2>
          <p className="text-sm text-brand-ink-soft">
            Por ahora solo puedes tener <strong>una campaña activa a la vez</strong>. Termina{" "}
            <strong>&quot;{active[0].name}&quot;</strong> antes de crear otra.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 mb-8">
          <h2 className="font-display font-semibold text-brand-ink mb-1">Crear una campaña</h2>
          <p className="text-xs text-brand-ink-soft mb-4">Por ahora solo puedes tener una campaña activa a la vez.</p>
          <ChallengeForm offers={offers} />
        </div>
      )}

      <div className="mb-8">
        <h2 className="font-display font-semibold text-brand-ink mb-4">Campañas activas ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">No tienes ninguna campaña activa ahora mismo.</p>
        ) : (
          <div className="space-y-4">
            {active.map((c) => (
              <ChallengeCard key={c.id} c={c} onEnd={handleEnd} />
            ))}
          </div>
        )}
      </div>

      {ended.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-brand-ink mb-4">Campañas terminadas ({ended.length})</h2>
          <div className="space-y-4">
            {ended.map((c) => (
              <ChallengeCard key={c.id} c={c} onEnd={handleEnd} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
