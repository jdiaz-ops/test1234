import crypto from "crypto";

// Integración con la REST API de WooCommerce. Igual que con Shopify, no hay
// una tienda real conectada para probar esto en vivo — el código sigue la
// documentación oficial de WooCommerce (Coupons API + Webhooks), y lo único
// que no se pudo verificar end-to-end es la llamada real a la tienda
// WordPress. La parte crítica (recibir y validar sus webhooks) sí está
// probada — ver /api/webhooks/woocommerce/[brandId].

const API_PATH = "wp-json/wc/v3";

export class WooCommerceApiError extends Error {}

function restApiUrl(storeUrl: string, path: string) {
  const host = new URL(storeUrl).origin;
  return `${host}/${API_PATH}/${path}`;
}

function basicAuthHeader(consumerKey: string, consumerSecret: string) {
  return "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
}

/// Crea el cupón de descuento único del creador directamente en la tienda
/// de la marca — el creador nunca tiene que hacerlo a mano.
export async function createWooCommerceCoupon(params: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  code: string;
  discountPercent: number;
}): Promise<{ couponId: string }> {
  const res = await fetch(restApiUrl(params.storeUrl, "coupons"), {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(params.consumerKey, params.consumerSecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: params.code,
      discount_type: "percent",
      amount: String(params.discountPercent),
      individual_use: false,
      free_shipping: false,
    }),
  });

  if (!res.ok) {
    throw new WooCommerceApiError(`No se pudo crear el cupón (${res.status})`);
  }
  const body = await res.json();
  return { couponId: String(body.id) };
}

/// Apaga (o vuelve a prender) un cupón en la tienda real, sin borrarlo —
/// así que reactivar es tan simple como volver a llamar esto con
/// `active: true`. Se usa cuando una marca cae en Nivel 3
/// (deactivateOverdueBrands en payment-service.ts) para que el cupón deje
/// de aplicar el descuento en el checkout real, y de vuelta cuando se
/// verifica el pago (verifyBrandPayment). WooCommerce solo aplica cupones
/// en estado "publish" — "draft" lo deja inválido en el checkout sin
/// borrarlo.
export async function setWooCommerceCouponActive(params: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  couponId: string;
  active: boolean;
}): Promise<void> {
  const res = await fetch(restApiUrl(params.storeUrl, `coupons/${params.couponId}`), {
    method: "PUT",
    headers: {
      Authorization: basicAuthHeader(params.consumerKey, params.consumerSecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: params.active ? "publish" : "draft" }),
  });

  if (!res.ok) {
    throw new WooCommerceApiError(`No se pudo ${params.active ? "reactivar" : "desactivar"} el cupón (${res.status})`);
  }
}

/// Forma reducida de un producto tal como lo devuelve /products — solo los
/// campos que de verdad usamos. `permalink` ya es la URL real y completa
/// del producto en la tienda, tal como WooCommerce la arma según sus
/// permalinks configurados — no hay que reconstruirla a mano.
export interface WooCommerceProduct {
  id: number | string;
  name: string;
  slug: string;
  status: string; // "publish" | "draft" | ...
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: string; // "instock" | "outofstock" | "onbackorder"
  permalink: string;
  images: { src: string }[];
  categories: { id: number; name: string; slug: string }[];
}

/// Trae hasta 100 productos publicados por página, hasta 5 páginas (500
/// productos) — tope simple para no dejar un ciclo corriendo indefinidamente
/// contra un catálogo enorme en esta primera versión.
export async function fetchWooCommerceProducts(params: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}): Promise<WooCommerceProduct[]> {
  const products: WooCommerceProduct[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      restApiUrl(params.storeUrl, `products?per_page=100&page=${page}&status=publish`),
      { headers: { Authorization: basicAuthHeader(params.consumerKey, params.consumerSecret) } }
    );
    if (!res.ok) {
      throw new WooCommerceApiError(`No se pudieron traer los productos (${res.status})`);
    }
    const body: WooCommerceProduct[] = await res.json();
    products.push(...body);
    if (body.length < 100) break;
  }
  return products;
}

/// Verifica que un webhook realmente venga de WooCommerce (firma
/// HMAC-SHA256 sobre el cuerpo crudo, codificada en base64, comparada con
/// el secreto guardado para esa marca) — sin esto, cualquiera podría
/// inventarse ventas falsas.
export function verifyWooCommerceWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
) {
  if (!signatureHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
  } catch {
    return false; // longitudes distintas → timingSafeEqual lanza error
  }
}

/// Forma de los campos que realmente usamos del payload del webhook
/// `order.created`/`order.updated` de WooCommerce — el payload real trae
/// muchos más campos.
export interface WooCommerceOrderWebhookPayload {
  id: number | string;
  status: string;
  total: string;
  discount_total: string;
  coupon_lines: { code: string; discount: string }[];
  date_created: string;
  date_modified: string;
  /// Correo del comprador — WooCommerce lo manda en billing.email. Solo se
  /// usa para el detector de fraude "comprador = creador" (ver
  /// checkBuyerIsCreator en attribution-service.ts).
  billing?: { email?: string | null };
}
