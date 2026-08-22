type Invoice = { id: string; period: string; amount: number; pdfUrl: string; note: string | null; createdAt: string };

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

export function BrandInvoicesList({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Todavía no hay facturas electrónicas cargadas. Aparecen aquí apenas se genere la primera.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
            <th className="px-5 py-3 font-normal">Período</th>
            <th className="px-5 py-3 font-normal">Monto</th>
            <th className="px-5 py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-5 py-3 text-brand-ink font-mono">{inv.period}</td>
              <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(inv.amount)}</td>
              <td className="px-5 py-3">
                <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-accent font-medium hover:underline">
                  Descargar PDF
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
