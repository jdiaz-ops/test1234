import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBrandOnboardingStatus } from "@/server/services/onboarding-service";

const roleHome: Record<string, string> = {
  CREATOR: "/creador",
  BRAND: "/marca",
  ADMIN: "/admin",
};

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const protectedPrefixes = ["/creador", "/marca", "/admin"];
  const matchedPrefix = protectedPrefixes.find((p) => pathname.startsWith(p));

  if (!matchedPrefix) return NextResponse.next();

  // Sin sesión: al login, recordando a dónde quería ir.
  if (!session?.user) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión, pero intentando entrar al portal de otro rol: lo mandamos a
  // su propio portal en vez de mostrarle un error confuso.
  const expectedPrefix = roleHome[session.user.role];
  if (expectedPrefix && !pathname.startsWith(expectedPrefix)) {
    return NextResponse.redirect(new URL(expectedPrefix, req.nextUrl.origin));
  }

  // Antes de que una marca navegue el resto del portal, tiene que pasar por
  // "Empieza aquí" (perfil, tienda, cómo te cobramos, oferta) — si no,
  // aterrizaba en el dashboard con solo un link discreto al onboarding en el
  // menú, fácil de ignorar. Mientras el onboarding no esté completo,
  // cualquier ruta de /marca/* (incluida /marca al hacer login) redirige
  // directo a /marca/onboarding; apenas se completa, este chequeo deja de
  // intervenir y la navegación queda libre — igual que ya reflejaba BrandNav
  // (el link "Empieza aquí" desaparece solo cuando onboarding.complete).
  // Corre en runtime Node.js (default de proxy.ts en Next 16, no edge), así
  // que puede consultar Prisma directamente.
  if (
    session.user.role === "BRAND" &&
    !pathname.startsWith("/marca/onboarding")
  ) {
    const profile = await prisma.brandProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (profile) {
      const onboarding = await getBrandOnboardingStatus(profile);
      if (!onboarding.complete) {
        return NextResponse.redirect(
          new URL("/marca/onboarding", req.nextUrl.origin),
        );
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/creador/:path*", "/marca/:path*", "/admin/:path*"],
};
