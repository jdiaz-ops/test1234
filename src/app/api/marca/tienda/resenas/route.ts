import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { moderateReviewSchema } from "@/lib/validation/brand";
import { moderateReview, ProductReviewError } from "@/server/services/product-review-service";

/// Publicar, ocultar o borrar una reseña. Ver moderateReview.
export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = moderateReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const review = await moderateReview(profile.id, parsed.data);
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    if (err instanceof ProductReviewError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
