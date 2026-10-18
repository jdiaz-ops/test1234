import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { needsIntegration, normalizeGatewayName } from "@/lib/payment-gateways";
import {
  listGatewayRequests,
  notifyGatewayReady,
  recordGatewayRequests,
  removeGatewayRequest,
} from "@/server/services/payment-gateway-request-service";
import { createBrand, hasDb } from "./helpers";

describe("payment-gateways", () => {
  it("reconoce las conocidas, deja pasar las nuevas y no pide integrar las que ya tenemos ni Shop Pay", () => {
    expect(normalizeGatewayName("mercado pago")).toBe("Mercado Pago");
    expect(normalizeGatewayName("  epayco ")).toBe("ePayco");
    expect(normalizeGatewayName("Sistecredito")).toBe("Sistecrédito");
    expect(normalizeGatewayName("Pasarela Rara")).toBe("Pasarela Rara");
    expect(normalizeGatewayName("x")).toBeNull();
    expect(needsIntegration("Wompi")).toBe(false);
    expect(needsIntegration("Shopify Payments / Shop Pay")).toBe(false);
    // Integradas el 2026-10-18: ya no se piden.
    expect(needsIntegration("Mercado Pago")).toBe(false);
    expect(needsIntegration("payu")).toBe(false);
    expect(needsIntegration("ePayco")).toBe(false);
    expect(needsIntegration("Bold")).toBe(false);
    expect(needsIntegration("PlacetoPay")).toBe(true);
    expect(needsIntegration("Pasarela Rara")).toBe(true);
  });
});

describe.skipIf(!hasDb)("pasarela que no tenemos", () => {
  it("se registra una vez por marca y pasarela y le avisa al propietario", async () => {
    const owner = await prisma.user.create({
      data: { email: `owner-${randomUUID().slice(0, 8)}@prueba.test`, role: "ADMIN", adminRole: "OWNER" },
    });
    const brand = await createBrand();
    const first = await recordGatewayRequests(brand.id, ["PlacetoPay", "Wompi", "Mercado Pago", "Shopify Payments / Shop Pay", "placetopay"], "DUPLICAR");
    expect(first).toEqual({ recorded: ["PlacetoPay"], notified: ["PlacetoPay"] });
    const notes = await prisma.notification.findMany({ where: { userId: owner.id, type: "PAYMENT_GATEWAY_REQUEST_ADMIN" } });
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain(brand.companyName);
    expect(notes[0].message).toContain("PlacetoPay");
    expect(notes[0].message).toContain("detectada al duplicar su tienda");

    // Repetir no duplica ni vuelve a avisar; una nueva sí.
    const again = await recordGatewayRequests(brand.id, ["PlacetoPay", "Addi"], "MARCA", "Llevo años con Addi");
    expect(again).toEqual({ recorded: ["PlacetoPay", "Addi"], notified: ["Addi"] });
    expect(await prisma.notification.count({ where: { userId: owner.id, type: "PAYMENT_GATEWAY_REQUEST_ADMIN" } })).toBe(2);
    const list = await listGatewayRequests(brand.id);
    expect(list.map((r) => [r.gateway, r.source, r.note])).toEqual([
      ["PlacetoPay", "DUPLICAR", null],
      ["Addi", "MARCA", "Llevo años con Addi"],
    ]);

    expect(await removeGatewayRequest(brand.id, "addi")).toBe(true);
    expect(await removeGatewayRequest(brand.id, "addi")).toBe(false);
    expect((await listGatewayRequests(brand.id)).map((r) => r.gateway)).toEqual(["PlacetoPay"]);

    // Una pasarela pedida antes y que ya quedó integrada: se le avisa a la
    // marca una sola vez (ver notifyGatewayReady, cron diario).
    await prisma.paymentGatewayRequest.create({ data: { brandId: brand.id, gateway: "Mercado Pago", source: "DUPLICAR" } });
    expect(await notifyGatewayReady()).toBeGreaterThanOrEqual(1);
    const ready = await prisma.notification.findMany({ where: { userId: brand.userId, type: "PAYMENT_GATEWAY_READY" } });
    expect(ready).toHaveLength(1);
    expect(ready[0].message).toContain("Mercado Pago");
    await notifyGatewayReady();
    expect(await prisma.notification.count({ where: { userId: brand.userId, type: "PAYMENT_GATEWAY_READY" } })).toBe(1);
    expect((await listGatewayRequests(brand.id)).map((r) => r.gateway)).toEqual(["PlacetoPay", "Mercado Pago"]);
    await prisma.user.delete({ where: { id: owner.id } });
  });
});
