import { auth } from "@/auth";
import { listBrands } from "@/server/services/admin-brand-service";
import { AdminBrandsPanel } from "@/components/portal/admin-brands-panel";
import { isOwner } from "@/lib/current-admin";

export default async function AdminMarcasPage() {
  const session = await auth();
  const brands = await listBrands();
  const pendingCount = brands.filter((b) => b.status === "PENDING").length;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MARCAS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Gestión de marcas</h1>
      {pendingCount > 0 && (
        <p className="text-sm text-amber-600 mb-6">
          {pendingCount} marca{pendingCount > 1 ? "s" : ""} esperando tu aprobación.
        </p>
      )}
      {pendingCount === 0 && <div className="mb-6" />}

      <AdminBrandsPanel
        brands={brands.map(({ charges, ...b }) => ({
          ...b,
          platformFeePercentOverride: b.platformFeePercentOverride
            ? Number(b.platformFeePercentOverride)
            : null,
          marketplaceVisibilityOverride: b.marketplaceVisibilityOverride,
          // `charges` (crudo, con Decimal) queda afuera del spread a propósito
          // — un Server Component no puede mandarle un Decimal tal cual a un
          // Client Component (ver AdminBrandsPanel, "use client"); openCharge
          // ya lo resume con los campos que sí hacen falta, ya convertidos.
          openCharge: charges[0]
            ? { id: charges[0].id, status: charges[0].status, totalAmount: Number(charges[0].totalAmount) }
            : null,
        }))}
        isOwner={isOwner(session!.user.adminRole)}
      />
    </div>
  );
}
