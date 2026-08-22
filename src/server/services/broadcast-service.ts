import { prisma } from "@/lib/prisma";
import { sendBroadcastEmail } from "@/lib/email";
import { createNotification } from "@/server/services/notification-service";

export class BroadcastError extends Error {}

type Channel = "EMAIL" | "NOTIFICATION";

async function getRecipients(audience: "BRANDS" | "CREATORS") {
  if (audience === "BRANDS") {
    const brands = await prisma.brandProfile.findMany({
      where: { status: "APPROVED" },
      include: { user: true },
    });
    return brands.map((b) => ({ userId: b.userId, email: b.user.email }));
  }

  const creators = await prisma.creatorProfile.findMany({
    where: { suspended: false },
    include: { user: true },
  });
  return creators.map((c) => ({ userId: c.userId, email: c.user.email }));
}

/// Manda un comunicado a todas las marcas aprobadas o a todos los
/// creadores activos — por correo, por notificación dentro de la
/// plataforma (que ya queda lista para volverse push sola, ver
/// push-service.ts), o ambos. Queda un registro en Broadcast para poder
/// ver después qué se mandó y a cuántos llegó.
export async function sendBroadcast(params: {
  audience: "BRANDS" | "CREATORS";
  channels: Channel[];
  subject: string;
  body: string;
  sentByUserId: string;
}) {
  const recipients = await getRecipients(params.audience);
  if (recipients.length === 0) {
    throw new BroadcastError(
      params.audience === "BRANDS" ? "No hay marcas aprobadas todavía." : "No hay creadores activos todavía."
    );
  }

  for (const r of recipients) {
    if (params.channels.includes("EMAIL")) {
      await sendBroadcastEmail(r.email, params.subject, params.body);
    }
    if (params.channels.includes("NOTIFICATION")) {
      await createNotification(r.userId, "broadcast", `${params.subject}: ${params.body}`);
    }
  }

  // Un registro por canal, para que el historial sea claro (ej. "se mandó
  // por correo Y por notificación" queda como dos filas, no una ambigua).
  const created = [];
  for (const channel of params.channels) {
    created.push(
      await prisma.broadcast.create({
        data: {
          audience: params.audience,
          channel,
          subject: params.subject,
          body: params.body,
          recipientCount: recipients.length,
          sentByUserId: params.sentByUserId,
        },
      })
    );
  }

  return { recipientCount: recipients.length, broadcasts: created };
}

export async function listBroadcasts() {
  return prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
