import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  buildFacets,
  detectSize,
  facetKey,
  priceBuckets,
} from "@/lib/collection-filters";
import { COLOR_FAMILY_ATTRIBUTE, COLOR_FAMILY_FACET, compareColorFamilies, withColorFamily } from "@/lib/color-families";

const gel = (id: string, grupo: string, tono: string, price = 15900, stock: number | null = 5) => ({
  id,
  name: `Gel Polish ${grupo} – ${tono}`,
  price,
  stock,
  attributes: { Grupo: grupo, Tono: tono },
});

describe("filtros de colección", () => {
  it("lee el tamaño del nombre", () => {
    expect(detectSize("Gel Polish Rosados 15 ml")).toBe("15 ml");
    expect(detectSize("Crema de manos 250g")).toBe("250 g");
    expect(detectSize("Kit x 12 unidades")).toBe("12 unidades");
    expect(detectSize("Lima 180")).toBeNull();
    expect(detectSize("Aceite 0,5 oz")).toBe("0,5 oz");
  });

  it("arma las facetas con los atributos, los ejes de las variantes y el precio", () => {
    const products = [
      gel("1", "Rosados", "Princesa"),
      gel("2", "Rosados", "Loca", 18900),
      gel("3", "Verdes", "Acida", 15900, 0),
      {
        id: "4",
        name: "Top Coat 10 ml",
        price: 22000,
        stock: null,
        hasVariants: true,
        optionNames: ["Title"],
        variants: [
          { option1Value: "Brillante", option2Value: null, option3Value: null, price: null, stock: 3 },
          { option1Value: "Mate", option2Value: null, option3Value: null, price: 24000, stock: 0 },
        ],
      },
    ];
    const { facets, priceBuckets: buckets } = buildFacets(products);
    const byLabel = Object.fromEntries(facets.map((f) => [f.label, f.values]));
    expect(byLabel.Grupo).toEqual([
      { value: "Rosados", count: 2 },
      { value: "Verdes", count: 1 },
    ]);
    expect(byLabel.Tono.map((v) => v.value)).toEqual(["Acida", "Loca", "Princesa"]);
    // El eje "Title" de Shopify se muestra como "Opción".
    expect(byLabel["Opción"].map((v) => v.value)).toEqual(["Brillante", "Mate"]);
    // Con un solo producto con tamaño no hay faceta de tamaño.
    expect(byLabel["Tamaño"]).toBeUndefined();
    // Las facetas cortas van primero.
    expect(facets.map((f) => f.label)).toEqual(["Grupo", "Opción", "Tono"]);
    expect(buckets.length).toBeGreaterThan(1);
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(4);
  });

  it("filtra por valores (O dentro de una faceta, Y entre facetas), precio, disponibilidad y texto", () => {
    const products = [
      gel("1", "Rosados", "Princesa", 15900),
      gel("2", "Rosados", "Loca", 18900),
      gel("3", "Verdes", "Acida", 25900, 0),
      gel("4", "Verdes", "Fresca", 25900),
    ];
    const { priceBuckets: buckets } = buildFacets(products);
    const ids = (state: Partial<typeof EMPTY_FILTERS>) => applyFilters(products, { ...EMPTY_FILTERS, ...state }, buckets).map((p) => p.id);

    expect(ids({ values: { [facetKey("Grupo")]: ["Verdes"] } })).toEqual(["3", "4"]);
    expect(ids({ values: { [facetKey("Grupo")]: ["Verdes", "Rosados"] } })).toEqual(["1", "2", "3", "4"]);
    expect(ids({ values: { [facetKey("Grupo")]: ["Verdes"], [facetKey("Tono")]: ["Fresca"] } })).toEqual(["4"]);
    expect(ids({ onlyAvailable: true })).toEqual(["1", "2", "4"]);
    expect(ids({ text: "princesa" })).toEqual(["1"]);
    expect(ids({ text: "ácida" })).toEqual(["3"]);
    expect(ids({ text: "rosados loca" })).toEqual(["2"]);
    const cheap = buckets.find((b) => b.min === 0)!;
    expect(ids({ price: [cheap.key] }).every((id) => ["1", "2"].includes(id))).toBe(true);
    expect(ids({ sort: "price-desc" })).toEqual(["3", "4", "2", "1"]);
    expect(ids({ sort: "name" })).toEqual(["2", "1", "3", "4"]);
    expect(activeFilterCount({ ...EMPTY_FILTERS, text: "x", onlyAvailable: true, price: ["p0"], values: { grupo: ["A", "B"] } })).toBe(5);
  });

  it("no inventa rangos de precio cuando todos cuestan igual", () => {
    expect(priceBuckets([15900, 15900, 15900])).toEqual([]);
    expect(priceBuckets([15900, 16200])).toEqual([]);
    const buckets = priceBuckets([9000, 15900, 18900, 25900, 32000, 48000, 120000]);
    expect(buckets[0].label).toMatch(/^Hasta \$/);
    expect(buckets[buckets.length - 1].label).toMatch(/^Más de \$/);
    expect(buckets[buckets.length - 1].max).toBeNull();
  });

  it("la familia de color va primero y en el orden de la paleta", () => {
    expect(facetKey(COLOR_FAMILY_ATTRIBUTE)).toBe(COLOR_FAMILY_FACET);
    const products = [
      { ...gel("1", "Builder", "Clear"), attributes: { Tono: "Clear", [COLOR_FAMILY_ATTRIBUTE]: "Transparentes" } },
      { ...gel("2", "Builder", "Pink"), attributes: { Tono: "Pink", [COLOR_FAMILY_ATTRIBUTE]: "Rosados" } },
      { ...gel("3", "Builder", "Hot pink"), attributes: { Tono: "Hot pink", [COLOR_FAMILY_ATTRIBUTE]: "Rosados" } },
      { ...gel("4", "Builder", "Beige"), attributes: { Tono: "Beige", [COLOR_FAMILY_ATTRIBUTE]: "Nudes" } },
    ];
    const { facets } = buildFacets(products);
    expect(facets[0]).toEqual({
      key: COLOR_FAMILY_FACET,
      label: COLOR_FAMILY_ATTRIBUTE,
      values: [
        { value: "Nudes", count: 1 },
        { value: "Rosados", count: 2 },
        { value: "Transparentes", count: 1 },
      ],
    });
    expect(["Mi color", "Verdes", "Nudes"].sort(compareColorFamilies)).toEqual(["Nudes", "Verdes", "Mi color"]);
    expect(withColorFamily({ Grupo: "X", [COLOR_FAMILY_ATTRIBUTE]: "Rojos" }, null)).toEqual({ Grupo: "X" });
  });
});
