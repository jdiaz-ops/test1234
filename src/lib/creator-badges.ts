/// Catálogo de insignias — a propósito NO es un enum de Prisma, para poder
/// agregar/editar insignias sin migración. CreatorBadge.badgeKey solo debe
/// contener claves de este catálogo (no se valida en base de datos).
///
/// El nombre del ícono referencia un export de @/components/marketing/icons
/// — se resuelve en el componente que dibuja las insignias, no acá, para
/// que este archivo no dependa de React.
export type CreatorBadgeDef = {
  key: string;
  label: string;
  description: string;
  icon: "IconSparkle" | "IconStore" | "IconLayers" | "IconGift" | "IconTrendingUp" | "IconWallet" | "IconTrace" | "IconTarget";
};

export const CREATOR_BADGE_CATALOG: CreatorBadgeDef[] = [
  {
    key: "perfil_completo",
    label: "Perfil completo",
    description: "Terminaste los 4 pasos de tu perfil de creador.",
    icon: "IconSparkle",
  },
  {
    key: "primera_marca",
    label: "Primera marca",
    description: "Te uniste a tu primera marca en el marketplace.",
    icon: "IconStore",
  },
  {
    key: "multimarca",
    label: "Multimarca",
    description: "Estás activo en 3 marcas o más al mismo tiempo.",
    icon: "IconLayers",
  },
  {
    key: "primera_venta",
    label: "Primera venta",
    description: "Alguien compró usando tu código por primera vez.",
    icon: "IconGift",
  },
  {
    key: "diez_ventas",
    label: "10 ventas",
    description: "Ya generaste 10 ventas con tus códigos.",
    icon: "IconTrendingUp",
  },
  {
    key: "millon_comisiones",
    label: "$1.000.000 en comisiones",
    description: "Superaste el millón de pesos generados en comisiones.",
    icon: "IconWallet",
  },
  {
    key: "primer_pago",
    label: "Primer pago recibido",
    description: "Ya recibiste tu primera transferencia de Marcolini.",
    icon: "IconTrace",
  },
  {
    key: "ganador_reto",
    label: "Campaña ganada",
    description: "Ganaste una campaña propuesta por una marca.",
    icon: "IconTarget",
  },
];

export function getBadgeDef(key: string): CreatorBadgeDef | undefined {
  return CREATOR_BADGE_CATALOG.find((b) => b.key === key);
}
