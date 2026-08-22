"use client";

function formatThousands(digits: string) {
  if (!digits) return "";
  return new Intl.NumberFormat("es-CO").format(Number(digits));
}

/// Input de montos en pesos — se ve con separador de miles mientras se
/// escribe (ej. "2.000.000"), aunque por dentro el valor que se guarda y se
/// manda al servidor sigue siendo un número plano ("2000000"). Un
/// input type="number" normal no permite mostrar separadores — por eso este
/// es type="text" con su propio filtro de solo-dígitos.
export function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-soft text-sm pointer-events-none">
        $
      </span>
      <input
        type="text"
        inputMode="numeric"
        required
        value={formatThousands(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        className="input pl-7 font-mono"
      />
    </div>
  );
}
