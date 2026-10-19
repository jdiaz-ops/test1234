import { describe, expect, it } from "vitest";
import { lineProductName, productLines, sentenceCaseReference, splitLineName, suggestLineName } from "@/lib/product-lines";

describe("nombres por línea", () => {
  it("separa la línea de la referencia por el último guion", () => {
    expect(splitLineName("Gel Polish Blancos, Negros y Grises – SUPER BLACK")).toEqual({ line: "Gel Polish Blancos, Negros y Grises", rest: "SUPER BLACK" });
    expect(splitLineName("Gel Polish Platinum | Platinum Gel Profesional – Tokio")).toEqual({ line: "Gel Polish Platinum | Platinum Gel Profesional", rest: "Tokio" });
    expect(splitLineName("Kit - Uñas - Rosado")).toEqual({ line: "Kit - Uñas", rest: "Rosado" });
    expect(splitLineName("Top Coat 10 ml")).toBeNull();
    expect(splitLineName("Lima 100-180")).toBeNull();
  });

  it("agrupa las líneas de dos o más productos", () => {
    const lines = productLines([
      { id: "1", name: "Gel Polish Blancos, Negros y Grises – SUPER BLACK" },
      { id: "2", name: "Gel Polish Blancos, Negros y Grises – DIGNA" },
      { id: "3", name: "Gel Polish Verdes – CANTANTE" },
      { id: "4", name: "Top Coat 10 ml" },
    ]);
    expect(lines.map((l) => [l.line, l.products.length])).toEqual([["Gel Polish Blancos, Negros y Grises", 2]]);
  });

  it("propone el comienzo corto: sin los colores del final ni lo de después de la barra", () => {
    expect(suggestLineName("Gel Polish Blancos, Negros y Grises")).toBe("Gel Polish");
    expect(suggestLineName("Gel Polish Cafés y Nudes")).toBe("Gel Polish");
    expect(suggestLineName("Gel Polish Verdes")).toBe("Gel Polish");
    expect(suggestLineName("Gel Polish Rojos & Corales")).toBe("Gel Polish");
    expect(suggestLineName("Gel Polish Salmón y Naranjas")).toBe("Gel Polish");
    expect(suggestLineName("Gel Polish Platinum | Platinum Gel Profesional")).toBe("Gel Polish Platinum");
    // Nada que acortar.
    expect(suggestLineName("Gel Polish")).toBeNull();
    expect(suggestLineName("Kit - Uñas")).toBeNull();
    expect(suggestLineName("Rosados")).toBeNull();
  });

  it("arma el nombre nuevo y deja los tamaños como están", () => {
    expect(lineProductName("Gel Polish", "SUPER BLACK", false)).toBe("Gel Polish – SUPER BLACK");
    expect(lineProductName("Gel Polish", "SUPER BLACK", true)).toBe("Gel Polish – Super Black");
    expect(sentenceCaseReference("ACIDA 15 ML")).toBe("Acida 15 ml");
    expect(sentenceCaseReference("OJO DE GATO 8ML")).toBe("Ojo de Gato 8ML");
    expect(sentenceCaseReference("DE LUJO")).toBe("De Lujo");
  });
});
