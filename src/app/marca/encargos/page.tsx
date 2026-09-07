import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { BrandPaidContentPanel } from "@/components/portal/brand-paid-content-panel";
import { listBrandPaidContentRequests } from "@/server/services/paid-content-service";

export default async function MarcaEncargosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const requests = await listBrandPaidContentRequests(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        ENCARGOS DE CONTENIDO
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Contenido pagado que has encargado
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        A diferencia de una licencia (reusar algo que el creador ya publicó),
        acá le pides que haga algo nuevo por un fee fijo. Se envía desde
        Creadores vinculados → Encargar contenido. Solo se factura cuando el
        creador entrega.
      </p>
      <BrandPaidContentPanel
        initialRequests={requests.map((r) => ({
          id: r.id,
          briefing: r.briefing,
          feeAmount: Number(r.feeAmount),
          deadlineDays: r.deadlineDays,
          status: r.status,
          deliveryUrl: r.deliveryUrl,
          createdAt: r.createdAt.toISOString(),
          creator: { displayName: r.creator.displayName, photoUrl: r.creator.photoUrl },
        }))}
      />
    </div>
  );
}
