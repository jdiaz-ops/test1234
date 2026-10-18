import type { PaymentMode, PaymentProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDERS, isPaymentProviderId } from "@/lib/payment-providers";
import { credentialsFor, hasProductionCredentials } from "@/server/payments/credentials";
import { publicStoreUrl } from "@/lib/store-url";
import { countExternalImages, isExternalImageUrl } from "@/server/services/image-rehost-service";

/// "Lo que falta para vender": la lista que ve la marca en su panel (y el
/// admin en Marcas) con lo que todavía le falta a su tienda para salir en
/// vivo. Casi todo se calcula solo (pagos, envíos, fotos, datos legales,
/// pedido de prueba); revisar productos, el inventario y el dominio los
/// marca la marca a mano porque no hay forma de saberlo desde acá. Ver
/// conversación del 2026-10-18.

export type GoLiveKey = "productos" | "inventario" | "pagos" | "envios" | "fotos" | "legal" | "dominio" | "prueba";

export const GO_LIVE_MANUAL_KEYS: GoLiveKey[] = ["productos", "inventario", "dominio"];

export type GoLiveItem = {
  key: GoLiveKey;
  label: string;
  detail: string;
  done: boolean;
  /// La marca lo marca a mano ("Listo").
  manual: boolean;
  href: string;
  optional?: boolean;
};

export type GoLiveChecklist = {
  items: GoLiveItem[];
  done: number;
  total: number;
  complete: boolean;
  storeUrl: string | null;
};

/// Lo que se lee del perfil para armar la lista.
type BrandFields = {
  storefrontSlug: string | null;
  customDomain: string | null;
  customDomainVerifiedAt: Date | null;
  goLiveChecks: string[];
  paymentProvider: string;
  paymentMode: string;
  gatewayCredentials: unknown;
  wompiPublicKeyProd: string | null;
  wompiPrivateKeyProd: string | null;
  wompiEventsKeyProd: string | null;
  wompiIntegrityKeyProd: string | null;
  wompiPublicKeyTest: string | null;
  wompiPrivateKeyTest: string | null;
  wompiEventsKeyTest: string | null;
  wompiIntegrityKeyTest: string | null;
  legalName: string | null;
  taxId: string | null;
};

type Counts = { products: number; noStock: number; zones: number; orders: number; photos: number };

const BRAND_SELECT = {
  storefrontSlug: true,
  customDomain: true,
  customDomainVerifiedAt: true,
  goLiveChecks: true,
  paymentProvider: true,
  paymentMode: true,
  gatewayCredentials: true,
  wompiPublicKeyProd: true,
  wompiPrivateKeyProd: true,
  wompiEventsKeyProd: true,
  wompiIntegrityKeyProd: true,
  wompiPublicKeyTest: true,
  wompiPrivateKeyTest: true,
  wompiEventsKeyTest: true,
  wompiIntegrityKeyTest: true,
  legalName: true,
  taxId: true,
} as const;

/// Productos que se venden sin control de inventario (ver ProductVariant.stock).
const NO_STOCK_WHERE = {
  manual: true,
  status: { not: "DRAFT" as const },
  type: "PHYSICAL" as const,
  OR: [{ hasVariants: false, stock: null }, { hasVariants: true, variants: { some: { stock: null } } }],
};

