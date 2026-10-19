import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { monthKey } from "@/lib/ally-earnings";
import { consumeAllyLoginToken } from "@/lib/ally-login-token";
import { applyWompiTransactionStatus } from "@/server/services/store-order-service";
import {
  AllyError,
  allyOverview,
  createAlly,
  createAllyLead,
  createAllyLoginLink,
  linkAllyReferral,
  recordAllyPayout,
  setAllyStatus,
  updateAllyPayoutDetails,
} from "@/server/services/ally-service";
import { createPendingOrder, createProduct, createSellingBrand, hasDb } from "./helpers";

/// Venta real (no de prueba de Wompi) de un producto de $20.000 más envío:
/// la base del aliado son los $20.000 (o $18.000 con el descuento del código).
async function sell(brandId: string, productId: string, extra: Record<string, unknown> = {}) {
  const order = await createPendingOrder(brandId, [{ productId, quantity: 1, unitPrice: 20000 }]);
  await prisma.storeOrder.update({ where: { id: order.id }, data: { paymentMode: "PRODUCTION", shippingCents: 800_000, totalCents: 2_800_000, ...extra } });
  await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: `tx-${order.id}`, wompiStatus: "APPROVED" });
  return order;
}

async function creatorWithCode(brandId: string) {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: { email: `creadora-${suffix}@prueba.test`, role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, displayName: `Creadora ${suffix}`, baseCode: `CR${suffix}`, storefrontSlug: `cr-${suffix}` } });
  const offer = await prisma.offer.create({ data: { brandId, name: "Programa", defaultCommissionPercent: 8, defaultDiscountPercent: 10 } });
  const code = `CODIGO${suffix}`.toUpperCase();
  await prisma.creatorOfferEnrollment.create({ data: { creatorId: creator.id, offerId: offer.id, discountCode: code } });
  return { creator, code };
}

