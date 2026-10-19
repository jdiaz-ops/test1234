import type { PaymentMode, PaymentProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDERS, isPaymentProviderId } from "@/lib/payment-providers";
import { credentialsFor, hasProductionCredentials } from "@/server/payments/credentials";
import { publicStoreUrl } from "@/lib/store-url";

/// "Lo que falta para ser visible en el marketplace": la lista que ve la
/// marca en su panel (y el admin en Marcas). Es el onboarding de la marca:
/// cuando todo está listo (y la marca está aprobada), sale para las
/// creadoras — ver listActiveOffers en marketplace-service.ts. Se calcula
/// solo, salvo el inventario, que la marca marca a mano si vende sin
/// control. Pedido del 2026-10-19: estos cinco pasos, en este orden,
/// reemplazan los 4 pasos de "Empieza aquí" (antes la lista era "Lo que
/// falta para vender", con productos, fotos, dominio y pedido de prueba).

export type GoLiveKey = "productos" | "inventario" | "pagos" | "envios" | "fotos" | "legal" | "dominio" | "prueba" | "programa";

/// "productos", "fotos", "dominio" y "prueba" ya no están en la lista (pueden
/// seguir guardados en goLiveChecks de antes, no estorban).
export type GoLiveKeyActive = "legal" | "envios" | "pagos" | "inventario" | "programa";

export const GO_LIVE_MANUAL_KEYS: GoLiveKey[] = ["inventario"];

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

type Counts = { noStock: number; zones: number; pendingRates: number; activeOffers: number };

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
  const { noStock, zones, pendingRates, activeOffers } = counts;

  const items: GoLiveItem[] = [
    {
      key: "legal",
      label: "Completa razón social y NIT",
      detail: brand.legalName && brand.taxId ? `${brand.legalName} · NIT ${brand.taxId}` : "Salen en tus cuentas de cobro y facturas.",
      done: Boolean(brand.legalName?.trim() && brand.taxId?.trim()),
      manual: false,
      href: "/marca/perfil",
    },
    {
      key: "envios",
      label: "Configura tus zonas de envío",
      detail:
        zones === 0
          ? "Sin zonas de envío no se puede pagar un pedido."
          : pendingRates > 0
            ? `${pendingRates} ${pendingRates === 1 ? "tarifa venía" : "tarifas venían"} como contraentrega y Marcolini no lo permite: ponle precio al envío en Envíos.`
            : `${zones} ${zones === 1 ? "zona" : "zonas"} de envío.`,
      done: zones > 0 && pendingRates === 0,
      manual: false,
      href: "/marca/tienda/envios",
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
            : "Pega las llaves de tu pasarela: Wompi, Mercado Pago o ePayco.",
      done: live,
      manual: false,
      href: "/marca/tienda/pagos",
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
      key: "programa",
      label: "Configura tu programa de creadores",
      detail:
        activeOffers > 0
          ? "Tu programa está activo: las creadoras pueden unirse y vender con su código."
          : "Define la comisión para las creadoras y el descuento para su comunidad.",
      done: activeOffers > 0,
      manual: false,
      href: "/marca/cuenta?tab=oferta",
    },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, complete: done === items.length, storeUrl };
}

/// La lista completa de una marca (con el conteo exacto de fotos externas).
export async function getGoLiveChecklist(brandId: string): Promise<GoLiveChecklist | null> {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId }, select: BRAND_SELECT });
  if (!brand.storefrontSlug) return null;
  const [noStock, zones, pendingRates, activeOffers] = await Promise.all([
    prisma.product.count({ where: { brandId, ...NO_STOCK_WHERE } }),
    prisma.shippingZone.count({ where: { brandId } }),
    prisma.shippingZoneRate.count({ where: { zone: { brandId }, pendingPrice: true } }),
    prisma.offer.count({ where: { brandId, status: "ACTIVE" } }),
  ]);
  return buildItems(brand, { noStock, zones, pendingRates, activeOffers });
}

export type GoLiveSummary = { done: number; total: number; missing: string[] };

/// Para la tabla de Marcas del admin y el marketplace: la misma lista de
/// todas las marcas con tienda, en unas pocas consultas agrupadas (no una
/// por marca).
export async function getGoLiveSummaries(brands: (BrandFields & { id: string })[]): Promise<Map<string, GoLiveSummary>> {
  const withStore = brands.filter((b) => b.storefrontSlug);
  const ids = withStore.map((b) => b.id);
  const out = new Map<string, GoLiveSummary>();
  if (ids.length === 0) return out;
  const [noStock, zones, pendingRates, offers] = await Promise.all([
    prisma.product.groupBy({ by: ["brandId"], where: { brandId: { in: ids }, ...NO_STOCK_WHERE }, _count: { _all: true } }),
    prisma.shippingZone.groupBy({ by: ["brandId"], where: { brandId: { in: ids } }, _count: { _all: true } }),
    prisma.shippingZoneRate.findMany({
      where: { zone: { brandId: { in: ids } }, pendingPrice: true },
      select: { zone: { select: { brandId: true } } },
    }),
    prisma.offer.groupBy({ by: ["brandId"], where: { brandId: { in: ids }, status: "ACTIVE" }, _count: { _all: true } }),
  ]);
  const count = (rows: { brandId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.brandId, r._count._all]));
  const noStockBy = count(noStock);
  const zonesBy = count(zones);
  const offersBy = count(offers);
  const pendingBy = new Map<string, number>();
  for (const r of pendingRates) pendingBy.set(r.zone.brandId, (pendingBy.get(r.zone.brandId) ?? 0) + 1);
  for (const brand of withStore) {
    const list = buildItems(brand, {
      noStock: noStockBy.get(brand.id) ?? 0,
      zones: zonesBy.get(brand.id) ?? 0,
      pendingRates: pendingBy.get(brand.id) ?? 0,
      activeOffers: offersBy.get(brand.id) ?? 0,
    });
    out.set(brand.id, { done: list.done, total: list.total, missing: list.items.filter((i) => !i.done).map((i) => i.label) });
  }
  return out;
}

/// Las marcas (de entre `brandIds`) con toda la lista lista: las que salen
/// en el marketplace en modo Auto (ver listActiveOffers).
export async function goLiveReadyBrandIds(brandIds: string[]): Promise<Set<string>> {
  if (brandIds.length === 0) return new Set();
  const brands = await prisma.brandProfile.findMany({ where: { id: { in: brandIds } }, select: { id: true, ...BRAND_SELECT } });
  const summaries = await getGoLiveSummaries(brands);
  return new Set(Array.from(summaries).filter(([, s]) => s.done === s.total).map(([id]) => id));
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
