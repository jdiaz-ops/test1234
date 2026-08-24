import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import {
  listProductsForCreator,
  listSuggestedProductsForCreator,
  listProductFiltersForCreator,
} from "@/server/services/product-service";

/// Usado por el buscador del editor de colecciones — trae los productos
/// disponibles de las marcas a las que el creador está unido (filtrables
/// por texto, marca y categoría), más una franja aparte con los que cada
/// marca destacó, y las opciones disponibles para los filtros.
export async function GET(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const search = params.get("q") ?? undefined;
  const brandId = params.get("marca") ?? undefined;
  const category = params.get("categoria") ?? undefined;

  const [products, suggested, filterOptions] = await Promise.all([
    listProductsForCreator(profile.id, { search, brandId, category }),
    listSuggestedProductsForCreator(profile.id),
    listProductFiltersForCreator(profile.id),
  ]);

  return NextResponse.json({ products, suggested, filterOptions });
}
