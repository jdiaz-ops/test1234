import type { ChallengeType } from "@/lib/challenge-types";
import { roiComment, formatROI, ROI_SMALL_SAMPLE_THRESHOLD } from "@/lib/challenge-roi";

// Componente puramente presentacional (sin hooks ni interactividad) — así
// lo puede usar tanto la tarjeta de campaña (challenges-panel.tsx, cliente)
// como el aviso del Dashboard (marca/page.tsx, servidor) sin forzar a este
// último a convertirse en cliente.

export function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

export interface ChallengeResults {
  gmv: number;
  orderCount: number;
  totalCommission: number;
  totalBonus: number;
  creatorsReachedGoal: number;
  creatorsSoldNotReached: number;
  roi: number | null;
}

function StatTile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-brand-bg px-3 py-2.5">
      <p className={`font-mono text-lg font-medium leading-tight ${accent ? "text-brand-accent" : "text-brand-ink"}`}>
        {value}
      </p>
      <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">{label}</p>
    </div>
  );
}

// El resumen de resultado de una campaña terminada — para que la marca vea
// de un vistazo si le funcionó, sin tener que ir a Transacciones a sumar a
// mano. Meta/bono solo tienen sentido para Misión y Mix; GMV, órdenes y
// comisión aplican a cualquier tipo. `title` es editable porque el mismo
// bloque se reusa con encabezados distintos ("Resultado de la campaña" en
// la tarjeta, nada — ya lo dice el contenedor — en el aviso del Dashboard).
export function ChallengeResultsGrid({
  type,
  results,
  title = "Resultado de la campaña",
}: {
  type: ChallengeType;
  results: ChallengeResults;
  title?: string | null;
}) {
  const hasGoal = type === "GOAL_BONUS" || type === "MIX";
  const comment = roiComment(results.roi);
  const smallSample = results.orderCount > 0 && results.orderCount < ROI_SMALL_SAMPLE_THRESHOLD;
  return (
    <div>
      {title && <p className="text-xs text-brand-ink-soft mb-2">{title}</p>}

      {results.roi != null ? (
        <div className="rounded-xl bg-brand-accent-soft px-4 py-3 mb-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="font-display text-2xl font-bold text-brand-accent">{formatROI(results.roi)}</p>
            <p className="text-xs text-brand-ink-soft">
              por cada $1 invertido (comisión + bono + tarifa), generaste {formatROI(results.roi)} en ventas
            </p>
          </div>
          {comment && <p className="text-sm text-brand-ink font-medium mt-1.5">{comment}</p>}
          {smallSample && (
            <p className="text-xs text-brand-ink-soft mt-1.5">
              Muestra pequeña ({results.orderCount} {results.orderCount === 1 ? "orden" : "órdenes"}) — tómalo con cautela.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-brand-ink-soft mb-3">No hubo ventas registradas durante esta campaña.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {hasGoal && (
          <>
            <StatTile value={String(results.creatorsReachedGoal)} label="Creadores que lograron la meta" accent />
            <StatTile value={String(results.creatorsSoldNotReached)} label="Vendieron, pero no llegaron" />
          </>
        )}
        <StatTile value={formatCOP(results.gmv)} label="Ventas generadas (GMV)" />
        <StatTile value={String(results.orderCount)} label="Órdenes" />
        {hasGoal && <StatTile value={formatCOP(results.totalBonus)} label="Bono total otorgado" />}
        <StatTile value={formatCOP(results.totalCommission)} label="Comisión total generada" />
      </div>
    </div>
  );
}
