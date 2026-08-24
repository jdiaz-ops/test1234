import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { listProductsForCreator, listSuggestedProductsForCreator } from "@/server/services/product-service";

/// Usado por el buscador del editor de colecciones — trae los productos
/// disponibles de las marcas a las que el creador está unido, más una
/// franja aparte con los que cada marca destacó (ver
/// listSuggestedProductsForCreator).
export async function GET(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const search = new URL(req.url).searchParams.get("q") ?? undefined;

  const [products, suggested] = await Promise.all([
    listProductsForCreator(profile.id, search),
    listSuggestedProductsForCreator(profile.id),
  ]);

  return NextResponse.json({ products, suggested });
}
