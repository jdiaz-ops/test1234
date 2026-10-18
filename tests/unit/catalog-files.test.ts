import { describe, expect, it } from "vitest";
import { chunkText, draftsToImport, mergeDrafts, type DraftProduct } from "@/lib/catalog-files";

function draft(over: Partial<DraftProduct>): DraftProduct {
  return {
    id: "d1",
    name: "Bolso Luna",
    description: "",
    price: null,
    compareAtPrice: null,
    category: "",
    sku: "",
    weightGrams: null,
    options: [],
    photos: [],
    ...over,
  };
}

describe("archivos de una marca sin web", () => {
  it("une el mismo producto que aparece en el PDF y en la lista de precios", () => {
    const merged = mergeDrafts([
      draft({ id: "a", name: "Bolso Luna", category: "Bolsos", photos: [{ id: "p1", sourceId: "s1", box: null }] }),
      draft({ id: "b", name: "bolso  luna", price: 89000, description: "Cuero" }),
      draft({ id: "c", name: "Gorra" }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ id: "a", price: 89000, description: "Cuero", category: "Bolsos" });
    expect(merged[0].photos).toHaveLength(1);
  });

  it("parte textos largos repitiendo los encabezados", () => {
    const text = ["Nombre | Precio", ...Array.from({ length: 250 }, (_, i) => `P${i} | ${i}`)].join("\n");
    const chunks = chunkText(text, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks[1].split("\n")[0]).toBe("Nombre | Precio");
  });

  it("arma productos, variantes, colecciones y fotos para el importador", () => {
    const { products, collections } = draftsToImport(
      [
        draft({ id: "a", name: "Camiseta Sol", price: 45000, category: "Ropa", weightGrams: 200, options: [{ name: "Talla", values: ["S", "M"] }], photos: [{ id: "p1", sourceId: "s", box: null }] }),
        draft({ id: "b", name: "Camiseta Sol", price: null, category: "ropa" }),
      ],
      new Map([["p1", "https://blob.vercel-storage.com/p1.webp"]]),
    );
    expect(products.map((p) => p.handle)).toEqual(["camiseta-sol", "camiseta-sol-2"]);
    expect(products[0]).toMatchObject({ hasVariants: true, optionNames: ["Talla"], status: "ACTIVE", images: ["https://blob.vercel-storage.com/p1.webp"] });
    expect(products[0].variants.map((v) => [v.option1Value, v.price, v.weight])).toEqual([["S", 45000, 0.2], ["M", 45000, 0.2]]);
    expect(products[1].status).toBe("DRAFT");
    expect(collections).toEqual([expect.objectContaining({ name: "Ropa", productHandles: ["camiseta-sol", "camiseta-sol-2"] })]);
  });
});
