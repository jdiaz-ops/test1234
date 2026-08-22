"use client";

import { useState } from "react";
import { OfferForm } from "./offer-form";

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
    <div className="rounded-xl bg-brand-bg border border-brand-line overflow-hidden">
      <div className="flex items-center gap-2 bg-brand-accent-soft px-4 py-2 border-b border-brand-line">
        <span className="font-mono text-[10px] font-semibold tracking-widest text-brand-accent">
          EJEMPLO
        </span>
        <span className="text-xs text-brand-ink">
          si un cliente compra por {formatCOP(listPrice)}
        </span>
      </div>
      <div className="p-4 text-xs font-mono space-y-1.5">
        <div className="flex justify-between text-brand-ink-soft">
          <span>Compra del cliente</span>
          <span>{formatCOP(listPrice)}</span>
        </div>
        <div className="flex justify-between text-brand-ink-soft">
          <span>Descuento al consumidor final ({discount}%)</span>
          <span>-{formatCOP(listPrice - netAmount)}</span>
        </div>
        <div className="flex justify-between text-brand-ink-soft">
          <span>Comisión para el creador ({commission}%)</span>
          <span>-{formatCOP(commissionAmount)}</span>
        </div>
        <div className="flex justify-between text-brand-ink-soft">
          <span>Tarifa Marcolini ({platformFeePercent}% + IVA)</span>
          <span>-{formatCOP(feeAmount + vatAmount)}</span>
        </div>
        <div className="flex justify-between text-brand-ink font-semibold pt-1.5 border-t border-brand-line">
          <span>Tú recibes</span>
          <span>{formatCOP(brandReceives)}</span>
        </div>
      </div>
    </div>
  );
}

export function OffersPanel({
  offers,
  platformFeePercent,
  vatPercent,
}: {
  offers: Offer[];
  platformFeePercent: number;
  vatPercent: number;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-semibold text-brand-ink">
          {offers.length === 0 ? "Configura tu oferta" : "Tu oferta"}
        </h2>
        {!creating && offers.length === 0 && (
          <button
            onClick={() => setCreating(true)}
            className="text-sm text-brand-accent font-medium hover:underline"
          >
            + Crear oferta
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 mb-6">
          <OfferForm onDone={() => setCreating(false)} />
        </div>
      )}

      <div className="space-y-4">
        {offers.map((offer) => (
          <div key={offer.id} className="rounded-2xl border border-brand-line bg-brand-surface p-6">
            {editingId === offer.id ? (
              <OfferForm
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
                      <span className={offer.status === "ACTIVE" ? "text-brand-accent" : ""}>
                        {offer.status === "ACTIVE" ? "Activa" : "Pausada"}
                      </span>
                    </p>
                    <p className="font-display font-semibold text-brand-ink">{offer.name}</p>
                  </div>
                  <button
                    onClick={() => setEditingId(offer.id)}
                    className="text-xs bg-brand-accent-soft text-brand-accent font-medium rounded-full px-4 py-1.5 hover:bg-brand-accent hover:text-white transition-colors shrink-0"
                  >
                    Editar oferta
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4 max-w-xs">
                  <div>
                    <p className="text-xs text-brand-ink-soft mb-0.5">Comisión para el creador</p>
                    <p className="font-mono text-brand-accent text-lg">{Number(offer.defaultCommissionPercent)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-ink-soft mb-0.5">Descuento al consumidor final</p>
                    <p className="font-mono text-brand-ink text-lg">{Number(offer.defaultDiscountPercent)}%</p>
                  </div>
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
