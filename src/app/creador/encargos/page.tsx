import { requireCreatorProfile } from "@/lib/current-creator";
import { redirect } from "next/navigation";
import { CreatorPaidContentPanel } from "@/components/portal/creator-paid-content-panel";
import { listCreatorPaidContentRequests } from "@/server/services/paid-content-service";

export default async function CreadorEncargosPage() {
  const profile = await requireCreatorProfile();
  if (!profile) redirect("/login");

  const requests = await listCreatorPaidContentRequests(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        CONTENIDO PAGADO
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Encargos de marcas
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Marcas con las que ya trabajas te piden contenido nuevo por un fee
        fijo. Acéptalo o recházalo — si aceptas, el pago se factura cuando
        entregues.
      </p>
      <CreatorPaidContentPanel
        initialRequests={requests.map((r) => ({
          id: r.id,
          briefing: r.briefing,
          feeAmount: Number(r.feeAmount),
          deadlineDays: r.deadlineDays,
          status: r.status,
          creatorNetAmount: r.creatorNetAmount != null ? Number(r.creatorNetAmount) : null,
          deliveryUrl: r.deliveryUrl,
          createdAt: r.createdAt.toISOString(),
          brand: { companyName: r.brand.companyName, logoUrl: r.brand.logoUrl },
        }))}
      />
    </div>
  );
}
