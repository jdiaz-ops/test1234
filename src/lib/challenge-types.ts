export type ChallengeType =
  | "GOAL_BONUS"
  | "TEMP_COMMISSION_BOOST"
  | "TEMP_DISCOUNT_BOOST"
  | "LEADERBOARD"
  | "WELCOME_BONUS"
  | "CONTENT_CHALLENGE";

/// Ocultos por ahora (no se destruyen — los retos ya creados con estos tipos
/// simplemente dejan de mostrarse, en marca y en creador, hasta que se
/// vuelvan a activar aquí).
export const HIDDEN_CHALLENGE_TYPES: ChallengeType[] = ["LEADERBOARD", "WELCOME_BONUS", "CONTENT_CHALLENGE"];

export const VISIBLE_CHALLENGE_TYPES: ChallengeType[] = (
  [
    "GOAL_BONUS",
    "TEMP_COMMISSION_BOOST",
    "TEMP_DISCOUNT_BOOST",
    "LEADERBOARD",
    "WELCOME_BONUS",
    "CONTENT_CHALLENGE",
  ] as ChallengeType[]
).filter((t) => !HIDDEN_CHALLENGE_TYPES.includes(t));

/// Plantilla de reto lista para usar — la marca solo tiene que revisar/tocar
/// las fechas y montos antes de crearlo.
/// Fechas: si la plantilla trae startDate/endDate explícitas (ISO
/// yyyy-mm-dd) — las de temporada, atadas a una fecha real del calendario —
/// se usan tal cual. Si no, se sugiere hoy -> hoy + durationDays (las que no
/// dependen de una fecha, como Reto relámpago o Meta mensual).
export type ChallengeTemplate = {
  key: string;
  title: string;
  description: string;
  name: string;
  type: ChallengeType;
  durationDays?: number;
  startDate?: string;
  endDate?: string;
  goalAmount?: number;
  bonusAmount?: number;
  newCommissionPercent?: number;
  newDiscountPercent?: number;
};
