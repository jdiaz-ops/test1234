import { decodeHtmlEntities } from "@/lib/html-entities";

/// Carpeta pública de Google Drive como entrada de "Duplicar tienda" →
/// "Desde archivos" (ver drive-reader.ts). Código puro para probarlo.

export type DriveEntryKind = "file" | "folder" | "doc" | "sheet" | "slides";

export type DriveEntry = { id: string; name: string; kind: DriveEntryKind };

const ID = "[A-Za-z0-9_-]{10,}";

/// El id de la carpeta desde cualquier forma del link que comparte Drive:
/// /drive/folders/ID, /drive/u/0/folders/ID, ?id=ID, o el id solo.
export function driveFolderId(input: string): string | null {
  const raw = input.trim();
  if (new RegExp(`^${ID}$`).test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!/(^|\.)drive\.google\.com$/i.test(url.hostname)) return null;
    const folder = url.pathname.match(new RegExp(`/folders/(${ID})`));
    if (folder) return folder[1];
    const id = url.searchParams.get("id");
    return id && new RegExp(`^${ID}$`).test(id) ? id : null;
  } catch {
    return null;
  }
}

function kindFromHref(href: string): { id: string; kind: DriveEntryKind } | null {
  const patterns: [RegExp, DriveEntryKind][] = [
    [new RegExp(`/drive/(?:u/\\d+/)?folders/(${ID})`), "folder"],
    [new RegExp(`/document/d/(${ID})`), "doc"],
    [new RegExp(`/spreadsheets/d/(${ID})`), "sheet"],
    [new RegExp(`/presentation/d/(${ID})`), "slides"],
    [new RegExp(`/file/d/(${ID})`), "file"],
  ];
  for (const [re, kind] of patterns) {
    const m = href.match(re);
    if (m) return { id: m[1], kind };
  }
  return null;
}

/// La vista simple de una carpeta pública (drive.google.com/
/// embeddedfolderview?id=…): cada elemento es un enlace a /file/d/ID,
/// /drive/folders/ID o a un documento de Google, con su nombre en
/// "flip-entry-title".
export function parseEmbeddedFolder(html: string): DriveEntry[] {
  const out: DriveEntry[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const found = kindFromHref(decodeHtmlEntities(m[1]));
    if (!found || seen.has(found.id)) continue;
    const titleMatch = m[2].match(/class=["'][^"']*flip-entry-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const name = decodeHtmlEntities((titleMatch?.[1] ?? m[2]).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!name) continue;
    seen.add(found.id);
    out.push({ id: found.id, name: name.slice(0, 200), kind: found.kind });
  }
  return out;
}

const SUPPORTED_FILE = /\.(pdf|jpe?g|png|webp|xlsx|csv|txt)$/i;

/// Si "Desde archivos" puede leer este elemento. Los documentos de Google
/// se exportan (Docs → texto, Sheets → Excel, Slides → PDF).
export function isReadableDriveEntry(entry: DriveEntry) {
  return entry.kind !== "file" || SUPPORTED_FILE.test(entry.name);
}

/// El nombre con que se baja, con la extensión de lo que se exporta.
export function downloadName(entry: DriveEntry) {
  if (entry.kind === "doc") return `${entry.name}.txt`;
  if (entry.kind === "sheet") return `${entry.name}.xlsx`;
  if (entry.kind === "slides") return `${entry.name}.pdf`;
  return entry.name;
}
