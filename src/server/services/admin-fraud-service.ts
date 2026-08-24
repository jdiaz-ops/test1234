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

/// Único lugar donde nace un FraudFlag — cada detector (pico de órdenes,
/// comprador = creador, descuento que no cuadra, venta manual duplicada,
/// tasa de reembolso anormal, bono de referido sospechoso, cuenta
/// duplicada — ver attribution-service.ts, commission-service.ts y
/// referral-service.ts) pasa por acá para que quede en la cola de
/// Antifraude Y avise al Propietario, sin repetir la notificación en cada
/// uno. `transactionId` es null cuando la señal no viene de una venta
/// puntual (ej. cuentas duplicadas).
export async function flagPotentialFraud(transactionId: string | null, reason: string) {
  const flag = await prisma.fraudFlag.create({ data: { transactionId, reason } });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", adminRole: "OWNER" }, select: { id: true } });
  await Promise.all(admins.map((admin) => createNotification(admin.id, "FRAUD_FLAG_ADMIN", { razon: reason })));

  return flag;
}
