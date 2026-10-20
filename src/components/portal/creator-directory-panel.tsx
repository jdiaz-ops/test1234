"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OfferForm } from "@/components/portal/offer-form";
import { socialProfileUrl, sortSocialLinks } from "@/lib/social-links";

type ScoreData = {
  score: number | null;
  netAmount90d: number;
  netAmountTotal: number;
  totalTransactions: number;
  hasSaleLast30Days: boolean;
};

type CreatorResult = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  bio: string | null;
  city: string | null;
  vertical: { name: string } | null;
  socialLinks: SocialLink[];
  scoreData: ScoreData;
};

type SocialLink = { platform: string; handle: string; approxFollowers: number | null };

type OfferOption = {
  id: string;
  name: string;
  defaultCommissionPercent: number;
  defaultDiscountPercent: number;
};

function followers(n: number | null) {
  if (!n) return "";
  return n >= 1000 ? ` · ${(n / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil` : ` · ${n}`;
}

/// Sus redes, con el link a cada perfil — en vez del score (pedido del
/// 2026-10-19: "más bien poner el link Instagram, TikTok o YouTube, o lo
/// que esté disponible").
function SocialLinks({ links }: { links: SocialLink[] }) {
  const shown = sortSocialLinks(links).filter((l) => l.handle.trim());
  if (shown.length === 0) return <span className="text-xs text-brand-ink-soft">Sin redes en su perfil</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((l) => {
        const url = socialProfileUrl(l.platform, l.handle);
        const text = (
          <>
            <span className="font-medium">{l.platform}</span>
            <span className="text-brand-ink-soft">
              {l.handle.includes("/") ? "" : ` @${l.handle.replace(/^@/, "")}`}
              {followers(l.approxFollowers)}
            </span>
          </>
        );
        return url ? (
          <a
            key={`${l.platform}-${l.handle}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 rounded-full border border-brand-line px-2.5 py-1 text-xs text-brand-ink hover:bg-brand-accent-soft"
          >
            {text} <span aria-hidden className="text-brand-ink-soft">↗</span>
          </a>
        ) : (
          <span key={`${l.platform}-${l.handle}`} className="inline-flex items-center gap-0.5 rounded-full border border-brand-line px-2.5 py-1 text-xs text-brand-ink">
            {text}
          </span>
        );
      })}
    </div>
  );
}

/// "Invitar a tu programa": primero se invita; cuando acepta, queda en
/// Vinculados y ahí se le proponen Cajas PR y muestras (pedido del
/// 2026-10-19: "primero se invita al programa, si acepta ahí sí se habilita
/// para proponer caja PR"). Si la marca todavía no tiene programa, lo arma
/// ahí mismo.
function InvitePanel({
  creator,
  offers,
  platformFeePercent,
  vatPercent,
  onClose,
}: {
  creator: CreatorResult;
  offers: OfferOption[];
  platformFeePercent: number;
  vatPercent: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const selectedOffer = offers.find((o) => o.id === offerId) ?? offers[0];
  const [commissionOverride, setCommissionOverride] = useState("");
  const [discountOverride, setDiscountOverride] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitingBusy, setInvitingBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  async function sendInvite() {
    setInvitingBusy(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/marca/creadores/invitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: selectedOffer?.id ?? offerId,
          creatorId: creator.id,
          commissionPercentOverride: commissionOverride || null,
          discountPercentOverride: discountOverride || null,
          message: inviteMessage,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setInviteError(body?.error ?? "No se pudo enviar la invitación.");
        return;
      }
      setInviteSent(true);
    } catch {
      setInviteError("No se pudo enviar — revisa tu conexión.");
    } finally {
      setInvitingBusy(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-brand-line space-y-4">
      {offers.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-brand-ink">
            Para invitar a {creator.displayName}, primero arma tu programa: la comisión que le pagas por cada venta y el descuento para su comunidad.
          </p>
          <div className="rounded-xl border border-brand-line bg-brand-bg p-4">
            <OfferForm platformFeePercent={platformFeePercent} vatPercent={vatPercent} onDone={() => router.refresh()} />
          </div>
        </div>
      ) : inviteSent ? (
        <p className="text-sm text-brand-accent">
          Invitación enviada — te avisamos cuando responda. Si acepta, la encuentras en Vinculados.
        </p>
      ) : (
        <div className="space-y-3">
          {offers.length > 1 && (
            <div>
              <label className="block text-xs text-brand-ink mb-1">Programa</label>
              <select value={selectedOffer?.id ?? ""} onChange={(e) => setOfferId(e.target.value)} className="input text-sm">
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-brand-ink-soft">
            Tu programa: {selectedOffer?.defaultCommissionPercent}% de comisión para ella y {selectedOffer?.defaultDiscountPercent}% de descuento para su comunidad. Si quieres ofrecerle algo distinto, cámbialo aquí.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-ink mb-1">Comisión especial (%, opcional)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={commissionOverride}
                onChange={(e) => setCommissionOverride(e.target.value)}
                placeholder={String(selectedOffer?.defaultCommissionPercent ?? "")}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-ink mb-1">Descuento especial (%, opcional)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountOverride}
                onChange={(e) => setDiscountOverride(e.target.value)}
                placeholder={String(selectedOffer?.defaultDiscountPercent ?? "")}
                className="input text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-brand-ink mb-1">Mensaje (opcional)</label>
            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value.slice(0, 300))}
              placeholder="Ej. nos encanta tu contenido de uñas, nos gustaría trabajar contigo..."
              className="input text-sm min-h-16"
            />
          </div>
          {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
          <button
            type="button"
            onClick={sendInvite}
            disabled={invitingBusy}
            className="bg-brand-accent text-white rounded-full px-5 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {invitingBusy ? "Enviando..." : "Enviar invitación"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onClose} className="text-xs text-brand-ink-soft hover:underline">
          Cerrar
        </button>
        <p className="text-xs text-brand-ink-soft">Cuando acepte, en Vinculados le puedes proponer muestras y productos.</p>
      </div>
    </div>
  );
}

/// A dónde lleva todo lo de invitar mientras la marca no termina sus pasos:
/// la lista "Lo que falta para ser visible en el marketplace" del Dashboard.
const STEPS_HREF = "/marca#lo-que-falta";

function LockIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/// Mientras la marca no termina el registro (ver getRecruitGate): puede ver
/// la red, pero invitar espera a que termine (pedido del 2026-10-20).
function RecruitLockedBanner({ approved, missing }: { approved: boolean; missing: number }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-brand-accent/30 bg-brand-accent-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-white">
          <LockIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-ink">
            {missing > 0
              ? "Termina el proceso de registro para empezar a invitar creadoras a tu programa y ser visible en el marketplace."
              : "Ya terminaste tus pasos: apenas aprobemos tu marca podrás invitar creadoras y saldrás en el marketplace."}
          </p>
          {missing > 0 && (
            <p className="mt-0.5 text-xs text-brand-ink-soft">
              {missing === 1 ? "Te falta 1 paso." : `Te faltan ${missing} pasos.`} Mientras tanto, conoce a las creadoras de la red.
            </p>
          )}
          {missing === 0 && !approved && <p className="mt-0.5 text-xs text-brand-ink-soft">Mientras tanto, conoce a las creadoras de la red.</p>}
        </div>
      </div>
      {missing > 0 && (
        <Link href={STEPS_HREF} className="shrink-0 self-start rounded-full bg-brand-accent px-5 py-2.5 text-center text-xs font-medium text-white hover:opacity-90 sm:self-center">
          Ver los pasos que faltan →
        </Link>
      )}
    </div>
  );
}

export function CreatorDirectoryPanel({
  verticals,
  offers,
  platformFeePercent,
  vatPercent,
  recruit,
}: {
  verticals: { id: string; name: string }[];
  offers: OfferOption[];
  platformFeePercent: number;
  vatPercent: number;
  /// Si ya puede invitar (ver getRecruitGate en go-live-service.ts).
  recruit: { allowed: boolean; approved: boolean; missing: number };
}) {
  const [query, setQuery] = useState("");
  const [verticalId, setVerticalId] = useState("");
  const [city, setCity] = useState("");
  const [history, setHistory] = useState<"" | "true" | "false">("");
  const [results, setResults] = useState<CreatorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCreatorId, setOpenCreatorId] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (verticalId) params.set("verticalId", verticalId);
      if (city) params.set("city", city);
      if (history) params.set("hasSalesHistory", history);
      const res = await fetch(`/api/marca/creadores/buscar?${params}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo buscar.");
        return;
      }
      setResults(body.creators);
    } catch {
      setError("No se pudo buscar — revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Sincroniza el resultado con un sistema externo (la API) cada vez que
    // cambian los filtros, incluyendo el primer render (búsqueda inicial).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver justificación arriba
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verticalId, city, history]);

  return (
    <div>
      {!recruit.allowed && <RecruitLockedBanner approved={recruit.approved} missing={recruit.missing} />}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Buscar por nombre..."
          className="input text-sm"
        />
        <select
          value={verticalId}
          onChange={(e) => setVerticalId(e.target.value)}
          className="input text-sm"
        >
          <option value="">Toda categoría</option>
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Ciudad"
          className="input text-sm"
        />
        <select
          value={history}
          onChange={(e) => setHistory(e.target.value as "" | "true" | "false")}
          className="input text-sm"
        >
          <option value="">Con y sin historial</option>
          <option value="true">Con historial de ventas</option>
          <option value="false">Nuevos, sin historial</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-brand-ink-soft">Buscando...</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          No hay creadores que coincidan con esos filtros.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-brand-line bg-brand-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {c.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto de perfil del creador
                    <img
                      src={c.photoUrl}
                      alt={c.displayName}
                      className="w-12 h-12 rounded-full object-cover border border-brand-line"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-accent-soft flex items-center justify-center font-display font-semibold text-brand-accent">
                      {c.displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-brand-ink">
                      {c.displayName}
                    </p>
                    <p className="text-xs text-brand-ink-soft">
                      {[c.vertical?.name, c.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <SocialLinks links={c.socialLinks} />
              </div>

              {c.bio && (
                <p className="text-xs text-brand-ink-soft mt-2">{c.bio}</p>
              )}

              {!recruit.allowed ? (
                <Link
                  href={STEPS_HREF}
                  title="Termina tus pasos para invitar creadoras"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand-line px-4 py-1.5 text-xs font-medium text-brand-ink-soft hover:bg-brand-accent-soft"
                >
                  <LockIcon className="h-3.5 w-3.5" />
                  Invitar a tu programa
                </Link>
              ) : openCreatorId === c.id ? (
                <InvitePanel
                  creator={c}
                  offers={offers}
                  platformFeePercent={platformFeePercent}
                  vatPercent={vatPercent}
                  onClose={() => setOpenCreatorId(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenCreatorId(c.id)}
                  className="mt-3 rounded-full border border-brand-line px-4 py-1.5 text-xs font-medium hover:bg-brand-accent-soft"
                >
                  Invitar a tu programa
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
