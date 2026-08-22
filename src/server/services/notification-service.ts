import { prisma } from "@/lib/prisma";
import { sendPushForUser } from "@/server/services/push-service";

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/// Para la burbuja de notificaciones pendientes en el menú lateral.
export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

/// El único punto donde nace una notificación en toda la plataforma — por
/// eso es también el único lugar donde hace falta enganchar el push
/// (ver push-service.ts): todo lo que ya llama a esta función (retos,
/// pagos, aprobaciones, comunicados...) se vuelve push automáticamente el
/// día que exista la app móvil, sin tener que tocar nada de eso.
export async function createNotification(userId: string, type: string, message: string) {
  const notification = await prisma.notification.create({ data: { userId, type, message } });
  await sendPushForUser(userId, "Marcolini", message);
  return notification;
}
