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
/// Oferta y comisión) como al revisarla ya guardada — ahí commission/
/// discount reflejan los campos reales del formulario y NO son editables
/// aquí (editableRates=false, el default), para no tener dos controles
/// desincronizados para el mismo número. editableRates=true es para la
/// landing (para-marcas): ahí no hay una oferta real detrás, así que se
/// deja jugar con los porcentajes — arrancan en los valores que llegan
/// por props y desde ahí son libres.
export function CostCalculator({
  commission,
  discount,
  platformFeePercent,
  vatPercent,
  editableTicket = true,
  editableRates = false,
}: {
  commission: number;
  discount: number;
  platformFeePercent: number;
  vatPercent: number;
  editableTicket?: boolean;
  editableRates?: boolean;
}) {
  const [ticketRaw, setTicketRaw] = useState("100000");
  // Texto crudo, no number: si el estado fuera number, escribir sobre un
  // "0" existente (ej. borrar y teclear "8") deja "08" pegado en pantalla
  // — al volver a parsear "08" da el mismo 8 de antes, así que React no
  // vuelve a tocar el DOM y el navegador se queda con el cero de más.
  // Guardando el string tal cual se escribe, como ya hace ticketRaw, el
  // input siempre muestra exactamente lo que el usuario tecleó.
  const [commissionRaw, setCommissionRaw] = useState(String(commission));
  const [discountRaw, setDiscountRaw] = useState(String(discount));

  const effectiveCommission = editableRates ? Number(commissionRaw) || 0 : commission;
  const effectiveDiscount = editableRates ? Number(discountRaw) || 0 : discount;

  const listPrice = Number(ticketRaw) || 0;
  const netAmount = listPrice * (1 - effectiveDiscount / 100);
  const commissionAmount = netAmount * (effectiveCommission / 100);
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
        {editableRates && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-ink-soft mb-1">% Comisión al creador</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionRaw}
                onChange={(e) => setCommissionRaw(e.target.value)}
                className="input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-ink-soft mb-1">% Descuento del código</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={discountRaw}
                onChange={(e) => setDiscountRaw(e.target.value)}
                className="input font-mono"
              />
            </div>
          </div>
        )}
        <div className="text-xs font-mono space-y-1.5">
          <div className="flex justify-between text-brand-ink-soft">
            <span>Compra del cliente</span>
            <span>{formatCOP(listPrice)}</span>
          </div>
          <div className="flex justify-between text-brand-ink-soft">
            <span>Descuento en tu página web ({effectiveDiscount}%)</span>
            <span>-{formatCOP(listPrice - netAmount)}</span>
          </div>
          <div className="flex justify-between text-brand-ink-soft">
            <span>Comisión del creador ({effectiveCommission}%)</span>
            <span>-{formatCOP(commissionAmount)}</span>
          </div>
          <div className="flex justify-between text-brand-ink-soft">
            <span>Tarifa Marcolini ({platformFeePercent}%{vatPercent > 0 ? " + IVA" : ""})</span>
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
