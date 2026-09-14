import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StoreShippingForm } from "@/components/portal/store-shipping-form";
import { StoreShippingZonesPanel } from "@/components/portal/store-shipping-zones-panel";
import { DistributionCenterForm } from "@/components/portal/distribution-center-form";
import { listShippingZones } from "@/server/services/shipping-zone-service";

export default async function TiendaEnviosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const zones = await listShippingZones(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Envíos
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Cómo se calcula el envío en tu checkout — tú te encargas del despacho
        del pedido, no Marcolini.
      </p>
      <StoreSubNav />

      {zones.length === 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900">
            Todavía no tienes zonas de envío — si vendes productos físicos,
            el checkout de tu tienda no va a poder calcular el envío hasta
            que agregues al menos una (puede ser una sola que cubra
            &ldquo;Resto de Colombia&rdquo;).
          </p>
        </div>
      )}

      <StoreShippingZonesPanel
        initialZones={zones.map((z) => ({
          id: z.id,
          name: z.name,
          regions: z.regions,
          rates: z.rates.map((r) => ({
            id: r.id,
            name: r.name,
            price: Number(r.price),
            condition: r.condition,
            conditionValue: r.conditionValue != null ? Number(r.conditionValue) : null,
            conditionMaxValue:
              r.conditionMaxValue != null ? Number(r.conditionMaxValue) : null,
            conditionValueUnit: r.conditionValueUnit,
          })),
        }))}
      />

      <DistributionCenterForm
        initial={{
          originAddress: profile.originAddress ?? "",
          originCity: profile.originCity ?? "",
          originRegion: profile.originRegion ?? "",
          fulfillmentLeadDays: String(profile.fulfillmentLeadDays ?? 0),
        }}
      />

      <div className="mt-6">
        <StoreShippingForm
          initial={{ shippingNotes: profile.shippingNotes ?? "" }}
        />
      </div>
    </div>
  );
}
