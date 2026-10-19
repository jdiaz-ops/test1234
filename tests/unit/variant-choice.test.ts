import { describe, expect, it } from "vitest";
import { chooseOptionLabel, singularOptionName } from "@/lib/variant-choice";

describe("lo que dice el botón mientras falta elegir la variante", () => {
  it("nombra la opción que falta, en singular", () => {
    expect(chooseOptionLabel(["REFERENCIAS"], {})).toBe("Elige tu referencia");
    expect(chooseOptionLabel(["Tonos"], {})).toBe("Elige tu tono");
    expect(chooseOptionLabel(["Talla", "Color"], { 0: "M" })).toBe("Elige tu color");
    expect(chooseOptionLabel(["Talla", "Color"], { 1: "Rojo" })).toBe("Elige tu talla");
    expect(chooseOptionLabel(["Talla", "Color"], {})).toBe("Elige tus opciones");
  });

  it("no inventa singulares que no sabe", () => {
    expect(chooseOptionLabel(["Colores"], {})).toBe("Elige una opción");
    expect(chooseOptionLabel(["Presentaciones"], {})).toBe("Elige una opción");
    expect(singularOptionName("Kits")).toBeNull();
    expect(singularOptionName("Tipos de punta")).toBe("tipo de punta");
    expect(singularOptionName("Presentación")).toBe("presentación");
  });
});
