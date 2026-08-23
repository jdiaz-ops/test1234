import { Suspense } from "react";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBrandProfileByUserId } from "@/server/services/brand-profile-service";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import { getPlatformConfig } from "@/server/services/admin-config-service";
import { BrandProfileForm } from "@/components/portal/brand-profile-form";
import { ChargePaymentBox } from "@/components/portal/charge-payment-box";
import { BrandInvoicesList } from "@/components/portal/brand-invoices-list";
import { StoreConnectionForm } from "@/components/portal/store-connection-form";
import { ChangePasswordForm } from "@/components/portal/change-password-form";
import { AccountTabs } from "@/components/portal/account-tabs";

const storeStatusLabel: Record<string, string> = {
  NOT_CONNECTED: "No conectada todavía",
  CONNECTED: "Conectada",
  ERROR: "Error de conexión — revisa tus credenciales",
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

const chargeStatusLabel: Record<string, string> = {
  PENDING: "Esperando pago",
  PROOF_SUBMITTED: "Comprobante en revisión",
  PAID: "Pagado",
  OVERDUE: "Vencido — marca bloqueada",
};

export default async function MarcaCuentaPage() {
  const session = await auth();
  const profile = await getBrandProfileByUserId(session!.user.id);
  const [summary, charges, invoices, platformConfig] = await Promise.all([
    getBrandDashboardSummary(profile.id),
    prisma.brandCharge.findMany({ where: { brandId: profile.id }, orderBy: { periodStart: "desc" } }),
    prisma.brandInvoice.findMany({ where: { brandId: profile.id }, orderBy: { period: "desc" } }),
    getPlatformConfig(),
  ]);
  const openCharge = charges.find((c) => c.status !== "PAID") ?? null;

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
    <div className="max-w-lg space-y-6">
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
        <h2 className="font-display font-semibold text-brand-ink mb-2">Tu tarifa</h2>
        <p className="text-sm text-brand-ink-soft">
          <span className="font-mono text-brand-accent">{summary.platformFeePercent}%</span> + IVA (
          <span className="font-mono">{summary.vatPercent}%</span>) sobre cada venta — se junta con la
          comisión de tus creadores en el corte del día 1, y se paga por transferencia directa, sin
          tarjeta ni procesador de por medio.
        </p>
      </div>

      {openCharge ? (
        <ChargePaymentBox
          charge={{
            id: openCharge.id,
            totalAmount: Number(openCharge.totalAmount),
            dueAt: openCharge.dueAt.toISOString(),
            status: openCharge.status,
            pdfUrl: openCharge.pdfUrl,
            proofSubmittedAt: openCharge.proofSubmittedAt?.toISOString() ?? null,
            proofRejectedAt: openCharge.proofRejectedAt?.toISOString() ?? null,
            proofRejectedReason: openCharge.proofRejectedReason,
          }}
          paymentInstructions={platformConfig.paymentInstructions}
          paymentQrImageUrl={platformConfig.paymentQrImageUrl}
        />
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
          <p className="text-sm text-brand-accent font-medium">✓ Estás al día</p>
          <p className="text-sm text-brand-ink-soft mt-1">No tienes ningún corte pendiente de pago.</p>
        </div>
      )}

      <div>
        <h2 className="font-display font-semibold text-brand-ink mb-4">Historial de cortes</h2>
        {charges.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">Aún no se ha generado ningún corte.</p>
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
    </div>
  );

  const facturacionTab = (
    <div className="max-w-2xl">
      <h2 className="font-display font-semibold text-brand-ink mb-4">Facturas electrónicas</h2>
      <p className="text-sm text-brand-ink-soft mb-4">Descarga el PDF de la factura electrónica de cada período.</p>
      <BrandInvoicesList invoices={invoices.map((i) => ({ ...i, amount: Number(i.amount), createdAt: i.createdAt.toISOString() }))} />
    </div>
  );

  const tiendaTab = (
    <div className="max-w-lg">
      <p className="text-sm text-brand-ink-soft mb-2">
        Conecta tu tienda para que el código de cada creador se cree automáticamente y las ventas se
        detecten solas.
      </p>
      <p className="text-xs font-mono text-brand-ink-soft mb-6">
        Estado: {storeStatusLabel[profile.storeConnectionStatus]}
      </p>
      <StoreConnectionForm
        initial={{
          storeType: profile.storeType,
          storeUrl: profile.storeUrl ?? "",
          shopifyAccessToken: profile.shopifyAccessToken ?? "",
          wooConsumerKey: profile.wooConsumerKey ?? "",
          wooConsumerSecret: profile.wooConsumerSecret ?? "",
        }}
        shopifyConnected={profile.storeType === "SHOPIFY" && profile.storeConnectionStatus === "CONNECTED"}
        wooConnected={profile.storeType === "WOOCOMMERCE" && profile.storeConnectionStatus === "CONNECTED"}
      />
    </div>
  );

  const seguridadTab = (
    <div className="max-w-lg">
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
  );

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CUENTA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">{profile.companyName}</h1>

      <Suspense fallback={null}>
        <AccountTabs
          tabs={[
            { key: "perfil", label: "Perfil del negocio", content: perfilTab },
            { key: "pago", label: "Pago", content: pagoTab },
            { key: "facturacion", label: "Facturación", content: facturacionTab },
            { key: "tienda", label: "Conexión de tienda", content: tiendaTab },
            { key: "seguridad", label: "Seguridad", content: seguridadTab },
          ]}
        />
      </Suspense>
    </div>
  );
}
