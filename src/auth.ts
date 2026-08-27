import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeImpersonationToken } from "@/lib/impersonation";
import { normalizeEmail } from "@/lib/normalize-email";

/// Auth.js v5: un `throw new Error("lo que sea")` dentro de authorize() NO
/// llega al cliente con ese mensaje — signIn(..., {redirect:false}) siempre
/// devuelve result.error = "CredentialsSignin" (el `type` genérico), sin
/// importar qué se haya tirado. Lo que SÍ llega es result.code, y solo si
/// se tira una subclase de CredentialsSignin con su propio `code` (ver
/// login/page.tsx, que ya lee result.code en vez de result.error). Antes de
/// este fix, el login SIEMPRE mostraba "Correo o contraseña incorrectos"
/// para un correo sin verificar, aunque la contraseña fuera la correcta —
/// nunca llegaba a mostrar el mensaje real.
class EmailNotVerifiedSignin extends CredentialsSignin {
  code = "EMAIL_NOT_VERIFIED";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // El adapter guarda usuarios/cuentas OAuth (Google) en la base de datos,
  // pero la SESIÓN se maneja por JWT (ver más abajo) — necesario porque el
  // proveedor de Credentials no es compatible con sesiones de base de datos,
  // y además así una futura app móvil puede autenticarse con el mismo token.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
        impersonateToken: { label: "impersonateToken", type: "text" },
      },
      authorize: async (credentials) => {
        // Camino de "entrar como" — un admin Propietario ya generó este
        // token de un solo uso desde /api/admin/entrar-como (ver ese
        // endpoint para el chequeo de permisos); aquí solo se consume, nunca
        // se acepta un token que venga de otro lado (verificación de correo,
        // recuperación de contraseña usan una tabla completamente aparte).
        const impersonateToken = credentials?.impersonateToken as
          | string
          | undefined;
        if (impersonateToken) {
          const record = await consumeImpersonationToken(impersonateToken);
          if (!record) return null;

          const user = await prisma.user.findUnique({
            where: { id: record.targetUserId },
          });
          if (!user) return null;

          // El mismo token sirve para "Entrar como" (admin -> cuenta) y para
          // "Volver" (cuenta -> admin, ver /api/admin/entrar-como/salir) — se
          // distingue por el rol de a quién apunta: solo se puede terminar en
          // un ADMIN por el camino de "volver", nunca por "Entrar como" (ese
          // endpoint ya rechaza apuntar a otro admin), así que si el destino
          // es ADMIN, esta sesión ya NO está impersonando a nadie.
          const isReturnToAdmin = user.role === "ADMIN";

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            adminRole: user.adminRole,
            impersonated: !isReturnToAdmin,
            impersonatorId: !isReturnToAdmin
              ? record.createdByUserId
              : undefined,
          };
        }

        const rawEmail = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!rawEmail || !password) return null;

        // mode: "insensitive" (no solo normalizar rawEmail) porque cuentas
        // ya existentes pueden tener el correo guardado con otra
        // mayúscula/minúscula de antes de este fix — así entran igual, sin
        // tener que corregir esos registros a mano.
        const email = normalizeEmail(rawEmail);
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (!user || !user.passwordHash) return null;

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return null;

        if (!user.emailVerified) {
          // Verificación de email obligatoria: no se permite iniciar sesión
          // hasta confirmar el correo.
          throw new EmailNotVerifiedSignin();
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          adminRole: user.adminRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: import("@prisma/client").UserRole }).role;
        token.adminRole = (
          user as { adminRole?: import("@prisma/client").AdminRole | null }
        ).adminRole;
        token.impersonated =
          (user as { impersonated?: boolean }).impersonated ?? false;
        token.impersonatorId = (
          user as { impersonatorId?: string }
        ).impersonatorId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.adminRole = token.adminRole;
      session.user.impersonated = token.impersonated;
      session.user.impersonatorId = token.impersonatorId;
      return session;
    },
  },
});
