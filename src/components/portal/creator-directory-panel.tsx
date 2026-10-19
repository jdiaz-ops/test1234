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

/// Una Caja PR que se le puede proponer (ver pr-box-service.ts).
type PrBoxOption = { id: string; name: string; left: number };

type OfferOption = {
  id: string;
  name: string;
  defaultCommissionPercent: number;
  defaultDiscountPercent: number;
};

type SampleProductOption = {
  id: string;
  name: string;
  imageUrl: string | null;
  sampleStock: number;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

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

/// "Reclutar": invitarla a tu programa (y, si todavía no tienes programa,
/// armarlo ahí mismo), proponerle una Caja PR u ofrecerle una muestra.
/// Antes, sin programa ni muestras, solo salía "No tienes ningún producto
/// habilitado para muestras" (2026-10-19).
function RecruitPanel({
  creator,
  offers,
  sampleProducts,
  prBoxes,
  platformFeePercent,
  vatPercent,
  onClose,
}: {
  creator: CreatorResult;
  offers: OfferOption[];
  sampleProducts: SampleProductOption[];
  prBoxes: PrBoxOption[];
  platformFeePercent: number;
  vatPercent: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"invite" | "box" | "sample">("invite");

  // ---- Invitar a unirse ----
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

  // ---- Proponer una Caja PR ----
  const [boxId, setBoxId] = useState(prBoxes[0]?.id ?? "");
  const [boxMessage, setBoxMessage] = useState("");
  const [boxBusy, setBoxBusy] = useState(false);
  const [boxError, setBoxError] = useState<string | null>(null);
  const [boxSent, setBoxSent] = useState(false);

  async function sendBox() {
    setBoxBusy(true);
    setBoxError(null);
    try {
      const res = await fetch(`/api/marca/tienda/cajas-pr/${boxId}/proponer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorIds: [creator.id], message: boxMessage }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setBoxError(body?.error ?? "No se pudo proponer la caja.");
        return;
      }
      if (body?.proposed === 0) {
        setBoxError("Esta creadora ya tiene esta caja (pedida o propuesta).");
        return;
      }
      setBoxSent(true);
    } catch {
      setBoxError("No se pudo enviar — revisa tu conexión.");
    } finally {
      setBoxBusy(false);
    }
  }

  // ---- Ofrecer muestra ----
  const [productId, setProductId] = useState(sampleProducts[0]?.id ?? "");
  const selectedProduct = sampleProducts.find((p) => p.id === productId);
  const [sampleQuantity, setSampleQuantity] = useState(1);
  const [sampleMessage, setSampleMessage] = useState("");
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleSent, setSampleSent] = useState(false);

  async function sendSampleOffer() {
    setSampleBusy(true);
    setSampleError(null);
    try {
      const res = await fetch("/api/marca/creadores/ofrecer-muestra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: creator.id,
          productId,
          quantity: sampleQuantity,
          message: sampleMessage,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSampleError(body?.error ?? "No se pudo enviar la oferta.");
        return;
      }
      setSampleSent(true);
    } catch {
      setSampleError("No se pudo enviar — revisa tu conexión.");
    } finally {
      setSampleBusy(false);
    }
  }

  const tabs = [
    { key: "invite" as const, label: "Invitar a tu programa" },
    ...(prBoxes.length > 0 ? [{ key: "box" as const, label: "Proponer Caja PR" }] : []),
    ...(sampleProducts.length > 0 ? [{ key: "sample" as const, label: "Ofrecer muestra" }] : []),
  ];

  return (
    <div className="mt-4 pt-4 border-t border-brand-line space-y-4">
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                tab === t.key ? "bg-brand-accent text-white" : "border border-brand-line text-brand-ink-soft"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "invite" &&
        (offers.length === 0 ? (
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
            Invitación enviada — te avisamos cuando responda.
          </p>
        ) : (
          <div className="space-y-3">
            {offers.length > 1 && (
              <div>
                <label className="block text-xs text-brand-ink mb-1">
                  Programa
                </label>
                <select
                  value={selectedOffer?.id ?? ""}
                  onChange={(e) => setOfferId(e.target.value)}
                  className="input text-sm"
                >
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
                <label className="block text-xs text-brand-ink mb-1">
                  Comisión especial (%, opcional)
                </label>
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
                <label className="block text-xs text-brand-ink mb-1">
                  Descuento especial (%, opcional)
                </label>
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
              <label className="block text-xs text-brand-ink mb-1">
                Mensaje (opcional)
              </label>
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
        ))}

      {tab === "box" &&
        (boxSent ? (
          <p className="text-sm text-brand-accent">Caja propuesta — te avisamos cuando la acepte.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-brand-ink mb-1">Caja</label>
              <select value={boxId} onChange={(e) => setBoxId(e.target.value)} className="input text-sm">
                {prBoxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (quedan {b.left})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-brand-ink mb-1">Mensaje (opcional)</label>
              <textarea
                value={boxMessage}
                onChange={(e) => setBoxMessage(e.target.value.slice(0, 500))}
                placeholder="Ej. queremos que seas de las primeras en probar la colección..."
                className="input text-sm min-h-16"
              />
            </div>
            {boxError && <p className="text-xs text-red-600">{boxError}</p>}
            <button
              type="button"
              onClick={sendBox}
              disabled={boxBusy || !boxId}
              className="bg-brand-accent text-white rounded-full px-5 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {boxBusy ? "Enviando..." : "Proponer la caja"}
            </button>
          </div>
        ))}

      {tab === "sample" &&
        (sampleSent ? (
          <p className="text-sm text-brand-accent">
            Oferta de muestra enviada — te avisamos si la acepta.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-brand-ink mb-1">
                Producto
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="input text-sm"
              >
                {sampleProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sampleStock} disponibles)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-brand-ink mb-1">
                Cantidad
              </label>
              <input
                type="number"
                min={1}
                max={Math.min(5, selectedProduct?.sampleStock ?? 5)}
                value={sampleQuantity}
                onChange={(e) => setSampleQuantity(Number(e.target.value))}
                className="input text-sm w-24"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-ink mb-1">
                Mensaje (opcional)
              </label>
              <textarea
                value={sampleMessage}
                onChange={(e) => setSampleMessage(e.target.value.slice(0, 300))}
                placeholder="Ej. queremos que la pruebes para tu contenido de uñas..."
                className="input text-sm min-h-16"
              />
            </div>
            {sampleError && <p className="text-xs text-red-600">{sampleError}</p>}
            <button
              type="button"
              onClick={sendSampleOffer}
              disabled={sampleBusy}
              className="bg-brand-accent text-white rounded-full px-5 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {sampleBusy ? "Enviando..." : "Ofrecer muestra"}
            </button>
          </div>
        ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onClose} className="text-xs text-brand-ink-soft hover:underline">
          Cerrar
        </button>
        {prBoxes.length === 0 && sampleProducts.length === 0 && (
          <p className="text-xs text-brand-ink-soft">
            ¿Quieres regalarle algo?{" "}
            <Link href="/marca/tienda/muestras" className="font-medium text-brand-accent hover:underline">
              Arma una Caja PR o elige productos en Muestras
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function CreatorDirectoryPanel({
  verticals,
  offers,
  sampleProducts,
  prBoxes,
  platformFeePercent,
  vatPercent,
}: {
  verticals: { id: string; name: string }[];
  offers: OfferOption[];
  sampleProducts: SampleProductOption[];
  prBoxes: PrBoxOption[];
  platformFeePercent: number;
  vatPercent: number;
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
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
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

              {c.scoreData.score !== null && (
                <p className="text-xs text-brand-ink-soft mt-2 font-mono">
                  {formatCOP(c.scoreData.netAmount90d)} en ventas (últimos 90
                  días) · {c.scoreData.totalTransactions} venta(s) en total
                </p>
              )}

              {openCreatorId === c.id ? (
                <RecruitPanel
                  creator={c}
                  offers={offers}
                  sampleProducts={sampleProducts}
                  prBoxes={prBoxes}
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
                  Reclutar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
