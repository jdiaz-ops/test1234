import { describe, expect, it } from "vitest";
import { marketplaceMissing } from "@/lib/marketplace-readiness";

describe("qué le falta a una marca para salir en el marketplace", () => {
  it("nada si está aprobada y su lista está lista", () => {
    expect(marketplaceMissing({ status: "APPROVED" }, [], false)).toEqual([]);
  });

  it("dice qué falta, con las palabras de la lista de su panel", () => {
    expect(marketplaceMissing({ status: "PENDING" }, ["Conecta tus pagos", "Configura tu programa de creadores"], true)).toEqual([
      "aprobarla",
      "conecta tus pagos",
      "configura tu programa de creadores",
      "pagar el corte (está desactivada)",
    ]);
    expect(marketplaceMissing({ status: "APPROVED" }, null, false)).toEqual(["crear su tienda en Marcolini"]);
  });
});
