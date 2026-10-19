import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize-email";

/// "Continuar con Google" (2026-10-19: "quiero que aparezca, pero que
/// funcione"): entra a la cuenta que ya existe con ese correo, sea marca,
/// creadora, aliado o admin. Las cuentas nacen por la lista de espera o el
/// registro, con su rol, así que un correo sin cuenta no crea una: vuelve
/// al login con el aviso (devuelve a dónde). Google ya verificó el correo,
/// así que la cuenta queda confirmada.
export async function checkGoogleSignIn(rawEmail: string | null | undefined, verifiedByGoogle: boolean): Promise<true | string> {
  if (!rawEmail || !verifiedByGoogle) return "/login?error=GoogleSinCorreo";
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) return "/login?error=GoogleSinCuenta";

  // El adapter de Auth.js busca la cuenta con el correo exacto que manda
  // Google: uno guardado con otra mayúscula se deja igual al de Google.
  const data: { email?: string; emailVerified?: Date } = {};
  if (user.email !== email) data.email = email;
  if (!user.emailVerified) data.emailVerified = new Date();
  if (Object.keys(data).length > 0) {
    try {
      await prisma.user.update({ where: { id: user.id }, data });
    } catch {
      return "/login?error=GoogleSinCuenta";
    }
  }
  return true;
}
