/// Píxeles de anuncios de cada marca (Meta y TikTok) en su tienda. La marca
/// solo pega su Pixel ID en Configuración → Píxeles de anuncios; el código
/// base de cada red ya vive en components/storefront/ad-pixels.tsx y acá
/// están los eventos que le avisamos (2026-10-03).
///
/// El ID termina dentro de un <script>, así que SOLO se acepta el formato
/// exacto de cada red (dígitos para Meta; letras y números para TikTok):
/// se valida al guardar y otra vez antes de pintarlo en la tienda.

const META_ID = /^\d{10,20}$/;
const TIKTOK_ID = /^[A-Za-z0-9]{10,30}$/;

/// Acepta el ID solo o el código completo que da Meta (lo saca de
/// `fbq('init', '…')`). "" = sin pixel. null = no se reconoce.
export function parseMetaPixelId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return "";
  const fromSnippet = raw.match(/fbq\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/)?.[1];
  const id = (fromSnippet ?? raw).replace(/\s+/g, "");
  return META_ID.test(id) ? id : null;
}

/// Acepta el ID solo o el código completo que da TikTok (lo saca de
/// `ttq.load('…')`). "" = sin pixel. null = no se reconoce.
export function parseTiktokPixelId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return "";
  const fromSnippet = raw.match(/ttq\.load\(\s*['"]([A-Za-z0-9]+)['"]/)?.[1];
  const id = (fromSnippet ?? raw).replace(/\s+/g, "");
  return TIKTOK_ID.test(id) ? id : null;
}

export function isValidMetaPixelId(id: string | null | undefined): id is string {
  return !!id && META_ID.test(id);
}

export function isValidTiktokPixelId(id: string | null | undefined): id is string {
  return !!id && TIKTOK_ID.test(id);
}

// ---------------------------------------------------------------------------
// Eventos (solo en el navegador). Si la marca no tiene pixel, fbq/ttq no
// existen y no pasa nada.
// ---------------------------------------------------------------------------

export type PixelItem = { id: string; name: string; price: number; quantity: number };

type Fbq = (...args: unknown[]) => void;
type Ttq = { track: (event: string, params?: object, options?: object) => void; page: () => void };

function pixels(): { fbq?: Fbq; ttq?: Ttq } {
  if (typeof window === "undefined") return {};
  const w = window as unknown as { fbq?: Fbq; ttq?: Ttq };
  return { fbq: w.fbq, ttq: w.ttq };
}

const CURRENCY = "COP";

function totalOf(items: PixelItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function send(
  meta: string,
  tiktok: string,
  items: PixelItem[],
  options: { value?: number; eventId?: string } = {},
) {
  const { fbq, ttq } = pixels();
  const value = options.value ?? totalOf(items);
  try {
    fbq?.(
      "track",
      meta,
      {
        content_ids: items.map((i) => i.id),
        content_name: items.length === 1 ? items[0].name : undefined,
        content_type: "product",
        contents: items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
        num_items: items.reduce((n, i) => n + i.quantity, 0),
        value,
        currency: CURRENCY,
      },
      options.eventId ? { eventID: options.eventId } : undefined,
    );
  } catch {
    // Un pixel nunca debe romper la tienda.
  }
  try {
    ttq?.track(
      tiktok,
      {
        contents: items.map((i) => ({
          content_id: i.id,
          content_name: i.name,
          content_type: "product",
          price: i.price,
          quantity: i.quantity,
        })),
        value,
        currency: CURRENCY,
      },
      options.eventId ? { event_id: options.eventId } : undefined,
    );
  } catch {
    // Un pixel nunca debe romper la tienda.
  }
}

export function trackPageView() {
  const { fbq, ttq } = pixels();
  try {
    fbq?.("track", "PageView");
  } catch {}
  try {
    ttq?.page();
  } catch {}
}

export function trackViewContent(item: PixelItem) {
  send("ViewContent", "ViewContent", [{ ...item, quantity: 1 }], { value: item.price });
}

export function trackAddToCart(item: PixelItem) {
  send("AddToCart", "AddToCart", [item]);
}

export function trackInitiateCheckout(items: PixelItem[]) {
  if (items.length === 0) return;
  send("InitiateCheckout", "InitiateCheckout", items);
}

/// Una sola vez por pedido aunque recarguen la página de confirmación. El
/// ID del pedido va como event_id, para que Meta/TikTok no la cuenten doble
/// si más adelante también se avisa desde el servidor.
export function trackPurchase(orderId: string, items: PixelItem[], value: number) {
  const key = `mc_px_purchase_${orderId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Sin localStorage (modo privado): se manda igual.
  }
  send("Purchase", "CompletePayment", items, { value, eventId: orderId });
}