function buildItems(brand: BrandFields, counts: Counts): GoLiveChecklist {
  const manual = new Set(brand.goLiveChecks);
  const storeUrl = publicStoreUrl(brand);
  // Pasarela elegida (Wompi, Mercado Pago, PayU, ePayco o Bold), con sus
  // llaves de producción y en modo real — ver src/server/payments.
  const provider = isPaymentProviderId(brand.paymentProvider) ? brand.paymentProvider : null;
  const gatewayFields = brand as BrandFields & { gatewayCredentials: Prisma.JsonValue; paymentProvider: PaymentProvider; paymentMode: PaymentMode };
  const prodKeys = provider ? hasProductionCredentials(gatewayFields, provider) : false;
  const anyKeys = provider ? credentialsFor(gatewayFields, provider, "TEST") !== null || prodKeys : false;
  const live = Boolean(provider) && prodKeys && brand.paymentMode === "PRODUCTION";
  const providerName = provider ? PAYMENT_PROVIDERS[provider].name : null;
  const { products, noStock, zones, orders, photos } = counts;

  const items: GoLiveItem[] = [
    {
      key: "productos",
      label: "Revisa precios, fotos y descripciones",
      detail: products > 0 ? `${products} ${products === 1 ? "producto activo" : "productos activos"} en tu tienda.` : "Todavía no hay productos activos.",
      done: products > 0 && manual.has("productos"),
      manual: true,
      href: "/marca/tienda/productos",
    },
    {
      key: "inventario",
      label: "Pon el inventario de lo que controlas",
      detail:
        noStock > 0
          ? `${noStock} ${noStock === 1 ? "producto se vende" : "productos se venden"} sin control de inventario. Si así lo quieres, márcalo como listo.`
          : "Todo tiene inventario.",
      done: noStock === 0 || manual.has("inventario"),
      manual: true,
      href: "/marca/tienda/productos",
    },
    {
      key: "pagos",
      label: providerName ? `Conecta tus pagos con ${providerName}` : "Conecta tus pagos",
      detail: live
        ? "Llaves de producción y modo real: ya cobras de verdad."
        : prodKeys
          ? "Tienes las llaves de producción; pasa a modo real para cobrar de verdad."
          : anyKeys
            ? "Solo tienes llaves de prueba: pega las de producción."
            : "Pega las llaves de tu pasarela: Wompi, Mercado Pago, PayU, ePayco o Bold.",
      done: live,
      manual: false,
      href: "/marca/tienda/pagos",
    },
    {
      key: "envios",
      label: "Configura tus zonas de envío",
      detail: zones > 0 ? `${zones} ${zones === 1 ? "zona" : "zonas"} de envío.` : "Sin zonas de envío no se puede pagar un pedido.",
      done: zones > 0,
      manual: false,
      href: "/marca/tienda/envios",
    },
    {
      key: "fotos",
      label: "Guarda las fotos en Marcolini",
      detail:
        photos > 0
          ? `${photos} fotos siguen en el servidor de tu tienda anterior: se rompen si la cierras.`
          : "Todas tus fotos están en Marcolini.",
      done: photos === 0,
      manual: false,
      href: "/marca/tienda/productos",
    },
    {
      key: "legal",
      label: "Completa razón social y NIT",
      detail: brand.legalName && brand.taxId ? `${brand.legalName} · NIT ${brand.taxId}` : "Salen en tus cuentas de cobro y facturas.",
      done: Boolean(brand.legalName?.trim() && brand.taxId?.trim()),
      manual: false,
      href: "/marca/perfil",
    },
    {
      key: "dominio",
      label: "Conecta tu dominio (opcional)",
      detail: brand.customDomainVerifiedAt
        ? `${brand.customDomain} verificado.`
        : `O sigue con ${brand.storefrontSlug}.marcolini.lat: márcalo como listo.`,
      done: Boolean(brand.customDomainVerifiedAt) || manual.has("dominio"),
      manual: true,
      href: "/marca/tienda/configuracion",
      optional: true,
    },
    {
      key: "prueba",
      label: "Haz un pedido de prueba",
      detail: orders > 0 ? `${orders} ${orders === 1 ? "pedido" : "pedidos"} en tu tienda.` : "Entra a tu tienda, compra algo y revisa que llegue el pedido y el correo.",
      done: orders > 0,
      manual: false,
      href: storeUrl ?? "/marca/tienda/pedidos",
    },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, complete: done === items.length, storeUrl };
}

