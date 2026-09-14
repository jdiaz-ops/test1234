"use client";

import { useState } from "react";

/// Solo kg y g — ver conversación del 2026-09-14 ("deja solo kg y
/// gramos"), antes traía también lb/oz.
export type WeightUnit = "KG" | "G";

const UNIT_LABEL: Record<WeightUnit, string> = {
  KG: "kg",
  G: "g",
};

/// Factor para convertir DE esa unidad A kilogramos (lo que siempre se
/// guarda — ver Product.weight en el schema).
const TO_KG: Record<WeightUnit, number> = {
  KG: 1,
  G: 0.001,
};

function kgToUnit(kg: number, unit: WeightUnit): number {
  const raw = kg / TO_KG[unit];
  // Redondea a algo razonable para no mostrar arrastre de punto flotante
  // (ej. 500 g -> 0.5 kg -> de vuelta a "499.99999999999994 g").
  return Math.round(raw * 1e6) / 1e6;
}

function unitToKg(value: number, unit: WeightUnit): number {
  return Math.round(value * TO_KG[unit] * 1e6) / 1e6;
}

function cleanDecimalText(text: string) {
  const cleaned = text.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
}

/// Input de peso con selector de unidad (kg/g/lb/oz), como el de Shopify
/// — ver conversación del 2026-09-14: "permite gramos". Internamente
/// siempre trabaja en kilogramos (`valueKg`/`onChange` en kg, lo que usan
/// los cálculos de envío — ver ShippingZoneRate), la unidad es solo cómo
/// la marca prefiere escribir/leer el número.
export function WeightInput({
  valueKg,
  unit,
  onChange,
  placeholder,
  className = "",
}: {
  valueKg: number | null;
  unit: WeightUnit;
  onChange: (valueKg: number | null, unit: WeightUnit) => void;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(() =>
    valueKg == null ? "" : String(kgToUnit(valueKg, unit)),
  );

  function handleValueChange(text: string) {
    // Solo dígitos y un punto decimal — el peso no necesita el formateo
    // de miles del PriceInput.
    const cleaned = text.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    setRaw(normalized);
    const n = Number(normalized);
    onChange(normalized === "" || Number.isNaN(n) ? null : unitToKg(n, unit), unit);
  }

  // Cambiar la unidad NO convierte el número que ya está escrito — solo
  // cambia con qué unidad se interpreta (igual que el selector de peso de
  // Shopify: son dos campos independientes, no un conversor). Si
  // convirtiera automáticamente, escribir "500" con la unidad todavía en
  // "kg" (el valor por defecto) y recién después cambiar a "g" dejaría el
  // peso real en 500 kg en vez de los 500 g que la marca quiso decir.
  function handleUnitChange(nextUnit: WeightUnit) {
    const n = Number(raw);
    onChange(raw === "" || Number.isNaN(n) ? null : unitToKg(n, nextUnit), nextUnit);
  }

  return (
    <div className={`flex ${className}`}>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder={placeholder}
        className="input rounded-r-none flex-1 min-w-0"
      />
      <select
        value={unit}
        onChange={(e) => handleUnitChange(e.target.value as WeightUnit)}
        className="input rounded-l-none border-l-0 w-[4.5rem] shrink-0 px-1.5"
        aria-label="Unidad de peso"
      >
        {(Object.keys(UNIT_LABEL) as WeightUnit[]).map((u) => (
          <option key={u} value={u}>
            {UNIT_LABEL[u]}
          </option>
        ))}
      </select>
    </div>
  );
}

/// Par de campos "mínimo"/"máximo" que comparten una sola unidad (ej. la
/// regla de envío condicionada por rango de peso, ShippingZoneRate) — a
/// diferencia de dos <WeightInput> sueltos, acá cambiar la unidad
/// reinterpreta el texto de AMBOS campos a la vez (mismo criterio de
/// "reinterpreta, no convierte" que WeightInput, pero aplicado a los dos
/// números juntos, ya que solo hay una unidad guardada para el par). Ver
/// conversación del 2026-09-14.
export function WeightRangeInput({
  minKg,
  maxKg,
  unit,
  onChangeMin,
  onChangeMax,
  onChangeUnit,
}: {
  minKg: number | null;
  maxKg: number | null;
  unit: WeightUnit;
  onChangeMin: (valueKg: number | null) => void;
  onChangeMax: (valueKg: number | null) => void;
  onChangeUnit: (unit: WeightUnit, minKg: number | null, maxKg: number | null) => void;
}) {
  const [rawMin, setRawMin] = useState(() =>
    minKg == null ? "" : String(kgToUnit(minKg, unit)),
  );
  const [rawMax, setRawMax] = useState(() =>
    maxKg == null ? "" : String(kgToUnit(maxKg, unit)),
  );

  function handleMinChange(text: string) {
    const normalized = cleanDecimalText(text);
    setRawMin(normalized);
    const n = Number(normalized);
    onChangeMin(normalized === "" || Number.isNaN(n) ? null : unitToKg(n, unit));
  }

  function handleMaxChange(text: string) {
    const normalized = cleanDecimalText(text);
    setRawMax(normalized);
    const n = Number(normalized);
    onChangeMax(normalized === "" || Number.isNaN(n) ? null : unitToKg(n, unit));
  }

  function handleUnitChange(nextUnit: WeightUnit) {
    const nMin = Number(rawMin);
    const nMax = Number(rawMax);
    const nextMinKg =
      rawMin === "" || Number.isNaN(nMin) ? null : unitToKg(nMin, nextUnit);
    const nextMaxKg =
      rawMax === "" || Number.isNaN(nMax) ? null : unitToKg(nMax, nextUnit);
    onChangeUnit(nextUnit, nextMinKg, nextMaxKg);
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 min-w-0">
        <label className="block text-[11px] text-brand-ink-soft mb-0.5">
          Mínimo (opcional)
        </label>
        <input
          inputMode="decimal"
          value={rawMin}
          onChange={(e) => handleMinChange(e.target.value)}
          className="input text-sm"
        />
      </div>
      <div className="flex-1 min-w-0">
        <label className="block text-[11px] text-brand-ink-soft mb-0.5">
          Máximo (opcional)
        </label>
        <input
          inputMode="decimal"
          value={rawMax}
          onChange={(e) => handleMaxChange(e.target.value)}
          className="input text-sm"
        />
      </div>
      <select
        value={unit}
        onChange={(e) => handleUnitChange(e.target.value as WeightUnit)}
        className="input text-sm w-[4.5rem] shrink-0 px-1.5"
        aria-label="Unidad de peso"
      >
        {(Object.keys(UNIT_LABEL) as WeightUnit[]).map((u) => (
          <option key={u} value={u}>
            {UNIT_LABEL[u]}
          </option>
        ))}
      </select>
    </div>
  );
}
