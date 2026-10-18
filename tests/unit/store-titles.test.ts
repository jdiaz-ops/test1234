import { describe, expect, it } from "vitest";
import { cleanCatalogTitles, cleanTitle, detectStoreSuffix } from "@/lib/store-titles";

const BEAUTY_PRODUCTS = [
  "Gel Polish Azules | Beauty Solution",
  "Gel Polish Rosados | Beauty Solution",
  "Gel Polish Salmón y Naranjas | Beauty Solution",
  "AcrySoft™ Tips Coffin Medium | Beauty Solution",
  "POLYGEL",
];

describe("detectStoreSuffix", () => {
  it("toma el nombre de la tienda cuando algún título termina con él", () => {
    expect(detectStoreSuffix(["Tips Coffin - Mi Tienda", "Base Coat"], "Mi Tienda")).toBe("Mi Tienda");
  });

  it("ignora el nombre de la tienda si ningún título lo trae", () => {
    expect(detectStoreSuffix(["Tips Coffin", "Base Coat"], "Mi Tienda")).toBeNull();
  });

  it("detecta el remate repetido después de |", () => {
    expect(detectStoreSuffix(BEAUTY_PRODUCTS)).toBe("Beauty Solution");
  });

  it("no toma un remate que se repite poco, ni uno con números", () => {
    expect(detectStoreSuffix(["Esmalte Rojo | Tienda", "Esmalte Azul | Tienda", "Base", "Top", "Lima"])).toBeNull();
    expect(detectStoreSuffix(["Esmalte Rojo | 15ml", "Esmalte Azul | 15ml", "Esmalte Verde | 15ml"])).toBeNull();
  });

  it("no toma un remate después de guion, que suele ser parte del nombre", () => {
    expect(detectStoreSuffix(["Esmalte Rojo - Semipermanente", "Esmalte Azul - Semipermanente", "Esmalte Verde - Semipermanente"])).toBeNull();
  });
});

describe("cleanTitle", () => {
  it("quita el nombre de la tienda al final, con cualquier separador", () => {
    expect(cleanTitle("Gel Polish Azules | Beauty Solution", "Beauty Solution")).toBe("Gel Polish Azules");
    expect(cleanTitle("Tips Coffin - Beauty Solution", "Beauty Solution")).toBe("Tips Coffin");
    expect(cleanTitle("Tips Coffin – beauty solution", "Beauty Solution")).toBe("Tips Coffin");
  });

  it("quita el nombre pegado al final de una parte", () => {
    expect(cleanTitle("Esmaltes Semipermanentes Beauty Solution", "Beauty Solution")).toBe("Esmaltes Semipermanentes");
  });

  it("deja el resto del título en los productos", () => {
    expect(cleanTitle("AcrySoft™ | Soft Gel Tips Profesionales | Beauty Solution", "Beauty Solution")).toBe(
      "AcrySoft™ | Soft Gel Tips Profesionales",
    );
    expect(cleanTitle("Kit Uñas - Rojo", "Beauty Solution")).toBe("Kit Uñas - Rojo");
  });

  it("en colecciones se queda con la primera parte de un título con |", () => {
    expect(cleanTitle("AcrySoft™ | Soft Gel Tips Profesionales | Beauty Solution", "Beauty Solution", { firstSegment: true })).toBe("AcrySoft™");
    expect(cleanTitle("Glitters Gel Polish Profesional | Esmaltes Semipermanentes Beauty Solution", "Beauty Solution", { firstSegment: true })).toBe(
      "Glitters Gel Polish Profesional",
    );
    expect(cleanTitle("Bases para Frances | Gel Polish Profesional Beauty Solution", "Beauty Solution", { firstSegment: true })).toBe(
      "Bases para Frances",
    );
    // Un guion no es texto para Google: se respeta.
    expect(cleanTitle("Esmaltes - Semipermanentes", null, { firstSegment: true })).toBe("Esmaltes - Semipermanentes");
  });

  it("nunca deja un título vacío", () => {
    expect(cleanTitle("Beauty Solution", "Beauty Solution")).toBe("Beauty Solution");
    expect(cleanTitle("   ", "Beauty Solution")).toBe("");
  });

  it("sin remate no toca los productos", () => {
    expect(cleanTitle("Gel Polish Azules | Beauty Solution", null)).toBe("Gel Polish Azules | Beauty Solution");
  });
});

describe("cleanCatalogTitles", () => {
  it("limpia productos y colecciones y devuelve el remate", () => {
    const products = BEAUTY_PRODUCTS.map((name, i) => ({ handle: `p${i}`, name }));
    const collections = [
      { handle: "gel-polish-azules-beauty-solution", name: "Gel Polish Azules | Beauty Solution" },
      { handle: "acrysoft", name: "AcrySoft™ | Soft Gel Tips Profesionales | Beauty Solution" },
      { handle: "builder-gel", name: "BUILDER GEL" },
    ];
    const cleaned = cleanCatalogTitles(products, collections, "Beauty Solution Shop");
    expect(cleaned.suffix).toBe("Beauty Solution");
    expect(cleaned.products.map((p) => p.name)).toEqual([
      "Gel Polish Azules",
      "Gel Polish Rosados",
      "Gel Polish Salmón y Naranjas",
      "AcrySoft™ Tips Coffin Medium",
      "POLYGEL",
    ]);
    expect(cleaned.collections.map((c) => c.name)).toEqual(["Gel Polish Azules", "AcrySoft™", "BUILDER GEL"]);
    expect(cleaned.collections[0].handle).toBe("gel-polish-azules-beauty-solution");
    // Los originales no se tocan.
    expect(products[0].name).toBe("Gel Polish Azules | Beauty Solution");
  });

  it("usa el remate de las colecciones cuando los productos no lo traen", () => {
    const products = [{ name: "Base Coat" }, { name: "Top Coat" }];
    const collections = [
      { name: "Bases | Mi Tienda" },
      { name: "Tops | Mi Tienda" },
      { name: "Kits | Mi Tienda" },
    ];
    const cleaned = cleanCatalogTitles(products, collections);
    expect(cleaned.suffix).toBe("Mi Tienda");
    expect(cleaned.collections.map((c) => c.name)).toEqual(["Bases", "Tops", "Kits"]);
  });

  it("sin remate deja todo igual, salvo la primera parte de colecciones con |", () => {
    const cleaned = cleanCatalogTitles([{ name: "Base Coat" }], [{ name: "Kits | Promociones" }]);
    expect(cleaned.suffix).toBeNull();
    expect(cleaned.products[0].name).toBe("Base Coat");
    expect(cleaned.collections[0].name).toBe("Kits");
  });
});
