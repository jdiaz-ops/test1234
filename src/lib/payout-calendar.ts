/// Calendario de pago a las creadoras: cierre por mes (aprobado por Juan el
/// 2026-10-04). Lo que se vende en un mes se paga el día de pago
/// (PlatformConfig.payoutDayOfMonth, hoy el 15) del mes siguiente — todas
/// las ventas del mes juntas, en vez de que cada venta espere sus propios
/// 15 días y caiga en un pago distinto. La espera por devoluciones
/// (refundHoldDays) se sigue respetando: si una venta del último día del
/// mes no alcanzara a cumplirla, pasa al pago siguiente.
///
/// Todo en hora de Colombia (UTC-5 todo el año, sin horario de verano).

const BOGOTA_OFFSET_HOURS = 5;

/// Año, mes (0-11) y día de una fecha, vistos en Colombia.
export function bogotaDate(date: Date) {
  const local = new Date(date.getTime() - BOGOTA_OFFSET_HOURS * 3600 * 1000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

/// Las 00:00 de ese día en Colombia. Acepta meses fuera de 0-11 (se
/// corren al año siguiente, como Date.UTC).
export function bogotaMidnight(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, BOGOTA_OFFSET_HOURS));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function payoutDayIn(year: number, month: number, payoutDay: number) {
  const normalized = new Date(Date.UTC(year, month, 1));
  const y = normalized.getUTCFullYear();
  const m = normalized.getUTCMonth();
  return bogotaMidnight(y, m, Math.min(payoutDay, daysInMonth(y, m)));
}

/// El día en que se le paga a la creadora la comisión de una venta: el día
/// de pago del mes siguiente al de la venta, o el de después si la venta no
/// alcanzó a cumplir los días de espera por devoluciones.
export function payoutDateForSale(occurredAt: Date, payoutDay: number, holdDays: number) {
  const sale = bogotaDate(occurredAt);
  const holdEnds = bogotaMidnight(sale.year, sale.month, sale.day + holdDays);
  let payout = payoutDayIn(sale.year, sale.month + 1, payoutDay);
  if (holdEnds > payout) payout = payoutDayIn(sale.year, sale.month + 2, payoutDay);
  return payout;
}

/// El próximo día de pago desde hoy (hoy mismo si hoy es día de pago).
export function nextPayoutDate(now: Date, payoutDay: number) {
  const today = bogotaDate(now);
  const thisMonth = payoutDayIn(today.year, today.month, payoutDay);
  return thisMonth >= bogotaMidnight(today.year, today.month, today.day)
    ? thisMonth
    : payoutDayIn(today.year, today.month + 1, payoutDay);
}

/// "15 de noviembre".
export function formatPayoutDay(date: Date) {
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });
}

/// "octubre".
export function monthName(date: Date) {
  return date.toLocaleDateString("es-CO", { month: "long", timeZone: "America/Bogota" });
}
