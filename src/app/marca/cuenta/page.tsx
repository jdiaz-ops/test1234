import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBrandProfileByUserId } from "@/server/services/brand-profile-service";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import { listNotifications } from "@/server/services/notification-service";
import { BrandProfileForm } from "@/components/portal/brand-profile-form";
import { CardForm } from "@/components/portal/card-form";
import { BrandInvoicesList } from "@/components/portal/brand-invoices-list";
import { NotificationsList } from "@/components/portal/notifications-list";
import { ChangePasswordForm } from "@/components/portal/change-password-form";
import { AccountTabs } from "@/components/portal/account-tabs";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

const chargeStatusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  CHARGED: "Cobrado",
  FAILED: "Falló",
};

export default async function MarcaCuentaPage() {
  const session = await auth();
  const profile = await getBrandProfileByUserId(session!.user.id);
  const [summary, charges, invoices, notifications] = await Promise.all([
    getBrandDashboardSummary(profile.id),
    prisma.brandCharge.findMany({ where: { brandId: profile.id }, orderBy: { periodStart: "desc" } }),
    prisma.brandInvoice.findMany({ where: { brandId: profile.id }, orderBy: { period: "desc" } }),
    listNotifications(session!.user.id),
  ]);

  const perfilTab = (
    <BrandProfileForm
      initial={{
        companyName: profile.companyName,
        legalName: profile.legalName ?? "",
        taxId: profile.taxId ?? "",
        description: profile.description ?? "",
        city: profile.city ?? "",
        websiteUrl: profile.websiteUrl ?? "",
        phone: profile.phone ?? "",
        fiscalAddress: profile.fiscalAddress ?? "",
        taxRegime: profile.taxRegime ?? "",
        legalRepName: profile.legalRepName ?? "",
        legalRepId: profile.legalRepId ?? "",
        instagramHandle: profile.instagramHandle ?? "",
        tiktokHandle: profile.tiktokHandle ?? "",
      }}
      files={{
        logoUrl: profile.logoUrl,
        rutDocumentUrl: profile.rutDocumentUrl,
        camaraComercioUrl: profile.camaraComercioUrl,
      }}
    />
  );

  const pagoTab = (
    <div className="max-w-lg">
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 mb-6">
        <h2 className="font-display font-semibold text-brand-ink mb-2">Tu tarifa</h2>
        <p className="text-sm text-brand-ink-soft">
          <span className="font-mono text-brand-accent">{summary.platformFeePercent}%</span> + IVA (
          <span className="font-mono">{summary.vatPercent}%</span>) sobre cada venta, cobrado el día 1
          de cada mes junto con la comisión de tus creadores.
        </p>
      </div>
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
        <h2 className="font-display font-semibold text-brand-ink mb-2">Método de cobro</h2>
        <p className="text-sm text-brand-ink-soft mb-4">
          {profile.cardTokenRef
            ? "Tienes una tarjeta registrada para el cobro automático."
            : "Registra tu tarjeta para que el cobro del día 1 se haga solo, sin que tengas que hacer nada cada mes."}
        </p>
        <CardForm hasCard={!!profile.cardTokenRef} />
      </div>
    </div>
  );

  const facturacionTab = (
    <div className="max-w-2xl">
      <h2 className="font-display font-semibold text-brand-ink mb-4">Facturas electrónicas</h2>
      <p className="text-sm text-brand-ink-soft mb-4">Descarga el PDF de la factura electrónica de cada período.</p>
      <div className="mb-10">
        <BrandInvoicesList invoices={invoices.map((i) => ({ ...i, amount: Number(i.amount), createdAt: i.createdAt.toISOString() }))} />
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Historial de cobros</h2>
      {charges.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">Aún no se ha generado ningún cobro.</p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Período</th>
                <th className="px-5 py-3 font-normal">Monto</th>
                <th className="px-5 py-3 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 text-brand-ink-soft font-mono">
                    {c.periodStart.toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(Number(c.totalAmount))}</td>
                  <td className="px-5 py-3 text-brand-ink-soft">{chargeStatusLabel[c.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const notificacionesTab = (
    <NotificationsList notifications={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />
  );

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CUENTA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">{profile.companyName}</h1>

      <AccountTabs
        tabs={[
          { key: "perfil", label: "Perfil del negocio", content: perfilTab },
          { key: "pago", label: "Pago", content: pagoTab },
          { key: "facturacion", label: "Facturación", content: facturacionTab },
          { key: "notificaciones", label: "Notificaciones", content: notificacionesTab },
        ]}
      />

      <div className="mt-12 pt-6 border-t border-brand-line max-w-lg">
        <h2 className="font-display font-semibold text-brand-ink mb-4">Seguridad</h2>
        <p className="text-sm text-brand-ink-soft mb-4 font-mono">{session!.user.email}</p>
        <ChangePasswordForm />

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="mt-6"
        >
          <button className="text-sm text-brand-ink-soft hover:text-red-600 hover:underline">Cerrar sesión</button>
        </form>
      </div>
    </div>
  );
}
