import { NextResponse } from "next/server";
import { domainPingSignature } from "@/server/services/custom-domain-service";

/// Lo pide checkCustomDomainLive (custom-domain-service.ts) en
/// https://{dominio}/api/dominio/ping: si contesta con la firma de
/// Marcolini para ese mismo dominio, el DNS ya apunta, el certificado está
/// listo y la tienda abre ahí. No dice nada de ninguna marca.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  return NextResponse.json({ ok: true, sig: domainPingSignature(host) }, { headers: { "Cache-Control": "no-store" } });
}
