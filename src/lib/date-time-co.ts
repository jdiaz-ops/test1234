/// Fecha y hora en Colombia escritas a mano, igual en el servidor y en el
/// navegador. Con toLocaleString cada lado usa su propio ICU: el Node del
/// servidor escribe "19 de octubre de 2026 a las 1:11 p. m." y Chrome "19
/// de octubre de 2026, 1:11 p. m." (y a veces otro espacio antes de "p.
/// m."), y React avisa que la página no coincide al hidratar. Sin zona
/// horaria fija, además, cada lado usa la suya. Colombia es UTC-5 todo el
/// año (ver payout-calendar.ts).

const BOGOTA_OFFSET_MS = 5 * 3600 * 1000;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function bogotaParts(value: string | Date) {
  const local = new Date(new Date(value).getTime() - BOGOTA_OFFSET_MS);
  const hours = local.getUTCHours();
  return {
    day: local.getUTCDate(),
    month: local.getUTCMonth(),
    year: local.getUTCFullYear(),
    time: `${hours % 12 || 12}:${String(local.getUTCMinutes()).padStart(2, "0")} ${hours < 12 ? "a. m." : "p. m."}`,
  };
}

/// "19 de octubre de 2026, 1:11 p. m."
export function formatDateTimeCo(value: string | Date) {
  const p = bogotaParts(value);
  return `${p.day} de ${MONTHS[p.month]} de ${p.year}, ${p.time}`;
}

/// "19 oct, 1:11 p. m." — o "19 oct 2026, 1:11 p. m." con el año.
export function formatShortDateTimeCo(value: string | Date, opts: { year?: boolean } = {}) {
  const p = bogotaParts(value);
  return `${p.day} ${MONTHS_SHORT[p.month]}${opts.year ? ` ${p.year}` : ""}, ${p.time}`;
}
