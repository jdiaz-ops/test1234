import { describe, expect, it } from "vitest";
import { formatDateTimeCo, formatShortDateTimeCo } from "@/lib/date-time-co";

describe("fecha y hora en Colombia", () => {
  it("se escribe igual en cualquier lado, en hora de Colombia", () => {
    // 18:11 UTC = 1:11 p. m. en Colombia.
    expect(formatDateTimeCo("2026-10-19T18:11:00Z")).toBe("19 de octubre de 2026, 1:11 p. m.");
    // 3:05 UTC del 1 de enero = 10:05 p. m. del 31 de diciembre en Colombia.
    expect(formatDateTimeCo(new Date("2027-01-01T03:05:00Z"))).toBe("31 de diciembre de 2026, 10:05 p. m.");
    // Medianoche y mediodía.
    expect(formatShortDateTimeCo("2026-10-19T05:00:00Z")).toBe("19 oct, 12:00 a. m.");
    expect(formatShortDateTimeCo("2026-10-19T17:00:00Z", { year: true })).toBe("19 oct 2026, 12:00 p. m.");
  });
});
