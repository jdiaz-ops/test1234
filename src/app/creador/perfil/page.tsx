import { auth } from "@/auth";
import { getCreatorProfileByUserId } from "@/server/services/creator-profile-service";
import { ProfileForm } from "@/components/portal/profile-form";

export default async function PerfilPage() {
  const session = await auth();
  const profile = await getCreatorProfileByUserId(session!.user.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">PERFIL</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Tu perfil</h1>

      <ProfileForm
        initial={{
          displayName: profile.displayName,
          bio: profile.bio ?? "",
          city: profile.city ?? "",
          verticalId: profile.verticalId,
          socialLinks: profile.socialLinks.map((s) => ({ platform: s.platform, handle: s.handle })),
        }}
      />
    </div>
  );
}
