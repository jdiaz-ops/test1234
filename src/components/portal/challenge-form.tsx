"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeType } from "@/lib/challenge-types";
import { CurrencyInput } from "@/components/portal/currency-input";

type Offer = { id: string; name: string; defaultCommissionPercent: number; defaultDiscountPercent: number };

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/// Ojo: distinto de getBogotaDateTimeParts (usado en las tarjetas) — ahí
/// el valor de entrada es un timestamp UTC real que viene de la base de
/// datos, así que hay que restarle 5 horas para mostrar la hora Colombia.
/// Acá el valor es el string crudo de un <input type="datetime-local">, que
/// ya representa la hora tal cual la escribió la marca en su propio
/// navegador — no hay ningún corrimiento de zona que aplicar, solo se lee
/// con los getters locales normales. Nunca se renderiza en el servidor
/// (el resumen empieza en null y solo aparece después de que la marca
/// escribe algo), así que tampoco hay riesgo de mismatch de hidratación.
function formatDateTimeEs(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  const month = MONTHS_LONG[date.getMonth()];
  const hour24 = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const ampm = hour24 >= 12 ? "p. m." : "a. m.";
  const hour12 = hour24 % 12 || 12;
  return `${day} de ${month} a las ${hour12}:${minute} ${ampm}`;
}

const PICKER_CARDS: { type: ChallengeType; title: string; description: string }[] = [
  {
    type: "GOAL_BONUS",
    title: "Misión",
    description: "Si un creador llega a una meta de ventas en el período, gana un bono fijo — además de su comisión.",
  },
  {
    type: "FLASH_SALE",
    title: "Flash Sale",
    description: "Sube la comisión del creador, el descuento del comprador, o ambos, por un tiempo limitado.",
  },
  {
    type: "MIX",
    title: "Mix",
    description: "Misión + Flash Sale en una sola campaña — meta con bono, y comisión y/o descuento elevados a la vez.",
  },
];

// Sin valor por defecto para las fechas — calcular "ahora" al cargar el
// módulo generaría un mismatch de hidratación (el server y el navegador
// leen el reloj en momentos distintos, así que el HTML que manda el
// servidor no coincidiría con lo que React espera renderizar en el
// navegador). La marca las llena a mano, igual que ya pasaba antes de
// tener plantillas.
function emptyState() {
  return {
    name: "",
    type: "GOAL_BONUS" as ChallengeType,
    startDate: "",
    endDate: "",
    goalAmount: "",
    bonusAmount: "",
    commissionEnabled: false,
    newCommissionPercent: "",
    discountEnabled: false,
    newDiscountPercent: "",
    confirmed: false,
  };
}

