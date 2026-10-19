import crypto from "node:crypto";
import { Prisma, type AllyLeadKind, type AllyLeadStatus, type AllyStatus, type CreatorPayoutMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize-email";
import { slugify } from "@/lib/shopify-csv";
import { portalUrl } from "@/lib/store-url";
import { sendAllyLoginEmail } from "@/lib/email";
import { allyPayDate, daysLeft, monthKey, monthStart, monthlyEarnings, windowEnd, type AllySale, type MonthEarnings } from "@/lib/ally-earnings";
import { createNotification } from "@/server/services/notification-service";
import { createAllyLoginToken } from "@/lib/ally-login-token";

/// Aliados comerciales (ver AllyProfile en el schema y ally-earnings.ts):
/// el admin los crea, cada uno tiene su link (marcolini.lat/unete/{code})
/// donde marcas y creadoras dejan una solicitud, Marcolini la revisa y
/// vincula a la marca o creadora que entra, y el aliado ve en su portal
/// (/aliado) a quién trajo, cuánto vendió cada una por mes y lo que gana.
/// Nunca ve pedidos ni clientes: solo nombres y totales por mes (así lo
/// dicen los términos). Entra sin contraseña, con un link a su correo.

export class AllyError extends Error {}

const LOGIN_LINK_MINUTES = 30;
/// El link que genera el admin para mandarlo por WhatsApp dura más.
export const ADMIN_LOGIN_LINK_MINUTES = 7 * 24 * 60;

export async function uniqueAllyCode(base: string) {
  const root = slugify(base).slice(0, 30) || "aliado";
  for (let i = 1; i < 200; i++) {
    const code = i === 1 ? root : `${root}-${i}`;
    const taken = await prisma.allyProfile.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  return `${root}-${crypto.randomBytes(3).toString("hex")}`;
}

export async function createAlly(input: { name: string; email: string; phone?: string | null; code?: string | null }) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (name.length < 2) throw new AllyError("Escribe el nombre del aliado.");
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existing) throw new AllyError("Ya hay una cuenta con ese correo en Marcolini.");
  const wanted = input.code?.trim() ? slugify(input.code) : "";
  if (wanted && (await prisma.allyProfile.findUnique({ where: { code: wanted }, select: { id: true } }))) {
    throw new AllyError("Ese link ya lo tiene otro aliado.");
  }
  const code = wanted || (await uniqueAllyCode(name));
  return prisma.user.create({
    data: {
      email,
      role: "ALLY",
      // Entra con el link a su correo (no tiene contraseña): el correo
      // queda confirmado en cuanto lo usa, y el admin lo escribió a mano.
      emailVerified: new Date(),
      allyProfile: { create: { name: name.slice(0, 120), phone: input.phone?.trim().slice(0, 40) || null, code } },
    },
    include: { allyProfile: true },
  });
}

export async function getActiveAllyByCode(code: string) {
  const ally = await prisma.allyProfile.findUnique({ where: { code: code.toLowerCase() }, select: { id: true, name: true, status: true } });
  return ally && ally.status === "ACTIVE" ? ally : null;
}

export type AllyLeadInput = {
  kind: AllyLeadKind;
  name: string;
  contactName?: string | null;
  phone: string;
  instagram?: string | null;
  city?: string | null;
};

/// Una solicitud por el link del aliado. Se le avisa al equipo para que la
/// revise.
export async function createAllyLead(code: string, input: AllyLeadInput) {
  const ally = await getActiveAllyByCode(code);
  if (!ally) throw new AllyError("Este link ya no está activo.");
  const lead = await prisma.allyLead.create({
    data: {
      allyId: ally.id,
      kind: input.kind,
      name: input.name.trim().slice(0, 120),
      contactName: input.contactName?.trim().slice(0, 120) || null,
      phone: input.phone.trim().slice(0, 40),
      instagram: input.instagram?.trim().slice(0, 200) || null,
      city: input.city?.trim().slice(0, 80) || null,
      consentAt: new Date(),
    },
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", adminRole: "OWNER" }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      createNotification(admin.id, "ALLY_LEAD_ADMIN", {
        aliado: ally.name,
        tipo: input.kind === "BRAND" ? "la marca" : "la creadora",
        nombre: lead.name,
        celular: lead.phone,
      }).catch((err) => console.error("[aliados] no se pudo avisar de la solicitud:", err)),
    ),
  );
  return lead;
}

