import { describe, expect, it } from "vitest";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import { ENVIA_CO_CARRIERS } from "@/lib/envia-carriers";
import {
  ENVIA_STATE_CODE,
  enviaIdNumber,
  enviaCarrierName,
  enviaPhone,
  enviaPlace,
  enviaStatusLabel,
  enviaStatusStage,
  enviaStatusTone,
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
  });

  it("los estados del catálogo de Envia, en español y con lo que significan para el pedido", () => {
    // El catálogo completo de Envia (docs.envia.com → Track Shipments).
    const catalog = [
      "Created", "Shipped", "Delivered", "Canceled", "Information", "N/A", "Pending", "Picked Up",
      "Out for Delivery", "Lost", "Returned", "Pickup at Office", "Delivered at Origin", "Damaged",
      "Redirected", "Out for Pickup", "1 delivery attempt", "2 delivery attempts", "3 delivery attempts",
      "Return problem", "Address error", "Undeliverable", "Delayed", "Rejected", "1 pickup attempt",
      "Partially Shipped", "Partially Delivered", "Delivery Attempt",
    ];
    for (const status of catalog) {
      expect(enviaStatusStage(status), status).not.toBeNull();
      expect(enviaStatusLabel(status), status).not.toBe(status);
    }
    expect(new Set(catalog.map(enviaStatusLabel)).size).toBe(catalog.length);
    expect(enviaStatusLabel("Delivered")).toBe("Entregado");
    expect(enviaStatusLabel("Picked Up")).toBe("La recogió la transportadora");
    expect(enviaStatusLabel("Out for Delivery")).toBe("En reparto");
    expect(enviaStatusLabel("2 delivery attempts")).toBe("2 intentos de entrega");
    expect(enviaStatusLabel("In Transit")).toBe("En camino");
    expect(enviaStatusLabel("Algo nuevo")).toBe("Algo nuevo");
    expect(enviaStatusLabel(null)).toBeNull();

    // Con la guía creada la transportadora todavía no tiene el paquete.
    expect(["Created", "Pending", "Out for Pickup", "1 pickup attempt"].map(enviaStatusStage)).toEqual([
      "label",
      "label",
      "label",
      "label",
    ]);
    // Ya lo recogió: ahí sí va en camino.
    expect(["Shipped", "Picked Up", "Out for Delivery", "1 delivery attempt", "Pickup at Office"].map(enviaStatusStage)).toEqual(
      ["transit", "transit", "transit", "transit", "transit"],
    );
    expect(enviaStatusStage("Information")).toBe("info");
    expect(enviaStatusStage("Algo nuevo")).toBeNull();
    expect(enviaStatusStage("Canceled")).toBe("canceled");

    // Entregado es solo entregado a la compradora (el aviso de Envia viene en minúscula).
    expect(isDeliveredStatus("Delivered")).toBe(true);
    expect(isDeliveredStatus("delivered")).toBe(true);
    expect(isDeliveredStatus("ENTREGADO")).toBe(true);
    for (const status of ["Out for Delivery", "Delivered at Origin", "Partially Delivered", "1 delivery attempt", "Delivery Attempt"]) {
      expect(isDeliveredStatus(status), status).toBe(false);
    }
    expect(enviaStatusLabel("Delivered at Origin")).toBe("Devuelto a quien envía");

    // El color en el pedido: lo que hay que revisar resalta.
    expect(enviaStatusTone("Delivered")).toBe("delivered");
    expect(enviaStatusTone("Address error")).toBe("attention");
    expect(enviaStatusTone("1 delivery attempt")).toBe("attention");
    expect(enviaStatusTone("Out for Delivery")).toBe("normal");
    expect(enviaStatusTone("Canceled")).toBe("canceled");
    expect(enviaStatusTone(null)).toBe("normal");
  });

  it("por ahora es solo para H la Cosedora", () => {
    expect(enviaAllowed({ storefrontSlug: "hlacosedora" })).toBe(true);
    expect(enviaAllowed({ storefrontSlug: "otra" })).toBe(false);
    expect(enviaAllowed(null)).toBe(false);
  });
});
