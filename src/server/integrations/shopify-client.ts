import crypto from "crypto";

// Integración con la Admin API de Shopify. No hay una tienda real conectada
// todavía para probar esto en vivo — el código sigue la documentación
// oficial de Shopify (Price Rules + Discount Codes API), y lo único que no
// se pudo verificar end-to-end es la llamada real a shopify.com. La parte
// crítica (recibir y validar sus webhooks) sí está probada — ver
// /api/webhooks/shopify/[brandId].

export const API_VERSION = "2025-01";

export class ShopifyApiError extends Error {}

function adminApiUrl(shopUrl: string, path: string) {
  const host = new URL(shopUrl).host;
  return `https://${host}/admin/api/${API_VERSION}/${path}`;
}

/// Crea el código de descuento único del creador directamente en la tienda
/// de la marca — el creador nunca tiene que hacerlo a mano.
export async function createShopifyDiscountCode(params: {
  storeUrl: string;
  accessToken: string;
  code: string;
  discountPercent: number;
}): Promise<{ priceRuleId: string }> {
  const priceRuleRes = await fetch(adminApiUrl(params.storeUrl, "price_rules.json"), {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": params.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_rule: {
        title: params.code,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "percentage",
        value: `-${params.discountPercent}`,
        customer_selection: "all",
        starts_at: new Date().toISOString(),
      },
    }),
  });

  if (!priceRuleRes.ok) {
    throw new ShopifyApiError(`No se pudo crear la regla de precio (${priceRuleRes.status})`);
  }
  const priceRuleBody = await priceRuleRes.json();
  const priceRuleId = priceRuleBody.price_rule.id;

  const discountRes = await fetch(
    adminApiUrl(params.storeUrl, `price_rules/${priceRuleId}/discount_codes.json`),
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": params.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ discount_code: { code: params.code } }),
    }
  );

  if (!discountRes.ok) {
    throw new ShopifyApiError(`No se pudo crear el código de descuento (${discountRes.status})`);
  }

  return { priceRuleId: String(priceRuleId) };
}

/// Apaga (o vuelve a prender) un código de descuento en la tienda real,
/// sin borrar la price rule — así que reactivar es tan simple como volver
/// a llamar esto con `active: true`. Se usa cuando una marca cae en Nivel 3
/// (deactivateOverdueBrands en payment-service.ts) para que el código deje
/// de aplicar el descuento en el checkout real, y de vuelta cuando se
/// verifica el pago (verifyBrandPayment). `ends_at` en el pasado es el
/// mecanismo que documenta Shopify para esto — no existe un campo
/// "enabled" aparte en Price Rules.
export async function setShopifyDiscountCodeActive(params: {
  storeUrl: string;
  accessToken: string;
  priceRuleId: string;
  active: boolean;
}): Promise<void> {
  const res = await fetch(adminApiUrl(params.storeUrl, `price_rules/${params.priceRuleId}.json`), {
    method: "PUT",
    headers: {
      "X-Shopify-Access-Token": params.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_rule: { ends_at: params.active ? null : new Date(Date.now() - 60_000).toISOString() },
    }),
  });

  if (!res.ok) {
    throw new ShopifyApiError(`No se pudo ${params.active ? "reactivar" : "desactivar"} la regla de precio (${res.status})`);
  }
}

/// Sube (o devuelve a su valor normal) el % de descuento real de una price
/// rule ya creada — a diferencia de setShopifyDiscountCodeActive (que solo
/// prende/apaga sin tocar el valor), esto cambia cuánto descuento recibe el
/// comprador en el checkout real. Se usa para las campañas de "descuento
/// especial temporal" (TEMP_DISCOUNT_BOOST) — al terminar la campaña se
/// vuelve a llamar con el % normal del creador para devolverlo a como
/// estaba.
export async function setShopifyDiscountValue(params: {
  storeUrl: string;
  accessToken: string;
  priceRuleId: string;
  discountPercent: number;
}): Promise<void> {
  const res = await fetch(adminApiUrl(params.storeUrl, `price_rules/${params.priceRuleId}.json`), {
    method: "PUT",
    headers: {
      "X-Shopify-Access-Token": params.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_rule: { value: `-${params.discountPercent}` },
    }),
  });

  if (!res.ok) {
    throw new ShopifyApiError(`No se pudo actualizar el % de descuento de la regla de precio (${res.status})`);
  }
}

/// Forma reducida de un producto tal como lo devuelve products.json — solo
/// los campos que de verdad usamos.
export interface ShopifyProduct {
  id: number | string;
  handle: string;
  title: string;
  status: string; // "active" | "draft" | "archived"
  images: { src: string }[];
  variants: {
    price: string;
    compare_at_price: string | null;
    /// null = Shopify no rastrea inventario para esta variante (siempre
    /// disponible); si lo rastrea, el número real de unidades.
    inventory_management: string | null;
    inventory_quantity: number;
  }[];
}

/// Trae hasta 250 productos activos de la tienda — suficiente para el
/// catálogo de una marca chica/mediana en esta fase. Si más adelante hace
/// falta paginar más allá, Shopify usa cursores (Link header), no offset.
export async function fetchShopifyProducts(params: { storeUrl: string; accessToken: string }): Promise<ShopifyProduct[]> {
  const res = await fetch(adminApiUrl(params.storeUrl, "products.json?limit=250"), {
    headers: { "X-Shopify-Access-Token": params.accessToken },
  });
  if (!res.ok) {
    throw new ShopifyApiError(`No se pudieron traer los productos (${res.status})`);
  }
  const body = await res.json();
  return body.products ?? [];
}

/// Verifica que un webhook realmente venga de Shopify (firma HMAC-SHA256
/// sobre el cuerpo crudo de la petición, comparada con el secreto guardado
/// para esa marca) — sin esto, cualquiera podría inventarse ventas falsas.
export function verifyShopifyWebhookSignature(rawBody: string, hmacHeader: string | null, secret: string) {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false; // longitudes distintas → timingSafeEqual lanza error
  }
}

/// Forma de los campos que realmente usamos del payload del webhook
/// `orders/create` de Shopify — el payload real trae muchos más campos.
export interface ShopifyOrderWebhookPayload {
  id: number | string;
  total_line_items_price: string;
  total_discounts: string;
  discount_codes: { code: string; amount: string; type: string }[];
  created_at: string;
  /// Correo del comprador — Shopify lo manda en el nivel raíz del pedido.
  /// Solo se usa para el detector de fraude "comprador = creador" (ver
  /// checkBuyerIsCreator en attribution-service.ts), nunca se muestra en
  /// ningún lado de la app.
  email?: string | null;
}

export interface ShopifyRefundWebhookPayload {
  order_id: number | string;
}
