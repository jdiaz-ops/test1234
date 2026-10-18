import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { needsIntegration, normalizeGatewayName } from "@/lib/payment-gateways";
import {
  listGatewayRequests,
  recordGatewayRequests,
  removeGatewayRequest,
} from "@/server/services/payment-gateway-request-service";
import { createBrand, hasDb } from "./helpers";

describe("payment-gateways", () => {
  it("reconoce las conocidas, deja pasar las nuevas y no pide integrar Wompi ni Shop Pay", () => {
    expect(normalizeGatewayName("mercado pago")).toBe("Mercado Pago");
    expect(normalizeGatewayName("  epayco ")).toBe("ePayco");
    expect(normalizeGatewayName("Sistecredito")).toBe("Sistecrédito");
    expect(normalizeGatewayName("Pasarela Rara")).toBe("Pasarela Rara");
    expect(normalizeGatewayName("x")).toBeNull();
    expect(needsIntegration("Wompi")).toBe(false);
    expect(needsIntegration("Shopify Payments / Shop Pay")).toBe(false);
    expect(needsIntegration("Mercado Pago")).toBe(true);
    expect(needsIntegration("Pasarela Rara")).toBe(true);
  });
});

describe.skipIf(!hasDb)("pasarela que no tenemos", () => {
  it("se registra una vez por marca y pasarela y le avisa al propietario", async () => {
    const owner = await prisma.user.create({
      data: { email: `owner-${randomUUID().slice(0, 8)}@prueba.test`, role: "ADMIN", adminRole: "OWNER" },
    });
    const brand = await createBrand();
    const first = await recordGatewayRequests(brand.id, ["Mercado Pago", "Wompi", "Shopify Payments / Shop Pay", "mercado pago"], "DUPLICAR");
    expect(first).toEqual({ recorded: ["Mercado Pago"], notified: ["Mercado Pago"] });
    const notes = await prisma.notification.findMany({ where: { userId: owner.id, type: "PAYMENT_GATEWAY_REQUEST_ADMIN" } });
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain(brand.companyName);
    expect(notes[0].message).toContain("Mercado Pago");
    expect(notes[0].message).toContain("detectada al duplicar su tienda");

    // Repetir no duplica ni vuelve a avisar; una nueva sí.
    const again = await recordGatewayRequests(brand.id, ["Mercado Pago", "PayU"], "MARCA", "Llevo años con PayU");
    expect(again).toEqual({ recorded: ["Mercado Pago", "PayU"], notified: ["PayU"] });
    expect(await prisma.notification.count({ where: { userId: owner.id, type: "PAYMENT_GATEWAY_REQUEST_ADMIN" } })).toBe(2);
    const list = await listGatewayRequests(brand.id);
    expect(list.map((r) => [r.gateway, r.source, r.note])).toEqual([
      ["Mercado Pago", "DUPLICAR", null],
      ["PayU", "MARCA", "Llevo años con PayU"],
    ]);

    expect(await removeGatewayRequest(brand.id, "payu")).toBe(true);
    expect(await removeGatewayRequest(brand.id, "payu")).toBe(false);
    expect((await listGatewayRequests(brand.id)).map((r) => r.gateway)).toEqual(["Mercado Pago"]);
    await prisma.user.delete({ where: { id: owner.id } });
  });
});
