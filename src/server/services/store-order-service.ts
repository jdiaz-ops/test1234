import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { portalUrl, publicStoreUrl } from "@/lib/store-url";
import { emitCustomerEvent, emitOrderEvent } from "@/server/services/webhook-service";
import { issueInvoiceAfterPayment } from "@/server/services/dataico-service";
import {
  getActiveWompiKeys,
  findWompiTransactionByReference,
  buildIntegritySignature,
} from "@/server/integrations/wompi-client";
import {
  findEnrollmentByDiscountCode,
  recordOrderFromWebhook,
} from "@/server/services/attribution-service";
import { sendServiceBookingConfirmedEmail } from "@/lib/email";
import {
  listShippingZones,
  matchShippingZone,
  pickShippingRate,
} from "@/server/services/shipping-zone-service";
import { ensureStoreCustomerExists } from "@/server/services/store-customer-service";
import {
  taxIncluded,
  orderTotal,
  stockMovements,
  availableStock,
  RESERVATION_MINUTES,
} from "@/lib/order-math";
import { applyStockMovements } from "@/server/services/store-stock-service";
import {
  sendOrderPaidEmails,
  sendOrderShippedEmailFor,
  sendOrderRefundedEmailFor,
} from "@/server/services/store-order-email-service";
import { recordRefundFromWebhook } from "@/server/services/attribution-service";

/// Carrito y checkout nativos de "Mi tienda" — la vitrina pública de una
/// marca en marcolini.lat/t/{storefrontSlug}. El carrito vive en el
/// navegador (localStorage); este servicio solo entra en juego al pasar al
/// checkout: valida productos y código, calcula totales, y arma lo que
/// necesita el botón de Wompi para cobrar con las llaves propias de la
/// marca.

export class StoreOrderError extends Error {}

export async function getStorefrontBrand(slug: string) {
  return prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
  });
}

