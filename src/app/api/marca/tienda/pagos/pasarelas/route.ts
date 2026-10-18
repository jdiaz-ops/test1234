import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { recordGatewayRequests, removeGatewayRequest } from "@/server/services/payment-gateway-request-service";

/// Pasarela de pago que la marca usa y Marcolini no tiene: se registra y
/// se le avisa al equipo (ver payment-gateway-request-service.ts). La
/// llaman "Duplicar tienda" (con las detectadas) y Pagos (la marca).
const postSchema = z.object({
  gateways: z.array(z.string().trim().min(2).max(60)).min(1).max(10),
  source: z.enum(["DUPLICAR", "MARCA"]).default("MARCA"),
  note: z.string().max(300).optional().nullable(),
});

const deleteSchema = z.object({ gateway: z.string().trim().min(2).max(60) });

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await limitOrReject(req, `pasarelas:${profile.id}`, 30, 3600);
  if (limited) return limited;
  const body = postSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Dinos con qué pasarela cobras." }, { status: 400 });
  const result = await recordGatewayRequests(profile.id, body.data.gateways, body.data.source, body.data.note);
  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pasarela inválida." }, { status: 400 });
  return NextResponse.json({ ok: true, removed: await removeGatewayRequest(profile.id, body.data.gateway) });
}
