import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { importShopifyShippingZones } from "@/server/services/shopify-shipping-import-service";

/// Zonas de envío armadas a partir de los fletes leídos de Shopify (ver
/// shopify-shipping-import-service.ts).
export const maxDuration = 60;

const rateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.number().min(0).max(100_000_000),
  condition: z.enum(["NONE", "MIN_ORDER_AMOUNT"]),
  conditionValue: z.number().positive().max(1_000_000_000).optional(),
});

const zoneSchema = z.object({
  name: z.string().trim().min(2).max(80),
  regions: z.array(z.string().trim().min(1).max(60)).min(1).max(40),
  rates: z.array(rateSchema).min(1).max(5),
  otherRates: z.array(z.object({ name: z.string().max(80), price: z.number() })).max(10).default([]),
});

const bodySchema = z.object({
  zones: z.array(zoneSchema).min(1).max(40),
  replace: z.boolean().default(true),
});

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await limitOrReject(req, `envios-importar:${profile.id}`, 30, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const issue = body.error.issues[0];
    return NextResponse.json({ error: `${issue.message} (${issue.path.join(".")})` }, { status: 400 });
  }
  const result = await importShopifyShippingZones(profile.id, body.data.zones, { replace: body.data.replace });
  return NextResponse.json({ ok: true, ...result });
}
