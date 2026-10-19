import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/// Links de un solo uso para entrar al portal de aliados sin contraseña (ver
/// AllyLoginToken en el schema y ally-service.ts). Aparte del resto del
/// servicio para que auth.ts no cargue correos ni notificaciones. Mismo
/// cuidado que "Entrar como" (lib/impersonation.ts): nunca se acepta un
/// token de otra tabla, solo se guarda el hash y se gasta al usarlo.

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createAllyLoginToken(userId: string, minutes: number) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.allyLoginToken.create({ data: { tokenHash: hashToken(token), userId, expires: new Date(Date.now() + minutes * 60_000) } });
  return token;
}

/// Si el link sirve, lo gasta y devuelve el usuario aliado; si no, null.
export async function consumeAllyLoginToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const record = await prisma.allyLoginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expires < new Date()) return null;
  const { count } = await prisma.allyLoginToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (count === 0) return null;
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  return user?.role === "ALLY" ? user : null;
}
