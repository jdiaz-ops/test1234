import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createShopifyDiscountCode, ShopifyApiError } from "@/server/integrations/shopify-client";
import { createWooCommerceCoupon, WooCommerceApiError } from "@/server/integrations/woocommerce-client";
import { createCommissionForTransaction, reverseCommissionForTransaction } from "@/server/services/commission-service";
import { checkGoalBonusProgress } from "@/server/services/challenge-service";
import { createNotification } from "@/server/services/notification-service";
import { flagPotentialFraud } from "@/server/services/admin-fraud-service";

export class AttributionError extends Error {}

/// Motor de Atribución: recibe pedidos y reembolsos ya verificados (firma de
/// webhook comprobada por el caller) desde Shopify/WooCommerce, encuentra a
/// qué creador pertenece el código de descuento usado, y crea/actualiza el
/// Transaction correspondiente. Cada venta nueva y cada reembolso se pasan
/// de inmediato al Motor de Comisiones para que calcule/revierta el reparto.

interface RecordOrderParams {
  brandId: string;
  source: "SHOPIFY" | "WOOCOMMERCE" | "MANUAL";
  externalOrderId: string;
  /// Código de descuento tal como vino en el pedido — puede venir con
  /// mayúsculas/espacios distintos a como se guardó, por eso se normaliza.
  discountCode: string | null;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  occurredAt: Date;
  /// Solo tiene sentido con source MANUAL — ver Transaction.note.
  note?: string;
  /// Correo del comprador, si el webhook de la tienda lo trae (o la marca
  /// lo escribió en una venta manual) — ver Transaction.customerEmail.
  customerEmail?: string | null;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

/// Se llama justo después de que una inscripción queda ACTIVE (al unirse
/// directo en ofertas OPEN, o al aprobarla en ofertas APPROVAL). Intenta
/// crear el código de descuento real en la tienda de la marca si hay
/// credenciales guardadas; si falla o no hay tienda conectada, el código
/// del creador (ya guardado en discountCode desde que se creó la
/// inscripción) queda disponible igual para reporte manual — nunca bloquea
/// el flujo de unión de un creador.
export async function provisionDiscountCodeForEnrollment(enrollmentId: string) {
  const enrollment = await prisma.creatorOfferEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { creator: true, offer: { include: { brand: true } } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") return;

  const { offer } = enrollment;
  const { brand } = offer;
  const discountPercent = Number(enrollment.discountPercentOverride ?? offer.defaultDiscountPercent);
  const code = enrollment.discountCode;

  try {
    if (brand.storeType === "SHOPIFY" && brand.storeUrl && brand.shopifyAccessToken) {
      const { priceRuleId } = await createShopifyDiscountCode({
        storeUrl: brand.storeUrl,
        accessToken: brand.shopifyAccessToken,
        code,
        discountPercent,
      });
      await prisma.creatorOfferEnrollment.update({
        where: { id: enrollmentId },
        data: { shopifyPriceRuleId: priceRuleId },
      });
    } else if (brand.storeType === "WOOCOMMERCE" && brand.storeUrl && brand.wooConsumerKey && brand.wooConsumerSecret) {
      const { couponId } = await createWooCommerceCoupon({
        storeUrl: brand.storeUrl,
        consumerKey: brand.wooConsumerKey,
        consumerSecret: brand.wooConsumerSecret,
        code,
        discountPercent,
      });
      await prisma.creatorOfferEnrollment.update({
        where: { id: enrollmentId },
        data: { wooCouponId: couponId },
      });
    }
    // Sin tienda conectada (StoreType.OTHER o sin credenciales): el código
    // queda registrado para que la marca lo cree a mano o reporte ventas
    // manualmente — comportamiento ya soportado desde el principio.
  } catch (err) {
    // No propagamos el error: el creador ya quedó unido a la oferta, y la
    // marca puede crear el código a mano mientras resuelve la conexión.
    // Guardamos evidencia visible marcando la tienda con error.
    const isKnownApiError = err instanceof ShopifyApiError || err instanceof WooCommerceApiError;
    console.error(
      `[atribución] No se pudo crear el código "${code}" en la tienda de la marca ${brand.id}:`,
      isKnownApiError ? err.message : err
    );
    await prisma.brandProfile.update({
      where: { id: brand.id },
      data: { storeConnectionStatus: "ERROR" },
    });

    const admins = await prisma.user.findMany({ where: { role: "ADMIN", adminRole: "OWNER" }, select: { id: true } });
    await Promise.all(
      admins.map((admin) => createNotification(admin.id, "STORE_CONNECTION_ERROR_ADMIN", { marca: brand.companyName }))
    );
  }
}

/// Busca la inscripción activa de un creador en una marca a partir del
/// código de descuento usado en el pedido. Solo mira ofertas de esa marca —
/// el mismo código nunca se comparte entre marcas.
export async function findEnrollmentByDiscountCode(brandId: string, rawCode: string) {
  const code = normalizeCode(rawCode);
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: {
      status: "ACTIVE",
      offer: { brandId },
    },
    include: { offer: true },
  });
  return enrollments.find((e) => normalizeCode(e.discountCode) === code) ?? null;
}

