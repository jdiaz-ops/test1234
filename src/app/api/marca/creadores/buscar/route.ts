import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { searchCreators } from "@/server/services/creator-directory-service";

export async function GET(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const query = params.get("q") ?? undefined;
  const verticalId = params.get("verticalId") ?? undefined;
  const city = params.get("city") ?? undefined;
  const historyParam = params.get("hasSalesHistory");
  const hasSalesHistory =
    historyParam === "true"
      ? true
      : historyParam === "false"
        ? false
        : undefined;

  const creators = await searchCreators({
    query,
    verticalId,
    city,
    hasSalesHistory,
    excludeBrandId: profile.id,
  });

  // Nunca se manda el CreatorProfile completo — trae datos sensibles
  // (cédula, teléfono, cuenta bancaria) que no le sirven a la marca y no
  // deberían salir de este endpoint.
  return NextResponse.json({
    creators: creators.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      photoUrl: c.photoUrl,
      bio: c.bio,
      city: c.city,
      vertical: c.vertical ? { name: c.vertical.name } : null,
      scoreData: c.scoreData,
    })),
  });
}
