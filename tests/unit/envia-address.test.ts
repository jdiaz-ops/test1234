import { describe, expect, it } from "vitest";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import { ENVIA_CO_CARRIERS } from "@/lib/envia-carriers";
import {
  ENVIA_STATE_CODE,
  enviaIdNumber,
  districtOf,
  splitStreet,
  enviaCarrierName,
  enviaPhone,
  enviaPlace,
  enviaStatusLabel,
  enviaText,
  isDeliveredStatus,
} from "@/lib/envia-address";
import { enviaAllowed } from "@/lib/features";

describe("direcciones de Colombia para Envia", () => {
  it("cada departamento tiene su código de Envia, distinto, de 2 letras", () => {
    const codes = COLOMBIA_REGIONS.map((r) => ENVIA_STATE_CODE[r]);
    expect(codes.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(COLOMBIA_REGIONS.length);
    // Los que no son los ISO de siempre.
    expect(ENVIA_STATE_CODE.Santander).toBe("SN");
    expect(ENVIA_STATE_CODE.Cauca).toBe("CU");
    expect(ENVIA_STATE_CODE.Cundinamarca).toBe("CN");
    expect(ENVIA_STATE_CODE["Bogotá D.C."]).toBe("DC");
  });

  it("la ciudad va con su código DANE de 8 dígitos", () => {
    expect(enviaPlace("Antioquia", "medellin")).toEqual({ state: "AN", city: "05001000", cityName: "Medellín" });
    expect(enviaPlace("Antioquia", "Envigado")).toEqual({ state: "AN", city: "05266000", cityName: "Envigado" });
    expect(enviaPlace("Bogotá D.C.", "Bogota")).toMatchObject({ state: "DC", city: "11001000" });
    expect(enviaPlace("Antioquia", "Ciudad Inventada")).toBeNull();
    expect(enviaPlace("Otro país", "Medellín")).toBeNull();
  });

  it("calle y número aparte, sin perder ni desordenar la dirección", () => {
    expect(splitStreet("Calle 16F # 99-59, apto 301")).toEqual({ street: "Calle 16F", number: "99-59, apto 301" });
    expect(splitStreet("Carrera 43A No. 1-50")).toEqual({ street: "Carrera 43A", number: "1-50" });
    // Sin "#": completa como calle y "S/N" (sin número).
    expect(splitStreet("Calle 16 F 99 59 Parque Central Fontibón 2, Torre 4 Apartamento 1407")).toEqual({
      street: "Calle 16 F 99 59 Parque Central Fontibón 2, Torre 4 Apartamento 1407",
      number: "S/N",
    });
    // Lo que va después del "#" es demasiado largo para el número: completa.
    const long = "Calle 1 # 2-3 conjunto residencial los almendros torre 7 apartamento 1203";
    expect(splitStreet(long)).toEqual({ street: long, number: "S/N" });
    expect(districtOf("Cra 70 # 1-2, barrio El Poblado, casa 3", "Medellín")).toBe("El Poblado");
    expect(districtOf("Calle 1 # 2-3", "Bogotá")).toBe("Bogotá");
  });

  it("NIT sin dígito de verificación; cédula y pasaporte sin puntos ni espacios", () => {
    expect(enviaIdNumber("900.123.456-7")).toBe("900123456");
    expect(enviaIdNumber("900123456 - 7")).toBe("900123456");
    expect(enviaIdNumber("1.020.304.050")).toBe("1020304050");
    expect(enviaIdNumber("ab 123456")).toBe("AB123456");
    expect(enviaIdNumber(null)).toBe("");
  });

  it("texto sin tildes ni caracteres raros, y celular de 10 dígitos", () => {
    expect(enviaText("  Calle 10 # 43-12 — Peñón\nApto 301 ")).toBe("Calle 10 # 43-12 Penon Apto 301");
    expect(enviaText("Productos para uñas")).toBe("Productos para unas");
    expect(enviaPhone("+57 300 123 4567")).toBe("3001234567");
    expect(enviaPhone("573001234567")).toBe("3001234567");
    expect(enviaPhone("300-123-4567")).toBe("3001234567");
  });

  it("nombres de transportadoras y estados en español", () => {
    expect(enviaCarrierName("serviEntrega")).toBe("Servientrega");
    expect(enviaCarrierName("interRapidisimo")).toBe("Interrapidísimo");
    expect(enviaCarrierName("fedex", "FedEx")).toBe("FedEx");
    expect(enviaCarrierName("dhl")).toBe("DHL");
    // La lista para elegir usa los mismos nombres.
    for (const c of ENVIA_CO_CARRIERS) expect(enviaCarrierName(c.code)).toBe(c.name);
    expect(enviaStatusLabel("Delivered")).toBe("Entregado");
    expect(enviaStatusLabel("In Transit")).toBe("En camino");
    expect(enviaStatusLabel("Out for delivery")).toBe("En reparto");
    expect(enviaStatusLabel("Algo nuevo")).toBe("Algo nuevo");
    expect(enviaStatusLabel(null)).toBeNull();
    expect(isDeliveredStatus("Delivered")).toBe(true);
    expect(isDeliveredStatus("ENTREGADO")).toBe(true);
    expect(isDeliveredStatus("Out for delivery")).toBe(false);
  });

  it("por ahora es solo para H la Cosedora", () => {
    expect(enviaAllowed({ storefrontSlug: "hlacosedora" })).toBe(true);
    expect(enviaAllowed({ storefrontSlug: "otra" })).toBe(false);
    expect(enviaAllowed(null)).toBe(false);
  });
});
