"use client";

import { useState } from "react";
import { PriceInput } from "@/components/portal/price-input";
import { WeightInput, type WeightUnit } from "@/components/portal/weight-input";

export type VariantOptionInput = { name: string; values: string[] };
export type VariantRowInput = {
  /// Id real si ya existía (editando un producto) — nuevo = undefined,
  /// el servicio lo crea. Nunca se usa para nada más que preservar cuál
  /// fila es cuál al regenerar la tabla.
  key: string;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null;
  sku: string;
  barcode: string;
  stock: number;
  /// null = usa el peso del producto — mismo criterio que price. Siempre
  /// en kilogramos — weightUnit es solo cómo se escribe/muestra.
  weight: number | null;
  weightUnit: WeightUnit;
  imageUrl: string | null;
};

function combinationKey(values: (string | null)[]) {
  return values.join("␟");
}

/// Todas las combinaciones (producto cartesiano) de los valores de cada
/// opción, en el mismo orden — mismo modelo clásico que usa Shopify (hasta
/// 3 ejes). Si una opción no tiene valores todavía, no genera nada (mejor
/// una tabla vacía que combinaciones con "undefined").
function buildCombinations(options: VariantOptionInput[]): (string | null)[][] {
  const valueLists = options.map((o) => o.values).filter((v) => v.length > 0);
  if (valueLists.length === 0) return [];
  let combos: (string | null)[][] = [[]];
  for (const values of valueLists) {
    const next: (string | null)[][] = [];
    for (const combo of combos) {
      for (const value of values) next.push([...combo, value]);
    }
    combos = next;
  }
  // Rellena a 3 ejes con null para que option1/2/3Value siempre calcen.
  return combos.map((c) => [...c, ...Array(3 - c.length).fill(null)]);
}

