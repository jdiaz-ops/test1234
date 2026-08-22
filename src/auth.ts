import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeImpersonationToken } from "@/lib/impersonation";

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
        const impersonateToken = credentials?.impersonateToken as string | undefined;
        if (impersonateToken) {
          const targetUserId = await consumeImpersonationToken(impersonateToken);
          if (!targetUserId) return null;

          const user = await prisma.user.findUnique({ where: { id: targetUserId } });
          if (!user) return null;

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            adminRole: user.adminRole,
            impersonated: true,
          };
        }

        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return null;

        if (!user.emailVerified) {
          // Verificación de email obligatoria: no se permite iniciar sesión
          // hasta confirmar el correo.
          throw new Error("EMAIL_NOT_VERIFIED");
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
        token.adminRole = (user as { adminRole?: import("@prisma/client").AdminRole | null })
          .adminRole;
        token.impersonated = (user as { impersonated?: boolean }).impersonated ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.adminRole = token.adminRole;
      session.user.impersonated = token.impersonated;
      return session;
    },
  },
});
