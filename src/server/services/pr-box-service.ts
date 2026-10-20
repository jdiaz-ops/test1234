import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { isBrandServiceDeactivated } from "@/server/services/payment-service";
import { updateOrderFulfillment } from "@/server/services/store-order-service";
import { rememberShipping, shippingColumns } from "@/server/services/sample-service";
import { dayIsOver, formatDay, prBoxAcceptsRequests, prBoxStage, type PrBoxInput } from "@/lib/pr-box";
import type { ShippingAddress } from "@/lib/validation/creator";

/// Muestras, antes "Cajas PR" (ver PrBox en el schema y lib/pr-box.ts): la
/// marca arma la muestra (caja PR, swag bag, kit o productos individuales)
/// con su brief; las creadoras la piden desde el marketplace (si la marca
/// la dejó ahí) y la marca aprueba, o la marca se la propone a creadoras
/// puntuales y ellas aceptan. Al aprobar se usa una unidad y se crea un
/// pedido $0 (kind SAMPLE) con la dirección, como los productos del
/// catálogo (sample-service.ts): la marca la
/// envía desde ahí y la creadora recibe la guía. Hasta ahí llega Marcolini:
/// no sigue lo que ella publique (ver PR_BOX_DISCLAIMER; PrBoxRequest.postUrl
/// quedó sin uso). Las unidades nunca salen hacia las creadoras.

export class PrBoxError extends Error {}

const DAY_MS = 24 * 3600 * 1000;
const MAX_PROPOSALS = 50;

/// Una notificación que falla nunca deshace lo que ya pasó.
async function notify(userId: string, type: string, content: Record<string, string>) {
  try {
    await createNotification(userId, type, content);
  } catch (err) {
    console.error(`[cajas-pr] no se pudo avisar (${type}):`, err);
  }
}

/// La marca, como la ven las creadoras: aprobada y no escondida a propósito
/// (lo mismo que las muestras, ver listSampleEligibleProducts).
const VISIBLE_BRAND = { status: "APPROVED", marketplaceVisibilityOverride: { not: "FORCE_HIDDEN" } } satisfies Prisma.BrandProfileWhereInput;

const ORDER_SELECT = { id: true, fulfillmentStatus: true, carrier: true, trackingNumber: true, shippedAt: true } satisfies Prisma.StoreOrderSelect;

export function orderShipped(order: { fulfillmentStatus: string } | null | undefined) {
  return order?.fulfillmentStatus === "SHIPPED" || order?.fulfillmentStatus === "DELIVERED";
}

// ---------------------------------------------------------------- MARCA

export async function listBrandPrBoxes(brandId: string) {
  return prisma.prBox.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    include: {
      requests: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          creator: {
            select: { id: true, displayName: true, photoUrl: true, city: true, socialLinks: { select: { platform: true, handle: true, approxFollowers: true } } },
          },
          order: { select: ORDER_SELECT },
        },
      },
    },
  });
}

export type BrandPrBox = Awaited<ReturnType<typeof listBrandPrBoxes>>[number];

/// Lo que va a la pantalla de la marca (ver PrBoxView en pr-boxes-panel):
/// fechas en texto y en qué va cada creadora. La dirección, solo cuando ya
/// está aprobada.
export function brandPrBoxView(box: BrandPrBox, now = new Date()) {
  return {
    id: box.id,
    name: box.name,
    contents: box.contents,
    images: box.images,
    units: box.units,
    unitsUsed: box.unitsUsed,
    contentBrief: box.contentBrief,
    keyMessages: box.keyMessages,
    requestUntil: box.requestUntil?.toISOString() ?? null,
    shipsOn: box.shipsOn?.toISOString() ?? null,
    launchOn: box.launchOn?.toISOString() ?? null,
    status: box.status,
    inMarketplace: box.inMarketplace,
    allowProposals: box.allowProposals,
    accepting: prBoxAcceptsRequests(box, now),
    requests: box.requests.map((r) => ({
      id: r.id,
      stage: prBoxStage({ status: r.status, shipped: orderShipped(r.order) }),
      initiatedBy: r.initiatedBy,
      message: r.message,
      rejectedReason: r.rejectedReason,
      createdAt: r.createdAt.toISOString(),
      creator: { displayName: r.creator.displayName, photoUrl: r.creator.photoUrl, city: r.creator.city, socials: r.creator.socialLinks },
      shipping:
        r.status === "APPROVED" && r.shippingName && r.shippingPhone && r.shippingCity && r.shippingAddress
          ? {
              name: r.shippingName,
              document: r.shippingDocument,
              email: r.shippingEmail,
              phone: r.shippingPhone,
              region: r.shippingRegion,
              city: r.shippingCity,
              address: r.shippingAddress,
              notes: r.shippingNotes,
            }
          : null,
      order: r.order ? { id: r.order.id, carrier: r.order.carrier, trackingNumber: r.order.trackingNumber, shippedAt: r.order.shippedAt?.toISOString() ?? null } : null,
    })),
  };
}

