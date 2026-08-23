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
        brands={brands.map((b) => ({
          ...b,
          platformFeePercentOverride: b.platformFeePercentOverride
            ? Number(b.platformFeePercentOverride)
            : null,
          openCharge: b.charges[0]
            ? { id: b.charges[0].id, status: b.charges[0].status, totalAmount: Number(b.charges[0].totalAmount) }
            : null,
        }))}
        isOwner={isOwner(session!.user.adminRole)}
      />
    </div>
  );
}
