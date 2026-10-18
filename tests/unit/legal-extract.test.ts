import { describe, expect, it } from "vitest";
import {
  extractProfileByRules,
  findAddress,
  findCity,
  findEmail,
  findLegalName,
  findPhone,
  findTaxId,
  sanitizeProfile,
  shortDescription,
  taxIdDigits,
} from "@/lib/legal-extract";

const PRIVACY = `POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES
En cumplimiento de la Ley 1581 de 2012, BEAUTY SOLUTION COLOMBIA S.A.S., identificada con NIT 901.234.567-8,
con domicilio principal en la ciudad de Medellín, Antioquia, en la Carrera 43A # 1-50 Local 201, informa que es
responsable del tratamiento de los datos. Contacto: datos@beautysolution.co o al WhatsApp +57 300 154 2560.`;

describe("legal-extract: reglas", () => {
  it("saca el NIT con dígito de verificación", () => {
    expect(findTaxId(PRIVACY)).toBe("901234567-8");
    expect(findTaxId("NIT: 900935582")).toBe("900935582");
    expect(findTaxId("Nit No. 900.935.582 - 1")).toBe("900935582-1");
    expect(findTaxId("sin nada")).toBeNull();
    expect(taxIdDigits("12")).toBeNull();
  });

  it("saca la razón social con su tipo de sociedad", () => {
    expect(findLegalName(PRIVACY)).toBe("BEAUTY SOLUTION COLOMBIA S.A.S.");
    expect(findLegalName("La sociedad Uñas Bonitas Ltda. es la responsable")).toBe("Uñas Bonitas Ltda.");
    expect(findLegalName("Responsable: Laboratorios Pro SAS, Bogotá")).toBe("Laboratorios Pro SAS");
    expect(findLegalName("Somos una tienda de esmaltes")).toBeNull();
  });

  it("saca dirección, ciudad, correo y teléfono", () => {
    expect(findAddress(PRIVACY)).toBe("Carrera 43A # 1-50 Local 201");
    expect(findAddress("Calle 10 No 5 - 20, Cali")).toBe("Calle 10 No 5 - 20");
    expect(findCity(PRIVACY)).toBe("Medellín");
    expect(findCity("Enviamos desde Bogotá D.C. a todo el país")).toBe("Bogotá");
    expect(findCity("Qué bello producto, qué soledad")).toBeNull();
    expect(findCity("Nuestra sede está en Bello, Antioquia")).toBe("Bello");
    expect(findEmail(PRIVACY)).toBe("datos@beautysolution.co");
    expect(findEmail("foto@2x.png")).toBeNull();
    expect(findPhone(PRIVACY)).toBe("+573001542560");
    expect(findPhone("Llámanos al 3001542560")).toBe("+573001542560");
    expect(findPhone("Teléfono 6041234567")).toBeNull();
  });

  it("recorta la descripción a 150 caracteres sin partir palabras", () => {
    const long = "Esmaltes semipermanentes, tips y geles de construcción para manicuristas profesionales en Colombia, con envíos a todo el país y asesoría personalizada para cada técnica.";
    const short = shortDescription(long)!;
    expect(short.length).toBeLessThanOrEqual(150);
    expect(short.endsWith("…")).toBe(true);
    expect(shortDescription("Corta")).toBeNull();
    expect(shortDescription("Seleccionar opciones Este producto tiene múltiples variantes. Las opciones se pueden elegir en la página de producto Bases para frances 2026 $22,000")).toBeNull();
    expect(shortDescription("Añadir al carrito Gel polish rosado $18.900 Añadir al carrito Top coat")).toBeNull();
    expect(shortDescription("<p>Productos para uñas hechos de manicurista a manicurista</p>")).toBe("Productos para uñas hechos de manicurista a manicurista");
  });

  it("arma el perfil completo y lo limpia", () => {
    const profile = extractProfileByRules({ texts: [PRIVACY], metaDescription: "Productos para uñas hechos de manicurista a manicurista" });
    expect(profile).toEqual({
      legalName: "BEAUTY SOLUTION COLOMBIA S.A.S.",
      taxId: "901234567-8",
      fiscalAddress: "Carrera 43A # 1-50 Local 201",
      city: "Medellín",
      email: "datos@beautysolution.co",
      phone: "+573001542560",
      description: "Productos para uñas hechos de manicurista a manicurista",
    });
    expect(sanitizeProfile({ taxId: "NIT 901.234.567-8", email: "  X@Y.COM ", phone: "300 154 2560", legalName: "  " })).toMatchObject({
      taxId: "901234567-8",
      email: "x@y.com",
      phone: "+573001542560",
      legalName: null,
    });
    expect(extractProfileByRules({ texts: [] })).toEqual({ legalName: null, taxId: null, fiscalAddress: null, city: null, email: null, phone: null, description: null });
  });
});
