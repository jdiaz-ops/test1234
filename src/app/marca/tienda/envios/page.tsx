import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StoreShippingForm } from "@/components/portal/store-shipping-form";
import { StoreShippingZonesPanel } from "@/components/portal/store-shipping-zones-panel";
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
      <StoreShippingForm
        initial={{
          shippingFlatRate:
            profile.shippingFlatRate != null
              ? String(profile.shippingFlatRate)
              : "",
          freeShippingThreshold:
            profile.freeShippingThreshold != null
              ? String(profile.freeShippingThreshold)
              : "",
          shippingNotes: profile.shippingNotes ?? "",
        }}
      />
      <StoreShippingZonesPanel
        initialZones={zones.map((z) => ({
          id: z.id,
          name: z.name,
          regions: z.regions,
          price: Number(z.price),
          freeShippingThreshold:
            z.freeShippingThreshold != null ? Number(z.freeShippingThreshold) : null,
        }))}
      />
    </div>
  );
}
