import { describe, expect, it } from "vitest";
import { municipalitiesOf, resolveDaneLocation } from "@/lib/dane";

describe("códigos DANE para la factura", () => {
  it("encuentra la ciudad sin importar tildes ni mayúsculas", () => {
    expect(resolveDaneLocation("Antioquia", "medellin")).toEqual({ department: "05", city: "001" });
    expect(resolveDaneLocation("Valle del Cauca", " Cali ")).toEqual({ department: "76", city: "001" });
    expect(resolveDaneLocation("Atlántico", "BARRANQUILLA")).toEqual({ department: "08", city: "001" });
  });

  it("acepta el nombre corto cuando solo puede ser un municipio", () => {
    expect(resolveDaneLocation("Bolívar", "Cartagena")).toEqual({ department: "13", city: "001" });
  });

  it("Bogotá es un solo municipio, escriban lo que escriban", () => {
    expect(resolveDaneLocation("Bogotá D.C.", "Bogota")).toEqual({ department: "11", city: "001" });
    expect(resolveDaneLocation("Bogotá D.C.", "Chapinero")).toEqual({ department: "11", city: "001" });
  });

  it("sin coincidencia segura no adivina", () => {
    expect(resolveDaneLocation("Antioquia", "Ciudad Inventada")).toBeNull();
    expect(resolveDaneLocation("Antioquia", "")).toBeNull();
    expect(resolveDaneLocation("", "Medellín")).toBeNull();
  });

  it("lista los municipios del departamento para sugerirlos", () => {
    expect(municipalitiesOf("Antioquia")).toContain("Medellín");
    expect(municipalitiesOf("Nariño")).toContain("San Andrés de Tumaco");
    expect(municipalitiesOf("Bogotá D.C.")).toEqual(["Bogotá, D.C."]);
    expect(municipalitiesOf("Antioquia")).not.toContain("Cali");
  });
});