export async function setAllyLeadStatus(leadId: string, status: AllyLeadStatus) {
  return prisma.allyLead.update({ where: { id: leadId }, data: { status, reviewedAt: status === "PENDING" ? null : new Date() } });
}

export async function setAllyStatus(allyId: string, status: AllyStatus) {
  return prisma.allyProfile.update({ where: { id: allyId }, data: { status } });
}

/// Vincula al aliado la marca o creadora que trajo (desde su solicitud o a
/// mano). Copia el % y los meses de hoy, para que cambiarlos después no
/// toque lo ya acordado.
export async function linkAllyReferral(allyId: string, input: { leadId?: string | null; brandId?: string | null; creatorId?: string | null }) {
  const brandId = input.brandId || null;
  const creatorId = input.creatorId || null;
  if (Boolean(brandId) === Boolean(creatorId)) throw new AllyError("Elige una marca o una creadora.");
  const ally = await prisma.allyProfile.findUnique({ where: { id: allyId } });
  if (!ally) throw new AllyError("No encontramos ese aliado.");
  const taken = await prisma.allyReferral.findFirst({
    where: brandId ? { brandId } : { creatorId },
    select: { ally: { select: { name: true } } },
  });
  if (taken) throw new AllyError(`${brandId ? "Esa marca" : "Esa creadora"} ya está vinculada a ${taken.ally.name}.`);
  if (input.leadId) {
    const lead = await prisma.allyLead.findFirst({ where: { id: input.leadId, allyId }, select: { id: true, referral: { select: { id: true } } } });
    if (!lead) throw new AllyError("Esa solicitud no es de este aliado.");
    if (lead.referral) throw new AllyError("Esa solicitud ya está vinculada.");
  }
  return prisma.$transaction(async (tx) => {
    const referral = await tx.allyReferral.create({
      data: {
        allyId,
        leadId: input.leadId || null,
        brandId,
        creatorId,
        rateBps: brandId ? ally.brandRateBps : ally.creatorRateBps,
        windowMonths: ally.windowMonths,
      },
    });
    if (input.leadId) await tx.allyLead.update({ where: { id: input.leadId }, data: { status: "APPROVED", reviewedAt: new Date() } });
    return referral;
  });
}

export async function unlinkAllyReferral(referralId: string) {
  await prisma.allyReferral.delete({ where: { id: referralId } });
}

// ----------------------------------------------------------------------------
// Ventas de cada marca o creadora
// ----------------------------------------------------------------------------

type ReferralRef = { id: string; brandId: string | null; creatorId: string | null; firstSaleAt: Date | null };

/// Las ventas que cuentan, sin envío y ya con descuento — la misma base de
/// la tarifa de Marcolini: las de la tienda sin creadora (StoreSaleFee) y
/// las que llevan creadora (Transaction). Lo devuelto o anulado no cuenta, y
/// las licencias de contenido y el contenido pagado (ContentLicense,
/// PaidContentRequest) tampoco: no son ventas (acordado el 2026-10-19).
async function salesOf(ref: ReferralRef, from?: Date, to?: Date): Promise<AllySale[]> {
  const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;
  const commissionOk: Prisma.TransactionWhereInput = {
    status: { not: "REFUNDED" },
    OR: [{ commission: { is: null } }, { commission: { is: { status: { not: "REVERSED" } } } }],
  };
  if (ref.brandId) {
    const [fees, txs] = await Promise.all([
      prisma.storeSaleFee.findMany({
        where: { brandId: ref.brandId, status: { not: "REVERSED" }, ...(range ? { createdAt: range } : {}) },
        select: { createdAt: true, baseAmount: true },
      }),
      prisma.transaction.findMany({
        where: { brandId: ref.brandId, ...commissionOk, ...(range ? { occurredAt: range } : {}) },
        select: { occurredAt: true, netAmount: true },
      }),
    ]);
    return [
      ...fees.map((f) => ({ at: f.createdAt, amount: Number(f.baseAmount) })),
      ...txs.map((t) => ({ at: t.occurredAt, amount: Number(t.netAmount) })),
    ];
  }
  if (ref.creatorId) {
    const txs = await prisma.transaction.findMany({
      where: { creatorId: ref.creatorId, ...commissionOk, ...(range ? { occurredAt: range } : {}) },
      select: { occurredAt: true, netAmount: true },
    });
    return txs.map((t) => ({ at: t.occurredAt, amount: Number(t.netAmount) }));
  }
  return [];
}

