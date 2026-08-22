"use client";

import { useState } from "react";
import { CurrencyInput } from "@/components/portal/currency-input";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

/// Simulador de reparto de una venta: dado un ticket de compra (editable —
/// el promedio real de la marca, no un ejemplo fijo), muestra exactamente
/// cuánto se lleva el creador de contenido, cuánto Marcolini, y cuánto le
/// queda a la marca. Se usa tanto al configurar la oferta (onboarding y
/// Oferta y comisión) como al revisarla ya guardada.
export function CostCalculator({
  commission,
  discount,
  platformFeePercent,
  vatPercent,
  editableTicket = true,
}: {
  commission: number;
  discount: number;
  platformFeePercent: number;
  vatPercent: number;
  editableTicket?: boolean;
}) {
  const [ticketRaw, setTicketRaw] = useState("100000");
  const listPrice = Number(ticketRaw) || 0;
  const netAmount = listPrice * (1 - discount / 100);
  const commissionAmount = netAmount * (commission / 100);
  const feeAmount = netAmount * (platformFeePercent / 100);
  const vatAmount = feeAmount * (vatPercent / 100);
  const brandReceives = netAmount - commissionAmount - feeAmount - vatAmount;

  return (
    <div className="rounded-xl bg-brand-bg border border-brand-line overflow-hidden">
      <div className="flex items-center gap-2 bg-brand-accent-soft px-4 py-2 border-b border-brand-line">
        <span className="font-mono text-[10px] font-semibold tracking-widest text-brand-accent">SIMULADOR</span>
        <span className="text-xs text-brand-ink">así se reparte una venta con tus números</span>
      </div>
      <div className="p-4 space-y-3">
        {editableTicket && (
          <div>
            <label className="block text-xs text-brand-ink-soft mb-1">Tu ticket promedio de compra</label>
            <CurrencyInput value={ticketRaw} onChange={setTicketRaw} placeholder="100.000" />
          </div>
        )}
        <div className="text-xs font-mono space-y-1.5">
          <div className="flex justify-between text-brand-ink-soft">
            <span>Compra del cliente</span>
            <span>{formatCOP(listPrice)}</span>
          </div>
          <div className="flex justify-between text-brand-ink-soft">
            <span>Descuento en tu página web ({discount}%)</span>
            <span>-{formatCOP(listPrice - netAmount)}</span>
          </div>
          <div className="flex justify-between text-brand-ink-soft">
            <span>Comisión para el creador de contenido ({commission}%)</span>
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
    </div>
  );
}
