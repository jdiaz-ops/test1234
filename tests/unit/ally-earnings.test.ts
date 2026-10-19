import { describe, expect, it } from "vitest";
import { addMonths, allyPayDate, commissionFor, daysLeft, formatRate, monthKey, monthStart, monthlyEarnings } from "@/lib/ally-earnings";

describe("lo que gana un aliado", () => {
  it("cuenta 6 meses desde la primera venta, sin pasarse de mes", () => {
    expect(addMonths(new Date("2026-03-15T12:00:00Z"), 6).toISOString()).toBe("2026-09-15T12:00:00.000Z");
    expect(addMonths(new Date("2026-08-31T12:00:00Z"), 6).toISOString()).toBe("2027-02-28T12:00:00.000Z");
    expect(daysLeft(new Date("2026-10-01T00:00:00Z"), 6, new Date("2026-10-11T00:00:00Z"))).toBe(172);
    expect(daysLeft(new Date("2026-01-01T00:00:00Z"), 6, new Date("2026-10-11T00:00:00Z"))).toBe(0);
  });

  it("agrupa por mes de Colombia y solo dentro de la ventana", () => {
    const first = new Date("2026-03-10T15:00:00Z");
    const sales = [
      { at: new Date("2026-03-10T15:00:00Z"), amount: 100_000 },
      // 31 de marzo a las 8 p. m. en Colombia = 1 de abril en UTC: cuenta en marzo.
      { at: new Date("2026-04-01T01:00:00Z"), amount: 50_000 },
      { at: new Date("2026-05-02T12:00:00Z"), amount: 40_000 },
      // Después de los 6 meses: ya no cuenta.
      { at: new Date("2026-09-11T12:00:00Z"), amount: 999_999 },
      // Antes de la primera venta (no debería pasar) ni negativas.
      { at: new Date("2026-03-01T12:00:00Z"), amount: 10_000 },
      { at: new Date("2026-05-03T12:00:00Z"), amount: -5_000 },
    ];
    const months = monthlyEarnings(sales, first, 6, 250);
    expect(Object.fromEntries(months)).toEqual({
      "2026-03": { sales: 150_000, commission: 3750 },
      "2026-05": { sales: 40_000, commission: 1000 },
    });
    expect(monthKey(new Date("2026-04-01T01:00:00Z"))).toBe("2026-03");
    expect(monthStart("2026-03").toISOString()).toBe("2026-03-01T05:00:00.000Z");
  });

  it("redondea a pesos y muestra el porcentaje como se lee", () => {
    expect(commissionFor(18_000, 125)).toBe(225);
    expect(commissionFor(33_333, 125)).toBe(417);
    expect(formatRate(250)).toBe("2,5 %");
    expect(formatRate(125)).toBe("1,25 %");
  });

  it("se le paga cada mes el mismo día que a las creadoras", () => {
    // Lo de octubre, el 15 de noviembre (00:00 en Colombia).
    expect(allyPayDate("2026-10", 15, 15).toISOString()).toBe("2026-11-15T05:00:00.000Z");
    // Lo de diciembre, en enero del año siguiente.
    expect(allyPayDate("2026-12", 15, 15).toISOString()).toBe("2027-01-15T05:00:00.000Z");
    // Si la última venta del mes no alcanza a cumplir la espera, al pago siguiente.
    expect(allyPayDate("2026-10", 15, 20).toISOString()).toBe("2026-12-15T05:00:00.000Z");
  });
});
