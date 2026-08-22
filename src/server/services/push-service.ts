import { prisma } from "@/lib/prisma";

/// Hoy no existe la app móvil, así que DeviceToken siempre está vacío y
/// esto no manda nada de verdad — pero queda enganchado al mismo punto
/// donde nace cada Notification. El día que exista la app y registre
/// tokens acá (ver DeviceToken en el schema), este mismo código empieza a
/// mandar push de verdad sin tocar nada del resto de la plataforma —
/// broadcasts, aprobaciones, ventas, todo lo que ya usa createNotification
/// se vuelve push automáticamente.
export async function sendPushForUser(userId: string, title: string, body: string) {
  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return; // sin app móvil todavía — no-op

  // TODO (cuando exista la app): llamar aquí al proveedor real de push
  // (FCM/APNs vía Expo, por ejemplo), una vez por token.
  console.log(`[push] (pendiente de app móvil) ${tokens.length} dispositivo(s) de ${userId}: ${title} — ${body}`);
}
