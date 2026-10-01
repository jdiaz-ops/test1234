"use client";

import { useState } from "react";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";

/// Datos de envío de una muestra — lo que pide una transportadora. Mismos
/// nombres que shippingAddressSchema (lib/validation/creator.ts), así se
/// mandan tal cual a la API.
export type SampleShipping = {
  shippingName: string;
  shippingDocument: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingRegion: string;
  shippingCity: string;
  shippingAddress: string;
  shippingNotes: string;
};

export function isShippingComplete(s: SampleShipping) {
  return Boolean(
    s.shippingName &&
      s.shippingDocument &&
      s.shippingEmail &&
      s.shippingPhone &&
      s.shippingRegion &&
      s.shippingCity &&
      s.shippingAddress,
  );
}

/// Si el creador ya tiene una dirección guardada, se muestra resumida con
/// "Cambiar" — no tiene que llenarla de nuevo cada vez (2026-10-01). Si
/// falta algo, salen los campos de una.
export function SampleShippingFields({
  value,
  onChange,
}: {
  value: SampleShipping;
  onChange: (next: SampleShipping) => void;
}) {
  const [editing, setEditing] = useState(() => !isShippingComplete(value));
  const set = (key: keyof SampleShipping) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => onChange({ ...value, [key]: e.target.value });

  if (!editing) {
    return (
      <div className="rounded-xl border border-brand-line bg-brand-surface p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-brand-ink-soft">Enviar a</p>
            <p className="font-medium text-brand-ink">
              {value.shippingName} · CC {value.shippingDocument}
            </p>
            <p className="text-brand-ink-soft">
              {value.shippingAddress}, {value.shippingCity}, {value.shippingRegion}
            </p>
            <p className="text-brand-ink-soft">
              {value.shippingPhone} · {value.shippingEmail}
            </p>
            {value.shippingNotes && (
              <p className="text-brand-ink-soft text-xs">{value.shippingNotes}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-brand-accent font-medium hover:underline shrink-0"
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  const field = (
    key: keyof SampleShipping,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label className="block text-xs text-brand-ink mb-1">{label}</label>
      <input
        required={key !== "shippingNotes"}
        value={value[key]}
        onChange={set(key)}
        className="input text-sm"
        {...props}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {field("shippingName", "Nombre completo", { autoComplete: "name" })}
        {field("shippingDocument", "Cédula", { inputMode: "numeric" })}
        {field("shippingEmail", "Correo", { type: "email", autoComplete: "email" })}
        {field("shippingPhone", "Teléfono", { type: "tel", autoComplete: "tel" })}
        <div>
          <label className="block text-xs text-brand-ink mb-1">Departamento</label>
          <select
            required
            value={value.shippingRegion}
            onChange={set("shippingRegion")}
            className="input text-sm"
          >
            <option value="">Elige…</option>
            {COLOMBIA_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {field("shippingCity", "Ciudad", { autoComplete: "address-level2" })}
      </div>
      {field("shippingAddress", "Dirección de envío", {
        autoComplete: "street-address",
        placeholder: "Ej. Calle 83 # 1-23, apto 402",
      })}
      {field("shippingNotes", "Notas de envío (opcional)", {
        placeholder: "Ej. portería, horario para recibir…",
      })}
      <p className="text-xs text-brand-ink-soft">
        La guardamos para tus próximas muestras; puedes cambiarla cuando quieras.
      </p>
    </div>
  );
}
