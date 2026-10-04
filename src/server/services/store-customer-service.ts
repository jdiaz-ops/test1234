import { prisma } from "@/lib/prisma";
import { emitCustomerEvent } from "@/server/services/webhook-service";

export class StoreCustomerError extends Error {}

/// CRM simple de "Mi tienda" — ver StoreCustomer en el schema. Las
/// estadísticas (pedidos, gastado, cliente desde, última compra) se
/// calculan agregando StoreOrder por buyerEmail en memoria (no con
/// prisma.groupBy, que no trae "la fila más reciente del grupo" —
/// más simple de razonar así, y el volumen de pedidos de una marca en
/// esta etapa no justifica optimizarlo). StoreCustomer solo aporta lo
/// que la marca edita a mano: notas, etiquetas, suscripción, crédito.
/// Ver conversación del 2026-09-14.

type CustomerStats = {
  email: string;
  name: string;
  phone: string;
  city: string | null;
  region: string | null;
  orderCount: number;
  totalSpentCents: number;
  firstOrderAt: Date;
  lastOrderAt: Date;
};

/// Heurística simple, no un verdadero modelo RFM (recencia/frecuencia/
/// monto) — etiqueta aproximada para que la marca priorice de un vistazo,
/// no un cálculo estadístico real. Ver conversación del 2026-09-14.
export function estimateCustomerSegment(stats: {
  orderCount: number;
  totalSpentCents: number;
  /// null = no ha comprado en Marcolini (puede traer historial de Shopify).
  lastOrderAt: Date | null;
}): "Sin compras" | "Nuevo" | "VIP" | "En riesgo" | "Frecuente" | "Activo" {
  if (stats.orderCount === 0) return "Sin compras";
  if (stats.orderCount === 1) return "Nuevo";
  if (stats.orderCount >= 5 || stats.totalSpentCents >= 50_000_00) return "VIP";
  const daysSinceLastOrder = stats.lastOrderAt
    ? (Date.now() - stats.lastOrderAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  if (daysSinceLastOrder > 90) return "En riesgo";
  if (stats.orderCount >= 3) return "Frecuente";
  return "Activo";
}

async function aggregateOrdersByEmail(brandId: string): Promise<Map<string, CustomerStats>> {
  const orders = await prisma.storeOrder.findMany({
    where: { brandId, status: "PAID" },
    select: {
      buyerEmail: true,
      buyerName: true,
      buyerPhone: true,
      shippingCity: true,
      shippingRegion: true,
      totalCents: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byEmail = new Map<string, CustomerStats>();
  for (const o of orders) {
    const key = o.buyerEmail.toLowerCase();
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, {
        email: o.buyerEmail,
        name: o.buyerName,
        phone: o.buyerPhone,
        city: o.shippingCity,
        region: o.shippingRegion,
        orderCount: 1,
        totalSpentCents: o.totalCents,
        firstOrderAt: o.createdAt,
        lastOrderAt: o.createdAt,
      });
    } else {
      existing.orderCount += 1;
      existing.totalSpentCents += o.totalCents;
      existing.lastOrderAt = o.createdAt;
      // Los pedidos vienen en orden ascendente — el más reciente siempre
      // pisa nombre/teléfono/ciudad, así se refleja el dato más nuevo.
      existing.name = o.buyerName;
      existing.phone = o.buyerPhone;
      if (o.shippingCity) existing.city = o.shippingCity;
      if (o.shippingRegion) existing.region = o.shippingRegion;
    }
  }
  return byEmail;
}

export type CustomerFilter = "todos" | "con-compras" | "sin-compras" | "suscritos" | "sms";

/// Lista de Mi tienda → Clientes: los que compraron en Marcolini más los
/// que solo existen como registro (importados de Shopify o creados a
/// mano). Pedidos y gastado suman Marcolini + historial de Shopify. Con
/// búsqueda, filtro y páginas: una marca que importa su base puede tener
/// decenas de miles (2026-10-04).
export async function listStoreCustomers(
  brandId: string,
  opts: { search?: string; filter?: CustomerFilter; page?: number; pageSize?: number } = {},
) {
  const [stats, overlays] = await Promise.all([
    aggregateOrdersByEmail(brandId),
    prisma.storeCustomer.findMany({
      where: { brandId },
      select: {
        email: true,
        name: true,
        phone: true,
        documentNumber: true,
        city: true,
        region: true,
        emailSubscribed: true,
        smsSubscribed: true,
        tags: true,
        importedOrderCount: true,
        importedSpentCents: true,
      },
    }),
  ]);

  const merged = new Map<
    string,
    {
      email: string;
      name: string;
      phone: string;
      documentNumber: string | null;
      city: string | null;
      region: string | null;
      emailSubscribed: boolean;
      smsSubscribed: boolean;
      tags: string[];
      orderCount: number;
      totalSpentCents: number;
      lastOrderAt: Date | null;
    }
  >();
  for (const o of overlays) {
    merged.set(o.email.toLowerCase(), {
      email: o.email,
      name: o.name ?? "",
      phone: o.phone ?? "",
      documentNumber: o.documentNumber,
      city: o.city,
      region: o.region,
      emailSubscribed: o.emailSubscribed,
      smsSubscribed: o.smsSubscribed,
      tags: o.tags,
      orderCount: o.importedOrderCount,
      totalSpentCents: o.importedSpentCents,
      lastOrderAt: null,
    });
  }
  for (const [key, s] of stats) {
    const current = merged.get(key);
    if (current) {
      current.name = s.name || current.name;
      current.phone = s.phone || current.phone;
      current.city = s.city ?? current.city;
      current.region = s.region ?? current.region;
      current.orderCount += s.orderCount;
      current.totalSpentCents += s.totalSpentCents;
      current.lastOrderAt = s.lastOrderAt;
    } else {
      merged.set(key, {
        email: s.email,
        name: s.name,
        phone: s.phone,
        documentNumber: null,
        city: s.city,
        region: s.region,
        emailSubscribed: false,
        smsSubscribed: false,
        tags: [],
        orderCount: s.orderCount,
        totalSpentCents: s.totalSpentCents,
        lastOrderAt: s.lastOrderAt,
      });
    }
  }

  let list = Array.from(merged.values());
  const counts = {
    todos: list.length,
    "con-compras": list.filter((c) => c.orderCount > 0).length,
    "sin-compras": list.filter((c) => c.orderCount === 0).length,
    suscritos: list.filter((c) => c.emailSubscribed).length,
    sms: list.filter((c) => c.smsSubscribed).length,
  };

  const filter = opts.filter ?? "todos";
  if (filter === "con-compras") list = list.filter((c) => c.orderCount > 0);
  if (filter === "sin-compras") list = list.filter((c) => c.orderCount === 0);
  if (filter === "suscritos") list = list.filter((c) => c.emailSubscribed);
  if (filter === "sms") list = list.filter((c) => c.smsSubscribed);

  const q = opts.search?.trim().toLowerCase();
  if (q) {
    const digits = q.replace(/\D/g, "");
    list = list.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (digits.length >= 4 && (c.phone.replace(/\D/g, "").includes(digits) || (c.documentNumber ?? "").includes(digits))),
    );
  }

  // Primero quien compró en Marcolini (lo más reciente arriba), después el
  // resto por lo que ha gastado.
  list.sort((a, b) => {
    if (a.lastOrderAt && b.lastOrderAt) return b.lastOrderAt.getTime() - a.lastOrderAt.getTime();
    if (a.lastOrderAt) return -1;
    if (b.lastOrderAt) return 1;
    return b.totalSpentCents - a.totalSpentCents;
  });

  const pageSize = opts.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  return {
    customers: list.slice((page - 1) * pageSize, page * pageSize),
    total: list.length,
    page,
    totalPages,
    counts,
  };
}

export async function getStoreCustomerDetail(brandId: string, email: string) {
  const normalized = email.toLowerCase();
  const [stats, overlay, orders] = await Promise.all([
    aggregateOrdersByEmail(brandId),
    prisma.storeCustomer.findUnique({
      where: { brandId_email: { brandId, email: normalized } },
    }),
    prisma.storeOrder.findMany({
      where: { brandId, buyerEmail: { equals: email, mode: "insensitive" }, status: "PAID" },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const customerStats = stats.get(normalized);
  // Un cliente importado (o creado a mano) existe aunque no tenga pedidos
  // en Marcolini.
  if (!customerStats && !overlay) return null;

  return {
    email: customerStats?.email ?? overlay!.email,
    name: customerStats?.name || overlay?.name || overlay?.email || "",
    phone: customerStats?.phone || overlay?.phone || "",
    city: customerStats?.city ?? overlay?.city ?? null,
    region: customerStats?.region ?? overlay?.region ?? null,
    // Marcolini + historial de Shopify.
    orderCount: (customerStats?.orderCount ?? 0) + (overlay?.importedOrderCount ?? 0),
    totalSpentCents: (customerStats?.totalSpentCents ?? 0) + (overlay?.importedSpentCents ?? 0),
    marcoliniOrderCount: customerStats?.orderCount ?? 0,
    importedOrderCount: overlay?.importedOrderCount ?? 0,
    importedSpentCents: overlay?.importedSpentCents ?? 0,
    firstOrderAt: customerStats?.firstOrderAt ?? null,
    lastOrderAt: customerStats?.lastOrderAt ?? null,
    emailSubscribed: overlay?.emailSubscribed ?? false,
    smsSubscribed: overlay?.smsSubscribed ?? false,
    tags: overlay?.tags ?? [],
    notes: overlay?.notes ?? null,
    storeCreditCents: overlay?.storeCreditCents ?? 0,
    documentNumber: overlay?.documentNumber ?? null,
    company: overlay?.company ?? null,
    address: overlay?.address ?? null,
    address2: overlay?.address2 ?? null,
    postalCode: overlay?.postalCode ?? null,
    countryCode: overlay?.countryCode ?? null,
    importedAt: overlay?.importedAt ?? null,
    orders,
  };
}

export async function updateStoreCustomer(
  brandId: string,
  data: {
    email: string;
    name?: string;
    phone?: string;
    emailSubscribed?: boolean;
    tags?: string[];
    notes?: string;
    storeCreditCents?: number;
  },
) {
  const normalized = data.email.toLowerCase();
  const customer = await prisma.storeCustomer.upsert({
    where: { brandId_email: { brandId, email: normalized } },
    create: {
      brandId,
      email: normalized,
      name: data.name?.trim() || null,
      phone: data.phone?.trim() || null,
      emailSubscribed: data.emailSubscribed ?? false,
      tags: data.tags ?? [],
      notes: data.notes?.trim() || null,
      storeCreditCents: data.storeCreditCents ?? 0,
    },
    update: {
      ...(data.emailSubscribed !== undefined ? { emailSubscribed: data.emailSubscribed } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() || null } : {}),
      ...(data.storeCreditCents !== undefined ? { storeCreditCents: data.storeCreditCents } : {}),
    },
  });
  await emitCustomerEvent(brandId, normalized, "customers/update");
  return customer;
}

/// Se llama cuando un pedido pasa a PAID — así el registro existe desde
/// la primera compra, aunque la marca nunca le toque notas/etiquetas. Ver
/// applyWompiTransactionStatus. Devuelve true si el cliente es nuevo.
export async function ensureStoreCustomerExists(
  brandId: string,
  data: { email: string; name: string; phone: string; emailSubscribed?: boolean },
) {
  const normalized = data.email.toLowerCase();
  // createMany + skipDuplicates para saber si es nuevo (true) sin carrera
  // entre dos pedidos simultáneos del mismo comprador.
  const result = await prisma.storeCustomer.createMany({
    data: [{ brandId, email: normalized, name: data.name, phone: data.phone, emailSubscribed: data.emailSubscribed ?? false }],
    skipDuplicates: true,
  });
  // Si ya existía y esta vez pidió novedades, se suscribe (nunca se
  // desuscribe por no marcar la casilla en otra compra).
  if (result.count === 0 && data.emailSubscribed) {
    await prisma.storeCustomer.update({
      where: { brandId_email: { brandId, email: normalized } },
      data: { emailSubscribed: true },
    });
  }
  return result.count > 0;
}

export type ImportStoreCustomerRow = {
  email: string;
  name: string | null;
  phone: string | null;
  documentNumber: string | null;
  company: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  emailSubscribed: boolean;
  smsSubscribed: boolean;
  orderCount: number;
  spentCents: number;
  tags: string[];
  notes: string | null;
  shopifyCustomerId: string | null;
};

/// Importa clientes de Shopify (ver lib/shopify-customers-csv.ts), por
/// lotes. Se puede repetir con el mismo archivo sin duplicar a nadie: la
/// llave es el correo.
///  - Cliente nuevo: se crea con todo, incluidas las suscripciones de
///    Shopify.
///  - Ya existía porque compró en Marcolini (o la marca lo creó a mano):
///    solo se llenan los datos que le faltan, se suman las etiquetas y se
///    guarda el historial de Shopify. Sus suscripciones no se tocan — lo
///    de Marcolini es más reciente.
///  - Ya existía por una importación anterior: se actualiza con el
///    archivo nuevo (suscripciones incluidas).
/// No dispara los webhooks de cliente: una importación de miles no debe
/// salir como miles de avisos a otros sistemas.
export async function importStoreCustomers(brandId: string, rows: ImportStoreCustomerRow[]) {
  const unique = new Map(rows.map((r) => [r.email.trim().toLowerCase(), r]));
  const emails = Array.from(unique.keys());
  const existing = await prisma.storeCustomer.findMany({ where: { brandId, email: { in: emails } } });
  const existingByEmail = new Map(existing.map((c) => [c.email, c]));
  const now = new Date();

  const toCreate = emails
    .filter((email) => !existingByEmail.has(email))
    .map((email) => {
      const r = unique.get(email)!;
      return {
        brandId,
        email,
        name: r.name,
        phone: r.phone,
        documentNumber: r.documentNumber,
        company: r.company,
        address: r.address,
        address2: r.address2,
        city: r.city,
        region: r.region,
        postalCode: r.postalCode,
        countryCode: r.countryCode,
        emailSubscribed: r.emailSubscribed,
        smsSubscribed: r.smsSubscribed,
        importedOrderCount: r.orderCount,
        importedSpentCents: r.spentCents,
        tags: r.tags,
        notes: r.notes,
        shopifyCustomerId: r.shopifyCustomerId,
        importedAt: now,
      };
    });

  const created = toCreate.length
    ? (await prisma.storeCustomer.createMany({ data: toCreate, skipDuplicates: true })).count
    : 0;

  const updates = existing.map((c) => {
    const r = unique.get(c.email)!;
    const fromImport = c.importedAt !== null;
    return prisma.storeCustomer.update({
      where: { id: c.id },
      data: {
        name: c.name || r.name,
        phone: c.phone || r.phone,
        documentNumber: c.documentNumber || r.documentNumber,
        company: c.company || r.company,
        address: c.address || r.address,
        address2: c.address2 || r.address2,
        city: c.city || r.city,
        region: c.region || r.region,
        postalCode: c.postalCode || r.postalCode,
        countryCode: c.countryCode || r.countryCode,
        notes: c.notes || r.notes,
        shopifyCustomerId: c.shopifyCustomerId || r.shopifyCustomerId,
        tags: Array.from(new Set([...c.tags, ...r.tags])),
        importedOrderCount: r.orderCount,
        importedSpentCents: r.spentCents,
        // importedAt no se toca: sigue diciendo si el cliente nació de una
        // importación (y por eso sus suscripciones vienen de Shopify).
        ...(fromImport ? { emailSubscribed: r.emailSubscribed, smsSubscribed: r.smsSubscribed } : {}),
      },
    });
  });
  if (updates.length) await prisma.$transaction(updates);

  return { created, updated: updates.length };
}
