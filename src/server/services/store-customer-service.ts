import { prisma } from "@/lib/prisma";

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
  lastOrderAt: Date;
}): "Nuevo" | "VIP" | "En riesgo" | "Frecuente" | "Activo" {
  const daysSinceLastOrder =
    (Date.now() - stats.lastOrderAt.getTime()) / (1000 * 60 * 60 * 24);
  if (stats.orderCount === 1) return "Nuevo";
  if (stats.orderCount >= 5 || stats.totalSpentCents >= 50_000_00) return "VIP";
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

export async function listStoreCustomers(brandId: string) {
  const [stats, overlays] = await Promise.all([
    aggregateOrdersByEmail(brandId),
    prisma.storeCustomer.findMany({ where: { brandId } }),
  ]);
  const overlayByEmail = new Map(overlays.map((c) => [c.email.toLowerCase(), c]));

  return Array.from(stats.values())
    .map((s) => {
      const overlay = overlayByEmail.get(s.email.toLowerCase());
      return {
        ...s,
        emailSubscribed: overlay?.emailSubscribed ?? false,
        tags: overlay?.tags ?? [],
      };
    })
    .sort((a, b) => b.lastOrderAt.getTime() - a.lastOrderAt.getTime());
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
  if (!customerStats) return null;

  return {
    ...customerStats,
    emailSubscribed: overlay?.emailSubscribed ?? false,
    tags: overlay?.tags ?? [],
    notes: overlay?.notes ?? null,
    storeCreditCents: overlay?.storeCreditCents ?? 0,
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
  return prisma.storeCustomer.upsert({
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
}

/// Se llama cuando un pedido pasa a PAID — así el registro existe desde
/// la primera compra, aunque la marca nunca le toque notas/etiquetas. Ver
/// applyWompiTransactionStatus.
export async function ensureStoreCustomerExists(
  brandId: string,
  data: { email: string; name: string; phone: string },
) {
  const normalized = data.email.toLowerCase();
  await prisma.storeCustomer.upsert({
    where: { brandId_email: { brandId, email: normalized } },
    create: { brandId, email: normalized, name: data.name, phone: data.phone },
    update: {},
  });
}
