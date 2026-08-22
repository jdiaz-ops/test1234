export type ChallengeType = "GOAL_BONUS" | "TEMP_COMMISSION_BOOST" | "LEADERBOARD" | "WELCOME_BONUS" | "CONTENT_CHALLENGE";

/// Ocultos por ahora (no se destruyen — los retos ya creados con estos tipos
/// simplemente dejan de mostrarse, en marca y en creador, hasta que se
/// vuelvan a activar aquí).
export const HIDDEN_CHALLENGE_TYPES: ChallengeType[] = ["LEADERBOARD", "WELCOME_BONUS", "CONTENT_CHALLENGE"];

export const VISIBLE_CHALLENGE_TYPES: ChallengeType[] = (
  ["GOAL_BONUS", "TEMP_COMMISSION_BOOST", "LEADERBOARD", "WELCOME_BONUS", "CONTENT_CHALLENGE"] as ChallengeType[]
).filter((t) => !HIDDEN_CHALLENGE_TYPES.includes(t));