function boxData(input: PrBoxInput) {
  return {
    name: input.name,
    contents: input.contents,
    images: input.images,
    units: input.units,
    contentBrief: input.contentBrief,
    keyMessages: input.keyMessages,
    requestUntil: input.requestUntil,
    shipsOn: input.shipsOn,
    launchOn: input.launchOn,
    status: input.status,
    inMarketplace: input.inMarketplace,
    allowProposals: input.allowProposals,
  };
}

export async function createPrBox(brandId: string, input: PrBoxInput) {
  return prisma.prBox.create({ data: { brandId, ...boxData(input) } });
}

export async function updatePrBox(brandId: string, boxId: string, input: PrBoxInput) {
  const box = await prisma.prBox.findFirst({ where: { id: boxId, brandId }, select: { id: true, unitsUsed: true } });
  if (!box) throw new PrBoxError("No encontramos esa muestra.");
  if (input.units < box.unitsUsed) throw new PrBoxError(`Ya aprobaste ${box.unitsUsed}: no puedes dejar menos unidades que esas.`);
  // Con la condición, una aprobación que entre al mismo tiempo no queda por
  // encima de las unidades nuevas.
  const updated = await prisma.prBox.updateMany({ where: { id: box.id, unitsUsed: { lte: input.units } }, data: boxData(input) });
  if (updated.count === 0) throw new PrBoxError("Acabas de aprobar más muestras de las que pusiste. Revisa las unidades.");
  return prisma.prBox.findUniqueOrThrow({ where: { id: box.id } });
}

export async function setPrBoxStatus(brandId: string, boxId: string, status: "DRAFT" | "OPEN" | "CLOSED") {
  const updated = await prisma.prBox.updateMany({ where: { id: boxId, brandId }, data: { status } });
  if (updated.count === 0) throw new PrBoxError("No encontramos esa muestra.");
}

/// Solo sin creadoras aprobadas (esas ya tienen su pedido): si no, se cierra.
export async function deletePrBox(brandId: string, boxId: string) {
  const box = await prisma.prBox.findFirst({ where: { id: boxId, brandId }, select: { id: true, unitsUsed: true } });
  if (!box) throw new PrBoxError("No encontramos esa muestra.");
  if (box.unitsUsed > 0) throw new PrBoxError("Esta muestra ya tiene creadoras aprobadas: ciérrala en vez de borrarla.");
  await prisma.prBox.delete({ where: { id: box.id } });
}

/// Aprobar (la marca a una que la pidió, o la creadora al aceptar una
/// propuesta): usa una unidad y crea el pedido $0 con su dirección. Todo o
/// nada, y sin pasarse de las unidades aunque aprueben dos a la vez.
async function approve(requestId: string, from: "REQUESTED" | "PROPOSED") {
  return prisma.$transaction(async (tx) => {
    const request = await tx.prBoxRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { box: { include: { brand: { select: { paymentMode: true } } } }, creator: { include: { user: { select: { email: true } } } } },
    });
    if (!request.shippingName || !request.shippingPhone || !request.shippingAddress || !request.shippingCity) {
      throw new PrBoxError("Faltan los datos de envío.");
    }
    const claimed = await tx.prBox.updateMany({
      where: { id: request.boxId, unitsUsed: { lt: tx.prBox.fields.units } },
      data: { unitsUsed: { increment: 1 } },
    });
    if (claimed.count === 0) throw new PrBoxError("Ya no quedan muestras para regalar. Súbele unidades para aprobar más.");

    const order = await tx.storeOrder.create({
      data: {
        brandId: request.box.brandId,
        kind: "SAMPLE",
        reference: `prbox_${randomUUID()}`,
        buyerName: request.shippingName,
        buyerEmail: request.shippingEmail || request.creator.user.email,
        buyerPhone: request.shippingPhone,
        ...(request.shippingDocument ? { billingIdType: "CC", billingIdNumber: request.shippingDocument } : {}),
        shippingAddress: request.shippingAddress,
        shippingCity: request.shippingCity,
        shippingRegion: request.shippingRegion,
        shippingNotes: request.shippingNotes,
        subtotalCents: 0,
        discountCents: 0,
        shippingCents: 0,
        totalCents: 0,
        paymentMode: request.box.brand.paymentMode,
        status: "PAID",
        paidAt: new Date(),
        internalNotes: `Muestra "${request.box.name}" para ${request.creator.displayName}.`,
        items: {
          create: [{ name: `Muestra: ${request.box.name}`.slice(0, 255), unitPriceCents: 0, quantity: 1, imageUrl: request.box.images[0] ?? null }],
        },
      },
    });

    const moved = await tx.prBoxRequest.updateMany({
      where: { id: request.id, status: from },
      data: { status: "APPROVED", decidedAt: new Date(), orderId: order.id },
    });
    if (moved.count === 0) throw new PrBoxError("Esta solicitud ya cambió. Recarga la página.");
    return tx.prBoxRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}

