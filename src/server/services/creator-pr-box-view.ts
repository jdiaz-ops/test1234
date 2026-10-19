import { prisma } from "@/lib/prisma";
import { brandLogoSrc } from "@/lib/logo-src";
import { prBoxStage } from "@/lib/pr-box";
import { listCreatorPrBoxRequests, listOpenPrBoxes, orderShipped } from "@/server/services/pr-box-service";
import type { CreatorPrBox, CreatorPrBoxRequest } from "@/components/portal/creator-pr-boxes-panel";

type BoxRow = Awaited<ReturnType<typeof listOpenPrBoxes>>[number];

/// Las muestras (antes "Cajas PR", ver pr-box-service.ts) como las ve la
/// creadora: las que todavía puede pedir y las suyas, con en qué va cada
/// una y su código con cada marca para recordárselo en el brief. Lo usan
/// Marketplace → Muestras y Solicitar muestras (pedido del 2026-10-19: "ya
/// no son PR sino muestras").
export async function creatorPrBoxesView(creatorId: string) {
  const [openBoxes, requests, enrollments] = await Promise.all([
    listOpenPrBoxes(),
    listCreatorPrBoxRequests(creatorId),
    prisma.creatorOfferEnrollment.findMany({
      where: { creatorId, status: "ACTIVE" },
      select: { discountCode: true, offer: { select: { brandId: true } } },
    }),
  ]);
  const codeByBrand = new Map(enrollments.map((e) => [e.offer.brandId, e.discountCode]));
  function boxView(box: BoxRow): CreatorPrBox {
    return {
      id: box.id,
      name: box.name,
      contents: box.contents,
      images: box.images,
      contentBrief: box.contentBrief,
      keyMessages: box.keyMessages,
      requestUntil: box.requestUntil?.toISOString() ?? null,
      shipsOn: box.shipsOn?.toISOString() ?? null,
      launchOn: box.launchOn?.toISOString() ?? null,
      brand: { name: box.brand.companyName, logoSrc: brandLogoSrc(box.brand) },
      code: codeByBrand.get(box.brandId) ?? null,
    };
  }
  const requestedBoxIds = new Set(requests.map((r) => r.boxId));
  return {
    boxes: openBoxes.filter((b) => !requestedBoxIds.has(b.id)).map(boxView),
    requests: requests.map(
      (r): CreatorPrBoxRequest => ({
        id: r.id,
        stage: prBoxStage({ status: r.status, shipped: orderShipped(r.order) }),
        message: r.message,
        rejectedReason: r.rejectedReason,
        order: r.order ? { carrier: r.order.carrier, trackingNumber: r.order.trackingNumber, shippedAt: r.order.shippedAt?.toISOString() ?? null } : null,
        box: boxView(r.box),
      }),
    ),
  };
}
