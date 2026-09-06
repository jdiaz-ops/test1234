import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { BrandLicensesPanel } from "@/components/portal/brand-licenses-panel";
import {
  listBrandLicenseCatalog,
  listBrandLicenses,
} from "@/server/services/content-license-service";

export default async function MarcaLicenciasPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [catalog, rentals] = await Promise.all([
    listBrandLicenseCatalog(profile.id),
    listBrandLicenses(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        LICENCIAS DE CONTENIDO
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Alquila contenido de tus creadores para pauta
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Reusa un post que ya publicó un creador vinculado a tu programa como
        pauta paga en Meta o TikTok Ads. El precio lo pone el creador, tú
        eliges por cuánto tiempo — el fee se suma a tu próximo corte.
      </p>
      <BrandLicensesPanel
        initialCatalog={catalog.map((c) => ({
          id: c.id,
          platform: c.platform,
          contentUrl: c.contentUrl,
          screenshotUrl: c.screenshotUrl,
          caption: c.caption,
          pricePer30Days: Number(c.pricePer30Days),
          creator: { id: c.creator.id, displayName: c.creator.displayName, photoUrl: c.creator.photoUrl },
        }))}
        initialRentals={rentals.map((l) => ({
          id: l.id,
          durationDays: l.durationDays,
          feeAmount: Number(l.feeAmount),
          status: l.status,
          startsAt: l.startsAt.toISOString(),
          endsAt: l.endsAt.toISOString(),
          content: { caption: l.content.caption, contentUrl: l.content.contentUrl },
          creator: { displayName: l.creator.displayName, photoUrl: l.creator.photoUrl },
        }))}
      />
    </div>
  );
}
