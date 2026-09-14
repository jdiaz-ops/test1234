"use client";

import { useState } from "react";

/// Input de precio en pesos colombianos — un <input type="number"> normal
/// interpreta "." como separador DECIMAL (estándar del navegador), pero en
/// Colombia "." es el separador de MILES y "," es el decimal. Si la marca
/// escribe "10.000" queriendo decir diez mil, un input nativo lo entiende
/// como 10 (le recorta el ".000"). Este componente formatea en vivo al
/// estilo colombiano y entrega un número limpio por onChange. Ver
/// conversación del 2026-09-14: "coloqué el precio de diez mil y no hay
/// las decimales".
///
/// Guarda el string "crudo" (solo dígitos + una coma) en estado local, no
/// derivado del `value` numérico en cada render — si no, escribir "10,"
/// colapsaría de inmediato a "10" (Number("10,") = 10 no distingue "en
/// proceso de escribir el decimal" de "sin decimal"), y sería imposible
/// terminar de escribir la parte decimal.

/// Deja pasar solo dígitos y, como máximo, UNA coma (el decimal).
function keepDigitsAndComma(raw: string) {
  let out = "";
  let sawComma = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "," && !sawComma) {
      out += ch;
      sawComma = true;
    }
  }
  return out;
}

/// "10000,5" -> "10.000,5" — solo se agrupa la parte entera.
function toDisplay(digitsAndComma: string) {
  const [intPart, decPart] = digitsAndComma.split(",");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart !== undefined ? `${grouped},${decPart.slice(0, 2)}` : grouped;
}

function toNumber(digitsAndComma: string): number | null {
  if (digitsAndComma === "" || digitsAndComma === ",") return null;
  const n = Number(digitsAndComma.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function initialRaw(value: number | null): string {
  if (value == null) return "";
  return String(value).replace(".", ",");
}

export function PriceInput({
  id,
  value,
  onChange,
  required,
  placeholder = "0",
  className = "",
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(() => initialRaw(value));

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink-soft">
        $
      </span>
      <input
        id={id}
        required={required}
        inputMode="decimal"
        value={toDisplay(raw)}
        onChange={(e) => {
          const cleaned = keepDigitsAndComma(e.target.value);
          setRaw(cleaned);
          onChange(toNumber(cleaned));
        }}
        placeholder={placeholder}
        className="input pl-7"
      />
    </div>
  );
}
