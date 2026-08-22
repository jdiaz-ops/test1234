import type { ChallengeTemplate } from "@/lib/challenge-types";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

/// Plantillas listas para usar — pensadas para que una marca sin experiencia
/// previa en este tipo de campañas vea de una qué se puede hacer con lo que
/// ya está permitido (Bono por ventas / Comisión temporal elevada), en vez
/// de enfrentarse a un formulario en blanco. Los montos de comisión se
/// calculan sobre la comisión real de la oferta, para que la sugerencia sea
/// suya, no un número genérico.
export function buildChallengeTemplates(defaultCommissionPercent: number): ChallengeTemplate[] {
  const boosted = Math.min(100, Math.round(defaultCommissionPercent * 2));
  const boostedSmall = Math.min(100, Math.round(defaultCommissionPercent + 5));

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
      key: "fin-de-semana",
      title: "Fin de semana con comisión doble",
      description: "Bueno para un lanzamiento corto o liquidar inventario.",
      name: "Fin de semana comisión doble",
      type: "TEMP_COMMISSION_BOOST",
      durationDays: 3,
      newCommissionPercent: boosted,
    },
    {
      key: "temporada-alta",
      title: "Semana de temporada alta",
      description: "Útil en fechas de alta demanda.",
      name: "Comisión elevada — temporada alta",
      type: "TEMP_COMMISSION_BOOST",
      durationDays: 7,
      newCommissionPercent: boostedSmall,
    },
  ];
}

/// La explicación en palabras, con números concretos — para que quede
/// clarísimo qué está activando la marca antes de darle a "Usar esta
/// plantilla". Se arma a partir de los valores reales de la plantilla, así
/// que si algún día cambian los montos, el texto sigue siendo cierto.
function explainTemplate(t: ChallengeTemplate, defaultCommissionPercent: number): string {
  if (t.type === "GOAL_BONUS") {
    return `Si un creador vende ${formatCOP(t.goalAmount!)} en total con su código durante los ${t.durationDays} días del reto, gana ${formatCOP(t.bonusAmount!)} de bono — adicional a su comisión normal por esas mismas ventas. Aplica a cada creador que llegue a la meta, no solo al primero.`;
  }
  return `Durante los ${t.durationDays} días del reto, la comisión de TODOS tus creadores vinculados a esta oferta sube de ${defaultCommissionPercent}% a ${t.newCommissionPercent}% — sin excepción, mientras dure.`;
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
        {templates.map((t) => (
          <div key={t.key} className="rounded-2xl border border-brand-line bg-brand-surface p-5 flex flex-col">
            <p className="font-display font-semibold text-brand-ink mb-1">{t.title}</p>
            <p className="text-xs text-brand-ink-soft mb-3">{t.description}</p>

            <div className="flex items-center gap-3 text-xs font-mono text-brand-ink-soft mb-3">
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
              <span>{t.durationDays} días</span>
            </div>

            <p className="text-xs text-brand-ink-soft bg-brand-bg rounded-lg p-3 mb-4 flex-1">
              {explainTemplate(t, defaultCommissionPercent)}
            </p>

            <button
              onClick={() => onUseTemplate(t)}
              className="self-start bg-brand-accent text-white text-xs font-medium rounded-full px-5 py-2 hover:opacity-90"
            >
              Usar esta plantilla
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
