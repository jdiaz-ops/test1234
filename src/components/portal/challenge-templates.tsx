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
      description: `Sube la comisión de ${defaultCommissionPercent}% a ${boosted}% por 3 días — bueno para un lanzamiento corto o liquidar inventario.`,
      name: "Fin de semana comisión doble",
      type: "TEMP_COMMISSION_BOOST",
      durationDays: 3,
      newCommissionPercent: boosted,
    },
    {
      key: "temporada-alta",
      title: "Semana de temporada alta",
      description: `Sube la comisión de ${defaultCommissionPercent}% a ${boostedSmall}% durante toda la semana — útil en fechas de alta demanda.`,
      name: "Comisión elevada — temporada alta",
      type: "TEMP_COMMISSION_BOOST",
      durationDays: 7,
      newCommissionPercent: boostedSmall,
    },
  ];
}

export function ChallengeTemplates({
  templates,
  onUseTemplate,
}: {
  templates: ChallengeTemplate[];
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
          <div key={t.key} className="rounded-2xl border border-brand-line bg-brand-surface p-5">
            <p className="font-display font-semibold text-brand-ink mb-1">{t.title}</p>
            <p className="text-xs text-brand-ink-soft mb-4">{t.description}</p>
            <div className="flex items-center gap-3 text-xs font-mono text-brand-ink-soft mb-4">
              {t.type === "GOAL_BONUS" ? (
                <>
                  <span>Meta {formatCOP(t.goalAmount!)}</span>
                  <span>·</span>
                  <span>Bono {formatCOP(t.bonusAmount!)}</span>
                </>
              ) : (
                <span>Comisión {t.newCommissionPercent}%</span>
              )}
              <span>·</span>
              <span>{t.durationDays} días</span>
            </div>
            <button
              onClick={() => onUseTemplate(t)}
              className="text-xs text-brand-accent font-medium hover:underline"
            >
              Usar esta plantilla
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
