import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  acceptPrBoxProposal,
  createPrBox,
  declinePrBoxProposal,
  deletePrBox,
  listCreatorPrBoxRequests,
  listOpenPrBoxes,
  listProposableCreators,
  markPrBoxShipped,
  orderShipped,
  proposePrBox,
  requestPrBox,
  respondToPrBoxRequest,
  updatePrBox,
  PrBoxError,
} from "@/server/services/pr-box-service";
import { prBoxInputSchema, prBoxStage } from "@/lib/pr-box";
import { createBrand, hasDb } from "./helpers";

const SHIPPING = {
  shippingName: "Laura Gómez",
  shippingDocument: "1020304050",
  shippingEmail: "laura@prueba.test",
  shippingPhone: "3001234567",
  shippingRegion: "Antioquia",
  shippingCity: "Medellín",
  shippingAddress: "Calle 10 # 20-30",
  shippingNotes: "",
};

async function approvedBrand() {
  const brand = await createBrand();
  return prisma.brandProfile.update({ where: { id: brand.id }, data: { status: "APPROVED" } });
}

async function createCreator(opts: { discoverable?: boolean } = {}) {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: { email: `creadora-${suffix}@prueba.test`, role: "CREATOR" } });
  return prisma.creatorProfile.create({
    data: { userId: user.id, displayName: `Creadora ${suffix}`, baseCode: `CR${suffix}`.toUpperCase(), storefrontSlug: `cr-${suffix}`, discoverable: opts.discoverable ?? true },
  });
}

/// La creadora entra al programa de la marca (aceptó la invitación).
async function link(brandId: string, creatorId: string) {
  const offer =
    (await prisma.offer.findFirst({ where: { brandId } })) ??
    (await prisma.offer.create({ data: { brandId, name: "Programa", defaultCommissionPercent: 8, defaultDiscountPercent: 10 } }));
  await prisma.creatorOfferEnrollment.create({ data: { creatorId, offerId: offer.id, discountCode: `C${randomUUID().slice(0, 8)}`.toUpperCase(), status: "ACTIVE" } });
}

/// Lo que manda el formulario de la marca.
function rawBox(overrides: Record<string, unknown> = {}) {
  return {
    name: "Caja lanzamiento Navidad",
    contents: "Gel Polish Super Black 15 ml\nTop coat\nLima",
    images: ["https://cdn.prueba.test/caja.jpg"],
    units: 1,
    contentBrief: "Un Reel mostrando el unboxing y el resultado.",
    keyMessages: "Menciona @marca y usa #MarcaNavidad.",
    launchOn: "2026-12-15",
    shipsOn: "2026-11-20",
    status: "OPEN",
    ...overrides,
  };
}

function boxInput(overrides: Record<string, unknown> = {}) {
  return prBoxInputSchema.parse(rawBox(overrides));
}