/// La primera venta (desde ahí corren los meses). Se guarda la primera vez
/// que se encuentra, así no cambia si después esa venta se devuelve.
async function firstSaleOf(ref: ReferralRef): Promise<Date | null> {
  if (ref.firstSaleAt) return ref.firstSaleAt;
  let first: Date | null = null;
  if (ref.brandId) {
    const [fee, tx] = await Promise.all([
      prisma.storeSaleFee.findFirst({ where: { brandId: ref.brandId, status: { not: "REVERSED" } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.transaction.findFirst({ where: { brandId: ref.brandId, status: { not: "REFUNDED" } }, orderBy: { occurredAt: "asc" }, select: { occurredAt: true } }),
    ]);
    const dates = [fee?.createdAt, tx?.occurredAt].filter((d): d is Date => Boolean(d));
    first = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  } else if (ref.creatorId) {
    const tx = await prisma.transaction.findFirst({ where: { creatorId: ref.creatorId, status: { not: "REFUNDED" } }, orderBy: { occurredAt: "asc" }, select: { occurredAt: true } });
    first = tx?.occurredAt ?? null;
  }
  if (first) await prisma.allyReferral.update({ where: { id: ref.id }, data: { firstSaleAt: first } });
  return first;
}

// ----------------------------------------------------------------------------
// Resumen del aliado (su portal y el detalle en Admin)
// ----------------------------------------------------------------------------

export type AllyReferralRow = {
  id: string;
  kind: AllyLeadKind;
  name: string;
  rateBps: number;
  windowMonths: number;
  state: "sin-ventas" | "activa" | "terminada";
  firstSaleAt: Date | null;
  endsAt: Date | null;
  daysLeft: number;
  months: Record<string, MonthEarnings>;
  totalSales: number;
  totalCommission: number;
  linkedAt: Date;
  leadId: string | null;
};

export type AllyLeadRow = { id: string; kind: AllyLeadKind; name: string; contactName: string | null; phone: string; instagram: string | null; city: string | null; status: AllyLeadStatus; createdAt: Date };

export type AllyMonthRow = {
  key: string;
  period: Date;
  sales: number;
  commission: number;
  state: "en-curso" | "por-pagar" | "pagado" | "sin-comision";
  /// Cuándo se paga (ver allyPayDate): el mismo día que a las creadoras.
  payDate: Date;
  payout: { amount: number; paidAt: Date; reference: string | null } | null;
};

export async function allyOverview(allyId: string, now = new Date()) {
  const ally = await prisma.allyProfile.findUnique({
    where: { id: allyId },
    include: {
      user: { select: { email: true } },
      leads: { orderBy: { createdAt: "desc" }, include: { referral: { select: { id: true } } } },
      referrals: {
        orderBy: { createdAt: "asc" },
        include: { brand: { select: { companyName: true } }, creator: { select: { displayName: true } } },
      },
      payouts: { orderBy: { period: "desc" } },
    },
  });
  if (!ally) return null;
  const config = await prisma.platformConfig.findUnique({ where: { id: "singleton" }, select: { payoutDayOfMonth: true, refundHoldDays: true } });
  const payoutDay = config?.payoutDayOfMonth ?? 15;
  const holdDays = config?.refundHoldDays ?? 15;

  const referrals: AllyReferralRow[] = [];
  for (const r of ally.referrals) {
    const firstSaleAt = await firstSaleOf(r);
    const kind: AllyLeadKind = r.brandId ? "BRAND" : "CREATOR";
    const name = r.brand?.companyName ?? r.creator?.displayName ?? "—";
    if (!firstSaleAt) {
      referrals.push({ id: r.id, kind, name, rateBps: r.rateBps, windowMonths: r.windowMonths, state: "sin-ventas", firstSaleAt: null, endsAt: null, daysLeft: 0, months: {}, totalSales: 0, totalCommission: 0, linkedAt: r.createdAt, leadId: r.leadId });
      continue;
    }
    const endsAt = windowEnd(firstSaleAt, r.windowMonths);
    const sales = await salesOf(r, firstSaleAt, endsAt < now ? endsAt : undefined);
    const months = Object.fromEntries(monthlyEarnings(sales, firstSaleAt, r.windowMonths, r.rateBps));
    referrals.push({
      id: r.id,
      kind,
      name,
      rateBps: r.rateBps,
      windowMonths: r.windowMonths,
      state: endsAt <= now ? "terminada" : "activa",
      firstSaleAt,
      endsAt,
      daysLeft: daysLeft(firstSaleAt, r.windowMonths, now),
      months,
      totalSales: Object.values(months).reduce((n, m) => n + m.sales, 0),
      totalCommission: Object.values(months).reduce((n, m) => n + m.commission, 0),
      linkedAt: r.createdAt,
      leadId: r.leadId,
    });
  }

  const current = monthKey(now);
  const keys = new Set<string>([current]);
  for (const r of referrals) for (const key of Object.keys(r.months)) keys.add(key);
  for (const p of ally.payouts) keys.add(monthKey(p.period));
  const months: AllyMonthRow[] = Array.from(keys)
    .sort()
    .reverse()
    .map((key) => {
      const sales = referrals.reduce((n, r) => n + (r.months[key]?.sales ?? 0), 0);
      const commission = referrals.reduce((n, r) => n + (r.months[key]?.commission ?? 0), 0);
      const paid = ally.payouts.find((p) => monthKey(p.period) === key);
      const payout = paid ? { amount: Number(paid.amount), paidAt: paid.paidAt, reference: paid.reference } : null;
      const state: AllyMonthRow["state"] = payout ? "pagado" : key === current ? "en-curso" : commission > 0 ? "por-pagar" : "sin-comision";
      return { key, period: monthStart(key), sales, commission, state, payDate: allyPayDate(key, payoutDay, holdDays), payout };
    });

  const leads: AllyLeadRow[] = ally.leads
    .filter((l) => !l.referral)
    .map((l) => ({ id: l.id, kind: l.kind, name: l.name, contactName: l.contactName, phone: l.phone, instagram: l.instagram, city: l.city, status: l.status, createdAt: l.createdAt }));

  return {
    ally: {
      id: ally.id,
      userId: ally.userId,
      name: ally.name,
      email: ally.user.email,
      phone: ally.phone,
      code: ally.code,
      status: ally.status,
      brandRateBps: ally.brandRateBps,
      creatorRateBps: ally.creatorRateBps,
      windowMonths: ally.windowMonths,
      payoutDetails: {
        legalName: ally.legalName,
        documentType: ally.documentType,
        documentNumber: ally.documentNumber,
        payoutMethod: ally.payoutMethod,
        breBKey: ally.breBKey,
        bankName: ally.bankName,
        bankAccountType: ally.bankAccountType,
        bankAccountNumber: ally.bankAccountNumber,
      },
    },
    link: `${portalUrl()}/unete/${ally.code}`,
    payoutDay,
    referrals,
    leads,
    months,
    totals: {
      thisMonth: months.find((m) => m.key === current)?.commission ?? 0,
      pending: months.filter((m) => m.state === "por-pagar").reduce((n, m) => n + m.commission, 0),
      paid: ally.payouts.reduce((n, p) => n + Number(p.amount), 0),
    },
  };
}

export type AllyOverview = NonNullable<Awaited<ReturnType<typeof allyOverview>>>;

/// La lista de Admin → Aliados, con lo justo para escanear.
export async function listAllies(now = new Date()) {
  const allies = await prisma.allyProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, code: true, status: true, user: { select: { email: true } }, _count: { select: { referrals: true } } },
  });
  const pendingLeads = await prisma.allyLead.groupBy({ by: ["allyId"], where: { status: "PENDING" }, _count: { _all: true } });
  const pendingBy = new Map(pendingLeads.map((l) => [l.allyId, l._count._all]));
  const rows = [];
  for (const a of allies) {
    const overview = await allyOverview(a.id, now);
    rows.push({
      id: a.id,
      name: a.name,
      email: a.user.email,
      code: a.code,
      status: a.status,
      referrals: a._count.referrals,
      pendingLeads: pendingBy.get(a.id) ?? 0,
      thisMonth: overview?.totals.thisMonth ?? 0,
      pending: overview?.totals.pending ?? 0,
    });
  }
  return rows;
}

