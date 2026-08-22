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
/// En producción usa Vercel Blob (necesita BLOB_READ_WRITE_TOKEN — se activa
/// solo al crear un Blob Store en el proyecto de Vercel). Sin esa variable
/// (típico en desarrollo local), cae a guardar el archivo directo en
/// public/uploads — funciona perfecto para probar en `next dev`, pero NO
/// sirve en producción (el sistema de archivos de Vercel es de solo lectura
/// en producción / no persiste entre despliegues), por eso ahí sí hace falta
/// la variable real.
export async function uploadFile(file: File, folder: string): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new FileUploadError("El archivo es muy grande — el máximo es 8 MB.");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new FileUploadError("Formato no permitido — usa PNG, JPG, WEBP, SVG o PDF.");
  }

  const filename = `${folder}/${crypto.randomBytes(12).toString("hex")}${safeExt(file.name)}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, file, { access: "public" });
    return blob.url;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  const diskName = filename.split("/").pop()!;
  await writeFile(path.join(dir, diskName), bytes);
  return `/uploads/${folder}/${diskName}`;
}
