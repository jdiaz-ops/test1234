import { prisma } from "@/lib/prisma";
import { sendPushForUser } from "@/server/services/push-service";
import { sendGenericNotificationEmail } from "@/lib/email";

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    // PENDING_REVIEW (tipo en modo Manual, esperando que un admin la
    // apruebe) y DISCARDED nunca se muestran en la bandeja normal de nadie
    // — solo las que realmente se mandaron.
    where: { userId, status: "SENT" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/// Para la burbuja de notificaciones pendientes en el menú lateral.
export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, read: false, status: "SENT" } });
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

function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/// El único punto donde nace una notificación en toda la plataforma — por
/// eso es también el único lugar donde hace falta enganchar el push y leer
/// el catálogo editable de Admin → Notificaciones (NotificationTypeConfig):
/// todo lo que llama a esta función respeta solo, sin tener que tocar nada
/// del lado que la dispara, si el tipo está activo, si es automático o
/// manual, y por qué canales sale.
///
/// `content` puede ser:
///  - un objeto de variables → se combina con el texto editable guardado en
///    NotificationTypeConfig.messageTemplate (ej. {marca}, {monto}).
///  - un string ya armado → se usa tal cual (para "broadcast", donde el
///    admin escribe el texto en el momento, y como red de seguridad si
///    algún tipo nuevo todavía no tiene fila en el catálogo).
///
/// `sendBespokeEmail`, si se pasa, es el correo con diseño propio que ya
/// existía para ese tipo (ej. sendBadgeEarnedEmail) — se usa en vez del
/// correo genérico, pero SOLO si el tipo es automático; en modo Manual, al
/// aprobar se manda siempre el correo genérico (no se pueden guardar
/// funciones en la base de datos para usarlas después).
export async function createNotification(
  userId: string,
  type: string,
  content: string | Record<string, string | number>,
  sendBespokeEmail?: () => Promise<void>
) {
  const config = await prisma.notificationTypeConfig.findUnique({ where: { key: type } });
  if (config && !config.enabled) return null;

  const message =
    typeof content === "string"
      ? content
      : interpolate(config?.messageTemplate ?? "", content);

  const mode = config?.mode ?? "AUTOMATIC";
  const notification = await prisma.notification.create({
    data: { userId, type, message, status: mode === "MANUAL" ? "PENDING_REVIEW" : "SENT" },
  });

  if (mode === "AUTOMATIC") {
    await deliverNotification(notification, config, sendBespokeEmail);
  }

  return notification;
}

async function deliverNotification(
  notification: { id: string; userId: string; message: string },
  config: { channelApp: boolean; channelEmail: boolean } | null,
  sendBespokeEmail?: () => Promise<void>
) {
  const wantsApp = config?.channelApp ?? true;
  const wantsEmail = config?.channelEmail ?? false;

  if (wantsApp) await sendPushForUser(notification.userId, "Marcolini", notification.message);

  if (wantsEmail) {
    if (sendBespokeEmail) {
      await sendBespokeEmail();
    } else {
      const user = await prisma.user.findUnique({ where: { id: notification.userId }, select: { email: true } });
      if (user) await sendGenericNotificationEmail(user.email, notification.message);
    }
  }
}

// ----------------------------------------------------------------------------
// Catálogo de tipos de notificación (Admin → Notificaciones → Configuración)
// ----------------------------------------------------------------------------

export async function listNotificationTypeConfigs() {
  return prisma.notificationTypeConfig.findMany({
    orderBy: [{ audience: "asc" }, { label: "asc" }],
  });
}

export async function updateNotificationTypeConfig(
  key: string,
  data: Partial<{
    enabled: boolean;
    mode: "AUTOMATIC" | "MANUAL";
    channelApp: boolean;
    channelEmail: boolean;
    messageTemplate: string;
  }>
) {
  return prisma.notificationTypeConfig.update({ where: { key }, data });
}

// ----------------------------------------------------------------------------
// Bandeja de aprobación manual (tipos en modo Manual)
// ----------------------------------------------------------------------------

export async function listPendingReviewNotifications() {
  return prisma.notification.findMany({
    where: { status: "PENDING_REVIEW" },
    include: { user: { select: { email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function approveNotification(notificationId: string) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.status !== "PENDING_REVIEW") return null;

  const config = await prisma.notificationTypeConfig.findUnique({ where: { key: notification.type } });

  await prisma.notification.update({ where: { id: notification.id }, data: { status: "SENT" } });
  await deliverNotification(notification, config);
  return notification;
}

export async function discardNotification(notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, status: "PENDING_REVIEW" },
    data: { status: "DISCARDED" },
  });
}
