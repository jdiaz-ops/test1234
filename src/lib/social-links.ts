/// El link al perfil de una creadora en cada red, a partir de lo que guardó
/// (CreatorSocialLink: "Instagram" + "laura.nails", o un link completo).
/// Null si no se sabe armar (una red sin dirección conocida y sin link).

const PROFILE_URL: Record<string, (handle: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  facebook: (h) => `https://www.facebook.com/${h}`,
  "x (twitter)": (h) => `https://x.com/${h}`,
  x: (h) => `https://x.com/${h}`,
  twitter: (h) => `https://x.com/${h}`,
  threads: (h) => `https://www.threads.net/@${h}`,
  pinterest: (h) => `https://www.pinterest.com/${h}`,
  twitch: (h) => `https://www.twitch.tv/${h}`,
  kwai: (h) => `https://www.kwai.com/@${h}`,
};

export function socialProfileUrl(platform: string, handle: string): string | null {
  const value = handle.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  // "youtube.com/@laura" o "www.instagram.com/laura".
  if (/^[\w.-]+\.[a-z]{2,}\//i.test(value)) return `https://${value}`;
  const build = PROFILE_URL[platform.trim().toLowerCase()];
  return build ? build(encodeURIComponent(value.replace(/^@/, "").replace(/\s+/g, ""))) : null;
}

/// Primero las que más usan las marcas.
const ORDER = ["instagram", "tiktok", "youtube"];

export function sortSocialLinks<T extends { platform: string }>(links: T[]): T[] {
  const rank = (p: string) => {
    const i = ORDER.indexOf(p.trim().toLowerCase());
    return i === -1 ? ORDER.length : i;
  };
  return [...links].sort((a, b) => rank(a.platform) - rank(b.platform));
}
