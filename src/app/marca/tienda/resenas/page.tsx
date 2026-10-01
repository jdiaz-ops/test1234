import { notFound, redirect } from "next/navigation";
import { REVIEWS_ENABLED } from "@/lib/features";
import { requireBrandProfile } from "@/lib/current-brand";
import { listBrandReviews } from "@/server/services/product-review-service";
import { StoreReviewsPanel } from "@/components/portal/store-reviews-panel";

export default async function TiendaResenasPage() {
  // Reseñas apagadas (ver src/lib/features.ts).
  if (!REVIEWS_ENABLED) notFound();
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const reviews = await listBrandReviews(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MI TIENDA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Reseñas</h1>
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
    </div>
  );
}
