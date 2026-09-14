/// Departamentos de Colombia (DIVIPOLA) — para armar zonas de envío por
/// región (ver ShippingZone en el schema). Bogotá D.C. va aparte, como en
/// la división real del país.
export const COLOMBIA_REGIONS = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
] as const;

/// Marcador especial en ShippingZone.regions para "el resto del país" — lo
/// que ninguna otra zona de la marca ya cubre. Nunca aparece en
/// COLOMBIA_REGIONS, así que no puede chocar con un departamento real.
export const REST_OF_COUNTRY = "*";
