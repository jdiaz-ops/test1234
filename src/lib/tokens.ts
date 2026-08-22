import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/// Reutilizamos el modelo VerificationToken (identifier + token + expires)
/// tanto para verificación de email como para recuperación de contraseña —
/// el "purpose" queda implícito en qué endpoint consume el token.

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createToken(email: string, ttlMs: number) {
  const token = randomToken();
  const expires = new Date(Date.now() + ttlMs);

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  return token;
}

/// Consume (borra) el token si es válido y no ha expirado. Devuelve el email
/// asociado, o null si el token no existe/expiró.
export async function consumeToken(token: string): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
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
