import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { listProductsForCreator, listProductFiltersForCreator } from "@/server/services/product-service";

/// Usado por el buscador del editor de colecciones — trae los productos
/// disponibles de las marcas a las que el creador está unido (filtrables
/// por texto, marca y categoría, los destacados por cada marca primero —
/// ver listProductsForCreator) y las opciones disponibles para los
/// filtros.
export async function GET(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const search = params.get("q") ?? undefined;
  const brandId = params.get("marca") ?? undefined;
  const category = params.get("categoria") ?? undefined;

  const [products, filterOptions] = await Promise.all([
    listProductsForCreator(profile.id, { search, brandId, category }),
    listProductFiltersForCreator(profile.id),
  ]);

  return NextResponse.json({ products, filterOptions });
}
