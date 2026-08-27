import { auth } from "@/auth";
import { NextResponse } from "next/server";

const roleHome: Record<string, string> = {
  CREATOR: "/creador",
  BRAND: "/marca",
  ADMIN: "/admin",
};

export default auth((req) => {
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

  return NextResponse.next();
});

export const config = {
  matcher: ["/creador/:path*", "/marca/:path*", "/admin/:path*"],
};
