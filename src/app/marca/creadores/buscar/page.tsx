import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listOffersForBrand } from "@/server/services/offer-service";
import { CreatorDirectoryPanel } from "@/components/portal/creator-directory-panel";
import { CreatorsTabs } from "@/components/portal/creators-tabs";
import { getPlatformConfig } from "@/server/services/admin-config-service";

export default async function BuscarCreadoresPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [verticals, offers, config] = await Promise.all([
    prisma.vertical.findMany({ orderBy: { name: "asc" } }),
    listOffersForBrand(profile.id),
    getPlatformConfig(),
  ]);

  const activeOffers = offers.filter((o) => o.status === "ACTIVE");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">
        Creadores
      </h1>
      <CreatorsTabs active="buscar" />
      {/* Primero se invita; muestras y productos, en Vinculados cuando acepte
          (pedido del 2026-10-19). */}
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Creadoras de la red que todavía no están en tu programa: invítalas
        con la comisión que quieras ofrecerles. Cuando acepten, quedan en
        Vinculados y ahí les puedes proponer muestras y productos.
      </p>

      <CreatorDirectoryPanel
        verticals={verticals.map((v) => ({ id: v.id, name: v.name }))}
        offers={activeOffers.map((o) => ({
          id: o.id,
          name: o.name,
          defaultCommissionPercent: Number(o.defaultCommissionPercent),
          defaultDiscountPercent: Number(o.defaultDiscountPercent),
        }))}
        // Para armar el programa ahí mismo si todavía no tiene (ver OfferForm).
        platformFeePercent={profile.platformFeePercentOverride ? Number(profile.platformFeePercentOverride) : Number(config.defaultPlatformFeePercent)}
        vatPercent={Number(config.vatPercent)}
      />
    </div>
  );
}
