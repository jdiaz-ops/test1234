import { NextResponse } from "next/server";
import { verifyShopifyWebhookSignature } from "@/server/integrations/shopify-client";

/// Webhook de cumplimiento obligatorio para toda app pública de Shopify —
/// se dispara cuando un comprador le pide sus datos a la tienda. No
/// guardamos ningún dato personal del comprador (ni nombre, ni correo, ni
/// dirección — ver Transaction en el schema), así que no hay nada que
/// entregar de nuestro lado.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!secret || !verifyShopifyWebhookSignature(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
