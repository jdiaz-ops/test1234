import { describe, expect, it } from "vitest";
import { marketplaceMissing } from "@/lib/marketplace-readiness";

const ready = {
  status: "APPROVED",
  logoUrl: "/logo.png",
  description: "Marca",
  storefrontSlug: "hlacosedora",
  storeConnectionStatus: "NOT_CONNECTED",
  websiteUrl: null,
  billingAcknowledgedAt: new Date(),
};

describe("qué le falta a una marca para salir en el marketplace", () => {
  it("nada si cumple todo", () => {
    expect(marketplaceMissing(ready, 1, false)).toEqual([]);
  });

  it("dice qué falta", () => {
    expect(
      marketplaceMissing({ ...ready, logoUrl: null, billingAcknowledgedAt: null }, 0, false),
    ).toEqual(["logo", "aceptar \"Cómo te cobramos\"", "un programa activo"]);
  });
});
