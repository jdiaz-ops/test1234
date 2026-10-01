import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { sendTestEmail } from "@/lib/email";
import { portalUrl } from "@/lib/store-url";

/// Manda un correo de prueba y devuelve tal cual lo que respondió Resend
/// (ver sendTestEmail), para saber por qué no llegan los correos.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const to = typeof body.to === "string" && body.to.includes("@") ? body.to.trim() : admin.email;

  const result = await sendTestEmail(to);
  return NextResponse.json({
    ...result,
    to,
    hasApiKey: Boolean(process.env.RESEND_API_KEY),
    linksBase: portalUrl(),
    appUrlSet: Boolean(process.env.APP_URL),
  });
}
