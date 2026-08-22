import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function getBrandProfileByUserId(userId: string) {
  return prisma.brandProfile.findUniqueOrThrow({
    where: { userId },
    include: { vertical: true },
  });
}

export async function updateBrandProfile(
  userId: string,
  data: {
    companyName: string;
    legalName?: string;
    taxId?: string;
    description?: string;
    city?: string;
  }
) {
  return prisma.brandProfile.update({ where: { userId }, data });
}

/// Devuelve la URL de webhook que la marca debe pegar en su tienda
/// (Shopify: Settings → Notifications → Webhooks; WooCommerce: WooCommerce →
/// Settings → Advanced → Webhooks), específica de esta marca y plataforma.
export function getWebhookUrl(brandId: string, storeType: "SHOPIFY" | "WOOCOMMERCE") {
  const path = storeType === "SHOPIFY" ? "shopify" : "woocommerce";
  return `${APP_URL}/api/webhooks/${path}/${brandId}`;
}

export async function updateStoreConnection(
  userId: string,
  data: {
    storeType: "SHOPIFY" | "WOOCOMMERCE" | "OTHER";
    storeUrl: string;
    shopifyAccessToken?: string;
    wooConsumerKey?: string;
    wooConsumerSecret?: string;
  }
) {
  const current = await prisma.brandProfile.findUniqueOrThrow({ where: { userId } });

  // El secreto de webhook se genera una sola vez por marca y se reutiliza —
  // regenerarlo en cada guardado invalidaría el que ya esté pegado en la
  // tienda.
  const webhookSecret = current.webhookSecret ?? crypto.randomBytes(24).toString("hex");

  const hasShopifyCreds = data.storeType === "SHOPIFY" && !!data.shopifyAccessToken;
  const hasWooCreds = data.storeType === "WOOCOMMERCE" && !!data.wooConsumerKey && !!data.wooConsumerSecret;

  return prisma.brandProfile.update({
    where: { userId },
    data: {
      storeType: data.storeType,
      storeUrl: data.storeUrl,
      webhookSecret,
      ...(data.storeType === "SHOPIFY"
        ? { shopifyAccessToken: data.shopifyAccessToken || null }
        : {}),
      ...(data.storeType === "WOOCOMMERCE"
        ? {
            wooConsumerKey: data.wooConsumerKey || null,
            wooConsumerSecret: data.wooConsumerSecret || null,
          }
        : {}),
      // No es una verificación en vivo contra Shopify/WooCommerce (eso
      // pasaría en el primer intento real de creación de código o con la
      // llegada del primer webhook) — pero si hay credenciales guardadas
      // para la plataforma elegida, ya se puede intentar automatizar.
      storeConnectionStatus: hasShopifyCreds || hasWooCreds ? "CONNECTED" : "NOT_CONNECTED",
    },
  });
}
