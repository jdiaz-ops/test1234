import { Suspense } from "react";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBrandProfileByUserId } from "@/server/services/brand-profile-service";
import {
  getBrandDashboardSummary,
  getBrandTransactions,
} from "@/server/services/brand-finance-service";
import { getPlatformConfig } from "@/server/services/admin-config-service";
import { listOffersForBrand } from "@/server/services/offer-service";
import { listProductsForBrand } from "@/server/services/product-service";
import { BrandProfileForm } from "@/components/portal/brand-profile-form";
import { ChargePaymentBox } from "@/components/portal/charge-payment-box";
import { BrandInvoicesList } from "@/components/portal/brand-invoices-list";
import { StoreConnectionForm } from "@/components/portal/store-connection-form";
import { ChangePasswordForm } from "@/components/portal/change-password-form";
import { OffersPanel } from "@/components/portal/offers-panel";
import { ProductsPanel } from "@/components/portal/products-panel";
import { AccountTabs } from "@/components/portal/account-tabs";

const storeStatusLabel: Record<string, string> = {
  NOT_CONNECTED: "No conectada todavía",
  CONNECTED: "Conectada",
  ERROR: "Error de conexión — revisa tus credenciales",
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const chargeStatusLabel: Record<string, string> = {
  PENDING: "Esperando pago",
  PROOF_SUBMITTED: "Comprobante en revisión",
  PAID: "Pagado",
  OVERDUE: "Vencido — cuenta inhabilitada",
  DEACTIVATED: "Vencido — servicio desactivado",
};

const transactionStatusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  PAID: "Pagada",
  REVERSED: "Revertida",
};

const transactionSourceLabel: Record<string, string> = {
  SHOPIFY: "Shopify",
  WOOCOMMERCE: "WooCommerce",
  MANUAL: "Manual",
};

