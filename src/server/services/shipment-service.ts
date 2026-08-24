import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";

export class ShipmentError extends Error {}

async function getEnrollmentWithParties(enrollmentId: string) {
  const enrollment = await prisma.creatorOfferEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { creator: true, offer: { include: { brand: true } } },
  });
  if (!enrollment) throw new ShipmentError("Inscripción no encontrada.");
  if (enrollment.status !== "ACTIVE") {
    throw new ShipmentError("Solo se puede pedir/enviar producto a un creador actualmente vinculado.");
  }
  return enrollment;
}

/// El creador pide un producto — la marca decide después si lo despacha.
export async function requestProduct(params: {
  enrollmentId: string;
  creatorUserId: string;
  description: string;
  shippingAddress: string;
}) {
  const enrollment = await getEnrollmentWithParties(params.enrollmentId);
  if (enrollment.creator.userId !== params.creatorUserId) throw new ShipmentError("No autorizado.");

  const shipment = await prisma.productShipment.create({
    data: {
      enrollmentId: params.enrollmentId,
      requestedBy: "CREATOR",
      description: params.description,
      shippingAddress: params.shippingAddress,
      status: "REQUESTED",
    },
  });

  await createNotification(enrollment.offer.brand.userId, "PRODUCT_REQUESTED", {
    creador: enrollment.creator.displayName,
    descripcion: params.description,
  });

  return shipment;
}

/// La marca despacha un producto directamente (sin que el creador lo haya
/// pedido primero) — nace ya como SENT.
export async function brandSendProduct(params: {
  enrollmentId: string;
  brandUserId: string;
  description: string;
  shippingAddress: string;
  carrier?: string;
  trackingNumber?: string;
}) {
  const enrollment = await getEnrollmentWithParties(params.enrollmentId);
  if (enrollment.offer.brand.userId !== params.brandUserId) throw new ShipmentError("No autorizado.");

  const shipment = await prisma.productShipment.create({
    data: {
      enrollmentId: params.enrollmentId,
      requestedBy: "BRAND",
      description: params.description,
      shippingAddress: params.shippingAddress,
      status: "SENT",
      carrier: params.carrier || null,
      trackingNumber: params.trackingNumber || null,
      sentAt: new Date(),
    },
  });

  await createNotification(enrollment.creator.userId, "PRODUCT_SENT", {
    marca: enrollment.offer.brand.companyName,
    descripcion: params.description,
    guia: params.trackingNumber ? ` (guía ${params.trackingNumber})` : "",
  });

  return shipment;
}

/// La marca despacha algo que el creador ya había pedido.
export async function markShipmentSent(params: {
  shipmentId: string;
  brandUserId: string;
  carrier?: string;
  trackingNumber?: string;
}) {
  const shipment = await prisma.productShipment.findUnique({
    where: { id: params.shipmentId },
    include: { enrollment: { include: { creator: true, offer: { include: { brand: true } } } } },
  });
  if (!shipment) throw new ShipmentError("Envío no encontrado.");
  if (shipment.enrollment.offer.brand.userId !== params.brandUserId) throw new ShipmentError("No autorizado.");
  if (shipment.status !== "REQUESTED") throw new ShipmentError("Este envío ya no está pendiente de despacho.");

  const updated = await prisma.productShipment.update({
    where: { id: shipment.id },
    data: { status: "SENT", carrier: params.carrier || null, trackingNumber: params.trackingNumber || null, sentAt: new Date() },
  });

  await createNotification(shipment.enrollment.creator.userId, "PRODUCT_SENT", {
    marca: shipment.enrollment.offer.brand.companyName,
    descripcion: shipment.description,
    guia: params.trackingNumber ? ` (guía ${params.trackingNumber})` : "",
  });

  return updated;
}

/// Cualquiera de las dos partes puede confirmar que ya llegó.
export async function markShipmentDelivered(shipmentId: string, viewerUserId: string) {
  const shipment = await prisma.productShipment.findUnique({
    where: { id: shipmentId },
    include: { enrollment: { include: { creator: true, offer: { include: { brand: true } } } } },
  });
  if (!shipment) throw new ShipmentError("Envío no encontrado.");

  const isCreator = shipment.enrollment.creator.userId === viewerUserId;
  const isBrand = shipment.enrollment.offer.brand.userId === viewerUserId;
  if (!isCreator && !isBrand) throw new ShipmentError("No autorizado.");
  if (shipment.status !== "SENT") throw new ShipmentError("Este envío todavía no se ha despachado.");

  return prisma.productShipment.update({
    where: { id: shipment.id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
}

export async function listShipmentsForEnrollment(enrollmentId: string) {
  return prisma.productShipment.findMany({
    where: { enrollmentId },
    orderBy: { createdAt: "desc" },
  });
}
