/// Días hábiles en Colombia — se usa para calcular los plazos de pago del
/// Motor de Cobro (ver payment-service.ts): "72 horas hábiles" no cuenta
/// sábados, domingos, ni festivos colombianos. Se interpreta como 3 días
/// hábiles completos (72 / 24), no como 72 horas de reloj saltando franjas
/// — así un plazo que arranca viernes 5:11pm cae, contando lunes/martes/
/// miércoles como los 3 hábiles, el miércoles 5:11pm.

/// Algoritmo de Gauss para el domingo de Pascua (calendario gregoriano) —
/// de ahí salen Jueves/Viernes Santo y los tres festivos que se cuentan a
/// partir de esa fecha (Ascensión, Corpus Christi, Sagrado Corazón).
function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/// Ley 51 de 1983 ("Ley Emiliani") — estos festivos se corren al lunes
/// siguiente cuando no caen en lunes. Se le pasa ya la fecha real (ej. 6
/// de enero) y el resultado siempre cae en lunes.
function nextMonday(date: Date): Date {
  const day = date.getUTCDay(); // 0 = domingo … 6 = sábado
  if (day === 1) return date;
  const daysToAdd = (8 - day) % 7 || 7;
  return addDaysUTC(date, daysToAdd);
}

function toISODateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const holidayCache = new Map<number, Set<string>>();

/// Todos los festivos colombianos de un año — fijos (nunca se corren),
/// trasladables al lunes (Ley Emiliani), y los que dependen de la Pascua.
function colombianHolidaysForYear(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const dates = new Set<string>();
  const add = (d: Date) => dates.add(toISODateOnly(d));

  // Fijos — nunca se corren, sin importar el día de la semana.
  add(new Date(Date.UTC(year, 0, 1))); // Año Nuevo
  add(new Date(Date.UTC(year, 4, 1))); // Día del Trabajo
  add(new Date(Date.UTC(year, 6, 20))); // Independencia
  add(new Date(Date.UTC(year, 7, 7))); // Batalla de Boyacá
  add(new Date(Date.UTC(year, 11, 8))); // Inmaculada Concepción
  add(new Date(Date.UTC(year, 11, 25))); // Navidad

  // Trasladables al lunes siguiente (Ley Emiliani).
  const emiliani = [
    new Date(Date.UTC(year, 0, 6)), // Reyes Magos
    new Date(Date.UTC(year, 2, 19)), // San José
    new Date(Date.UTC(year, 5, 29)), // San Pedro y San Pablo
    new Date(Date.UTC(year, 7, 15)), // Asunción de la Virgen
    new Date(Date.UTC(year, 9, 12)), // Día de la Raza
    new Date(Date.UTC(year, 10, 1)), // Todos los Santos
    new Date(Date.UTC(year, 10, 11)), // Independencia de Cartagena
  ];
  for (const d of emiliani) add(nextMonday(d));

  // A partir de la Pascua — Jueves/Viernes Santo se celebran en su fecha
  // real (no se corren); Ascensión/Corpus/Sagrado Corazón caen siempre en
  // lunes por construcción (39/60/68 días después de un domingo, ya
  // corridos al lunes siguiente — son +43/+64/+71 exactos).
  const easter = computeEasterSunday(year);
  add(addDaysUTC(easter, -3)); // Jueves Santo
  add(addDaysUTC(easter, -2)); // Viernes Santo
  add(addDaysUTC(easter, 43)); // Ascensión del Señor
  add(addDaysUTC(easter, 64)); // Corpus Christi
  add(addDaysUTC(easter, 71)); // Sagrado Corazón

  holidayCache.set(year, dates);
  return dates;
}

export function isColombianHoliday(date: Date): boolean {
  return colombianHolidaysForYear(date.getUTCFullYear()).has(toISODateOnly(date));
}

function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !isColombianHoliday(date);
}

/// Suma "horas hábiles" a una fecha, saltando fines de semana y festivos
/// colombianos — en la práctica siempre se llama con múltiplos de 24 (ej.
/// 72 = 3 días hábiles), así que se cuenta día calendario por día
/// calendario y se aterriza a la misma hora del día de salida.
export function addBusinessHours(start: Date, hours: number): Date {
  const businessDays = Math.round(hours / 24);
  const result = new Date(start);
  let counted = 0;
  while (counted < businessDays) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result)) counted++;
  }
  return result;
}