export default async function MarcaCuentaPage() {
  const session = await auth();
  const profile = await getBrandProfileByUserId(session!.user.id);
  const [
    summary,
    charges,
    invoices,
    platformConfig,
    offers,
    products,
    transactions,
  ] = await Promise.all([
    getBrandDashboardSummary(profile.id),
    prisma.brandCharge.findMany({
      where: { brandId: profile.id },
      orderBy: { periodStart: "desc" },
    }),
    prisma.brandInvoice.findMany({
      where: { brandId: profile.id },
      orderBy: { period: "desc" },
    }),
    getPlatformConfig(),
    listOffersForBrand(profile.id),
    listProductsForBrand(profile.id),
    getBrandTransactions(profile.id),
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

  const ofertaTab = (
    <div>
      <OffersPanel
        offers={offers.map((o) => ({
          ...o,
          defaultCommissionPercent: Number(o.defaultCommissionPercent),
          defaultDiscountPercent: Number(o.defaultDiscountPercent),
        }))}
        platformFeePercent={summary.platformFeePercent}
        vatPercent={summary.vatPercent}
      />
    </div>
  );

  const pagoTab = (
    <div className="max-w-lg space-y-6">
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
        <h2 className="font-display font-semibold text-brand-ink mb-2">
          Tu tarifa
        </h2>
        <p className="text-sm text-brand-ink-soft">
          El fee de servicio de Marcolini es de{" "}
          <span className="font-mono text-brand-accent">
            {summary.platformFeePercent}%
          </span>{" "}
          sobre cada venta confirmada.
        </p>
      </div>

      {openCharge ? (
        <ChargePaymentBox
          charge={{
            id: openCharge.id,
            totalAmount: Number(openCharge.totalAmount),
            dueAt: openCharge.dueAt.toISOString(),
            deactivationDueAt:
              openCharge.deactivationDueAt?.toISOString() ?? null,
            deactivatedAt: openCharge.deactivatedAt?.toISOString() ?? null,
            status: openCharge.status,
            pdfUrl: openCharge.pdfUrl,
            proofSubmittedAt:
              openCharge.proofSubmittedAt?.toISOString() ?? null,
            proofRejectedAt: openCharge.proofRejectedAt?.toISOString() ?? null,
            proofRejectedReason: openCharge.proofRejectedReason,
          }}
          paymentInstructions={platformConfig.paymentInstructions}
          paymentQrImageUrl={platformConfig.paymentQrImageUrl}
        />
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
          <p className="text-sm text-brand-accent font-medium">
            ✓ Estás al día
          </p>
          <p className="text-sm text-brand-ink-soft mt-1">
            No tienes ningún corte pendiente de pago.
          </p>
        </div>
      )}

      <div>
        <h2 className="font-display font-semibold text-brand-ink mb-4">
          Historial de cortes
        </h2>
        {charges.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">
            Aún no se ha generado ningún corte.
          </p>
        ) : (
          <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
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
                      <td className="px-5 py-3 font-mono text-brand-ink">
                        {formatCOP(Number(c.totalAmount))}
                      </td>
                      <td className="px-5 py-3 text-brand-ink-soft">
                        {chargeStatusLabel[c.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const transaccionesTab = (
    <div>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Las ventas de tu tienda conectada aparecen aquí automáticamente,
        atribuidas al código del creador que usó cada cliente.
      </p>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no hay ventas registradas. Aparecerán aquí automáticamente
          cuando un cliente compre usando el código de un creador.
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                  <th className="px-5 py-3 font-normal">Fecha</th>
                  <th className="px-5 py-3 font-normal">Creador</th>
                  <th className="px-5 py-3 font-normal">Origen</th>
                  <th className="px-5 py-3 font-normal">Venta</th>
                  <th className="px-5 py-3 font-normal">Comisión</th>
                  <th className="px-5 py-3 font-normal">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-3 text-brand-ink-soft font-mono">
                      {t.occurredAt.toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-5 py-3 text-brand-ink">
                      {t.creator.displayName}
                    </td>
                    <td className="px-5 py-3 text-brand-ink-soft">
                      {transactionSourceLabel[t.source] ?? t.source}
                      {t.note && (
                        <span className="block text-xs text-brand-ink-soft/70">
                          {t.note}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-brand-ink">
                      {formatCOP(Number(t.netAmount))}
                    </td>
                    <td className="px-5 py-3 font-mono text-brand-accent">
                      {t.commission
                        ? formatCOP(
                            Number(t.commission.creatorCommissionAmount),
                          )
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-brand-ink-soft">
                      {t.commission
                        ? transactionStatusLabel[t.commission.status]
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const facturacionTab = (
    <div className="max-w-2xl">
      <h2 className="font-display font-semibold text-brand-ink mb-4">
        Facturas electrónicas
      </h2>
      <p className="text-sm text-brand-ink-soft mb-4">
        Descarga el PDF de la factura electrónica de cada período.
      </p>
      <BrandInvoicesList
        invoices={invoices.map((i) => ({
          ...i,
          amount: Number(i.amount),
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );

  const tiendaTab = (
    <div className="max-w-lg">
      <p className="text-sm text-brand-ink-soft mb-2">
        Conecta tu tienda para que el código de cada creador se cree
        automáticamente y las ventas se detecten solas.
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
        shopifyConnected={
          profile.storeType === "SHOPIFY" &&
          profile.storeConnectionStatus === "CONNECTED"
        }
        wooConnected={
          profile.storeType === "WOOCOMMERCE" &&
          profile.storeConnectionStatus === "CONNECTED"
        }
      />
    </div>
  );

  const productosTab = (
    <div>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Trae tus productos desde tu tienda para que los creadores puedan armar
        colecciones con fotos y precios reales en su vitrina — y destaca hasta 3
        para que aparezcan primero.
      </p>
      <ProductsPanel
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          price: Number(p.price),
          currency: p.currency,
          available: p.available,
          featured: p.featured,
        }))}
        storeConnected={
          profile.storeConnectionStatus === "CONNECTED" &&
          profile.storeType !== "OTHER"
        }
        lastSyncedAt={profile.storeLastSyncedAt?.toISOString() ?? null}
      />
    </div>
  );

  const seguridadTab = (
    <div className="max-w-lg">
      <ChangePasswordForm />

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
        className="mt-6"
      >
        <button className="text-sm text-brand-ink-soft hover:text-red-600 hover:underline">
          Cerrar sesión
        </button>
      </form>
    </div>
  );

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        CUENTA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">
        {profile.companyName}
      </h1>

      <Suspense fallback={null}>
        <AccountTabs
          tabs={[
            { key: "perfil", label: "Perfil del negocio", content: perfilTab },
            { key: "oferta", label: "Oferta y comisión", content: ofertaTab },
            { key: "pago", label: "Pago", content: pagoTab },
            {
              key: "transacciones",
              label: "Transacciones",
              content: transaccionesTab,
            },
            {
              key: "facturacion",
              label: "Facturación",
              content: facturacionTab,
            },
            { key: "tienda", label: "Conexión de tienda", content: tiendaTab },
            { key: "productos", label: "Productos", content: productosTab },
            { key: "seguridad", label: "Seguridad", content: seguridadTab },
          ]}
        />
      </Suspense>
    </div>
  );
}
