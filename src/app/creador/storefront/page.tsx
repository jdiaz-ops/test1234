import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { CopyButton } from "@/components/portal/copy-button";

export default async function StorefrontSettingsPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const enrollments = await getEnrollmentsForCreator(profile.id);
  const active = enrollments.filter((e) => e.status === "ACTIVE");

  const publicUrl = `marcolini.co/c/${profile.storefrontSlug}`;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MI STOREFRONT</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Tu vitrina pública</h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-xl">
        Este es el único link que necesitas compartir — reúne todas tus marcas
        activas en una sola página. Ponlo en tu bio de Instagram o TikTok.
      </p>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 flex items-center justify-between gap-4 mb-8">
        <span className="font-mono text-brand-accent">{publicUrl}</span>
        <div className="flex items-center gap-3 shrink-0">
          <CopyButton value={`https://${publicUrl}`} />
          <a
            href={`/c/${profile.storefrontSlug}`}
            target="_blank"
            className="text-xs text-brand-ink-soft hover:text-brand-ink hover:underline"
          >
            Ver vitrina →
          </a>
        </div>
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">
        Marcas que se muestran ahí ({active.length})
      </h2>
      {active.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Únete a una marca en el marketplace para que aparezca aquí.
        </p>
      ) : (
        <ul className="space-y-2">
          {active.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-brand-line bg-brand-surface px-4 py-3 text-sm text-brand-ink"
            >
              {e.offer.brand.companyName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
