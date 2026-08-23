import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { listPendingPayouts } from "@/server/services/payment-service";
import { generatePayoutSummaryDoc } from "@/lib/payout-pdf";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const payouts = await listPendingPayouts();
  const bytes = await generatePayoutSummaryDoc(
    payouts.map((p) => ({
      creatorName: p.creator.displayName,
      amount: Number(p.totalAmount),
      payoutMethod: p.creator.payoutMethod,
      bankName: p.creator.bankName,
      bankAccountType: p.creator.bankAccountType,
      bankAccountNumber: p.creator.bankAccountNumber,
      paymentHolderName: p.creator.paymentHolderName,
      breBKey: p.creator.breBKey,
    }))
  );

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pagos-pendientes-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
