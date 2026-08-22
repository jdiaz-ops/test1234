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
/// tokens de la plataforma. Devuelve también quién lo creó (createdByUserId)
/// porque el mismo mecanismo se usa en las dos direcciones: admin -> cuenta
/// (Entrar como) y cuenta -> admin (Salir/Volver), y para "volver" hace
/// falta saber a qué admin regresar.
export async function consumeImpersonationToken(
  token: string
): Promise<{ targetUserId: string; createdByUserId: string } | null> {
  const record = await prisma.impersonationToken.findUnique({ where: { token } });
  if (!record) return null;

  await prisma.impersonationToken.delete({ where: { token } });

  if (record.expires < new Date()) return null;
  return { targetUserId: record.targetUserId, createdByUserId: record.createdByUserId };
}
