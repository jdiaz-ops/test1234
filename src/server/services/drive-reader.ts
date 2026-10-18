import { driveFolderId, parseEmbeddedFolder, type DriveEntry, type DriveEntryKind } from "@/lib/drive-folder";

/// Lee una carpeta PÚBLICA de Google Drive ("cualquier persona con el
/// enlace") sin llaves de Google: la lista sale de la vista simple de la
/// carpeta (embeddedfolderview) y cada archivo se baja por el enlace de
/// descarga pública. Solo se habla con dominios de Google, así que no hay
/// riesgo de que el link lleve a direcciones internas.

export class DriveError extends Error {}

const MAX_FILES = 150;
const MAX_DEPTH = 3;
const MAX_FOLDERS = 30;
export const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;
const GOOGLE_HOST = /(^|\.)(google\.com|googleusercontent\.com)$/i;

async function googleFetch(url: string, timeoutMs = 20000): Promise<Response> {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== "https:" || !GOOGLE_HOST.test(parsed.hostname)) {
      throw new DriveError("Drive redirigió a un lugar inesperado.");
    }
    const res = await fetch(parsed, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) }).catch(() => {
      throw new DriveError("No pudimos conectar con Google Drive.");
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {});
      current = new URL(location, parsed).toString();
      continue;
    }
    return res;
  }
  throw new DriveError("Drive redirigió demasiadas veces.");
}

export type DriveListing = { files: DriveEntry[]; truncated: boolean };

export async function listDriveFolder(input: string): Promise<DriveListing> {
  const rootId = driveFolderId(input);
  if (!rootId) throw new DriveError("Ese no parece el link de una carpeta de Google Drive.");
  const files: DriveEntry[] = [];
  const queue: { id: string; depth: number; prefix: string }[] = [{ id: rootId, depth: 0, prefix: "" }];
  const seen = new Set<string>();
  let truncated = false;
  while (queue.length > 0 && seen.size < MAX_FOLDERS) {
    const folder = queue.shift()!;
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    const res = await googleFetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folder.id)}`);
    const html = res.ok ? await res.text() : "";
    // Una carpeta privada responde con la página de inicio de sesión.
    if (!res.ok || /accounts\.google\.com\/(ServiceLogin|v3\/signin)/i.test(html)) {
      if (folder.depth === 0) {
        throw new DriveError("No pudimos abrir la carpeta. En Drive, compártela como «Cualquier persona con el enlace».");
      }
      continue;
    }
    for (const entry of parseEmbeddedFolder(html)) {
      if (entry.kind === "folder") {
        if (folder.depth + 1 <= MAX_DEPTH) queue.push({ id: entry.id, depth: folder.depth + 1, prefix: `${folder.prefix}${entry.name}/` });
        continue;
      }
      if (files.length >= MAX_FILES) {
        truncated = true;
        break;
      }
      files.push({ ...entry, name: `${folder.prefix}${entry.name}` });
    }
  }
  return { files, truncated };
}

function downloadUrl(id: string, kind: DriveEntryKind) {
  const safe = encodeURIComponent(id);
  switch (kind) {
    case "doc":
      return `https://docs.google.com/document/d/${safe}/export?format=txt`;
    case "sheet":
      return `https://docs.google.com/spreadsheets/d/${safe}/export?format=xlsx`;
    case "slides":
      return `https://docs.google.com/presentation/d/${safe}/export/pdf`;
    default:
      return `https://drive.usercontent.google.com/download?id=${safe}&export=download&confirm=t`;
  }
}

/// Baja un archivo de la carpeta y lo devuelve como stream (puede pesar
/// más de lo que cabe en una respuesta normal de Vercel).
export async function downloadDriveFile(id: string, kind: DriveEntryKind): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id) || kind === "folder") throw new DriveError("Archivo no válido.");
  const res = await googleFetch(downloadUrl(id, kind), 45000);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  // Un archivo privado o con límite de descargas devuelve una página HTML.
  if (!res.ok || (type === "text/html" && kind !== "doc")) {
    await res.body?.cancel().catch(() => {});
    throw new DriveError("No se pudo bajar este archivo (¿está compartido como público?).");
  }
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_DOWNLOAD_BYTES) {
    await res.body?.cancel().catch(() => {});
    throw new DriveError("El archivo pesa más de 40 MB.");
  }
  let total = 0;
  const limited = res.body!.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > MAX_DOWNLOAD_BYTES) controller.error(new DriveError("El archivo pesa más de 40 MB."));
        else controller.enqueue(chunk);
      },
    }),
  );
  return new Response(limited, {
    headers: { "Content-Type": type || "application/octet-stream", "Cache-Control": "no-store" },
  });
}
