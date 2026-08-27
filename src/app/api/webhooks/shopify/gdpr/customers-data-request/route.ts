import { NextResponse } from "next/server";
import { verifyShopifyWebhookSignature } from "@/server/integrations/shopify-client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";

/// Webhook de cumplimiento obligatorio (Shopify lo exige a toda app, sin
/// importar si pidió acceso a datos protegidos) — se dispara cuando un
/// comprador le pide sus datos a la tienda. Marcolini no pide acceso a
/// datos protegidos de clientes en Shopify, así que Transaction.customerEmail
/// nunca se llena automáticamente desde un pedido — solo puede tener algo
/// acá si la marca lo escribió a mano en una venta manual (ver
/// RecordOrderParams.customerEmail en attribution-service.ts) y por
/// coincidencia es el mismo comprador. No hay un flujo automático para
/// entregarle los datos al comprador (Shopify solo exige que la tienda los
/// reciba dentro de 30 días, no que la respuesta sea automática), así que
/// acá se avisa a un admin con cuántas ventas coinciden, para que responda
/// a mano dentro del plazo.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!secret || !verifyShopifyWebhookSignature(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    shop_domain?: string;
    customer?: { email?: string };
  };
  const shopDomain = payload.shop_domain;
  const customerEmail = payload.customer?.email?.trim().toLowerCase();

  if (shopDomain && customerEmail) {
    const brand = await prisma.brandProfile.findFirst({
      where: { storeUrl: `https://${shopDomain}` },
      select: { id: true, companyName: true },
    });
    if (brand) {
      const cantidad = await prisma.transaction.count({
        where: { brandId: brand.id, customerEmail },
      });
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", adminRole: "OWNER" },
        select: { id: true },
      });
      await Promise.all(
        admins.map((admin) =>
          createNotification(admin.id, "GDPR_DATA_REQUEST_ADMIN", {
            marca: brand.companyName,
            correo: customerEmail,
            cantidad,
          }),
        ),
      );
    }
  }

  return NextResponse.json({ ok: true });
}
