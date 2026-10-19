"use client";

import { useMemo, useState, useEffect } from "react";
import { setSelectedVariantImage } from "@/components/storefront/selected-variant-store";
import { QuantityAddToCart } from "@/components/storefront/quantity-add-to-cart";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";
import { chooseOptionLabel } from "@/lib/variant-choice";

export type StorefrontVariant = {
  id: string;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null; // null = usa el precio base del producto
  imageUrl: string | null;
  /// null = sin control de inventario.
  stock: number | null;
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
}: {
  productId: string;
  productSlug: string;
  productName: string;
  basePrice: number;
  baseImageUrl: string | null;
  optionNames: string[];
  variants: StorefrontVariant[];
  /// Ya no se usa (el botón no navega) — queda en el tipo para no tocar a
  /// quien todavía lo manda.
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
  const outOfStock = matchedVariant != null && matchedVariant.stock != null && matchedVariant.stock <= 0;
  const isSoldOut = (v: StorefrontVariant) => v.stock != null && v.stock <= 0;
  // "Agotado" antes de elegir solo si no queda ninguna opción con unidades;
  // si quedan, el botón pide elegir (ver variant-choice.ts).
  const allSoldOut = variants.length > 0 && variants.every(isSoldOut);
  const singleAxis = optionNames.length === 1;

  // Un valor está agotado si todas las variantes que lo tienen (con lo ya
  // elegido en los otros ejes) están sin unidades — se marca tachado.
  function valueSoldOut(idx: number, value: string) {
    const key = (i: number) => `option${i + 1}Value` as "option1Value" | "option2Value" | "option3Value";
    const matching = variants.filter((v) => v[key(idx)] === value && optionNames.every((_, other) => other === idx || !selected[other] || v[key(other)] === selected[other]));
    return matching.length > 0 && matching.every(isSoldOut);
  }

  // La galería muestra la foto de la variante elegida (ver
  // selected-variant-store.ts y product-gallery.tsx).
  const matchedImage = matchedVariant?.imageUrl ?? null;
  useEffect(() => {
    setSelectedVariantImage(productId, matchedImage);
  }, [productId, matchedImage]);

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
                    {valueSoldOut(idx, value) ? " — agotado" : ""}
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
                const soldOut = valueSoldOut(idx, value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelected((prev) => ({ ...prev, [idx]: value }))}
                    title={soldOut ? `${value} — agotado` : value}
                    className={
                      photoUrl
                        ? `rounded-full overflow-hidden w-10 h-10 border-2 ${isSelected ? "border-brand-accent" : "border-brand-line"} ${soldOut ? "opacity-40" : ""}`
                        : `text-sm rounded-full px-4 py-1.5 border ${
                            isSelected
                              ? "bg-brand-button text-brand-button-text border-brand-button"
                              : "border-brand-line text-brand-ink hover:bg-brand-accent-soft"
                          } ${soldOut ? "line-through opacity-50" : ""}`
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
        <p className="text-sm text-brand-ink-soft">
          {singleAxis ? `No quedan unidades de ${selected[0]}.` : "No quedan unidades de esa combinación."}
        </p>
      )}

      <QuantityAddToCart
        disabled={!matchedVariant || outOfStock}
        disabledLabel={matchedVariant ? undefined : allChosen ? "No disponible" : chooseOptionLabel(optionNames, selected)}
        product={{
          id: productId,
          slug: productSlug,
          name: productName,
          price: displayPrice,
          imageUrl: matchedVariant?.imageUrl ?? baseImageUrl,
          // Sin elegir todavía no se sabe el inventario: null (no "0", que
          // el botón leía como "Agotado"), salvo que estén todas agotadas.
          stock: matchedVariant ? matchedVariant.stock : allSoldOut ? 0 : null,
          variantId: matchedVariant?.id ?? null,
          variantLabel: matchedVariant
            ? optionNames.map((n, idx) => `${n}: ${selected[idx]}`).join(" · ")
            : null,
        }}
      />
    </div>
  );
}
