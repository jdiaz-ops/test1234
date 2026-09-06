import { prisma } from "@/lib/prisma";
import { computeCreatorScores } from "@/server/services/creator-score-service";

export type CreatorDirectoryFilters = {
  query?: string;
  verticalId?: string;
  city?: string;
  /// true = solo con historial de ventas, false = solo nuevos (sin
  /// historial), undefined = todos.
  hasSalesHistory?: boolean;
  /// No mostrar creadores ya vinculados (o con solicitud pendiente) a esta
  /// marca — para no ofrecerle a alguien con quien ya trabaja.
  excludeBrandId?: string;
};

/// Buscador de creadores para que la marca "reclute" en vez de solo
/// esperar a que el creador la encuentre — ver conversación del
/// 2026-09-06. Solo entran los que activaron "Modo Descubrible"
/// (discoverable) y no están suspendidos; se les calcula el Creator Score
/// en batch (una sola pasada, no una consulta por creador) y se ordena por
/// score descendente, dejando los "nuevos sin historial" al final.
export async function searchCreators(filters: CreatorDirectoryFilters) {
  const creators = await prisma.creatorProfile.findMany({
    where: {
      discoverable: true,
      suspended: false,
      ...(filters.verticalId ? { verticalId: filters.verticalId } : {}),
      ...(filters.city
        ? { city: { contains: filters.city, mode: "insensitive" } }
        : {}),
      ...(filters.query
        ? { displayName: { contains: filters.query, mode: "insensitive" } }
        : {}),
    },
    include: { vertical: true },
    orderBy: { createdAt: "desc" },
  });

  let excludedIds = new Set<string>();
  if (filters.excludeBrandId) {
    const linked = await prisma.creatorOfferEnrollment.findMany({
      where: {
        offer: { brandId: filters.excludeBrandId },
        status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
      },
      select: { creatorId: true },
    });
    excludedIds = new Set(linked.map((l) => l.creatorId));
  }

  const eligible = creators.filter((c) => !excludedIds.has(c.id));
  const scores = await computeCreatorScores(eligible.map((c) => c.id));

  let result = eligible.map((c) => ({
    ...c,
    scoreData: scores.get(c.id)!,
  }));

  if (filters.hasSalesHistory === true) {
    result = result.filter((c) => c.scoreData.score !== null);
  } else if (filters.hasSalesHistory === false) {
    result = result.filter((c) => c.scoreData.score === null);
  }

  result.sort((a, b) => {
    if (a.scoreData.score === null && b.scoreData.score === null) return 0;
    if (a.scoreData.score === null) return 1;
    if (b.scoreData.score === null) return -1;
    return b.scoreData.score - a.scoreData.score;
  });

  return result;
}
