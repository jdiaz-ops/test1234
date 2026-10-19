import { bogotaDate, bogotaMidnight, payoutDateForSale } from "@/lib/payout-calendar";

/// Cuánto gana un aliado comercial (ver AllyProfile en el schema): un % de
/// las ventas de cada marca o creadora que trajo, durante unos meses desde su
/// primera venta. Acá vive lo puro — ventanas, meses y redondeo — para
/// probarlo sin base de datos (ver ally-service.ts). Acordado el 2026-10-19:
/// 2,5 % de las ventas de cada marca y 1,25 % de cada creadora, 6 meses, sin
/// comisión después; si trajo la marca y la creadora, gana por las dos. Se
/// le paga cada mes igual que a las creadoras (ver allyPayDate), y las
/// licencias de contenido y el contenido pagado no cuentan: no son ventas.

export const ALLY_BRAND_RATE_BPS = 250;
export const ALLY_CREATOR_RATE_BPS = 125;
export const ALLY_WINDOW_MONTHS = 6;

export type AllySale = { at: Date; amount: number };
export type MonthEarnings = { sales: number; commission: number };

const DAY_MS = 24 * 3600 * 1000;

/// La misma fecha (y hora) `months` meses después; si ese mes no tiene el
/// día (31 de agosto + 6 = 28 de febrero), el último día del mes.
export function addMonths(date: Date, months: number) {
  const out = new Date(date.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

/// Hasta cuándo gana por esa marca o creadora (sin incluir ese momento).
export function windowEnd(firstSaleAt: Date, months: number) {
  return addMonths(firstSaleAt, months);
}

/// Días que le quedan (0 si ya terminó).
export function daysLeft(firstSaleAt: Date, months: number, now: Date) {
  return Math.max(0, Math.ceil((windowEnd(firstSaleAt, months).getTime() - now.getTime()) / DAY_MS));
}

/// "2026-10": el mes de una fecha en Colombia.
export function monthKey(date: Date) {
  const { year, month } = bogotaDate(date);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/// Las 00:00 del día 1 de ese mes en Colombia.
export function monthStart(key: string) {
  const [year, month] = key.split("-").map(Number);
  return bogotaMidnight(year, month - 1, 1);
}

/// El día en que se le paga lo ganado en un mes: el mismo de las creadoras
/// (ver payout-calendar.ts) — el día de pago del mes siguiente, o el de
/// después si la última venta del mes no alcanzó a cumplir la espera por
/// devoluciones. Pedido del 2026-10-19: "pago mensual, igual que los
/// creadores".
export function allyPayDate(key: string, payoutDay: number, holdDays: number) {
  const [year, month] = key.split("-").map(Number);
  const lastMoment = new Date(bogotaMidnight(year, month, 1).getTime() - 1);
  return payoutDateForSale(lastMoment, payoutDay, holdDays);
}

/// La comisión de una venta, en pesos enteros.
export function commissionFor(amount: number, rateBps: number) {
  return Math.round((amount * rateBps) / 10000);
}

/// Ventas y comisión por mes de una marca o creadora: solo cuentan las
/// ventas dentro de la ventana [primera venta, primera venta + meses).
export function monthlyEarnings(sales: AllySale[], firstSaleAt: Date, months: number, rateBps: number) {
  const end = windowEnd(firstSaleAt, months).getTime();
  const out = new Map<string, MonthEarnings>();
  for (const sale of sales) {
    const at = sale.at.getTime();
    if (at < firstSaleAt.getTime() || at >= end || !(sale.amount > 0)) continue;
    const key = monthKey(sale.at);
    const month = out.get(key) ?? { sales: 0, commission: 0 };
    month.sales += sale.amount;
    out.set(key, month);
  }
  // La comisión se calcula sobre el total del mes (un solo redondeo).
  for (const month of out.values()) {
    month.sales = Math.round(month.sales);
    month.commission = commissionFor(month.sales, rateBps);
  }
  return out;
}

/// "2,5 %".
export function formatRate(rateBps: number) {
  return `${(rateBps / 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;
}

/// "$1.250.000".
export function formatCop(value: number) {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

/// "octubre de 2026".
export function monthLabel(key: string) {
  return monthStart(key).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "America/Bogota" });
}
