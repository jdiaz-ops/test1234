import Link from "next/link";
import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { enviaAllowed } from "@/lib/features";
import { SettingsShell } from "@/components/portal/settings-shell";
import { StoreShippingForm } from "@/components/portal/store-shipping-form";
import { StoreShippingZonesPanel } from "@/components/portal/store-shipping-zones-panel";
import { DistributionCenterForm } from "@/components/portal/distribution-center-form";
import { listShippingZones } from "@/server/services/shipping-zone-service";

export default async function TiendaEnviosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const zones = await listShippingZones(profile.id);

  return (
    <SettingsShell active="envios">
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Cómo se calcula el envío en tu checkout — tú te encargas del despacho
        del pedido, no Marcolini.
      </p>

      {/* La pestaña Conexiones está fuera del menú (pedido del 2026-10-19):
          las marcas con Envia llegan a su conexión desde aquí. */}
      {enviaAllowed(profile) && (
        <div className="rounded-xl border border-brand-line bg-brand-surface px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-brand-ink">
            <span className="font-medium">Guías con Envia:</span>{" "}
            <span className="text-brand-ink-soft">crea la guía desde cada pedido con tu cuenta de Envia.</span>
          </p>
          <Link
            href="/marca/tienda/conexiones"
            className="text-sm font-medium text-brand-accent hover:underline"
          >
            Conectar Envia →
          </Link>
        </div>
      )}

      {zones.some((z) => z.rates.some((r) => r.pendingPrice)) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900">
            Marcolini no permite envío contraentrega. Tienes tarifas que venían así de tu tienda anterior y todavía no
            tienen precio: ponles el precio del envío para que esas zonas se puedan comprar.
          </p>
        </div>
      )}

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
            pendingPrice: r.pendingPrice,
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
    </SettingsShell>
  );
}