/// Lo que le cuenta la notificación a la creadora al aprobarla.
function approvedDetail(box: { shipsOn: Date | null; launchOn: Date | null }, now = new Date()) {
  const ship = box.shipsOn && !dayIsOver(box.shipsOn, now) ? `Te la envía el ${formatDay(box.shipsOn)}` : "Pronto te la envía";
  return box.launchOn ? `${ship}. El lanzamiento es el ${formatDay(box.launchOn)}.` : `${ship}.`;
}

export async function respondToPrBoxRequest(brandId: string, requestId: string, decision: "APPROVED" | "REJECTED", reason?: string | null) {
  const request = await prisma.prBoxRequest.findFirst({
    where: { id: requestId, box: { brandId } },
    include: { box: { include: { brand: { select: { companyName: true } } } }, creator: { select: { userId: true } } },
  });
  if (!request) throw new PrBoxError("No encontramos esa solicitud.");
  if (request.status !== "REQUESTED") throw new PrBoxError("Esta solicitud ya fue resuelta.");

  if (decision === "REJECTED") {
    const why = reason?.trim().slice(0, 300) || null;
    const moved = await prisma.prBoxRequest.updateMany({
      where: { id: request.id, status: "REQUESTED" },
      data: { status: "REJECTED", rejectedReason: why, decidedAt: new Date() },
    });
    if (moved.count === 0) throw new PrBoxError("Esta solicitud ya fue resuelta.");
    await notify(request.creator.userId, "PR_BOX_REJECTED", { marca: request.box.brand.companyName, caja: request.box.name, razon: why ? ` Motivo: ${why}` : "" });
    return prisma.prBoxRequest.findUniqueOrThrow({ where: { id: request.id } });
  }

  const updated = await approve(request.id, "REQUESTED");
  await notify(request.creator.userId, "PR_BOX_APPROVED", { marca: request.box.brand.companyName, caja: request.box.name, detalle: approvedDetail(request.box) });
  return updated;
}

/// Las creadoras a las que se la puede proponer: solo las de su programa
/// (pedido del 2026-10-19: "primero se invita al programa; si acepta, ahí sí
/// se habilita para proponer caja PR"), con lo que le han vendido a la marca
/// para elegir sin conocerlas por nombre. Las que más venden, primero.
export async function listProposableCreators(brandId: string, boxId: string, query?: string | null) {
  const q = query?.trim().slice(0, 80) || "";
  const linked = await prisma.creatorOfferEnrollment.findMany({
    where: { status: "ACTIVE", offer: { brandId }, creator: { suspended: false, ...(q ? { displayName: { contains: q, mode: "insensitive" } } : {}) } },
    select: { creatorId: true },
    distinct: ["creatorId"],
    take: 200,
  });
  const ids = linked.map((l) => l.creatorId);
  const [creators, existing, sales] = await Promise.all([
    prisma.creatorProfile.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, photoUrl: true, city: true, socialLinks: { select: { platform: true, handle: true, approxFollowers: true } } },
    }),
    prisma.prBoxRequest.findMany({ where: { boxId, box: { brandId }, creatorId: { in: ids } }, select: { creatorId: true, status: true } }),
    prisma.transaction.groupBy({
      by: ["creatorId"],
      where: { brandId, creatorId: { in: ids }, status: { not: "REFUNDED" } },
      _count: { _all: true },
      _sum: { netAmount: true },
    }),
  ]);
  const statusBy = new Map(existing.map((e) => [e.creatorId, e.status]));
  const salesBy = new Map(sales.map((r) => [r.creatorId, { count: r._count._all, amount: Number(r._sum.netAmount ?? 0) }]));
  return creators
    .map((c) => ({ ...c, requestStatus: statusBy.get(c.id) ?? null, sales: salesBy.get(c.id) ?? { count: 0, amount: 0 } }))
    .sort((a, b) => b.sales.amount - a.sales.amount || a.displayName.localeCompare(b.displayName, "es"));
}

