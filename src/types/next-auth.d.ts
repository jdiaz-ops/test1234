import { UserRole, AdminRole } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

// Extiende los tipos de Auth.js para que el rol de la cuenta (creador / marca
// / admin) viaje dentro del JWT y de la sesión, y así tanto la web como una
// futura app puedan enrutar según el tipo de cuenta sin otra llamada extra.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      adminRole?: AdminRole | null;
      /// true cuando esta sesión nació de "Entrar como" (un admin
      /// Propietario viendo el portal como esta cuenta) — ver
      /// src/lib/impersonation.ts.
      impersonated?: boolean;
      /// Solo presente cuando impersonated=true: el id del admin al que hay
      /// que volver cuando se le da a "Salir".
      impersonatorId?: string;
    } & DefaultSessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    adminRole?: AdminRole | null;
    impersonated?: boolean;
    impersonatorId?: string;
  }
}

type DefaultSessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};
