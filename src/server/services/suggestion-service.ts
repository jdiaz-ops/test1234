import { prisma } from "@/lib/prisma";
import { uploadAudio } from "@/lib/file-upload";
import { formatAudioLength, type SuggestionInput, type SuggestionStatusId } from "@/lib/suggestions";
import { createNotification } from "@/server/services/notification-service";

export class SuggestionError extends Error {}

/// Buzón de sugerencias del portal (pedido del 2026-10-19: "que puedan
/// enviar un mensaje o nota de voz… para yo saber"). Guarda el mensaje y/o
/// la nota de voz y le avisa al admin (tipo SUGGESTION_ADMIN, a los
/// Propietarios, como los demás avisos de admin).
export async function createSuggestion(input: SuggestionInput & {
  userId: string;
  portal: "BRAND" | "CREATOR";
  audio?: File | null;
  userAgent?: string | null;
  sentByAdmin?: boolean;
}) {
  const audio = input.audio && input.audio.size > 0 ? input.audio : null;
  if (!input.message && !audio) throw new SuggestionError("Escribe un mensaje o graba una nota de voz.");

  const audioUrl = audio ? await uploadAudio(audio, "sugerencias") : null;
  const suggestion = await prisma.suggestion.create({
    data: {
      userId: input.userId,
      portal: input.portal,
      kind: input.kind ?? null,
      message: input.message ?? null,
      audioUrl,
      audioSeconds: audioUrl ? (input.audioSeconds ?? null) : null,
      pagePath: input.pagePath ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      sentByAdmin: input.sentByAdmin ?? false,
    },
  });

  // El aviso no puede tumbar el envío: la sugerencia ya quedó guardada.
  try {
    await notifyAdmins(suggestion.id);
  } catch (err) {
    console.error("[sugerencias] No se pudo avisar al admin:", err);
  }
  return suggestion;
}

async function notifyAdmins(suggestionId: string) {
  const s = await prisma.suggestion.findUniqueOrThrow({
    where: { id: suggestionId },
    include: { user: { select: { brandProfile: { select: { companyName: true } }, creatorProfile: { select: { displayName: true } } } } },
  });
  const excerpt = s.message ? `“${s.message.length > 140 ? `${s.message.slice(0, 139)}…` : s.message}”` : "";
  const voice = s.audioUrl ? `una nota de voz${s.audioSeconds ? ` (${formatAudioLength(s.audioSeconds)})` : ""}` : "";
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", adminRole: "OWNER" }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      createNotification(admin.id, "SUGGESTION_ADMIN", {
        remitente: senderName(s),
        portal: s.portal === "BRAND" ? "marca" : "creadora",
        resumen: `${[excerpt, voice].filter(Boolean).join(" y ")}.`,
      }),
    ),
  );
}

type Sender = {
  portal: "BRAND" | "CREATOR";
  user: { brandProfile: { companyName: string } | null; creatorProfile: { displayName: string } | null };
};

export function senderName(s: Sender) {
  return (s.portal === "BRAND" ? s.user.brandProfile?.companyName : s.user.creatorProfile?.displayName) ?? "Alguien";
}

/// Lo que esa persona ya mandó desde ese portal, para "Lo que nos has
/// enviado" (con el estado: enviada, leída, resuelta).
export function listMySuggestions(userId: string, portal: "BRAND" | "CREATOR") {
  return prisma.suggestion.findMany({
    where: { userId, portal },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, kind: true, message: true, audioUrl: true, audioSeconds: true, status: true, createdAt: true },
  });
}

/// Admin → Sugerencias: las más nuevas primero; `status` null = todas.
export function listSuggestionsForAdmin(status: SuggestionStatusId | null) {
  return prisma.suggestion.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: {
        select: {
          email: true,
          brandProfile: { select: { companyName: true, storefrontSlug: true } },
          creatorProfile: { select: { displayName: true } },
        },
      },
    },
  });
}

export async function countSuggestionsByStatus() {
  const rows = await prisma.suggestion.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: Record<SuggestionStatusId, number> = { NEW: 0, READ: 0, DONE: 0 };
  for (const r of rows) counts[r.status] = r._count._all;
  return counts;
}

export function countNewSuggestions() {
  return prisma.suggestion.count({ where: { status: "NEW" } });
}

export async function setSuggestionStatus(id: string, status: SuggestionStatusId) {
  const updated = await prisma.suggestion.updateMany({ where: { id }, data: { status } });
  if (updated.count === 0) throw new SuggestionError("Esa sugerencia ya no existe.");
}
