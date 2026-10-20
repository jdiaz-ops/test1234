import { notFound, redirect } from "next/navigation";
import { REVIEWS_ENABLED } from "@/lib/features";
import { requireBrandProfile } from "@/lib/current-brand";
import { listBrandReviews } from "@/server/services/product-review-service";
import { StoreReviewsPanel } from "@/components/portal/store-reviews-panel";
import { StoreShell } from "@/components/portal/store-shell";

export default async function TiendaResenasPage() {
  // Reseñas apagadas (ver src/lib/features.ts).
  if (!REVIEWS_ENABLED) notFound();
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const reviews = await listBrandReviews(profile.id);

  return (
    <StoreShell active="resenas">
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Opiniones de quienes compraron tus productos. Ninguna se publica hasta que la apruebes.
      </p>
      <StoreReviewsPanel
        initialReviews={reviews.map((r) => ({
          id: r.id,
          productName: r.product.name,
          productImageUrl: r.product.imageUrl,
          authorName: r.authorName,
          authorEmail: r.authorEmail,
          rating: r.rating,
          body: r.body,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </StoreShell>
  );
}