/// Procesa un pedido nuevo (webhook `orders/create` de Shopify u
/// `order.created`/`order.updated` de WooCommerce). Idempotente: si ya
/// existe un Transaction para esa marca+fuente+orderId, no crea uno nuevo
/// (Shopify y WooCommerce reintentan el envío del webhook si no reciben 200
/// a tiempo).
export async function recordOrderFromWebhook(params: RecordOrderParams) {
  const existing = await prisma.transaction.findUnique({
    where: {
      brandId_source_externalOrderId: {
        brandId: params.brandId,
        source: params.source,
        externalOrderId: params.externalOrderId,
      },
    },
  });
  if (existing) return { transaction: existing, created: false as const };

  if (!params.discountCode) {
    // Pedido sin código de nuestro programa — no es un error, simplemente
    // no hay nada que atribuir (venta orgánica de la tienda).
    return { transaction: null, created: false as const, reason: "SIN_CODIGO" as const };
  }

  const enrollment = await findEnrollmentByDiscountCode(params.brandId, params.discountCode);
  if (!enrollment) {
    return { transaction: null, created: false as const, reason: "CODIGO_NO_ENCONTRADO" as const };
  }

  const transaction = await prisma.transaction.create({
    data: {
      brandId: params.brandId,
      offerId: enrollment.offerId,
      creatorId: enrollment.creatorId,
      enrollmentId: enrollment.id,
      source: params.source,
      externalOrderId: params.externalOrderId,
      grossAmount: new Prisma.Decimal(params.grossAmount),
      discountAmount: new Prisma.Decimal(params.discountAmount),
      netAmount: new Prisma.Decimal(params.netAmount),
      status: "COMPLETED",
      occurredAt: params.occurredAt,
      note: params.note,
      customerEmail: params.customerEmail?.trim().toLowerCase() || null,
    },
  });

  await createCommissionForTransaction(transaction.id);
  await checkGoalBonusProgress(enrollment.offerId, enrollment.creatorId);
  await checkAbnormalOrderSpike(enrollment.id);
  await checkBuyerIsCreator(enrollment.id, transaction.id, transaction.customerEmail);

  return { transaction, created: true as const };
}

/// Detector de fraude #2 (el segundo de los que documenta el schema en
/// FraudFlag.reason): que el creador compre con su propio código para
/// cobrarse su propia comisión. Solo puede correr cuando el pedido trajo
/// el correo del comprador — ver Transaction.customerEmail.
async function checkBuyerIsCreator(enrollmentId: string, transactionId: string, customerEmail: string | null) {
  if (!customerEmail) return;

  const enrollment = await prisma.creatorOfferEnrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { creator: { include: { user: true } }, offer: { include: { brand: true } } },
  });

  if (enrollment.creator.user.email.toLowerCase() !== customerEmail) return;

  await flagPotentialFraud(
    transactionId,
    `El comprador usó el mismo correo que el creador ${enrollment.creator.displayName} (${customerEmail}) en ${enrollment.offer.brand.companyName}`
  );
}

const SPIKE_WINDOW_MINUTES = 60;
const SPIKE_THRESHOLD = 5;

