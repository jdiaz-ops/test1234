import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/// Resumen de pagos pendientes a creadores — un documento para que el
/// admin sepa exactamente a quién transferirle, cuánto, y a qué cuenta o
/// llave Bre-B, sin tener que entrar uno por uno a la plataforma a
/// consultarlo. Se genera al vuelo desde los Payout en PENDING (ver
/// listPendingPayouts en payment-service.ts) — no queda guardado en
/// ninguna parte, siempre refleja el estado actual.
export async function generatePayoutSummaryDoc(
  items: {
    creatorName: string;
    amount: number;
    payoutMethod: "BANK" | "BRE_B" | null;
    bankName: string | null;
    bankAccountType: string | null;
    bankAccountNumber: string | null;
    paymentHolderName: string | null;
    breBKey: string | null;
  }[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 56;
  let y = 780;
  const ink = rgb(0.11, 0.11, 0.11);
  const soft = rgb(0.45, 0.45, 0.45);
  const accent = rgb(0.55, 0.16, 0.16);

  function line(text: string, opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; dy?: number } = {}) {
    const { size = 11, f = font, color = ink, dy = 18 } = opts;
    if (y < 80) {
      page = doc.addPage([595, 842]);
      y = 780;
    }
    page.drawText(text, { x: margin, y, size, font: f, color });
    y -= dy;
  }

  function money(n: number) {
    return "$" + Math.round(n).toLocaleString("es-CO");
  }

  line("MARCOLINI", { size: 12, f: bold, color: accent, dy: 22 });
  line("Resumen de pagos pendientes a creadores", { size: 16, f: bold, dy: 26 });
  line(`Generado: ${new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })}`, {
    size: 10,
    color: soft,
    dy: 24,
  });

  const total = items.reduce((sum, i) => sum + i.amount, 0);
  line(`Total a transferir: ${money(total)} — ${items.length} creador(es)`, { size: 12, f: bold, dy: 28 });

  for (const item of items) {
    line(item.creatorName, { size: 12, f: bold, dy: 16 });
    line(`Monto: ${money(item.amount)}`, { size: 10, dy: 14 });
    if (item.payoutMethod === "BRE_B") {
      line(`Bre-B — llave: ${item.breBKey ?? "(sin llave registrada)"}`, { size: 10, color: soft, dy: 14 });
    } else if (item.payoutMethod === "BANK") {
      line(
        `${item.bankName ?? ""} — ${item.bankAccountType ?? ""} ${item.bankAccountNumber ?? ""} — titular: ${item.paymentHolderName ?? ""}`,
        { size: 10, color: soft, dy: 14 }
      );
    } else {
      line("Sin método de pago configurado", { size: 10, color: soft, dy: 14 });
    }
    y -= 8;
  }

  return doc.save();
}
