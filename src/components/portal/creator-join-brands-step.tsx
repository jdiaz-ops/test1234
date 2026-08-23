"use client";

import { useState, useMemo } from "react";
import { JoinOfferButton } from "@/components/portal/join-offer-button";
import { LeaveOfferButton } from "@/components/portal/leave-offer-button";
import { BrandMiniProfile } from "@/components/portal/brand-mini-profile";

type Offer = {
  id: string;
  name: string;
  joinMode: string;
  defaultCommissionPercent: number;
  defaultDiscountPercent: number;
  suggestedCode: string;
  enrollmentStatus: "ACTIVE" | "PENDING_APPROVAL" | null;
  enrollmentId: string | null;
  brand: { companyName: string; logoUrl: string | null; description: string | null; websiteUrl: string | null };
};

/// Filtrado en el navegador (sin recargar la página) sobre la lista ya
/// filtrada por categoría de interés en el servidor — así el buscador no
/// reinicia el acordeón del wizard, y no hace falta mostrar las 200
/// ofertas de una.
export function CreatorJoinBrandsStep({ offers, filteredByInterests }: { offers: Offer[]; filteredByInterests: boolean }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (o) => o.brand.companyName.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)
    );
  }, [offers, search]);

  return (
    <div className="max-w-2xl">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar marca u oferta..."
        className="input mb-4"
      />
      {filteredByInterests && (
        <p className="text-xs text-brand-ink-soft mb-4">
          Te mostramos primero las marcas de tus categorías de interés — busca arriba para ver otras.
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">No hay ofertas disponibles con ese filtro por ahora.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((offer) => (
            <div key={offer.id} className="rounded-2xl border border-brand-line bg-brand-surface p-4">
              <BrandMiniProfile
                companyName={offer.brand.companyName}
                logoUrl={offer.brand.logoUrl}
                description={offer.brand.description}
                websiteUrl={offer.brand.websiteUrl}
              />
              <div className="grid grid-cols-2 gap-2.5 mt-4 mb-4">
                <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                  <p className="font-mono text-lg font-medium text-brand-ink leading-tight">{offer.defaultDiscountPercent}%</p>
                  <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Código de descuento para tu comunidad</p>
                </div>
                <div className="rounded-xl bg-brand-accent-soft px-3 py-2.5">
                  <p className="font-mono text-lg font-medium text-brand-accent leading-tight">{offer.defaultCommissionPercent}%</p>
                  <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Tu comisión por cada venta con tu código</p>
                </div>
              </div>
              {offer.enrollmentStatus ? (
                <div className="text-center space-y-1.5">
                  <p className={`text-sm font-medium ${offer.enrollmentStatus === "ACTIVE" ? "text-brand-accent" : "text-brand-ink-soft"}`}>
                    {offer.enrollmentStatus === "ACTIVE" ? "Ya estás unido ✓" : "Esperando aprobación"}
                  </p>
                  {offer.enrollmentId && <LeaveOfferButton enrollmentId={offer.enrollmentId} />}
                </div>
              ) : (
                <JoinOfferButton offerId={offer.id} joinMode={offer.joinMode} suggestedCode={offer.suggestedCode} fullWidth />
              )}
            </div>
          ))}
        </div>
      )}

      <a href="/creador/marketplace" className="block text-xs text-brand-accent font-medium hover:underline mt-4">
        Ver el marketplace completo →
      </a>
    </div>
  );
}
