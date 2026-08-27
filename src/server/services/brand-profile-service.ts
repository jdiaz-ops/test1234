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
    websiteUrl?: string;
    phone?: string;
    fiscalAddress?: string;
    taxRegime?: string;
    legalRepName?: string;
    legalRepId?: string;
    instagramHandle?: string;
    tiktokHandle?: string;
  },
) {
  return prisma.brandProfile.update({ where: { userId }, data });
}

/// Devuelve la URL de webhook que la marca debe pegar en su tienda
/// (Shopify: Settings → Notifications → Webhooks; WooCommerce: WooCommerce →
/// Settings → Advanced → Webhooks), específica de esta marca y plataforma.
export function getWebhookUrl(
  brandId: string,
  storeType: "SHOPIFY" | "WOOCOMMERCE",
) {
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
  },
) {
  const current = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId },
  });

  // El secreto de webhook se genera una sola vez por marca y se reutiliza —
  // regenerarlo en cada guardado invalidaría el que ya esté pegado en la
  // tienda.
  const webhookSecret =
    current.webhookSecret ?? crypto.randomBytes(24).toString("hex");

  const hasShopifyCreds =
    data.storeType === "SHOPIFY" && !!data.shopifyAccessToken;
  const hasWooCreds =
    data.storeType === "WOOCOMMERCE" &&
    !!data.wooConsumerKey &&
    !!data.wooConsumerSecret;

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
      storeConnectionStatus:
        hasShopifyCreds || hasWooCreds ? "CONNECTED" : "NOT_CONNECTED",
      // Mismo criterio que en la conexión automática: si "Página web"
      // todavía está vacío, se llena con el dominio de la tienda en vez
      // de dejar que lo escriban a mano.
      websiteUrl: current.websiteUrl || data.storeUrl,
    },
  });
}

/// Guarda la conexión de Shopify obtenida por OAuth — a diferencia de
/// updateStoreConnection (entrada manual), aquí ya sabemos con certeza que
/// el token es válido porque lo acabamos de recibir de Shopify.
export async function connectShopifyViaOAuth(
  brandId: string,
  data: { storeUrl: string; accessToken: string },
) {
  return prisma.brandProfile.update({
    where: { id: brandId },
    data: {
      storeType: "SHOPIFY",
      storeUrl: data.storeUrl,
      shopifyAccessToken: data.accessToken,
      storeConnectionStatus: "CONNECTED",
      storeLastSyncedAt: new Date(),
    },
  });
}

/// Llena "Página web" solo si todavía está vacío — nunca pisa lo que la
/// marca ya haya escrito a mano (puede ser un dominio distinto a propósito,
/// ej. un link de bio). Se usa después de conectar Shopify, una vez se
/// tiene el dominio real de la tienda (ver fetchShopifyShopDomain) — para
/// WooCommerce el mismo ajuste vive directo en connectWooCommerceViaOAuth,
/// porque ahí el dominio ya se conoce desde el momento de la conexión.
export async function fillBrandWebsiteUrlIfMissing(
  brandId: string,
  websiteUrl: string,
) {
  const current = await prisma.brandProfile.findUnique({
    where: { id: brandId },
    select: { websiteUrl: true },
  });
  if (current?.websiteUrl) return;
  await prisma.brandProfile.update({
    where: { id: brandId },
    data: { websiteUrl },
  });
}

/// Guarda la conexión de WooCommerce obtenida vía su flujo de REST API App
/// Authentication — igual que con Shopify, ya sabemos que las credenciales
/// sirven porque se probaron (ver verifyCredentials en woocommerce-oauth.ts)
/// antes de llegar acá. Genera el webhookSecret si todavía no existe (se
/// reutiliza el mismo mecanismo que la entrada manual, para no romper
/// webhooks ya configurados a mano).
export async function connectWooCommerceViaOAuth(
  brandId: string,
  data: { storeUrl: string; consumerKey: string; consumerSecret: string },
) {
  const current = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
  });
  const webhookSecret =
    current.webhookSecret ?? crypto.randomBytes(24).toString("hex");

  return prisma.brandProfile.update({
    where: { id: brandId },
    data: {
      storeType: "WOOCOMMERCE",
      storeUrl: data.storeUrl,
      wooConsumerKey: data.consumerKey,
      wooConsumerSecret: data.consumerSecret,
      webhookSecret,
      storeConnectionStatus: "CONNECTED",
      storeLastSyncedAt: new Date(),
      // En WooCommerce, storeUrl YA es el dominio real de la marca (la
      // tienda vive ahí mismo, no en un subdominio técnico aparte como
      // Shopify) — si todavía no había puesto "Página web" a mano, se
      // llena solo con esto. Nunca se pisa un valor que ya haya puesto.
      websiteUrl: current.websiteUrl || data.storeUrl,
    },
  });
}