/// Solo ACTIVE aparece en el catálogo — UNLISTED existe (se puede ver y
/// comprar con el link directo, ver getStorefrontProduct) pero no sale
/// acá, y DRAFT no se puede ver de ninguna forma. Ver ProductStatus en el
/// schema y conversación del 2026-09-14.
export async function listStorefrontProducts(brandId: string) {
  return prisma.product.findMany({
    where: { brandId, manual: true, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
}

/// Buscador de la vitrina (header, "Buscador grande" en Diseño →
/// Encabezado) — coincide por nombre o SKU, sin distinguir mayúsculas.
/// Ver conversación del 2026-09-15.
export async function searchStorefrontProducts(brandId: string, query: string) {
  const q = query.trim();
  if (!q) return [];
  return prisma.product.findMany({
    where: {
      brandId,
      manual: true,
      status: "ACTIVE",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}

/// Para links viejos de la tienda Shopify que la marca migró (Instagram,
/// WhatsApp, Google): el handle de Shopify queda guardado en externalId
/// ("shopify-csv-{handle}", ver shopify-csv-import-service.ts), así que si
/// un slug no existe se busca por ahí y la página redirige al slug actual.
/// Ver conversación del 2026-09-30.
export async function findStorefrontProductByShopifyHandle(brandId: string, handle: string) {
  return prisma.product.findFirst({
    where: { brandId, manual: true, externalId: `shopify-csv-${handle}`, status: { not: "DRAFT" } },
    select: { slug: true },
  });
}

export async function getStorefrontProduct(brandId: string, slug: string) {
  return prisma.product.findFirst({
    where: { brandId, manual: true, slug, status: { not: "DRAFT" } },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
    },
  });
}

/// Productos relacionados para el detalle de producto — mismo criterio
/// simple: comparten al menos una colección con este, excluyéndolo a él.
/// No hay curación manual todavía (ver theme.productDetail.relatedTitles
/// para los títulos configurables) — se arma solo.
export async function getRelatedProducts(brandId: string, productId: string, limit = 4) {
  const collectionIds = (
    await prisma.productBrandCollection.findMany({
      where: { productId },
      select: { collectionId: true },
    })
  ).map((c) => c.collectionId);
  if (collectionIds.length === 0) return [];

  const related = await prisma.product.findMany({
    where: {
      brandId,
      manual: true,
      status: "ACTIVE",
      id: { not: productId },
      brandCollections: { some: { collectionId: { in: collectionIds } } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      type: true,
    },
    take: limit,
  });
  return related;
}

/// "Completa tu compra" en el carrito (ver theme.cart.suggestComplementary
/// y CartList): hasta `limit` productos activos de las mismas colecciones
/// que los que ya lleva el comprador, sin repetir los del carrito. Si no
/// hay ninguno (productos sin colección, o la colección entera ya está en
/// el carrito), los más recientes de la tienda. Ver conversación del
/// 2026-09-30.
export async function getComplementaryProducts(brandId: string, cartProductIds: string[], limit = 4) {
  const select = {
    id: true,
    name: true,
    slug: true,
    imageUrl: true,
    price: true,
    compareAtPrice: true,
    stock: true,
    type: true,
    hasVariants: true,
  } as const;
  const base = { brandId, manual: true as const, status: "ACTIVE" as const, id: { notIn: cartProductIds } };

  const collectionIds = (
    await prisma.productBrandCollection.findMany({
      where: { productId: { in: cartProductIds } },
      select: { collectionId: true },
    })
  ).map((c) => c.collectionId);

  const fromCollections =
    collectionIds.length > 0
      ? await prisma.product.findMany({
          where: { ...base, brandCollections: { some: { collectionId: { in: collectionIds } } } },
          select,
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [];
  if (fromCollections.length >= limit) return fromCollections;

  const seen = new Set(fromCollections.map((p) => p.id));
  const latest = await prisma.product.findMany({
    where: { ...base, id: { notIn: [...cartProductIds, ...seen] } },
    select,
    orderBy: { createdAt: "desc" },
    take: limit - fromCollections.length,
  });
  return [...fromCollections, ...latest];
}

/// Cotiza el envío para un departamento + peso/monto dados, sin crear
/// nada — el checkout la usa para mostrar el costo real antes de pagar
/// (ya no hay tarifa única de respaldo, ver createStoreOrder). Null si la
/// tienda no tiene zonas, ninguna cubre el departamento, o ninguna tarifa
/// de la zona aplica al pedido — el checkout muestra el mensaje
/// correspondiente en cada caso.
export async function quoteShipping(
  brandId: string,
  params: { region: string; orderAmountCents: number; weightKg: number },
) {
  const zones = await listShippingZones(brandId);
  if (zones.length === 0) return { ok: false as const, reason: "NO_ZONES" as const };
  const zone = matchShippingZone(zones, params.region);
  if (!zone) return { ok: false as const, reason: "NO_ZONE_MATCH" as const };
  const rate = pickShippingRate(zone.rates, {
    orderAmountCents: params.orderAmountCents,
    weightKg: params.weightKg,
  });
  if (!rate) return { ok: false as const, reason: "NO_RATE_MATCH" as const };
  return { ok: true as const, shippingCents: Math.round(Number(rate.price) * 100), rateName: rate.name };
}

/// Valida un código de creador sin crear nada — se usa para mostrar el
/// descuento en vivo en el checkout antes de confirmar el pedido.
export async function previewDiscountCode(brandId: string, rawCode: string) {
  const enrollment = await findEnrollmentByDiscountCode(brandId, rawCode);
  if (!enrollment) {
    throw new StoreOrderError("Ese código no aplica para esta tienda.");
  }
  const discountPercent = Number(
    enrollment.discountPercentOverride ??
      enrollment.offer.defaultDiscountPercent,
  );
  return { discountPercent };
}

type CartItemInput = {
  productId: string;
  /// Solo si el producto tiene variantes — ver Product.hasVariants.
  variantId?: string;
  quantity: number;
};

type CreateOrderInput = {
  items: CartItemInput[];
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  /// Solo hace falta si el carrito trae algún producto PHYSICAL — ver el
  /// chequeo de "no mezclar tipos" más abajo.
  shippingAddress?: string;
  shippingCity?: string;
  /// Departamento elegido en el checkout — determina qué zona de envío
  /// aplica (ver matchShippingZone). Requerido junto con shippingAddress/
  /// shippingCity para un carrito con productos físicos.
  shippingRegion?: string;
  shippingNotes?: string | null;
  /// Solo hace falta si el carrito es 100% de servicios.
  servicePreferredAt?: string | null;
  discountCode?: string | null;
  /// Casilla de autorización de datos personales del checkout.
  dataConsent?: boolean;
  /// Factura electrónica a nombre del comprador (ver dataico-service.ts).
  billingIdType?: string;
  billingIdNumber?: string;
  billingName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingRegion?: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  shippingPostalCode?: string;
  acceptsMarketing?: boolean;
};

/// A dónde vuelve el comprador después de pagar en Wompi: la página del
/// pedido en el link real de la tienda ({slug}.marcolini.lat o su dominio
/// propio). Antes salía de NEXT_PUBLIC_APP_URL, que no está configurada en
/// producción, y quedaba "http://localhost:3000/..." — el firewall de
/// Wompi rechazaba el pago (403 en el link, ventana de pago cargando para
/// siempre). Ver conversación del 2026-10-01.
function paymentReturnUrl(
  brand: { customDomain: string | null; customDomainVerifiedAt: Date | null; storefrontSlug: string | null },
  orderId: string,
) {
  const store = publicStoreUrl(brand);
  return store ? `${store}/pedido/${orderId}` : `${portalUrl()}/t/${brand.storefrontSlug}/pedido/${orderId}`;
}

export async function createStoreOrder(slug: string, input: CreateOrderInput) {
  if (input.items.length === 0) {
    throw new StoreOrderError("El carrito está vacío.");
  }
  if (input.dataConsent !== true) {
    throw new StoreOrderError("Para continuar, autoriza el tratamiento de tus datos personales.");
  }

  const brand = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
  });
  if (!brand) throw new StoreOrderError("Tienda no encontrada.");

  const keys = getActiveWompiKeys(brand);
  if (!keys) {
    throw new StoreOrderError(
      "Esta tienda todavía no activó los pagos — vuelve más tarde.",
    );
  }

  // Con facturación electrónica activa (Dataico), la cédula o NIT es
  // obligatoria — el checkout la pide; esto cubre a quien llame la API
  // directo.
  const invoicing = await prisma.dataicoConnection.findUnique({
    where: { brandId: brand.id },
    select: { enabled: true },
  });
  if (invoicing?.enabled && !(input.billingIdType && input.billingIdNumber?.trim())) {
    throw new StoreOrderError("Escribe tu cédula o NIT para la factura electrónica.");
  }

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, brandId: brand.id, manual: true },
    include: { variants: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotalCents = 0;
  let totalWeightKg = 0;
  const itemsData: {
    productId: string;
    variantId: string | null;
    variantLabel: string | null;
    name: string;
    unitPriceCents: number;
    quantity: number;
    imageUrl: string | null;
  }[] = [];

  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product || !product.available) {
      throw new StoreOrderError("Uno de los productos ya no está disponible.");
    }
    if (item.quantity < 1) {
      throw new StoreOrderError("Cantidad inválida.");
    }

    let unitPrice = Number(product.price);
    let itemWeight = product.weight != null ? Number(product.weight) : 0;
    let itemImageUrl = product.imageUrl;
    let variantId: string | null = null;
    let variantLabel: string | null = null;

    if (product.hasVariants) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant) {
        throw new StoreOrderError(
          `Elige una combinación válida de "${product.name}".`,
        );
      }
      if (variant.stock < item.quantity) {
        throw new StoreOrderError(
          `No hay suficiente stock de "${product.name}" en esa combinación.`,
        );
      }
      unitPrice = variant.price != null ? Number(variant.price) : unitPrice;
      itemWeight = variant.weight != null ? Number(variant.weight) : itemWeight;
      itemImageUrl = variant.imageUrl ?? itemImageUrl;
      variantId = variant.id;
      variantLabel = product.optionNames
        .map((name, idx) => {
          const value = [
            variant.option1Value,
            variant.option2Value,
            variant.option3Value,
          ][idx];
          return value ? `${name}: ${value}` : null;
        })
        .filter(Boolean)
        .join(" · ");
    } else if (product.stock != null && product.stock < item.quantity) {
      throw new StoreOrderError(
        product.type === "SERVICE"
          ? `No quedan cupos de "${product.name}".`
          : `No hay suficiente stock de "${product.name}".`,
      );
    }

    const unitPriceCents = Math.round(unitPrice * 100);
    subtotalCents += unitPriceCents * item.quantity;
    totalWeightKg += itemWeight * item.quantity;
    itemsData.push({
      productId: product.id,
      variantId,
      variantLabel,
      name: product.name,
      unitPriceCents,
      quantity: item.quantity,
      imageUrl: itemImageUrl,
    });
  }

  // Un carrito nunca mezcla tipos de producto (físico / servicio / digital)
  // — cada uno necesita datos distintos al pagar (envío vs. fecha/hora vs.
  // nada) y sería confuso resolverlos en un mismo formulario. Si el
  // comprador quiere varios tipos, hace pedidos separados.
  const cartTypes = new Set(input.items.map((i) => productMap.get(i.productId)!.type));
  if (cartTypes.size > 1) {
    throw new StoreOrderError(
      "No puedes mezclar distintos tipos de producto en el mismo pedido — hazlos por separado.",
    );
  }
  const isServiceOrder = cartTypes.has("SERVICE");
  const isDigitalOrder = cartTypes.has("DIGITAL");

  let servicePreferredAt: Date | null = null;
  if (isServiceOrder) {
    if (!input.servicePreferredAt) {
      throw new StoreOrderError("Elige la fecha y hora que prefieres.");
    }
    servicePreferredAt = new Date(input.servicePreferredAt);
    if (Number.isNaN(servicePreferredAt.getTime()) || servicePreferredAt.getTime() < Date.now()) {
      throw new StoreOrderError("Elige una fecha y hora válida, más adelante en el tiempo.");
    }
  } else if (!isDigitalOrder) {
    // Un producto digital no se envía ni se reserva — no pide nada de esto.
    if (
      !input.shippingAddress?.trim() ||
      !input.shippingCity?.trim() ||
      !input.shippingRegion?.trim()
    ) {
      throw new StoreOrderError(
        "Ingresa tu dirección, ciudad y departamento de envío.",
      );
    }
  }

  let discountCode: string | null = null;
  let discountCents = 0;
  if (input.discountCode && input.discountCode.trim()) {
    const { discountPercent } = await previewDiscountCode(
      brand.id,
      input.discountCode,
    );
    discountCode = input.discountCode.trim().toUpperCase();
    discountCents = Math.round((subtotalCents * discountPercent) / 100);
  }

  const afterDiscount = subtotalCents - discountCents;

  // Zona de envío que cubra el departamento elegido (o la zona catch-all
  // "Resto de Colombia") — cada zona puede traer varias tarifas con
  // condición (peso, monto del pedido) y pickShippingRate elige la más
  // barata entre las que aplican. Ya no hay tarifa/umbral únicos de
  // respaldo (BrandProfile.shippingFlatRate/freeShippingThreshold quedaron
  // solo por compatibilidad con pedidos viejos) — toda marca con productos
  // físicos necesita al menos una ShippingZone configurada. Ver
  // conversación del 2026-09-14: "tienen que crear zonas de envío
  // obligatorio".
  let shippingCents = 0;
  let shippingMethod: string | null = null;
  if (!isServiceOrder && !isDigitalOrder) {
    const zones = await listShippingZones(brand.id);
    if (zones.length === 0) {
      throw new StoreOrderError(
        "Esta tienda todavía no configuró sus zonas de envío — vuelve más tarde.",
      );
    }
    const zone = matchShippingZone(zones, input.shippingRegion!);
    if (!zone) {
      throw new StoreOrderError(
        "Todavía no hacemos envíos a tu departamento — contacta a la tienda.",
      );
    }
    const rate = pickShippingRate(zone.rates, {
      orderAmountCents: afterDiscount,
      weightKg: totalWeightKg,
    });
    if (!rate) {
      throw new StoreOrderError(
        "No hay una tarifa de envío que aplique a tu pedido — contacta a la tienda.",
      );
    }
    shippingCents = Math.round(Number(rate.price) * 100);
    shippingMethod = rate.name;
  }

  // Los precios ya traen el IVA (precio al público). taxCents es la parte
  // del subtotal con descuento que corresponde al impuesto — informativa,
  // para el comprobante y la contabilidad de la marca — y NO se suma al
  // total. Antes se calculaba encima del precio y se cobraba de más ("el
  // precio que se ingresa viene IVA incluido"). Se guarda en centavos, no
  // el %, para que un pedido viejo no cambie si la marca ajusta la tasa
  // después (ver StoreOrder.taxCents). Ver conversación del 2026-09-30.
  const taxCents = taxIncluded(afterDiscount, Number(brand.taxRatePercent));

  const totalCents = orderTotal({ subtotal: subtotalCents, discount: discountCents, shipping: shippingCents });
  if (totalCents <= 0) {
    throw new StoreOrderError("El total del pedido debe ser mayor a cero.");
  }

  const reference = `mt_${randomUUID()}`;

  const order = await prisma.$transaction(async (tx) => {
    // Apartar el inventario: un pedido sin pagar aparta sus unidades por
    // RESERVATION_MINUTES. Se bloquean las filas de los productos (en orden
    // de id, para que dos pedidos simultáneos no se traben entre sí) y se
    // vuelve a contar lo disponible = inventario menos lo apartado por
    // otros pedidos vigentes. Así dos personas no pueden pagar la misma
    // última unidad. El inventario guardado no se toca hasta que se paga
    // (ver applyWompiTransactionStatus), de modo que si la marca lo edita a
    // mano mientras alguien paga, nada se cuenta dos veces. Ver
    // conversación del 2026-10-01.
    const lockedIds = Array.from(new Set(itemsData.map((i) => i.productId))).sort();
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(lockedIds)}) ORDER BY "id" FOR UPDATE`;
    const fresh = await tx.product.findMany({
      where: { id: { in: lockedIds } },
      select: { id: true, name: true, stock: true, type: true, variants: { select: { id: true, stock: true } } },
    });
    const reservedRows = await tx.storeOrderItem.groupBy({
      by: ["productId", "variantId"],
      where: {
        productId: { in: lockedIds },
        order: {
          status: "PENDING",
          createdAt: { gt: new Date(Date.now() - RESERVATION_MINUTES * 60_000) },
        },
      },
      _sum: { quantity: true },
    });
    for (const move of stockMovements(itemsData)) {
      const product = fresh.find((p) => p.id === move.productId);
      if (!product) throw new StoreOrderError("Uno de los productos ya no está disponible.");
      const stock = move.variantId
        ? (product.variants.find((v) => v.id === move.variantId)?.stock ?? 0)
        : product.stock;
      const reserved =
        reservedRows.find((r) => r.productId === move.productId && (r.variantId ?? null) === move.variantId)?._sum
          .quantity ?? 0;
      const available = availableStock(stock, reserved);
      if (available != null && move.quantity > available) {
        throw new StoreOrderError(
          available === 0 && (stock ?? 0) > 0
            ? `"${product.name}" se acaba de agotar: alguien más lo está pagando. Si no completa el pago, vuelve a estar disponible en unos minutos.`
            : available === 0
              ? `"${product.name}" se agotó.`
              : `Solo ${available === 1 ? "queda 1 unidad" : `quedan ${available} unidades`} de "${product.name}". Ajusta la cantidad en tu carrito.`,
        );
      }
    }

    const created = await tx.storeOrder.create({
      data: {
        brandId: brand.id,
        reference,
        buyerName: input.buyerName.trim(),
        buyerEmail: input.buyerEmail.trim().toLowerCase(),
        buyerPhone: input.buyerPhone.trim(),
        shippingAddress:
          isServiceOrder || isDigitalOrder ? null : input.shippingAddress!.trim(),
        shippingCity:
          isServiceOrder || isDigitalOrder ? null : input.shippingCity!.trim(),
        shippingRegion:
          isServiceOrder || isDigitalOrder ? null : input.shippingRegion!.trim(),
        servicePreferredAt,
        shippingNotes: input.shippingNotes?.trim() || null,
        discountCode,
        subtotalCents,
        discountCents,
        shippingCents,
        taxCents,
        totalCents,
        paymentMode: keys.mode,
        dataConsentAt: new Date(),
        ...(input.billingIdType && input.billingIdNumber?.trim()
          ? {
              billingIdType: input.billingIdType,
              billingIdNumber: input.billingIdNumber.trim(),
              billingName: input.billingIdType === "NIT" ? input.billingName?.trim() || null : null,
            }
          : {}),
        ...(input.billingAddress?.trim()
          ? {
              billingAddress: input.billingAddress.trim(),
              billingCity: input.billingCity?.trim() || null,
              billingRegion: input.billingRegion?.trim() || null,
            }
          : {}),
        buyerFirstName: input.buyerFirstName?.trim() || null,
        buyerLastName: input.buyerLastName?.trim() || null,
        shippingPostalCode: isServiceOrder || isDigitalOrder ? null : input.shippingPostalCode?.trim() || null,
        shippingMethod,
        acceptsMarketing: input.acceptsMarketing ?? false,
        items: { create: itemsData },
      },
    });
    return created;
  });

  const signature = buildIntegritySignature({
    reference,
    amountInCents: totalCents,
    currency: order.currency,
    integrityKey: keys.integrityKey,
  });

  return {
    order,
    wompi: {
      publicKey: keys.publicKey,
      currency: order.currency,
      amountInCents: totalCents,
      reference,
      signature,
      redirectUrl: paymentReturnUrl(brand, order.id),
    },
  };
}

export async function getStoreOrder(orderId: string) {
  return prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: {
      // El `product` solo se necesita para el link de descarga de un
      // producto DIGITAL ya pagado (ver la página de confirmación) — el
      // resto del pedido usa la "foto" que ya guarda cada item.
      items: { include: { product: { select: { type: true, digitalFileUrl: true } } } },
      brand: true,
    },
  });
}

/// Compartido entre listBrandOrders y getBrandOrderDetail — trae también
/// el creador y la comisión de cada pedido atribuido (vía Transaction, ya
/// calculado por el Motor de Comisiones). Ver conversación del
/// 2026-09-14 pidiendo mostrar esto en el detalle de cada pedido.
const brandOrderInclude = {
  items: true,
  transaction: {
    include: {
      creator: { select: { displayName: true } },
      commission: true,
      enrollment: {
        include: {
          offer: { select: { defaultCommissionPercent: true } },
        },
      },
    },
  },
};

/// Para el submódulo "Pedidos" del portal de marca — incluye compras
/// (kind PURCHASE) y muestras aprobadas (kind SAMPLE) en la misma lista,
/// más recientes primero.
export async function listBrandOrders(brandId: string) {
  return prisma.storeOrder.findMany({
    where: { brandId },
    include: brandOrderInclude,
    orderBy: { createdAt: "desc" },
  });
}

/// Un pedido puntual, ya validado como propio de esta marca — para la
/// página de detalle dedicada /marca/tienda/pedidos/[orderId] (antes solo
/// había un acordeón inline en la lista). Null si no existe o es de otra
/// marca (el caller debe responder 404, nunca filtrar por id solo).
export async function getBrandOrderDetail(brandId: string, orderId: string) {
  return prisma.storeOrder.findFirst({
    where: { id: orderId, brandId },
    include: brandOrderInclude,
  });
}

/// La marca confirma (o ajusta) la fecha/hora de una reserva de servicio
/// ya pagada, y si es virtual deja el link de la videollamada — el
/// comprador se entera por correo (no tiene cuenta en Marcolini, así que
/// no hay notificación dentro de la plataforma para él) y también lo ve si
/// vuelve a su página de confirmación del pedido.
export async function confirmServiceBooking(
  brandId: string,
  data: { orderId: string; itemId: string; confirmedAt: string; meetingInfo?: string | null },
) {
  const item = await prisma.storeOrderItem.findFirst({
    where: { id: data.itemId, orderId: data.orderId, order: { brandId } },
    include: { order: { include: { brand: true } } },
  });
  if (!item) throw new StoreOrderError("Reserva no encontrada.");
  if (item.order.status !== "PAID") {
    throw new StoreOrderError("Solo se pueden confirmar reservas ya pagadas.");
  }

  const confirmedAt = new Date(data.confirmedAt);
  if (Number.isNaN(confirmedAt.getTime())) {
    throw new StoreOrderError("Fecha y hora inválidas.");
  }

  const updated = await prisma.storeOrderItem.update({
    where: { id: item.id },
    data: { serviceConfirmedAt: confirmedAt, serviceMeetingInfo: data.meetingInfo?.trim() || null },
  });

  await sendServiceBookingConfirmedEmail(item.order.buyerEmail, {
    companyName: item.order.brand.companyName,
    serviceName: item.name,
    confirmedAt: confirmedAt.toLocaleString("es-CO", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Bogota",
    }),
    meetingInfo: updated.serviceMeetingInfo,
  });

  return updated;
}

/// Estado de preparación/entrega de un pedido — aparte del pago (ver
/// StoreOrderFulfillmentStatus). Solo tiene sentido en un pedido ya
/// pagado; sella la marca de tiempo correspondiente la primera vez que
/// pasa por cada estado (si la marca lo mueve para atrás y adelante, no
/// pisa una marca de tiempo ya puesta). Ver conversación del 2026-09-14:
/// "necesito estado del pago - estado de preparación del pedido".
export async function updateOrderFulfillment(
  brandId: string,
  data: {
    orderId: string;
    fulfillmentStatus: "UNFULFILLED" | "PREPARED" | "SHIPPED" | "DELIVERED";
    carrier?: string | null;
    trackingNumber?: string | null;
  },
) {
  const order = await prisma.storeOrder.findFirst({
    where: { id: data.orderId, brandId },
  });
  if (!order) throw new StoreOrderError("Pedido no encontrado.");
  if (order.status !== "PAID") {
    throw new StoreOrderError("Solo se puede preparar un pedido ya pagado.");
  }

  const now = new Date();
  const becomesShipped =
    !order.shippedAt && (data.fulfillmentStatus === "SHIPPED" || data.fulfillmentStatus === "DELIVERED");
  const result = await prisma.storeOrder.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: data.fulfillmentStatus,
      carrier: data.carrier?.trim() || null,
      trackingNumber: data.trackingNumber?.trim() || null,
      preparedAt:
        order.preparedAt ??
        (data.fulfillmentStatus === "PREPARED" ||
        data.fulfillmentStatus === "SHIPPED" ||
        data.fulfillmentStatus === "DELIVERED"
          ? now
          : null),
      shippedAt:
        order.shippedAt ??
        (data.fulfillmentStatus === "SHIPPED" || data.fulfillmentStatus === "DELIVERED"
          ? now
          : null),
      deliveredAt:
        order.deliveredAt ?? (data.fulfillmentStatus === "DELIVERED" ? now : null),
    },
  });
  // La primera vez que sale, el comprador recibe la guía y el link de
  // rastreo. Ver conversación del 2026-09-30.
  if (becomesShipped) await sendOrderShippedEmailFor(order.id);
  await emitOrderEvent(order.id, becomesShipped ? ["orders/updated", "orders/fulfilled"] : ["orders/updated"]);
  return result;
}

/// Devolución de un pedido pagado, registrada por la marca desde el
/// detalle del pedido. El dinero se devuelve desde el panel de Wompi (la
/// API de Wompi no permite reembolsar todos los medios de pago); acá se
/// deja constancia, se repone el inventario si la marca lo pide, se
/// detiene la comisión del creador y se le avisa al comprador. Ver
/// conversación del 2026-09-30.
export async function refundStoreOrder(
  brandId: string,
  data: { orderId: string; reason?: string | null; restock: boolean },
) {
  const order = await prisma.storeOrder.findFirst({
    where: { id: data.orderId, brandId },
    include: { items: { select: { productId: true, variantId: true, quantity: true } } },
  });
  if (!order) throw new StoreOrderError("Pedido no encontrado.");
  if (order.status === "REFUNDED") throw new StoreOrderError("Este pedido ya tiene la devolución registrada.");
  if (order.status !== "PAID") throw new StoreOrderError("Solo se puede devolver un pedido pagado.");

  const reason = data.reason?.trim() || null;
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.storeOrder.updateMany({
      where: { id: order.id, status: "PAID" },
      data: { status: "REFUNDED", refundedAt: new Date(), refundReason: reason, restocked: data.restock },
    });
    if (claimed.count === 0) throw new StoreOrderError("Este pedido ya cambió de estado. Recarga la página.");
    if (data.restock) await applyStockMovements(tx, stockMovements(order.items), 1);
    return tx.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
  });

  if (order.discountCode) {
    try {
      await recordRefundFromWebhook({
        brandId,
        source: "MARCOLINI",
        externalOrderId: order.id,
        refundedAt: updated.refundedAt ?? new Date(),
      });
    } catch (err) {
      console.error(`[mi-tienda] No se pudo revertir la comisión del pedido ${order.id}:`, err);
    }
  }

  await sendOrderRefundedEmailFor(order.id, reason);
  await emitOrderEvent(order.id, ["orders/updated"]);
  return updated;
}

/// Notas internas — nunca las ve el comprador. Ver conversación del
/// 2026-09-14 (captura de referencia de Shopify).
export async function updateOrderNotes(
  brandId: string,
  data: { orderId: string; internalNotes: string | null },
) {
  const order = await prisma.storeOrder.findFirst({
    where: { id: data.orderId, brandId },
  });
  if (!order) throw new StoreOrderError("Pedido no encontrado.");
  return prisma.storeOrder.update({
    where: { id: order.id },
    data: { internalNotes: data.internalNotes?.trim() || null },
  });
}

/// Idempotente — puede llamarse desde el webhook y desde el respaldo por
/// consulta directa a la API de Wompi sin duplicar nada: si el pedido ya
/// no está PENDING, no vuelve a procesarlo.
export async function applyWompiTransactionStatus(params: {
  reference: string;
  wompiTransactionId: string;
  wompiStatus: string;
}) {
  const order = await prisma.storeOrder.findUnique({
    where: { reference: params.reference },
  });
  if (!order) return { order: null };
  if (order.status !== "PENDING") return { order };

  if (params.wompiStatus === "APPROVED") {
    // Marca pagado y descuenta el inventario en una sola transacción. El
    // updateMany condicionado a PENDING hace que, si el webhook y la
    // consulta directa a Wompi llegan al mismo tiempo, solo uno de los dos
    // "gane" y el inventario se descuente una sola vez. Antes el pago se
    // registraba pero el inventario nunca bajaba. Ver conversación del
    // 2026-09-30.
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.storeOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: {
          status: "PAID",
          wompiTransactionId: params.wompiTransactionId,
          wompiStatus: params.wompiStatus,
          paidAt: new Date(),
        },
      });
      if (claimed.count === 0) return null;
      const items = await tx.storeOrderItem.findMany({
        where: { orderId: order.id },
        select: { productId: true, variantId: true, quantity: true },
      });
      await applyStockMovements(tx, stockMovements(items), -1);
      return tx.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    });
    if (!updated) {
      return { order: await prisma.storeOrder.findUnique({ where: { id: order.id } }) };
    }

    // Registra/actualiza el cliente en el CRM de "Mi tienda" — así el
    // registro existe desde la primera compra, sin que la marca tenga
    // que hacer nada. Nunca debe tumbar el pago si algo sale mal acá.
    try {
      const created = await ensureStoreCustomerExists(order.brandId, {
        email: order.buyerEmail,
        name: order.buyerName,
        phone: order.buyerPhone,
        emailSubscribed: order.acceptsMarketing,
      });
      if (created) await emitCustomerEvent(order.brandId, order.buyerEmail, "customers/create");
    } catch (err) {
      console.error(`[mi-tienda] No se pudo registrar el cliente para el pedido ${order.id}:`, err);
    }

    if (order.discountCode) {
      try {
        const result = await recordOrderFromWebhook({
          brandId: order.brandId,
          source: "MARCOLINI",
          externalOrderId: order.id,
          discountCode: order.discountCode,
          grossAmount: order.subtotalCents / 100,
          discountAmount: order.discountCents / 100,
          netAmount: (order.subtotalCents - order.discountCents) / 100,
          occurredAt: updated.paidAt ?? new Date(),
          customerEmail: order.buyerEmail,
        });
        if (result.transaction) {
          await prisma.storeOrder.update({
            where: { id: order.id },
            data: { transactionId: result.transaction.id },
          });
        }
      } catch (err) {
        // No revertimos el pago — ya se cobró de verdad — solo dejamos
        // evidencia; la marca/admin puede revisar y atribuir a mano si
        // hace falta.
        console.error(
          `[mi-tienda] No se pudo atribuir el pedido ${order.id} al código "${order.discountCode}":`,
          err,
        );
      }
    }

    // Confirmación al comprador + "tienes una venta" a la marca. Nunca
    // tumba el pago (ver sendOrderPaidEmails).
    await sendOrderPaidEmails(order.id);

    // Conexiones (webhooks): pedido nuevo y pagado — con esto factura
    // Dataico (financial_status = "paid"). Nunca tumba el pago.
    await emitOrderEvent(order.id, ["orders/create", "orders/paid", "orders/updated"]);

    // Factura electrónica por la conexión directa con Dataico, si la
    // tienda la tiene activa. Corre después de responder; nunca tumba el
    // pago.
    await issueInvoiceAfterPayment(order.id);

    return { order: updated };
  }

  // DECLINED / VOIDED / ERROR
  const updated = await prisma.storeOrder.update({
    where: { id: order.id },
    data: {
      status: "FAILED",
      wompiTransactionId: params.wompiTransactionId,
      wompiStatus: params.wompiStatus,
    },
  });
  return { order: updated };
}

/// Datos del comprador para precargar la ventana de pago de Wompi
/// (WidgetCheckout, customerData). Solo lo que Wompi acepta: el celular en
/// 10 dígitos y el documento si es CC, CE, NIT o pasaporte.
const WOMPI_LEGAL_ID_TYPES: Record<string, string> = { CC: "CC", CE: "CE", NIT: "NIT", PASAPORTE: "PP" };

export function wompiCustomerData(order: {
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  billingIdType: string | null;
  billingIdNumber: string | null;
}) {
  const data: Record<string, string> = { email: order.buyerEmail, fullName: order.buyerName };
  const phone = order.buyerPhone.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
  if (/^3\d{9}$/.test(phone)) {
    data.phoneNumber = phone;
    data.phoneNumberPrefix = "+57";
  }
  const legalType = order.billingIdType ? WOMPI_LEGAL_ID_TYPES[order.billingIdType] : undefined;
  if (legalType && order.billingIdNumber) {
    data.legalId = order.billingIdNumber.replace(/-\d$/, "").replace(/[^0-9A-Za-z]/g, "");
    data.legalIdType = legalType;
  }
  return data;
}

/// Respaldo si la ventana de Wompi no carga: la página de pago de Wompi
/// (Web Checkout) solo con lo indispensable. Antes llevaba también los
/// datos del comprador y el firewall de Wompi (CloudFront) respondía 403.
/// Ver conversación del 2026-10-01.
export function wompiCheckoutUrl(wompi: {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
  redirectUrl: string;
}) {
  const params = new URLSearchParams({
    "public-key": wompi.publicKey,
    currency: wompi.currency,
    "amount-in-cents": String(wompi.amountInCents),
    reference: wompi.reference,
    "signature:integrity": wompi.signature,
    "redirect-url": wompi.redirectUrl,
  });
  return `https://checkout.wompi.co/p/?${params.toString()}`;
}

/// Pone al día los pedidos que siguen "Pendiente": le pregunta a Wompi por
/// cada uno (por su referencia) y aplica lo que diga — así un pago
/// aprobado queda Pagado aunque el comprador no haya vuelto a la tienda ni
/// llegado el aviso de Wompi. Los que nunca se pagaron y llevan más de un
/// día pasan a Vencido (dejan de verse como pedidos). Se llama al abrir
/// Pedidos y en el cron diario. Ver conversación del 2026-10-01.
export async function reconcilePendingOrders(brandId?: string) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const pending = await prisma.storeOrder.findMany({
    where: { status: "PENDING", kind: "PURCHASE", createdAt: { gte: since }, ...(brandId ? { brandId } : {}) },
    include: { brand: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  let updated = 0;
  await Promise.all(
    pending.map(async (order) => {
      const keys = getActiveWompiKeys({ ...order.brand, paymentMode: order.paymentMode });
      if (!keys) return;
      try {
        const tx = await findWompiTransactionByReference(order.paymentMode, keys.privateKey, order.reference);
        if (tx && tx.status !== "PENDING") {
          await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: tx.id, wompiStatus: tx.status });
          updated++;
        } else if (!tx && order.createdAt.getTime() < dayAgo) {
          await prisma.storeOrder.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "EXPIRED" } });
          updated++;
        }
      } catch (err) {
        console.error(`[mi-tienda] No se pudo consultar en Wompi el pedido ${order.id}:`, err);
      }
    }),
  );
  return { checked: pending.length, updated };
}

/// La burbuja de "Pedidos" en el menú: pedidos pagados con envío que
/// todavía no salen (sin preparar o preparados).
export async function countOpenOrders(brandId: string) {
  return prisma.storeOrder.count({
    where: {
      brandId,
      kind: "PURCHASE",
      status: "PAID",
      shippingAddress: { not: null },
      fulfillmentStatus: { in: ["UNFULFILLED", "PREPARED"] },
    },
  });
}
