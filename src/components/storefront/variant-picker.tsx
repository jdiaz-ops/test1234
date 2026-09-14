"use client";

import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";

export type StorefrontVariant = {
  id: string;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null; // null = usa el precio base del producto
  imageUrl: string | null;
  stock: number;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/// Selector de variantes (talla/color/etc.) — un grupo de chips por cada
/// eje en optionNames. Calcula la variante exacta que matchea los valores
/// elegidos (o null si la combinación no existe, ej. "Rojo" no viene en
/// talla "S") y arma el botón de agregar al carrito con su precio/stock
/// real, no el del producto base.
export function VariantPicker({
  productId,
  productSlug,
  productName,
  basePrice,
  baseImageUrl,
  optionNames,
  variants,
  basePath,
}: {
  productId: string;
  productSlug: string;
  productName: string;
  basePrice: number;
  baseImageUrl: string | null;
  optionNames: string[];
  variants: StorefrontVariant[];
  basePath?: string;
}) {
  // Arranca sin nada elegido — obliga a elegir cada eje antes de poder
  // comprar (evita asumir la primera combinación, que puede estar agotada).
  const [selected, setSelected] = useState<Record<number, string>>({});
  const { productDetail } = useStorefrontTheme();

  const valuesByOption = useMemo(() => {
    return optionNames.map((_, idx) => {
      const key = `option${idx + 1}Value` as
        | "option1Value"
        | "option2Value"
        | "option3Value";
      const seen = new Set<string>();
      const values: string[] = [];
      for (const v of variants) {
        const val = v[key];
        if (val && !seen.has(val)) {
          seen.add(val);
          values.push(val);
        }
      }
      return values;
    });
  }, [optionNames, variants]);

  // Para el toggle "mostrar la foto de la variante de color como botón" —
  // solo tiene sentido en el eje que de verdad se llama "color" (o
  // similar), usando la primera variante que tenga esa combinación de
  // valor + foto propia.
  function imageForOptionValue(idx: number, value: string): string | null {
    const key = `option${idx + 1}Value` as "option1Value" | "option2Value" | "option3Value";
    return variants.find((v) => v[key] === value && v.imageUrl)?.imageUrl ?? null;
  }

  const allChosen = optionNames.every((_, idx) => selected[idx]);
  const matchedVariant = allChosen
    ? variants.find((v) => {
        return optionNames.every((_, idx) => {
          const key = `option${idx + 1}Value` as
            | "option1Value"
            | "option2Value"
            | "option3Value";
          return v[key] === selected[idx];
        });
      })
    : undefined;

  const displayPrice = matchedVariant
    ? (matchedVariant.price ?? basePrice)
    : basePrice;
  const outOfStock = matchedVariant != null && matchedVariant.stock <= 0;

  return (
    <div className="space-y-4">
      {optionNames.map((name, idx) => {
        const isColorAxis = /color/i.test(name);
        const showPhoto = isColorAxis && productDetail.colorVariantAsPhoto;

        if (!productDetail.variantsAsButtons) {
          return (
            <div key={name}>
              <label className="text-xs font-medium text-brand-ink mb-1.5 block">{name}</label>
              <select
                value={selected[idx] ?? ""}
                onChange={(e) => setSelected((prev) => ({ ...prev, [idx]: e.target.value }))}
                className="input text-sm"
              >
                <option value="" disabled>
                  Elige {name.toLowerCase()}
                </option>
                {valuesByOption[idx].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        return (
          <div key={name}>
            <p className="text-xs font-medium text-brand-ink mb-1.5">{name}</p>
            <div className="flex flex-wrap gap-2">
              {valuesByOption[idx].map((value) => {
                const isSelected = selected[idx] === value;
                const photoUrl = showPhoto ? imageForOptionValue(idx, value) : null;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelected((prev) => ({ ...prev, [idx]: value }))}
                    title={value}
                    className={
                      photoUrl
                        ? `rounded-full overflow-hidden w-10 h-10 border-2 ${isSelected ? "border-brand-accent" : "border-brand-line"}`
                        : `text-sm rounded-full px-4 py-1.5 border ${
                            isSelected
                              ? "bg-brand-accent text-white border-brand-accent"
                              : "border-brand-line text-brand-ink hover:bg-brand-accent-soft"
                          }`
                    }
                  >
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto de la variante
                      <img src={photoUrl} alt={value} className="w-full h-full object-cover" />
                    ) : (
                      value
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="font-mono text-lg text-brand-ink">
        {formatCOP(displayPrice)}
      </p>

      {allChosen && !matchedVariant && (
        <p className="text-sm text-brand-ink-soft">
          Esa combinación no está disponible.
        </p>
      )}
      {matchedVariant && outOfStock && (
        <p className="text-sm text-brand-ink-soft">Agotado en esa combinación.</p>
      )}

      <AddToCartButton
        disabled={!matchedVariant || outOfStock}
        basePath={basePath}
        product={{
          id: productId,
          slug: productSlug,
          name: productName,
          price: displayPrice,
          imageUrl: matchedVariant?.imageUrl ?? baseImageUrl,
          stock: matchedVariant?.stock ?? 0,
          variantId: matchedVariant?.id ?? null,
          variantLabel: matchedVariant
            ? optionNames.map((n, idx) => `${n}: ${selected[idx]}`).join(" · ")
            : null,
        }}
      />
    </div>
  );
}
