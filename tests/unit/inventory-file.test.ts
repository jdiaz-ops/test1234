import { describe, expect, it } from "vitest";
import { inventoryFileAllowed } from "@/lib/features";
import {
  InventoryFileError,
  matchInventoryRow,
  normalizeName,
  parseAmount,
  parseInventoryCsv,
  type InventoryProduct,
} from "@/lib/inventory-file";

// Como el inventario de H la Cosedora: primera columna vacía, nombres con
// espacios al final y uno con coma (entre comillas).
const COSEDORA_CSV = `,Producto,Unidades,Precio unitario en oferta
,Cartagena ,200,2000
,Matificador ,197,2000
,Los Angeles ,47,2000
,Limas medianas ,49,10000
,"Quiubo, mor! ",23,3000
`;

describe("archivo de inventario", () => {
  it("lee el inventario de H la Cosedora", () => {
    const rows = parseInventoryCsv(COSEDORA_CSV);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ line: 2, name: "Cartagena", units: 200, promoPrice: 2000 });
    expect(rows[3]).toMatchObject({ name: "Limas medianas", units: 49, promoPrice: 10000 });
    expect(rows[4]).toEqual({ line: 6, name: "Quiubo, mor!", units: 23, promoPrice: 3000 });
  });

  it("lee Excel en español guardado como CSV: punto y coma, pesos con puntos de miles", () => {
    const rows = parseInventoryCsv("INVENTARIO\n\nNombre;Inventario;Precio de oferta\nChicago;1.000;$ 2.000\nRoma;;\n");
    expect(rows).toEqual([
      { line: 4, name: "Chicago", units: 1000, promoPrice: 2000 },
      { line: 5, name: "Roma", units: null, promoPrice: null },
    ]);
  });

  it("dice qué falta si no encuentra los títulos", () => {
    expect(() => parseInventoryCsv("a,b\n1,2\n")).toThrow(InventoryFileError);
  });

  it("entiende los precios como los escriben en Colombia", () => {
    expect(parseAmount("2000")).toBe(2000);
    expect(parseAmount("$2.000")).toBe(2000);
    expect(parseAmount("1.000.000")).toBe(1000000);
    expect(parseAmount("2.000,50")).toBe(2000.5);
    expect(parseAmount("2,000.50")).toBe(2000.5);
    expect(parseAmount("2,5")).toBe(2.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("agotado")).toBeNull();
  });

  it("compara nombres sin tildes, mayúsculas ni signos", () => {
    expect(normalizeName("Quiubo, mor! ")).toBe("quiubo mor");
    expect(normalizeName("Moscú")).toBe("moscu");
  });

  it("encuentra el producto de cada fila, o dice por qué no", () => {
    const products: InventoryProduct[] = [
      { id: "chicago", name: "Esmalte Tradicional Chicago", sku: null, variantValues: [] },
      { id: "roma", name: "Esmalte Tradicional Roma", sku: null, variantValues: [] },
      { id: "gel-roma", name: "Esmalte Gel Roma", sku: null, variantValues: [] },
      { id: "aroma", name: "Kit Aroma", sku: null, variantValues: [] },
      { id: "mate", name: "Matificador", sku: null, variantValues: [] },
      { id: "top-mate", name: "Top Matificador", sku: null, variantValues: [] },
      { id: "kit", name: "Kit Stamping", sku: "KS-1", variantValues: ["Dorado stamping"] },
    ];
    expect(matchInventoryRow("Chicago", products)).toEqual({ kind: "product", productId: "chicago" });
    // "Aroma" no cuenta: tiene que ser la palabra completa.
    expect(matchInventoryRow("Roma", products)).toEqual({ kind: "ambiguous", productIds: ["roma", "gel-roma"] });
    // El nombre igual gana sobre los que lo contienen.
    expect(matchInventoryRow("Matificador ", products)).toEqual({ kind: "product", productId: "mate" });
    expect(matchInventoryRow("ks-1", products)).toEqual({ kind: "product", productId: "kit" });
    expect(matchInventoryRow("Dorado stamping", products)).toEqual({ kind: "variant", productId: "kit", variant: "Dorado stamping" });
    expect(matchInventoryRow("Tipei", products)).toEqual({ kind: "none" });
  });

  it("es solo para H la Cosedora", () => {
    expect(inventoryFileAllowed({ storefrontSlug: "hlacosedora" })).toBe(true);
    expect(inventoryFileAllowed({ storefrontSlug: "otra" })).toBe(false);
    expect(inventoryFileAllowed(null)).toBe(false);
  });
});
