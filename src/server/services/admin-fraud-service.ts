import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";

export async function listFraudFlags() {
  return prisma.fraudFlag.findMany({ orderBy: { createdAt: "desc" } });
}

export async function reviewFraudFlag(flagId: string, status: "CLEARED" | "CONFIRMED_FRAUD") {
  return prisma.fraudFlag.update({
    where: { id: flagId },
    data: { status, reviewedAt: new Date() },
  });
}

/// Único lugar donde nace un FraudFlag — cualquier detector nuevo que se
/// agregue (hoy solo el pico anormal de órdenes en recordOrderFromWebhook,
/// ver attribution-service.ts) pasa por acá para que quede en la cola de
/// Antifraude Y avise al Propietario, sin tener que repetir la notificación
/// en cada detector.
export async function flagPotentialFraud(transactionId: string, reason: string) {
  const flag = await prisma.fraudFlag.create({ data: { transactionId, reason } });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", adminRole: "OWNER" }, select: { id: true } });
  await Promise.all(admins.map((admin) => createNotification(admin.id, "FRAUD_FLAG_ADMIN", { razon: reason })));

  return flag;
}