export function ProductVariantsEditor({
  optionNames,
  onOptionNamesChange,
  variants,
  onVariantsChange,
}: {
  optionNames: string[];
  onOptionNamesChange: (names: string[]) => void;
  variants: VariantRowInput[];
  onVariantsChange: (variants: VariantRowInput[]) => void;
}) {
  // Estado local de edición de opciones (nombre + valores en construcción)
  // — se sincroniza a optionNames/variants recién cuando cambia algo real,
  // no en cada tecla del input de "nuevo valor".
  const [options, setOptions] = useState<VariantOptionInput[]>(() =>
    optionNames.map((name) => {
      const values = new Set<string>();
      for (const v of variants) {
        const idx = optionNames.indexOf(name);
        const val = [v.option1Value, v.option2Value, v.option3Value][idx];
        if (val) values.add(val);
      }
      return { name, values: Array.from(values) };
    }),
  );
  const [draftValue, setDraftValue] = useState<Record<number, string>>({});

  function regenerate(nextOptions: VariantOptionInput[]) {
    setOptions(nextOptions);
    onOptionNamesChange(nextOptions.map((o) => o.name));
    const combos = buildCombinations(nextOptions);
    const existingByKey = new Map(
      variants.map((v) => [
        combinationKey([v.option1Value, v.option2Value, v.option3Value]),
        v,
      ]),
    );
    onVariantsChange(
      combos.map((combo) => {
        const key = combinationKey(combo);
        const existing = existingByKey.get(key);
        return (
          existing ?? {
            key: `new-${key}-${Math.random().toString(36).slice(2)}`,
            option1Value: combo[0],
            option2Value: combo[1],
            option3Value: combo[2],
            price: null,
            sku: "",
            barcode: "",
            stock: 0,
            weight: null,
            weightUnit: "KG",
            imageUrl: null,
          }
        );
      }),
    );
  }

  function addOption() {
    if (options.length >= 3) return;
    regenerate([...options, { name: "", values: [] }]);
  }

  function removeOption(idx: number) {
    regenerate(options.filter((_, i) => i !== idx));
  }

  function renameOption(idx: number, name: string) {
    const next = options.map((o, i) => (i === idx ? { ...o, name } : o));
    setOptions(next);
    onOptionNamesChange(next.map((o) => o.name));
    // No regenera la tabla acá — cambiar el NOMBRE de la opción no cambia
    // qué combinaciones existen, solo cómo se llaman.
  }

  function addValue(idx: number) {
    const value = (draftValue[idx] ?? "").trim();
    if (!value) return;
    if (options[idx].values.includes(value)) {
      setDraftValue((prev) => ({ ...prev, [idx]: "" }));
      return;
    }
    regenerate(
      options.map((o, i) => (i === idx ? { ...o, values: [...o.values, value] } : o)),
    );
    setDraftValue((prev) => ({ ...prev, [idx]: "" }));
  }

  function removeValue(idx: number, value: string) {
    regenerate(
      options.map((o, i) =>
        i === idx ? { ...o, values: o.values.filter((v) => v !== value) } : o,
      ),
    );
  }

  function updateVariant(key: string, patch: Partial<VariantRowInput>) {
    onVariantsChange(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  return (
    <div className="space-y-4">
      {options.map((option, idx) => (
        <div key={idx} className="rounded-xl border border-brand-line p-4">
          <div className="flex items-start gap-3">
            <span className="text-brand-ink-soft text-xs mt-2.5 cursor-default select-none">
              ⠿
            </span>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs text-brand-ink mb-1">
                  Nombre de la opción
                </label>
                <input
                  value={option.name}
                  onChange={(e) => renameOption(idx, e.target.value)}
                  placeholder="Ej. Talla"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-ink mb-1">
                  Valores de opción
                </label>
                {option.values.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {option.values.map((value) => (
                      <span
                        key={value}
                        className="inline-flex items-center gap-1.5 text-xs bg-brand-bg border border-brand-line rounded-full pl-3 pr-1.5 py-1"
                      >
                        {value}
                        <button
                          type="button"
                          onClick={() => removeValue(idx, value)}
                          className="w-4 h-4 rounded-full hover:bg-brand-line flex items-center justify-center"
                          aria-label={`Quitar ${value}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={draftValue[idx] ?? ""}
                    onChange={(e) =>
                      setDraftValue((prev) => ({ ...prev, [idx]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addValue(idx);
                      }
                    }}
                    placeholder="Agregar otro valor"
                    className="input text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => addValue(idx)}
                    className="text-xs border border-brand-line rounded-full px-3 py-2 hover:bg-brand-accent-soft shrink-0"
                  >
                    Agregar
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="text-xs text-red-600 hover:underline"
              >
                Eliminar opción
              </button>
            </div>
          </div>
        </div>
      ))}

      {options.length < 3 && (
        <button
          type="button"
          onClick={addOption}
          className="text-sm text-brand-accent font-medium hover:underline"
        >
          + Agregar otra opción
        </button>
      )}

      {variants.length > 0 && (
        <div className="rounded-xl border border-brand-line overflow-hidden">
          <div className="divide-y divide-brand-line">
            {variants.map((v) => {
              const label = [v.option1Value, v.option2Value, v.option3Value]
                .filter(Boolean)
                .join(" / ");
              return (
                <div key={v.key} className="p-3 space-y-2">
                  <p className="text-sm font-medium text-brand-ink">{label}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[11px] text-brand-ink-soft mb-0.5">
                        Precio (vacío = precio base)
                      </label>
                      <PriceInput
                        value={v.price}
                        onChange={(price) => updateVariant(v.key, { price })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-brand-ink-soft mb-0.5">
                        Inventario
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={v.stock}
                        onChange={(e) =>
                          updateVariant(v.key, {
                            stock: Number(e.target.value) || 0,
                          })
                        }
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-brand-ink-soft mb-0.5">
                        SKU
                      </label>
                      <input
                        value={v.sku}
                        onChange={(e) => updateVariant(v.key, { sku: e.target.value })}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-brand-ink-soft mb-0.5">
                        Código de barras (EAN)
                      </label>
                      <input
                        value={v.barcode}
                        onChange={(e) =>
                          updateVariant(v.key, { barcode: e.target.value })
                        }
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-brand-ink-soft mb-0.5">
                        Peso
                      </label>
                      <WeightInput
                        valueKg={v.weight}
                        unit={v.weightUnit}
                        onChange={(weight, weightUnit) =>
                          updateVariant(v.key, { weight, weightUnit })
                        }
                        placeholder="Usa el del producto"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