/// El pago de un mes: se guarda lo que se transfirió y la referencia.
export async function recordAllyPayout(allyId: string, input: { period: Date; amount: number; reference?: string | null; paidById?: string | null }) {
  if (!(input.amount > 0)) throw new AllyError("El valor del pago debe ser mayor que cero.");
  try {
    return await prisma.allyPayout.create({
      data: {
        allyId,
        period: monthStart(monthKey(input.period)),
        amount: new Prisma.Decimal(Math.round(input.amount)),
        reference: input.reference?.trim().slice(0, 120) || null,
        paidById: input.paidById ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new AllyError("Ese mes ya está pagado.");
    throw err;
  }
}

export async function undoAllyPayout(allyId: string, period: Date) {
  await prisma.allyPayout.deleteMany({ where: { allyId, period: monthStart(monthKey(period)) } });
}

export type AllyPayoutDetails = {
  legalName: string;
  documentType: string;
  documentNumber: string;
  payoutMethod: CreatorPayoutMethod;
  breBKey?: string | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
};

export async function updateAllyPayoutDetails(allyId: string, input: AllyPayoutDetails) {
  const bank = input.payoutMethod === "BANK";
  return prisma.allyProfile.update({
    where: { id: allyId },
    data: {
      legalName: input.legalName.trim().slice(0, 160),
      documentType: input.documentType.trim().slice(0, 20),
      documentNumber: input.documentNumber.replace(/[^\dA-Za-z-]/g, "").slice(0, 30),
      payoutMethod: input.payoutMethod,
      breBKey: bank ? null : (input.breBKey?.trim().slice(0, 80) ?? null),
      bankName: bank ? (input.bankName?.trim().slice(0, 80) ?? null) : null,
      bankAccountType: bank ? (input.bankAccountType?.trim().slice(0, 30) ?? null) : null,
      bankAccountNumber: bank ? (input.bankAccountNumber?.replace(/[^\d-]/g, "").slice(0, 30) ?? null) : null,
    },
  });
}

// ----------------------------------------------------------------------------
// Entrar sin contraseña
// ----------------------------------------------------------------------------

export async function createAllyLoginLink(userId: string, minutes = LOGIN_LINK_MINUTES) {
  const token = await createAllyLoginToken(userId, minutes);
  return `${portalUrl()}/aliado/entrar?token=${token}`;
}

/// Manda el link a su correo si es de un aliado. No dice si el
/// correo existe (para que nadie pueda averiguar quién es aliado).
export async function requestAllyLoginLink(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, role: "ALLY" },
    select: { id: true, email: true, allyProfile: { select: { name: true } } },
  });
  if (!user?.allyProfile) return;
  const url = await createAllyLoginLink(user.id);
  await sendAllyLoginEmail(user.email, { name: user.allyProfile.name, url, minutes: LOGIN_LINK_MINUTES });
}