/// La lista completa de una marca (con el conteo exacto de fotos externas).
export async function getGoLiveChecklist(brandId: string): Promise<GoLiveChecklist | null> {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId }, select: BRAND_SELECT });
  if (!brand.storefrontSlug) return null;
  const [products, noStock, zones, orders, photos] = await Promise.all([
    prisma.product.count({ where: { brandId, manual: true, status: "ACTIVE" } }),
    prisma.product.count({ where: { brandId, ...NO_STOCK_WHERE } }),
    prisma.shippingZone.count({ where: { brandId } }),
    prisma.storeOrder.count({ where: { brandId } }),
    countExternalImages(brandId),
  ]);
  return buildItems(brand, { products, noStock, zones, orders, photos: photos.total });
}

export type GoLiveSummary = { done: number; total: number; missing: string[] };

/// Para la tabla de Marcas del admin: la misma lista de todas las marcas
/// con tienda, en unas pocas consultas agrupadas (no una por marca). Las
/// fotos externas se miran solo en productos, que es donde casi siempre
/// están; la marca ve el conteo exacto en su panel.
export async function getGoLiveSummaries(brands: (BrandFields & { id: string })[]): Promise<Map<string, GoLiveSummary>> {
  const withStore = brands.filter((b) => b.storefrontSlug);
  const ids = withStore.map((b) => b.id);
  const out = new Map<string, GoLiveSummary>();
  if (ids.length === 0) return out;
  const [products, noStock, zones, orders, external] = await Promise.all([
    prisma.product.groupBy({ by: ["brandId"], where: { brandId: { in: ids }, manual: true, status: "ACTIVE" }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ["brandId"], where: { brandId: { in: ids }, ...NO_STOCK_WHERE }, _count: { _all: true } }),
    prisma.shippingZone.groupBy({ by: ["brandId"], where: { brandId: { in: ids } }, _count: { _all: true } }),
    prisma.storeOrder.groupBy({ by: ["brandId"], where: { brandId: { in: ids } }, _count: { _all: true } }),
    prisma.product.findMany({
      where: {
        brandId: { in: ids },
        OR: [{ imageUrl: { startsWith: "http" } }, { images: { some: { url: { startsWith: "http" } } } }],
      },
      select: { brandId: true, imageUrl: true, images: { where: { url: { startsWith: "http" } }, select: { url: true }, take: 3 } },
      take: 5000,
    }),
  ]);
  const count = (rows: { brandId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.brandId, r._count._all]));
  const productsBy = count(products);
  const noStockBy = count(noStock);
  const zonesBy = count(zones);
  const ordersBy = count(orders);
  const photosBy = new Map<string, number>();
  for (const p of external) {
    const urls = [p.imageUrl, ...p.images.map((i) => i.url)].filter(isExternalImageUrl);
    if (urls.length > 0) photosBy.set(p.brandId, (photosBy.get(p.brandId) ?? 0) + urls.length);
  }
  for (const brand of withStore) {
    const list = buildItems(brand, {
      products: productsBy.get(brand.id) ?? 0,
      noStock: noStockBy.get(brand.id) ?? 0,
      zones: zonesBy.get(brand.id) ?? 0,
      orders: ordersBy.get(brand.id) ?? 0,
      photos: photosBy.get(brand.id) ?? 0,
    });
    out.set(brand.id, { done: list.done, total: list.total, missing: list.items.filter((i) => !i.done).map((i) => i.label) });
  }
  return out;
}

export async function setGoLiveCheck(brandId: string, key: GoLiveKey, done: boolean) {
  if (!GO_LIVE_MANUAL_KEYS.includes(key)) throw new Error("Ese paso se revisa solo.");
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId }, select: { goLiveChecks: true } });
  const next = new Set(brand.goLiveChecks);
  if (done) next.add(key);
  else next.delete(key);
  await prisma.brandProfile.update({ where: { id: brandId }, data: { goLiveChecks: Array.from(next) } });
  return Array.from(next);
}
