import { prisma } from "@/lib/prisma";
import { needsIntegration, normalizeGatewayName } from "@/lib/payment-gateways";
import { createNotification } from "@/server/services/notification-service";

/// Una marca cobra con una pasarela que Marcolini no tiene: se guarda
/// (una vez por marca y pasarela) y se le avisa al Propietario, por la
/// app y por correo, para construir la integración. Llega desde
/// "Duplicar tienda" (pasarelas detectadas en la tienda anterior) y desde
/// Pagos (la marca la pide). Ver conversación del 2026-10-18.

export type GatewayRequestSource = "DUPLICAR" | "MARCA";

const SOURCE_LABEL: Record<GatewayRequestSource, string> = {
  DUPLICAR: "detectada al duplicar su tienda",
  MARCA: "la marca la pidió en Pagos",
};

export async function recordGatewayRequests(
  brandId: string,
  gateways: string[],
  source: GatewayRequestSource,
  note?: string | null,
) {
  const names = Array.from(new Set(gateways.map(normalizeGatewayName).filter((n): n is string => Boolean(n) && needsIntegration(n!))));
  const recorded: string[] = [];
  const notified: string[] = [];
  if (names.length === 0) return { recorded, notified };

  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId }, select: { companyName: true } });
  const existing = new Set(
    (await prisma.paymentGatewayRequest.findMany({ where: { brandId, gateway: { in: names } }, select: { gateway: true } })).map((r) => r.gateway),
  );
  for (const gateway of names) {
    recorded.push(gateway);
    if (existing.has(gateway)) continue;
    await prisma.paymentGatewayRequest.create({ data: { brandId, gateway, source, note: note?.trim().slice(0, 300) || null } });
    notified.push(gateway);
  }
  if (notified.length > 0) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", adminRole: "OWNER" }, select: { id: true } });
    for (const gateway of notified) {
      await Promise.all(
        admins.map((admin) =>
          createNotification(admin.id, "PAYMENT_GATEWAY_REQUEST_ADMIN", {
            marca: brand.companyName,
            pasarela: gateway,
            fuente: SOURCE_LABEL[source],
          }),
        ),
      );
    }
  }
  return { recorded, notified };
}

/// Una pasarela que una marca pidió (o se le detectó) y que ya quedó
/// integrada: se le avisa a la marca, una sola vez, que ya puede cobrar
/// con ella. Corre en el cron diario (ver pagos-diarios). Devuelve
/// cuántas marcas avisó.
export async function notifyGatewayReady() {
  const pending = await prisma.paymentGatewayRequest.findMany({
    where: { notifiedReadyAt: null },
    include: { brand: { select: { userId: true } } },
  });
  let notified = 0;
  for (const request of pending) {
    if (needsIntegration(request.gateway)) continue;
    await createNotification(request.brand.userId, "PAYMENT_GATEWAY_READY", {
      pasarela: normalizeGatewayName(request.gateway) ?? request.gateway,
    });
    await prisma.paymentGatewayRequest.update({ where: { id: request.id }, data: { notifiedReadyAt: new Date() } });
    notified++;
  }
  return notified;
}

export async function listGatewayRequests(brandId: string) {
  return prisma.paymentGatewayRequest.findMany({ where: { brandId }, orderBy: { createdAt: "asc" } });
}

export async function removeGatewayRequest(brandId: string, gateway: string) {
  const name = normalizeGatewayName(gateway);
  if (!name) return false;
  const r = await prisma.paymentGatewayRequest.deleteMany({ where: { brandId, gateway: name } });
  return r.count > 0;
}
