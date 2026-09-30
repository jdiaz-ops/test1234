import { describe, expect, it } from "vitest";
import { parseShopifyProductsCsv, ShopifyCsvError, slugFromHandle } from "@/lib/shopify-csv";

const HEADER =
  "Handle,Title,Body (HTML),Type,Published,Option1 Name,Option1 Value,Variant SKU,Variant Grams,Variant Inventory Qty,Variant Price,Variant Compare At Price,Variant Barcode,Image Src,Image Position,Status";

const CSV = [
  HEADER,
  // Producto simple en oferta, activo, con dos fotos
  'back-to-basics-placa-stamping,Placa de Stamping Back to Basics,<p>Placa</p>,Placas Stamping,true,Title,Default Title,PL-001,50,10,15000,30000,7707738281871,https://cdn.example.com/a.jpg,1,active',
  "back-to-basics-placa-stamping,,,,,,,,,,,,,https://cdn.example.com/b.jpg,2,",
  // Producto con variantes
  "esmalte-stamping,Esmalte Stamping,,Esmaltes,true,Color,Plateado,ES-PL,20,4,5000,,,https://cdn.example.com/c.jpg,1,active",
  "esmalte-stamping,,,,,,Dorado,ES-DO,20,0,5000,,,,,",
  // Borrador en Shopify
  "top-coat,Top Coat,,Esmaltes,false,Title,Default Title,TC-1,15,3,6000,,,,,draft",
].join("\n");

describe("importar CSV de productos de Shopify", () => {
  const result = parseShopifyProductsCsv(CSV);
  const byHandle = Object.fromEntries(result.products.map((p) => [p.handle, p]));

  it("agrupa las filas por producto", () => {
    expect(result.products).toHaveLength(3);
    expect(result.stats.products).toBe(3);
  });

  it("lee precio, precio antes, fotos en orden, SKU, código de barras e inventario", () => {
    const placa = byHandle["back-to-basics-placa-stamping"];
    expect(placa.name).toBe("Placa de Stamping Back to Basics");
    expect(placa.price).toBe(15000);
    expect(placa.compareAtPrice).toBe(30000);
    expect(placa.images).toEqual(["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]);
    expect(placa.sku).toBe("PL-001");
    expect(placa.barcode).toBe("7707738281871");
    expect(placa.stock).toBe(10);
    expect(placa.hasVariants).toBe(false);
    expect(placa.collectionName).toBe("Placas Stamping");
    expect(placa.status).toBe("ACTIVE");
  });

  it("arma las variantes con su inventario", () => {
    const esmalte = byHandle["esmalte-stamping"];
    expect(esmalte.hasVariants).toBe(true);
    expect(esmalte.optionNames).toEqual(["Color"]);
    expect(esmalte.variants.map((v) => [v.option1Value, v.stock])).toEqual([
      ["Plateado", 4],
      ["Dorado", 0],
    ]);
  });

  it("lo que en Shopify está despublicado entra como borrador", () => {
    expect(byHandle["top-coat"].status).toBe("DRAFT");
    expect(result.stats.draft).toBe(1);
  });

  it("rechaza un archivo que no es la exportación de productos", () => {
    expect(() => parseShopifyProductsCsv("Nombre,Precio\nX,1")).toThrow(ShopifyCsvError);
  });

  it("la URL del producto sale del handle de Shopify", () => {
    expect(slugFromHandle("back-to-basics-placa-stamping", "x")).toBe("back-to-basics-placa-stamping");
    expect(slugFromHandle("", "Placa Ñandú Básica")).toBe("placa-nandu-basica");
  });
});
