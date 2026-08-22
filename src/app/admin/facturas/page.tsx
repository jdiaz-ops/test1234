import { prisma } from "@/lib/prisma";
import { AdminInvoiceUpload } from "@/components/portal/admin-invoice-upload";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

export default async function AdminFacturasPage() {
  const [brands, invoices] = await Promise.all([
    prisma.brandProfile.findMany({ where: { status: "APPROVED" }, orderBy: { companyName: "asc" } }),
    prisma.brandInvoice.findMany({ include: { brand: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">FACTURACIÓN ELECTRÓNICA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Subir facturas</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Sube el PDF de la factura electrónica ya generada por el proveedor de facturación — queda
        disponible de inmediato para que la marca la vea y descargue desde Cuenta → Facturación.
      </p>

      <AdminInvoiceUpload brands={brands.map((b) => ({ id: b.id, companyName: b.companyName }))} />

      <h2 className="font-display font-semibold text-brand-ink mb-4">Facturas subidas</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">Todavía no se ha subido ninguna factura.</p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Marca</th>
                <th className="px-5 py-3 font-normal">Período</th>
                <th className="px-5 py-3 font-normal">Monto</th>
                <th className="px-5 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-5 py-3 text-brand-ink">{inv.brand.companyName}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink-soft">{inv.period}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(Number(inv.amount))}</td>
                  <td className="px-5 py-3">
                    <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-accent font-medium hover:underline">
                      Ver PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
