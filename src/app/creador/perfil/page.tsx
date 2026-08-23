import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorProfileByUserId } from "@/server/services/creator-profile-service";
import { CreatorProfileStepForm } from "@/components/portal/creator-profile-step-form";

export default async function PerfilPage() {
  const session = await auth();
  const profile = await getCreatorProfileByUserId(session!.user.id);
  const verticals = await prisma.vertical.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">PERFIL</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Tu perfil</h1>

      <CreatorProfileStepForm
        initial={{
          displayName: profile.displayName,
          socialLinks: profile.socialLinks.map((s) => ({ platform: s.platform, handle: s.handle })),
        }}
        photoUrl={profile.photoUrl}
        verticals={verticals.map((v) => ({ id: v.id, name: v.name }))}
        initialInterestIds={profile.interests.map((i) => i.verticalId)}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
