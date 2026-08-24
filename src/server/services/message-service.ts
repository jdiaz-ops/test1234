import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";

export class MessageError extends Error {}

/// La regla de negocio central de este motor: nunca hay mensajería fuera de
/// una inscripción ACTIVA — nada de que una marca le escriba a un creador
/// que todavía no aceptó, ni que siga hablando con uno que ya removió.
async function assertActiveEnrollment(enrollmentId: string) {
  const enrollment = await prisma.creatorOfferEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { creator: true, offer: { include: { brand: true } } },
  });
  if (!enrollment) throw new MessageError("Inscripción no encontrada.");
  if (enrollment.status !== "ACTIVE") {
    throw new MessageError("Solo puedes escribirle a un creador/marca actualmente vinculado.");
  }
  return enrollment;
}

async function getOrCreateConversation(enrollmentId: string, creatorId: string) {
  const existing = await prisma.conversation.findUnique({ where: { enrollmentId } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { enrollmentId, creatorId } });
}

/// Lista de "chats" del creador — una fila por cada marca a la que está
/// vinculado ACTIVAMENTE, con el último mensaje si ya existe conversación
/// (todavía puede no existir si nadie ha escrito primero).
export async function listThreadsForCreator(creatorId: string) {
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { creatorId, status: "ACTIVE" },
    include: {
      offer: { include: { brand: true } },
      conversations: { include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } },
    },
    orderBy: { joinedAt: "desc" },
  });

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    brandName: e.offer.brand.companyName,
    lastMessage: e.conversations[0]?.messages[0] ?? null,
  }));
}

export async function listThreadsForBrand(brandId: string) {
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { offer: { brandId }, status: "ACTIVE" },
    include: {
      creator: true,
      offer: true,
      conversations: { include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } },
    },
    orderBy: { joinedAt: "desc" },
  });

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    creatorName: e.creator.displayName,
    offerName: e.offer.name,
    lastMessage: e.conversations[0]?.messages[0] ?? null,
  }));
}

/// El hilo completo de una inscripción — validado contra quién lo pide
/// (userId de la sesión) para que nadie vea conversaciones ajenas.
export async function getThread(enrollmentId: string, viewerUserId: string) {
  const enrollment = await prisma.creatorOfferEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { creator: true, offer: { include: { brand: true } } },
  });
  if (!enrollment) throw new MessageError("Inscripción no encontrada.");

  const isCreator = enrollment.creator.userId === viewerUserId;
  const isBrand = enrollment.offer.brand.userId === viewerUserId;
  if (!isCreator && !isBrand) throw new MessageError("No autorizado.");

  const conversation = await prisma.conversation.findUnique({
    where: { enrollmentId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return { enrollment, messages: conversation?.messages ?? [] };
}

export async function sendMessage(params: { enrollmentId: string; senderUserId: string; body: string }) {
  const enrollment = await assertActiveEnrollment(params.enrollmentId);

  const isCreator = enrollment.creator.userId === params.senderUserId;
  const isBrand = enrollment.offer.brand.userId === params.senderUserId;
  if (!isCreator && !isBrand) throw new MessageError("No autorizado.");

  const conversation = await getOrCreateConversation(params.enrollmentId, enrollment.creatorId);
  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderUserId: params.senderUserId, body: params.body },
  });

  const isFromCreator = enrollment.creator.userId === params.senderUserId;
  const preview = params.body.slice(0, 80);
  if (isFromCreator) {
    await createNotification(enrollment.offer.brand.userId, "NEW_MESSAGE_BRAND", {
      creador: enrollment.creator.displayName,
      mensaje: preview,
    });
  } else {
    await createNotification(enrollment.creator.userId, "NEW_MESSAGE_CREATOR", {
      marca: enrollment.offer.brand.companyName,
      mensaje: preview,
    });
  }

  return message;
}
