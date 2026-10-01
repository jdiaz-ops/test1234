import { NextResponse } from "next/server";
import { limitOrReject } from "@/lib/rate-limit";
import { REVIEWS_ENABLED } from "@/lib/features";
import { submitReviewSchema } from "@/lib/validation/storefront";
import {
  submitProductReview,
  ProductReviewError,
} from "@/server/services/product-review-service";

/// Un comprador deja su reseña desde la ficha del producto. Ver
/// submitProductReview.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Reseñas apagadas (ver src/lib/features.ts).
  if (!REVIEWS_ENABLED) return NextResponse.json({ error: "No disponible" }, { status: 404 });

  // 10 reseñas por hora por IP. Ver src/lib/rate-limit.ts.
  const limited = await limitOrReject(req, "resena", 10, 3600);
  if (limited) return limited;

  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const parsed = submitReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await submitProductReview(slug, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProductReviewError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[resenas] no se pudo guardar", err);
    return NextResponse.json({ error: "No se pudo enviar tu reseña. Intenta de nuevo." }, { status: 500 });
  }
}
