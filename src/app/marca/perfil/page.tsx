import { auth } from "@/auth";
import { getBrandProfileByUserId } from "@/server/services/brand-profile-service";
import { BrandProfileForm } from "@/components/portal/brand-profile-form";

export default async function MarcaPerfilPage() {
  const session = await auth();
  const profile = await getBrandProfileByUserId(session!.user.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">PERFIL</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Perfil de tu marca</h1>

      <BrandProfileForm
        initial={{
          companyName: profile.companyName,
          legalName: profile.legalName ?? "",
          taxId: profile.taxId ?? "",
          description: profile.description ?? "",
          city: profile.city ?? "",
        }}
      />
    </div>
  );
}
