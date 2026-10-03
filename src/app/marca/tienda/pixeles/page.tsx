import { redirect } from "next/navigation";
import { requireBrandProfile } from "@/lib/current-brand";
import { SettingsShell } from "@/components/portal/settings-shell";
import { AdPixelsForm } from "@/components/portal/ad-pixels-form";
import { publicStoreUrl } from "@/lib/store-url";

export default async function TiendaPixelesPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsShell active="pixeles">
      <AdPixelsForm
        initialMetaPixelId={profile.metaPixelId ?? ""}
        initialTiktokPixelId={profile.tiktokPixelId ?? ""}
        storeUrl={publicStoreUrl(profile)}
      />
    </SettingsShell>
  );
}
