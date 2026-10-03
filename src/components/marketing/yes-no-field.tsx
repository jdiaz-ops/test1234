"use client";

export type YesNo = "" | "si" | "no";

/// Pregunta Sí/No con dos botones (listas de espera de creadoras y marcas:
/// "¿Creas contenido de uñas?" / "¿Vendes productos de uñas?").
export function YesNoField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: YesNo;
  onChange: (v: "si" | "no") => void;
}) {
  return (
    <fieldset>
      <legend className="block text-sm text-brand-ink mb-1">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["si", "Sí"],
            ["no", "No"],
          ] as const
        ).map(([v, text]) => (
          <label
            key={v}
            className={`flex items-center justify-center rounded-md border py-2 text-sm cursor-pointer transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-accent ${
              value === v
                ? "border-brand-accent bg-brand-accent text-white font-medium"
                : "border-brand-line bg-brand-surface text-brand-ink hover:border-brand-accent"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
