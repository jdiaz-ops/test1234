const TZ = "America/Bogota";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const timeFmt = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long" });
const dateFmt = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, day: "numeric", month: "short" });
const fullDateFmt = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });

/// "Hoy a las 3:54 p. m.", "Ayer a las...", "domingo a las..." en la última
/// semana, y si no "27 de ago a las..." — como la lista de pedidos de
/// Shopify. En hora de Colombia.
export function relativeOrderDate(date: Date, now: Date) {
  const time = timeFmt.format(date);
  const days = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(date))) / 86_400_000);
  if (days === 0) return `Hoy a las ${time}`;
  if (days === 1) return `Ayer a las ${time}`;
  if (days > 1 && days < 7) return `${weekdayFmt.format(date)} a las ${time}`;
  if (dayKey(date).slice(0, 4) !== dayKey(now).slice(0, 4)) return fullDateFmt.format(date);
  return `${dateFmt.format(date)} a las ${time}`;
}
