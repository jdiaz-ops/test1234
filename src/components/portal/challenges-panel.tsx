"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChallengeForm } from "./challenge-form";
import { ChallengeTemplates, buildChallengeTemplates } from "./challenge-templates";
import type { ChallengeType, ChallengeTemplate } from "@/lib/challenge-types";

const typeLabel: Record<ChallengeType, string> = {
  GOAL_BONUS: "Bono por ventas generadas",
  TEMP_COMMISSION_BOOST: "Comisión temporal elevada (todos los creadores)",
  LEADERBOARD: "Leaderboard",
  WELCOME_BONUS: "Bono de bienvenida",
  CONTENT_CHALLENGE: "Campaña de contenido",
  TEMP_DISCOUNT_BOOST: "Descuento especial temporal",
};

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

interface Challenge {
  id: string;
  name: string;
  type: ChallengeType;
  status: "ACTIVE" | "ENDED";
  startDate: string;
  endDate: string;
  offer: { name: string };
  rewards: Reward[];
  /// Solo tiene sentido para TEMP_DISCOUNT_BOOST — si el % elevado ya está
  /// puesto de verdad en la tienda (true) o todavía no le tocaba/ya se
  /// devolvió a la normal (false). Ver syncDiscountBoosts en
  /// challenge-service.ts.
  discountBoostActive: boolean;
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
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState<ChallengeTemplate | undefined>(undefined);

  function useTemplate(t: ChallengeTemplate) {
    setTemplate(t);
    setCreating(true);
  }

  function closeForm() {
    setCreating(false);
    setTemplate(undefined);
  }

  async function handleEnd(challengeId: string) {
    await fetch("/api/marca/retos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    router.refresh();
  }

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

      {!creating && offers.length > 0 && (
        <ChallengeTemplates
          templates={buildChallengeTemplates(offers[0].defaultCommissionPercent, offers[0].defaultDiscountPercent)}
          defaultCommissionPercent={offers[0].defaultCommissionPercent}
          defaultDiscountPercent={offers[0].defaultDiscountPercent}
          onUseTemplate={useTemplate}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-semibold text-brand-ink">Tus campañas ({challenges.length})</h2>
        {!creating && offers.length > 0 && (
          <button
            onClick={() => setCreating(true)}
            className="bg-brand-accent text-white text-sm font-medium rounded-full px-5 py-2 hover:opacity-90"
          >
            Crear una nueva campaña desde cero
          </button>
        )}
      </div>

      {offers.length === 0 && (
        <p className="text-sm text-brand-ink-soft mb-6">Crea primero una oferta para poder lanzar campañas sobre ella.</p>
      )}

      {creating && (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 mb-6">
          <ChallengeForm offers={offers} template={template} onDone={closeForm} />
        </div>
      )}

      {challenges.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">Todavía no has creado ninguna campaña.</p>
      ) : (
        <div className="space-y-4">
          {challenges.map((c) => {
            const totalAwarded = c.rewards.reduce((sum, r) => sum + r.amount, 0);
            return (
              <div key={c.id} className="rounded-2xl border border-brand-line bg-brand-surface p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-brand-ink-soft mb-1">
                      {c.offer.name} · {typeLabel[c.type]} ·{" "}
                      <span className={c.status === "ACTIVE" ? "text-brand-accent" : ""}>
                        {c.status === "ACTIVE" ? "Activo" : "Terminado"}
                      </span>
                    </p>
                    <p className="font-display font-semibold text-brand-ink">{c.name}</p>
                    <p className="text-xs font-mono text-brand-ink-soft mt-1">
                      {new Date(c.startDate).toLocaleDateString("es-CO")} — {new Date(c.endDate).toLocaleDateString("es-CO")}
                    </p>
                    {c.type === "TEMP_DISCOUNT_BOOST" && c.status === "ACTIVE" && (
                      <p className="text-xs mt-1">
                        {c.discountBoostActive ? (
                          <span className="text-emerald-600">● Descuento elevado activo en tu tienda</span>
                        ) : (
                          <span className="text-brand-ink-soft">○ Todavía no se aplica en tu tienda</span>
                        )}
                      </p>
                    )}
                  </div>
                  {c.status === "ACTIVE" && (
                    <button onClick={() => handleEnd(c.id)} className="text-xs text-brand-ink-soft hover:underline shrink-0">
                      Terminar ahora
                    </button>
                  )}
                </div>

                {c.rewards.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-brand-line">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
