import { describe, expect, it } from "vitest";
import { OTHER_COLLECTION_NAME, proposeCollectionsByRules, sanitizeProposal } from "@/lib/shopify-categorize";

describe("proponer categorías para una tienda sin colecciones", () => {
  it("agrupa por Tipo de producto cuando la mayoría lo tiene", () => {
    const result = proposeCollectionsByRules([
      { handle: "a", name: "Placa 01", type: "Placas Stamping" },
      { handle: "b", name: "Placa 02", type: "placas stamping" },
      { handle: "c", name: "Esmalte rojo", type: "Esmaltes" },
      { handle: "d", name: "Algo raro", type: "" },
    ]);
    expect(result.method).toBe("tipo");
    expect(result.collections).toEqual([
      { name: "Placas Stamping", productHandles: ["a", "b"] },
      { name: "Esmaltes", productHandles: ["c"] },
      { name: OTHER_COLLECTION_NAME, productHandles: ["d"] },
    ]);
  });

  it("sin tipos clasifica por palabras del nicho, con acentos o sin ellos", () => {
    const result = proposeCollectionsByRules([
      { handle: "a", name: "AcrySoft Soft Gel Almond Clear" },
      { handle: "b", name: "Esmalte semipermanente Rojo Pasión", tags: ["color"] },
      { handle: "c", name: "Lámpara UV/LED 48W" },
      { handle: "d", name: "Kit de iniciación stamping" },
      { handle: "e", name: "Primer ácido 15 ml" },
      { handle: "f", name: "Producto misterioso" },
    ]);
    expect(result.method).toBe("palabras");
    expect(result.collections).toEqual([
      { name: "Soft gel y tips", productHandles: ["a"] },
      { name: "Esmaltes", productHandles: ["b"] },
      { name: "Herramientas y equipos", productHandles: ["c"] },
      { name: "Kits y combos", productHandles: ["d"] },
      { name: "Preparación y cuidado", productHandles: ["e"] },
      { name: OTHER_COLLECTION_NAME, productHandles: ["f"] },
    ]);
  });

  it("si nada calza no propone nada", () => {
    expect(proposeCollectionsByRules([{ handle: "a", name: "Cosa" }, { handle: "b", name: "Otra" }])).toEqual({
      collections: [],
      method: "ninguno",
    });
    expect(proposeCollectionsByRules([])).toEqual({ collections: [], method: "ninguno" });
  });

  it("limpia una propuesta: handles inventados, repetidos y productos sin categoría", () => {
    const products = [
      { handle: "a", name: "A" },
      { handle: "b", name: "B" },
      { handle: "c", name: "C" },
    ];
    expect(
      sanitizeProposal(
        [
          { name: "  Esmaltes  ", productHandles: ["a", "zzz", "a"] },
          { name: "esmaltes", productHandles: ["b"] },
          { name: "Vacía", productHandles: [] },
          { name: "x", productHandles: ["c"] },
        ],
        products,
      ),
    ).toEqual([
      { name: "Esmaltes", productHandles: ["a", "b"] },
      { name: OTHER_COLLECTION_NAME, productHandles: ["c"] },
    ]);
  });
});
