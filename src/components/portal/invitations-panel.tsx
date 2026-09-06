"use client";

import { useState } from "react";

export type InvitationRow = {
  id: string;
  commissionPercentOverride: number | null;
  discountPercentOverride: number | null;
  message: string | null;
  createdAt: string;
  offer: {
    name: string;
    defaultCommissionPercent: number;
    defaultDiscountPercent: number;
    brand: { companyName: string; logoUrl: string | null };
  };
};

function InvitationCard({
  invitation,
  suggestedCode,
  onResolved,
}: {
  invitation: InvitationRow;
  suggestedCode: string;
  onResolved: (id: string) => void;
}) {
  const [code, setCode] = useState(suggestedCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const commission =
    invitation.commissionPercentOverride ??
    invitation.offer.defaultCommissionPercent;
  const discount =
    invitation.discountPercentOverride ??
    invitation.offer.defaultDiscountPercent;
  const hasSpecialTerms =
    invitation.commissionPercentOverride != null ||
    invitation.discountPercentOverride != null;

  async function respond(decision: "ACCEPT" | "DECLINE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/creador/invitaciones/${invitation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          desiredCode: decision === "ACCEPT" ? code : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo procesar.");
        return;
      }
      onResolved(invitation.id);
    } catch {
      setError("No se pudo procesar — revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-accent bg-brand-accent-soft/40 p-4">
      <div className="flex items-center gap-3">
        {invitation.offer.brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo de la marca
          <img
            src={invitation.offer.brand.logoUrl}
            alt={invitation.offer.brand.companyName}
            className="w-10 h-10 rounded-full object-cover border border-brand-line shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-brand-accent-soft flex items-center justify-center font-display font-semibold text-brand-accent shrink-0">
            {invitation.offer.brand.companyName[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-ink truncate">
            {invitation.offer.brand.companyName} te invitó directo
          </p>
          <p className="text-xs text-brand-ink-soft truncate">
            {invitation.offer.name}
          </p>
        </div>
      </div>

      {invitation.message && (
        <p className="mt-3 text-xs text-brand-ink-soft italic">
          &ldquo;{invitation.message}&rdquo;
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-xl bg-white px-2.5 py-2">
          <p className="font-mono text-base font-medium text-brand-ink leading-tight">
            {discount}%
          </p>
          <p className="text-[11px] text-brand-ink-soft leading-snug mt-0.5">
            Descuento para tu comunidad
          </p>
        </div>
        <div className="rounded-xl bg-white px-2.5 py-2">
          <p className="font-mono text-base font-medium text-brand-accent leading-tight">
            {commission}%
          </p>
          <p className="text-[11px] text-brand-ink-soft leading-snug mt-0.5">
            Tu comisión por venta
          </p>
        </div>
      </div>
      {hasSpecialTerms && (
        <p className="text-xs text-brand-accent mt-2 font-medium">
          Términos especiales solo para ti
        </p>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {accepting ? (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-brand-ink mb-1">
            Tu código de descuento
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="input text-sm font-mono"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => respond("ACCEPT")}
              disabled={busy}
              className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "..." : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setAccepting(false)}
              className="text-xs text-brand-ink-soft hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setAccepting(true)}
            disabled={busy}
            className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => respond("DECLINE")}
            disabled={busy}
            className="border border-brand-line rounded-full px-4 py-1.5 text-xs font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

export function InvitationsPanel({
  initialInvitations,
  suggestedCode,
}: {
  initialInvitations: InvitationRow[];
  suggestedCode: string;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  if (invitations.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="font-display font-semibold text-brand-ink mb-1">
        Invitaciones directas ({invitations.length})
      </h2>
      <p className="text-sm text-brand-ink-soft mb-4">
        Marcas que te invitaron directo a su programa, sin que tengas que
        aplicar.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {invitations.map((inv) => (
          <InvitationCard
            key={inv.id}
            invitation={inv}
            suggestedCode={suggestedCode}
            onResolved={(id) =>
              setInvitations((prev) => prev.filter((x) => x.id !== id))
            }
          />
        ))}
      </div>
    </div>
  );
}
