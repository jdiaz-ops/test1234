import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function PublicStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const profile = await prisma.creatorProfile.findUnique({
    where: { storefrontSlug: slug },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: { offer: { include: { brand: true } } },
      },
    },
  });

  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="text-center mb-10">
          {profile.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoUrl}
              alt={profile.displayName}
              className="w-20 h-20 rounded-full object-cover mx-auto mb-4"
            />
          )}
          <h1 className="font-display text-xl font-semibold text-brand-ink">{profile.displayName}</h1>
          {profile.bio && <p className="text-sm text-brand-ink-soft mt-2">{profile.bio}</p>}
        </div>

        <div className="space-y-3">
          {profile.enrollments.length === 0 ? (
            <p className="text-center text-sm text-brand-ink-soft">Próximamente más marcas por aquí.</p>
          ) : (
            profile.enrollments.map((e) => (
              <a
                key={e.id}
                href={`${e.offer.brand.storeUrl ?? "#"}?discount=${e.discountCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-brand-line bg-brand-surface p-5 hover:border-brand-accent transition-colors"
              >
                <p className="font-display font-semibold text-brand-ink">{e.offer.brand.companyName}</p>
                <p className="text-sm text-brand-ink-soft mt-1">
                  Usa el código{" "}
                  <span className="font-mono text-brand-accent">{e.discountCode}</span>
                </p>
              </a>
            ))
          )}
        </div>

        <p className="text-center font-mono text-xs text-brand-ink-soft mt-12">
          Vía Marcolini
        </p>
      </div>
    </div>
  );
}