export async function proposePrBox(brandId: string, boxId: string, creatorIds: string[], message?: string | null) {
  const box = await prisma.prBox.findFirst({ where: { id: boxId, brandId }, include: { brand: { select: { companyName: true } } } });
  if (!box) throw new PrBoxError("No encontramos esa muestra.");
  if (box.status !== "OPEN") throw new PrBoxError("Activa la muestra antes de proponerla.");
  if (!box.allowProposals) throw new PrBoxError("Esta muestra es solo para pedir desde el marketplace. Cámbialo en Editar.");
  if (box.unitsUsed >= box.units) throw new PrBoxError("Ya no quedan muestras para regalar. Súbele unidades para proponerla.");
  const ids = [...new Set(creatorIds)].slice(0, MAX_PROPOSALS);
  if (ids.length === 0) throw new PrBoxError("Elige al menos una creadora.");

  const [creators, linked, existing] = await Promise.all([
    prisma.creatorProfile.findMany({ where: { id: { in: ids }, suspended: false }, select: { id: true, userId: true } }),
    prisma.creatorOfferEnrollment.findMany({ where: { creatorId: { in: ids }, status: "ACTIVE", offer: { brandId } }, select: { creatorId: true } }),
    prisma.prBoxRequest.findMany({ where: { boxId: box.id, creatorId: { in: ids } }, select: { creatorId: true } }),
  ]);
  const linkedIds = new Set(linked.map((l) => l.creatorId));
  const taken = new Set(existing.map((e) => e.creatorId));
  // Solo a las de su programa (ver listProposableCreators).
  const chosen = creators.filter((c) => !taken.has(c.id) && linkedIds.has(c.id));
  const note = message?.trim().slice(0, 500) || null;
  await prisma.prBoxRequest.createMany({
    data: chosen.map((c) => ({ boxId: box.id, creatorId: c.id, initiatedBy: "BRAND" as const, status: "PROPOSED" as const, message: note })),
    skipDuplicates: true,
  });
  for (const c of chosen) await notify(c.userId, "PR_BOX_PROPOSED", { marca: box.brand.companyName, caja: box.name });
  return { proposed: chosen.length, skipped: ids.length - chosen.length };
}

/// "Marcar como enviada": el pedido $0 pasa a enviado con su guía (la
/// creadora recibe el correo con el rastreo, igual que un pedido).
export async function markPrBoxShipped(brandId: string, requestId: string, data: { carrier?: string | null; trackingNumber?: string | null }) {
  const request = await prisma.prBoxRequest.findFirst({
    where: { id: requestId, box: { brandId } },
    include: { box: { include: { brand: { select: { companyName: true } } } }, creator: { select: { userId: true } }, order: { select: ORDER_SELECT } },
  });
  if (!request || request.status !== "APPROVED" || !request.orderId) throw new PrBoxError("Esta muestra todavía no está aprobada.");
  const wasShipped = orderShipped(request.order);
  const trackingNumber = data.trackingNumber?.trim().slice(0, 80) || null;
  await updateOrderFulfillment(brandId, { orderId: request.orderId, fulfillmentStatus: "SHIPPED", carrier: data.carrier?.trim().slice(0, 80) || null, trackingNumber });
  if (!wasShipped) {
    await notify(request.creator.userId, "PRODUCT_SENT", {
      marca: request.box.brand.companyName,
      // "Caja lanzamiento Navidad" o "Kit de Navidad" ya dicen qué es.
      descripcion: /^(muestra|caja|kit|swag|box)\b/i.test(request.box.name) ? request.box.name : `Muestra ${request.box.name}`,
      guia: trackingNumber ? ` (guía ${trackingNumber})` : "",
    });
  }
}

// -------------------------------------------------------------- CREADORA

