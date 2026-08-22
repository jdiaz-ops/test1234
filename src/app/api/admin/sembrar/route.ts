import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedPlatform } from "@/server/bootstrap";

/// Punto de entrada web para sembrar los datos base la primera vez, sin
/// necesitar el CLI de Vercel instalado localmente — se visita una sola
/// vez desde el navegador con el secreto en la URL:
///   https://tu-app.vercel.app/api/admin/sembrar?secret=TU_CRON_SECRET
/// Reutiliza CRON_SECRET (ya lo tienes que configurar de todas formas
/// para el cobro/pago diario) en vez de pedir un secreto más. Es seguro
/// visitarla más de una vez — todo lo que crea es con upsert.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? req.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await seedPlatform(prisma);

  return NextResponse.json({
    ok: true,
    message: "Datos base sembrados correctamente.",
    adminEmail: result.adminEmail,
    advertencia: result.usedFallbackAdmin
      ? "ADMIN_EMAIL/ADMIN_PASSWORD no estaban configurados — se usó la cuenta de pruebas (admin@marcolini.co). Ponlas y visita este link de nuevo para corregirlo."
      : null,
    demoDataSeeded: result.demoDataSeeded,
  });
}
