"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/storefront/cart-context";
import type { CardProduct, CardVariant } from "@/components/storefront/product-card";
import { ProductPrice } from "@/components/storefront/product-card";

function labelFor(product: CardProduct, variant: CardVariant) {
  const names = product.optionNames ?? [];
  return names
    .map((n, idx) => {
      const value = [variant.option1Value, variant.option2Value, variant.option3Value][idx];
      return value ? `${n}: ${value}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}

/// La tarjeta de un producto con variantes: en vez de agregar a ciegas
/// (antes "Agregar al carrito" metía el producto sin tono, como si una
/// placa de 12 esmaltes fuera uno solo), muestra las opciones ahí mismo —
/// cuadritos con la foto de cada tono cuando la tiene, o chips con el
/// nombre — y agrega al carrito la variante elegida con su precio, foto e
/// inventario. Con dos o tres ejes (talla y color) usa selectores. Ver
/// conversación del 2026-10-18 (Beauty Solution, "Gel Polish Rosados").
export function CardVariantPicker({
  product,
  basePath,
  buttonClassName,
}: {
  product: CardProduct;
  basePath: string;
  buttonClassName: string;
}) {
  const { addItem } = useCart();
  const optionNames = product.optionNames ?? [];
  const variants = product.variants ?? [];
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valueOf = (v: CardVariant, idx: number) => [v.option1Value, v.option2Value, v.option3Value][idx] ?? null;
  const allChosen = optionNames.every((_, idx) => selected[idx]);
  const matched = allChosen ? variants.find((v) => optionNames.every((_, idx) => valueOf(v, idx) === selected[idx])) : undefined;
  const price = matched?.price ?? product.price;
  const soldOut = matched != null && matched.stock != null && matched.stock <= 0;
  const href = `${basePath}/${product.slug}`;

  function add() {
    if (!matched || soldOut) return;
    const result = addItem({
      productId: product.id,
      variantId: matched.id,
      variantLabel: labelFor(product, matched),
      slug: product.slug ?? "",
      name: product.name,
      price,
      imageUrl: matched.imageUrl ?? product.imageUrl,
      stock: matched.stock,
      type: product.type,
    });
    if (!result.ok) {
      setError(result.error);
      setTimeout(() => setError(null), 3000);
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const singleAxis = optionNames.length === 1;

  return (
    <div className="flex flex-col gap-1.5">
      <ProductPrice price={price} compareAtPrice={product.compareAtPrice} from={!matched && product.priceFrom} className="text-lg" />
      {singleAxis ? (
        <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-1" role="radiogroup" aria-label={optionNames[0]}>
          {variants.map((v) => {
            const value = valueOf(v, 0);
            if (!value) return null;
            const isSelected = selected[0] === value;
            const out = v.stock != null && v.stock <= 0;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                title={out ? `${value} — agotado` : value}
                onClick={() => setSelected({ 0: value })}
                className={
                  v.imageUrl
                    ? `relative h-9 w-9 shrink-0 overflow-hidden rounded-md border-2 ${isSelected ? "border-brand-ink" : "border-brand-line"} ${out ? "opacity-40" : ""}`
                    : `shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                        isSelected ? "bg-brand-button text-brand-button-text border-brand-button" : "border-brand-line text-brand-ink hover:bg-brand-accent-soft"
                      } ${out ? "line-through opacity-50" : ""}`
                }
              >
                {v.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto de la variante
                  <img src={v.imageUrl} alt={value} className="h-full w-full object-cover" />
                ) : (
                  value
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {optionNames.map((name, idx) => {
            const values = Array.from(new Set(variants.map((v) => valueOf(v, idx)).filter((x): x is string => Boolean(x))));
            return (
              <select
                key={name}
                value={selected[idx] ?? ""}
                onChange={(e) => setSelected((prev) => ({ ...prev, [idx]: e.target.value }))}
                aria-label={name}
                className="w-full rounded-md border border-brand-line bg-brand-surface px-2 py-1.5 text-xs text-brand-ink"
              >
                <option value="" disabled>
                  {name}
                </option>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            );
          })}
        </div>
      )}
      {selected[0] && singleAxis && (
        <p className="text-[11px] text-brand-ink-soft truncate">
          {optionNames[0]}: <span className="text-brand-ink">{selected[0]}</span>
          {soldOut ? " — agotado" : ""}
        </p>
      )}
      <div className="mt-auto pt-1">
        {matched ? (
          <button type="button" onClick={add} disabled={soldOut} className={buttonClassName}>
            {soldOut ? "Agotado" : added ? "Agregado ✓" : "Agregar al carrito"}
          </button>
        ) : allChosen ? (
          <p className="text-xs text-brand-ink-soft py-2">Esa combinación no está disponible.</p>
        ) : (
          <Link href={href} className={`${buttonClassName} block text-center`}>
            Elige {singleAxis ? (optionNames[0] ?? "tu opción").toLowerCase() : "tus opciones"}
          </Link>
        )}
        {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
