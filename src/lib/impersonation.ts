import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const TTL_MS = 60 * 1000; // 60 segundos — solo alcanza a redirigir, nunca se guarda ni se comparte.

export async function createImpersonationToken(targetUserId: string, createdByUserId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.impersonationToken.create({
    data: { token, targetUserId, createdByUserId, expires: new Date(Date.now() + TTL_MS) },
  });
  return token;
}

/// Se borra al leerlo, sea válido o no — de un solo uso, igual que los demás
/// tokens de la plataforma.
export async function consumeImpersonationToken(token: string): Promise<string | null> {
  const record = await prisma.impersonationToken.findUnique({ where: { token } });
  if (!record) return null;

  await prisma.impersonationToken.delete({ where: { token } });

  if (record.expires < new Date()) return null;
  return record.targetUserId;
}
