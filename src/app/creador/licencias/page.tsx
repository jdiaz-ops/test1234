import { requireCreatorProfile } from "@/lib/current-creator";
import { redirect } from "next/navigation";
import { CreatorLicensesPanel } from "@/components/portal/creator-licenses-panel";
import {
  listCreatorLicensableContent,
  listCreatorLicenses,
} from "@/server/services/content-license-service";

export default async function CreadorLicenciasPage() {
  const profile = await requireCreatorProfile();
  if (!profile) redirect("/login");

  const [content, licenses] = await Promise.all([
    listCreatorLicensableContent(profile.id),
    listCreatorLicenses(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        LICENCIAS
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Licencia tu contenido para pauta
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Ofrece un post que ya publicaste para que una marca con la que
        trabajas alquile el derecho de reusarlo como pauta paga en Meta o
        TikTok. Tú pones el precio por cada 30 días — se paga en tu próximo
        pago, aparte de tus comisiones normales.
      </p>
      <CreatorLicensesPanel
        initialContent={content.map((c) => ({
          id: c.id,
          platform: c.platform,
          contentUrl: c.contentUrl,
          screenshotUrl: c.screenshotUrl,
          caption: c.caption,
          pricePer30Days: Number(c.pricePer30Days),
          active: c.active,
          timesRented: c._count.licenses,
        }))}
        initialLicenses={licenses.map((l) => ({
          id: l.id,
          durationDays: l.durationDays,
          creatorNetAmount: Number(l.creatorNetAmount),
          status: l.status,
          startsAt: l.startsAt.toISOString(),
          endsAt: l.endsAt.toISOString(),
          content: { caption: l.content.caption, contentUrl: l.content.contentUrl },
          brand: { companyName: l.brand.companyName, logoUrl: l.brand.logoUrl },
        }))}
      />
    </div>
  );
}