export function ChallengeForm({ offers, onCreated }: { offers: Offer[]; onCreated?: () => void }) {
  const router = useRouter();
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const [form, setForm] = useState(emptyState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOffer = offers.find((o) => o.id === offerId);
  const { name, type, startDate, endDate, goalAmount, bonusAmount, commissionEnabled, newCommissionPercent, discountEnabled, newDiscountPercent, confirmed } = form;

  function set<K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function buildConfig(): Record<string, unknown> {
    const flashSaleFields = {
      newCommissionPercent: commissionEnabled && newCommissionPercent ? Number(newCommissionPercent) : undefined,
      newDiscountPercent: discountEnabled && newDiscountPercent ? Number(newDiscountPercent) : undefined,
    };
    switch (type) {
      case "GOAL_BONUS":
        return { type, goalAmount: Number(goalAmount), bonusAmount: Number(bonusAmount) };
      case "FLASH_SALE":
        return { type, ...flashSaleFields };
      case "MIX":
        return { type, goalAmount: Number(goalAmount), bonusAmount: Number(bonusAmount), ...flashSaleFields };
      default:
        return { type };
    }
  }

  const needsFlashSaleLever = type === "FLASH_SALE" || type === "MIX";
  const flashSaleLeverMissing = needsFlashSaleLever && !commissionEnabled && !discountEnabled;

  /// La frase que va justo antes de aprobar — se arma en vivo con lo que ya
  /// se llenó, y solo se muestra cuando alcanza para una frase completa (sin
  /// piezas a medio llenar tipo "undefined%"), para que la marca vea
  /// exactamente qué va a activar antes de confirmarlo.
  function buildSummary(): string | null {
    if (!name || !startDate || !endDate) return null;
    const startText = formatDateTimeEs(startDate);
    const endText = formatDateTimeEs(endDate);
    if (!startText || !endText) return null;

    const pieces: string[] = [];
    if (type === "GOAL_BONUS" || type === "MIX") {
      if (!goalAmount || !bonusAmount) return null;
      pieces.push(
        `cada creador que llegue a ${formatCOP(Number(goalAmount))} en ventas gana ${formatCOP(Number(bonusAmount))} de bono adicional a su comisión`
      );
    }
    if (type === "FLASH_SALE" || type === "MIX") {
      if (!commissionEnabled && !discountEnabled) return null;
      if (commissionEnabled) {
        if (!newCommissionPercent) return null;
        pieces.push(`la comisión del creador sube a ${newCommissionPercent}%`);
      }
      if (discountEnabled) {
        if (!newDiscountPercent) return null;
        pieces.push(`el descuento del comprador sube a ${newDiscountPercent}%`);
      }
    }
    if (pieces.length === 0) return null;

    // "X, Y y Z" en vez de "X, y Y, y Z" — más natural con 2 o 3 piezas (Mix
    // trae hasta 3: meta+bono, comisión, descuento).
    const detail =
      pieces.length === 1 ? pieces[0] : `${pieces.slice(0, -1).join(", ")} y ${pieces[pieces.length - 1]}`;

    // Sin mencionar la oferta acá — con un solo programa (el caso normal)
    // es información redundante que solo confunde ("Oferta de prueba" no le
    // dice nada a la marca); ya queda claro arriba, en el texto de contexto
    // del formulario. endText ya termina en "a. m."/"p. m." (con su propio
    // punto), así que no hace falta agregar uno más antes del detalle.
    return `Se va a activar tu campaña "${name}", que empieza el ${startText} y termina el ${endText} ${detail.charAt(0).toUpperCase()}${detail.slice(1)}.`;
  }

  const summary = buildSummary();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (flashSaleLeverMissing) {
      setError("Sube la comisión, el descuento, o ambos.");
      return;
    }
    if (!summary) {
      setError("Completa la campaña para poder revisarla antes de crearla.");
      return;
    }
    if (!confirmed) {
      setError("Marca la casilla de aprobación antes de crear la campaña.");
      return;
    }
    setSaving(true);
    setError(null);

    // new Date(startDate) acá se interpreta con la zona horaria real del
    // navegador de la marca (correcto) — mandar el string crudo del
    // datetime-local tal cual, sin este paso, dejaría que el servidor (que
    // corre en UTC) lo reinterprete como si esas horas fueran UTC, corriendo
    // cada campaña 5 horas de la hora que la marca realmente escribió.
    const res = await fetch("/api/marca/retos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId,
        name,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        config: buildConfig(),
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo crear la campaña.");
      return;
    }

    setForm(emptyState());
    router.refresh();
    onCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {offers.length > 1 ? (
        <div>
          <label className="block text-sm text-brand-ink mb-1">¿Para cuál de tus programas?</label>
          <select value={offerId} onChange={(e) => setOfferId(e.target.value)} className="input">
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        selectedOffer && (
          <p className="text-xs text-brand-ink-soft">
            Esta campaña aplica a tu programa: <span className="text-brand-ink font-medium">{selectedOffer.name}</span>
          </p>
        )
      )}

      <div>
        <label className="block text-sm text-brand-ink mb-2">Tipo de campaña</label>
        <div className="grid sm:grid-cols-3 gap-2">
          {PICKER_CARDS.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => set("type", card.type)}
              className={`text-left rounded-xl border p-3 transition-colors ${
                type === card.type ? "border-brand-accent ring-2 ring-brand-accent bg-brand-accent-soft/30" : "border-brand-line hover:border-brand-accent-soft"
              }`}
            >
              <p className="font-display font-semibold text-sm text-brand-ink mb-1">{card.title}</p>
              <p className="text-xs text-brand-ink-soft leading-snug">{card.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Nombre de la campaña</label>
        <input required value={name} onChange={(e) => set("name", e.target.value)} className="input" placeholder="Campaña de verano" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Inicio</label>
          <input required type="datetime-local" value={startDate} onChange={(e) => set("startDate", e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">Fin</label>
          <input required type="datetime-local" value={endDate} onChange={(e) => set("endDate", e.target.value)} className="input" />
        </div>
      </div>

      {(type === "GOAL_BONUS" || type === "MIX") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-brand-ink mb-1">Meta de ventas por creador</label>
            <CurrencyInput value={goalAmount} onChange={(v) => set("goalAmount", v)} placeholder="2.000.000" />
          </div>
          <div>
            <label className="block text-sm text-brand-ink mb-1">Bono</label>
            <CurrencyInput value={bonusAmount} onChange={(v) => set("bonusAmount", v)} placeholder="150.000" />
          </div>
        </div>
      )}

      {needsFlashSaleLever && (
        <div className="space-y-3 rounded-xl border border-brand-line p-3">
          <p className="text-xs text-brand-ink-soft">Elige al menos una de las dos:</p>

          <div>
            <label className="flex items-center gap-2 text-sm text-brand-ink mb-1">
              <input type="checkbox" checked={commissionEnabled} onChange={(e) => set("commissionEnabled", e.target.checked)} />
              Subir la comisión del creador
            </label>
            {commissionEnabled && (
              <div className="flex items-center gap-2">
                {selectedOffer && (
                  <span className="text-xs font-mono text-brand-ink-soft shrink-0 whitespace-nowrap">
                    Actual: {selectedOffer.defaultCommissionPercent}% →
                  </span>
                )}
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  value={newCommissionPercent}
                  onChange={(e) => set("newCommissionPercent", e.target.value)}
                  placeholder="Nueva comisión (%)"
                  className="input"
                />
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-brand-ink mb-1">
              <input type="checkbox" checked={discountEnabled} onChange={(e) => set("discountEnabled", e.target.checked)} />
              Subir el descuento del comprador
            </label>
            {discountEnabled && (
              <>
                <div className="flex items-center gap-2">
                  {selectedOffer && (
                    <span className="text-xs font-mono text-brand-ink-soft shrink-0 whitespace-nowrap">
                      Actual: {selectedOffer.defaultDiscountPercent}% →
                    </span>
                  )}
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    value={newDiscountPercent}
                    onChange={(e) => set("newDiscountPercent", e.target.value)}
                    placeholder="Nuevo % de descuento"
                    className="input"
                  />
                </div>
                <p className="text-xs text-brand-ink-soft mt-1">
                  Se sube directo en tu tienda — puede tardar unos minutos en reflejarse.
                </p>
              </>
            )}
          </div>

          {flashSaleLeverMissing && <p className="text-xs text-red-600">Sube la comisión, el descuento, o ambos.</p>}
        </div>
      )}

      {summary && (
        <div className="rounded-xl border-2 border-brand-accent bg-brand-accent-soft/30 p-4">
          <p className="text-sm text-brand-ink leading-relaxed">{summary}</p>
          <label className="flex items-center gap-2 text-sm font-medium text-brand-ink mt-3">
            <input type="checkbox" checked={confirmed} onChange={(e) => set("confirmed", e.target.checked)} />
            Revisé la información y apruebo crear esta campaña
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !offerId || !summary || !confirmed}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear campaña"}
        </button>
        <button type="button" onClick={() => setForm(emptyState())} className="text-sm text-brand-ink-soft hover:underline">
          Limpiar
        </button>
      </div>
    </form>
  );
}
