import type { ChallengeTemplate } from "@/lib/challenge-types";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/// Plantillas listas para usar — pensadas para que una marca sin experiencia
/// previa en este tipo de campañas vea de una qué se puede hacer con lo que
/// ya está permitido (Bono por ventas / Comisión temporal elevada), en vez
/// de enfrentarse a un formulario en blanco. Los montos de comisión se
/// calculan sobre la comisión real de la oferta, para que la sugerencia sea
/// suya, no un número genérico. Las fechas son solo un punto de partida
/// (hoy + N días) — la marca las ajusta a la fecha real que tenga en mente.
export function buildChallengeTemplates(defaultCommissionPercent: number, now = new Date()): ChallengeTemplate[] {
  const boosted = Math.min(100, Math.round(defaultCommissionPercent * 2));
  const boostedSmall = Math.min(100, Math.round(defaultCommissionPercent + 5));
  const boostedFlash = Math.min(100, Math.round(defaultCommissionPercent * 2.5));

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
      key: "fecha-especial",
      title: "Fecha especial",
      description:
        "Sube la comisión durante una fecha fuerte para tu negocio — úsala para Black Friday, Día de la Madre, San Valentín, Navidad y Fin de Año, o cualquier otra que tengas en mente. Ajusta las fechas a la que quieras aprovechar.",
      name: "Comisión elevada — fecha especial",
      type: "TEMP_COMMISSION_BOOST",
      durationDays: 7,
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
    {
      key: "pr-gifting",
      title: "Envío de producto (PR)",
      description:
        "Mándales un kit a un grupo de creadoras a cambio de contenido puntual — no es un envío suelto, queda atado al mismo código con el que también ganan su comisión si venden.",
      name: "Campaña de producto nuevo",
      type: "CONTENT_CHALLENGE",
      durationDays: 15,
      instructions: "Publica un Reel o TikTok mostrando el producto en uso y mándanos el link.",
      bonusAmount: 80000,
      kitItems: ["Producto principal (tono o variante a elección)", "1 producto complementario"],
      requirements: ["1 Reel o TikTok (mín. 30 seg)", "Mostrar antes y después", "Mencionar el beneficio principal"],
      deliverables: ["Etiquetar a tu marca", "Mantenerlo publicado 30 días"],
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
  if (t.type === "CONTENT_CHALLENGE") {
    return `Eliges a quién invitar, le mandas el kit y el brief. Si aprobás su contenido dentro de los ${durationDays} días, gana ${formatCOP(t.bonusAmount!)} de bono — y si además vende con su código, esa venta paga su comisión normal aparte.`;
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
                {t.type === "GOAL_BONUS" && (
                  <>
                    <span>Meta {formatCOP(t.goalAmount!)}</span>
                    <span>·</span>
                    <span>Bono {formatCOP(t.bonusAmount!)}</span>
                  </>
                )}
                {t.type === "CONTENT_CHALLENGE" && (
                  <>
                    <span>Bono {formatCOP(t.bonusAmount!)}</span>
                    <span>·</span>
                    <span>{(t.kitItems ?? []).length} ítem(s) de kit</span>
                  </>
                )}
                {t.type === "TEMP_COMMISSION_BOOST" && (
                  <span>
                    Comisión {defaultCommissionPercent}% → {t.newCommissionPercent}%
                  </span>
                )}
                <span>·</span>
                <span>{formatDateRange(startISO, endISO)} (sugerido)</span>
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
