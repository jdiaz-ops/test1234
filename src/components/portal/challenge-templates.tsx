import type { ChallengeTemplate } from "@/lib/challenge-types";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

/// Próxima fecha con ese mes/día — si ya pasó este año, salta al siguiente.
/// Para las plantillas de temporada con fecha fija (ej. San Valentín).
function nextFixedDate(month: number, day: number, from = new Date()): Date {
  const year = from.getFullYear();
  let d = new Date(year, month - 1, day);
  if (d < from) d = new Date(year + 1, month - 1, day);
  return d;
}

/// El n-ésimo día de la semana (0=domingo...6=sábado) de un mes — ej. el
/// "4to jueves de noviembre" (Thanksgiving/Black Friday) o el "2do domingo
/// de mayo" (Día de la Madre en Colombia).
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + (n - 1) * 7);
}

function nextNthWeekdayOfMonth(month: number, weekday: number, n: number, from = new Date()): Date {
  let d = nthWeekdayOfMonth(from.getFullYear(), month, weekday, n);
  if (d < from) d = nthWeekdayOfMonth(from.getFullYear() + 1, month, weekday, n);
  return d;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/// Plantillas listas para usar — pensadas para que una marca sin experiencia
/// previa en este tipo de campañas vea de una qué se puede hacer con lo que
/// ya está permitido (Bono por ventas / Comisión temporal elevada), en vez
/// de enfrentarse a un formulario en blanco. Las de temporada traen la fecha
/// REAL del próximo evento (no "hoy + N días") — Black Friday, por ejemplo,
/// siempre cae el viernes después del 4to jueves de noviembre, sea cual sea
/// el año en que se use la plantilla.
export function buildChallengeTemplates(defaultCommissionPercent: number, now = new Date()): ChallengeTemplate[] {
  const boosted = Math.min(100, Math.round(defaultCommissionPercent * 2));
  const boostedSmall = Math.min(100, Math.round(defaultCommissionPercent + 5));
  const boostedFlash = Math.min(100, Math.round(defaultCommissionPercent * 2.5));

  const blackFridayThu = nextNthWeekdayOfMonth(11, 4, 4, now); // 4to jueves de noviembre
  const madre = nextNthWeekdayOfMonth(5, 0, 2, now); // 2do domingo de mayo
  const sanValentin = nextFixedDate(2, 14, now);
  const navidadInicio = nextFixedDate(12, 15, now);
  const navidadFin = new Date(navidadInicio.getFullYear(), 11, 31);

  return [
    {
      key: "lanzamiento",
      title: "Reto de lanzamiento",
      description: "Impulsa las primeras semanas de un producto o campaña nueva.",
      name: "Reto de lanzamiento",
      type: "GOAL_BONUS",
      durationDays: 15,
      goalAmount: 2000000,
      bonusAmount: 150000,
    },
    {
      key: "mensual",
      title: "Meta mensual",
      description: "Un bono recurrente cada mes para mantener el ritmo de ventas.",
      name: "Meta del mes",
      type: "GOAL_BONUS",
      durationDays: 30,
      goalAmount: 5000000,
      bonusAmount: 300000,
    },
    {
      key: "black-friday",
      title: "Black Friday",
      description: "El fin de semana de más demanda del año — captura más de esas ventas.",
      name: "Black Friday",
      type: "TEMP_COMMISSION_BOOST",
      startDate: toISO(blackFridayThu),
      endDate: toISO(addDays(blackFridayThu, 4)), // jueves a lunes (Cyber Monday)
      newCommissionPercent: boosted,
    },
    {
      key: "dia-de-la-madre",
      title: "Día de la Madre",
      description: "La semana previa, cuando más se compran regalos.",
      name: "Día de la Madre",
      type: "TEMP_COMMISSION_BOOST",
      startDate: toISO(addDays(madre, -6)),
      endDate: toISO(madre),
      newCommissionPercent: boostedSmall,
    },
    {
      key: "san-valentin",
      title: "San Valentín",
      description: "Los días alrededor del 14 de febrero.",
      name: "San Valentín",
      type: "TEMP_COMMISSION_BOOST",
      startDate: toISO(addDays(sanValentin, -2)),
      endDate: toISO(sanValentin),
      newCommissionPercent: boosted,
    },
    {
      key: "navidad",
      title: "Navidad y Fin de Año",
      description: "La segunda quincena de diciembre, la temporada más fuerte de compras.",
      name: "Navidad y Fin de Año",
      type: "TEMP_COMMISSION_BOOST",
      startDate: toISO(navidadInicio),
      endDate: toISO(navidadFin),
      newCommissionPercent: boostedSmall,
    },
    {
      key: "relampago",
      title: "Reto relámpago",
      description: "Solo 48 horas, para generar urgencia real — actívalo cuando quieras.",
      name: "Reto relámpago",
      type: "TEMP_COMMISSION_BOOST",
      durationDays: 2,
      newCommissionPercent: boostedFlash,
    },
  ];
}

/// La explicación en palabras, con números concretos — para que quede
/// clarísimo qué está activando la marca antes de darle a "Usar esta
/// plantilla". Se arma a partir de los valores reales de la plantilla, así
/// que si algún día cambian los montos, el texto sigue siendo cierto.
function explainTemplate(t: ChallengeTemplate, defaultCommissionPercent: number, durationDays: number): string {
  if (t.type === "GOAL_BONUS") {
    return `Si un creador vende ${formatCOP(t.goalAmount!)} en total con su código durante los ${durationDays} días del reto, gana ${formatCOP(t.bonusAmount!)} de bono — adicional a su comisión normal por esas mismas ventas. Aplica a cada creador que llegue a la meta, no solo al primero.`;
  }
  return `Durante los ${durationDays} días del reto, la comisión de TODOS tus creadores vinculados a esta oferta sube de ${defaultCommissionPercent}% a ${t.newCommissionPercent}% — sin excepción, mientras dure.`;
}

function formatDateRange(startISO: string, endISO: string) {
  const fmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
  return `${fmt.format(new Date(startISO + "T00:00:00"))} — ${fmt.format(new Date(endISO + "T00:00:00"))}`;
}

export function ChallengeTemplates({
  templates,
  defaultCommissionPercent,
  onUseTemplate,
}: {
  templates: ChallengeTemplate[];
  defaultCommissionPercent: number;
  onUseTemplate: (template: ChallengeTemplate) => void;
}) {
  return (
    <div className="mb-10">
      <h2 className="font-display font-semibold text-brand-ink mb-1">Plantillas listas para usar</h2>
      <p className="text-sm text-brand-ink-soft mb-4">
        Elige una, revisa las fechas y montos, y actívala — o ajústalos a tu gusto antes de crear el reto.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {templates.map((t) => {
          const startISO = t.startDate ?? toISO(new Date());
          const endISO = t.endDate ?? toISO(addDays(new Date(), t.durationDays ?? 7));
          const durationDays = Math.round(
            (new Date(endISO).getTime() - new Date(startISO).getTime()) / (24 * 60 * 60 * 1000)
          );

          return (
            <div key={t.key} className="rounded-2xl border border-brand-line bg-brand-surface p-5 flex flex-col">
              <p className="font-display font-semibold text-brand-ink mb-1">{t.title}</p>
              <p className="text-xs text-brand-ink-soft mb-3">{t.description}</p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-brand-ink-soft mb-3">
                {t.type === "GOAL_BONUS" ? (
                  <>
                    <span>Meta {formatCOP(t.goalAmount!)}</span>
                    <span>·</span>
                    <span>Bono {formatCOP(t.bonusAmount!)}</span>
                  </>
                ) : (
                  <span>
                    Comisión {defaultCommissionPercent}% → {t.newCommissionPercent}%
                  </span>
                )}
                <span>·</span>
                <span>{formatDateRange(startISO, endISO)}</span>
              </div>

              <p className="text-xs text-brand-ink-soft bg-brand-bg rounded-lg p-3 mb-4 flex-1">
                {explainTemplate(t, defaultCommissionPercent, durationDays)}
              </p>

              <button
                onClick={() => onUseTemplate(t)}
                className="self-start bg-brand-accent text-white text-xs font-medium rounded-full px-5 py-2 hover:opacity-90"
              >
                Usar esta plantilla
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