describe.skipIf(!hasDb)("cajas PR", () => {
  it("la creadora la pide, la marca aprueba y la envía", async () => {
    const brand = await approvedBrand();
    const box = await createPrBox(brand.id, boxInput({ units: 2 }));
    const laura = await createCreator();

    // Sale en el marketplace, sin las unidades a la vista de nadie más.
    expect((await listOpenPrBoxes()).some((b) => b.id === box.id)).toBe(true);

    const request = await requestPrBox(laura.id, box.id, SHIPPING, "Me encantaría mostrarla en mi Reel de Navidad");
    expect(request.status).toBe("REQUESTED");
    await expect(requestPrBox(laura.id, box.id, SHIPPING)).rejects.toThrow("Ya pediste esta caja.");
    const brandUser = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id }, select: { userId: true } });
    expect(await prisma.notification.count({ where: { userId: brandUser.userId, type: "PR_BOX_REQUESTED" } })).toBe(1);

    const approved = await respondToPrBoxRequest(brand.id, request.id, "APPROVED");
    expect(approved.status).toBe("APPROVED");
    expect((await prisma.prBox.findUniqueOrThrow({ where: { id: box.id } })).unitsUsed).toBe(1);
    const order = await prisma.storeOrder.findUniqueOrThrow({ where: { id: approved.orderId! }, include: { items: true } });
    expect(order).toMatchObject({ kind: "SAMPLE", totalCents: 0, status: "PAID", buyerName: "Laura Gómez", shippingCity: "Medellín", billingIdNumber: "1020304050" });
    expect(order.items.map((i) => [i.name, i.quantity, i.unitPriceCents, i.productId])).toEqual([["Caja PR: Caja lanzamiento Navidad", 1, 0, null]]);
    const lauraUser = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: laura.id }, select: { userId: true } });
    const approvedNote = await prisma.notification.findFirstOrThrow({ where: { userId: lauraUser.userId, type: "PR_BOX_APPROVED" } });
    expect(approvedNote.message).toContain("El lanzamiento es el 15 de diciembre");

    // La segunda y última: después ya no sale y nadie más la puede pedir.
    const ana = await createCreator();
    await respondToPrBoxRequest(brand.id, (await requestPrBox(ana.id, box.id, SHIPPING)).id, "APPROVED");
    expect((await listOpenPrBoxes()).some((b) => b.id === box.id)).toBe(false);
    const sofi = await createCreator();
    await expect(requestPrBox(sofi.id, box.id, SHIPPING)).rejects.toThrow("Esta caja ya no se puede pedir.");

    let mine = (await listCreatorPrBoxRequests(laura.id))[0];
    expect(prBoxStage({ status: mine.status, shipped: orderShipped(mine.order) })).toBe("por-enviar");

    await markPrBoxShipped(brand.id, request.id, { carrier: "Servientrega", trackingNumber: "123456" });
    mine = (await listCreatorPrBoxRequests(laura.id))[0];
    expect(mine.order).toMatchObject({ fulfillmentStatus: "SHIPPED", carrier: "Servientrega", trackingNumber: "123456" });
    // Hasta ahí llega: lo que publique no se sigue.
    expect(prBoxStage({ status: mine.status, shipped: orderShipped(mine.order) })).toBe("enviada");
    const lauraSent = await prisma.notification.findFirstOrThrow({ where: { userId: lauraUser.userId, type: "PRODUCT_SENT" } });
    expect(lauraSent.message).toContain('"Caja lanzamiento Navidad" (guía 123456)');

    // Con creadoras aprobadas no se borra, y no se dejan menos unidades que
    // las ya aprobadas.
    await expect(deletePrBox(brand.id, box.id)).rejects.toThrow("ciérrala");
    await expect(updatePrBox(brand.id, box.id, boxInput({ units: 1 }))).rejects.toThrow("Ya aprobaste 2");
    expect((await updatePrBox(brand.id, box.id, boxInput({ units: 5 }))).units).toBe(5);
  });

  it("la marca la propone: una acepta con su dirección, otra no; sin unidades no se aprueba", async () => {
    const brand = await approvedBrand();
    // Solo para invitadas: no sale en el marketplace.
    const box = await createPrBox(brand.id, boxInput({ units: 1, inMarketplace: false, launchOn: "", shipsOn: "" }));
    expect((await listOpenPrBoxes()).some((b) => b.id === box.id)).toBe(false);

    const [sara, vale, outsider, third] = await Promise.all([createCreator(), createCreator(), createCreator(), createCreator()]);
    for (const c of [sara, vale, third]) await link(brand.id, c.id);
    const result = await proposePrBox(brand.id, box.id, [sara.id, vale.id, outsider.id, third.id], "Queremos que la pruebes");
    // Solo a las de su programa: la que no está se salta (primero se invita).
    expect(result).toEqual({ proposed: 3, skipped: 1 });
    expect((await listProposableCreators(brand.id, box.id)).map((c) => c.id).sort()).toEqual([sara.id, vale.id, third.id].sort());

    const found = await listProposableCreators(brand.id, box.id, sara.displayName);
    expect(found.find((c) => c.id === sara.id)).toMatchObject({ requestStatus: "PROPOSED", sales: { count: 0, amount: 0 } });

    const proposal = (await listCreatorPrBoxRequests(sara.id))[0];
    expect(proposal).toMatchObject({ status: "PROPOSED", message: "Queremos que la pruebes" });
    const accepted = await acceptPrBoxProposal(sara.id, proposal.id, SHIPPING);
    expect(accepted.status).toBe("APPROVED");

    const valeProposal = (await listCreatorPrBoxRequests(vale.id))[0];
    await declinePrBoxProposal(vale.id, valeProposal.id);
    expect((await prisma.prBoxRequest.findUniqueOrThrow({ where: { id: valeProposal.id } })).status).toBe("DECLINED");

    // Ya se usó la única: la tercera no alcanza.
    const thirdProposal = (await listCreatorPrBoxRequests(third.id))[0];
    await expect(acceptPrBoxProposal(third.id, thirdProposal.id, SHIPPING)).rejects.toBeInstanceOf(PrBoxError);
    expect((await prisma.prBoxRequest.findUniqueOrThrow({ where: { id: thirdProposal.id } })).status).toBe("PROPOSED");
    expect((await prisma.prBox.findUniqueOrThrow({ where: { id: box.id } })).unitsUsed).toBe(1);
  });

  it("solo desde el marketplace: no se puede proponer", async () => {
    const brand = await approvedBrand();
    const box = await createPrBox(brand.id, boxInput({ units: 3, allowProposals: false }));
    const ana = await createCreator();
    await expect(proposePrBox(brand.id, box.id, [ana.id])).rejects.toThrow("solo para pedir desde el marketplace");
    expect((await listOpenPrBoxes()).some((b) => b.id === box.id)).toBe(true);
  });

  it("un borrador o una caja vencida no salen, y el brief valida las fechas", async () => {
    const brand = await approvedBrand();
    const draft = await createPrBox(brand.id, boxInput({ status: "DRAFT", units: 5 }));
    const late = await createPrBox(brand.id, boxInput({ units: 5, requestUntil: "2026-10-01", shipsOn: "2026-10-05", launchOn: "2026-10-30" }));
    const open = await listOpenPrBoxes(new Date("2026-10-02T12:00:00Z"));
    expect(open.some((b) => b.id === draft.id)).toBe(false);
    expect(open.some((b) => b.id === late.id)).toBe(false);
    // El último día para pedir todavía se puede (hasta la medianoche en Colombia).
    expect((await listOpenPrBoxes(new Date("2026-10-02T04:00:00Z"))).some((b) => b.id === late.id)).toBe(true);

    expect(prBoxInputSchema.safeParse(rawBox()).success).toBe(true);
    // El lanzamiento puede ser antes del envío (ya salió y se la mandan después).
    expect(prBoxInputSchema.safeParse(rawBox({ shipsOn: "2026-11-20", launchOn: "2026-11-10" })).success).toBe(true);
    expect(prBoxInputSchema.safeParse(rawBox({ launchOn: "2026-02-30" })).success).toBe(false);
    expect(prBoxInputSchema.safeParse(rawBox({ inMarketplace: false, allowProposals: false })).success).toBe(false);
    expect(prBoxInputSchema.safeParse(rawBox({ images: ["javascript:alert(1)"] })).success).toBe(false);
  });
});
