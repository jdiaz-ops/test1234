import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAllyProfile } from "@/lib/current-ally";
import { updateAllyPayoutDetails } from "@/server/services/ally-service";

/// Los datos con los que Marcolini le paga al aliado (los llena él).
const bodySchema = z
  .object({
    legalName: z.string().trim().min(3, "Escribe tu nombre completo o razón social.").max(160),
    documentType: z.enum(["CC", "CE", "NIT", "PASAPORTE"]),
    documentNumber: z.string().trim().min(5, "Escribe tu número de documento.").max(30),
    payoutMethod: z.enum(["BANK", "BRE_B"]),
    breBKey: z.string().trim().max(80).optional().nullable(),
    bankName: z.string().trim().max(80).optional().nullable(),
    bankAccountType: z.enum(["AHORROS", "CORRIENTE"]).optional().nullable(),
    bankAccountNumber: z.string().trim().max(30).optional().nullable(),
  })
  .superRefine((d, ctx) => {
    if (d.payoutMethod === "BANK" && (!d.bankName || !d.bankAccountType || !d.bankAccountNumber || d.bankAccountNumber.replace(/\D/g, "").length < 6)) {
      ctx.addIssue({ code: "custom", message: "Escribe el banco, el tipo y el número de la cuenta." });
    }
    if (d.payoutMethod === "BRE_B" && (!d.breBKey || d.breBKey.length < 3)) {
      ctx.addIssue({ code: "custom", message: "Escribe tu llave Bre-B." });
    }
  });

export async function PATCH(req: Request) {
  const ally = await requireAllyProfile();
  if (!ally) return NextResponse.json({ error: "Tu sesión terminó. Vuelve a entrar con el link de tu correo." }, { status: 401 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Revisa los datos." }, { status: 400 });
  await updateAllyPayoutDetails(ally.id, body.data);
  return NextResponse.json({ ok: true });
}
