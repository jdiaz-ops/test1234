import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/// Reutilizamos el modelo VerificationToken (identifier + token + expires)
/// tanto para verificación de email como para recuperación de contraseña —
/// el "purpose" queda implícito en qué endpoint consume el token.
///
/// Lo que se guarda en la columna `token` es el HASH (SHA-256) del token
/// real, nunca el token en sí — igual que una contraseña, para que una
/// fuga de la base no entregue tokens listos para usar (que además, a
/// diferencia de una contraseña, no hace falta ni adivinar: uno ya válido
/// funciona directo). El token real (el que sí sirve para entrar) solo
/// existe una vez, en el link que se manda por correo, y nunca se vuelve a
/// poder reconstruir a partir de lo guardado.

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createToken(email: string, ttlMs: number) {
  const token = randomToken();
  const expires = new Date(Date.now() + ttlMs);

  await prisma.verificationToken.create({
    data: { identifier: email, token: hashToken(token), expires },
  });

  return token;
}

/// Consume (borra) el token si es válido y no ha expirado. Devuelve el email
/// asociado, o null si el token no existe/expiró.
export async function consumeToken(token: string): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(token) },
  });

  if (!record) return null;

  // Siempre se borra al intentar consumirlo, sea válido o no, para que un
  // token no se pueda reutilizar indefinidamente.
  await prisma.verificationToken.delete({
    where: { token: record.token },
  });

  if (record.expires < new Date()) return null;

  return record.identifier;
}

export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
