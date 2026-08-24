"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VISIBLE_CHALLENGE_TYPES, type ChallengeType, type ChallengeTemplate } from "@/lib/challenge-types";
import { CurrencyInput } from "@/components/portal/currency-input";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

const typeLabel: Record<ChallengeType, string> = {
  GOAL_BONUS: "Bono por ventas generadas",
  TEMP_COMMISSION_BOOST: "Comisión temporal elevada (para todos los creadores)",
  TEMP_DISCOUNT_BOOST: "Descuento especial temporal (para el comprador)",
  LEADERBOARD: "Leaderboard con premio al Top N",
  WELCOME_BONUS: "Bono de bienvenida (primeros N cupos)",
  CONTENT_CHALLENGE: "Campaña de contenido (revisión manual)",
};

const typeHint: Record<ChallengeType, string> = {
  GOAL_BONUS:
    "Cada creador que llegue a la meta gana el bono — no solo el primero, todos los que la alcancen. Es un pago adicional, aparte de su comisión normal por esas ventas.",
  TEMP_COMMISSION_BOOST:
    "Sube la comisión para TODOS los creadores vinculados a esta oferta durante el período, sin excepción — reemplaza la comisión normal de cada uno mientras dure, sin importar lo que tengan configurado individualmente.",
  TEMP_DISCOUNT_BOOST:
    "Sube el % de descuento que recibe el COMPRADOR en el checkout real, con el código de cada creador vinculado a esta oferta — no cambia lo que gana el creador, solo lo que paga quien compra. Se actualiza directo en tu tienda y vuelve sola al valor normal cuando termine el período.",
  LEADERBOARD: "Al terminar el período, los N creadores con más ventas se llevan el premio correspondiente a su puesto.",
  WELCOME_BONUS: "Los primeros N creadores que se unan a la oferta durante el período ganan el bono, sin esperar ventas.",
  CONTENT_CHALLENGE: "El creador manda un link como evidencia; tú lo revisas y decides si aprobar el bono.",
};

export function ChallengeForm({
  offers,
  template,
  onDone,
}: {
  offers: { id: string; name: string }[];
  template?: ChallengeTemplate;
  onDone: () => void;
}) {
  const router = useRouter();
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const [name, setName] = useState(template?.name ?? "");
  const [type, setType] = useState<ChallengeType>(template?.type ?? "GOAL_BONUS");
  const [startDate, setStartDate] = useState(template?.startDate ?? (template ? toDateInput(new Date()) : ""));
  const [endDate, setEndDate] = useState(
    template?.endDate ??
      (template
        ? toDateInput(new Date(Date.now() + (template.durationDays ?? 7) * 24 * 60 * 60 * 1000))
        : "")
  );
  const [goalAmount, setGoalAmount] = useState(template?.goalAmount ? String(template.goalAmount) : "");
  const [bonusAmount, setBonusAmount] = useState(template?.bonusAmount ? String(template.bonusAmount) : "");
  const [newCommissionPercent, setNewCommissionPercent] = useState(
    template?.newCommissionPercent ? String(template.newCommissionPercent) : ""
  );
  const [newDiscountPercent, setNewDiscountPercent] = useState(
    template?.newDiscountPercent ? String(template.newDiscountPercent) : ""
  );
  const [winnersCount, setWinnersCount] = useState("3");
  const [prizes, setPrizes] = useState("");
  const [slotsCount, setSlotsCount] = useState("");
  const [bonusPerSlot, setBonusPerSlot] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildConfig(): Record<string, unknown> {
    switch (type) {
      case "GOAL_BONUS":
        return { type, goalAmount: Number(goalAmount), bonusAmount: Number(bonusAmount) };
      case "TEMP_COMMISSION_BOOST":
        return { type, newCommissionPercent: Number(newCommissionPercent) };
      case "TEMP_DISCOUNT_BOOST":
        return { type, newDiscountPercent: Number(newDiscountPercent) };
      case "LEADERBOARD":
        return {
          type,
          winnersCount: Number(winnersCount),
          prizes: prizes.split(",").map((p) => Number(p.trim())).filter((n) => !Number.isNaN(n)),
        };
      case "WELCOME_BONUS":
        return { type, slotsCount: Number(slotsCount), bonusPerSlot: Number(bonusPerSlot) };
      case "CONTENT_CHALLENGE":
        return { type, instructions, bonusAmount: Number(bonusAmount) };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/marca/retos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, name, startDate, endDate, config: buildConfig() }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo crear la campaña.");
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Oferta</label>
        <select value={offerId} onChange={(e) => setOfferId(e.target.value)} className="input">
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Nombre de la campaña</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Campaña de verano" />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Tipo de campaña</label>
        <select value={type} onChange={(e) => setType(e.target.value as ChallengeType)} className="input">
          {VISIBLE_CHALLENGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel[t]}
            </option>
          ))}
        </select>
        <p className="text-xs text-brand-ink-soft mt-1">{typeHint[type]}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Inicio</label>
          <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">Fin</label>
          <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
      </div>

      {type === "GOAL_BONUS" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-brand-ink mb-1">Meta de ventas por creador</label>
            <CurrencyInput value={goalAmount} onChange={setGoalAmount} placeholder="2.000.000" />
          </div>
          <div>
            <label className="block text-sm text-brand-ink mb-1">Bono</label>
            <CurrencyInput value={bonusAmount} onChange={setBonusAmount} placeholder="150.000" />
          </div>
        </div>
      )}

      {type === "TEMP_COMMISSION_BOOST" && (
        <div>
          <label className="block text-sm text-brand-ink mb-1">Nueva comisión (%)</label>
          <input
            required
            type="number"
            min="0"
            max="100"
            value={newCommissionPercent}
            onChange={(e) => setNewCommissionPercent(e.target.value)}
            className="input"
          />
        </div>
      )}

      {type === "TEMP_DISCOUNT_BOOST" && (
        <div>
          <label className="block text-sm text-brand-ink mb-1">Nuevo % de descuento para el comprador</label>
          <input
            required
            type="number"
            min="0"
            max="100"
            value={newDiscountPercent}
            onChange={(e) => setNewDiscountPercent(e.target.value)}
            className="input"
          />
          <p className="text-xs text-brand-ink-soft mt-1">
            Se sube directo en tu tienda — puede tardar unos minutos en reflejarse.
          </p>
        </div>
      )}

      {type === "LEADERBOARD" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-brand-ink mb-1">N° de ganadores</label>
            <input required type="number" min="1" max="20" value={winnersCount} onChange={(e) => setWinnersCount(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm text-brand-ink mb-1">Premios (COP, separados por coma)</label>
            <input required value={prizes} onChange={(e) => setPrizes(e.target.value)} placeholder="300000, 150000, 50000" className="input" />
          </div>
        </div>
      )}

      {type === "WELCOME_BONUS" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-brand-ink mb-1">Cupos disponibles</label>
            <input required type="number" min="1" value={slotsCount} onChange={(e) => setSlotsCount(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm text-brand-ink mb-1">Bono por cupo</label>
            <CurrencyInput value={bonusPerSlot} onChange={setBonusPerSlot} placeholder="50.000" />
          </div>
        </div>
      )}

      {type === "CONTENT_CHALLENGE" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-brand-ink mb-1">Instrucciones para el creador</label>
            <textarea
              required
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="input"
              rows={3}
              placeholder="Publica un reel usando tu código y mándanos el link"
            />
          </div>
          <div>
            <label className="block text-sm text-brand-ink mb-1">Bono</label>
            <CurrencyInput value={bonusAmount} onChange={setBonusAmount} placeholder="150.000" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !offerId}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear campaña"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
