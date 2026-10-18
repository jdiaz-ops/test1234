/// Nombres de productos y colecciones sin el nombre de la tienda.
///
/// Muchas tiendas repiten su nombre en cada título, como texto para
/// Google: "Gel Polish Azules | Beauty Solution", "Tips Coffin - Mi
/// Tienda". Importado así, cada producto y colección de Marcolini
/// cargaría ese remate. Acá se detecta y se quita, de dos formas:
///   · por el nombre de la tienda cuando se conoce (extractStoreName en
///     shopify-theme.ts) y algún título termina con él;
///   · si no, por el remate que se repite después de "|" en varios
///     títulos (solo el "|": un " - " suele ser parte del nombre).
/// En las colecciones, además, un título con "|" se queda con la primera
/// parte: "AcrySoft™ | Soft Gel Tips Profesionales" es para Google, la
/// colección se llama "AcrySoft™", como en el menú de la tienda.

/// Separadores: el "|" con o sin espacios ("Amarillos| Beauty Solution"
/// también se ve); los demás solo con espacio a cada lado, para no partir
/// "Semi-permanente".
const SEPARATOR = /(\s*\|\s*|\s+(?:·|•|–|—|-)\s+)/;

/// Cuántos títulos deben terminar igual para tomar ese remate como el
/// nombre de la tienda, y qué parte de los títulos con "|" deben ser.
const MIN_REPEATS = 3;
const MIN_SHARE = 0.4;

function normalize(text: string) {
  return text
    .replace(/[™®©]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/// Partes y separadores intercalados: "A | B" → ["A", " | ", "B"].
function split(title: string) {
  return title.split(SEPARATOR);
}

/// "… Nombre" al final del título, con un espacio o separador antes.
function endsWithName(title: string, name: string) {
  const t = normalize(title);
  const n = normalize(name);
  if (!n || t === n || !t.endsWith(n)) return false;
  return /[\s|·•–—-]/.test(t.charAt(t.length - n.length - 1));
}

/// El remate que la tienda repite en sus títulos, o null si no hay uno.
export function detectStoreSuffix(titles: string[], storeName?: string | null): string | null {
  const name = storeName?.replace(/\s+/g, " ").trim();
  if (name && name.length >= 3 && titles.some((t) => endsWithName(t, name))) return name;

  const counts = new Map<string, { raw: string; n: number }>();
  let withPipe = 0;
  for (const title of titles) {
    const parts = split(title);
    if (parts.length < 3 || !parts[parts.length - 2].includes("|")) continue;
    withPipe++;
    const last = parts[parts.length - 1].trim();
    const key = normalize(last);
    // Un remate con números ("15ml", "x2") es parte del producto, no la tienda.
    if (key.length < 3 || /\d/.test(key)) continue;
    const entry = counts.get(key) ?? { raw: last, n: 0 };
    entry.n++;
    counts.set(key, entry);
  }
  let best: { raw: string; n: number } | null = null;
  for (const entry of counts.values()) if (!best || entry.n > best.n) best = entry;
  if (!best || best.n < MIN_REPEATS || best.n < withPipe * MIN_SHARE) return null;
  return best.raw;
}

/// Quita el nombre de la tienda de un título. Con `firstSegment`, un
/// título con "|" se queda solo con la primera parte (colecciones).
export function cleanTitle(title: string, suffix: string | null, options: { firstSegment?: boolean } = {}): string {
  const original = title.replace(/\s+/g, " ").trim();
  if (!original) return original;
  const parts = split(original);
  const key = suffix ? normalize(suffix) : "";
  const trailing = key
    ? new RegExp(`\\s+${key.split(" ").map(escapeRegExp).join("\\s+")}[™®©]?\\s*$`, "i")
    : null;

  const kept: { text: string; separatorBefore: string | null }[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    let text = parts[i].trim();
    if (key) {
      if (normalize(text) === key) continue;
      if (trailing) {
        const shorter = text.replace(trailing, "").trim();
        if (shorter) text = shorter;
      }
    }
    if (!text) continue;
    kept.push({ text, separatorBefore: i === 0 ? null : parts[i - 1] });
  }
  if (kept.length === 0) return original;
  if (options.firstSegment && kept.length > 1 && kept[1].separatorBefore?.includes("|")) kept.length = 1;

  let out = kept[0].text;
  for (let i = 1; i < kept.length; i++) {
    const separator = kept[i].separatorBefore ?? " | ";
    out += (separator.includes("|") ? " | " : separator) + kept[i].text;
  }
  out = out
    .replace(/\s+/g, " ")
    .replace(/^[\s|·•–—]+|[\s|·•–—]+$/g, "")
    .trim();
  return out || original;
}

/// Limpia de una vez los productos y las colecciones leídos de una
/// tienda. Devuelve copias y el remate que se quitó (para avisarlo).
export function cleanCatalogTitles<P extends { name: string }, C extends { name: string }>(
  products: P[],
  collections: C[],
  storeName?: string | null,
): { products: P[]; collections: C[]; suffix: string | null } {
  const suffix =
    detectStoreSuffix(
      products.map((p) => p.name),
      storeName,
    ) ??
    detectStoreSuffix(
      collections.map((c) => c.name),
      storeName,
    );
  return {
    products: products.map((p) => ({ ...p, name: cleanTitle(p.name, suffix) })),
    collections: collections.map((c) => ({ ...c, name: cleanTitle(c.name, suffix, { firstSegment: true }) })),
    suffix,
  };
}
