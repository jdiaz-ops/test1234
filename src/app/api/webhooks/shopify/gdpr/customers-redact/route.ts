import { NextResponse } from "next/server";
import { verifyShopifyWebhookSignature } from "@/server/integrations/shopify-client";

/// Webhook de cumplimiento obligatorio — se dispara 10 días después de que
/// un comprador pide borrar sus datos. No guardamos datos personales de
/// compradores (ver customers-data-request/route.ts), así que no hay nada
/// que borrar de nuestro lado.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!secret || !verifyShopifyWebhookSignature(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
