import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StoreConfigForm } from "@/components/portal/store-config-form";

export default async function TiendaConfiguracionPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Configuración
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        El link público de tu tienda dentro de Marcolini.
      </p>
      <StoreSubNav />
      {profile.storefrontSlug && (
        <a
          href={`/t/${profile.storefrontSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mb-4 text-sm text-brand-accent hover:underline"
        >
          Ver tu tienda en vivo →
        </a>
      )}
      <StoreConfigForm initialSlug={profile.storefrontSlug ?? ""} />
    </div>
  );
}
