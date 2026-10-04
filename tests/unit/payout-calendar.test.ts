import { describe, expect, it } from "vitest";
import { formatPayoutDay, nextPayoutDate, payoutDateForSale } from "@/lib/payout-calendar";

// Fechas en hora de Colombia (UTC-5).
const co = (iso: string) => new Date(`${iso}-05:00`);

describe("cierre por mes", () => {
  it("todo lo vendido en octubre se paga el 15 de noviembre", () => {
    for (const day of ["2026-10-01T00:00:00", "2026-10-04T14:36:00", "2026-10-31T23:59:00"]) {
      expect(formatPayoutDay(payoutDateForSale(co(day), 15, 15))).toBe("15 de noviembre");
    }
  });

  it("una venta que no alcanza la espera por devoluciones pasa al pago siguiente", () => {
    // Con día de pago 5 y 15 días de espera, el 31 de octubre no alcanza al 5 de noviembre.
    expect(formatPayoutDay(payoutDateForSale(co("2026-10-31T12:00:00"), 5, 15))).toBe("5 de diciembre");
    expect(formatPayoutDay(payoutDateForSale(co("2026-10-10T12:00:00"), 5, 15))).toBe("5 de noviembre");
  });

  it("el próximo pago: hoy si es día de pago, si no el siguiente", () => {
    expect(formatPayoutDay(nextPayoutDate(co("2026-10-04T10:00:00"), 15))).toBe("15 de octubre");
    expect(formatPayoutDay(nextPayoutDate(co("2026-10-15T18:00:00"), 15))).toBe("15 de octubre");
    expect(formatPayoutDay(nextPayoutDate(co("2026-10-16T08:00:00"), 15))).toBe("15 de noviembre");
    // 11 p. m. del 14 en Colombia ya es 15 en UTC: sigue siendo el 15.
    expect(formatPayoutDay(nextPayoutDate(co("2026-10-14T23:00:00"), 15))).toBe("15 de octubre");
  });

  it("el día de pago se muestra igual en Colombia (antes salía el 14)", () => {
    expect(formatPayoutDay(payoutDateForSale(co("2026-10-04T14:36:00"), 15, 15))).not.toBe("14 de noviembre");
  });
});