/// Las que se pueden pedir hoy desde el marketplace: activas, con unidades,
/// sin pasarse de la fecha límite y de una marca visible.
export async function listOpenPrBoxes(now = new Date()) {
  const boxes = await prisma.prBox.findMany({
    where: {
      status: "OPEN",
      inMarketplace: true,
      unitsUsed: { lt: prisma.prBox.fields.units },
      OR: [{ requestUntil: null }, { requestUntil: { gt: new Date(now.getTime() - DAY_MS) } }],
      brand: VISIBLE_BRAND,
    },
    include: { brand: { select: { id: true, companyName: true, logoUrl: true, storefrontSlug: true } } },
    orderBy: { createdAt: "desc" },
  });
  const deactivated = await prisma.brandCharge.findMany({
    where: { status: "DEACTIVATED", brandId: { in: [...new Set(boxes.map((b) => b.brandId))] } },
    select: { brandId: true },
  });
  const off = new Set(deactivated.map((d) => d.brandId));
  return boxes.filter((b) => !off.has(b.brandId));
}

export async function listCreatorPrBoxRequests(creatorId: string) {
  return prisma.prBoxRequest.findMany({
    where: { creatorId },
    include: {
      box: { include: { brand: { select: { id: true, companyName: true, logoUrl: true, storefrontSlug: true } } } },
      order: { select: ORDER_SELECT },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function requestPrBox(creatorId: string, boxId: string, shipping: ShippingAddress, message?: string | null) {
  const box = await prisma.prBox.findUnique({
    where: { id: boxId },
    include: { brand: { select: { status: true, marketplaceVisibilityOverride: true, user: { select: { id: true } } } } },
  });
  const existing = box ? await prisma.prBoxRequest.findUnique({ where: { boxId_creatorId: { boxId: box.id, creatorId } } }) : null;
  // Si la marca ya se la había propuesto, pedirla es aceptarla.
  if (existing?.status === "PROPOSED") return acceptPrBoxProposal(creatorId, existing.id, shipping);
  if (existing) throw new PrBoxError("Ya pediste esta muestra.");
  if (
    !box ||
    !box.inMarketplace ||
    !prBoxAcceptsRequests(box) ||
    box.brand.status !== "APPROVED" ||
    box.brand.marketplaceVisibilityOverride === "FORCE_HIDDEN" ||
    (await isBrandServiceDeactivated(box.brandId))
  ) {
    throw new PrBoxError("Esta muestra ya no se puede pedir.");
  }
  const creator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId }, select: { displayName: true, suspended: true } });
  if (creator.suspended) throw new PrBoxError("Tu cuenta está suspendida.");

  try {
    const request = await prisma.prBoxRequest.create({
      data: { boxId: box.id, creatorId, initiatedBy: "CREATOR", status: "REQUESTED", message: message?.trim().slice(0, 500) || null, ...shippingColumns(shipping) },
    });
    await rememberShipping(creatorId, shipping);
    await notify(box.brand.user.id, "PR_BOX_REQUESTED", { creador: creator.displayName, caja: box.name });
    return request;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new PrBoxError("Ya pediste esta muestra.");
    throw err;
  }
}

export async function acceptPrBoxProposal(creatorId: string, requestId: string, shipping: ShippingAddress) {
  const request = await prisma.prBoxRequest.findFirst({
    where: { id: requestId, creatorId },
    include: { box: { include: { brand: { select: { user: { select: { id: true } } } } } }, creator: { select: { displayName: true } } },
  });
  if (!request || request.status !== "PROPOSED") throw new PrBoxError("Esta propuesta ya no está disponible.");
  if (request.box.status !== "OPEN") throw new PrBoxError("La marca ya cerró esta muestra.");
  await prisma.prBoxRequest.update({ where: { id: request.id }, data: shippingColumns(shipping) });
  await rememberShipping(creatorId, shipping);
  const updated = await approve(request.id, "PROPOSED");
  await notify(request.box.brand.user.id, "PR_BOX_ACCEPTED", { creador: request.creator.displayName, caja: request.box.name });
  return updated;
}

export async function declinePrBoxProposal(creatorId: string, requestId: string) {
  const request = await prisma.prBoxRequest.findFirst({
    where: { id: requestId, creatorId },
    include: { box: { include: { brand: { select: { user: { select: { id: true } } } } } }, creator: { select: { displayName: true } } },
  });
  if (!request || request.status !== "PROPOSED") throw new PrBoxError("Esta propuesta ya no está disponible.");
  await prisma.prBoxRequest.update({ where: { id: request.id }, data: { status: "DECLINED", decidedAt: new Date() } });
  await notify(request.box.brand.user.id, "PR_BOX_DECLINED", { creador: request.creator.displayName, caja: request.box.name });
}
