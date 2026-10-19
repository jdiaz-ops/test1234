import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export class FileUploadError extends Error {}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB — de sobra para logo/PDF/foto de documento

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
]);

function safeExt(filename: string) {
  const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext || "";
}

/// Sube un archivo (logo, RUT, Cámara de Comercio, PDF de factura, etc.) y
/// devuelve la URL pública donde queda.
///
/// En Vercel (Production o Preview) intenta Vercel Blob directamente — no se
/// fija en el nombre exacto de la variable de credenciales (Vercel ha usado
/// distintos nombres/mecanismos según la versión del producto; lo importante
/// es que el Blob Store esté conectado al proyecto). Si esa llamada falla,
/// se convierte en un error claro en vez de quedar en silencio.
/// Solo en desarrollo local (fuera de Vercel del todo) cae a guardar el
/// archivo directo en public/uploads — el sistema de archivos de Vercel es
/// de solo lectura en producción, así que ese respaldo nunca serviría ahí.
export async function uploadFile(file: File, folder: string): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new FileUploadError("El archivo es muy grande — el máximo es 8 MB.");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new FileUploadError("Formato no permitido — usa PNG, JPG, WEBP, SVG o PDF.");
  }

  const filename = `${folder}/${crypto.randomBytes(12).toString("hex")}${safeExt(file.name)}`;
  return storeFile(file, filename);
}

/// Lo que graban los navegadores: webm/ogg con Opus (Chrome, Android,
/// Firefox) o mp4 (Safari).
const AUDIO_EXT: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
};

/// Por debajo del límite de 4.5 MB que acepta una ruta en Vercel: 3
/// minutos de nota de voz pesan mucho menos.
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

/// Sube una nota de voz (buzón de sugerencias, ver suggestion-service.ts).
export async function uploadAudio(file: File, folder: string): Promise<string> {
  const type = file.type.split(";")[0].trim().toLowerCase();
  const ext = AUDIO_EXT[type];
  if (!ext) throw new FileUploadError("Formato de audio no permitido.");
  if (file.size > MAX_AUDIO_BYTES) throw new FileUploadError("La nota de voz es muy larga — graba una más corta.");
  return storeFile(file, `${folder}/${crypto.randomBytes(12).toString("hex")}${ext}`, type);
}

async function storeFile(file: File, filename: string, contentType?: string): Promise<string> {
  if (process.env.VERCEL) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, file, { access: "public", ...(contentType ? { contentType } : {}) });
      return blob.url;
    } catch (err) {
      throw new FileUploadError(
        `No se pudo subir el archivo a Vercel Blob (${
          err instanceof Error ? err.message : "error desconocido"
        }). Revisa que el Blob Store esté conectado a este proyecto.`
      );
    }
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const folder = path.posix.dirname(filename);
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });
    const diskName = path.posix.basename(filename);
    await writeFile(path.join(dir, diskName), bytes);
    return `/uploads/${folder}/${diskName}`;
  } catch {
    // Solo se llega aquí en desarrollo local (fuera de Vercel) — si esto
    // falla, es un problema real de permisos/disco de la máquina, no del
    // almacenamiento en producción.
    throw new FileUploadError("No se pudo guardar el archivo localmente — revisa los permisos de la carpeta public/uploads.");
  }
}
