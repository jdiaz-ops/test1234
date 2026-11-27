/// Código postal de una dirección de Colombia con la API de Geocoding de
/// Google Maps, para las guías de Envia: Interrapidísimo asigna la zona de
/// reparto con el código postal real de la compradora, y el checkout no lo
/// exige (ver envia-service.ts, conversación del 2026-11-27).
///
/// Se activa con GOOGLE_MAPS_API_KEY (una llave con la "Geocoding API").
/// Sin llave, o si Google no ubica la dirección con precisión o falla,
/// devuelve null y la guía sigue sin él. No se registra la dirección.

const TIMEOUT_MS = 8_000;

/// Resultados que ubican la casa o el edificio. Una calle completa
/// ("route") o un barrio pueden caer en varios códigos postales.
const PRECISE_TYPES = ["street_address", "premise", "subpremise", "establishment", "point_of_interest"];

type GoogleResult = {
  types?: string[];
  address_components?: { long_name?: string; types?: string[] }[];
};

export function googleGeocodingEnabled() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

export async function postalCodeFromGoogle(address: { street: string; city: string; region: string }): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return null;
  const params = new URLSearchParams({
    address: `${address.street}, ${address.city}, ${address.region}, Colombia`,
    components: "country:CO",
    region: "co",
    language: "es",
    key,
  });
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as { status?: string; results?: GoogleResult[] } | null;
    if (json?.status !== "OK") {
      if (json?.status !== "ZERO_RESULTS") console.warn(`[geocoding] Google no respondió bien: ${json?.status ?? res.status}`);
      return null;
    }
    const result = json.results?.[0];
    if (!result?.types?.some((t) => PRECISE_TYPES.includes(t))) return null;
    const postal = result.address_components?.find((c) => c.types?.includes("postal_code"))?.long_name;
    return typeof postal === "string" && postal.trim() ? postal.trim() : null;
  } catch {
    console.warn("[geocoding] Google no respondió a tiempo.");
    return null;
  }
}
