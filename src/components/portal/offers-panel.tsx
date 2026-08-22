"use client";

import { useState } from "react";
import { OfferForm } from "./offer-form";

type Category = { id: string; name: string };
type Offer = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: { name: string } | null;
  defaultCommissionPercent: number;
  defaultDiscountPercent: number;
  joinMode: "OPEN" | "APPROVAL";
  status: "ACTIVE" | "PAUSED";
  _count: { enrollments: number };
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

function CostCalculator({
  commission,
  discount,
  platformFeePercent,
  vatPercent,
}: {
  commission: number;
  discount: number;
  platformFeePercent: number;
  vatPercent: number;
}) {
  const listPrice = 100000;
  const netAmount = listPrice * (1 - discount / 100);
  const commissionAmount = netAmount * (commission / 100);
  const feeAmount = netAmount * (platformFeePercent / 100);
  const vatAmount = feeAmount * (vatPercent / 100);
  const brandReceives = netAmount - commissionAmount - feeAmount - vatAmount;

  return (
    <div className="rounded-xl bg-brand-bg border border-brand-line p-4 text-xs font-mono space-y-1">
      <div className="flex justify-between text-brand-ink-soft">
        <span>Precio de lista</span>
        <span>{formatCOP(listPrice)}</span>
      </div>
      <div className="flex justify-between text-brand-ink-soft">
        <span>Descuento cliente ({discount}%)</span>
        <span>-{formatCOP(listPrice - netAmount)}</span>
      </div>
      <div className="flex justify-between text-brand-ink-soft">
        <span>Comisión creador ({commission}%)</span>
        <span>-{formatCOP(commissionAmount)}</span>
      </div>
      <div className="flex justify-between text-brand-ink-soft">
        <span>Tarifa Marcolini ({platformFeePercent}% + IVA)</span>
        <span>-{formatCOP(feeAmount + vatAmount)}</span>
      </div>
      <div className="flex justify-between text-brand-ink font-semibold pt-1 border-t border-brand-line">
        <span>Tú recibes</span>
        <span>{formatCOP(brandReceives)}</span>
      </div>
    </div>
  );
}

export function OffersPanel({
  offers,
  categories,
  platformFeePercent,
  vatPercent,
}: {
  offers: Offer[];
  categories: Category[];
  platformFeePercent: number;
  vatPercent: number;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-semibold text-brand-ink">Tus ofertas ({offers.length})</h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="text-sm text-brand-accent font-medium hover:underline"
          >
            + Nueva oferta
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 mb-6">
          <OfferForm categories={categories} onDone={() => setCreating(false)} />
        </div>
      )}

      <div className="space-y-4">
        {offers.map((offer) => (
          <div key={offer.id} className="rounded-2xl border border-brand-line bg-brand-surface p-6">
            {editingId === offer.id ? (
              <OfferForm
                categories={categories}
                offerId={offer.id}
                initial={{
                  name: offer.name,
                  description: offer.description ?? "",
                  categoryId: offer.categoryId,
                  defaultCommissionPercent: Number(offer.defaultCommissionPercent),
                  defaultDiscountPercent: Number(offer.defaultDiscountPercent),
                  joinMode: offer.joinMode,
                  status: offer.status,
                }}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-brand-ink-soft mb-1">
                      {offer.category?.name ?? "General"} ·{" "}
                      <span className={offer.status === "ACTIVE" ? "text-brand-accent" : ""}>
                        {offer.status === "ACTIVE" ? "Activa" : "Pausada"}
                      </span>
                    </p>
                    <p className="font-display font-semibold text-brand-ink">{offer.name}</p>
                  </div>
                  <button
                    onClick={() => setEditingId(offer.id)}
                    className="text-xs text-brand-accent font-medium hover:underline shrink-0"
                  >
                    Editar
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm font-mono mb-4">
                  <span className="text-brand-accent">{Number(offer.defaultCommissionPercent)}% comisión</span>
                  <span className="text-brand-ink-soft">{Number(offer.defaultDiscountPercent)}% descuento</span>
                  <span className="text-brand-ink-soft">{offer._count.enrollments} creadores</span>
                </div>
                <CostCalculator
                  commission={Number(offer.defaultCommissionPercent)}
                  discount={Number(offer.defaultDiscountPercent)}
                  platformFeePercent={platformFeePercent}
                  vatPercent={vatPercent}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