describe.skipIf(!hasDb)("aliados comerciales", () => {
  it("crea el aliado con su link, recibe solicitudes y no deja repetir correo", async () => {
    const suffix = randomUUID().slice(0, 6);
    const user = await createAlly({ name: `Laura Pérez ${suffix}`, email: `laura-${suffix}@prueba.test`, phone: "3001234567" });
    expect(user.role).toBe("ALLY");
    expect(user.allyProfile?.code).toBe(`laura-perez-${suffix}`);
    await expect(createAlly({ name: "Otra", email: `LAURA-${suffix}@prueba.test` })).rejects.toBeInstanceOf(AllyError);

    const lead = await createAllyLead(user.allyProfile!.code, { kind: "BRAND", name: "Esmaltes Sol", contactName: "Ana", phone: "3110000000", instagram: "@esmaltessol" });
    expect(lead).toMatchObject({ kind: "BRAND", status: "PENDING", allyId: user.allyProfile!.id });
    expect(lead.consentAt).toBeInstanceOf(Date);

    await setAllyStatus(user.allyProfile!.id, "PAUSED");
    await expect(createAllyLead(user.allyProfile!.code, { kind: "CREATOR", name: "Caro", phone: "3120000000", instagram: "@caro", city: "Cali" })).rejects.toThrow(/no está activo/);
  });

  it("gana 2,5 % de la marca y 1,25 % de la creadora, y por las dos cuando la creadora vende esa marca", async () => {
    await prisma.platformConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
    const suffix = randomUUID().slice(0, 6);
    const user = await createAlly({ name: `Aliado ${suffix}`, email: `aliado-${suffix}@prueba.test` });
    const allyId = user.allyProfile!.id;
    const brand = await createSellingBrand();
    const product = await createProduct(brand.id, { name: "Builder Gel", price: 20000, stock: 10 });
    const { creator, code } = await creatorWithCode(brand.id);

    const lead = await createAllyLead(user.allyProfile!.code, { kind: "BRAND", name: brand.companyName, contactName: "Ana", phone: "3110000000", instagram: "@x" });
    await linkAllyReferral(allyId, { leadId: lead.id, brandId: brand.id });
    await linkAllyReferral(allyId, { creatorId: creator.id });
    await expect(linkAllyReferral(allyId, { brandId: brand.id })).rejects.toThrow(/ya está vinculada/);
    expect((await prisma.allyLead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("APPROVED");

    // Antes de vender: los meses no corren.
    let overview = await allyOverview(allyId);
    expect(overview!.referrals.map((r) => r.state)).toEqual(["sin-ventas", "sin-ventas"]);

    // Una venta directa de la marca ($20.000) y una con el código de la
    // creadora ($18.000 con el 10 % de descuento).
    await sell(brand.id, product.id);
    await sell(brand.id, product.id, { discountCode: code, discountCents: 200_000, totalCents: 2_600_000 });

    overview = await allyOverview(allyId);
    const key = monthKey(new Date());
    const brandRow = overview!.referrals.find((r) => r.kind === "BRAND")!;
    const creatorRow = overview!.referrals.find((r) => r.kind === "CREATOR")!;
    expect(brandRow).toMatchObject({ state: "activa", rateBps: 250, windowMonths: 6 });
    expect(brandRow.months[key]).toEqual({ sales: 38000, commission: 950 });
    expect(creatorRow.months[key]).toEqual({ sales: 18000, commission: 225 });
    expect(brandRow.daysLeft).toBeGreaterThan(170);
    expect(overview!.months[0]).toMatchObject({ key, sales: 56000, commission: 1175, state: "en-curso" });
    expect(overview!.totals).toMatchObject({ thisMonth: 1175, pending: 0, paid: 0 });
    // Lo que ve el aliado: nombres y totales, nunca pedidos ni clientes.
    expect(JSON.stringify(overview)).not.toContain("prueba.test\",\"buyer");
    expect(JSON.stringify(overview!.referrals)).not.toMatch(/comprador|buyer|reference/i);

    // La primera venta quedó guardada: desde ahí corren los 6 meses.
    const saved = await prisma.allyReferral.findUniqueOrThrow({ where: { brandId: brand.id } });
    expect(saved.firstSaleAt).toBeInstanceOf(Date);
  });

  it("un mes pasado queda por pagar hasta que se marca pagado, una sola vez", async () => {
    const suffix = randomUUID().slice(0, 6);
    const user = await createAlly({ name: `Pagos ${suffix}`, email: `pagos-${suffix}@prueba.test` });
    const allyId = user.allyProfile!.id;
    const brand = await createSellingBrand();
    const product = await createProduct(brand.id, { name: "Top", price: 20000, stock: 10 });
    await linkAllyReferral(allyId, { brandId: brand.id });
    const order = await sell(brand.id, product.id);
    // La venta fue hace un mes y medio.
    const past = new Date(Date.now() - 45 * 24 * 3600 * 1000);
    await prisma.storeSaleFee.update({ where: { orderId: order.id }, data: { createdAt: past } });

    let overview = await allyOverview(allyId);
    const month = overview!.months.find((m) => m.key === monthKey(past))!;
    expect(month).toMatchObject({ sales: 20000, commission: 500, state: "por-pagar" });
    expect(overview!.totals.pending).toBe(500);

    await recordAllyPayout(allyId, { period: past, amount: 500, reference: "Transferencia 123" });
    await expect(recordAllyPayout(allyId, { period: past, amount: 500 })).rejects.toThrow(/ya está pagado/);
    overview = await allyOverview(allyId);
    expect(overview!.months.find((m) => m.key === monthKey(past))).toMatchObject({ state: "pagado", payout: { amount: 500, reference: "Transferencia 123" } });
    expect(overview!.totals).toMatchObject({ pending: 0, paid: 500 });
  });

  it("entra con un link de un solo uso y guarda sus datos de pago", async () => {
    const suffix = randomUUID().slice(0, 6);
    const user = await createAlly({ name: `Acceso ${suffix}`, email: `acceso-${suffix}@prueba.test` });
    const url = await createAllyLoginLink(user.id, 30);
    const token = new URL(url).searchParams.get("token")!;
    expect((await consumeAllyLoginToken(token))?.id).toBe(user.id);
    expect(await consumeAllyLoginToken(token)).toBeNull();
    expect(await consumeAllyLoginToken("x".repeat(64))).toBeNull();

    await updateAllyPayoutDetails(user.allyProfile!.id, {
      legalName: "Laura Pérez",
      documentType: "CC",
      documentNumber: "1.017.234.567",
      payoutMethod: "BANK",
      bankName: "Bancolombia",
      bankAccountType: "AHORROS",
      bankAccountNumber: "123-456789-01",
      breBKey: "no se guarda",
    });
    const profile = await prisma.allyProfile.findUniqueOrThrow({ where: { id: user.allyProfile!.id } });
    expect(profile).toMatchObject({ documentNumber: "1017234567", bankAccountNumber: "123-456789-01", breBKey: null, payoutMethod: "BANK" });
  });
});