/// Detector de fraude #1 (de los dos que documenta el schema en
/// FraudFlag.reason): un código de descuento generando muchas órdenes en
/// poco tiempo — puede ser el creador compartiendo/vendiendo su código, o
/// alguien abusando de un descuento. Corre en cada venta nueva; nunca
/// bloquea la venta, solo la deja marcada para que el admin la revise.
async function checkAbnormalOrderSpike(enrollmentId: string) {
  const since = new Date(Date.now() - SPIKE_WINDOW_MINUTES * 60 * 1000);
  const recentTransactions = await prisma.transaction.findMany({
    where: { enrollmentId, status: { not: "REFUNDED" }, occurredAt: { gte: since } },
    select: { id: true },
    orderBy: { occurredAt: "desc" },
  });
  if (recentTransactions.length < SPIKE_THRESHOLD) return;

  // Un solo flag por racha — si alguna de las ventas de esta ventana ya
  // generó un flag sin revisar, no se duplica en cada venta nueva mientras
  // dure el pico (FraudFlag.transactionId no tiene relación real en el
  // schema — es un id suelto — por eso se busca por lista de ids).
  const alreadyFlagged = await prisma.fraudFlag.findFirst({
    where: { status: "PENDING_REVIEW", transactionId: { in: recentTransactions.map((t) => t.id) } },
  });
  if (alreadyFlagged) return;

  const enrollment = await prisma.creatorOfferEnrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { creator: true, offer: { include: { brand: true } } },
  });

  await flagPotentialFraud(
    recentTransactions[0].id,
    `Pico anormal de órdenes: ${recentTransactions.length} ventas con el código de ${enrollment.creator.displayName} en ${enrollment.offer.brand.companyName} en la última hora`
  );
}

/// Procesa un reembolso (webhook `refunds/create` de Shopify o
/// `order.updated`→status `refunded` de WooCommerce). Shopify/WooCommerce no
/// siempre indican si el reembolso fue parcial o total en el payload
/// mínimo que consumimos, así que por ahora se marca el pedido completo
/// como REFUNDED — esto detiene la comisión en la tarea siguiente, que es
/// el comportamiento seguro por defecto.
export async function recordRefundFromWebhook(params: {
  brandId: string;
  source: "SHOPIFY" | "WOOCOMMERCE";
  externalOrderId: string;
  refundedAt: Date;
}) {
  const transaction = await prisma.transaction.findUnique({
    where: {
      brandId_source_externalOrderId: {
        brandId: params.brandId,
        source: params.source,
        externalOrderId: params.externalOrderId,
      },
    },
  });

  if (!transaction) {
    return { transaction: null, updated: false as const, reason: "PEDIDO_NO_ENCONTRADO" as const };
  }
  if (transaction.status === "REFUNDED") {
    return { transaction, updated: false as const };
  }

  const updated = await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: "REFUNDED", refundedAt: params.refundedAt },
  });

  await reverseCommissionForTransaction(updated.id);

  return { transaction: updated, updated: true as const };
}

export class ManualSaleError extends Error {}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/// Reporte manual de venta — para la marca que no tiene Shopify/WooCommerce
/// conectado (StoreType.OTHER), o para esa venta puntual que pasó por fuera
/// de la tienda (ej. un pedido cerrado por WhatsApp). Lo registra la propia
/// marca desde Transacciones. Reusa recordOrderFromWebhook para que el
/// cálculo de comisión, el hold de reembolsos y el chequeo de retos
/// GOAL_BONUS sean exactamente los mismos que en una venta automática — lo
/// único que cambia es de dónde vino el dato.
export async function recordManualSale(params: {
  brandId: string;
  discountCode: string;
  grossAmount: number;
  occurredAt: Date;
  note?: string;
  customerEmail?: string;
}) {
  if (!(params.grossAmount > 0)) {
    throw new ManualSaleError("El monto debe ser mayor a cero.");
  }

  const enrollment = await findEnrollmentByDiscountCode(params.brandId, params.discountCode);
  if (!enrollment) {
    throw new ManualSaleError("No encontramos ese código entre tus creadores vinculados y activos.");
  }

  const discountPercent = Number(enrollment.discountPercentOverride ?? enrollment.offer.defaultDiscountPercent);
  const discountAmount = round2(params.grossAmount * (discountPercent / 100));
  const netAmount = round2(params.grossAmount - discountAmount);

  return recordOrderFromWebhook({
    brandId: params.brandId,
    source: "MANUAL",
    externalOrderId: `MANUAL-${randomUUID()}`,
    discountCode: params.discountCode,
    grossAmount: params.grossAmount,
    discountAmount,
    netAmount,
    occurredAt: params.occurredAt,
    note: params.note,
    customerEmail: params.customerEmail,
  });
}
